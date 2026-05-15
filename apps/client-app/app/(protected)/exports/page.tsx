"use client";

import React, { useEffect, useMemo, useState } from "react";

const ORG_ID = "org-default";
const DEFAULT_CLIENT_ID = "client-demo-medical-aid";

function apiBase() {
  return "";
}

function clientId() {
  return process.env.NEXT_PUBLIC_DEFAULT_CLIENT_ID || DEFAULT_CLIENT_ID;
}

type ExportResponse = {
  ok?: boolean;
  summary?: Record<string, number>;
  audit?: {
    generatedAt?: string;
    bundleHash?: string;
    rowCount?: number;
  };
  adapterPosture?: {
    channels?: string[];
    currentReadiness?: Record<string, boolean>;
    note?: string;
  };
  error?: string;
};

type AdapterResponse = {
  ok?: boolean;
  items?: Array<{
    id: string;
    name: string;
    schemeCode: string;
    administratorCode: string;
    status: string;
    channels: string[];
    supportedExports: string[];
    notes: string[];
    providerPaymentPolicy?: Record<string, string>;
  }>;
  summary?: Record<string, any>;
  error?: string;
};

const DATASETS = [
  {
    key: "members",
    label: "Members",
    description:
      "Member roster, member number, scheme metadata, dependant code, plan and effective dates.",
  },
  {
    key: "eligibility",
    label: "Eligibility",
    description:
      "Active status, plan linkage, effective dates and eligibility decision snapshot.",
  },
  {
    key: "authorizations",
    label: "Authorizations",
    description:
      "Pre-auth queue, decisions, service type, approved amounts, expiry and reason codes.",
  },
  {
    key: "claims",
    label: "Claims",
    description:
      "Submitted, approved, paid, member responsibility, authorization and line posture.",
  },
  {
    key: "remittance",
    label: "Remittance",
    description:
      "Settlement and settlement-line export for provider payment and reconciliation.",
  },
  {
    key: "health-context",
    label: "Health-context summary",
    description:
      "POPIA-safe clinical history, vitals, wearable, reproductive, antenatal and reward signals.",
  },
  {
    key: "scheme-applications",
    label: "Scheme applications",
    description:
      "Join-a-Scheme intake applications with consent, plan choice and export posture.",
  },
];

function moneyBool(value?: boolean) {
  return value ? "Ready" : "Requires onboarding";
}

function exportUrl(dataset: string, format: "json" | "csv") {
  return `${apiBase()}/api/client/exports?orgId=${encodeURIComponent(
    ORG_ID
  )}&clientId=${encodeURIComponent(clientId())}&dataset=${encodeURIComponent(
    dataset
  )}&format=${format}`;
}

export default function ClientExportsPage() {
  const [exportsData, setExportsData] = useState<ExportResponse | null>(null);
  const [adaptersData, setAdaptersData] = useState<AdapterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [exportsRes, adaptersRes] = await Promise.all([
        fetch(exportUrl("all", "json"), { cache: "no-store" }),
        fetch(`${apiBase()}/api/scheme-adapters?country=ZA`, {
          cache: "no-store",
        }),
      ]);

      const exportsJson = await exportsRes.json().catch(() => null);
      const adaptersJson = await adaptersRes.json().catch(() => null);

      if (!exportsRes.ok || exportsJson?.ok === false) {
        throw new Error(exportsJson?.error || "Failed to load exports.");
      }

      if (!adaptersRes.ok || adaptersJson?.ok === false) {
        throw new Error(adaptersJson?.error || "Failed to load scheme adapters.");
      }

      setExportsData(exportsJson);
      setAdaptersData(adaptersJson);
    } catch (err: any) {
      setError(err?.message || "Failed to load export readiness.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const totalRows = useMemo(() => {
    const summary = exportsData?.summary || {};
    return Object.values(summary).reduce((sum, n) => sum + Number(n || 0), 0);
  }, [exportsData]);

  const readiness = exportsData?.adapterPosture?.currentReadiness || {};

  return (
    <main style={{ padding: 32, maxWidth: 1480 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={eyebrow}>Scheme adapter and export readiness</div>
        <h1 style={{ margin: "8px 0 8px", fontSize: 34 }}>Exports</h1>
        <p style={{ opacity: 0.82, margin: 0, maxWidth: 980 }}>
          CSV, canonical API, portal-pack, switch and private-API posture for
          member intake, eligibility, authorizations, claims, remittance and
          consent-safe health-context handoff.
        </p>
      </div>

      {error ? (
        <div style={errorBox}>{error}</div>
      ) : null}

      <section style={metricGrid}>
        <Metric label="Export datasets" value={DATASETS.length} sub="Current canonical surfaces" />
        <Metric label="Export rows" value={totalRows} sub="Current client scope" />
        <Metric
          label="CSV readiness"
          value={moneyBool(readiness.csv)}
          sub="Immediate file-based handoff"
        />
        <Metric
          label="Canonical API"
          value={moneyBool(readiness.canonicalApi)}
          sub="Ambulant+ normalized JSON"
        />
        <Metric
          label="Private API"
          value={moneyBool(readiness.privateApi)}
          sub="Requires scheme onboarding pack"
        />
      </section>

      <section style={{ ...card, marginTop: 20 }}>
        <h2 style={{ marginTop: 0 }}>Operational position</h2>
        <p style={{ opacity: 0.82, lineHeight: 1.7, margin: 0 }}>
          Ambulant+ can generate a scheme-ready export bundle immediately as CSV
          and canonical JSON. Switch and private-API channels remain adapter
          workstreams because each scheme or administrator will provide private
          onboarding, reason-code, remittance and UAT packs.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          {(exportsData?.adapterPosture?.channels || []).map((channel) => (
            <span key={channel} style={pill}>
              {channel}
            </span>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <div style={sectionHeader}>
          <div>
            <h2 style={{ margin: 0 }}>Export datasets</h2>
            <div style={{ opacity: 0.7, fontSize: 13 }}>
              Download CSV or inspect canonical JSON per dataset.
            </div>
          </div>

          <button type="button" onClick={load} style={buttonSecondary}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          {DATASETS.map((dataset) => {
            const count = Number(exportsData?.summary?.[dataset.key] || 0);

            return (
              <article key={dataset.key} style={card}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 18,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 18 }}>{dataset.label}</strong>
                      <span style={pill}>{count} rows</span>
                    </div>
                    <p style={{ opacity: 0.75, margin: "8px 0 0", lineHeight: 1.6 }}>
                      {dataset.description}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <a href={exportUrl(dataset.key, "csv")} style={buttonPrimary}>
                      Download CSV
                    </a>
                    <a href={exportUrl(dataset.key, "json")} target="_blank" rel="noreferrer" style={buttonSecondary}>
                      View JSON
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>Scheme adapters</h2>

        <div style={{ display: "grid", gap: 14 }}>
          {(adaptersData?.items || []).map((adapter) => (
            <article key={adapter.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 18 }}>{adapter.name}</strong>
                    <span style={adapter.status === "DEMO_READY" ? goodPill : warnPill}>
                      {adapter.status.replaceAll("_", " ")}
                    </span>
                  </div>

                  <div style={{ opacity: 0.7, fontSize: 13, marginTop: 8 }}>
                    Scheme code: {adapter.schemeCode} · Admin code:{" "}
                    {adapter.administratorCode}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                    {adapter.channels.map((channel) => (
                      <span key={channel} style={pill}>
                        {channel}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ minWidth: 300, maxWidth: 520 }}>
                  <div style={miniCard}>
                    <strong>Provider payment policy</strong>
                    <div style={{ opacity: 0.78, fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
                      Clinicians without own practice numbers route claims to
                      Ambulant+; clinicians with verified practice numbers and
                      bank profiles can be settled directly.
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                {adapter.notes.map((note) => (
                  <div key={note} style={contextBox}>
                    {note}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section style={{ ...card, marginTop: 28 }}>
        <h2 style={{ marginTop: 0 }}>Audit</h2>
        <div style={{ display: "grid", gap: 8, fontSize: 13, opacity: 0.8 }}>
          <div>Generated at: {exportsData?.audit?.generatedAt || "Not loaded"}</div>
          <div>Bundle hash: {exportsData?.audit?.bundleHash || "Not loaded"}</div>
          <div>Client: {clientId()}</div>
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

const eyebrow: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: 1.5,
  opacity: 0.7,
  textTransform: "uppercase",
};

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

const contextBox: React.CSSProperties = {
  background: "#0f1730",
  border: "1px solid #1f2a4d",
  borderRadius: 12,
  padding: 10,
  fontSize: 13,
};

const sectionHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "center",
  marginBottom: 14,
};

const pill: React.CSSProperties = {
  display: "inline-flex",
  border: "1px solid #374151",
  background: "#1f2937",
  color: "#d1d5db",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 11,
  fontWeight: 800,
};

const goodPill: React.CSSProperties = {
  ...pill,
  background: "#0f2a1f",
  borderColor: "#14532d",
  color: "#bbf7d0",
};

const warnPill: React.CSSProperties = {
  ...pill,
  background: "#3b2608",
  borderColor: "#92400e",
  color: "#fde68a",
};

const buttonPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 12,
  padding: "10px 14px",
  background: "#2563eb",
  color: "white",
  fontWeight: 800,
  textDecoration: "none",
  border: "1px solid #2563eb",
  fontSize: 13,
};

const buttonSecondary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 12,
  padding: "10px 14px",
  background: "#0f1730",
  color: "white",
  fontWeight: 800,
  textDecoration: "none",
  border: "1px solid #1f2a4d",
  fontSize: 13,
};

const errorBox: React.CSSProperties = {
  background: "#4c1118",
  border: "1px solid #991b1b",
  color: "#fecaca",
  borderRadius: 14,
  padding: 14,
  marginBottom: 18,
};