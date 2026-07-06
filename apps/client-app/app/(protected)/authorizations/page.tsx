"use client";

import { useEffect, useMemo, useState } from "react";

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
      lateDoseRate?: number;
      reminderCoveragePct?: number;
    };
  } | null;
};

type AuthorizationItem = {
  id: string;
  status?: string;
  serviceType?: string;
  scopeType?: string;
  clientMemberId?: string | null;
  employeeNumber?: string | null;
  dependentCode?: string | null;
  principalMemberNumber?: string | null;
  memberStatus?: string | null;
  memberKind?: string | null;
  coveragePlanName?: string | null;
  coveragePlanStatus?: string | null;
  clientName?: string | null;
  clientType?: string | null;
  clientMember?: {
    id?: string;
    patientId?: string | null;
    userId?: string | null;
    memberNumber?: string | null;
    employeeNumber?: string | null;
    dependentCode?: string | null;
    principalMemberNumber?: string | null;
    memberKind?: string | null;
    memberStatus?: string | null;
    coveragePlanId?: string | null;
    metadata?: Record<string, any> | null;
  } | null;
  coveragePlan?: {
    id?: string;
    name?: string | null;
    status?: string | null;
    currency?: string | null;
    metadata?: Record<string, any> | null;
  } | null;
  client?: {
    id?: string;
    legalName?: string | null;
    tradingName?: string | null;
    type?: string | null;
    status?: string | null;
  } | null;
  healthContext?: Record<string, any> | null;
  rewardProfile?: Record<string, any> | null;
  iomtSharing?: Record<string, any> | null;
  gymMembership?: Record<string, any> | null;
  patientId?: string | null;
  memberNumber?: string | null;
  membershipNumber?: string | null;
  requestedAmountMinor?: number | null;
  approvedAmountMinor?: number | null;
  currency?: string | null;
  requestedAt?: string | null;
  createdAt?: string | null;
  expiresAt?: string | null;
  decisionReason?: string | null;
  metadata?: Record<string, any> | null;
  requestPayload?: Record<string, any> | null;
  responsePayload?: Record<string, any> | null;
  ruleSnapshot?: Record<string, any> | null;
};

async function fetchAuthorizations() {
  const res = await fetch("/api/authorizations", {
    cache: "no-store",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch authorizations.");
  }

  const json = await res.json();
  return Array.isArray(json.items) ? json.items : [];
}

async function fetchAdherenceOverview() {
  const res = await fetch(
    "/api/client/adherence-overview?days=30",
    {
      cache: "no-store",
      credentials: "include",
    }
  );

  if (!res.ok) return null;
  return await res.json().catch(() => null);
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

function extractPatientIdFromAuthorization(item: AuthorizationItem): string | null {
  return (
    item?.patientId ||
    item?.metadata?.patientId ||
    item?.requestPayload?.patientId ||
    item?.responsePayload?.patientId ||
    null
  );
}

function extractMemberNumberFromAuthorization(item: AuthorizationItem): string | null {
  return (
    item?.memberNumber ||
    item?.membershipNumber ||
    item?.clientMember?.memberNumber ||
    item?.metadata?.memberNumber ||
    item?.requestPayload?.memberNumber ||
    item?.requestPayload?.membershipNumber ||
    null
  );
}

function authStatusTone(status?: string) {
  switch (String(status || "").toUpperCase()) {
    case "APPROVED":
      return { bg: "#0f2a1f", border: "#14532d", text: "#bbf7d0" };
    case "PARTIALLY_APPROVED":
      return { bg: "#3b2608", border: "#92400e", text: "#fde68a" };
    case "DENIED":
      return { bg: "#3a1017", border: "#7f1d1d", text: "#fecaca" };
    case "CONSUMED":
    case "USED":
      return { bg: "#0c2238", border: "#1d4ed8", text: "#bfdbfe" };
    case "EXPIRED":
      return { bg: "#1f2937", border: "#374151", text: "#d1d5db" };
    default:
      return { bg: "#3b2608", border: "#92400e", text: "#fde68a" };
  }
}

function riskTone(risk?: string) {
  switch ((risk || "").toLowerCase()) {
    case "high":
      return { bg: "#3a1017", border: "#7f1d1d", text: "#fecaca" };
    case "moderate":
      return { bg: "#3b2608", border: "#92400e", text: "#fde68a" };
    default:
      return { bg: "#0f2a1f", border: "#14532d", text: "#bbf7d0" };
  }
}

function hoursSince(value?: string | null) {
  if (!value) return null;
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, Math.floor((Date.now() - ts) / (1000 * 60 * 60)));
}

function expiryInfo(value?: string | null) {
  if (!value) return null;
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return null;

  const deltaMs = ts - Date.now();
  const days = Math.ceil(deltaMs / (1000 * 60 * 60 * 24));

  return {
    expired: deltaMs < 0,
    days,
    label: deltaMs < 0 ? `Expired ${Math.abs(days)}d ago` : `${days}d left`,
  };
}

function parsePreflight(item: AuthorizationItem) {
  const snap =
    item?.ruleSnapshot ||
    item?.requestPayload?.ruleSnapshot ||
    item?.responsePayload?.ruleSnapshot ||
    item?.metadata?.ruleSnapshot ||
    null;

  const requested = Number(item?.requestedAmountMinor || 0);
  const approved = Number(item?.approvedAmountMinor || 0);

  const patientCopayMinor = Number(
    snap?.patientCopayMinor ??
      snap?.memberCopayMinor ??
      snap?.fixedCopay ??
      0
  );
  const uncoveredGapMinor = Number(
    snap?.uncoveredGapMinor ?? Math.max(0, requested - Math.max(approved, 0))
  );

  const sponsorLiabilityMinor =
    ["APPROVED", "PARTIALLY_APPROVED"].includes(String(item?.status || "").toUpperCase())
      ? approved
      : Number(snap?.coveredBase ?? snap?.sponsorCapMinor ?? approved ?? 0);

  const memberLiabilityMinor = Math.max(0, patientCopayMinor + uncoveredGapMinor);

  const rationale = [
    snap?.decision ? `Rule decision: ${snap.decision}` : null,
    snap?.serviceType ? `Service: ${snap.serviceType}` : null,
    typeof snap?.sponsorCapMinor === "number" ? "Sponsor cap applied" : null,
    typeof snap?.fixedCopay === "number" && snap.fixedCopay > 0 ? "Fixed co-pay applied" : null,
    typeof snap?.percentCopay === "number" && snap.percentCopay > 0 ? "Percentage co-pay applied" : null,
  ].filter(Boolean) as string[];

  return {
    sponsorLiabilityMinor,
    memberLiabilityMinor,
    patientCopayMinor,
    uncoveredGapMinor,
    rationale,
  };
}

function buildIdempotencyKey(prefix: string, id: string) {
  return `${prefix}:${id}:${Date.now()}`;
}

function friendlyActionError(message: string) {
  if (message.includes("Can't reach database server")) {
    return "Database connection is temporarily unavailable. Please retry shortly.";
  }

  if (message.includes("actorUserId")) {
    return "This action could not be audited because the acting user was not resolved. Please log out and log in again.";
  }

  if (message.includes("idempotency")) {
    return "This action could not complete because the audit/idempotency check failed. Please retry once.";
  }

  if (message.includes("decisionReason")) {
    return "Decision reason is required for this action.";
  }

  return message.length > 240 ? `${message.slice(0, 240)}…` : message;
}

export default function AuthorizationsPage() {
  const [items, setItems] = useState<AuthorizationItem[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [decisionReason, setDecisionReason] = useState<Record<string, string>>({});
  const [expiryInput, setExpiryInput] = useState<Record<string, string>>({});
  const [approvedAmountInput, setApprovedAmountInput] = useState<Record<string, string>>({});
  const [busyAction, setBusyAction] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const [loadedItems, loadedOverview] = await Promise.all([
        fetchAuthorizations(),
        fetchAdherenceOverview(),
      ]);

      setItems(loadedItems);
      setOverview(loadedOverview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load authorization queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const enrichedItems = useMemo(() => {
    const members: AdherenceMember[] = Array.isArray(overview?.members) ? overview.members : [];

    const byPatientId = new Map<string, AdherenceMember>();
    const byMemberNumber = new Map<string, AdherenceMember>();

    members.forEach((m) => {
      if (m?.patientId) byPatientId.set(String(m.patientId), m);
      if (m?.memberNumber) byMemberNumber.set(String(m.memberNumber), m);
    });

    return items.map((item) => {
      const patientId = extractPatientIdFromAuthorization(item);
      const memberNumber = extractMemberNumberFromAuthorization(item);

      const linkedMember =
        (patientId ? byPatientId.get(String(patientId)) : null) ||
        (memberNumber ? byMemberNumber.get(String(memberNumber)) : null) ||
        null;

      const queueAgeHours = hoursSince(item?.requestedAt || item?.createdAt) ?? 0;
      const expiry = expiryInfo(item?.expiresAt);
      const preflight = parsePreflight(item);

      const urgency =
        String(item?.status || "").toUpperCase() === "PENDING" &&
        (queueAgeHours >= 48 || linkedMember?.adherence?.riskStatus === "high" || expiry?.expired)
          ? "urgent"
          : String(item?.status || "").toUpperCase() === "PENDING" && queueAgeHours >= 24
          ? "priority"
          : "normal";

      return {
        ...item,
        linkedMember,
        queueAgeHours,
        expiry,
        preflight,
        urgency,
      };
    });
  }, [items, overview]);

  const pendingItems = enrichedItems.filter(
    (item) => String(item.status || "").toUpperCase() === "PENDING"
  );

  const pendingCount = pendingItems.length;
  const highRiskPendingCount = pendingItems.filter(
    (item: any) => item.linkedMember?.adherence?.riskStatus === "high"
  ).length;
  const urgentCount = pendingItems.filter((item: any) => item.urgency === "urgent").length;
  const expiringSoonCount = enrichedItems.filter(
    (item: any) => item.expiry && !item.expiry.expired && item.expiry.days <= 3
  ).length;

  async function approve(id: string) {
    setBusyAction(`approve:${id}`);
    setError(null);
    setSuccess(null);

    try {
      const approvedAmountMinor = approvedAmountInput[id]?.trim()
        ? Number(approvedAmountInput[id])
        : undefined;

      const res = await fetch(`/api/authorizations/${id}/approve`, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": buildIdempotencyKey("auth-approve", id),
        },
        body: JSON.stringify({
          approvedAmountMinor,
          decisionReason: decisionReason[id]?.trim() || undefined,
          expiresAt: expiryInput[id]?.trim() || null,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Failed to approve authorization.");
      }

      await load();
      setSuccess(
        approvedAmountMinor
          ? "Authorization approved. If the amount was lower than requested, it has been treated as a partial approval."
          : "Authorization approved."
      );
    } catch (e) {
      setError(
        friendlyActionError(
          e instanceof Error ? e.message : "Failed to approve authorization."
        )
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function deny(id: string) {
    setBusyAction(`deny:${id}`);
    setError(null);
    setSuccess(null);

    try {
      const reason = decisionReason[id]?.trim();
      if (!reason) {
        throw new Error("Decision reason is required to deny an authorization.");
      }

      const res = await fetch(`/api/authorizations/${id}/deny`, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": buildIdempotencyKey("auth-deny", id),
        },
        body: JSON.stringify({
          decisionReason: reason,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Failed to deny authorization.");
      }

      await load();
      setSuccess("Authorization denied and decision rationale recorded.");
    } catch (e) {
      setError(
        friendlyActionError(
          e instanceof Error ? e.message : "Failed to deny authorization."
        )
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function consume(id: string) {
    setBusyAction(`consume:${id}`);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/authorizations/${id}/consume`, {
        method: "POST",
        credentials: "include",
        headers: {
          "x-idempotency-key": buildIdempotencyKey("auth-consume", id),
        },
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Failed to consume authorization.");
      }

      await load();
      setSuccess("Authorization consumed and utilization recorded.");
    } catch (e) {
      setError(
        friendlyActionError(
          e instanceof Error ? e.message : "Failed to consume authorization."
        )
      );
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <main style={{ padding: 32, maxWidth: 1440 }}>
      <h1 style={{ marginTop: 0 }}>Authorizations</h1>
      <p style={{ opacity: 0.8, marginBottom: 24 }}>
        Pending approvals, urgent queue, adherence-aware intervention posture, liability preview, expiration pressure, and live operational actions.
      </p>

      {error ? (
        <section
          style={{
            background: "#3a1017",
            border: "1px solid #7f1d1d",
            color: "#fecaca",
            borderRadius: 14,
            padding: 14,
            marginBottom: 18,
          }}
        >
          {error}
        </section>
      ) : null}

      {success ? (
        <section
          style={{
            background: "#0f2a1f",
            border: "1px solid #14532d",
            color: "#bbf7d0",
            borderRadius: 14,
            padding: 14,
            marginBottom: 18,
          }}
        >
          {success}
        </section>
      ) : null}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <Metric label="Pending Authorizations" value={String(pendingCount)} />
        <Metric label="Urgent Queue" value={String(urgentCount)} />
        <Metric label="High-Risk Pending" value={String(highRiskPendingCount)} />
        <Metric label="Expiring Soon" value={String(expiringSoonCount)} />
        <Metric label="Avg Weighted Adherence" value={`${overview?.summary?.avgWeightedAdherence ?? 0}%`} />
        <Metric label="Tracked Members" value={String(overview?.summary?.trackedMemberCount ?? 0)} />
      </section>

      {loading ? (
        <div style={{ opacity: 0.72 }}>Loading authorization queue…</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {enrichedItems.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No authorizations found yet.</div>
          ) : (
            enrichedItems.map((item: any) => {
              const tone = authStatusTone(item.status);
              const linked = item.linkedMember;
              const adherence = linked?.adherence;
              const risk = adherence?.riskStatus || null;
              const riskBadge = risk ? riskTone(risk) : null;
              const urgencyTone =
                item.urgency === "urgent"
                  ? { bg: "#3a1017", border: "#7f1d1d", text: "#fecaca" }
                  : item.urgency === "priority"
                  ? { bg: "#3b2608", border: "#92400e", text: "#fde68a" }
                  : { bg: "#0f2a1f", border: "#14532d", text: "#bbf7d0" };

              const pending = String(item.status || "").toUpperCase() === "PENDING";
              const approved = ["APPROVED", "PARTIALLY_APPROVED"].includes(
                String(item.status || "").toUpperCase()
              );

              return (
                <div
                  key={item.id}
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
                      gridTemplateColumns: "1.45fr 1fr",
                      gap: 16,
                      alignItems: "start",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>
                          {item.serviceType || "Authorization"}
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

                        <span
                          style={{
                            fontSize: 12,
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: urgencyTone.bg,
                            border: `1px solid ${urgencyTone.border}`,
                            color: urgencyTone.text,
                            textTransform: "capitalize",
                          }}
                        >
                          {item.urgency} queue
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
                      </div>

                      <div style={{ marginTop: 8, opacity: 0.82, fontSize: 14 }}>
                        Scope: {item.scopeType || "—"} · Member:{" "}
                        {item.clientMemberId ? (
                          <a
                            href={`/members/${item.clientMemberId}`}
                            style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 700 }}
                          >
                            {extractMemberNumberFromAuthorization(item) || linked?.memberNumber || item.clientMemberId}
                          </a>
                        ) : (
                          extractMemberNumberFromAuthorization(item) || linked?.memberNumber || "—"
                        )}
                        {item.dependentCode ? ` · Dep ${item.dependentCode}` : ""}
                      </div>

                      <div style={{ marginTop: 6, opacity: 0.68, fontSize: 13 }}>
                        Patient: {extractPatientIdFromAuthorization(item) || "—"} · Plan:{" "}
                        {item.coveragePlanName || item.coveragePlan?.name || linked?.coveragePlan?.name || "—"}
                        {item.clientName ? ` · Client: ${item.clientName}` : ""}
                      </div>

                      <div style={{ marginTop: 6, opacity: 0.68, fontSize: 13 }}>
                        Requested at: {item.requestedAt ? new Date(item.requestedAt).toLocaleString() : item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"} · SLA age: {item.queueAgeHours}h
                      </div>

                      <div style={{ marginTop: 6, opacity: 0.68, fontSize: 13 }}>
                        Expiry: {item.expiry?.label || "Not set"} · Decision reason: {item.decisionReason || "—"}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: 10,
                      }}
                    >
                      <MiniMetric label="Requested" value={money(item.requestedAmountMinor, item.currency || "ZAR")} />
                      <MiniMetric label="Approved" value={money(item.approvedAmountMinor, item.currency || "ZAR")} />
                      <MiniMetric label="Sponsor liability" value={money(item.preflight.sponsorLiabilityMinor, item.currency || "ZAR")} />
                      <MiniMetric label="Member liability" value={money(item.preflight.memberLiabilityMinor, item.currency || "ZAR")} />
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                      gap: 10,
                    }}
                  >
                    <MiniMetric label="Adherence" value={`${adherence?.summary?.weightedPct ?? 0}%`} />
                    <MiniMetric label="Confidence" value={`${adherence?.summary?.confidencePct ?? 0}%`} />
                    <MiniMetric label="Verified ratio" value={`${adherence?.summary?.verifiedRatio ?? 0}%`} />
                    <MiniMetric label="Reminder coverage" value={`${adherence?.summary?.reminderCoveragePct ?? 0}%`} />
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                      gap: 10,
                    }}
                  >
                    <MiniMetric label="Missed-dose rate" value={`${adherence?.summary?.missedDoseRate ?? 0}%`} />
                    <MiniMetric label="Late-dose rate" value={`${adherence?.summary?.lateDoseRate ?? 0}%`} />
                    <MiniMetric label="Patient co-pay" value={money(item.preflight.patientCopayMinor, item.currency || "ZAR")} />
                    <MiniMetric label="Uncovered gap" value={money(item.preflight.uncoveredGapMinor, item.currency || "ZAR")} />
                  </div>

                  <div
                    style={{
                      background: "#0f1730",
                      border: "1px solid #1f2a4d",
                      borderRadius: 12,
                      padding: 12,
                      fontSize: 13,
                      opacity: 0.92,
                    }}
                  >
                    {risk === "high"
                      ? "High intervention signal: consider manual review, adherence coaching, and tighter benefit oversight before approval or renewal decisions."
                      : risk === "moderate"
                      ? "Moderate intervention signal: authorization can proceed, but member may benefit from reminder reinforcement or chronic support nudges."
                      : adherence
                      ? "Stable adherence context: authorization can be reviewed with lower intervention urgency and stronger reward-readiness context."
                      : "No linked adherence context found for this authorization yet."}
                  </div>

                  <div
                    style={{
                      background: "#0f1730",
                      border: "1px solid #1f2a4d",
                      borderRadius: 12,
                      padding: 12,
                      fontSize: 13,
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Preflight rationale</div>
                    {item.preflight.rationale.length === 0 ? (
                      <div style={{ opacity: 0.72 }}>No rule rationale snapshot found.</div>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {item.preflight.rationale.map((reason: string, idx: number) => (
                          <span
                            key={`${reason}-${idx}`}
                            style={{
                              fontSize: 12,
                              padding: "4px 10px",
                              borderRadius: 999,
                              background: "#121931",
                              border: "1px solid #1f2a4d",
                              color: "#dbe7ff",
                            }}
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      background: "#0f1730",
                      border: "1px solid #1f2a4d",
                      borderRadius: 12,
                      padding: 14,
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 12 }}>Operational actions</div>

                    <div style={{ opacity: 0.72, fontSize: 13, marginBottom: 12 }}>
                      For partial approval, enter an approved amount lower than the requested amount, add a rationale, then click Approve.
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                        gap: 12,
                        marginBottom: 12,
                      }}
                    >
                      <Field label="Decision reason">
                        <input
                          value={decisionReason[item.id] || ""}
                          onChange={(e) =>
                            setDecisionReason((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          placeholder="Reason for approve/deny"
                          style={inputStyle}
                        />
                      </Field>

                      <Field label="Approved amount (minor)">
                        <input
                          value={approvedAmountInput[item.id] || ""}
                          onChange={(e) =>
                            setApprovedAmountInput((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          placeholder="Optional"
                          style={inputStyle}
                        />
                      </Field>

                      <Field label="Expiry date/time">
                        <input
                          type="datetime-local"
                          value={expiryInput[item.id] || ""}
                          onChange={(e) =>
                            setExpiryInput((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          style={inputStyle}
                        />
                      </Field>
                    </div>

                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        disabled={!pending || busyAction === `approve:${item.id}`}
                        onClick={() => approve(item.id)}
                        style={{
                          ...primaryButton,
                          opacity: pending ? 1 : 0.45,
                          cursor: pending ? "pointer" : "not-allowed",
                        }}
                      >
                        {busyAction === `approve:${item.id}`
                          ? "Approving…"
                          : approvedAmountInput[item.id]?.trim()
                            ? "Approve / partial approve"
                            : "Approve"}
                      </button>

                      <button
                        type="button"
                        disabled={!pending || busyAction === `deny:${item.id}`}
                        onClick={() => deny(item.id)}
                        style={{
                          ...dangerButton,
                          opacity: pending ? 1 : 0.45,
                          cursor: pending ? "pointer" : "not-allowed",
                        }}
                      >
                        {busyAction === `deny:${item.id}` ? "Denying…" : "Deny"}
                      </button>

                      <button
                        type="button"
                        disabled={!approved || busyAction === `consume:${item.id}`}
                        onClick={() => consume(item.id)}
                        style={{
                          ...secondaryButton,
                          opacity: approved ? 1 : 0.45,
                          cursor: approved ? "pointer" : "not-allowed",
                        }}
                      >
                        {busyAction === `consume:${item.id}` ? "Consuming…" : "Consume"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#121931",
  border: "1px solid #1f2a4d",
  color: "inherit",
  borderRadius: 12,
  padding: "12px 14px",
  outline: "none",
};

const primaryButton: React.CSSProperties = {
  background: "#2563eb",
  border: "1px solid #1d4ed8",
  color: "white",
  borderRadius: 12,
  padding: "12px 16px",
  fontWeight: 700,
  cursor: "pointer",
};

const dangerButton: React.CSSProperties = {
  background: "#7f1d1d",
  border: "1px solid #991b1b",
  color: "white",
  borderRadius: 12,
  padding: "12px 16px",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  background: "#121931",
  border: "1px solid #334155",
  color: "white",
  borderRadius: 12,
  padding: "12px 16px",
  fontWeight: 700,
  cursor: "pointer",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span style={{ fontSize: 13, opacity: 0.8 }}>{label}</span>
      {children}
    </label>
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