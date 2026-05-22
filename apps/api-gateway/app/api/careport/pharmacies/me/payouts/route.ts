import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { readIdentity } from "@/src/lib/identity";
import { orgIdFromHeaders, pharmacyIdForStaff, requireRole } from "@/src/lib/careport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(v: unknown, max = 120) {
  return String(v ?? "").trim().slice(0, max);
}

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } });
}

async function resolvePharmacyId(req: NextRequest, who: ReturnType<typeof readIdentity>) {
  const orgId = orgIdFromHeaders(req.headers);
  const explicit = clean(req.nextUrl.searchParams.get("pharmacyId"), 120);
  if ((who.role === "admin" || who.role === "admin_staff") && explicit) return explicit;
  if (who.role === "pharmacy" && who.uid) return String(who.uid);
  if (who.role === "pharmacy_staff" && who.uid) return await pharmacyIdForStaff(orgId, who.uid);
  return null;
}

function normalizeLine(line: any) {
  return {
    id: line.id,
    role: "pharmacy",
    entityId: line.recipientId,
    periodStart: line.batch?.periodStart ?? line.createdAt,
    periodEnd: line.batch?.periodEnd ?? line.createdAt,
    amountCents: line.netPayableMinor ?? 0,
    grossCents: line.grossMinor ?? 0,
    platformFeeCents: line.platformFeeMinor ?? 0,
    paymentProviderFeeCents: line.paymentProviderFeeMinor ?? 0,
    subscriptionFeeCents: line.subscriptionFeeMinor ?? 0,
    inventoryHostingFeeCents: line.inventoryHostingFeeMinor ?? 0,
    currency: line.currency ?? line.batch?.currency ?? "ZAR",
    status: String(line.status || "PENDING").toLowerCase(),
    remittanceRef: line.remittanceRef ?? line.batch?.remittanceRef ?? null,
    paidAt: line.paidAt ?? null,
    metadata: line.metadata ?? null,
  };
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);

  try {
    requireRole(who, ["admin", "admin_staff", "pharmacy", "pharmacy_staff"]);
    const orgId = orgIdFromHeaders(req.headers);
    const pharmacyId = await resolvePharmacyId(req, who);
    if (!pharmacyId) return json({ ok: false, error: "pharmacyId_unresolved", items: [] }, 409);

    const db: any = prisma;
    const lines = await db.carePortSettlementLine?.findMany?.({
      where: { orgId, recipientType: "PHARMACY", recipientId: pharmacyId },
      include: { batch: true },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
    }).catch(() => []);

    const fallbackPayouts = !lines?.length
      ? await db.payout?.findMany?.({
          where: { role: "pharmacy", entityId: pharmacyId },
          orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }],
          take: 100,
        }).catch(() => [])
      : [];

    const items = lines?.length ? lines.map(normalizeLine) : (fallbackPayouts || []);

    const orders = await prisma.carePortOrder.findMany({
      where: { chosenPharmacyId: pharmacyId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        status: true,
        fulfillment: true,
        subtotalCents: true,
        deliveryFeeCents: true,
        totalCents: true,
        currency: true,
        settlementStatus: true as any,
        createdAt: true,
        updatedAt: true,
      } as any,
    });

    const pendingCents = (items || [])
      .filter((x: any) => String(x.status).toLowerCase() === "pending")
      .reduce((s: number, x: any) => s + Number(x.amountCents || x.netPayableMinor || 0), 0);

    const paidCents = (items || [])
      .filter((x: any) => String(x.status).toLowerCase() === "paid")
      .reduce((s: number, x: any) => s + Number(x.amountCents || x.netPayableMinor || 0), 0);

    return json({
      ok: true,
      pharmacyId,
      source: lines?.length ? "careport_settlement_lines" : "legacy_payouts_or_empty",
      items,
      orders,
      summary: {
        payoutCount: items?.length || 0,
        pendingCents,
        paidCents,
      },
    });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "pharmacy_payouts_load_failed", items: [] }, e?.status || 500);
  }
}
