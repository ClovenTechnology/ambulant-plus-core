import Link from "next/link";
import type { CSSProperties } from "react";

type ProviderSummaryResponse = {
  ok?: boolean;
  error?: string;
  summary?: {
    totalProviders?: number;
    grossAmountMinor?: number;
    netAmountMinor?: number;
    lineCount?: number;
  };
  items?: any[];
};

async function getProviderSettlements(): Promise<ProviderSummaryResponse> {
  const base = process.env.NEXT_PUBLIC_APIGW_BASE || "http://localhost:3010";

  try {
    const res = await fetch(`${base}/api/settlements/providers?orgId=org-default`, {
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json) {
      return {
        ok: false,
        error: json?.error || `Provider settlement API returned HTTP ${res.status}`,
        items: [],
      };
    }

    return json;
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load settlement provider summary.",
      items: [],
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

function laneLabel(value?: string | null) {
  return String(value || "UNKNOWN").replaceAll("_", " ");
}

export default async function SettlementProvidersPage() {
  const data = await getProviderSettlements();
  const items = Array.isArray(data.items) ? data.items : [];
  const summary = data.summary || {};

  return (
    <main style={{ padding: 32, maxWidth: 1320 }}>
      <Link href="/settlements" style={{ color: "#93c5fd", textDecoration: "none" }}>
        ← Back to settlements
      </Link>

      <div style={{ marginTop: 18, marginBottom: 24 }}>
        <div style={{ fontSize: 12, letterSpacing: 1.5, opacity: 0.7, textTransform: "uppercase" }}>
          Settlement Operations
        </div>
        <h1 style={{ margin: "8px 0 8px", fontSize: 34 }}>Provider Settlement Summary</h1>
        <p style={{ opacity: 0.82, margin: 0 }}>
          Aggregated settlement value by provider lane and provider identifier across clinician,
          pharmacy, lab, phlebotomy, rider, platform and inventory flows.
        </p>
      </div>

      {data.ok === false ? (
        <section style={errorBox}>{data.error || "Provider settlement summary unavailable."}</section>
      ) : null}

      <section style={metricGrid}>
        <Metric label="Provider groups" value={summary.totalProviders ?? items.length} sub="Grouped by lane and provider" />
        <Metric label="Gross value" value={money(summary.grossAmountMinor)} sub={`Lines: ${summary.lineCount ?? 0}`} />
        <Metric label="Net provider value" value={money(summary.netAmountMinor)} sub="Ready for payout review" />
      </section>

      <section style={{ display: "grid", gap: 14, marginTop: 20 }}>
        {items.length === 0 ? (
          <div style={{ opacity: 0.72 }}>
            No provider settlement summary found yet. Run settlement batching after billable events are seeded.
          </div>
        ) : (
          items.map((item: any, idx: number) => (
            <article
              key={`${item.providerLane}-${item.providerId ?? "unknown"}-${idx}`}
              style={card}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <strong style={{ fontSize: 17 }}>{laneLabel(item.providerLane)}</strong>
                    <span style={mutedPill}>{item.providerId || "Unknown provider"}</span>
                  </div>

                  <div style={{ opacity: 0.72, fontSize: 13, marginTop: 8 }}>
                    Lines: {item.lineCount ?? 0} · Latest line: {fmtDate(item.latestLineAt)}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(150px, 1fr))", gap: 10, minWidth: 320 }}>
                  <Mini label="Gross" value={money(item.grossAmountMinor)} />
                  <Mini label="Net" value={money(item.netAmountMinor)} />
                </div>
              </div>
            </article>
          ))
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

const mutedPill: CSSProperties = {
  fontSize: 11,
  border: "1px solid #374151",
  borderRadius: 999,
  padding: "3px 9px",
  fontWeight: 700,
  background: "#1f2937",
  color: "#d1d5db",
};

const errorBox: CSSProperties = {
  background: "#3a1017",
  border: "1px solid #7f1d1d",
  color: "#fecaca",
  borderRadius: 14,
  padding: 14,
  marginBottom: 18,
};