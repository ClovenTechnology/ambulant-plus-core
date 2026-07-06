import { cookies, headers } from "next/headers";
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

    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json.items) ? json.items : [];
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

function toneForStatus(status?: string) {
  switch (String(status || "").toUpperCase()) {
    case "ACTIVE":
      return { bg: "#0f2a1f", border: "#14532d", text: "#bbf7d0" };
    case "DRAFT":
      return { bg: "#3b2608", border: "#92400e", text: "#fde68a" };
    default:
      return { bg: "#1f2937", border: "#374151", text: "#d1d5db" };
  }
}

export default async function ProductsPage() {
  const plans = await getCoveragePlans();

  return (
    <main style={{ padding: 32, maxWidth: 1380 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, letterSpacing: 1.5, opacity: 0.7, textTransform: "uppercase" }}>
          Payer Product Studio
        </div>
        <h1 style={{ margin: "8px 0 8px", fontSize: 34 }}>Products & Packages</h1>
        <p style={{ margin: 0, opacity: 0.82 }}>
          Coverage plans, package variants, service-rule posture, ceilings, co-pay design, and pre-authorisation shape.
        </p>
      </div>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <Metric label="Coverage Plans" value={String(plans.length)} />
        <Metric
          label="Active Plans"
          value={String(plans.filter((x: any) => String(x.status || "").toUpperCase() === "ACTIVE").length)}
        />
        <Metric
          label="Rule-enabled Plans"
          value={String(plans.filter((x: any) => Array.isArray(x.serviceRules) && x.serviceRules.length > 0).length)}
        />
        <Metric
          label="Eligibility-required"
          value={String(plans.filter((x: any) => x.requiresEligibility).length)}
        />
      </section>

      <section
        style={{
          background: "#121931",
          border: "1px solid #1f2a4d",
          borderRadius: 18,
          padding: 18,
          marginBottom: 18,
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Operational next step</h2>
        <div style={{ opacity: 0.85, fontSize: 14, lineHeight: 1.7 }}>
          This page is already wired to live plans. Next, add create/edit flows for:
          regional adapter selection, plan variant/option metadata, dependent eligibility,
          waiting periods, network/DSP rules, OTC restrictions, PMB/chronic flags,
          and category ceilings.
        </div>
      </section>

      <div style={{ display: "grid", gap: 14 }}>
        {plans.length === 0 ? (
          <div style={{ opacity: 0.72 }}>No coverage plans found yet.</div>
        ) : (
          plans.map((plan: any) => {
            const tone = toneForStatus(plan.status);
            const rules = Array.isArray(plan.serviceRules) ? plan.serviceRules : [];
            const preauthRules = rules.filter((r: any) => r.preauthRequired).length;
            const copayRules = rules.filter(
              (r: any) =>
                Number(r.memberCopayMinor || 0) > 0 || Number(r.memberCopayPercent || 0) > 0
            ).length;

            return (
              <section
                key={plan.id}
                style={{
                  background: "#121931",
                  border: "1px solid #1f2a4d",
                  borderRadius: 16,
                  padding: 18,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.45fr 1fr",
                    gap: 16,
                    alignItems: "start",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <a
                        href={`/products/${plan.id}`}
                        style={{
                          fontWeight: 700,
                          fontSize: 18,
                          color: "inherit",
                          textDecoration: "none",
                        }}
                      >
                        {plan.name || "Unnamed plan"}
                      </a>
                      <span
                        style={{
                          fontSize: 12,
                          padding: "4px 10px",
                          borderRadius: 999,
                          background: tone.bg,
                          border: `1px solid ${tone.border}`,
                          color: tone.text,
                        }}
                      >
                        {plan.status || "—"}
                      </span>
                    </div>

                    <div style={{ marginTop: 8, opacity: 0.82, fontSize: 14 }}>
                      {plan.description || "No description yet."}
                    </div>

                    <div style={{ marginTop: 8, opacity: 0.68, fontSize: 13 }}>
                      Currency: {plan.currency || "ZAR"} · Requires eligibility: {plan.requiresEligibility ? "Yes" : "No"} · Requires consent: {plan.requiresConsent ? "Yes" : "No"}
                    </div>

                    <div style={{ marginTop: 8, opacity: 0.68, fontSize: 13 }}>
                      Annual: {money(plan.annualLimitMinor, plan.currency || "ZAR")} · Monthly: {money(plan.monthlyLimitMinor, plan.currency || "ZAR")} · Lifetime: {money(plan.lifetimeLimitMinor, plan.currency || "ZAR")}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 10,
                    }}
                  >
                    <MiniMetric label="Rules" value={rules.length} />
                    <MiniMetric label="Preauth rules" value={preauthRules} />
                    <MiniMetric label="Co-pay rules" value={copayRules} />
                    <MiniMetric
                      label="Covered rules"
                      value={rules.filter((r: any) => String(r.decision || "").toUpperCase() === "COVERED").length}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                  {rules.length === 0 ? (
                    <div
                      style={{
                        background: "#0f1730",
                        border: "1px solid #1f2a4d",
                        borderRadius: 12,
                        padding: 12,
                        opacity: 0.72,
                        fontSize: 13,
                      }}
                    >
                      No coverage service rules attached yet.
                    </div>
                  ) : (
                    rules.slice(0, 8).map((rule: any) => (
                      <div
                        key={rule.id}
                        style={{
                          background: "#0f1730",
                          border: "1px solid #1f2a4d",
                          borderRadius: 12,
                          padding: 12,
                          display: "grid",
                          gridTemplateColumns: "1.3fr repeat(5, minmax(0, 1fr))",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>
                            {rule.serviceType || "—"}
                          </div>
                          <div style={{ opacity: 0.68, fontSize: 12, marginTop: 4 }}>
                            {rule.enabled ? "Enabled" : "Disabled"} · Decision {rule.decision || "—"}
                          </div>
                        </div>

                        <MiniMetric label="Preauth" value={rule.preauthRequired ? "Yes" : "No"} />
                        <MiniMetric label="Cap" value={money(rule.sponsorCapMinor, plan.currency || "ZAR")} />
                        <MiniMetric label="Co-pay fixed" value={money(rule.memberCopayMinor, plan.currency || "ZAR")} />
                        <MiniMetric label="Co-pay %" value={rule.memberCopayPercent ?? 0} />
                        <MiniMetric label="Limit" value={rule.limitCount ?? rule.limitMinor ?? "—"} />
                      </div>
                    ))
                  )}
                </div>
              </section>
            );
          })
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: "#121931",
        border: "1px solid #1f2a4d",
        borderRadius: 14,
        padding: 16,
      }}
    >
      <div style={{ opacity: 0.7, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: "#121931",
        border: "1px solid #1f2a4d",
        borderRadius: 12,
        padding: 10,
      }}
    >
      <div style={{ fontSize: 11, opacity: 0.68 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 15, fontWeight: 700 }}>{value}</div>
    </div>
  );
}