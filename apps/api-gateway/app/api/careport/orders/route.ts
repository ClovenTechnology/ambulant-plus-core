// FILE: apps/api-gateway/app/api/careport/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { readIdentity } from "@/src/lib/identity";
import { orgIdFromHeaders, requireRole } from "@/src/lib/careport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  requireRole(who, ["patient", "admin"]);

  const url = new URL(req.url);
  const encounterId = (url.searchParams.get("encounterId") || "").trim();
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 20)));

  const where: any = { orgId };
  if (encounterId) where.encounterId = encounterId;

  if (who.role === "patient") {
    if (!who.uid) return NextResponse.json({ ok: false, error: "missing_uid" }, { status: 403 });
    where.patientId = who.uid;
  }

  const orders = await prisma.carePortOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      encounterId: true,
      erxOrderId: true,
      patientId: true,
      status: true,
      fulfillment: true,
      currency: true,
      subtotalCents: true,
      deliveryFeeCents: true,
      totalCents: true,
      createdAt: true,
      chosenPharmacyId: true,
      chosenOfferId: true,
    },
  });

  return NextResponse.json({ ok: true, orders }, { status: 200, headers: { "access-control-allow-origin": "*" } });
}