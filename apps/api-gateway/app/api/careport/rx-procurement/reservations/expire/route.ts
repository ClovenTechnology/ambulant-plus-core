import { NextRequest, NextResponse } from "next/server";
import { readIdentity } from "@/src/lib/identity";
import { orgIdFromHeaders, requireRole } from "@/src/lib/careport";
import { expireHeldCarePortRxReservations } from "@/src/lib/careport-rx-commerce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function boundedInt(value: string | null, fallback: number) {
  const n = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(250, Math.max(1, n));
}

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ["admin"]);

    const url = new URL(req.url);
    const limit = boundedInt(url.searchParams.get("limit"), 100);

    const result = await expireHeldCarePortRxReservations({
      orgId,
      limit,
      actorId: who.uid ?? null,
      actorRole: who.role ?? null,
    });

    return NextResponse.json(
      { ok: true, ...result },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "careport_rx_reservation_expiry_failed" },
      { status: Number(error?.status || 500), headers: { "Cache-Control": "no-store" } },
    );
  }
}
