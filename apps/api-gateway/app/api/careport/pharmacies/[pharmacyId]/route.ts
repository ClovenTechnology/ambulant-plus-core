//apps/api-gateway/app/api/careport/pharmacies/[pharmacyId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { pharmacyId: string } }) {
  const pharmacyId = String(params.pharmacyId || "").trim();
  if (!pharmacyId) return NextResponse.json({ error: "pharmacyId_required" }, { status: 400 });

  const pharmacy = await prisma.pharmacyPartner.findUnique({ where: { id: pharmacyId } });
  if (!pharmacy) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ pharmacy }, { status: 200, headers: { "access-control-allow-origin": "*" } });
}