import Link from "next/link";

const tile: React.CSSProperties = {
  background: "#121931",
  border: "1px solid #1f2a4d",
  borderRadius: 16,
  padding: 20,
};

type AdherenceOverview = {
  ok?: boolean;
  error?: string;
  orgId?: string;
  summary?: {
    memberCount?: number;
    activeMemberCount?: number;
    sharingEnabledMemberCount?: number;
    trackedMemberCount?: number;
    avgWeightedAdherence?: number;
    avgConfidence?: number;
    avgReminderCoverage?: number;
    highRiskCount?: number;
    moderateRiskCount?: number;
    rewardEligibleCount?: number;
  };
  dailyTrend?: Array<{
    date: string;
    weightedPct: number;
    confidencePct: number;
  }>;
  topInterventionMembers?: Array<{
    memberNumber?: string;
    adherence?: {
      riskStatus?: string;
      summary?: {
        weightedPct?: number;
        confidencePct?: number;
        missedDoseRate?: number;
        reminderCoveragePct?: number;
      };
    } | null;
    coveragePlan?: { name?: string } | null;
  }>;
  topRewardMembers?: Array<{
    memberNumber?: string;
    adherence?: {
      rewardPointsEstimate?: number;
      summary?: {
        weightedPct?: number;
        confidencePct?: number;
        verifiedRatio?: number;
      };
    } | null;
    coveragePlan?: { name?: string } | null;
  }>;
};

type DashboardSummary = {
  ok?: boolean;
  summary?: {
    memberCount?: number;
    activeMemberCount?: number;
    healthContext?: {
      vitalsAccessCount?: number;
      wearableInsightsCount?: number;
      clinicalHistoryAccessCount?: number;
      reproductiveHealthAccessCount?: number;
      antenatalAccessCount?: number;
      pregnancySignalCount?: number;
      birthRecordVisibleCount?: number;
      clinicalSpotCheckAvailableCount?: number;
      wearableRewardSignalCount?: number;
    };
  };
  sampledMembers?: Array<{
    id: string;
    memberNumber?: string;
    memberStatus?: string | null;
    vitalsAccess?: boolean;
    wearableInsights?: boolean;
    clinicalHistoryAccess?: boolean;
    reproductiveHealthAccess?: boolean;
    antenatalAccess?: boolean;
    clinicalCounts?: {
      allergies?: number;
      conditions?: number;
      vaccinations?: number;
      operations?: number;
    };
    healthSignals?: {
      clinicalSpotCheckAvailable?: boolean;
      wearableRewardSignals?: boolean;
      pregnancySignalAvailable?: boolean;
      birthRecordVisible?: boolean;
    };
  }>;
};

function apiBase() {
  return process.env.NEXT_PUBLIC_APIGW_BASE || process.env.APIGW_BASE || "http://localhost:3010";
}

async function getOverview(): Promise<AdherenceOverview | null> {
  try {
    const res = await fetch(`${apiBase()}/api/client/adherence-overview?orgId=org-default&days=30`, {
      cache: "no-store",
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function getDashboardSummary(): Promise<DashboardSummary | null> {
  try {
    const res = await fetch(`${apiBase()}/api/client/dashboard-summary?orgId=org-default&days=30`, {
      cache: "no-store",
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function TrendBars({ values }: { values: number[] }) {
  if (!values.length) {
    return <div style={{ opacity: 0.6, fontSize: 13 }}>No adherence trend yet.</div>;
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))`,
        gap: 8,
        alignItems: "end",
        minHeight: 140,
        marginTop: 12,
      }}
    >
      {values.map((value, i) => (
        <div key={`${value}-${i}`} style={{ display: "grid", gap: 8 }}>
          <div
            style={{
              height: `${Math.max(10, value)}px`,
              background: value >= 80 ? "#34d399" : value >= 60 ? "#60a5fa" : "#f59e0b",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            title={`${value}%`}
          />
          <div style={{ fontSize: 11, opacity: 0.65, textAlign: "center" }}>{i + 1}</div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ on, label }: { on?: boolean; label: string }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "4px 10px",
        borderRadius: 999,
        background: on ? "#0f2a1f" : "#1f2937",
        border: on ? "1px solid #14532d" : "1px solid #374151",
        color: on ? "#bbf7d0" : "#d1d5db",
      }}
    >
      {label}
    </span>
  );
}

export default async function ClientDashboardPage() {
  const [overview, dashboard] = await Promise.all([
    getOverview(),
    getDashboardSummary(),
  ]);

  const summary = overview?.summary;
  const health = dashboard?.summary?.healthContext || {};
  const sampledMembers = Array.isArray(dashboard?.sampledMembers)
    ? dashboard!.sampledMembers!.slice(0, 5)
    : [];

  const trendValues = Array.isArray(overview?.dailyTrend)
    ? overview!.dailyTrend!.slice(-14).map((x) => x.weightedPct)
    : [];

  const topInterventions = Array.isArray(overview?.topInterventionMembers)
    ? overview!.topInterventionMembers!.slice(0, 5)
    : [];

  const topRewards = Array.isArray(overview?.topRewardMembers)
    ? overview!.topRewardMembers!.slice(0, 5)
    : [];

  return (
    <main style={{ padding: 32, maxWidth: 1320 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, letterSpacing: 1.5, opacity: 0.7, textTransform: "uppercase" }}>
          Client Console
        </div>
        <h1 style={{ margin: "8px 0 8px", fontSize: 34 }}>Dashboard</h1>
        <p style={{ margin: 0, opacity: 0.8 }}>
          Payer-side overview across eligibility, adherence, health-context sharing, rewards, claims context, and covered utilization.
        </p>
      </div>

      {!overview?.ok ? (
        <section style={{ ...tile, marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>Adherence overview unavailable</h2>
          <p style={{ opacity: 0.8, marginBottom: 0 }}>
            Could not load sponsor-wide adherence metrics yet. The console is reachable, but the aggregated payer view is not returning data.
          </p>
        </section>
      ) : null}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <MetricCard label="Active Members" value={summary?.activeMemberCount ?? dashboard?.summary?.activeMemberCount ?? 0} sub={`${summary?.memberCount ?? dashboard?.summary?.memberCount ?? 0} enrolled total`} />
        <MetricCard label="Avg Weighted Adherence" value={`${summary?.avgWeightedAdherence ?? 0}%`} sub={`Confidence ${summary?.avgConfidence ?? 0}%`} />
        <MetricCard label="Members Sharing Adherence" value={summary?.sharingEnabledMemberCount ?? 0} sub={`Tracked: ${summary?.trackedMemberCount ?? 0}`} />
        <MetricCard label="High-Risk Members" value={summary?.highRiskCount ?? 0} sub={`Moderate risk: ${summary?.moderateRiskCount ?? 0}`} />
        <MetricCard label="Reward-Eligible Members" value={summary?.rewardEligibleCount ?? 0} sub={`Coverage score: ${summary?.avgReminderCoverage ?? 0}%`} />
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <MetricCard label="Vitals Access" value={health.vitalsAccessCount ?? 0} sub={`${health.clinicalSpotCheckAvailableCount ?? 0} with spot-check evidence`} />
        <MetricCard label="Wearable Insights" value={health.wearableInsightsCount ?? 0} sub={`${health.wearableRewardSignalCount ?? 0} reward signal members`} />
        <MetricCard label="Clinical History Access" value={health.clinicalHistoryAccessCount ?? 0} sub="Allergies, conditions, vaccinations, operations" />
        <MetricCard label="Pregnancy / Antenatal Visibility" value={`${health.reproductiveHealthAccessCount ?? 0}/${health.antenatalAccessCount ?? 0}`} sub={`${health.pregnancySignalCount ?? 0} pregnancy signals · ${health.birthRecordVisibleCount ?? 0} birth records`} />
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div style={tile}>
          <h2 style={{ marginTop: 0 }}>Population Adherence Trend</h2>
          <p style={{ opacity: 0.8, marginBottom: 0 }}>
            Average weighted adherence across consented members over the last 14 reporting points.
          </p>
          <TrendBars values={trendValues} />
        </div>

        <div style={tile}>
          <h2 style={{ marginTop: 0 }}>Operational Lanes</h2>
          <div style={{ lineHeight: 1.95, opacity: 0.92, fontSize: 14 }}>
            <div>Coverage preflight</div>
            <div>Authorization queue</div>
            <div>Claims & remittance</div>
            <div>Medication adherence</div>
            <div>Vitals and wearable insights</div>
            <div>Clinical history visibility</div>
            <div>Reward programs</div>
            <div>CarePort sponsor lines</div>
            <div>Settlement lanes</div>
          </div>
        </div>
      </section>

      <section style={{ ...tile, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 4 }}>Health Context Coverage</h2>
            <div style={{ opacity: 0.76, fontSize: 14 }}>
              Payer-safe visibility across clinical-grade spot checks, wearables, clinical history, and sensitive pregnancy/antenatal signals.
            </div>
          </div>
          <Link href="/members" style={{ fontSize: 13, opacity: 0.8 }}>
            Open members →
          </Link>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {sampledMembers.length === 0 ? (
            <div style={{ opacity: 0.72, fontSize: 14 }}>
              No member health-context rows available yet.
            </div>
          ) : (
            sampledMembers.map((member) => (
              <div
                key={member.id}
                style={{
                  border: "1px solid #1f2a4d",
                  borderRadius: 14,
                  padding: 14,
                  background: "#0f1730",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{member.memberNumber || member.id}</div>
                    <div style={{ opacity: 0.68, fontSize: 12, marginTop: 4 }}>
                      Status: {member.memberStatus || "—"} · Allergies {member.clinicalCounts?.allergies ?? 0} · Conditions {member.clinicalCounts?.conditions ?? 0} · Vaccinations {member.clinicalCounts?.vaccinations ?? 0} · Operations {member.clinicalCounts?.operations ?? 0}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <StatusBadge on={member.vitalsAccess} label="Vitals" />
                    <StatusBadge on={member.wearableInsights} label="Wearable" />
                    <StatusBadge on={member.clinicalHistoryAccess} label="History" />
                    <StatusBadge on={member.reproductiveHealthAccess} label="Reproductive" />
                    <StatusBadge on={member.antenatalAccess} label="Antenatal" />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  <StatusBadge on={member.healthSignals?.clinicalSpotCheckAvailable} label="Spot check evidence" />
                  <StatusBadge on={member.healthSignals?.wearableRewardSignals} label="Reward signals" />
                  <StatusBadge on={member.healthSignals?.pregnancySignalAvailable} label="Pregnancy signal" />
                  <StatusBadge on={member.healthSignals?.birthRecordVisible} label="Birth record" />
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        <div style={tile}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <h2 style={{ marginTop: 0, marginBottom: 0 }}>Top Intervention Queue</h2>
            <Link href="/members" style={{ fontSize: 13, opacity: 0.8 }}>
              Open members →
            </Link>
          </div>

          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            {topInterventions.length === 0 ? (
              <div style={{ opacity: 0.72, fontSize: 14 }}>
                No intervention-ranked members available yet.
              </div>
            ) : (
              topInterventions.map((item, i) => (
                <div key={`${item.memberNumber}-${i}`} style={listCard}>
                  <div style={{ fontWeight: 700 }}>{item.memberNumber || "Unknown member"}</div>
                  <div style={{ opacity: 0.75, marginTop: 4, fontSize: 13 }}>
                    Risk: {item.adherence?.riskStatus || "unknown"} · Adherence {item.adherence?.summary?.weightedPct ?? 0}% · Confidence {item.adherence?.summary?.confidencePct ?? 0}%
                  </div>
                  <div style={{ opacity: 0.68, marginTop: 4, fontSize: 12 }}>
                    Missed-dose rate {item.adherence?.summary?.missedDoseRate ?? 0}% · Coverage {item.adherence?.summary?.reminderCoveragePct ?? 0}% · Plan {item.coveragePlan?.name || "—"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={tile}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <h2 style={{ marginTop: 0, marginBottom: 0 }}>Top Reward-Eligible Members</h2>
            <Link href="/members" style={{ fontSize: 13, opacity: 0.8 }}>
              View reward cohort →
            </Link>
          </div>

          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            {topRewards.length === 0 ? (
              <div style={{ opacity: 0.72, fontSize: 14 }}>
                No reward-ready members yet.
              </div>
            ) : (
              topRewards.map((item, i) => (
                <div key={`${item.memberNumber}-${i}`} style={listCard}>
                  <div style={{ fontWeight: 700 }}>{item.memberNumber || "Unknown member"}</div>
                  <div style={{ opacity: 0.75, marginTop: 4, fontSize: 13 }}>
                    Points est. {item.adherence?.rewardPointsEstimate ?? 0} · Adherence {item.adherence?.summary?.weightedPct ?? 0}%
                  </div>
                  <div style={{ opacity: 0.68, marginTop: 4, fontSize: 12 }}>
                    Confidence {item.adherence?.summary?.confidencePct ?? 0}% · Verified ratio {item.adherence?.summary?.verifiedRatio ?? 0}% · Plan {item.coveragePlan?.name || "—"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div style={tile}>
      <div style={{ opacity: 0.7, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div style={{ marginTop: 8, opacity: 0.72, fontSize: 13 }}>{sub}</div>
    </div>
  );
}

const listCard: React.CSSProperties = {
  border: "1px solid #1f2a4d",
  borderRadius: 14,
  padding: 14,
  background: "#0f1730",
};