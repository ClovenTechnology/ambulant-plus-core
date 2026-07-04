async function getCoveragePlan(id: string) {
  const base =
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.APIGW_BASE ||
    (process.env.NODE_ENV === 'production' ? 'https://api-gateway.ambulantplus.co.za' : 'http://localhost:3010');

  try {
    const res = await fetch(`${base}/api/coverage/plans?orgId=org-default`, {
      cache: "no-store",
    });

    if (!res.ok) return null;

    const json = await res.json();
    const items = Array.isArray(json.items) ? json.items : [];
    return items.find((item: any) => item.id === id) || null;
  } catch {
    return null;
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

function statusTone(status?: string) {
  switch (String(status || "").toUpperCase()) {
    case "ACTIVE":
      return { bg: "#0f2a1f", border: "#14532d", text: "#bbf7d0" };
    case "DRAFT":
      return { bg: "#3b2608", border: "#92400e", text: "#fde68a" };
    default:
      return { bg: "#1f2937", border: "#374151", text: "#d1d5db" };
  }
}

function decisionTone(decision?: string) {
  switch (String(decision || "").toUpperCase()) {
    case "COVERED":
      return { bg: "#0f2a1f", border: "#14532d", text: "#bbf7d0" };
    case "NOT_COVERED":
    case "NOT_ELIGIBLE":
      return { bg: "#3a1017", border: "#7f1d1d", text: "#fecaca" };
    case "REQUIRES_AUTHORIZATION":
      return { bg: "#3b2608", border: "#92400e", text: "#fde68a" };
    default:
      return { bg: "#0c2238", border: "#1d4ed8", text: "#bfdbfe" };
  }
}

export default async function CoveragePlanDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const plan = await getCoveragePlan(params.id);

  if (!plan) {
    return (
      <main style={{ padding: 32 }}>
        <h1 style={{ marginTop: 0 }}>Coverage plan not found</h1>
      </main>
    );
  }

  const status = statusTone(plan.status);
  const rules = Array.isArray(plan.serviceRules) ? plan.serviceRules : [];

  const coveredRules = rules.filter((r: any) => String(r.decision || "").toUpperCase() === "COVERED").length;
  const preauthRules = rules.filter((r: any) => Boolean(r.preauthRequired)).length;
  const copayRules = rules.filter(
    (r: any) => Number(r.memberCopayMinor || 0) > 0 || Number(r.memberCopayPercent || 0) > 0
  ).length;
  const limitedRules = rules.filter(
    (r: any) => Number(r.limitCount || 0) > 0 || Number(r.limitMinor || 0) > 0
  ).length;

  return (
    <main style={{ padding: 32, maxWidth: 1420 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, letterSpacing: 1.5, opacity: 0.7, textTransform: "uppercase" }}>
          Coverage Plan
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{ margin: "8px 0 8px", fontSize: 34 }}>{plan.name}</h1>
          <span
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 999,
              background: status.bg,
              border: `1px solid ${status.border}`,
              color: status.text,
            }}
          >
            {plan.status || "—"}
          </span>
        </div>
        <p style={{ margin: 0, opacity: 0.82 }}>
          {plan.description || "No description yet."}
        </p>
      </div>

      <section
        style={{
          background: "#121931",
          border: "1px solid #1f2a4d",
          borderRadius: 14,
          padding: 16,
          marginBottom: 18,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ opacity: 0.82, fontSize: 14 }}>
          Need to change sponsor decision logic, co-pay posture, preauth flags, or visit-mode restrictions?
        </div>

        <a
          href={`/products/${plan.id}/rules`}
          style={{
            background: "#2563eb",
            border: "1px solid #1d4ed8",
            color: "white",
            borderRadius: 12,
            padding: "12px 16px",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Open writable rule editor
        </a>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <Metric label="Currency" value={plan.currency || "ZAR"} />
        <Metric label="Rules" value={String(rules.length)} />
        <Metric label="Covered rules" value={String(coveredRules)} />
        <Metric label="Preauth rules" value={String(preauthRules)} />
        <Metric label="Co-pay rules" value={String(copayRules)} />
        <Metric label="Limited rules" value={String(limitedRules)} />
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <Metric label="Annual limit" value={money(plan.annualLimitMinor, plan.currency || "ZAR")} />
        <Metric label="Monthly limit" value={money(plan.monthlyLimitMinor, plan.currency || "ZAR")} />
        <Metric label="Lifetime limit" value={money(plan.lifetimeLimitMinor, plan.currency || "ZAR")} />
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
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Plan posture</h2>
        <div style={{ display: "grid", gap: 8, opacity: 0.88, fontSize: 14 }}>
          <div>Requires eligibility: {plan.requiresEligibility ? "Yes" : "No"}</div>
          <div>Requires consent: {plan.requiresConsent ? "Yes" : "No"}</div>
          <div>Client program: {plan.clientProgramId || "—"}</div>
          <div>Client: {plan.clientId || "—"}</div>
        </div>
      </section>

      <section
        style={{
          background: "#121931",
          border: "1px solid #1f2a4d",
          borderRadius: 18,
          padding: 18,
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Coverage service rules</h2>
        <div style={{ opacity: 0.78, fontSize: 14, marginBottom: 16 }}>
          This is the live rule surface backing sponsor adjudication and coverage preflight.
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {rules.length === 0 ? (
            <div style={{ opacity: 0.72 }}>No service rules attached yet.</div>
          ) : (
            rules.map((rule: any) => {
              const tone = decisionTone(rule.decision);

              return (
                <div
                  key={rule.id}
                  style={{
                    background: "#0f1730",
                    border: "1px solid #1f2a4d",
                    borderRadius: 14,
                    padding: 14,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.3fr 1fr",
                      gap: 16,
                      alignItems: "start",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                        <div style={{ fontWeight: 700 }}>{rule.serviceType || "—"}</div>
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
                          {rule.decision || "—"}
                        </span>
                        {!rule.enabled ? (
                          <span
                            style={{
                              fontSize: 12,
                              padding: "4px 10px",
                              borderRadius: 999,
                              background: "#1f2937",
                              border: "1px solid #374151",
                              color: "#d1d5db",
                            }}
                          >
                            disabled
                          </span>
                        ) : null}
                        {rule.preauthRequired ? (
                          <span
                            style={{
                              fontSize: 12,
                              padding: "4px 10px",
                              borderRadius: 999,
                              background: "#3b2608",
                              border: "1px solid #92400e",
                              color: "#fde68a",
                            }}
                          >
                            preauth required
                          </span>
                        ) : null}
                      </div>

                      <div style={{ marginTop: 8, opacity: 0.72, fontSize: 13 }}>
                        Allowed visit modes: {Array.isArray(rule.allowedVisitModes) && rule.allowedVisitModes.length ? rule.allowedVisitModes.join(", ") : "Any / not specified"}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: 10,
                      }}
                    >
                      <MiniMetric label="Sponsor cap" value={money(rule.sponsorCapMinor, plan.currency || "ZAR")} />
                      <MiniMetric label="Fixed co-pay" value={money(rule.memberCopayMinor, plan.currency || "ZAR")} />
                      <MiniMetric label="Co-pay %" value={rule.memberCopayPercent ?? 0} />
                      <MiniMetric label="Limit count" value={rule.limitCount ?? "—"} />
                      <MiniMetric label="Limit amount" value={money(rule.limitMinor, plan.currency || "ZAR")} />
                      <MiniMetric label="Limit period" value={rule.limitPeriod || "—"} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
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