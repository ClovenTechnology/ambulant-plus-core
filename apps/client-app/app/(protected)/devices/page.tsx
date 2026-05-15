import Link from "next/link";
import type { CSSProperties } from "react";

const ORG_ID = "org-default";
const DAYS = 30;

type DeviceMember = {
  id: string;
  memberNumber: string;
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
};

function apiBase() {
  return (
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.APIGW_BASE ||
    "http://localhost:3010"
  );
}

async function safeJson(url: string) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json) {
      return null;
    }

    return json;
  } catch {
    return null;
  }
}

async function getDashboardSummary() {
  return safeJson(
    `${apiBase()}/api/client/dashboard-summary?orgId=${encodeURIComponent(
      ORG_ID
    )}&days=${DAYS}`
  );
}

async function getAdherenceOverview() {
  return safeJson(
    `${apiBase()}/api/client/adherence-overview?orgId=${encodeURIComponent(
      ORG_ID
    )}&days=${DAYS}`
  );
}

async function getMemberContext(memberId: string) {
  return safeJson(
    `${apiBase()}/api/client/members/${encodeURIComponent(
      memberId
    )}/profile-context?orgId=${encodeURIComponent(ORG_ID)}&days=${DAYS}`
  );
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

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asObject(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
}

function boolLabel(value: unknown) {
  return value ? "Yes" : "No";
}

function evidenceTone(value?: boolean) {
  return value
    ? { bg: "#0f2a1f", border: "#14532d", text: "#bbf7d0" }
    : { bg: "#1f2937", border: "#374151", text: "#d1d5db" };
}

function riskTone(value?: string | null) {
  switch (String(value || "").toLowerCase()) {
    case "high":
      return { bg: "#3a1017", border: "#7f1d1d", text: "#fecaca" };
    case "moderate":
      return { bg: "#3b2608", border: "#92400e", text: "#fde68a" };
    case "low":
      return { bg: "#0f2a1f", border: "#14532d", text: "#bbf7d0" };
    default:
      return { bg: "#1f2937", border: "#374151", text: "#d1d5db" };
  }
}

function latestSpotCheckText(value: any) {
  const latest = asObject(value);

  const bits = [
    latest.bp ? `BP ${latest.bp}` : null,
    latest.hr ? `HR ${latest.hr}` : null,
    latest.spo2 ? `SpO₂ ${latest.spo2}` : null,
    latest.temp ? `Temp ${latest.temp}` : null,
    latest.respiratoryRate ? `RR ${latest.respiratoryRate}` : null,
  ].filter(Boolean);

  return bits.length ? bits.join(" · ") : "No latest spot-check value";
}

function wearableText(wearable: any) {
  const w = asObject(wearable);

  const bits = [
    w.sleepSummary ? `Sleep ${JSON.stringify(w.sleepSummary)}` : null,
    w.activitySummary ? `Activity ${JSON.stringify(w.activitySummary)}` : null,
    w.rhrHrvSummary ? `RHR/HRV ${JSON.stringify(w.rhrHrvSummary)}` : null,
  ].filter(Boolean);

  return bits.length ? bits.slice(0, 2).join(" · ") : "No wearable summary";
}

export default async function DevicesPage() {
  const [dashboard, adherence] = await Promise.all([
    getDashboardSummary(),
    getAdherenceOverview(),
  ]);

  const sampledMembers: DeviceMember[] = Array.isArray(dashboard?.sampledMembers)
    ? dashboard.sampledMembers
    : [];

  const adherenceMembers = Array.isArray(adherence?.members)
    ? adherence.members
    : [];

  const memberIds = Array.from(
    new Set(
      [
        ...sampledMembers.map((m) => m.id),
        ...adherenceMembers.map((m: any) => m.memberId),
      ].filter(Boolean)
    )
  ).slice(0, 8);

  const contexts = await Promise.all(
    memberIds.map(async (id) => {
      const ctx = await getMemberContext(id);
      return ctx?.ok ? ctx.item : null;
    })
  );

  const contextItems = contexts.filter(Boolean);

  const summary = dashboard?.summary || {};
  const healthSummary = summary.healthContext || {};

  const vitalsAccessCount =
    healthSummary.vitalsAccessCount ??
    sampledMembers.filter((m) => m.vitalsAccess).length;

  const wearableInsightsCount =
    healthSummary.wearableInsightsCount ??
    sampledMembers.filter((m) => m.wearableInsights).length;

  const clinicalSpotCheckAvailableCount =
    healthSummary.clinicalSpotCheckAvailableCount ??
    sampledMembers.filter((m) => m.healthSignals?.clinicalSpotCheckAvailable).length;

  const wearableRewardSignalCount =
    healthSummary.wearableRewardSignalCount ??
    sampledMembers.filter((m) => m.healthSignals?.wearableRewardSignals).length;

  const abnormalVitalsCount = contextItems.filter((ctx: any) => {
    const flags = asArray(ctx?.healthContext?.vitals?.abnormalFlags);
    return flags.length > 0;
  }).length;

  const rewardSignalMembers = contextItems.filter((ctx: any) => {
    const signals = asArray(ctx?.healthContext?.wearable?.rewardSignals);
    return signals.length > 0 || ctx?.rewards?.eligible;
  }).length;

  return (
    <main style={{ padding: 32, maxWidth: 1480 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={eyebrow}>Device Programme Operations</div>
        <h1 style={{ margin: "8px 0 8px", fontSize: 34 }}>Devices</h1>
        <p style={{ opacity: 0.82, margin: 0 }}>
          Payer-safe view of Health Monitor clinical spot-checks, NexRing / wearable
          wellness insights, consent posture, abnormal signals, and reward-relevant
          device evidence.
        </p>
      </div>

      <section style={metricGrid}>
        <Metric
          label="Members with vitals access"
          value={vitalsAccessCount}
          sub="Clinical-grade spot-check visibility"
        />
        <Metric
          label="Wearable insight access"
          value={wearableInsightsCount}
          sub="NexRing / wellness telemetry"
        />
        <Metric
          label="Spot-check evidence"
          value={clinicalSpotCheckAvailableCount}
          sub="Health Monitor evidence available"
        />
        <Metric
          label="Reward signal members"
          value={wearableRewardSignalCount || rewardSignalMembers}
          sub="Wearable / adherence reward evidence"
        />
        <Metric
          label="Abnormal vitals flags"
          value={abnormalVitalsCount}
          sub="Requires clinical review where present"
        />
      </section>

      <section style={{ ...card, marginTop: 20 }}>
        <h2 style={{ marginTop: 0 }}>Medical-grade vs wellness-grade evidence</h2>
        <div style={{ opacity: 0.82, lineHeight: 1.7 }}>
          Health Monitor readings are treated as clinical-grade spot-check evidence.
          NexRing and wearable readings are treated as wellness-grade evidence for
          sleep, activity, recovery, and reward calculations. Where both report the
          same vital type, Health Monitor should be preferred for clinical adjudication,
          while NexRing remains valuable for trends and rewards.
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginTop: 20,
        }}
      >
        <div style={card}>
          <h2 style={{ marginTop: 0 }}>Health Monitor lane</h2>
          <div style={{ opacity: 0.8, lineHeight: 1.7 }}>
            Clinical-grade spot checks: blood pressure, pulse, SpO₂, temperature,
            respiratory rate, glucose or other supported device readings. Used for
            risk visibility, chronic monitoring, preflight context, and escalation
            posture.
          </div>

          <div style={laneGrid}>
            <Mini label="Access count" value={vitalsAccessCount} />
            <Mini label="Evidence count" value={clinicalSpotCheckAvailableCount} />
            <Mini label="Abnormal flags" value={abnormalVitalsCount} />
          </div>
        </div>

        <div style={card}>
          <h2 style={{ marginTop: 0 }}>NexRing / wearable lane</h2>
          <div style={{ opacity: 0.8, lineHeight: 1.7 }}>
            Wellness evidence: sleep, activity, resting heart rate, HRV, recovery,
            stress and consistency signals. Used for reward programmes, population
            wellness insight, and early intervention triggers.
          </div>

          <div style={laneGrid}>
            <Mini label="Access count" value={wearableInsightsCount} />
            <Mini label="Reward signals" value={wearableRewardSignalCount} />
            <Mini label="Reward-ready" value={rewardSignalMembers} />
          </div>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <h2 style={{ margin: 0 }}>Member device evidence</h2>
          <Link href="/members" style={linkButton}>
            Open members →
          </Link>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          {contextItems.length === 0 ? (
            <div style={{ opacity: 0.72 }}>
              No member device context found yet. Seed demo data and ensure api-gateway is running.
            </div>
          ) : (
            contextItems.map((ctx: any) => {
              const member = ctx.member || {};
              const consent = ctx.healthContext?.consent || {};
              const vitals = ctx.healthContext?.vitals || {};
              const wearable = ctx.healthContext?.wearable || {};
              const adherence = ctx.adherence || {};
              const rewards = ctx.rewards || {};

              const abnormalFlags = asArray(vitals.abnormalFlags);
              const rewardSignals = asArray(wearable.rewardSignals);
              const risk = adherence.riskStatus || "unknown";
              const tone = riskTone(risk);

              return (
                <article key={member.id} style={card}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.2fr 1fr",
                      gap: 16,
                      alignItems: "start",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        <Link
                          href={`/members/${member.id}`}
                          style={{
                            color: "inherit",
                            fontWeight: 800,
                            textDecoration: "none",
                            fontSize: 17,
                          }}
                        >
                          {member.memberNumber || member.employeeNumber || member.id}
                        </Link>

                        <span
                          style={{
                            ...pill,
                            background: tone.bg,
                            borderColor: tone.border,
                            color: tone.text,
                          }}
                        >
                          {String(risk).toUpperCase()} RISK
                        </span>

                        {rewards.eligible ? (
                          <span style={successPill}>reward eligible</span>
                        ) : null}

                        {abnormalFlags.length ? (
                          <span style={dangerPill}>abnormal vitals</span>
                        ) : null}
                      </div>

                      <div style={{ opacity: 0.72, fontSize: 13, marginTop: 8 }}>
                        Patient: {member.patientId || "—"} · Plan:{" "}
                        {ctx.coverage?.plan?.name || "—"} · Effective:{" "}
                        {fmtDate(member.effectiveFrom)} → {fmtDate(member.effectiveTo)}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          marginTop: 12,
                        }}
                      >
                        <Flag label="Vitals consent" active={Boolean(consent.vitals)} />
                        <Flag
                          label="Wearable consent"
                          active={Boolean(consent.wearableInsights)}
                        />
                        <Flag
                          label="Clinical history"
                          active={Boolean(consent.clinicalHistory)}
                        />
                        <Flag
                          label="Rewards"
                          active={Boolean(ctx.consent?.rewardProgram)}
                        />
                      </div>

                      <div style={contextBox}>
                        <strong>Latest Health Monitor / spot-check:</strong>{" "}
                        {latestSpotCheckText(vitals.latestClinicalSpotCheck)}
                      </div>

                      <div style={contextBox}>
                        <strong>NexRing / wearable summary:</strong>{" "}
                        {wearableText(wearable)}
                      </div>

                      {abnormalFlags.length ? (
                        <div style={warningBox}>
                          Abnormal flags: {abnormalFlags.join(", ")}
                        </div>
                      ) : null}

                      {rewardSignals.length ? (
                        <div style={contextBox}>
                          <strong>Reward signals:</strong>{" "}
                          {rewardSignals.join(" · ")}
                        </div>
                      ) : null}
                    </div>

                    <div style={{ display: "grid", gap: 10 }}>
                      <Mini
                        label="Weighted adherence"
                        value={`${adherence?.summary?.weightedPct ?? 0}%`}
                      />
                      <Mini
                        label="Confidence"
                        value={`${adherence?.summary?.confidencePct ?? 0}%`}
                      />
                      <Mini
                        label="Verified ratio"
                        value={`${adherence?.summary?.verifiedRatio ?? 0}%`}
                      />
                      <Mini
                        label="Reward points est."
                        value={rewards.pointsEstimate ?? 0}
                      />
                      <Mini
                        label="Claim exposure"
                        value={money(
                          ctx.utilization?.claims?.approvedAmountMinor,
                          ctx.utilization?.claims?.currency || "ZAR"
                        )}
                      />
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
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

function Flag({ label, active }: { label: string; active: boolean }) {
  const tone = evidenceTone(active);

  return (
    <span
      style={{
        ...pill,
        background: tone.bg,
        borderColor: tone.border,
        color: tone.text,
      }}
    >
      {label}: {boolLabel(active)}
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

const laneGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
  marginTop: 14,
};

const card: CSSProperties = {
  background: "#121931",
  border: "1px solid #1f2a4d",
  borderRadius: 16,
  padding: 18,
};

const miniCard: CSSProperties = {
  background: "#0f1730",
  border: "1px solid #1f2a4d",
  borderRadius: 12,
  padding: 12,
};

const contextBox: CSSProperties = {
  background: "#0f1730",
  border: "1px solid #1f2a4d",
  borderRadius: 12,
  padding: 12,
  marginTop: 10,
  fontSize: 13,
  opacity: 0.9,
};

const warningBox: CSSProperties = {
  background: "#3b2608",
  border: "1px solid #92400e",
  color: "#fde68a",
  borderRadius: 12,
  padding: 12,
  marginTop: 10,
  fontSize: 13,
};

const pill: CSSProperties = {
  fontSize: 11,
  border: "1px solid",
  borderRadius: 999,
  padding: "3px 9px",
  fontWeight: 700,
};

const successPill: CSSProperties = {
  ...pill,
  background: "#0f2a1f",
  borderColor: "#14532d",
  color: "#bbf7d0",
};

const dangerPill: CSSProperties = {
  ...pill,
  background: "#3a1017",
  borderColor: "#7f1d1d",
  color: "#fecaca",
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