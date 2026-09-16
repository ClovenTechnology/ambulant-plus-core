import { withPartnerBoundary } from '@/src/lib/partner-access/boundary';
import { NextRequest, NextResponse } from "next/server";
import { readIdentity } from "@/src/lib/identity";
import { orgIdFromHeaders, requireRole } from "@/src/lib/careport";
import {
  resolveCarePortPharmacyId,
  updateCarePortRxFulfilment,
} from "@/src/lib/careport-rx-pharmacy-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function partnerOriginalPOST(req: NextRequest, { params }: { params: { orderId: string } }) {
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
    const result = await updateCarePortRxFulfilment({
      who,
      orgId,
      pharmacyId,
      orderId: String(params.orderId || "").trim(),
      body,
    });
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "rx_fulfilment_update_failed", details: error?.details ?? null }, { status: error?.status || 500 });
  }
}

export const POST = withPartnerBoundary(partnerOriginalPOST, '/api/careport/pharmacies/me/orders/[orderId]/rx-fulfilment');
