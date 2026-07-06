import { cookies, headers } from "next/headers";
import Link from "next/link";
import type { CSSProperties } from "react";

function appOrigin() {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "https";

  if (!host) {
    throw new Error("client_app_origin_required");
  }

  return `${proto}://${host}`;
}

function internalRequestHeaders(extra: Record<string, string> = {}) {
  return {
    cookie: cookies().toString(),
    ...extra,
  };
}

function internalApiUrl(
  pathname: string,
  params: Record<string, string | number | undefined> = {},
) {
  const url = new URL(pathname, appOrigin());

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

async function getCoveragePlans() {
  try {
    const res = await fetch(internalApiUrl("/api/coverage/plans").toString(), {
      cache: "no-store",
      headers: internalRequestHeaders(),
    });

    if (!res.ok) {
      return [];
    }

    const json = await res.json().catch(() => null);
    return Array.isArray(json?.items) ? json.items : [];
  } catch {
    return [];
  }
}

function money(minor?: number | null, currency = "ZAR") {
  const value = Number(minor || 0) / 100;

  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function norm(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function yesNo(value: unknown) {
  return value ? "Yes" : "No";
}

function ruleMeta(rule: any) {
  const metadata =
    rule?.metadata && typeof rule.metadata === "object" ? rule.metadata : {};

  const serviceType = norm(rule.serviceType);

  return {
    benefitBucket:
      metadata.benefitBucket ||
      metadata.bucket ||
      (serviceType.includes("PHARMACY")
        ? "CHRONIC_MEDICINE"
        : serviceType.includes("LAB")
        ? "PATHOLOGY"
        : serviceType.includes("DEVICE")
        ? "DEVICE_BENEFIT"
        : serviceType.includes("RIDER")
        ? "DELIVERY"
        : "PRIMARY_CARE"),
    pmbFlag:
      metadata.pmbFlag ??
      metadata.pmb ??
      serviceType.includes("PHYSICAL") ??
      false,
    cdlFlag:
      metadata.cdlFlag ??
      metadata.cdl ??
      metadata.chronicFlag ??
      serviceType.includes("PHARMACY"),
    chronicFlag:
      metadata.chronicFlag ??
      metadata.chronic ??
      serviceType.includes("PHARMACY"),
    pregnancyFlag:
      metadata.pregnancyFlag ??
      metadata.maternityFlag ??
      false,
    emergencyFlag:
      metadata.emergencyFlag ??
      serviceType.includes("EMERGENCY"),
    dspRequired:
      metadata.dspRequired ??
      metadata.designatedServiceProviderRequired ??
      serviceType.includes("PHARMACY"),
    networkRequired:
      metadata.networkRequired ??
      metadata.inNetworkRequired ??
      true,
    formularyRequired:
      metadata.formularyRequired ??
      serviceType.includes("PHARMACY"),
    protocolCode:
      metadata.protocolCode ||
      metadata.protocolVersion ||
      "Not set",
    waitingPeriodApplies:
      metadata.waitingPeriodApplies ??
      metadata.waitingPeriod ??
      false,
    clinicalEvidenceRequired:
      metadata.clinicalEvidenceRequired ??
      metadata.motivationRequired ??
      rule.preauthRequired ??
      false,
    manualReviewRequired:
      metadata.manualReviewRequired ??
      norm(rule.decision) === "REQUIRES_AUTHORIZATION",
  };
}

function decisionTone(decision?: string) {
  switch (norm(decision)) {
    case "COVERED":
      return { bg: "#0f2a1f", border: "#14532d", text: "#bbf7d0" };
    case "REQUIRES_AUTHORIZATION":
      return { bg: "#3b2608", border: "#92400e", text: "#fde68a" };
    case "NOT_COVERED":
    case "NOT_ELIGIBLE":
      return { bg: "#3a1017", border: "#7f1d1d", text: "#fecaca" };
    default:
      return { bg: "#1f2937", border: "#374151", text: "#d1d5db" };
  }
}

function statusTone(status?: string) {
  switch (norm(status)) {
    case "ACTIVE":
      return { bg: "#0f2a1f", border: "#14532d", text: "#bbf7d0" };
    case "DRAFT":
      return { bg: "#3b2608", border: "#92400e", text: "#fde68a" };
    default:
      return { bg: "#1f2937", border: "#374151", text: "#d1d5db" };
  }
}

export default async function CoveragePage() {
  const plans = await getCoveragePlans();
  const rules = plans.flatMap((plan: any) =>
    Array.isArray(plan.serviceRules)
      ? plan.serviceRules.map((rule: any) => ({ ...rule, plan }))
      : []
  );

  const preauthRules = rules.filter(
    (r: any) => r.preauthRequired || norm(r.decision) === "REQUIRES_AUTHORIZATION"
  );

  const copayRules = rules.filter(
    (r: any) =>
      Number(r.memberCopayMinor || 0) > 0 ||
      Number(r.memberCopayPercent || 0) > 0
  );

  const pmbRules = rules.filter((r: any) => ruleMeta(r).pmbFlag);
  const chronicRules = rules.filter((r: any) => ruleMeta(r).chronicFlag || ruleMeta(r).cdlFlag);
  const dspRules = rules.filter((r: any) => ruleMeta(r).dspRequired);
  const waitingRules = rules.filter((r: any) => ruleMeta(r).waitingPeriodApplies);

  return (
    <main style={{ padding: 32, maxWidth: 1480 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={eyebrow}>Coverage Operations</div>
        <h1 style={{ margin: "8px 0 8px", fontSize: 34 }}>Coverage</h1>
        <p style={{ opacity: 0.82, margin: 0 }}>
          Benefit-rule operations across eligibility, PMB/CDL, DSP/network, formulary,
          waiting-period, co-pay, pre-authorisation, caps, and service inclusion posture.
        </p>
      </div>

      <section style={metricGrid}>
        <Metric label="Coverage plans" value={plans.length} sub="Current org scope" />
        <Metric label="Service rules" value={rules.length} sub={`${preauthRules.length} preauth rules`} />
        <Metric label="Co-pay rules" value={copayRules.length} sub="Fixed or percentage co-pay" />
        <Metric label="PMB/CDL/chronic" value={`${pmbRules.length}/${chronicRules.length}`} sub="PMB-like / chronic rules" />
        <Metric label="DSP/network rules" value={dspRules.length} sub={`${waitingRules.length} waiting-period rules`} />
      </section>

      <section style={{ ...card, marginTop: 20 }}>
        <h2 style={{ marginTop: 0 }}>Scheme-grade rule posture</h2>
        <div style={{ opacity: 0.82, lineHeight: 1.7 }}>
          This page is the operations lens over products and packages. It should answer:
          is the member eligible, is the service covered, is PMB/CDL/chronic handling involved,
          must the member use a DSP or network provider, is formulary/protocol evidence required,
          does a waiting period apply, is pre-authorisation required, and what portion remains
          member responsibility?
        </div>
      </section>

      <section style={{ display: "grid", gap: 16, marginTop: 20 }}>
        {plans.length === 0 ? (
          <div style={{ opacity: 0.72 }}>No coverage plans found yet.</div>
        ) : (
          plans.map((plan: any) => {
            const planTone = statusTone(plan.status);
            const planRules = Array.isArray(plan.serviceRules)
              ? plan.serviceRules
              : [];
            const currency = plan.currency || "ZAR";

            return (
              <article key={plan.id} style={card}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                    alignItems: "start",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <Link
                        href={`/products/${plan.id}`}
                        style={{ color: "inherit", textDecoration: "none", fontWeight: 800, fontSize: 18 }}
                      >
                        {plan.name || "Unnamed plan"}
                      </Link>
                      <span
                        style={{
                          ...pill,
                          background: planTone.bg,
                          borderColor: planTone.border,
                          color: planTone.text,
                        }}
                      >
                        {plan.status || "UNKNOWN"}
                      </span>
                      <span style={mutedPill}>{currency}</span>
                    </div>

                    <div style={{ opacity: 0.74, fontSize: 13, marginTop: 8 }}>
                      Eligibility: {yesNo(plan.requiresEligibility)} · Consent:{" "}
                      {yesNo(plan.requiresConsent)} · Annual {money(plan.annualLimitMinor, currency)} · Monthly{" "}
                      {money(plan.monthlyLimitMinor, currency)}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Link href={`/products/${plan.id}`} style={linkButton}>
                      View product
                    </Link>
                    <Link href={`/products/${plan.id}/rules`} style={primaryButton}>
                      Edit rules
                    </Link>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
                  {planRules.length === 0 ? (
                    <div style={lineCard}>No service rules attached yet.</div>
                  ) : (
                    planRules.map((rule: any) => {
                      const meta = ruleMeta(rule);
                      const tone = decisionTone(rule.decision);

                      return (
                        <div key={rule.id} style={lineCard}>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1.1fr 1.5fr 1fr",
                              gap: 14,
                              alignItems: "start",
                            }}
                          >
                            <div>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                <strong>{rule.serviceType || "SERVICE"}</strong>
                                <span
                                  style={{
                                    ...pill,
                                    background: tone.bg,
                                    borderColor: tone.border,
                                    color: tone.text,
                                  }}
                                >
                                  {rule.decision || "—"}
                                </span>
                                {rule.preauthRequired || norm(rule.decision) === "REQUIRES_AUTHORIZATION" ? (
                                  <span style={warningPill}>preauth</span>
                                ) : null}
                              </div>

                              <div style={{ opacity: 0.72, fontSize: 12, marginTop: 7 }}>
                                Bucket: {meta.benefitBucket}
                              </div>
                            </div>

                            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                              <Flag label="PMB" active={meta.pmbFlag} />
                              <Flag label="CDL" active={meta.cdlFlag} />
                              <Flag label="Chronic" active={meta.chronicFlag} />
                              <Flag label="Pregnancy" active={meta.pregnancyFlag} />
                              <Flag label="DSP" active={meta.dspRequired} />
                              <Flag label="Network" active={meta.networkRequired} />
                              <Flag label="Formulary" active={meta.formularyRequired} />
                              <Flag label="Waiting" active={meta.waitingPeriodApplies} />
                              <Flag label="Evidence" active={meta.clinicalEvidenceRequired} />
                              <Flag label="Manual review" active={meta.manualReviewRequired} />
                            </div>

                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                                gap: 8,
                              }}
                            >
                              <Mini label="Cap" value={money(rule.sponsorCapMinor, currency)} />
                              <Mini label="Co-pay" value={money(rule.memberCopayMinor, currency)} />
                              <Mini label="Co-pay %" value={rule.memberCopayPercent ?? 0} />
                              <Mini label="Limit" value={rule.limitCount ?? rule.limitMinor ?? "—"} />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}

function Metric({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div style={card}>
      <div style={{ opacity: 0.7, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800 }}>{value}</div>
      <div style={{ marginTop: 8, opacity: 0.72, fontSize: 13 }}>{sub}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={miniCard}>
      <div style={{ fontSize: 11, opacity: 0.65 }}>{label}</div>
      <div style={{ marginTop: 5, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function Flag({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      style={{
        ...pill,
        background: active ? "#0f2a1f" : "#1f2937",
        borderColor: active ? "#14532d" : "#374151",
        color: active ? "#bbf7d0" : "#d1d5db",
      }}
    >
      {label}
    </span>
  );
}

const eyebrow: CSSProperties = {
  fontSize: 12,
  letterSpacing: 1.5,
  opacity: 0.7,
  textTransform: "uppercase",
};

const metricGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
};

const card: CSSProperties = {
  background: "#121931",
  border: "1px solid #1f2a4d",
  borderRadius: 16,
  padding: 18,
};

const lineCard: CSSProperties = {
  background: "#0f1730",
  border: "1px solid #1f2a4d",
  borderRadius: 14,
  padding: 14,
};

const miniCard: CSSProperties = {
  background: "#121931",
  border: "1px solid #1f2a4d",
  borderRadius: 12,
  padding: 10,
};

const pill: CSSProperties = {
  fontSize: 11,
  border: "1px solid",
  borderRadius: 999,
  padding: "3px 9px",
  fontWeight: 700,
};

const mutedPill: CSSProperties = {
  ...pill,
  background: "#1f2937",
  borderColor: "#374151",
  color: "#d1d5db",
};

const warningPill: CSSProperties = {
  ...pill,
  background: "#3b2608",
  borderColor: "#92400e",
  color: "#fde68a",
};

const primaryButton: CSSProperties = {
  background: "#2563eb",
  border: "1px solid #1d4ed8",
  color: "white",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 700,
  textDecoration: "none",
};

const linkButton: CSSProperties = {
  background: "#121931",
  border: "1px solid #334155",
  color: "white",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 700,
  textDecoration: "none",
};