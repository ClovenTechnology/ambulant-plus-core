import { withPartnerBoundary } from '@/src/lib/partner-access/boundary';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { readIdentity } from "@/src/lib/identity";
import { orgIdFromHeaders, requireRole } from "@/src/lib/careport";
import { resolveCarePortPharmacyId } from "@/src/lib/careport-rx-pharmacy-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function partnerOriginalGET(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);
  try {
    requireRole(who, ["admin", "pharmacy", "pharmacy_staff"]);
    const pharmacyId = await resolveCarePortPharmacyId({
      who,
      orgId,
      explicitPharmacyId: req.nextUrl.searchParams.get("pharmacyId"),
    });
    if (!pharmacyId) return NextResponse.json({ ok: false, error: "pharmacyId_unresolved" }, { status: 409 });
    const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 50)));
    const events = await (prisma as any).carePortRxPharmacyEvent.findMany({
      where: { orgId, pharmacyId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json({ ok: true, pharmacyId, events }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "rx_events_load_failed" }, { status: error?.status || 500 });
  }
}

async function partnerOriginalPATCH(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);
  try {
    requireRole(who, ["admin", "pharmacy", "pharmacy_staff"]);
    const pharmacyId = await resolveCarePortPharmacyId({
      who,
      orgId,
      explicitPharmacyId: req.nextUrl.searchParams.get("pharmacyId"),
    });
    if (!pharmacyId) return NextResponse.json({ ok: false, error: "pharmacyId_unresolved" }, { status: 409 });
    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids.map((x: any) => String(x || "").trim()).filter(Boolean).slice(0, 100) : [];
    if (!ids.length) return NextResponse.json({ ok: false, error: "event_ids_required" }, { status: 400 });
    const updated = await (prisma as any).carePortRxPharmacyEvent.updateMany({
      where: { id: { in: ids }, orgId, pharmacyId, acknowledgedAt: null },
      data: { acknowledgedAt: new Date(), acknowledgedBy: who.uid ?? null },
    });
    return NextResponse.json({ ok: true, acknowledgedCount: updated.count });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "rx_events_ack_failed" }, { status: error?.status || 500 });
  }
}

export const GET = withPartnerBoundary(partnerOriginalGET, '/api/careport/pharmacies/me/rx-events');
export const PATCH = withPartnerBoundary(partnerOriginalPATCH, '/api/careport/pharmacies/me/rx-events');
