// FILE: apps/api-gateway/app/api/careport/pharmacies/[pharmacyId]/kyc/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { readIdentity } from "@/src/lib/identity";
import { COUNTRY_CONFIG, validatePharmacyKyc } from "@/src/lib/kyc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { pharmacyId: string } }) {
  const who = readIdentity(req.headers);
  if (who.role !== "admin" && who.role !== "pharmacy" && who.role !== "pharmacy_staff") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const pharmacyId = String(params.pharmacyId || "").trim();
  if (!pharmacyId) return NextResponse.json({ ok: false, error: "pharmacyId_required" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const country = String(body?.country || "ZA").toUpperCase() as keyof typeof COUNTRY_CONFIG;
  const schemaKey = String(body?.schemaKey || "ZA_SAPC_PHARMACY_v1") as any;
  const payload = body?.payload ?? null;

  const cfg = COUNTRY_CONFIG[country];
  if (!cfg) return NextResponse.json({ ok: false, error: "unsupported_country" }, { status: 400 });

  const v = validatePharmacyKyc(country as any, schemaKey, payload);
  if (!v.ok) return NextResponse.json({ ok: false, error: "invalid_payload", issues: v.errors }, { status: 400 });

  const updated = await prisma.pharmacyPartner.update({
    where: { id: pharmacyId },
    data: {
      country,
      currency: cfg.currency,
      kycSchemaKey: schemaKey,
      kycPayload: v.data as any,
      kycSubmittedAt: new Date(),
      kycVerifiedAt: null,
      kycRejectedReason: null,
      kycStatus: "PENDING_REVIEW",
    } as any,
  });

  return NextResponse.json({ ok: true, pharmacy: updated }, { status: 200 });
}