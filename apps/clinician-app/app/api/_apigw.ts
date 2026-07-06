import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function apigwBase(): string {
  const value = String(process.env.APIGW_BASE || "").trim();

  if (!value) {
    const err = new Error("APIGW_BASE_required") as Error & { status?: number };
    err.status = 503;
    throw err;
  }

  return value.replace(/\/+$/, "");
}

export function jsonError(error: unknown, defaultError = "request_failed", status = 500) {
  const message = error instanceof Error ? error.message : defaultError;
  const resolvedStatus =
    typeof (error as any)?.status === "number" ? (error as any).status : status;

  return NextResponse.json(
    { ok: false, error: message },
    { status: resolvedStatus, headers: { "cache-control": "no-store" } },
  );
}

export async function relayJsonResponse(res: Response) {
  const text = await res.text().catch(() => "");
  let payload: unknown = {};

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { ok: false, error: text };
    }
  }

  return NextResponse.json(payload, {
    status: res.status,
    headers: { "cache-control": "no-store" },
  });
}

export function forwardClinicianHeaders(req: Request) {
  const incoming = req.headers;
  const headers = new Headers();

  for (const key of [
    "authorization",
    "cookie",
    "x-ambulant-identity",
    "x-ambulant-user-id",
    "x-ambulant-org-id",
    "x-ambulant-role",
    "x-uid",
    "x-user-id",
    "x-org-id",
    "x-role",
    "x-correlation-id",
    "x-request-id",
    "x-idempotency-key",
    "idempotency-key",
  ]) {
    const value = incoming.get(key);
    if (value) headers.set(key, value);
  }

  headers.set("accept", "application/json");
  headers.set("content-type", "application/json");

  if (!headers.get("x-role") && !headers.get("x-ambulant-role")) {
    headers.set("x-role", "clinician");
  }

  return headers;
}
