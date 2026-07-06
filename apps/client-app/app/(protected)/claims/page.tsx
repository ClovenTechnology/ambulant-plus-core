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

async function getClaims() {
  try {
    const res = await fetch(internalApiUrl("/api/claims").toString(), {
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

async function getAdherenceOverview() {
  try {
    const res = await fetch(
      internalApiUrl("/api/client/adherence-overview", { days: 30 }).toString(),
      {
        cache: "no-store",
        headers: internalRequestHeaders(),
      }
    );

    if (!res.ok) {
      return null;
    }

    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

async function getMemberReimbursementSummary() {
  try {
    const res = await fetch(
      internalApiUrl("/api/member-reimbursement-claims", { limit: 100 }).toString(),
      {
        cache: "no-store",
        headers: internalRequestHeaders(),
      }
    );

    if (!res.ok) return { total: 0, open: 0, paid: 0, requestedAmountMinor: 0 };

    const json = await res.json().catch(() => null);
    const items = Array.isArray(json?.items) ? json.items : [];

    return {
      total: items.length,
      open: items.filter(
        (x: any) =>
          !["PAID", "DENIED", "CANCELLED"].includes(String(x.status || "").toUpperCase())
      ).length,
      paid: items.filter((x: any) => String(x.status || "").toUpperCase() === "PAID").length,
      requestedAmountMinor: items.reduce(
        (sum: number, x: any) => sum + Number(x.requestedAmountMinor || 0),
        0
      ),
    };
  } catch {
    return { total: 0, open: 0, paid: 0, requestedAmountMinor: 0 };
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

function extractPatientIdFromClaim(item: any): string | null {
  return (
    item?.patientId ||
    item?.submissionPayload?.patientId ||
    item?.submissionPayload?.patient?.id ||
    item?.responsePayload?.patientId ||
    item?.responsePayload?.patient?.id ||
    item?.metadata?.patientId ||
    null
  );
}

function extractMemberNumberFromClaim(item: any): string | null {
  return (
    item?.submissionPayload?.memberNumber ||
    item?.submissionPayload?.membershipNumber ||
    item?.responsePayload?.memberNumber ||
    item?.responsePayload?.membershipNumber ||
    item?.metadata?.memberNumber ||
    null
  );
}

function claimStatusTone(status?: string) {
  switch (String(status || "").toUpperCase()) {
    case "PAID":
      return {
        bg: "#0f2a1f",
        border: "#14532d",
        text: "#bbf7d0",
      };
    case "APPROVED":
    case "ADJUDICATED":
      return {
        bg: "#0c2238",
        border: "#1d4ed8",
        text: "#bfdbfe",
      };
    case "DENIED":
    case "REJECTED":
      return {
        bg: "#3a1017",
        border: "#7f1d1d",
        text: "#fecaca",
      };
    default:
      return {
        bg: "#3b2608",
        border: "#92400e",
        text: "#fde68a",
      };
  }
}

function riskTone(risk?: string) {
  switch ((risk || "").toLowerCase()) {
    case "high":
      return {
        bg: "#3a1017",
        border: "#7f1d1d",
        text: "#fecaca",
      };
    case "moderate":
      return {
        bg: "#3b2608",
        border: "#92400e",
        text: "#fde68a",
      };
    default:
      return {
        bg: "#0f2a1f",
        border: "#14532d",
        text: "#bbf7d0",
      };
  }
}

type AdherenceMember = {
  memberId?: string;
  patientId?: string | null;
  memberNumber?: string | null;
  coveragePlan?: { name?: string } | null;
  adherence?: {
    sharingEnabled?: boolean;
    riskStatus?: string;
    rewardEligible?: boolean;
    rewardPointsEstimate?: number;
    summary?: {
      weightedPct?: number;
      confidencePct?: number;
      verifiedRatio?: number;
      missedDoseRate?: number;
      reminderCoveragePct?: number;
    };
  } | null;
};

export default async function ClaimsPage() {
  const [items, overview, reimbursementSummary] = await Promise.all([
    getClaims(),
    getAdherenceOverview(),
    getMemberReimbursementSummary(),
  ]);

  const members: AdherenceMember[] = Array.isArray(overview?.members) ? overview.members : [];

  const byPatientId = new Map<string, AdherenceMember>();
  const byMemberNumber = new Map<string, AdherenceMember>();

  members.forEach((m) => {
    if (m?.patientId) byPatientId.set(String(m.patientId), m);
    if (m?.memberNumber) byMemberNumber.set(String(m.memberNumber), m);
  });

  const enrichedItems = items.map((item: any) => {
    const patientId = extractPatientIdFromClaim(item);
    const memberNumber = extractMemberNumberFromClaim(item);

    const linkedMember =
      (patientId ? byPatientId.get(String(patientId)) : null) ||
      (memberNumber ? byMemberNumber.get(String(memberNumber)) : null) ||
      null;

    return {
      ...item,
      linkedMember,
    };
  });

  const flaggedClaims = enrichedItems.filter(
    (item: any) =>
      item.linkedMember?.adherence?.riskStatus === "high" ||
      item.linkedMember?.adherence?.riskStatus === "moderate"
  ).length;

  return (
    <main style={{ padding: 32, maxWidth: 1360 }}>
      <h1 style={{ marginTop: 0 }}>Claims</h1>
      <p style={{ opacity: 0.8, marginBottom: 24 }}>
        Medical aid claims, corporate invoices, adjudication, remittance references, payment progress, and adherence-aware intervention context.
      </p>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <Metric
          label="Open Claims"
          value={String(
            enrichedItems.filter((x: any) => !["PAID", "DENIED", "REJECTED"].includes(String(x.status || "").toUpperCase())).length
          )}
        />
        <Metric
          label="Claims with Intervention Flags"
          value={String(flaggedClaims)}
        />
        <Metric
          label="Avg Weighted Adherence"
          value={`${overview?.summary?.avgWeightedAdherence ?? 0}%`}
        />
        <Metric
          label="Reward-Eligible Members"
          value={String(overview?.summary?.rewardEligibleCount ?? 0)}
        />
        <Metric
          label="Member Reimbursements"
          value={String(reimbursementSummary.open)}
        />
      </section>

      <section
        style={{
          background: "#121931",
          border: "1px solid #1f2a4d",
          borderRadius: 16,
          padding: 18,
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Member reimbursement lane</h2>
            <p style={{ margin: "8px 0 0", opacity: 0.78, fontSize: 14 }}>
              Card-paid patient claim-back requests are reviewed separately from provider claims and do not affect clinician payout.
            </p>
            <div style={{ marginTop: 10, opacity: 0.74, fontSize: 13 }}>
              Total: {reimbursementSummary.total} · Open: {reimbursementSummary.open} · Paid:{" "}
              {reimbursementSummary.paid} · Requested: {money(reimbursementSummary.requestedAmountMinor)}
            </div>
          </div>

          <a
            href="/member-reimbursements"
            style={{
              alignSelf: "center",
              color: "#93c5fd",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Open reimbursement queue →
          </a>
        </div>
      </section>

      <div style={{ display: "grid", gap: 12 }}>
        {enrichedItems.length === 0 ? (
          <div style={{ opacity: 0.7 }}>No claims found yet.</div>
        ) : (
          enrichedItems.map((item: any) => {
            const tone = claimStatusTone(item.status);
            const linked = item.linkedMember;
            const adherence = linked?.adherence;
            const risk = adherence?.riskStatus || null;
            const riskBadge = risk ? riskTone(risk) : null;

            return (
              <a
                key={item.id}
                href={`/claims/${item.id}`}
                style={{
                  background: "#121931",
                  border: "1px solid #1f2a4d",
                  borderRadius: 16,
                  padding: 18,
                  display: "block",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1fr",
                    gap: 16,
                    alignItems: "start",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>
                        {item.claimNumber || item.id}
                      </div>
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
                        {item.status}
                      </span>

                      {riskBadge ? (
                        <span
                          style={{
                            fontSize: 12,
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: riskBadge.bg,
                            border: `1px solid ${riskBadge.border}`,
                            color: riskBadge.text,
                            textTransform: "capitalize",
                          }}
                        >
                          {risk} adherence risk
                        </span>
                      ) : null}

                      {adherence?.rewardEligible ? (
                        <span
                          style={{
                            fontSize: 12,
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: "#0f2a1f",
                            border: "1px solid #14532d",
                            color: "#bbf7d0",
                          }}
                        >
                          reward eligible
                        </span>
                      ) : null}
                    </div>

                    <div style={{ marginTop: 8, opacity: 0.82, fontSize: 14 }}>
                      Type: {item.claimType || "—"} · Lines: {Array.isArray(item.lines) ? item.lines.length : 0}
                    </div>

                    <div style={{ marginTop: 6, opacity: 0.68, fontSize: 13 }}>
                      Member: {extractMemberNumberFromClaim(item) || linked?.memberNumber || "—"} · Patient: {extractPatientIdFromClaim(item) || "—"}
                    </div>

                    <div style={{ marginTop: 6, opacity: 0.68, fontSize: 13 }}>
                      Coverage Plan: {linked?.coveragePlan?.name || "—"}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      gap: 10,
                    }}
                  >
                    <MiniMetric label="Submitted" value={money(item.submittedAmountMinor, item.currency || "ZAR")} />
                    <MiniMetric label="Approved" value={money(item.approvedAmountMinor, item.currency || "ZAR")} />
                    <MiniMetric label="Paid" value={money(item.paidAmountMinor, item.currency || "ZAR")} />
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: 10,
                    marginTop: 14,
                  }}
                >
                  <MiniMetric label="Adherence" value={`${adherence?.summary?.weightedPct ?? 0}%`} />
                  <MiniMetric label="Confidence" value={`${adherence?.summary?.confidencePct ?? 0}%`} />
                  <MiniMetric label="Missed-dose rate" value={`${adherence?.summary?.missedDoseRate ?? 0}%`} />
                  <MiniMetric label="Reminder coverage" value={`${adherence?.summary?.reminderCoveragePct ?? 0}%`} />
                </div>

                <div
                  style={{
                    marginTop: 12,
                    background: "#0f1730",
                    border: "1px solid #1f2a4d",
                    borderRadius: 12,
                    padding: 12,
                    fontSize: 13,
                    opacity: 0.9,
                  }}
                >
                  {risk === "high"
                    ? "High intervention priority: claims team and case management should review adherence instability before downstream utilization escalation."
                    : risk === "moderate"
                    ? "Moderate intervention signal: member may benefit from reminder reinforcement, sponsor outreach, or chronic support nudges."
                    : adherence
                    ? "Stable adherence context: claim can be reviewed with lower intervention urgency and stronger reward-readiness context."
                    : "No linked adherence context found for this claim yet."}
                </div>
              </a>
            );
          })
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
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

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#0f1730",
        border: "1px solid #1f2a4d",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.68 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 16, fontWeight: 700 }}>{value}</div>
    </div>
  );
}