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

async function getCoveragePlans() {
  try {
    const res = await fetch(
      internalApiUrl("/api/coverage/plans").toString(),
      {
        cache: "no-store",
        headers: internalRequestHeaders(),
      },
    );

    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json.items) ? json.items : [];
  } catch {
    return [];
  }
}

async function getMembers() {
  try {
    const res = await fetch(
      internalApiUrl("/api/client-members").toString(),
      {
        cache: "no-store",
        headers: internalRequestHeaders(),
      },
    );

    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json.items) ? json.items : [];
  } catch {
    return [];
  }
}

type SearchParams = {
  patientId?: string;
  clientId?: string;
  clinicianId?: string;
  serviceType?: string;
  visitMode?: string;
  requestedAmountMinor?: string;
  authError?: string;
};

async function runPreflight(searchParams: SearchParams) {
  if (!searchParams.patientId || !searchParams.serviceType) {
    return null;
  }

  try {
    const res = await fetch(internalApiUrl("/api/coverage/preflight").toString(), {
      method: "POST",
      cache: "no-store",
      headers: internalRequestHeaders({
        "content-type": "application/json",
      }),
      body: JSON.stringify({
        patientId: searchParams.patientId,
        clientId: searchParams.clientId || undefined,
        clinicianId: searchParams.clinicianId || undefined,
        serviceType: searchParams.serviceType,
        visitMode: searchParams.visitMode || undefined,
        requestedAmountMinor: Number(searchParams.requestedAmountMinor || 0),
      }),
    });

    if (!res.ok) {
      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const json = await res.json().catch(() => null);

        return {
          ok: false,
          error: json?.error || "Failed to run preflight.",
        };
      }

      return {
        ok: false,
        error: `Preflight API returned HTTP ${res.status}. Please confirm the coverage preflight route is available.`,
      };
    }

    return await res.json();
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to run preflight.",
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

function decisionTone(decision?: string) {
  switch (String(decision || "").toUpperCase()) {
    case "COVERED":
      return { bg: "#0f2a1f", border: "#14532d", text: "#bbf7d0" };
    case "COVERED_WITH_COPAY":
      return { bg: "#0c2238", border: "#1d4ed8", text: "#bfdbfe" };
    case "REQUIRES_AUTHORIZATION":
      return { bg: "#3b2608", border: "#92400e", text: "#fde68a" };
    case "NOT_COVERED":
    case "NOT_ELIGIBLE":
      return { bg: "#3a1017", border: "#7f1d1d", text: "#fecaca" };
    default:
      return { bg: "#1f2937", border: "#374151", text: "#d1d5db" };
  }
}

function defaultScopeTypeForService(serviceType?: string) {
  switch (String(serviceType || "").toUpperCase()) {
    case "LAB_TEST":
      return "LAB_ORDER";
    case "PHLEB_DRAW":
      return "DRAW";
    case "PHARMACY_ITEM":
    case "PHARMACY_DISPENSING":
      return "ERX_ORDER";
    case "RIDER_DELIVERY":
      return "DELIVERY";
    case "DEVICE_PURCHASE":
    case "DEVICE_RENTAL":
    case "DEVICE_ASSIGNMENT":
    case "DEVICE_MAINTENANCE":
    case "DEVICE_SWAP":
      return "DEVICE_ORDER";
    default:
      return "ENCOUNTER";
  }
}

function preflightScopeId(searchParams: SearchParams) {
  return [
    "preflight",
    searchParams.patientId || "patient",
    searchParams.serviceType || "service",
    searchParams.requestedAmountMinor || "0",
  ]
    .join("-")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 120);
}

export default async function PreflightWorkbenchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [plans, members, result] = await Promise.all([
    getCoveragePlans(),
    getMembers(),
    runPreflight(searchParams),
  ]);

  const selectedMember = members.find(
    (m: any) => String(m.patientId || "") === String(searchParams.patientId || "")
  );

  const tone = decisionTone(result?.decision);

  return (
    <main style={{ padding: 32, maxWidth: 1380 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, letterSpacing: 1.5, opacity: 0.7, textTransform: "uppercase" }}>
          Coverage Operations
        </div>
        <h1 style={{ margin: "8px 0 8px", fontSize: 34 }}>Coverage Preflight</h1>
        <p style={{ margin: 0, opacity: 0.82 }}>
          Eligibility, benefit rule, co-pay, uncovered gap, and pre-authorisation preview before service delivery or claim creation.
        </p>
      </div>

      {searchParams.authError ? (
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
          Could not create authorization: {searchParams.authError}
        </section>
      ) : null}

      <section
        style={{
          background: "#121931",
          border: "1px solid #1f2a4d",
          borderRadius: 18,
          padding: 20,
          marginBottom: 18,
        }}
      >
        <form method="GET" style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 14,
            }}
          >
            <Field label="Member / patient">
              <select
                name="patientId"
                defaultValue={searchParams.patientId || ""}
                style={inputStyle}
              >
                <option value="">Select member</option>
                {members.map((member: any) => (
                  <option key={member.id} value={member.patientId || ""}>
                    {member.memberNumber || member.employeeNumber || member.id}
                    {member.coveragePlan?.name ? ` · ${member.coveragePlan.name}` : ""}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Client">
              <select
                name="clientId"
                defaultValue={searchParams.clientId || ""}
                style={inputStyle}
              >
                <option value="">Auto-resolve from active member</option>
                {Array.from(
                  new Map(
                    members
                      .filter((m: any) => m.clientId)
                      .map((m: any) => [m.clientId, m])
                  ).values()
                ).map((member: any) => (
                  <option key={member.clientId} value={member.clientId}>
                    {member.clientProgram?.name || member.clientId}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Clinician ID">
              <input
                name="clinicianId"
                defaultValue={searchParams.clinicianId || ""}
                placeholder="Optional contract-aware clinician"
                style={inputStyle}
              />
            </Field>

            <Field label="Service type">
              <select
                name="serviceType"
                defaultValue={searchParams.serviceType || ""}
                style={inputStyle}
              >
                <option value="">Select service type</option>
                <option value="CONSULT_STANDARD">CONSULT_STANDARD</option>
                <option value="CONSULT_FOLLOWUP">CONSULT_FOLLOWUP</option>
                <option value="CONSULT_PROCEDURE">CONSULT_PROCEDURE</option>
                <option value="PHYSICAL_VISIT">PHYSICAL_VISIT</option>
                <option value="LAB_TEST">LAB_TEST</option>
                <option value="PHLEB_DRAW">PHLEB_DRAW</option>
                <option value="LAB_LOGISTICS">LAB_LOGISTICS</option>
                <option value="PHARMACY_ITEM">PHARMACY_ITEM</option>
                <option value="PHARMACY_DISPENSING">PHARMACY_DISPENSING</option>
                <option value="RIDER_DELIVERY">RIDER_DELIVERY</option>
                <option value="DEVICE_PURCHASE">DEVICE_PURCHASE</option>
                <option value="DEVICE_RENTAL">DEVICE_RENTAL</option>
                <option value="DEVICE_ASSIGNMENT">DEVICE_ASSIGNMENT</option>
                <option value="DEVICE_MAINTENANCE">DEVICE_MAINTENANCE</option>
                <option value="DEVICE_SWAP">DEVICE_SWAP</option>
              </select>
            </Field>

            <Field label="Visit mode">
              <select
                name="visitMode"
                defaultValue={searchParams.visitMode || ""}
                style={inputStyle}
              >
                <option value="">N/A</option>
                <option value="TELEVISIT">TELEVISIT</option>
                <option value="IN_PERSON">IN_PERSON</option>
                <option value="HYBRID">HYBRID</option>
              </select>
            </Field>

            <Field label="Requested amount (minor units)">
              <input
                name="requestedAmountMinor"
                defaultValue={searchParams.requestedAmountMinor || ""}
                placeholder="e.g. 65000"
                style={inputStyle}
              />
            </Field>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button type="submit" style={buttonStyle}>
              Run preflight
            </button>
            <div style={{ opacity: 0.7, fontSize: 13 }}>
              Uses live sponsor rules and active member linkage from the current coverage layer.
            </div>
          </div>
        </form>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 1fr",
          gap: 16,
        }}
      >
        <div
          style={{
            background: "#121931",
            border: "1px solid #1f2a4d",
            borderRadius: 16,
            padding: 18,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 0 }}>Input context</h2>

          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            <MiniMetric label="Selected member" value={selectedMember?.memberNumber || selectedMember?.employeeNumber || "—"} />
            <MiniMetric label="Plan" value={selectedMember?.coveragePlan?.name || "—"} />
            <MiniMetric label="Status" value={selectedMember?.memberStatus || "—"} />
            <MiniMetric label="Effective dates" value={`${selectedMember?.effectiveFrom ? new Date(selectedMember.effectiveFrom).toLocaleDateString() : "—"} → ${selectedMember?.effectiveTo ? new Date(selectedMember.effectiveTo).toLocaleDateString() : "—"}`} />
          </div>

          <div
            style={{
              marginTop: 16,
              background: "#0f1730",
              border: "1px solid #1f2a4d",
              borderRadius: 12,
              padding: 14,
              fontSize: 13,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Coverage plans in org</div>
            <div style={{ display: "grid", gap: 8 }}>
              {plans.length === 0 ? (
                <div style={{ opacity: 0.72 }}>No plans found.</div>
              ) : (
                plans.slice(0, 8).map((plan: any) => (
                  <div key={plan.id} style={{ opacity: 0.88 }}>
                    {plan.name} · {plan.status || "—"} · {plan.currency || "ZAR"}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#121931",
            border: "1px solid #1f2a4d",
            borderRadius: 16,
            padding: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ marginTop: 0, marginBottom: 0 }}>Adjudication preview</h2>
            {result?.decision ? (
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
                {result.decision}
              </span>
            ) : null}
          </div>

          {!result ? (
            <div style={{ opacity: 0.72, marginTop: 16 }}>
              Run preflight to see eligibility, sponsor liability, member liability, and authorization need.
            </div>
          ) : result.ok === false ? (
            <div style={{ opacity: 0.82, marginTop: 16 }}>
              {result.error || "Preflight failed."}
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 10,
                  marginTop: 16,
                }}
              >
                <MiniMetric label="Sponsor amount" value={money(result.sponsorAmountMinor, result.currency || "ZAR")} />
                <MiniMetric label="Patient co-pay" value={money(result.patientCopayMinor, result.currency || "ZAR")} />
                <MiniMetric label="Uncovered gap" value={money(result.uncoveredGapMinor, result.currency || "ZAR")} />
                <MiniMetric label="Authorization required" value={result.authorizationRequired ? "Yes" : "No"} />
                <MiniMetric label="Client member" value={result.clientMemberId || "—"} />
                <MiniMetric label="Coverage plan" value={result.coveragePlanId || "—"} />
              </div>

              <div
                style={{
                  marginTop: 16,
                  background: "#0f1730",
                  border: "1px solid #1f2a4d",
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Decision rationale</div>
                <div style={{ opacity: 0.9 }}>{result.reason || "—"}</div>
              </div>

              {result.authorizationRequired &&
              result.clientId &&
              result.clientMemberId &&
              result.coveragePlanId ? (
                <form
                  method="POST"
                  action="/api/preflight/create-authorization"
                  style={{
                    marginTop: 16,
                    background: "#0f1730",
                    border: "1px solid #1f2a4d",
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 13,
                  }}
                >
                  <input type="hidden" name="patientId" value={searchParams.patientId || ""} />
                  <input type="hidden" name="clientId" value={result.clientId || searchParams.clientId || ""} />
                  <input type="hidden" name="clinicianId" value={searchParams.clinicianId || ""} />
                  <input type="hidden" name="serviceType" value={searchParams.serviceType || ""} />
                  <input type="hidden" name="visitMode" value={searchParams.visitMode || ""} />
                  <input
                    type="hidden"
                    name="requestedAmountMinor"
                    value={searchParams.requestedAmountMinor || "0"}
                  />
                  <input
                    type="hidden"
                    name="scopeType"
                    value={defaultScopeTypeForService(searchParams.serviceType)}
                  />
                  <input
                    type="hidden"
                    name="scopeId"
                    value={preflightScopeId(searchParams)}
                  />

                  <div style={{ fontWeight: 700, marginBottom: 8 }}>
                    Authorization action
                  </div>

                  <div style={{ opacity: 0.82, lineHeight: 1.6, marginBottom: 12 }}>
                    This preflight requires pre-authorisation. Use the authorization queue to review,
                    approve, partially approve, deny, or consume the corresponding authorization.
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      gap: 10,
                      marginBottom: 12,
                    }}
                  >
                    <MiniMetric label="Client" value={result.clientId || "—"} />
                    <MiniMetric label="Client member" value={result.clientMemberId || "—"} />
                    <MiniMetric label="Scope" value={defaultScopeTypeForService(searchParams.serviceType)} />
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <a
                      href="/authorizations"
                      style={{
                        background: "#2563eb",
                        border: "1px solid #1d4ed8",
                        color: "white",
                        borderRadius: 12,
                        padding: "12px 16px",
                        fontWeight: 700,
                        textDecoration: "none",
                      }}
                    >
                      Open authorization queue
                    </a>
                  </div>
                </form>
              ) : result.authorizationRequired ? (
                <div
                  style={{
                    marginTop: 16,
                    background: "#3b2608",
                    border: "1px solid #92400e",
                    color: "#fde68a",
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 13,
                  }}
                >
                  Authorization is required, but the preflight response is missing client,
                  member, or plan context. Re-check member linkage and coverage plan setup.
                </div>
              ) : null}

              <div
                style={{
                  marginTop: 16,
                  background: "#0f1730",
                  border: "1px solid #1f2a4d",
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Rule snapshot</div>
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontSize: 12,
                    opacity: 0.84,
                  }}
                >
                  {JSON.stringify(result.ruleSnapshot || null, null, 2)}
                </pre>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0f1730",
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

function MiniMetric({ label, value }: { label: string; value: string | number }) {
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