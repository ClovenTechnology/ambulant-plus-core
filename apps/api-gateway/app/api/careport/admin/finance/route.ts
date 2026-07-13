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


const PARTNER_TIER_KEY = "partner.commercial_tiers";

type PartnerTier = {
  id: string;
  module: "careport" | "medreach";
  partnerType: "pharmacy" | "lab";
  name: string;
  enabled: boolean;
  currency?: string;
  monthlyPlatformFeeCents?: number;
  catalogueHostingFeeCents?: number;
  onboardingFeeCents?: number;
  transactionCommissionBps?: number;
  paymentProviderFeeBps?: number;
  paymentProviderFixedFeeCents?: number;
  includedSkuCount?: number;
  includedTestCount?: number;
  includedStorageMb?: number;
  includedBranches?: number;
  monthlyOrderLimit?: number;
  autoAssignRules?: {
    minSkuCount?: number | null;
    maxSkuCount?: number | null;
    minTestCount?: number | null;
    maxTestCount?: number | null;
    minStorageMb?: number | null;
    maxStorageMb?: number | null;
    minMonthlyOrders?: number | null;
    maxMonthlyOrders?: number | null;
  };
};

type PartnerTierConfig = {
  version?: number;
  tiers: PartnerTier[];
};

function configuredInt(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

function defaultPartnerTierConfig(): PartnerTierConfig {
  return { version: 1, tiers: [] };
}

function normalizePartnerTier(raw: any, index: number): PartnerTier {
  const module = clean(raw?.module, 24).toLowerCase() === "medreach" ? "medreach" : "careport";
  const partnerType = clean(raw?.partnerType, 24).toLowerCase() === "lab" ? "lab" : "pharmacy";
  const id =
    clean(raw?.id, 96)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || `${module}-${partnerType}-${index + 1}`;

  return {
    id,
    module,
    partnerType,
    name: clean(raw?.name, 160) || id,
    enabled: raw?.enabled !== false,
    currency: clean(raw?.currency, 3).toUpperCase() || "ZAR",
    monthlyPlatformFeeCents: asInt(raw?.monthlyPlatformFeeCents, 0),
    catalogueHostingFeeCents: asInt(raw?.catalogueHostingFeeCents, 0),
    onboardingFeeCents: asInt(raw?.onboardingFeeCents, 0),
    transactionCommissionBps: asInt(raw?.transactionCommissionBps, 0, 0, 10000),
    paymentProviderFeeBps: asInt(raw?.paymentProviderFeeBps, 0, 0, 2000),
    paymentProviderFixedFeeCents: asInt(raw?.paymentProviderFixedFeeCents, 0),
    includedSkuCount: asInt(raw?.includedSkuCount, 0),
    includedTestCount: asInt(raw?.includedTestCount, 0),
    includedStorageMb: asInt(raw?.includedStorageMb, 0),
    includedBranches: asInt(raw?.includedBranches, 0),
    monthlyOrderLimit: asInt(raw?.monthlyOrderLimit, 0),
    autoAssignRules: raw?.autoAssignRules && typeof raw.autoAssignRules === "object" ? raw.autoAssignRules : {},
  };
}

function normalizePartnerTierConfig(raw: any): PartnerTierConfig {
  const rows = Array.isArray(raw?.tiers) ? raw.tiers : [];

  return {
    version: 1,
    tiers: rows.map((row: any, index: number) => normalizePartnerTier(row, index)),
  };
}

async function loadPartnerTierConfig(orgId: string) {
  const delegate = settingsDelegate();

  if (!delegate?.findUnique && !delegate?.findFirst) {
    return { config: defaultPartnerTierConfig(), source: "defaults" as const, persistence: "missing_model" as const };
  }

  const row = delegate.findUnique
    ? await delegate.findUnique({ where: { orgId_key: { orgId, key: PARTNER_TIER_KEY } } }).catch(() => null)
    : await delegate.findFirst({ where: { orgId, key: PARTNER_TIER_KEY }, orderBy: { updatedAt: "desc" } }).catch(() => null);

  const value = row?.value && typeof row.value === "object" ? row.value : null;

  return {
    config: normalizePartnerTierConfig(value || defaultPartnerTierConfig()),
    source: value ? ("database" as const) : ("defaults" as const),
    persistence: "available" as const,
  };
}

function metricWithin(value: number | null | undefined, min: unknown, max: unknown) {
  if (value === null || value === undefined) return true;

  const lower = Number(min);
  const upper = Number(max);

  if (Number.isFinite(lower) && value < lower) return false;
  if (Number.isFinite(upper) && value > upper) return false;

  return true;
}

function resolvePartnerCommercialTier(
  config: PartnerTierConfig,
  module: "careport" | "medreach",
  partnerType: "pharmacy" | "lab",
  metrics: { skuCount?: number | null; testCount?: number | null; storageMb?: number | null; monthlyOrders?: number | null },
) {
  const candidates = (config.tiers || []).filter((tier) => tier.enabled && tier.module === module && tier.partnerType === partnerType);

  const matched =
    candidates.find((tier) => {
      const rules = tier.autoAssignRules || {};

      return (
        metricWithin(metrics.skuCount, rules.minSkuCount, rules.maxSkuCount) &&
        metricWithin(metrics.testCount, rules.minTestCount, rules.maxTestCount) &&
        metricWithin(metrics.storageMb, rules.minStorageMb, rules.maxStorageMb) &&
        metricWithin(metrics.monthlyOrders, rules.minMonthlyOrders, rules.maxMonthlyOrders)
      );
    }) ||
    candidates[0] ||
    null;

  return {
    tier: matched,
    source: matched ? "partner_commercial_tiers" : "commercial_policy_default",
    metrics,
  };
}

function tierSnapshot(match: ReturnType<typeof resolvePartnerCommercialTier>) {
  const tier = match.tier;

  if (!tier) {
    return {
      source: match.source,
      tierId: null,
      tierName: null,
      metrics: match.metrics,
    };
  }

  return {
    source: match.source,
    tierId: tier.id,
    tierName: tier.name,
    monthlyPlatformFeeCents: asInt(tier.monthlyPlatformFeeCents, 0),
    catalogueHostingFeeCents: asInt(tier.catalogueHostingFeeCents, 0),
    onboardingFeeCents: asInt(tier.onboardingFeeCents, 0),
    transactionCommissionBps: asInt(tier.transactionCommissionBps, 0),
    paymentProviderFeeBps: asInt(tier.paymentProviderFeeBps, 0),
    paymentProviderFixedFeeCents: asInt(tier.paymentProviderFixedFeeCents, 0),
    metrics: match.metrics,
  };
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

function buildSettlementPreview(orders: any[], policy: Policy, partnerTierConfig: PartnerTierConfig = defaultPartnerTierConfig()) {
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
        paidCents: 0,
        paidMinor: 0,
        platformFeeCents: 0,
        platformFeeMinor: 0,
        paymentProviderFeeCents: 0,
        paymentProviderFeeMinor: 0,
        monthlyFeeCents: 0,
        subscriptionFeeMinor: 0,
        inventoryHostingFeeCents: 0,
        inventoryHostingFeeMinor: 0,
        partnerTier: null,
        partnerTierId: null,
        partnerTierName: null,
        partnerTierSource: null,
        partnerTierMetrics: null,
        netCents: 0,
        netPayableMinor: 0,
        orderIds: [],
      };
      row.orders += 1;
      row.orderCount += 1;
      row.grossCents += subtotal;
      row.grossMinor += subtotal;
      row.paidCents += paid;
      row.paidMinor += paid;
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
    const rowGrossCents = Number(row.grossCents || row.grossMinor || 0);
    const rowPaidCents = Number(row.paidCents || row.paidMinor || rowGrossCents || 0);
    const oldCommissionFee = Number(row.platformFeeCents || row.platformFeeMinor || 0);
    const oldProviderFee = providerFee(rowPaidCents, policy);

    const match = resolvePartnerCommercialTier(partnerTierConfig, "careport", "pharmacy", {
      monthlyOrders: Number(row.orderCount || row.orders || 0),
      skuCount: null,
      storageMb: null,
      testCount: null,
    });
    const tier = match.tier;
    const appliedTier = tierSnapshot(match);

    const effectiveCommissionBps = configuredInt(tier?.transactionCommissionBps, policy.platformCommissionBps);
    const effectiveProviderBps = configuredInt(tier?.paymentProviderFeeBps, policy.paymentProviderFeeBps);
    const effectiveProviderFixed = configuredInt(tier?.paymentProviderFixedFeeCents, policy.paymentProviderFixedFeeCents);
    const effectiveMonthlyFee = configuredInt(tier?.monthlyPlatformFeeCents, policy.pharmacyMonthlyPlatformFeeCents);
    const effectiveHostingFee = configuredInt(tier?.catalogueHostingFeeCents, policy.pharmacyInventoryHostingFeeCents);

    const recalculatedCommission = commission(rowGrossCents, effectiveCommissionBps);
    const recalculatedProvider = providerFee(rowPaidCents, {
      ...policy,
      paymentProviderFeeBps: effectiveProviderBps,
      paymentProviderFixedFeeCents: effectiveProviderFixed,
    });

    const oldPlatformContribution = oldCommissionFee + (policy.passPaymentProviderFeeToPharmacy ? 0 : oldProviderFee);
    const newPlatformContribution = recalculatedCommission + (policy.passPaymentProviderFeeToPharmacy ? 0 : recalculatedProvider);

    platformFees += newPlatformContribution - oldPlatformContribution;
    providerFees += recalculatedProvider - oldProviderFee;

    row.platformFeeCents = recalculatedCommission;
    row.platformFeeMinor = recalculatedCommission;
    row.paymentProviderFeeCents = policy.passPaymentProviderFeeToPharmacy ? recalculatedProvider : 0;
    row.paymentProviderFeeMinor = row.paymentProviderFeeCents;
    row.monthlyFeeCents = effectiveMonthlyFee;
    row.subscriptionFeeMinor = effectiveMonthlyFee;
    row.inventoryHostingFeeCents = effectiveHostingFee;
    row.inventoryHostingFeeMinor = effectiveHostingFee;
    row.partnerTier = appliedTier;
    row.partnerTierId = appliedTier.tierId;
    row.partnerTierName = appliedTier.tierName;
    row.partnerTierSource = appliedTier.source;
    row.partnerTierMetrics = appliedTier.metrics;
    row.netCents = Math.max(0, rowGrossCents - row.platformFeeCents - row.paymentProviderFeeCents - row.monthlyFeeCents - row.inventoryHostingFeeCents);
    row.netPayableMinor = row.netCents;

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
    const partnerTiers = await loadPartnerTierConfig(orgId);
    const orders = await loadOrders(orgId, from, to, includePaid);
    const preview = buildSettlementPreview(orders, loadedPolicy.policy, partnerTiers.config);
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
    const partnerTiers = await loadPartnerTierConfig(orgId);
    const policy = normalizePolicy({ ...loadedPolicy.policy, ...(body?.policyOverride || {}) });

    const orders = await loadOrders(orgId, from, to, includePaid);
    const preview = buildSettlementPreview(orders, policy, partnerTiers.config);

    if (dryRun) {
      return json({ ok: true, dryRun: true, orgId, from, to, includePaid, policy: { policy, source: loadedPolicy.source }, partnerTiers: { source: partnerTiers.source, persistence: partnerTiers.persistence }, ...preview, payouts: [] });
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
          settlementSnapshot: { batchId: batch.id, policy, partnerTiers: { source: partnerTiers.source, applied: preview.pharmacy.map((row: any) => row.partnerTier).filter(Boolean) }, generatedAt: new Date().toISOString() } as any,
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
    return json({ ok: true, dryRun: false, orgId, from, to, includePaid, policy: { policy, source: loadedPolicy.source }, partnerTiers: { source: partnerTiers.source, persistence: partnerTiers.persistence }, ...preview, batch, payouts: createdLines });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "careport_finance_settlement_failed" }, e?.status || 500);
  }
}
