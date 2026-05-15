"use client";

import React, { CSSProperties, useEffect, useMemo, useState } from "react";

type AuditLogItem = {
  id: string;
  createdAt: string;
  actorUserId?: string | null;
  actorType?: string | null;
  actorRefId?: string | null;
  app?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  description?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Record<string, any> | null;
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function fmtDate(value: string) {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : value;
}

function statusOf(item: AuditLogItem) {
  return String(item.meta?.status || "success");
}

export default function AuditPage() {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState("");
  const [status, setStatus] = useState("");
  const [entityType, setEntityType] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      orgId: "org-default",
      clientId: process.env.NEXT_PUBLIC_DEFAULT_CLIENT_ID || "client-demo-medical-aid",
      take: "150",
    });

    if (action) params.set("action", action);
    if (status) params.set("status", status);
    if (entityType) params.set("entityType", entityType);

    try {
      const res = await fetch(`/api/audit-logs?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load audit logs.");
      }

      setItems(asArray<AuditLogItem>(json?.items));
    } catch (err: any) {
      setError(err?.message || "Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const actions = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.action))).sort();
  }, [items]);

  const entityTypes = useMemo(() => {
    return Array.from(
      new Set(items.map((item) => item.entityType).filter(Boolean) as string[])
    ).sort();
  }, [items]);

  const successCount = items.filter((x) => statusOf(x) === "success").length;
  const failedCount = items.filter((x) => statusOf(x) === "failed").length;
  const blockedCount = items.filter((x) => statusOf(x) === "blocked").length;

  return (
    <main style={{ padding: 32, maxWidth: 1500 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={eyebrow}>Governance and Security</div>
        <h1 style={{ margin: "8px 0 8px", fontSize: 34 }}>Audit Logs</h1>
        <p style={{ opacity: 0.82, margin: 0, maxWidth: 980 }}>
          Trace sensitive PayerOps activity across wallet funding, authorization decisions,
          settlement runs, exports, role administration, scheme-adapter changes, and other
          protected operations.
        </p>
      </div>

      <section style={metricGrid}>
        <Metric label="Events loaded" value={items.length} sub="Current filtered view" />
        <Metric label="Successful" value={successCount} sub="Completed actions" />
        <Metric label="Failed" value={failedCount} sub="Runtime failures" />
        <Metric label="Blocked" value={blockedCount} sub="RBAC / trust denials" />
      </section>

      {error ? <div style={errorBox}>{error}</div> : null}

      <section style={{ ...card, marginTop: 20 }}>
        <h2 style={{ marginTop: 0 }}>Filters</h2>

        <div style={filterGrid}>
          <select value={action} onChange={(e) => setAction(e.target.value)} style={input}>
            <option value="">All actions</option>
            {actions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select value={status} onChange={(e) => setStatus(e.target.value)} style={input}>
            <option value="">All statuses</option>
            <option value="success">success</option>
            <option value="failed">failed</option>
            <option value="blocked">blocked</option>
            <option value="empty">empty</option>
          </select>

          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            style={input}
          >
            <option value="">All entity types</option>
            {entityTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <button onClick={load} style={buttonPrimary}>
            Refresh
          </button>
        </div>
      </section>

      <section style={{ marginTop: 20 }}>
        <h2>Audit trail</h2>

        {loading ? (
          <div style={card}>Loading audit logs...</div>
        ) : items.length === 0 ? (
          <div style={card}>No audit logs found yet. Trigger a wallet fund, authorization decision, or settlement run.</div>
        ) : (
          <div style={list}>
            {items.map((item) => {
              const status = statusOf(item);

              return (
                <article key={item.id} style={rowCard}>
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <strong>{item.action}</strong>
                      <span
                        style={
                          status === "success"
                            ? goodPill
                            : status === "blocked"
                            ? warnPill
                            : status === "failed"
                            ? dangerPill
                            : neutralPill
                        }
                      >
                        {status.toUpperCase()}
                      </span>
                    </div>

                    <div style={muted}>
                      {fmtDate(item.createdAt)} · Actor: {item.actorUserId || "system"} ·
                      Role: {item.meta?.role || "—"} · Workspace: {item.meta?.workspace || "—"}
                    </div>

                    <div style={muted}>
                      Entity: {item.entityType || "—"} / {item.entityId || "—"} · Client:{" "}
                      {item.meta?.clientId || "—"} · Org: {item.meta?.orgId || "—"}
                    </div>

                    {item.description ? (
                      <div style={contextBox}>{item.description}</div>
                    ) : null}

                    <details style={{ marginTop: 10 }}>
                      <summary style={{ cursor: "pointer", opacity: 0.75 }}>View metadata</summary>
                      <pre style={pre}>{JSON.stringify(item.meta || {}, null, 2)}</pre>
                    </details>
                  </div>
                </article>
              );
            })}
          </div>
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

const filterGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const card: CSSProperties = {
  background: "#121931",
  border: "1px solid #1f2a4d",
  borderRadius: 16,
  padding: 18,
};

const rowCard: CSSProperties = {
  background: "#121931",
  border: "1px solid #1f2a4d",
  borderRadius: 16,
  padding: 16,
};

const list: CSSProperties = {
  display: "grid",
  gap: 12,
};

const muted: CSSProperties = {
  opacity: 0.72,
  fontSize: 13,
  marginTop: 5,
};

const contextBox: CSSProperties = {
  background: "#0b1228",
  border: "1px solid #1f2a4d",
  borderRadius: 12,
  padding: 10,
  fontSize: 13,
  marginTop: 10,
};

const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#0b1228",
  border: "1px solid #334155",
  color: "white",
  borderRadius: 12,
  padding: "10px 12px",
  outline: "none",
};

const buttonPrimary: CSSProperties = {
  border: "1px solid #2563eb",
  background: "#2563eb",
  color: "white",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
};

const errorBox: CSSProperties = {
  background: "#4c1118",
  border: "1px solid #991b1b",
  color: "#fecaca",
  borderRadius: 14,
  padding: 14,
  marginTop: 18,
};

const pre: CSSProperties = {
  background: "#0b1228",
  border: "1px solid #1f2a4d",
  borderRadius: 12,
  padding: 12,
  overflow: "auto",
  fontSize: 12,
};

const pillBase: CSSProperties = {
  display: "inline-flex",
  border: "1px solid",
  borderRadius: 999,
  padding: "3px 9px",
  fontSize: 11,
  fontWeight: 800,
};

const goodPill: CSSProperties = {
  ...pillBase,
  background: "#0f2a1f",
  borderColor: "#14532d",
  color: "#bbf7d0",
};

const warnPill: CSSProperties = {
  ...pillBase,
  background: "#3b2608",
  borderColor: "#92400e",
  color: "#fde68a",
};

const dangerPill: CSSProperties = {
  ...pillBase,
  background: "#3a1017",
  borderColor: "#7f1d1d",
  color: "#fecaca",
};

const neutralPill: CSSProperties = {
  ...pillBase,
  background: "#1f2937",
  borderColor: "#334155",
  color: "#e5e7eb",
};