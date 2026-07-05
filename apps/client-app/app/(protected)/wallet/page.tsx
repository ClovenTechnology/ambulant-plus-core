import Link from "next/link";
import { cookies, headers } from "next/headers";
import type { CSSProperties } from "react";

type ClientPageSession = {
  uid?: string | null;
  orgId?: string | null;
  email?: string | null;
  role?: string | null;
  workspace?: string | null;
  clientId?: string | null;
};

function safeParseSession(value: string | undefined): ClientPageSession | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as ClientPageSession) : null;
  } catch {
    return null;
  }
}

function clientSession() {
  return safeParseSession(cookies().get("ambulant_client_session")?.value);
}

function appOrigin() {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "https";

  if (!host) {
    throw new Error("client_app_origin_required");
  }

  return `${proto}://${host}`;
}

function internalRequestHeaders() {
  return {
    cookie: cookies().toString(),
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

const DAYS = 30;

type ApiEnvelope<T> = {
  ok?: boolean;
  item?: T;
  items?: T[];
  members?: any[];
  summary?: any;
  error?: string;
};

async function safeJson<T>(url: string | URL): Promise<ApiEnvelope<T> | null> {
  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: internalRequestHeaders(),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json) {
      return null;
    }

    return json;
  } catch {
    return null;
  }
}

async function getWallet() {
  const session = clientSession();

  if (!session?.orgId || !session.clientId) {
    return null;
  }

  const data = await safeJson<any>(
    internalApiUrl(`/api/client-wallet/${encodeURIComponent(session.clientId)}`),
  );

  return data?.item ?? null;
}

async function getAdherenceOverview() {
  const session = clientSession();

  if (!session?.orgId) {
    return null;
  }

  return safeJson<any>(
    internalApiUrl("/api/client/adherence-overview", {
      days: DAYS,
    }),
  );
}

async function getDashboardSummary() {
  const session = clientSession();

  if (!session?.orgId) {
    return null;
  }

  return safeJson<any>(
    internalApiUrl("/api/client/dashboard-summary", {
      days: DAYS,
    }),
  );
}

async function getClaims() {
  const session = clientSession();

  if (!session?.orgId) {
    return { items: [], summary: {} };
  }

  const data = await safeJson<any>(
    internalApiUrl("/api/claims", {
      clientId: session.clientId || undefined,
      take: 50,
    }),
  );

  return {
    items: Array.isArray(data?.items) ? data!.items! : [],
    summary: data?.summary || {},
  };
}

async function getSettlements() {
  const session = clientSession();

  if (!session?.orgId) {
    return { items: [], summary: {} };
  }

  const data = await safeJson<any>(
    internalApiUrl("/api/settlements", {
      clientId: session.clientId || undefined,
    }),
  );

  return {
    items: Array.isArray(data?.items) ? data!.items! : [],
    summary: data?.summary || {},
  };
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
  if (!value) return "â€”";
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : "â€”";
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function txTone(type?: string) {
  switch (String(type || "").toUpperCase()) {
    case "FUNDING":
      return { bg: "#0f2a1f", border: "#14532d", text: "#bbf7d0" };
    case "RESERVE":
      return { bg: "#3b2608", border: "#92400e", text: "#fde68a" };
    case "CAPTURE":
      return { bg: "#0c2238", border: "#1d4ed8", text: "#bfdbfe" };
    case "RELEASE":
    case "REFUND":
      return { bg: "#1f2937", border: "#374151", text: "#d1d5db" };
    default:
      return { bg: "#1f2937", border: "#374151", text: "#d1d5db" };
  }
}

function riskTone(risk?: string) {
  switch (String(risk || "").toLowerCase()) {
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

function walletStatusTone(status?: string) {
  switch (String(status || "").toUpperCase()) {
    case "ACTIVE":
      return { bg: "#0f2a1f", border: "#14532d", text: "#bbf7d0" };
    case "SUSPENDED":
    case "LOCKED":
      return { bg: "#3a1017", border: "#7f1d1d", text: "#fecaca" };
    default:
      return { bg: "#1f2937", border: "#374151", text: "#d1d5db" };
  }
}

export default async function WalletPage() {
  const [wallet, adherence, dashboard, claims, settlements] = await Promise.all([
    getWallet(),
    getAdherenceOverview(),
    getDashboardSummary(),
    getClaims(),
    getSettlements(),
  ]);

  const currency = wallet?.currency || "ZAR";
  const transactions = asArray(wallet?.transactions);

  const adherenceSummary = adherence?.summary || {};
  const dashboardSummary = dashboard?.summary || {};
  const health = dashboardSummary.healthContext || {};

  const members = asArray(adherence?.members);
  const rewardMembers = members
    .filter((m: any) => m?.adherence?.rewardEligible)
    .sort(
      (a: any, b: any) =>
        Number(b?.adherence?.rewardPointsEstimate || 0) -
        Number(a?.adherence?.rewardPointsEstimate || 0)
    );

  const totalRewardPoints = rewardMembers.reduce(
    (sum: number, m: any) => sum + Number(m?.adherence?.rewardPointsEstimate || 0),
    0
  );

  const highRiskRewards = rewardMembers.filter(
    (m: any) => String(m?.adherence?.riskStatus || "").toLowerCase() === "high"
  ).length;

  const rewardWalletLiabilityMinor = totalRewardPoints * 100;
  const availableMinor = Number(wallet?.balanceMinor || 0);
  const heldMinor = Number(wallet?.heldMinor || 0);
  const projectedAfterRewardsMinor = availableMinor - rewardWalletLiabilityMinor;

  const claimsSummary = claims.summary || {};
  const settlementsSummary = settlements.summary || {};

  const statusTone = walletStatusTone(wallet?.status);

  return (
    <main style={{ padding: 32, maxWidth: 1480 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={eyebrow}>Wallet and Rewards Operations</div>
        <h1 style={{ margin: "8px 0 8px", fontSize: 34 }}>Wallet</h1>
        <p style={{ opacity: 0.82, margin: 0 }}>
          Prefunding, reserve, capture, release, reward liability, sponsor-funded care,
          claim settlement posture, and evidence-linked wellness incentives for the current client.
        </p>
      </div>

      <section style={metricGrid}>
        <Metric
          label="Available balance"
          value={money(availableMinor, currency)}
          sub={`Held reserve: ${money(heldMinor, currency)}`}
        />
        <Metric
          label="Reward liability estimate"
          value={money(rewardWalletLiabilityMinor, currency)}
          sub={`${totalRewardPoints} points across ${rewardMembers.length} members`}
        />
        <Metric
          label="Projected after rewards"
          value={money(projectedAfterRewardsMinor, currency)}
          sub={projectedAfterRewardsMinor >= 0 ? "Sufficient reward cover" : "Top-up required"}
        />
        <Metric
          label="Claims approved"
          value={money(claimsSummary.approvedAmountMinor, currency)}
          sub={`Paid ${money(claimsSummary.paidAmountMinor, currency)}`}
        />
        <Metric
          label="Settlements net"
          value={money(settlementsSummary.netAmountMinor, currency)}
          sub={`${settlementsSummary.lineCount ?? 0} settlement lines`}
        />
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
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ marginTop: 0, marginBottom: 8 }}>Client wallet account</h2>
              <div style={{ opacity: 0.76, fontSize: 13 }}>
                Client: {wallet?.clientId || "Assigned client"} Â· Currency: {currency}
              </div>
            </div>

            <span
              style={{
                ...pill,
                background: statusTone.bg,
                borderColor: statusTone.border,
                color: statusTone.text,
              }}
            >
              {wallet?.status || "UNKNOWN"}
            </span>
          </div>

          {!wallet ? (
            <div style={{ marginTop: 16, opacity: 0.72 }}>
              No wallet account is available yet. Wallet balance, reserve and transaction posture will appear here once configured for this client.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
              <Mini label="Balance" value={money(wallet.balanceMinor, currency)} />
              <Mini label="Held" value={money(wallet.heldMinor, currency)} />
              <Mini label="Total posture" value={money(Number(wallet.balanceMinor || 0) + Number(wallet.heldMinor || 0), currency)} />
              <Mini label="Transactions" value={transactions.length} />
            </div>
          )}
        </div>

        <div style={card}>
          <h2 style={{ marginTop: 0 }}>Rewards evidence posture</h2>
          <div style={{ opacity: 0.82, lineHeight: 1.7 }}>
            Rewards are treated as a separate evidence-and-rules layer. Medication
            adherence, verified dose ratio, Health Monitor spot checks, NexRing/wearable
            signals, wellness participation, and chronic programme milestones can feed
            points, wallet credits, premium offsets, consultation credits, or partner redemption.
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            <Mini label="Reward-eligible members" value={rewardMembers.length} />
            <Mini label="High-risk reward members" value={highRiskRewards} />
            <Mini label="Avg adherence" value={`${adherenceSummary.avgWeightedAdherence ?? 0}%`} />
            <Mini label="Wearable signal members" value={health.wearableRewardSignalCount ?? 0} />
          </div>
        </div>
      </section>

      <section style={{ ...card, marginTop: 20 }}>
        <h2 style={{ marginTop: 0 }}>Reward programme governance</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <RuleCard
            title="Medication adherence"
            body="Verified taken doses earn stronger points than self-reported doses. Missed doses reduce reward confidence."
          />
          <RuleCard
            title="Health Monitor evidence"
            body="Clinical-grade spot checks support chronic monitoring and can become reward evidence when consent and programme rules allow."
          />
          <RuleCard
            title="NexRing / wearable evidence"
            body="Sleep, activity, recovery and consistency signals can support wellness rewards, but remain wellness-grade rather than clinical-grade."
          />
          <RuleCard
            title="Fraud and reversals"
            body="Rewards should support caps, evidence confidence, reversal windows, audit logs and sponsor-configurable rules."
          />
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
          <h2 style={{ margin: 0 }}>Reward-ready members</h2>
          <Link href="/members" style={linkButton}>
            Open members â†’
          </Link>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          {rewardMembers.length === 0 ? (
            <div style={{ opacity: 0.72 }}>
              No reward-ready members yet.
            </div>
          ) : (
            rewardMembers.slice(0, 8).map((member: any, index: number) => {
              const adherenceData = member.adherence || {};
              const summary = adherenceData.summary || {};
              const tone = riskTone(adherenceData.riskStatus);

              return (
                <article key={`${member.memberNumber || member.memberId || index}`} style={card}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.2fr 1fr",
                      gap: 16,
                      alignItems: "start",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <Link
                          href={member.memberId ? `/members/${member.memberId}` : "/members"}
                          style={{
                            color: "inherit",
                            fontWeight: 800,
                            textDecoration: "none",
                            fontSize: 17,
                          }}
                        >
                          {member.memberNumber || "Unknown member"}
                        </Link>

                        <span
                          style={{
                            ...pill,
                            background: tone.bg,
                            borderColor: tone.border,
                            color: tone.text,
                          }}
                        >
                          {String(adherenceData.riskStatus || "unknown").toUpperCase()} RISK
                        </span>

                        <span style={successPill}>reward eligible</span>
                      </div>

                      <div style={{ opacity: 0.72, fontSize: 13, marginTop: 8 }}>
                        Plan: {member.coveragePlan?.name || "â€”"} Â· Points estimate:{" "}
                        {adherenceData.rewardPointsEstimate ?? 0}
                      </div>

                      <div style={contextBox}>
                        Reward rationale: adherence {summary.weightedPct ?? 0}% Â·
                        confidence {summary.confidencePct ?? 0}% Â· verified ratio{" "}
                        {summary.verifiedRatio ?? 0}% Â· missed-dose rate{" "}
                        {summary.missedDoseRate ?? 0}%.
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 10 }}>
                      <Mini label="Weighted adherence" value={`${summary.weightedPct ?? 0}%`} />
                      <Mini label="Confidence" value={`${summary.confidencePct ?? 0}%`} />
                      <Mini label="Verified ratio" value={`${summary.verifiedRatio ?? 0}%`} />
                      <Mini label="Wallet equivalent" value={money(Number(adherenceData.rewardPointsEstimate || 0) * 100, currency)} />
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Recent wallet transactions</h2>

        <div style={{ display: "grid", gap: 12 }}>
          {transactions.length === 0 ? (
            <div style={{ opacity: 0.72 }}>
              No wallet transactions yet. Funding, reserve, capture and reward-liability transactions will appear here when available.
            </div>
          ) : (
            transactions.slice(0, 12).map((tx: any) => {
              const tone = txTone(tx.type);

              return (
                <article key={tx.id} style={lineCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <span
                        style={{
                          ...pill,
                          background: tone.bg,
                          borderColor: tone.border,
                          color: tone.text,
                        }}
                      >
                        {tx.type || "TRANSACTION"}
                      </span>

                      <div style={{ marginTop: 8, fontWeight: 800 }}>
                        {money(tx.amountMinor, tx.currency || currency)}
                      </div>

                      <div style={{ opacity: 0.7, fontSize: 13, marginTop: 5 }}>
                        {tx.refType || "No ref type"} Â· {tx.refId || "No ref"} Â· {fmtDate(tx.createdAt)}
                      </div>
                    </div>

                    <pre style={preStyle}>
                      {JSON.stringify(tx.metadata || {}, null, 2)}
                    </pre>
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

function RuleCard({ title, body }: { title: string; body: string }) {
  return (
    <div style={lineCard}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>{title}</div>
      <div style={{ opacity: 0.78, fontSize: 13, lineHeight: 1.6 }}>{body}</div>
    </div>
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

const miniCard: CSSProperties = {
  background: "#0f1730",
  border: "1px solid #1f2a4d",
  borderRadius: 12,
  padding: 12,
};

const lineCard: CSSProperties = {
  background: "#0f1730",
  border: "1px solid #1f2a4d",
  borderRadius: 14,
  padding: 14,
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

const linkButton: CSSProperties = {
  background: "#121931",
  border: "1px solid #334155",
  color: "white",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 700,
  textDecoration: "none",
};

const preStyle: CSSProperties = {
  margin: 0,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  fontSize: 12,
  opacity: 0.78,
  maxWidth: 520,
};
