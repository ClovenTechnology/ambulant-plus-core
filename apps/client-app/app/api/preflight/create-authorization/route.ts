import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SessionPayload = {
  uid?: string | null;
  userId?: string | null;
  id?: string | null;
  sub?: string | null;
  orgId?: string | null;
  email?: string | null;
};

function requiredApigwBase() {
  const value = String(
    process.env.APIGW_BASE ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      "",
  )
    .trim()
    .replace(/\/+$/, "");

  if (!value) {
    const err = new Error("APIGW_BASE_required") as Error & { status?: number };
    err.status = 503;
    throw err;
  }

  return value;
}

function safeParseSession(value: string | undefined): SessionPayload | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function sessionUserId(session: SessionPayload | null) {
  return (
    String(
      session?.uid ||
        session?.userId ||
        session?.id ||
        session?.sub ||
        session?.email ||
        "",
    ).trim() || null
  );
}

function backToPreflight(req: NextRequest, params: URLSearchParams, error: string) {
  const url = new URL("/preflight", req.url);
  params.set("authError", error);
  url.search = params.toString();
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(req: NextRequest) {
  const session = safeParseSession(
    req.cookies.get("ambulant_client_session")?.value,
  );

  const actorUserId = sessionUserId(session);

  if (!actorUserId) {
    return NextResponse.redirect(new URL("/auth/login", req.url), { status: 303 });
  }

  const form = await req.formData();
  const originalParams = new URLSearchParams();

  const orgId = String(session?.orgId || "").trim();
  const patientId = String(form.get("patientId") || "").trim();
  const clientId = String(form.get("clientId") || "").trim();
  const clinicianId = String(form.get("clinicianId") || "").trim();
  const serviceType = String(form.get("serviceType") || "").trim();
  const visitMode = String(form.get("visitMode") || "").trim();
  const requestedAmountMinor = String(form.get("requestedAmountMinor") || "0").trim();
  const scopeType = String(form.get("scopeType") || "").trim();
  const scopeId = String(form.get("scopeId") || "").trim();

  if (patientId) originalParams.set("patientId", patientId);
  if (clientId) originalParams.set("clientId", clientId);
  if (clinicianId) originalParams.set("clinicianId", clinicianId);
  if (serviceType) originalParams.set("serviceType", serviceType);
  if (visitMode) originalParams.set("visitMode", visitMode);
  if (requestedAmountMinor) originalParams.set("requestedAmountMinor", requestedAmountMinor);

  if (!orgId) {
    return backToPreflight(req, originalParams, "client_org_context_required");
  }

  try {
    const res = await fetch(`${requiredApigwBase()}/api/coverage/preflight/authorize`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-idempotency-key": [
          "preflight-authorize",
          patientId,
          serviceType,
          requestedAmountMinor,
          scopeType,
          scopeId,
        ]
          .join(":")
          .replace(/\s+/g, "-"),
        "x-ambulant-user-id": actorUserId,
        "x-ambulant-org-id": orgId,
      },
      body: JSON.stringify({
        orgId,
        patientId,
        clientId: clientId || undefined,
        clinicianId: clinicianId || undefined,
        serviceType,
        visitMode: visitMode || undefined,
        requestedAmountMinor: Number(requestedAmountMinor || 0),
        scopeType: scopeType || undefined,
        scopeId: scopeId || undefined,
        requestedByUserId: actorUserId,
      }),
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || json?.ok === false) {
      return backToPreflight(
        req,
        originalParams,
        json?.error || "authorization_create_failed",
      );
    }

    const url = new URL("/authorizations", req.url);

    if (json?.item?.id) {
      url.searchParams.set("created", json.item.id);
    }

    if (json?.duplicate) {
      url.searchParams.set("duplicate", "1");
    }

    return NextResponse.redirect(url, { status: 303 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "authorization_create_failed";

    return backToPreflight(req, originalParams, message);
  }
}
