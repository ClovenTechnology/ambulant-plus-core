"use client";

import { useEffect, useMemo, useState } from "react";

type RuleDecision =
  | "COVERED"
  | "REQUIRES_AUTHORIZATION"
  | "NOT_COVERED"
  | "NOT_ELIGIBLE";
type VisitMode = "TELEVISIT" | "IN_PERSON" | "HYBRID";

type CoverageRule = {
  id: string;
  orgId?: string;
  coveragePlanId?: string;
  serviceType?: string;
  enabled?: boolean;
  decision?: RuleDecision;
  sponsorCapMinor?: number | null;
  memberCopayMinor?: number | null;
  memberCopayPercent?: number | null;
  preauthRequired?: boolean;
  limitCount?: number | null;
  limitMinor?: number | null;
  limitPeriod?: string | null;
  allowedVisitModes?: string[] | null;
  metadata?: Record<string, any> | null;
};

type CoveragePlan = {
  id: string;
  clientId?: string | null;
  clientProgramId?: string | null;
  name?: string;
  description?: string | null;
  status?: string | null;
  currency?: string;
  annualLimitMinor?: number | null;
  monthlyLimitMinor?: number | null;
  lifetimeLimitMinor?: number | null;
  requiresEligibility?: boolean;
  requiresConsent?: boolean;
  serviceRules?: CoverageRule[];
};

type EditorState = {
  serviceType: string;
  enabled: boolean;
  decision: RuleDecision;
  sponsorCapMinor: string;
  memberCopayMinor: string;
  memberCopayPercent: string;
  preauthRequired: boolean;
  limitCount: string;
  limitMinor: string;
  limitPeriod: string;
  allowedVisitModes: VisitMode[];
};

const SERVICE_TYPES = [
  "CONSULT_STANDARD",
  "CONSULT_FOLLOWUP",
  "CONSULT_PROCEDURE",
  "PHYSICAL_VISIT",
  "LAB_TEST",
  "PHLEB_DRAW",
  "LAB_LOGISTICS",
  "PHARMACY_ITEM",
  "PHARMACY_DISPENSING",
  "RIDER_DELIVERY",
  "DEVICE_PURCHASE",
  "DEVICE_RENTAL",
  "DEVICE_ASSIGNMENT",
  "DEVICE_MAINTENANCE",
  "DEVICE_SWAP",
] as const;

const LIMIT_PERIODS = ["DAY", "WEEK", "MONTH", "QUARTER", "YEAR", "LIFETIME"] as const;
const VISIT_MODES: VisitMode[] = ["TELEVISIT", "IN_PERSON", "HYBRID"];

function apiPath(pathname: string) {
  return pathname;
}

function emptyEditor(defaultServiceType = "CONSULT_STANDARD"): EditorState {
  return {
    serviceType: defaultServiceType,
    enabled: true,
    decision: "COVERED",
    sponsorCapMinor: "",
    memberCopayMinor: "",
    memberCopayPercent: "",
    preauthRequired: false,
    limitCount: "",
    limitMinor: "",
    limitPeriod: "",
    allowedVisitModes: [],
  };
}

function parseNullableInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.trunc(n) : null;
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

function decisionTone(decision?: string) {
  switch (String(decision || "").toUpperCase()) {
    case "COVERED":
      return { bg: "#0f2a1f", border: "#14532d", text: "#bbf7d0" };
    case "REQUIRES_AUTHORIZATION":
      return { bg: "#3b2608", border: "#92400e", text: "#fde68a" };
    case "NOT_COVERED":
    case "NOT_ELIGIBLE":
      return { bg: "#3a1017", border: "#7f1d1d", text: "#fecaca" };
    default:
      return { bg: "#0c2238", border: "#1d4ed8", text: "#bfdbfe" };
  }
}

function statusTone(status?: string) {
  switch (String(status || "").toUpperCase()) {
    case "ACTIVE":
      return { bg: "#0f2a1f", border: "#14532d", text: "#bbf7d0" };
    case "DRAFT":
      return { bg: "#3b2608", border: "#92400e", text: "#fde68a" };
    default:
      return { bg: "#1f2937", border: "#374151", text: "#d1d5db" };
  }
}

function toEditor(rule: CoverageRule): EditorState {
  return {
    serviceType: rule.serviceType || "CONSULT_STANDARD",
    enabled: Boolean(rule.enabled),
    decision: (rule.decision as RuleDecision) || "COVERED",
    sponsorCapMinor:
      typeof rule.sponsorCapMinor === "number" ? String(rule.sponsorCapMinor) : "",
    memberCopayMinor:
      typeof rule.memberCopayMinor === "number" ? String(rule.memberCopayMinor) : "",
    memberCopayPercent:
      typeof rule.memberCopayPercent === "number" ? String(rule.memberCopayPercent) : "",
    preauthRequired: Boolean(rule.preauthRequired),
    limitCount: typeof rule.limitCount === "number" ? String(rule.limitCount) : "",
    limitMinor: typeof rule.limitMinor === "number" ? String(rule.limitMinor) : "",
    limitPeriod: rule.limitPeriod || "",
    allowedVisitModes: Array.isArray(rule.allowedVisitModes)
      ? (rule.allowedVisitModes.filter((v): v is VisitMode =>
          VISIT_MODES.includes(v as VisitMode)
        ) as VisitMode[])
      : [],
  };
}

function toPayload(state: EditorState, coveragePlanId: string) {
  const serviceType = state.serviceType;
  const isPharmacy = serviceType.includes("PHARMACY");
  const isLab = serviceType.includes("LAB");
  const isDevice = serviceType.includes("DEVICE");
  const isVisit = serviceType.includes("VISIT") || serviceType.includes("CONSULT");

  return {
    coveragePlanId,
    serviceType,
    enabled: state.enabled,
    decision: state.decision,
    sponsorCapMinor: parseNullableInt(state.sponsorCapMinor),
    memberCopayMinor: parseNullableInt(state.memberCopayMinor),
    memberCopayPercent: parseNullableInt(state.memberCopayPercent),
    preauthRequired:
      state.preauthRequired || state.decision === "REQUIRES_AUTHORIZATION",
    limitCount: parseNullableInt(state.limitCount),
    limitMinor: parseNullableInt(state.limitMinor),
    limitPeriod: state.limitPeriod.trim() || null,
    allowedVisitModes: state.allowedVisitModes,
    metadata: {
      benefitBucket: isPharmacy
        ? "CHRONIC_MEDICINE"
        : isLab
        ? "PATHOLOGY"
        : isDevice
        ? "DEVICE_BENEFIT"
        : isVisit
        ? "PRIMARY_CARE"
        : "GENERAL_BENEFIT",
      pmbFlag: false,
      cdlFlag: isPharmacy,
      chronicFlag: isPharmacy,
      dspRequired: isPharmacy,
      networkRequired: true,
      formularyRequired: isPharmacy,
      waitingPeriodApplies: false,
      clinicalEvidenceRequired:
        state.preauthRequired || state.decision === "REQUIRES_AUTHORIZATION",
      manualReviewRequired: state.decision === "REQUIRES_AUTHORIZATION",
      protocolCode: isPharmacy
        ? "CHRONIC_FORMULARY_PROTOCOL"
        : isLab
        ? "PATHOLOGY_PROTOCOL"
        : isDevice
        ? "DEVICE_BENEFIT_PROTOCOL"
        : "STANDARD_BENEFIT_PROTOCOL",
    },
  };
}

export default function CoverageRulesEditorPage({
  params,
}: {
  params: { id: string };
}) {
  const coveragePlanId = params.id;

  const [plan, setPlan] = useState<CoveragePlan | null>(null);
  const [rules, setRules] = useState<CoverageRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createState, setCreateState] = useState<EditorState>(emptyEditor());
  const [savingCreate, setSavingCreate] = useState(false);

  const [editStates, setEditStates] = useState<Record<string, EditorState>>({});
  const [savingRuleId, setSavingRuleId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const [plansRes, rulesRes] = await Promise.all([
        fetch(`/api/coverage/plans`, { cache: "no-store" }),
        fetch(
          `/api/coverage/service-rules?coveragePlanId=${encodeURIComponent(
            coveragePlanId
          )}`,
          { cache: "no-store" }
        ),
      ]);

      if (!plansRes.ok) {
        throw new Error("Failed to load coverage plans.");
      }
      if (!rulesRes.ok) {
        throw new Error("Failed to load coverage service rules.");
      }

      const plansJson = await plansRes.json();
      const rulesJson = await rulesRes.json();

      const plans = Array.isArray(plansJson.items) ? plansJson.items : [];
      const planItem = plans.find((item: CoveragePlan) => item.id === coveragePlanId) || null;

      const loadedRules: CoverageRule[] = Array.isArray(rulesJson.data)
        ? rulesJson.data
        : Array.isArray(rulesJson.items)
        ? rulesJson.items
        : [];

      setPlan(planItem);
      setRules(loadedRules);

      const nextEditStates: Record<string, EditorState> = {};
      for (const rule of loadedRules) {
        if (rule.id) nextEditStates[rule.id] = toEditor(rule);
      }
      setEditStates(nextEditStates);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load editor.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coveragePlanId]);

  const summary = useMemo(() => {
    const covered = rules.filter((r) => String(r.decision || "").toUpperCase() === "COVERED").length;
    const preauth = rules.filter((r) => Boolean(r.preauthRequired)).length;
    const copay = rules.filter(
      (r) => Number(r.memberCopayMinor || 0) > 0 || Number(r.memberCopayPercent || 0) > 0
    ).length;
    const limits = rules.filter(
      (r) => Number(r.limitCount || 0) > 0 || Number(r.limitMinor || 0) > 0
    ).length;

    return { covered, preauth, copay, limits };
  }, [rules]);

  async function createRule() {
    setSavingCreate(true);
    setError(null);

    try {
      const res = await fetch(`/api/coverage/service-rules`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(toPayload(createState, coveragePlanId)),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(
          json?.error?.message ||
            json?.error ||
            "Failed to create coverage service rule."
        );
      }

      setCreateState(emptyEditor(createState.serviceType));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create rule.");
    } finally {
      setSavingCreate(false);
    }
  }

  async function saveRule(ruleId: string) {
    const state = editStates[ruleId];
    if (!state) return;

    setSavingRuleId(ruleId);
    setError(null);

    try {
      const res = await fetch(`/api/coverage/service-rules/${encodeURIComponent(ruleId)}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(toPayload(state, coveragePlanId)),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(
          json?.error?.message ||
            json?.error ||
            "Failed to update coverage service rule."
        );
      }

      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update rule.");
    } finally {
      setSavingRuleId(null);
    }
  }

  function updateEdit(ruleId: string, patch: Partial<EditorState>) {
    setEditStates((prev) => ({
      ...prev,
      [ruleId]: {
        ...prev[ruleId],
        ...patch,
      },
    }));
  }

  function toggleVisitMode(
    state: EditorState,
    setState: (next: EditorState) => void,
    mode: VisitMode
  ) {
    const has = state.allowedVisitModes.includes(mode);
    setState({
      ...state,
      allowedVisitModes: has
        ? state.allowedVisitModes.filter((m) => m !== mode)
        : [...state.allowedVisitModes, mode],
    });
  }

  if (loading) {
    return (
      <main style={{ padding: 32 }}>
        <h1 style={{ marginTop: 0 }}>Loading coverage rules...</h1>
      </main>
    );
  }

  if (!plan) {
    return (
      <main style={{ padding: 32 }}>
        <h1 style={{ marginTop: 0 }}>Coverage plan not found</h1>
      </main>
    );
  }

  const planTone = statusTone(plan.status ?? undefined);

  return (
    <main style={{ padding: 32, maxWidth: 1480 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, letterSpacing: 1.5, opacity: 0.7, textTransform: "uppercase" }}>
          Writable Service Rule Editor
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{ margin: "8px 0 8px", fontSize: 34 }}>
            {plan.name || "Coverage plan"}
          </h1>
          <span
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 999,
              background: planTone.bg,
              border: `1px solid ${planTone.border}`,
              color: planTone.text,
            }}
          >
            {plan.status || "—"}
          </span>
        </div>
        <p style={{ margin: 0, opacity: 0.82 }}>
          Edit sponsor adjudication rules, co-pay posture, limits, visit-mode constraints, and pre-authorisation requirements using live API routes.
        </p>
      </div>

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

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <Metric label="Rules" value={String(rules.length)} />
        <Metric label="Covered rules" value={String(summary.covered)} />
        <Metric label="Preauth rules" value={String(summary.preauth)} />
        <Metric label="Co-pay rules" value={String(summary.copay)} />
        <Metric label="Limited rules" value={String(summary.limits)} />
        <Metric label="Plan currency" value={plan.currency || "ZAR"} />
      </section>

      <section
        style={{
          background: "#121931",
          border: "1px solid #1f2a4d",
          borderRadius: 18,
          padding: 18,
          marginBottom: 18,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Create new service rule</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 12,
            marginTop: 12,
          }}
        >
          <Field label="Service type">
            <select
              value={createState.serviceType}
              onChange={(e) =>
                setCreateState({ ...createState, serviceType: e.target.value })
              }
              style={inputStyle}
            >
              {SERVICE_TYPES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Decision">
            <select
              value={createState.decision}
              onChange={(e) =>
                setCreateState({
                  ...createState,
                  decision: e.target.value as RuleDecision,
                })
              }
              style={inputStyle}
            >
              <option value="COVERED">COVERED</option>
              <option value="REQUIRES_AUTHORIZATION">REQUIRES_AUTHORIZATION</option>
              <option value="NOT_COVERED">NOT_COVERED</option>
              <option value="NOT_ELIGIBLE">NOT_ELIGIBLE</option>
            </select>
          </Field>

          <Field label="Limit period">
            <select
              value={createState.limitPeriod}
              onChange={(e) =>
                setCreateState({ ...createState, limitPeriod: e.target.value })
              }
              style={inputStyle}
            >
              <option value="">Not set</option>
              {LIMIT_PERIODS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Sponsor cap (minor)">
            <input
              value={createState.sponsorCapMinor}
              onChange={(e) =>
                setCreateState({ ...createState, sponsorCapMinor: e.target.value })
              }
              placeholder="e.g. 65000"
              style={inputStyle}
            />
          </Field>

          <Field label="Member co-pay fixed (minor)">
            <input
              value={createState.memberCopayMinor}
              onChange={(e) =>
                setCreateState({ ...createState, memberCopayMinor: e.target.value })
              }
              placeholder="e.g. 15000"
              style={inputStyle}
            />
          </Field>

          <Field label="Member co-pay %">
            <input
              value={createState.memberCopayPercent}
              onChange={(e) =>
                setCreateState({
                  ...createState,
                  memberCopayPercent: e.target.value,
                })
              }
              placeholder="e.g. 20"
              style={inputStyle}
            />
          </Field>

          <Field label="Limit count">
            <input
              value={createState.limitCount}
              onChange={(e) =>
                setCreateState({ ...createState, limitCount: e.target.value })
              }
              placeholder="e.g. 12"
              style={inputStyle}
            />
          </Field>

          <Field label="Limit amount (minor)">
            <input
              value={createState.limitMinor}
              onChange={(e) =>
                setCreateState({ ...createState, limitMinor: e.target.value })
              }
              placeholder="e.g. 120000"
              style={inputStyle}
            />
          </Field>

          <Field label="Flags">
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", paddingTop: 10 }}>
              <Toggle
                checked={createState.enabled}
                label="Enabled"
                onChange={() =>
                  setCreateState({ ...createState, enabled: !createState.enabled })
                }
              />
              <Toggle
                checked={createState.preauthRequired}
                label="Preauth required"
                onChange={() =>
                  setCreateState({
                    ...createState,
                    preauthRequired: !createState.preauthRequired,
                  })
                }
              />
            </div>
          </Field>
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>
            Allowed visit modes
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {VISIT_MODES.map((mode) => (
              <SelectableChip
                key={mode}
                selected={createState.allowedVisitModes.includes(mode)}
                label={mode}
                onClick={() =>
                  toggleVisitMode(createState, setCreateState, mode)
                }
              />
            ))}
          </div>
        </div>

        <div style={{ marginTop: 18, display: "flex", gap: 12, alignItems: "center" }}>
          <button
            type="button"
            onClick={createRule}
            disabled={savingCreate}
            style={buttonStyle}
          >
            {savingCreate ? "Creating..." : "Create rule"}
          </button>
          <div style={{ opacity: 0.7, fontSize: 13 }}>
            Writes directly to the live coverage service rules API.
          </div>
        </div>
      </section>

      <section
        style={{
          background: "#121931",
          border: "1px solid #1f2a4d",
          borderRadius: 18,
          padding: 18,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Existing rules</h2>

        <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
          {rules.length === 0 ? (
            <div style={{ opacity: 0.72 }}>No service rules found for this plan yet.</div>
          ) : (
            rules.map((rule) => {
              const state = editStates[rule.id] || toEditor(rule);
              const tone = decisionTone(state.decision);

              return (
                <div
                  key={rule.id}
                  style={{
                    background: "#0f1730",
                    border: "1px solid #1f2a4d",
                    borderRadius: 16,
                    padding: 16,
                  }}
                >
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
                        <div style={{ fontWeight: 700, fontSize: 16 }}>
                          {state.serviceType}
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
                          {state.decision}
                        </span>
                        {!state.enabled ? (
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
                            disabled
                          </span>
                        ) : null}
                        {state.preauthRequired ? (
                          <span
                            style={{
                              fontSize: 12,
                              padding: "4px 10px",
                              borderRadius: 999,
                              background: "#3b2608",
                              border: "1px solid #92400e",
                              color: "#fde68a",
                            }}
                          >
                            preauth required
                          </span>
                        ) : null}
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                          gap: 12,
                          marginTop: 14,
                        }}
                      >
                        <Field label="Decision">
                          <select
                            value={state.decision}
                            onChange={(e) =>
                              updateEdit(rule.id, {
                                decision: e.target.value as RuleDecision,
                              })
                            }
                            style={inputStyle}
                          >
                            <option value="COVERED">COVERED</option>
                            <option value="REQUIRES_AUTHORIZATION">REQUIRES_AUTHORIZATION</option>
              <option value="NOT_COVERED">NOT_COVERED</option>
                            <option value="NOT_ELIGIBLE">NOT_ELIGIBLE</option>
                          </select>
                        </Field>

                        <Field label="Limit period">
                          <select
                            value={state.limitPeriod}
                            onChange={(e) =>
                              updateEdit(rule.id, { limitPeriod: e.target.value })
                            }
                            style={inputStyle}
                          >
                            <option value="">Not set</option>
                            {LIMIT_PERIODS.map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <Field label="Sponsor cap (minor)">
                          <input
                            value={state.sponsorCapMinor}
                            onChange={(e) =>
                              updateEdit(rule.id, {
                                sponsorCapMinor: e.target.value,
                              })
                            }
                            style={inputStyle}
                          />
                        </Field>

                        <Field label="Member co-pay fixed (minor)">
                          <input
                            value={state.memberCopayMinor}
                            onChange={(e) =>
                              updateEdit(rule.id, {
                                memberCopayMinor: e.target.value,
                              })
                            }
                            style={inputStyle}
                          />
                        </Field>

                        <Field label="Member co-pay %">
                          <input
                            value={state.memberCopayPercent}
                            onChange={(e) =>
                              updateEdit(rule.id, {
                                memberCopayPercent: e.target.value,
                              })
                            }
                            style={inputStyle}
                          />
                        </Field>

                        <Field label="Limit count">
                          <input
                            value={state.limitCount}
                            onChange={(e) =>
                              updateEdit(rule.id, { limitCount: e.target.value })
                            }
                            style={inputStyle}
                          />
                        </Field>

                        <Field label="Limit amount (minor)">
                          <input
                            value={state.limitMinor}
                            onChange={(e) =>
                              updateEdit(rule.id, { limitMinor: e.target.value })
                            }
                            style={inputStyle}
                          />
                        </Field>

                        <Field label="Flags">
                          <div
                            style={{
                              display: "flex",
                              gap: 16,
                              flexWrap: "wrap",
                              paddingTop: 10,
                            }}
                          >
                            <Toggle
                              checked={state.enabled}
                              label="Enabled"
                              onChange={() =>
                                updateEdit(rule.id, { enabled: !state.enabled })
                              }
                            />
                            <Toggle
                              checked={state.preauthRequired}
                              label="Preauth required"
                              onChange={() =>
                                updateEdit(rule.id, {
                                  preauthRequired: !state.preauthRequired,
                                })
                              }
                            />
                          </div>
                        </Field>
                      </div>

                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>
                          Allowed visit modes
                        </div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          {VISIT_MODES.map((mode) => (
                            <SelectableChip
                              key={mode}
                              selected={state.allowedVisitModes.includes(mode)}
                              label={mode}
                              onClick={() =>
                                toggleVisitMode(
                                  state,
                                  (next) => updateEdit(rule.id, next),
                                  mode
                                )
                              }
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: 10,
                      }}
                    >
                      <MiniMetric
                        label="Sponsor cap"
                        value={money(parseNullableInt(state.sponsorCapMinor), plan.currency || "ZAR")}
                      />
                      <MiniMetric
                        label="Fixed co-pay"
                        value={money(parseNullableInt(state.memberCopayMinor), plan.currency || "ZAR")}
                      />
                      <MiniMetric
                        label="Co-pay %"
                        value={parseNullableInt(state.memberCopayPercent) ?? 0}
                      />
                      <MiniMetric
                        label="Limit count"
                        value={parseNullableInt(state.limitCount) ?? "—"}
                      />
                      <MiniMetric
                        label="Limit amount"
                        value={money(parseNullableInt(state.limitMinor), plan.currency || "ZAR")}
                      />
                      <MiniMetric
                        label="Limit period"
                        value={state.limitPeriod || "—"}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => saveRule(rule.id)}
                      disabled={savingRuleId === rule.id}
                      style={buttonStyle}
                    >
                      {savingRuleId === rule.id ? "Saving..." : "Save changes"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setEditStates((prev) => ({
                          ...prev,
                          [rule.id]: toEditor(rule),
                        }))
                      }
                      disabled={savingRuleId === rule.id}
                      style={secondaryButtonStyle}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
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

const buttonStyle: React.CSSProperties = {
  background: "#2563eb",
  border: "1px solid #1d4ed8",
  color: "white",
  borderRadius: 12,
  padding: "12px 16px",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
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

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      style={{
        background: checked ? "#0f2a1f" : "#121931",
        border: `1px solid ${checked ? "#14532d" : "#334155"}`,
        color: checked ? "#bbf7d0" : "#d1d5db",
        borderRadius: 999,
        padding: "8px 12px",
        cursor: "pointer",
        fontSize: 13,
      }}
    >
      {label}: {checked ? "On" : "Off"}
    </button>
  );
}

function SelectableChip({
  selected,
  label,
  onClick,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: selected ? "#0c2238" : "#121931",
        border: `1px solid ${selected ? "#1d4ed8" : "#334155"}`,
        color: selected ? "#bfdbfe" : "#d1d5db",
        borderRadius: 999,
        padding: "8px 12px",
        cursor: "pointer",
        fontSize: 13,
      }}
    >
      {label}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
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

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: "#121931",
        border: "1px solid #1f2a4d",
        borderRadius: 12,
        padding: 10,
      }}
    >
      <div style={{ fontSize: 11, opacity: 0.68 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 15, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
