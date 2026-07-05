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

async function getBillableEvents() {
  try {
    const session = clientSession();

    if (!session?.orgId) {
      return [];
    }

    const res = await fetch(
      internalApiUrl("/api/billing/events", {
        clientId: session.clientId || undefined,
        take: 500,
      }).toString(),
      {
        cache: "no-store",
        headers: internalRequestHeaders(),
      },
    );

    if (!res.ok) return [];

    const json = await res.json().catch(() => null);
    const items = Array.isArray(json?.items) ? json.items : [];

    return items.filter((x: any) =>
      ["PHLEB_DRAW","LAB_TEST","LAB_LOGISTICS"].includes(
        String(x.serviceType || "").toUpperCase()
      )
    );
  } catch {
    return [];
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

function asObject(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
}

function statusTone(status?: string) {
  switch (String(status || "").toUpperCase()) {
    case "READY":
    case "CLAIMED":
      return { bg: "#3b2608", border: "#92400e", text: "#fde68a" };
    case "SETTLED":
    case "PAID":
    case "COMPLETED":
      return { bg: "#0f2a1f", border: "#14532d", text: "#bbf7d0" };
    case "FAILED":
    case "CANCELLED":
    case "REJECTED":
      return { bg: "#3a1017", border: "#7f1d1d", text: "#fecaca" };
    default:
      return { bg: "#1f2937", border: "#374151", text: "#d1d5db" };
  }
}

function serviceLabel(value?: string | null) {
  return String(value || "SERVICE").replaceAll("_", " ");
}

export default async function MedReachPage() {
  const items = await getBillableEvents();

  const labTests = items.filter(
    (x: any) => String(x.serviceType || "").toUpperCase() === "LAB_TEST"
  );

  const phlebDraws = items.filter(
    (x: any) => String(x.serviceType || "").toUpperCase() === "PHLEB_DRAW"
  );

  const logistics = items.filter(
    (x: any) => String(x.serviceType || "").toUpperCase() === "LAB_LOGISTICS"
  );

  const grossMinor = items.reduce(
    (sum: number, x: any) => sum + Number(x.grossAmountMinor || 0),
    0
  );

  const sponsorMinor = items.reduce(
    (sum: number, x: any) => sum + Number(x.sponsorAmountMinor || 0),
    0
  );

  const patientMinor = items.reduce(
    (sum: number, x: any) => sum + Number(x.patientAmountMinor || 0),
    0
  );

  const readyForSettlement = items.filter((x: any) =>
    ["READY", "CLAIMED"].includes(String(x.status || "").toUpperCase())
  ).length;

  const settled = items.filter((x: any) =>
    ["SETTLED", "PAID", "COMPLETED"].includes(String(x.status || "").toUpperCase())
  ).length;

  return (
    <main style={{ padding: 32, maxWidth: 1480 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={eyebrow}>MedReach Operations</div>
        <h1 style={{ margin: "8px 0 8px", fontSize: 34 }}>MedReach</h1>
        <p style={{ opacity: 0.82, margin: 0 }}>
          Sponsor-paid pathology, phlebotomy draw coverage, specimen logistics,
          pre-authorisation linkage, patient liability, and settlement readiness.
        </p>
      </div>

      <section style={metricGrid}>
        <Metric label="MedReach events" value={items.length} sub={`${labTests.length} lab · ${phlebDraws.length} draw · ${logistics.length} logistics`} />
        <Metric label="Gross value" value={money(grossMinor)} sub="Lab + phleb + logistics" />
        <Metric label="Sponsor liability" value={money(sponsorMinor)} sub={`Patient co-pay ${money(patientMinor)}`} />
        <Metric label="Ready for settlement" value={readyForSettlement} sub={`${settled} already settled`} />
      </section>

      <section style={{ ...card, marginTop: 20 }}>
        <h2 style={{ marginTop: 0 }}>MedReach payer posture</h2>
        <div style={{ opacity: 0.82, lineHeight: 1.7 }}>
          MedReach links diagnostic service requests, pathology coverage, phlebotomy
          draw logistics, specimen movement, sponsor liability, member co-pay and
          settlement readiness. For Medical Aid operations, this creates visibility
          from lab pre-authorisation through claims and provider payment.
        </div>
      </section>

      <section style={{ display: "grid", gap: 14, marginTop: 20 }}>
        {items.length === 0 ? (
          <div style={{ opacity: 0.72 }}>
            No MedReach billable events found yet. Lab, phlebotomy and specimen-logistics billable events will appear here once generated for this payer.
          </div>
        ) : (
          items.map((item: any) => {
            const tone = statusTone(item.status);
            const metadata = asObject(item.metadata);
            const currency = item.currency || "ZAR";

            return (
              <article key={item.id} style={card}>
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
                      <strong style={{ fontSize: 18 }}>{serviceLabel(item.serviceType)}</strong>
                      <span style={mutedPill}>{item.providerLane || "LAB"}</span>
                      {item.providerId ? <span style={mutedPill}>{item.providerId}</span> : null}
                      <span
                        style={{
                          ...pill,
                          background: tone.bg,
                          borderColor: tone.border,
                          color: tone.text,
                        }}
                      >
                        {item.status || "UNKNOWN"}
                      </span>
                    </div>

                    <div style={{ opacity: 0.72, fontSize: 13, marginTop: 8 }}>
                      Draw: {item.drawId || metadata.drawId || "—"} · Lab order:{" "}
                      {item.labOrderId || metadata.labOrderId || "—"} · Claim:{" "}
                      {item.clientClaimId || metadata.claimId || "—"} · Created:{" "}
                      {fmtDate(item.createdAt)}
                    </div>

                    <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                      <InfoLine label="Client member" value={item.clientMemberId || metadata.clientMemberId || "—"} />
                      <InfoLine label="Coverage plan" value={item.coveragePlanId || metadata.coveragePlanId || "—"} />
                      <InfoLine label="Authorization" value={item.coverageAuthorizationId || metadata.authorizationId || "—"} />
                      <InfoLine label="Diagnostic lane" value={metadata.diagnosticLane || item.providerLane || "Pathology / logistics"} />
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                      <Flag label="Sponsor-paid" active={Number(item.sponsorAmountMinor || 0) > 0} />
                      <Flag label="Patient co-pay" active={Number(item.patientAmountMinor || 0) > 0} />
                      <Flag label="Settlement-ready" active={["READY", "CLAIMED"].includes(String(item.status || "").toUpperCase())} />
                      <Flag label="Settled" active={["SETTLED", "PAID", "COMPLETED"].includes(String(item.status || "").toUpperCase())} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    <Mini label="Gross" value={money(item.grossAmountMinor, currency)} />
                    <Mini label="Sponsor" value={money(item.sponsorAmountMinor, currency)} />
                    <Mini label="Patient" value={money(item.patientAmountMinor, currency)} />
                    <Mini label="Provider amount" value={money(item.providerAmountMinor, currency)} />
                    <Mini label="Platform amount" value={money(item.platformAmountMinor, currency)} />
                  </div>
                </div>
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