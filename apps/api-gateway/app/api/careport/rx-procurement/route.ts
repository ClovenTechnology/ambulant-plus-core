import { NextRequest, NextResponse } from "next/server";
import { readIdentity } from "@/src/lib/identity";
import {
  correlationIdFromHeaders,
  orgIdFromHeaders,
  requireRole,
} from "@/src/lib/careport";
import {
  findLatestCarePortProcurement,
  serializeCarePortProcurementSession,
  startCarePortProcurement,
} from "@/src/lib/careport-rx-procurement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "access-control-allow-origin": "*" },
  });
}

function clean(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ["patient", "admin"]);
    const encId = clean(req.nextUrl.searchParams.get("encId"), 240);
    const erxOrderId = clean(req.nextUrl.searchParams.get("erxOrderId"), 240);

    if (!encId && !erxOrderId) {
      return json({ ok: false, error: "encId_or_erxOrderId_required" }, 400);
    }

    const session = await findLatestCarePortProcurement({ who, orgId, encId, erxOrderId });
    return json({ ok: true, session: session ? serializeCarePortProcurementSession(session) : null });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || "careport_procurement_lookup_failed" }, error?.status || 500);
  }
}

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);
  const correlationId = correlationIdFromHeaders(req.headers);

  try {
    requireRole(who, ["patient", "admin"]);
    const body = await req.json().catch(() => ({}));
    const result = await startCarePortProcurement({ who, orgId, correlationId, body });

    return json({
      ok: true,
      reused: result.reused,
      session: serializeCarePortProcurementSession(result.session),
      next: "BASKET_REVIEW",
      correlationId,
    });
  } catch (error: any) {
    return json(
      {
        ok: false,
        error: error?.message || "careport_procurement_start_failed",
        reason: error?.reason ?? null,
        message: error?.messageForPatient ?? null,
        correlationId,
      },
      error?.status || 500,
    );
  }
}
