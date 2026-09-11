// FILE: apps/api-gateway/app/api/careport/admin/kyc/pharmacies/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { readIdentity } from "@/src/lib/identity";
import { orgIdFromHeaders, requireRole } from "@/src/lib/careport";
import {
  normalizeCarePortPharmacyCompliance,
  summarizeCarePortPharmacyCompliance,
} from "@/src/lib/careport-pharmacy-compliance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "access-control-allow-origin": "*" },
  });
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);

  try {
    requireRole(who, ["admin"]);

    const orgId = orgIdFromHeaders(req.headers);
    const url = new URL(req.url);

    const country = String(url.searchParams.get("country") || "ZA").toUpperCase();
    const status = String(url.searchParams.get("status") || "PENDING_REVIEW").toUpperCase();
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 50)));

    const rows = await prisma.pharmacyPartner.findMany({
      where: {
        country,
        kycStatus: status,
      } as any,
      orderBy: [{ updatedAt: "desc" }],
      take: limit,
      select: {
        id: true,
        name: true,
        contact: true,
        address: true,
        city: true,
        lat: true,
        lng: true,
        country: true,
        currency: true,
        kycStatus: true,
        kycSchemaKey: true,
        kycSubmittedAt: true,
        kycVerifiedAt: true,
        kycRejectedReason: true,
        kycPayload: true,
        createdAt: true,
        updatedAt: true,
      } as any,
    });

    const pharmacies = rows.map((row: any) => {
      const complianceProfile = normalizeCarePortPharmacyCompliance(row);
      return {
        ...row,
        complianceProfile,
        complianceSummary: summarizeCarePortPharmacyCompliance(complianceProfile),
      };
    });

    return json({ ok: true, orgId, country, status, pharmacies }, 200);
  } catch (error: any) {
    return json(
      { ok: false, error: error?.message || "careport_admin_pharmacies_failed", pharmacies: [] },
      error?.status || 500,
    );
  }
}
