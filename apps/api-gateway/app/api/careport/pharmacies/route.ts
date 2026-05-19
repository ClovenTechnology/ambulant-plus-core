//apps/api-gateway/app/api/careport/pharmacies/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { orgIdFromHeaders } from "@/src/lib/careport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const orgId = orgIdFromHeaders(req.headers);
  const url = new URL(req.url);

  const mode = (url.searchParams.get("mode") || "").toUpperCase(); // PICKUP|DELIVERY
  const country = (url.searchParams.get("country") || "").trim().toUpperCase();

  const pharmacies = await prisma.pharmacyPartner.findMany({
    where: {
      active: true,
      ...(country ? { country } : {}),
      ...(mode === "DELIVERY" ? { supportsDelivery: true } : {}),
      ...(mode === "PICKUP" ? { supportsPickup: true } : {}),
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ pharmacies, orgId }, { status: 200, headers: { "access-control-allow-origin": "*" } });
}