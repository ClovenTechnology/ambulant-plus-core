import { NextRequest, NextResponse } from "next/server";
import { readIdentity } from "@/src/lib/identity";
import { orgIdFromHeaders, requireRole } from "@/src/lib/careport";
import {
  getCarePortRxClinicalOrder,
  resolveCarePortPharmacyId,
  reviewCarePortRxOrder,
} from "@/src/lib/careport-rx-pharmacy-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolve(req: NextRequest, who: ReturnType<typeof readIdentity>, orgId: string) {
  const pharmacyId = await resolveCarePortPharmacyId({
    who,
    orgId,
    explicitPharmacyId: req.nextUrl.searchParams.get("pharmacyId"),
  });
  if (!pharmacyId) throw Object.assign(new Error("pharmacyId_unresolved"), { status: 409 });
  return pharmacyId;
}

export async function GET(req: NextRequest, { params }: { params: { orderId: string } }) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);
  try {
    requireRole(who, ["admin", "pharmacy", "pharmacy_staff"]);
    const pharmacyId = await resolve(req, who, orgId);
    const order = await getCarePortRxClinicalOrder({
      orgId,
      orderId: String(params.orderId || "").trim(),
      pharmacyId,
    });
    return NextResponse.json({ ok: true, order }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "rx_review_load_failed", details: error?.details ?? null }, { status: error?.status || 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { orderId: string } }) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);
  try {
    requireRole(who, ["admin", "pharmacy", "pharmacy_staff"]);
    const pharmacyId = await resolve(req, who, orgId);
    const body = await req.json().catch(() => ({}));
    const result = await reviewCarePortRxOrder({
      who,
      orgId,
      pharmacyId,
      orderId: String(params.orderId || "").trim(),
      body,
    });
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "rx_review_update_failed", details: error?.details ?? null }, { status: error?.status || 500 });
  }
}
