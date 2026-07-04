import Link from "next/link";

type Params = {
  params: {
    id: string;
  };
};

function apiBase() {
  return (
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.APIGW_BASE ||
    (process.env.NODE_ENV === 'production' ? 'https://api-gateway.ambulantplus.co.za' : 'http://localhost:3010')
  );
}

async function getClaim(id: string) {
  try {
    const res = await fetch(`${apiBase()}/api/claims/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json) {
      return { ok: false, error: json?.error || `HTTP ${res.status}`, item: null };
    }

    return json;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to load claim.",
      item: null,
    };
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

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : "—";
}

function statusTone(status?: string) {
  switch (String(status || "").toUpperCase()) {
    case "PAID":
      return { bg: "#0f2a1f", border: "#14532d", text: "#bbf7d0" };
    case "APPROVED":
    case "PARTIALLY_APPROVED":
      return { bg: "#0c2238", border: "#1d4ed8", text: "#bfdbfe" };
    case "SUBMITTED":
    case "RECEIVED":
    case "IN_REVIEW":
      return { bg: "#3b2608", border: "#92400e", text: "#fde68a" };
    case "REJECTED":
    case "DENIED":
      return { bg: "#3a1017", border: "#7f1d1d", text: "#fecaca" };
    default:
      return { bg: "#1f2937", border: "#374151", text: "#d1d5db" };
  }
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function safeJson(value: unknown) {
  if (!value) return {};
  return value;
}

export default async function ClaimDetailPage({ params }: Params) {
  const data = await getClaim(params.id);

  if (data.ok === false || !data.item) {
    return (
      <main style={{ padding: 32, maxWidth: 1100 }}>
        <Link href="/claims" style={{ color: "#93c5fd", textDecoration: "none" }}>
          ← Back to claims
        </Link>

        <section style={errorBox}>
          {data.error || "Claim not found."}
        </section>
      </main>
    );
  }

  const claim = data.item;
  const tone = statusTone(claim.status);

  const member = claim.clientMember || {};
  const plan = claim.coveragePlan || {};
  const client = claim.client || {};
  const auth = claim.authorization || {};
  const lines = asArray(claim.lines);
  const settlements = asArray(claim.settlements);

  return (
    <main style={{ padding: 32, maxWidth: 1320 }}>
      <Link href="/claims" style={{ color: "#93c5fd", textDecoration: "none" }}>
        ← Back to claims
      </Link>

      <div style={{ marginTop: 18, marginBottom: 24 }}>
        <div
          style={{
            fontSize: 12,
            letterSpacing: 1.5,
            opacity: 0.7,
            textTransform: "uppercase",
          }}
        >
          Claim Detail
        </div>

        <h1 style={{ margin: "8px 0 8px", fontSize: 34 }}>
          {claim.claimNumber || claim.id}
        </h1>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              ...pill,
              background: tone.bg,
              borderColor: tone.border,
              color: tone.text,
            }}
          >
            {claim.status || "UNKNOWN"}
          </span>

          <span style={mutedPill}>{claim.claimType || "CLAIM"}</span>

          {claim.serviceType ? <span style={mutedPill}>{claim.serviceType}</span> : null}

          {claim.externalClaimRef ? (
            <span style={mutedPill}>External ref {claim.externalClaimRef}</span>
          ) : null}
        </div>
      </div>

      <section style={metricGrid}>
        <Metric
          label="Submitted"
          value={money(claim.submittedAmountMinor, claim.currency)}
          sub={fmtDate(claim.submittedAt)}
        />
        <Metric
          label="Approved"
          value={money(claim.approvedAmountMinor, claim.currency)}
          sub={fmtDate(claim.decidedAt)}
        />
        <Metric
          label="Paid"
          value={money(claim.paidAmountMinor, claim.currency)}
          sub={fmtDate(claim.paidAt)}
        />
        <Metric
          label="Member responsibility"
          value={money(claim.memberResponsibilityMinor, claim.currency)}
          sub="Co-pay / uncovered gap"
        />
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginTop: 16,
        }}
      >
        <div style={card}>
          <h2 style={{ marginTop: 0 }}>Member and payer context</h2>
          <Info label="Medical Aid / Client" value={client.tradingName || client.legalName || "—"} />
          <Info label="Member number" value={member.memberNumber || "—"} />
          <Info label="Dependant code" value={member.dependentCode || "00"} />
          <Info label="Principal member" value={member.principalMemberNumber || "—"} />
          <Info label="Plan / option" value={plan.name || "—"} />
          <Info label="Patient ID" value={claim.patientId || "—"} />
        </div>

        <div style={card}>
          <h2 style={{ marginTop: 0 }}>Authorization and remittance</h2>
          <Info label="Authorization" value={claim.authorizationId || "—"} />
          <Info label="Authorization status" value={auth.status || "—"} />
          <Info label="Preauth reference" value={auth.preauthReference || "—"} />
          <Info label="External claim ref" value={claim.externalClaimRef || "—"} />
          <Info label="Response adjudication" value={claim.responsePayload?.adjudication || "—"} />
          <Info label="Response reason" value={claim.responsePayload?.reason || claim.notes || "—"} />
        </div>
      </section>

      <section style={{ ...card, marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Claim lines</h2>

        {lines.length === 0 ? (
          <div style={{ opacity: 0.72 }}>No claim lines available.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {lines.map((line: any) => {
              const meta = line.metadata || {};
              const billable = line.billableEvent || {};

              return (
                <div key={line.id} style={lineCard}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <strong>
                        {meta.codeLabel || billable.serviceType || line.billableEventId || line.id}
                      </strong>

                      <div style={{ opacity: 0.72, fontSize: 13, marginTop: 6 }}>
                        Code: {meta.code || meta.nappiCode || meta.tariffCode || "—"} · System:{" "}
                        {meta.codeSystem || "—"} · ICD-10:{" "}
                        {asArray(meta.icd10Codes).join(", ") || "—"}
                      </div>

                      <div style={{ opacity: 0.68, fontSize: 12, marginTop: 5 }}>
                        Provider lane: {billable.providerLane || "—"} · Provider:{" "}
                        {billable.metadata?.providerName || billable.providerId || "—"}
                      </div>

                      {line.rejectionReason ? (
                        <div style={{ color: "#fde68a", marginTop: 8, fontSize: 13 }}>
                          {line.rejectionReason}
                        </div>
                      ) : null}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, minmax(120px, 1fr))",
                        gap: 10,
                        minWidth: 390,
                      }}
                    >
                      <Mini label="Submitted" value={money(line.submittedAmountMinor, claim.currency)} />
                      <Mini label="Approved" value={money(line.approvedAmountMinor, claim.currency)} />
                      <Mini label="Paid" value={money(line.paidAmountMinor, claim.currency)} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginTop: 16,
        }}
      >
        <div style={card}>
          <h2 style={{ marginTop: 0 }}>Submission payload</h2>
          <pre style={preStyle}>{JSON.stringify(safeJson(claim.submissionPayload), null, 2)}</pre>
        </div>

        <div style={card}>
          <h2 style={{ marginTop: 0 }}>Response payload</h2>
          <pre style={preStyle}>{JSON.stringify(safeJson(claim.responsePayload), null, 2)}</pre>
        </div>
      </section>

      <section style={{ ...card, marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Settlement posture</h2>

        {settlements.length === 0 ? (
          <div style={{ opacity: 0.78 }}>
            No settlement record linked yet. Approved and paid claims can be picked up by settlement batching.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {settlements.map((settlement: any) => (
              <div key={settlement.id} style={lineCard}>
                Status {settlement.status || "—"} · Gross{" "}
                {money(
                  settlement.grossAmountMinor || settlement.grossMinor,
                  settlement.currency || claim.currency
                )}{" "}
                · Net{" "}
                {money(
                  settlement.netAmountMinor || settlement.netClinicianMinor,
                  settlement.currency || claim.currency
                )}{" "}
                · Ref {settlement.remittanceRef || "—"}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub: string;
}) {
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

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ borderTop: "1px solid #1f2a4d", padding: "10px 0" }}>
      <div style={{ opacity: 0.64, fontSize: 12 }}>{label}</div>
      <div style={{ marginTop: 4, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const metricGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 16,
};

const card: React.CSSProperties = {
  background: "#121931",
  border: "1px solid #1f2a4d",
  borderRadius: 16,
  padding: 18,
};

const miniCard: React.CSSProperties = {
  background: "#0f1730",
  border: "1px solid #1f2a4d",
  borderRadius: 12,
  padding: 12,
};

const lineCard: React.CSSProperties = {
  background: "#0f1730",
  border: "1px solid #1f2a4d",
  borderRadius: 14,
  padding: 14,
};

const pill: React.CSSProperties = {
  fontSize: 11,
  border: "1px solid",
  borderRadius: 999,
  padding: "3px 9px",
  fontWeight: 700,
};

const mutedPill: React.CSSProperties = {
  ...pill,
  background: "#1f2937",
  borderColor: "#374151",
  color: "#d1d5db",
};

const errorBox: React.CSSProperties = {
  background: "#3a1017",
  border: "1px solid #7f1d1d",
  color: "#fecaca",
  borderRadius: 14,
  padding: 14,
  marginTop: 18,
};

const preStyle: React.CSSProperties = {
  margin: 0,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  fontSize: 12,
  opacity: 0.84,
};