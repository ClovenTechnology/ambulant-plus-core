import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { readIdentity } from "@/src/lib/identity";
import { orgIdFromHeaders, requireRole } from "@/src/lib/careport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLICY_KEY = "careport.commercial_policy";
const PAYOUT_ELIGIBLE_STATUSES = ["COMPLETED", "DELIVERED"];

type Policy = {
  currency: string;
  platformCommissionBps: number;
  passPaymentProviderFeeToPharmacy: boolean;
  paymentProviderFeeBps: number;
  paymentProviderFixedFeeCents: number;
  riderDeliveryShareBps: number;
  riderBaseFeeCents: number;
  riderPerKmFeeCents: number;
  pharmacyMonthlyPlatformFeeCents: number;
  pharmacyInventoryHostingFeeCents: number;
  pharmacyOnboardingFeeCents: number;
  settlementCycle: "daily" | "weekly" | "monthly";
};

const DEFAULT_POLICY: Policy = {
  currency: "ZAR",
  platformCommissionBps: 0,
  passPaymentProviderFeeToPharmacy: false,
  paymentProviderFeeBps: 0,
  paymentProviderFixedFeeCents: 0,
  riderDeliveryShareBps: 10000,
  riderBaseFeeCents: 0,
  riderPerKmFeeCents: 0,
  pharmacyMonthlyPlatformFeeCents: 0,
  pharmacyInventoryHostingFeeCents: 0,
  pharmacyOnboardingFeeCents: 0,
  settlementCycle: "monthly",
};

function clean(v: unknown, max = 120) {
  return String(v ?? "").trim().slice(0, max);
}

function asDate(value: unknown, fallback: Date) {
  const d = new Date(String(value || ""));
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function startOfMonth(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function endOfMonth(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function asInt(v: unknown, fallback: number, min = 0, max = 100_000_000) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function normalizePolicy(raw: any): Policy {
  const cycle = clean(raw?.settlementCycle).toLowerCase();
  return {
    currency: clean(raw?.currency, 3).toUpperCase() || DEFAULT_POLICY.currency,
    platformCommissionBps: asInt(raw?.platformCommissionBps, DEFAULT_POLICY.platformCommissionBps, 0, 5000),
    passPaymentProviderFeeToPharmacy:
      typeof raw?.passPaymentProviderFeeToPharmacy === "boolean"
        ? raw.passPaymentProviderFeeToPharmacy
        : DEFAULT_POLICY.passPaymentProviderFeeToPharmacy,
    paymentProviderFeeBps: asInt(raw?.paymentProviderFeeBps, DEFAULT_POLICY.paymentProviderFeeBps, 0, 2000),
    paymentProviderFixedFeeCents: asInt(raw?.paymentProviderFixedFeeCents, DEFAULT_POLICY.paymentProviderFixedFeeCents),
    riderDeliveryShareBps: asInt(raw?.riderDeliveryShareBps, DEFAULT_POLICY.riderDeliveryShareBps, 0, 10000),
    riderBaseFeeCents: asInt(raw?.riderBaseFeeCents, DEFAULT_POLICY.riderBaseFeeCents),
    riderPerKmFeeCents: asInt(raw?.riderPerKmFeeCents, DEFAULT_POLICY.riderPerKmFeeCents),
    pharmacyMonthlyPlatformFeeCents: asInt(raw?.pharmacyMonthlyPlatformFeeCents, DEFAULT_POLICY.pharmacyMonthlyPlatformFeeCents),
    pharmacyInventoryHostingFeeCents: asInt(raw?.pharmacyInventoryHostingFeeCents, DEFAULT_POLICY.pharmacyInventoryHostingFeeCents),
    pharmacyOnboardingFeeCents: asInt(raw?.pharmacyOnboardingFeeCents, DEFAULT_POLICY.pharmacyOnboardingFeeCents),
    settlementCycle: cycle === "daily" || cycle === "weekly" || cycle === "monthly" ? cycle : DEFAULT_POLICY.settlementCycle,
  };
}

function settingsDelegate() {
  const db: any = prisma;
  return db.carePortOperationalSetting || db.carePortSetting || db.careportSetting || null;
}

async function loadPolicy(orgId: string) {
  const delegate = settingsDelegate();
  if (!delegate?.findUnique && !delegate?.findFirst) return { policy: DEFAULT_POLICY, source: "defaults" as const };

  const row = delegate.findUnique
    ? await delegate.findUnique({ where: { orgId_key: { orgId, key: POLICY_KEY } } }).catch(() => null)
    : await delegate.findFirst({ where: { orgId, key: POLICY_KEY }, orderBy: { updatedAt: "desc" } }).catch(() => null);

  const value = row?.value ?? row?.json ?? row?.payload ?? row?.metadata ?? null;
  return { policy: normalizePolicy(value || DEFAULT_POLICY), source: value ? ("database" as const) : ("defaults" as const) };
}

function providerFee(amountCents: number, policy: Policy) {
  if (!amountCents) return 0;
  return Math.max(0, Math.round((amountCents * policy.paymentProviderFeeBps) / 10000) + policy.paymentProviderFixedFeeCents);
}

function commission(amountCents: number, bps: number) {
  return Math.max(0, Math.round((amountCents * bps) / 10000));
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store", "access-control-allow-origin": "*" },
  });
}

async function loadOrders(orgId: string, from: Date, to: Date, includePaid: boolean) {
  const statuses = includePaid
    ? ["PAID", "PREPARING", "READY_FOR_PICKUP", "DISPATCHING", "DELIVERED", "COMPLETED"]
    : PAYOUT_ELIGIBLE_STATUSES;

  return prisma.carePortOrder.findMany({
    where: {
      orgId,
      status: { in: statuses as any },
      createdAt: { gte: from, lte: to },
      chosenPharmacyId: { not: null },
    },
    include: {
      chosenPharmacy: true,
      assignment: true,
      payments: true,
    },
    orderBy: { createdAt: "asc" },
    take: 1000,
  });
}

function buildSettlementPreview(orders: any[], policy: Policy) {
  const pharmacyMap = new Map<string, any>();
  const riderMap = new Map<string, any>();

  let gross = 0;
  let pharmacyGross = 0;
  let deliveryGross = 0;
  let platformFees = 0;
  let providerFees = 0;
  let riderGross = 0;
  let subscriptionFees = 0;
  let inventoryHostingFees = 0;

  for (const order of orders) {
    const subtotal = Number(order.subtotalCents || 0);
    const delivery = Number(order.deliveryFeeCents || 0);
    const total = Number(order.totalCents || subtotal + delivery);
    const succeededPayments = Array.isArray(order.payments)
      ? order.payments.filter((p: any) => String(p.status) === "SUCCEEDED")
      : [];
    const paid = succeededPayments.reduce((sum: number, p: any) => sum + Number(p.amountCents || 0), 0) || total;

    gross += total;
    pharmacyGross += subtotal;
    deliveryGross += delivery;

    const provider = providerFee(paid, policy);
    const commissionFee = commission(subtotal, policy.platformCommissionBps);
    const pharmacyProviderFee = policy.passPaymentProviderFeeToPharmacy ? provider : 0;
    const pharmacyNet = Math.max(0, subtotal - commissionFee - pharmacyProviderFee);

    providerFees += provider;
    platformFees += commissionFee + (policy.passPaymentProviderFeeToPharmacy ? 0 : provider);

    if (order.chosenPharmacyId) {
      const row = pharmacyMap.get(order.chosenPharmacyId) || {
        role: "pharmacy",
        recipientType: "PHARMACY",
        entityId: order.chosenPharmacyId,
        recipientId: order.chosenPharmacyId,
        name: order.chosenPharmacy?.name || order.chosenPharmacyId,
        orders: 0,
        orderCount: 0,
        grossCents: 0,
        grossMinor: 0,
        platformFeeCents: 0,
        platformFeeMinor: 0,
        paymentProviderFeeCents: 0,
        paymentProviderFeeMinor: 0,
        monthlyFeeCents: 0,
        subscriptionFeeMinor: 0,
        inventoryHostingFeeCents: 0,
        inventoryHostingFeeMinor: 0,
        netCents: 0,
        netPayableMinor: 0,
        orderIds: [],
      };
      row.orders += 1;
      row.orderCount += 1;
      row.grossCents += subtotal;
      row.grossMinor += subtotal;
      row.platformFeeCents += commissionFee;
      row.platformFeeMinor += commissionFee;
      row.paymentProviderFeeCents += pharmacyProviderFee;
      row.paymentProviderFeeMinor += pharmacyProviderFee;
      row.netCents += pharmacyNet;
      row.netPayableMinor += pharmacyNet;
      row.orderIds.push(order.id);
      pharmacyMap.set(order.chosenPharmacyId, row);
    }

    const riderUserId = order.assignment?.riderUserId || null;
    if (riderUserId) {
      const riderFee = Math.max(0, Math.round((delivery * policy.riderDeliveryShareBps) / 10000) + policy.riderBaseFeeCents);
      riderGross += riderFee;
      const row = riderMap.get(riderUserId) || {
        role: "rider",
        recipientType: "RIDER",
        entityId: riderUserId,
        recipientId: riderUserId,
        name: riderUserId,
        trips: 0,
        tripCount: 0,
        grossCents: 0,
        grossMinor: 0,
        riderFeeMinor: 0,
        netCents: 0,
        netPayableMinor: 0,
        orderIds: [],
      };
      row.trips += 1;
      row.tripCount += 1;
      row.grossCents += riderFee;
      row.grossMinor += riderFee;
      row.riderFeeMinor += riderFee;
      row.netCents += riderFee;
      row.netPayableMinor += riderFee;
      row.orderIds.push(order.id);
      riderMap.set(riderUserId, row);
    }
  }

  for (const row of pharmacyMap.values()) {
    row.monthlyFeeCents = policy.pharmacyMonthlyPlatformFeeCents;
    row.subscriptionFeeMinor = policy.pharmacyMonthlyPlatformFeeCents;
    row.inventoryHostingFeeCents = policy.pharmacyInventoryHostingFeeCents;
    row.inventoryHostingFeeMinor = policy.pharmacyInventoryHostingFeeCents;
    row.netCents = Math.max(0, row.netCents - row.monthlyFeeCents - row.inventoryHostingFeeCents);
    row.netPayableMinor = Math.max(0, row.netPayableMinor - row.subscriptionFeeMinor - row.inventoryHostingFeeMinor);
    platformFees += row.monthlyFeeCents + row.inventoryHostingFeeCents;
    subscriptionFees += row.monthlyFeeCents;
    inventoryHostingFees += row.inventoryHostingFeeCents;
  }

  const pharmacy = Array.from(pharmacyMap.values());
  const riders = Array.from(riderMap.values());

  return {
    summary: {
      orders: orders.length,
      grossCents: gross,
      grossMinor: gross,
      pharmacyGrossCents: pharmacyGross,
      pharmacyGrossMinor: pharmacyGross,
      deliveryGrossCents: deliveryGross,
      deliveryGrossMinor: deliveryGross,
      platformFeesCents: platformFees,
      platformFeeMinor: platformFees,
      paymentProviderFeesCents: providerFees,
      paymentProviderFeeMinor: providerFees,
      subscriptionFeeMinor: subscriptionFees,
      inventoryHostingFeeMinor: inventoryHostingFees,
      riderGrossCents: riderGross,
      riderGrossMinor: riderGross,
      pharmacyPayoutCents: pharmacy.reduce((s, x) => s + x.netCents, 0),
      pharmacyNetPayableMinor: pharmacy.reduce((s, x) => s + x.netPayableMinor, 0),
      riderPayoutCents: riders.reduce((s, x) => s + x.netCents, 0),
      riderNetPayableMinor: riders.reduce((s, x) => s + x.netPayableMinor, 0),
      lineCount: pharmacy.length + riders.length,
    },
    pharmacy,
    riders,
  };
}

async function loadExistingSettlementData(orgId: string, from: Date, to: Date) {
  const db: any = prisma;
  const batches = await db.carePortSettlementBatch?.findMany?.({
    where: { orgId, periodStart: from, periodEnd: to },
    include: { lines: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  }).catch(() => []);

  return { batches: batches || [], lines: (batches || []).flatMap((b: any) => b.lines || []) };
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ["admin", "admin_staff"]);
    const url = new URL(req.url);
    const from = asDate(url.searchParams.get("from"), startOfMonth());
    const to = asDate(url.searchParams.get("to"), endOfMonth());
    const includePaid = url.searchParams.get("includePaid") === "1" || url.searchParams.get("includePaid") === "true";
    const loadedPolicy = await loadPolicy(orgId);
    const orders = await loadOrders(orgId, from, to, includePaid);
    const preview = buildSettlementPreview(orders, loadedPolicy.policy);
    const existing = await loadExistingSettlementData(orgId, from, to);

    return json({ ok: true, orgId, from, to, includePaid, policy: loadedPolicy, ...preview, existingBatches: existing.batches, existingLines: existing.lines });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "careport_finance_load_failed" }, e?.status || 500);
  }
}

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ["admin", "admin_staff"]);
    const body = await req.json().catch(() => ({}));
    const action = clean(body?.action || "generate", 40).toLowerCase();
    const db: any = prisma;

    if (action === "mark_paid" || action === "mark_failed") {
      const batchId = clean(body?.batchId, 120);
      if (!batchId) return json({ ok: false, error: "batchId_required" }, 400);

      if (!db.carePortSettlementBatch?.update || !db.carePortSettlementLine?.updateMany) {
        return json({ ok: false, error: "careport_settlement_models_not_configured" }, 409);
      }

      const status = action === "mark_paid" ? "PAID" : "FAILED";
      const now = new Date();
      const updateData: any = {
        status,
        remittanceRef: clean(body?.remittanceRef, 160) || null,
        failureReason: status === "FAILED" ? clean(body?.failureReason || body?.reason, 1000) || null : null,
        ...(status === "PAID" ? { paidAt: now, paidByUserId: who.uid ?? null } : { failedAt: now, failedByUserId: who.uid ?? null }),
      };

      const batch = await db.carePortSettlementBatch.update({ where: { id: batchId }, data: updateData });
      await db.carePortSettlementLine.updateMany({
        where: { batchId },
        data: {
          status,
          remittanceRef: updateData.remittanceRef,
          failureReason: updateData.failureReason,
          ...(status === "PAID" ? { paidAt: now } : { failedAt: now }),
        },
      });

      return json({ ok: true, action, batch });
    }

    const from = asDate(body?.from || body?.periodStart, startOfMonth());
    const to = asDate(body?.to || body?.periodEnd, endOfMonth());
    const includePaid = Boolean(body?.includePaid);
    const dryRun = body?.dryRun !== false;
    const loadedPolicy = await loadPolicy(orgId);
    const policy = normalizePolicy({ ...loadedPolicy.policy, ...(body?.policyOverride || {}) });

    const orders = await loadOrders(orgId, from, to, includePaid);
    const preview = buildSettlementPreview(orders, policy);

    if (dryRun) {
      return json({ ok: true, dryRun: true, orgId, from, to, includePaid, policy: { policy, source: loadedPolicy.source }, ...preview, payouts: [] });
    }

    if (!db.carePortSettlementBatch?.create || !db.carePortSettlementLine?.createMany) {
      return json({ ok: false, error: "careport_settlement_models_not_configured", preview }, 409);
    }

    const batch = await db.carePortSettlementBatch.create({
      data: {
        orgId,
        kind: "CAREPORT",
        periodStart: from,
        periodEnd: to,
        currency: policy.currency,
        status: "PENDING",
        totalGrossMinor: preview.summary.grossMinor,
        pharmacyGrossMinor: preview.summary.pharmacyGrossMinor,
        riderGrossMinor: preview.summary.riderGrossMinor,
        platformFeeMinor: preview.summary.platformFeeMinor,
        paymentProviderFeeMinor: preview.summary.paymentProviderFeeMinor,
        subscriptionFeeMinor: preview.summary.subscriptionFeeMinor,
        inventoryHostingFeeMinor: preview.summary.inventoryHostingFeeMinor,
        pharmacyNetPayableMinor: preview.summary.pharmacyNetPayableMinor,
        riderNetPayableMinor: preview.summary.riderNetPayableMinor,
        lineCount: preview.summary.lineCount,
        generatedByUserId: who.uid ?? null,
        metadata: { includePaid, policy, generatedAt: new Date().toISOString(), orderCount: orders.length },
      },
    });

    const lines = [...preview.pharmacy, ...preview.riders].map((row: any) => ({
      orgId,
      batchId: batch.id,
      recipientType: row.recipientType,
      recipientId: row.recipientId,
      recipientName: row.name || null,
      orderIds: row.orderIds || [],
      tripCount: row.tripCount || 0,
      orderCount: row.orderCount || 0,
      grossMinor: row.grossMinor || 0,
      platformFeeMinor: row.platformFeeMinor || 0,
      paymentProviderFeeMinor: row.paymentProviderFeeMinor || 0,
      subscriptionFeeMinor: row.subscriptionFeeMinor || 0,
      inventoryHostingFeeMinor: row.inventoryHostingFeeMinor || 0,
      riderFeeMinor: row.riderFeeMinor || 0,
      refundMinor: row.refundMinor || 0,
      netPayableMinor: row.netPayableMinor || 0,
      currency: policy.currency,
      status: "PENDING",
      metadata: { source: "careport_finance_settlement", breakdown: row },
    }));

    if (lines.length) await db.carePortSettlementLine.createMany({ data: lines });

    const orderUpdates = orders.map((order: any) =>
      prisma.carePortOrder.update({
        where: { id: order.id },
        data: {
          settlementStatus: "BATCHED" as any,
          settlementSnapshot: { batchId: batch.id, policy, generatedAt: new Date().toISOString() } as any,
        } as any,
      }).catch(() => null),
    );
    await Promise.all(orderUpdates);

    await (prisma as any).auditEvent?.create?.({
      data: {
        kind: "careport_finance_settlement_generated",
        actorId: who.uid ?? null,
        actorRole: who.role ?? null,
        subjectId: batch.id,
        meta: { orgId, from, to, includePaid, summary: preview.summary, lineCount: lines.length },
      },
    }).catch(() => null);

    const createdLines = await db.carePortSettlementLine.findMany({ where: { batchId: batch.id }, orderBy: { createdAt: "asc" } });
    return json({ ok: true, dryRun: false, orgId, from, to, includePaid, policy: { policy, source: loadedPolicy.source }, ...preview, batch, payouts: createdLines });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "careport_finance_settlement_failed" }, e?.status || 500);
  }
}
