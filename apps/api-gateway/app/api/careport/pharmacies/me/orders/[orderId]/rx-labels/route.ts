import { withPartnerBoundary } from '@/src/lib/partner-access/boundary';
import { NextRequest, NextResponse } from "next/server";
import { readIdentity } from "@/src/lib/identity";
import { orgIdFromHeaders, requireRole } from "@/src/lib/careport";
import {
  getCarePortRxLabels,
  resolveCarePortPharmacyId,
} from "@/src/lib/careport-rx-pharmacy-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function run(req: NextRequest, params: { orderId: string }, incrementVersions: boolean) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);
  requireRole(who, ["admin", "pharmacy", "pharmacy_staff"]);
  const pharmacyId = await resolveCarePortPharmacyId({
    who,
    orgId,
    explicitPharmacyId: req.nextUrl.searchParams.get("pharmacyId"),
  });
  if (!pharmacyId) throw Object.assign(new Error("pharmacyId_unresolved"), { status: 409 });
  return getCarePortRxLabels({
    who,
    orgId,
    pharmacyId,
    orderId: String(params.orderId || "").trim(),
    incrementVersions,
  });
}

async function partnerOriginalGET(req: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    return NextResponse.json({ ok: true, ...(await run(req, params, false)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "rx_labels_load_failed" }, { status: error?.status || 500 });
  }
}

async function partnerOriginalPOST(req: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    return NextResponse.json({ ok: true, ...(await run(req, params, true)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "rx_labels_reprint_failed" }, { status: error?.status || 500 });
  }
}

export const GET = withPartnerBoundary(partnerOriginalGET, '/api/careport/pharmacies/me/orders/[orderId]/rx-labels');
export const POST = withPartnerBoundary(partnerOriginalPOST, '/api/careport/pharmacies/me/orders/[orderId]/rx-labels');
