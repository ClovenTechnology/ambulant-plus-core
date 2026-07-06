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

type SettlementResponse = {
  ok?: boolean;
  error?: string;
  summary?: {
    total?: number;
    readyForPayout?: number;
    paid?: number;
    failed?: number;
    grossAmountMinor?: number;
    netAmountMinor?: number;
    platformAmountMinor?: number;
    lineCount?: number;
  };
  items?: any[];
};

async function getSettlements(): Promise<SettlementResponse> {
  try {
    const res = await fetch(internalApiUrl("/api/settlements").toString(), {
      cache: "no-store",
      headers: internalRequestHeaders(),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json) {
      return {
        ok: false,
        error: json?.error || `Settlements API returned HTTP ${res.status}`,
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
          : "Failed to load settlements.",
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

function statusTone(status?: string) {
  switch (String(status || "").toUpperCase()) {
    case "READY_FOR_PAYOUT":
    case "READY":
    case "PENDING":
      return { bg: "#3b2608", border: "#92400e", text: "#fde68a" };
    case "PAID":
    case "SETTLED":
    case "COMPLETED":
      return { bg: "#0f2a1f", border: "#14532d", text: "#bbf7d0" };
    case "FAILED":
    case "REJECTED":
    case "CANCELLED":
      return { bg: "#3a1017", border: "#7f1d1d", text: "#fecaca" };
    default:
      return { bg: "#1f2937", border: "#374151", text: "#d1d5db" };
  }
}

export default async function SettlementsPage() {
  const data = await getSettlements();
  const items = Array.isArray(data.items) ? data.items : [];
  const summary = data.summary || {};

  return (
    <main style={{ padding: 32, maxWidth: 1360 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, letterSpacing: 1.5, opacity: 0.7, textTransform: "uppercase" }}>
          Settlement Operations
        </div>
        <h1 style={{ margin: "8px 0 8px", fontSize: 34 }}>Settlements</h1>
        <p style={{ opacity: 0.82, margin: 0 }}>
          Provider-lane settlement records across clinician, pharmacy, lab, phlebotomy, rider,
          platform, inventory and sponsor-paid billable events.
        </p>
      </div>

      {data.ok === false ? (
        <section style={errorBox}>{data.error || "Settlements unavailable."}</section>
      ) : null}

      <section style={metricGrid}>
        <Metric label="Settlement batches" value={summary.total ?? items.length} sub="Current org scope" />
        <Metric label="Ready for payout" value={summary.readyForPayout ?? 0} sub={`Paid / settled: ${summary.paid ?? 0}`} />
        <Metric label="Gross settlement value" value={money(summary.grossAmountMinor)} sub={`Lines: ${summary.lineCount ?? 0}`} />
        <Metric label="Net provider value" value={money(summary.netAmountMinor)} sub={`Platform share: ${money(summary.platformAmountMinor)}`} />
      </section>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", margin: "20px 0 12px" }}>
        <h2 style={{ margin: 0 }}>Settlement records</h2>
        <Link
          href="/settlements/providers"
          style={{
            color: "#93c5fd",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          View provider summary →
        </Link>
      </div>

      <section style={{ display: "grid", gap: 14 }}>
        {items.length === 0 ? (
          <div style={{ opacity: 0.72 }}>
            No settlements found yet. Run the settlement batch endpoint after claims/billable events are seeded.
          </div>
        ) : (
          items.map((item: any) => {
            const tone = statusTone(item.status);
            const lines = Array.isArray(item.lines) ? item.lines : [];

            return (
              <article key={item.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <strong style={{ fontSize: 16 }}>{item.id}</strong>
                      <span style={{ ...pill, background: tone.bg, borderColor: tone.border, color: tone.text }}>
                        {item.status || "UNKNOWN"}
                      </span>
                      <span style={mutedPill}>{item.providerLane || "MIXED"}</span>
                      {item.providerId ? <span style={mutedPill}>{item.providerId}</span> : null}
                    </div>

                    <div style={{ opacity: 0.72, fontSize: 13, marginTop: 8 }}>
                      Settled at: {fmtDate(item.settledAt)} · Created: {fmtDate(item.createdAt)} · Remittance:{" "}
                      {item.remittanceRef || "Pending"}
                    </div>

                    <div style={{ opacity: 0.68, fontSize: 13, marginTop: 6 }}>
                      Billable events: {item.billableEventCount ?? lines.length} · Lines: {item.lineCount ?? lines.length}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(120px, 1fr))", gap: 10, minWidth: 560 }}>
                    <Mini label="Gross" value={money(item.grossAmountMinor, item.currency)} />
                    <Mini label="Net provider" value={money(item.netAmountMinor, item.currency)} />
                    <Mini label="Platform" value={money(item.platformAmountMinor, item.currency)} />
                    <Mini label="Staff" value={money(item.staffAmountMinor, item.currency)} />
                  </div>
                </div>

                {lines.length > 0 ? (
                  <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                    {lines.slice(0, 4).map((line: any) => (
                      <div key={line.id} style={lineCard}>
                        <span style={{ fontWeight: 700 }}>{line.providerLane || "LANE"}</span>{" "}
                        {line.providerId ? `· ${line.providerId}` : ""} · Gross{" "}
                        {money(line.grossAmountMinor, item.currency)} · Net{" "}
                        {money(line.netAmountMinor, item.currency)}
                      </div>
                    ))}
                    {lines.length > 4 ? (
                      <div style={{ opacity: 0.7, fontSize: 13 }}>
                        + {lines.length - 4} more settlement lines
                      </div>
                    ) : null}
                  </div>
                ) : null}
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
  borderRadius: 12,
  padding: 10,
  fontSize: 13,
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

const errorBox: CSSProperties = {
  background: "#3a1017",
  border: "1px solid #7f1d1d",
  color: "#fecaca",
  borderRadius: 14,
  padding: 14,
  marginBottom: 18,
};