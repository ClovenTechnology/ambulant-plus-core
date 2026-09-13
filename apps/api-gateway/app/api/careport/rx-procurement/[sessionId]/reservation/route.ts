import { NextRequest, NextResponse } from "next/server";
import { readIdentity } from "@/src/lib/identity";
import { correlationIdFromHeaders, orgIdFromHeaders, requireRole } from "@/src/lib/careport";
import {
  createCarePortRxReservation,
  getCarePortRxReservation,
  serializeCarePortRxReservation,
} from "@/src/lib/careport-rx-commerce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);
  try {
    requireRole(who, ["patient", "admin"]);
    const result = await getCarePortRxReservation({
      who,
      orgId,
      sessionId: String(params.sessionId || "").trim(),
    });
    return json({
      ok: true,
      sessionId: result.session.id,
      reservation: serializeCarePortRxReservation(result.reservation),
      order: result.reservation?.order ?? null,
    });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || "rx_reservation_load_failed", details: error?.details ?? null }, error?.status || 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);
  const correlationId = correlationIdFromHeaders(req.headers);
  try {
    requireRole(who, ["patient", "admin"]);
    const body = await req.json().catch(() => ({}));
    const result = await createCarePortRxReservation({
      who,
      orgId,
      correlationId,
      sessionId: String(params.sessionId || "").trim(),
      body,
    });
    return json({
      ok: true,
      order: result.order,
      session: result.session,
      reservation: serializeCarePortRxReservation(result.reservation),
      correlationId,
    });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || "rx_reservation_create_failed", details: error?.details ?? null, correlationId }, error?.status || 500);
  }
}
