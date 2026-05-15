import Link from "next/link";
import { cookies } from "next/headers";
import type { CSSProperties } from "react";

const ORG_ID = "org-default";
const DEFAULT_CLIENT_ID = "client-demo-medical-aid";

type SessionPayload = {
  uid?: string | null;
  email?: string | null;
  orgId?: string | null;
  role?: string | null;
  workspace?: string | null;
};

type ProviderRow = {
  key: string;
  id?: string | null;
  providerLane?: string | null;
  providerType?: string | null;
  providerId?: string | null;

  name?: string | null;
  legalName?: string | null;
  tradingName?: string | null;
  displayName?: string | null;
  discipline?: string | null;
  practiceName?: string | null;
  practiceNumber?: string | null;
  providerCode?: string | null;

  networkStatus?: string | null;
  dspStatus?: string | null;
  contractStatus?: string | null;
  credentialingStatus?: string | null;
  bankVerificationStatus?: string | null;
  riskStatus?: string | null;

  claimsEnabled?: boolean;
  settlementEnabled?: boolean;
  directSettlementEnabled?: boolean;

  acceptedSchemes?: string[];
  blockers?: string[];
  riskFlags?: string[];

  claimsCount?: number;
  submittedAmountMinor?: number;
  approvedAmountMinor?: number;
  paidAmountMinor?: number;

  settlementGrossMinor?: number;
  settlementNetMinor?: number;
  settlementLineCount?: number;
  latestSettlementAt?: string | null;

  source?: string | null;
};

function readSession(): SessionPayload | null {
  const raw = cookies().get("ambulant_client_session")?.value;

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function authHeaders() {
  const session = readSession();

  const headers: Record<string, string> = {
    "x-ambulant-trusted": "client-app-proxy",
    "x-ambulant-org-id": session?.orgId || ORG_ID,
    "x-ambulant-workspace": session?.workspace || "payer_ops",
    "x-ambulant-role": session?.role || "ORG_OWNER",
    "x-ambulant-user-id": session?.uid || session?.email || "admin@medicalaid.demo",
  };

  return headers;
}


function apiBase() {
  return (
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.APIGW_BASE ||
    "http://localhost:3010"
  );
}

function clientId() {
  return process.env.NEXT_PUBLIC_DEFAULT_CLIENT_ID || DEFAULT_CLIENT_ID;
}

async function safeJson(url: string, headers?: Record<string, string>) {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers,
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

async function getClinicians() {
  const json = await safeJson(
    `${apiBase()}/api/clinicians?country=ZA&page=1&perPage=100`
  );

  return Array.isArray(json?.items)
    ? json.items
    : Array.isArray(json?.clinicians)
    ? json.clinicians
    : [];
}

async function getSettlementProviders() {
  const json = await safeJson(
    `${apiBase()}/api/settlements/providers?orgId=${encodeURIComponent(
      ORG_ID
    )}&clientId=${encodeURIComponent(clientId())}`
  );

  return {
    items: Array.isArray(json?.items) ? json.items : [],
    summary: json?.summary || {},
  };
}

async function getClaims() {
  const json = await safeJson(
    `${apiBase()}/api/claims?orgId=${encodeURIComponent(
      ORG_ID
    )}&clientId=${encodeURIComponent(clientId())}&take=100`
  );

  return Array.isArray(json?.items) ? json.items : [];
}

async function getProviderNetwork(): Promise<{
  items: ProviderRow[];
  summary: Record<string, unknown>;
}> {
  const json = await safeJson(
    `${apiBase()}/api/provider-network?orgId=${encodeURIComponent(
      ORG_ID
    )}&clientId=${encodeURIComponent(clientId())}`,
    authHeaders()
  );

  return {
    items: Array.isArray(json?.items) ? (json.items as ProviderRow[]) : [],
    summary: json?.summary || {},
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

function laneLabel(value?: string | null) {
  return String(value || "UNKNOWN").replaceAll("_", " ");
}

function serviceToLane(value?: string | null) {
  const s = String(value || "").toUpperCase();

  if (s.includes("PHARMACY") || s.includes("ERX")) return "PHARMACY";
  if (s.includes("LAB") || s.includes("PATHOLOGY")) return "LAB";
  if (s.includes("PHLEB")) return "PHLEB";
  if (s.includes("RIDER") || s.includes("DELIVERY")) return "RIDER";
  if (s.includes("CONSULT") || s.includes("VISIT") || s.includes("APPOINTMENT")) {
    return "CLINICIAN";
  }

  return "OTHER";
}

function normalizeProviderKey(lane?: string | null, providerId?: string | null) {
  return `${String(lane || "UNKNOWN").toUpperCase()}::${String(
    providerId || "unknown"
  )}`;
}

function providerTone(status?: string | null) {
  switch (String(status || "").toUpperCase()) {
    case "ACTIVE":
    case "CONTRACTED":
    case "PREFERRED":
    case "DSP":
      return { bg: "#0f2a1f", border: "#14532d", text: "#bbf7d0" };
    case "PENDING":
    case "PROVISIONAL":
    case "REVIEW":
      return { bg: "#3b2608", border: "#92400e", text: "#fde68a" };
    case "SUSPENDED":
    case "BLOCKED":
    case "EXPIRED":
      return { bg: "#3a1017", border: "#7f1d1d", text: "#fecaca" };
    default:
      return { bg: "#1f2937", border: "#374151", text: "#d1d5db" };
  }
}

function extractPracticeNumber(item: any) {
  const meta = asObject(item?.meta);

  return (
    item?.practiceNumber ||
    item?.practiceNo ||
    item?.hpcsaPracticeNumber ||
    item?.hpcsaRegNo ||
    item?.regulatorRegistration ||
    meta.practiceNumber ||
    meta.practiceNo ||
    meta.hpcsaPracticeNumber ||
    meta.hpcsaRegNo ||
    meta.regulatorRegistration ||
    item?.operational?.ambulantId ||
    null
  );
}

function claimAmounts(claim: any) {
  const submitted =
    claim?.submittedAmountMinor ??
    claim?.totalSubmittedMinor ??
    claim?.amountSubmittedMinor ??
    claim?.submittedMinor ??
    claim?.amountMinor ??
    0;

  const approved =
    claim?.approvedAmountMinor ??
    claim?.totalApprovedMinor ??
    claim?.amountApprovedMinor ??
    claim?.approvedMinor ??
    0;

  const paid =
    claim?.paidAmountMinor ??
    claim?.totalPaidMinor ??
    claim?.amountPaidMinor ??
    claim?.paidMinor ??
    0;

  return {
    submitted: Number(submitted || 0),
    approved: Number(approved || 0),
    paid: Number(paid || 0),
  };
}

function claimProviderKeys(claim: any) {
  const keys = new Set<string>();
  const lines = asArray(claim?.lines || claim?.claimLines || claim?.items);

  if (lines.length > 0) {
    for (const line of lines) {
      const lane =
        line.providerLane ||
        line.providerType ||
        line.lane ||
        serviceToLane(line.serviceType || line.scope || claim?.serviceType);

      const providerId =
        line.providerId ||
        line.provider?.id ||
        line.providerCode ||
        line.practiceNumber ||
        line.providerName ||
        null;

      keys.add(normalizeProviderKey(lane, providerId));
    }
  }

  const payload = asObject(claim?.submissionPayload);
  const response = asObject(claim?.responsePayload);
  const meta = asObject(claim?.metadata);

  const lane =
    payload.providerLane ||
    response.providerLane ||
    meta.providerLane ||
    serviceToLane(
      claim?.serviceType ||
        claim?.scope ||
        payload.serviceType ||
        response.serviceType ||
        meta.serviceType
    );

  const providerId =
    payload.providerId ||
    payload.providerCode ||
    payload.providerName ||
    payload.practiceNumber ||
    response.providerId ||
    response.providerCode ||
    response.providerName ||
    response.practiceNumber ||
    meta.providerId ||
    meta.providerCode ||
    meta.providerName ||
    meta.practiceNumber ||
    null;

  keys.add(normalizeProviderKey(String(lane), providerId ? String(providerId) : null));

  return Array.from(keys);
}

function buildProviderRows({
  clinicians,
  settlements,
  claims,
}: {
  clinicians: any[];
  settlements: any[];
  claims: any[];
}): ProviderRow[] {
  const map = new Map<string, ProviderRow>();

  for (const clinician of clinicians) {
    const id = String(clinician.id || clinician.userId || clinician.clinicianId || "");
    const key = normalizeProviderKey("CLINICIAN", id || clinician.name);

    const acceptedSchemes = asArray(clinician.acceptedSchemes);
    const blockers = asArray(clinician.operational?.blockers);
    const riskFlags = asArray(clinician.operational?.riskFlags);
    const practiceNumber = extractPracticeNumber(clinician);

    map.set(key, {
      key,
      providerLane: "CLINICIAN",
      providerId: id || clinician.name || "unknown",
      name: clinician.name || clinician.displayName || "Unnamed clinician",
      discipline: clinician.specialty || clinician.cls || "Clinical provider",
      practiceName: clinician.practiceName || clinician.meta?.practiceName || null,
      practiceNumber,
      networkStatus: clinician.acceptsMedicalAid ? "PREFERRED" : "OUT_OF_NETWORK",
      dspStatus: clinician.acceptsMedicalAid ? "DSP_ELIGIBLE" : "NOT_DSP",
      contractStatus: clinician.operational?.canBeBooked ? "ACTIVE" : "REVIEW",
      claimsEnabled: Boolean(clinician.acceptsMedicalAid || practiceNumber),
      settlementEnabled: false,
      acceptedSchemes,
      blockers,
      riskFlags,
      claimsCount: 0,
      submittedAmountMinor: 0,
      approvedAmountMinor: 0,
      paidAmountMinor: 0,
      settlementGrossMinor: 0,
      settlementNetMinor: 0,
      settlementLineCount: 0,
      latestSettlementAt: null,
      source: "clinicians",
    });
  }

  for (const settlement of settlements) {
    const lane = String(settlement.providerLane || "UNKNOWN").toUpperCase();
    const providerId = String(settlement.providerId || "unknown");
    const key = normalizeProviderKey(lane, providerId);

    const current =
      map.get(key) ||
      {
        key,
        providerLane: lane,
        providerId,
        name: providerId,
        discipline: laneLabel(lane),
        practiceName: null,
        practiceNumber: providerId,
        networkStatus: lane === "CLINICIAN" ? "PREFERRED" : "CONTRACTED",
        dspStatus:
          lane === "PHARMACY" || lane === "LAB" ? "DSP_ELIGIBLE" : "NETWORK_ELIGIBLE",
        contractStatus: "ACTIVE",
        claimsEnabled: true,
        settlementEnabled: true,
        acceptedSchemes: [],
        blockers: [],
        riskFlags: [],
        claimsCount: 0,
        submittedAmountMinor: 0,
        approvedAmountMinor: 0,
        paidAmountMinor: 0,
        settlementGrossMinor: 0,
        settlementNetMinor: 0,
        settlementLineCount: 0,
        latestSettlementAt: null,
        source: "settlements",
      };

    current.settlementEnabled = true;
    current.settlementGrossMinor =
      Number(current.settlementGrossMinor || 0) +
      Number(settlement.grossAmountMinor || 0);
    current.settlementNetMinor =
      Number(current.settlementNetMinor || 0) +
      Number(settlement.netAmountMinor || 0);
    current.settlementLineCount =
      Number(current.settlementLineCount || 0) +
      Number(settlement.lineCount || 0);
    current.latestSettlementAt =
      settlement.latestLineAt || current.latestSettlementAt || null;

    map.set(key, current);
  }

  for (const claim of claims) {
    const amounts = claimAmounts(claim);
    const keys = claimProviderKeys(claim);

    for (const key of keys) {
      const [lane, providerId] = key.split("::");
      const current =
        map.get(key) ||
        {
          key,
          providerLane: lane,
          providerId,
          name: providerId,
          discipline: laneLabel(lane),
          practiceName: null,
          practiceNumber: providerId !== "unknown" ? providerId : null,
          networkStatus: "CLAIMS_SEEN",
          dspStatus: lane === "PHARMACY" || lane === "LAB" ? "DSP_REVIEW" : "NETWORK_REVIEW",
          contractStatus: "REVIEW",
          claimsEnabled: true,
          settlementEnabled: false,
          acceptedSchemes: [],
          blockers: [],
          riskFlags: [],
          claimsCount: 0,
          submittedAmountMinor: 0,
          approvedAmountMinor: 0,
          paidAmountMinor: 0,
          settlementGrossMinor: 0,
          settlementNetMinor: 0,
          settlementLineCount: 0,
          latestSettlementAt: null,
          source: "claims",
        };

      current.claimsEnabled = true;
      current.claimsCount = Number(current.claimsCount || 0) + 1;
      current.submittedAmountMinor =
        Number(current.submittedAmountMinor || 0) + amounts.submitted;
      current.approvedAmountMinor =
        Number(current.approvedAmountMinor || 0) + amounts.approved;
      current.paidAmountMinor =
        Number(current.paidAmountMinor || 0) + amounts.paid;

      map.set(key, current);
    }
  }

  return Array.from(map.values()).sort((a: ProviderRow, b: ProviderRow) => {
    const laneA = String(a.providerLane || "");
    const laneB = String(b.providerLane || "");
    if (laneA !== laneB) return laneA.localeCompare(laneB);
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

export default async function ProvidersPage() {
  const [providerNetwork, clinicians, settlementData, claims] = await Promise.all([
    getProviderNetwork(),
    getClinicians(),
    getSettlementProviders(),
    getClaims(),
  ]);

  const inferredRows = buildProviderRows({
    clinicians,
    settlements: settlementData.items,
    claims,
  });

  const rows: ProviderRow[] =
    providerNetwork.items.length > 0 ? providerNetwork.items : inferredRows;

  const contracted = rows.filter((x) =>
    ["ACTIVE", "CONTRACTED", "PREFERRED"].includes(String(x.contractStatus || ""))
  );

  const dspEligible = rows.filter((x) =>
    String(x.dspStatus || "").includes("DSP")
  );

  const claimsEnabled = rows.filter((x) => x.claimsEnabled);
  const settlementEnabled = rows.filter((x) => x.settlementEnabled);
  const missingPractice = rows.filter((x) => !x.practiceNumber);

  const netSettlementMinor = rows.reduce(
    (sum, x) => sum + Number(x.settlementNetMinor || 0),
    0
  );

  const approvedClaimsMinor = rows.reduce(
    (sum, x) => sum + Number(x.approvedAmountMinor || 0),
    0
  );

  return (
    <main style={{ padding: 32, maxWidth: 1480 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={eyebrow}>Provider Network Operations</div>
        <h1 style={{ margin: "8px 0 8px", fontSize: 34 }}>Providers</h1>
        <p style={{ opacity: 0.82, margin: 0 }}>
          Practice, network, DSP, contract, claims, and settlement readiness across
          clinician, pharmacy, lab, phlebotomy, rider and platform lanes.
        </p>
      </div>

      <section style={metricGrid}>
        <Metric label="Provider groups" value={rows.length} sub="Across all operational lanes" />
        <Metric label="Contracted / active" value={contracted.length} sub={`${dspEligible.length} DSP/network eligible`} />
        <Metric label="Claims-enabled" value={claimsEnabled.length} sub={money(approvedClaimsMinor)} />
        <Metric label="Settlement-enabled" value={settlementEnabled.length} sub={money(netSettlementMinor)} />
        <Metric label="Missing practice number" value={missingPractice.length} sub="Needs credentialing follow-up" />
      </section>

      <section style={{ ...card, marginTop: 20 }}>
        <h2 style={{ marginTop: 0 }}>Scheme-grade provider validation posture</h2>
        <div style={{ opacity: 0.82, lineHeight: 1.7 }}>
          Provider identity must be validated before serious preflight, claims, remittance,
          or settlement decisions. For Medical Aid operations, the important handles are
          practice number, provider lane, DSP/network status, contract status, claim eligibility,
          settlement enablement, and audit-ready linkage to authorisations, claims and payment
          records.
        </div>
      </section>

      <section style={{ display: "grid", gap: 14, marginTop: 20 }}>
        {rows.length === 0 ? (
          <div style={{ opacity: 0.72 }}>
            No provider records found yet. Seed clinicians, claims, or settlement records first.
          </div>
        ) : (
          rows.map((row) => {
            const contractTone = providerTone(row.contractStatus);
            const networkTone = providerTone(row.networkStatus);
            const dspTone = providerTone(row.dspStatus);

            return (
              <article key={row.key} style={card}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 1fr",
                    gap: 18,
                    alignItems: "start",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <strong style={{ fontSize: 18 }}>{row.name}</strong>
                      <span style={mutedPill}>{laneLabel(row.providerLane)}</span>
                      <span
                        style={{
                          ...pill,
                          background: contractTone.bg,
                          borderColor: contractTone.border,
                          color: contractTone.text,
                        }}
                      >
                        {row.contractStatus}
                      </span>
                      <span
                        style={{
                          ...pill,
                          background: networkTone.bg,
                          borderColor: networkTone.border,
                          color: networkTone.text,
                        }}
                      >
                        {row.networkStatus}
                      </span>
                      <span
                        style={{
                          ...pill,
                          background: dspTone.bg,
                          borderColor: dspTone.border,
                          color: dspTone.text,
                        }}
                      >
                        {row.dspStatus}
                      </span>
                    </div>

                    <div style={{ opacity: 0.72, fontSize: 13, marginTop: 8 }}>
                      Provider ID: {row.providerId || "—"} · Discipline: {row.discipline || "—"} ·
                      Practice: {row.practiceName || "—"}
                    </div>

                    <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                      <InfoLine label="Practice number / code" value={row.practiceNumber || "Missing"} />
                      <InfoLine
                        label="Accepted schemes"
                        value={
                          row.acceptedSchemes?.length
                            ? row.acceptedSchemes.join(", ")
                            : "Not declared"
                        }
                      />
                      <InfoLine
                        label="Operational blockers"
                        value={row.blockers?.length ? row.blockers.join(", ") : "None"}
                      />
                      <InfoLine
                        label="Risk flags"
                        value={row.riskFlags?.length ? row.riskFlags.join(", ") : "None"}
                      />
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                      <Flag label="Claims enabled" active={Boolean(row.claimsEnabled)} />
                      <Flag label="Settlement enabled" active={Boolean(row.settlementEnabled)} />
                      <Flag label="Practice number" active={Boolean(row.practiceNumber)} />
                      <Flag label="Medical Aid ready" active={Boolean(row.claimsEnabled && row.practiceNumber)} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    <Mini label="Claims count" value={row.claimsCount || 0} />
                    <Mini label="Submitted claims" value={money(row.submittedAmountMinor)} />
                    <Mini label="Approved claims" value={money(row.approvedAmountMinor)} />
                    <Mini label="Paid claims" value={money(row.paidAmountMinor)} />
                    <Mini label="Settlement net" value={money(row.settlementNetMinor)} />
                    <Mini label="Settlement lines" value={row.settlementLineCount || 0} />
                    <Mini label="Latest settlement" value={fmtDate(row.latestSettlementAt)} />
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>

      <section style={{ ...card, marginTop: 20 }}>
        <h2 style={{ marginTop: 0 }}>Next production hardening</h2>
        <div style={{ opacity: 0.82, lineHeight: 1.7 }}>
          The provider-network registry is now backed by dedicated provider-network records.
          The next hardening step is to expand each record with credential document uploads,
          verified banking workflows, DSP contract packs, scheme-specific provider rules,
          provider search/filter pagination, and audit-linked provider change history.
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

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={contextBox}>
      <span style={{ opacity: 0.68 }}>{label}: </span>
      <strong>{value}</strong>
    </div>
  );
}

function Flag({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      style={{
        ...pill,
        background: active ? "#0f2a1f" : "#1f2937",
        borderColor: active ? "#14532d" : "#374151",
        color: active ? "#bbf7d0" : "#d1d5db",
      }}
    >
      {label}: {active ? "Yes" : "No"}
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