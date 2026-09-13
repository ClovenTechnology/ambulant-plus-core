import { NextRequest, NextResponse } from "next/server";
import { readIdentity } from "@/src/lib/identity";
import { orgIdFromHeaders, requireRole } from "@/src/lib/careport";
import {
  getCarePortRxAvailability,
  resolveCarePortPharmacyId,
  updateCarePortRxAvailability,
} from "@/src/lib/careport-rx-pharmacy-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function pharmacy(req: NextRequest, who: ReturnType<typeof readIdentity>, orgId: string) {
  const id = await resolveCarePortPharmacyId({
    who,
    orgId,
    explicitPharmacyId: req.nextUrl.searchParams.get("pharmacyId"),
  });
  if (!id) throw Object.assign(new Error("pharmacyId_unresolved"), { status: 409 });
  return id;
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);
  try {
    requireRole(who, ["admin", "pharmacy", "pharmacy_staff"]);
    const pharmacyId = await pharmacy(req, who, orgId);
    const availability = await getCarePortRxAvailability({ orgId, pharmacyId });
    return NextResponse.json({ ok: true, pharmacyId, availability }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "rx_availability_load_failed", details: error?.details ?? null }, { status: error?.status || 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);
  try {
    requireRole(who, ["admin", "pharmacy", "pharmacy_staff"]);
    const pharmacyId = await pharmacy(req, who, orgId);
    const body = await req.json().catch(() => ({}));
    const availability = await updateCarePortRxAvailability({ who, orgId, pharmacyId, body });
    return NextResponse.json({ ok: true, pharmacyId, availability }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "rx_availability_update_failed", details: error?.details ?? null }, { status: error?.status || 500 });
  }
}
