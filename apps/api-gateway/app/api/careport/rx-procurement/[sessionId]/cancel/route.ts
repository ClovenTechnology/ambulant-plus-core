import { withPartnerBoundary } from '@/src/lib/partner-access/boundary';
import { NextRequest, NextResponse } from "next/server";
import { readIdentity } from "@/src/lib/identity";
import { correlationIdFromHeaders, orgIdFromHeaders, requireRole } from "@/src/lib/careport";
import { cancelCarePortRxReservation, serializeCarePortRxReservation } from "@/src/lib/careport-rx-commerce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function partnerOriginalPOST(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);
  const correlationId = correlationIdFromHeaders(req.headers);
  try {
    requireRole(who, ["patient", "admin"]);
    const body = await req.json().catch(() => ({}));
    const result = await cancelCarePortRxReservation({
      who,
      orgId,
      correlationId,
      sessionId: String(params.sessionId || "").trim(),
      body,
    });
    return NextResponse.json(
      { ok: true, ...result, reservation: serializeCarePortRxReservation(result.reservation), correlationId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "rx_cancel_failed", details: error?.details ?? null, correlationId },
      { status: error?.status || 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const POST = withPartnerBoundary(partnerOriginalPOST, '/api/careport/rx-procurement/[sessionId]/cancel');
