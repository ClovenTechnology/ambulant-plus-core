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

type MemberItem = {
  id?: string;
  memberId?: string;
  metadata?: Record<string, any> | null;
  policyNumber?: string | null;
  medicalAidNumber?: string | null;
  planOptionCode?: string | null;
  patientId?: string | null;
  memberNumber?: string | null;
  employeeNumber?: string | null;
  memberStatus?: string | null;
  memberKind?: string | null;
  dependentCode?: string | null;
  principalMemberNumber?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  coveragePlan?: { id?: string; name?: string } | null;
  clientProgram?: { id?: string; name?: string } | null;
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
      lateDoseRate?: number;
      trackedDoseCount?: number;
      verifiedTaken?: number;
      selfReportedTaken?: number;
      missed?: number;
      pending?: number;
      activeMedicationCount?: number;
      uncoveredMedicationCount?: number;
      reminderCoveragePct?: number;
    };
  } | null;
};

type AdherenceOverview = {
  ok?: boolean;
  members?: MemberItem[];
};

async function getOverview(): Promise<AdherenceOverview | null> {
  try {
    const res = await fetch(
      internalApiUrl("/api/client/adherence-overview", { days: 30 }).toString(),
      {
        cache: "no-store",
        headers: internalRequestHeaders(),
      },
    );

    if (!res.ok) {
      return null;
    }

    return await res.json();
  } catch {
    return null;
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

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function memberRecordId(item: MemberItem) {
  return (
    item.memberId ||
    item.id ||
    item.memberNumber ||
    item.employeeNumber ||
    item.patientId ||
    "unknown-member"
  );
}

function medicalAidNumber(item: MemberItem) {
  return item.medicalAidNumber || item.memberNumber || "—";
}

function policyNumber(item: MemberItem) {
  return (
    item.policyNumber ||
    item.metadata?.policyNumber ||
    item.metadata?.policyId ||
    item.metadata?.membershipPolicyNumber ||
    "—"
  );
}

function planOptionCode(item: MemberItem) {
  return (
    item.planOptionCode ||
    item.metadata?.optionCode ||
    item.metadata?.planOptionCode ||
    item.coveragePlan?.id ||
    "—"
  );
}

export default async function MembersPage() {
  const overview = await getOverview();
  const items = Array.isArray(overview?.members) ? overview!.members! : [];

  return (
    <main style={{ padding: 32, maxWidth: 1400 }}>
      <h1 style={{ marginTop: 0 }}>Members</h1>
      <p style={{ opacity: 0.8, marginBottom: 24 }}>
        Member enrollment, eligibility context, adherence risk, coverage alignment, and reward readiness.
      </p>

      {!overview?.ok ? (
        <div
          style={{
            background: "#121931",
            border: "1px solid #1f2a4d",
            borderRadius: 14,
            padding: 16,
            opacity: 0.85,
          }}
        >
          Unable to load adherence-enriched member roster yet.
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 12 }}>
        {items.length === 0 ? (
          <div style={{ opacity: 0.7 }}>No client members found yet.</div>
        ) : (
          items.map((item) => {
            const risk = item.adherence?.riskStatus || "unknown";
            const tone = riskTone(risk);
            const summary = item.adherence?.summary;

            return (
              <div
                key={memberRecordId(item)}
                style={{
                  background: "#121931",
                  border: "1px solid #1f2a4d",
                  borderRadius: 16,
                  padding: 18,
                  display: "grid",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.25fr 1fr",
                    gap: 16,
                    alignItems: "start",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <a
                        href={`/members/${memberRecordId(item)}`}
                        style={{
                          fontWeight: 700,
                          fontSize: 16,
                          color: "#e8ecf3",
                          textDecoration: "none",
                        }}
                      >
                        {medicalAidNumber(item)}
                      </a>

                      <span
                        style={{
                          fontSize: 12,
                          padding: "4px 10px",
                          borderRadius: 999,
                          background: tone.bg,
                          border: `1px solid ${tone.border}`,
                          color: tone.text,
                          textTransform: "capitalize",
                        }}
                      >
                        {risk} risk
                      </span>

                      {item.adherence?.rewardEligible ? (
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

                      {!item.adherence?.sharingEnabled ? (
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
                          sharing off
                        </span>
                      ) : null}
                    </div>

                    <div style={{ marginTop: 8, opacity: 0.82, fontSize: 14 }}>
                      Status: {item.memberStatus || "—"} · Kind: {item.memberKind || "—"} · Coverage Plan: {item.coveragePlan?.name || "—"}
                    </div>

                    <div style={{ marginTop: 6, opacity: 0.68, fontSize: 13 }}>
                      Medical Aid No: {medicalAidNumber(item)} · Dependant Code: {item.dependentCode || "00"} · Principal Member: {item.principalMemberNumber || "—"}
                    </div>

                    <div style={{ marginTop: 6, opacity: 0.68, fontSize: 13 }}>
                      Policy No: {policyNumber(item)} · Plan / Option Code: {planOptionCode(item)} · Client Member ID: {memberRecordId(item)}
                    </div>

                    {item.employeeNumber ? (
                      <div style={{ marginTop: 6, opacity: 0.62, fontSize: 13 }}>
                        Corporate / employer handle: {item.employeeNumber}
                      </div>
                    ) : null}

                    <div style={{ marginTop: 6, opacity: 0.68, fontSize: 13 }}>
                      Effective: {fmtDate(item.effectiveFrom)} → {fmtDate(item.effectiveTo)} · Program: {item.clientProgram?.name || "—"}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 10,
                    }}
                  >
                    <Metric label="Adherence" value={`${summary?.weightedPct ?? 0}%`} />
                    <Metric label="Confidence" value={`${summary?.confidencePct ?? 0}%`} />
                    <Metric label="Verified Ratio" value={`${summary?.verifiedRatio ?? 0}%`} />
                    <Metric label="Coverage" value={`${summary?.reminderCoveragePct ?? 0}%`} />
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: 10,
                  }}
                >
                  <SubMetric label="Tracked doses" value={summary?.trackedDoseCount ?? 0} />
                  <SubMetric label="Missed" value={summary?.missed ?? 0} />
                  <SubMetric label="Pending" value={summary?.pending ?? 0} />
                  <SubMetric label="Reward points est." value={item.adherence?.rewardPointsEstimate ?? 0} />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: 10,
                  }}
                >
                  <SubMetric label="Verified taken" value={summary?.verifiedTaken ?? 0} />
                  <SubMetric label="Self-reported" value={summary?.selfReportedTaken ?? 0} />
                  <SubMetric label="Missed-dose rate" value={`${summary?.missedDoseRate ?? 0}%`} />
                  <SubMetric label="Late-dose rate" value={`${summary?.lateDoseRate ?? 0}%`} />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      background: "#0f1730",
                      border: "1px solid #1f2a4d",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div style={{ fontSize: 12, opacity: 0.68, marginBottom: 6 }}>
                      Coverage & reminder integrity
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.9 }}>
                      Active meds: {summary?.activeMedicationCount ?? 0} · Uncovered meds: {summary?.uncoveredMedicationCount ?? 0}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#0f1730",
                      border: "1px solid #1f2a4d",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div style={{ fontSize: 12, opacity: 0.68, marginBottom: 6 }}>
                      Intervention posture
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.9 }}>
                      {risk === "high"
                        ? "Immediate case-management review recommended."
                        : risk === "moderate"
                        ? "Monitor and nudge adherence support."
                        : "Stable. Continue reinforcement and rewards."}
                    </div>
                  </div>
                </div>
              </div>
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
        background: "#0f1730",
        border: "1px solid #1f2a4d",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.68 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function SubMetric({ label, value }: { label: string; value: string | number }) {
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