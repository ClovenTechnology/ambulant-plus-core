import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { readIdentity } from "@/src/lib/identity";
import { orgIdFromHeaders, requireRole } from "@/src/lib/careport";
// A5_G_F_B_CAREPORT_PAYSTACK_TRANSFER_ROUTE_IMPORTS
import {
  buildPaystackTransferReference,
  checkPaystackTransferBalance,
  createPaystackTransferRecipient,
  extractPartnerBankDetails,
  initiatePaystackTransfer,
  paystackBankDetailsReady,
} from '@/src/payments/paystack-transfers';

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


// A5_G_F_B_CAREPORT_PAYSTACK_TRANSFER_ROUTE_HELPERS
function a5gfJsonObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function a5gfText(value: unknown, max = 512) {
  const raw = value === undefined || value === null ? '' : String(value);
  return raw.trim().slice(0, max);
}

function a5gfIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => a5gfText(item, 180)).filter(Boolean);
  }

  const one = a5gfText(value, 180);
  return one ? [one] : [];
}

async function a5gfFindFirstSafe(delegate: any, queries: any[]) {
  if (!delegate?.findFirst && !delegate?.findUnique) return null;

  for (const query of queries) {
    try {
      if (delegate.findFirst) {
        const found = await delegate.findFirst(query);
        if (found) return found;
      }
    } catch {}

    try {
      if (delegate.findUnique && query?.where?.id) {
        const found = await delegate.findUnique({ where: { id: query.where.id } });
        if (found) return found;
      }
    } catch {}
  }

  return null;
}

async function a5gfLoadCarePortSettlementRecipientProfile(db: any, line: any) {
  const recipientType = a5gfText(line?.recipientType, 40).toUpperCase();
  const recipientId = a5gfText(line?.recipientId, 180);

  if (!recipientId) return null;

  if (recipientType === 'PHARMACY') {
    const delegates = [
      db.pharmacyPartner,
      db.carePortPharmacy,
      db.carePortPharmacyPartner,
    ].filter(Boolean);

    for (const delegate of delegates) {
      const found = await a5gfFindFirstSafe(delegate, [
        { where: { id: recipientId } },
        { where: { pharmacyId: recipientId } },
      ]);

      if (found) return found;
    }
  }

  if (recipientType === 'RIDER' || recipientType === 'COURIER') {
    const delegates = [
      db.carePortRiderProfile,
      db.carePortRider,
      db.riderProfile,
      db.user,
    ].filter(Boolean);

    for (const delegate of delegates) {
      const found = await a5gfFindFirstSafe(delegate, [
        { where: { id: recipientId } },
        { where: { userId: recipientId } },
        { where: { riderUserId: recipientId } },
      ]);

      if (found) return found;
    }
  }

  return null;
}

function a5gfCarePortTransferStatus(paystackStatus: string) {
  const status = a5gfText(paystackStatus, 40).toLowerCase();

  if (status === 'success') return 'PAID';
  if (status === 'failed' || status === 'abandoned' || status === 'reversed') return 'FAILED';

  return 'PENDING';
}

function a5gfExtractCarePortBankDetails(line: any, profile: any) {
  const lineMeta = a5gfJsonObject(line?.metadata);
  const profileMeta = a5gfJsonObject(profile?.profileMeta);
  const verifiedIdentityMeta = a5gfJsonObject(profile?.verifiedIdentityMeta);
  const metadata = a5gfJsonObject(profile?.metadata);
  const kycPayload = a5gfJsonObject(profile?.kycPayload);
  const kyiPayload = a5gfJsonObject(profile?.kyiPayload);

  const candidates = [
    profile,
    profileMeta,
    verifiedIdentityMeta,
    metadata,
    kycPayload,
    kyiPayload,
    lineMeta,
    a5gfJsonObject(lineMeta.breakdown),
    {
      ...a5gfJsonObject(profile),
      meta: {
        ...lineMeta,
        ...metadata,
        ...profileMeta,
        ...verifiedIdentityMeta,
        ...kycPayload,
        ...kyiPayload,
      },
      payoutMeta: lineMeta,
      profileMeta,
      verifiedIdentityMeta,
      kycPayload,
      kyiPayload,
    },
  ];

  for (const candidate of candidates) {
    const details = extractPartnerBankDetails(candidate);
    if (paystackBankDetailsReady(details)) return details;
  }

  return null;
}

async function a5gfSendCarePortPaystackTransferForLine(db: any, line: any, orgId: string, actorRole: string) {
  const currentMeta = a5gfJsonObject(line?.metadata);
  const profile = await a5gfLoadCarePortSettlementRecipientProfile(db, line);
  const bankDetails = a5gfExtractCarePortBankDetails(line, profile);

  if (!paystackBankDetailsReady(bankDetails)) {
    return {
      ok: false,
      settlementLineId: line?.id,
      batchId: line?.batchId || null,
      recipientType: line?.recipientType,
      recipientId: line?.recipientId,
      status: 'skipped',
      error: 'recipient_bank_details_missing_or_incomplete',
    };
  }

  const existingTransfer = a5gfJsonObject(currentMeta.paystackTransfer);
  const existingRecipientCode =
    a5gfText(existingTransfer.recipientCode || bankDetails?.paystackRecipientCode, 180) || null;

  const recipient = existingRecipientCode
    ? {
        recipientCode: existingRecipientCode,
        raw: { source: 'existing_recipient_code' },
      }
    : await createPaystackTransferRecipient({
        name: bankDetails!.accountName,
        accountNumber: bankDetails!.accountNumber,
        bankCode: bankDetails!.bankCode,
        currency: bankDetails!.currency || line?.currency || 'ZAR',
        country: bankDetails!.country || 'ZA',
        metadata: {
          source: 'ambulant_careport_settlement_line_payout',
          orgId,
          settlementLineId: line?.id,
          batchId: line?.batchId || null,
          recipientType: line?.recipientType,
          recipientId: line?.recipientId,
        },
      });

  const reference =
    a5gfText(existingTransfer.reference || line?.remittanceRef, 180) ||
    buildPaystackTransferReference(['ambulant', 'careport', 'settlement-line', line?.id]);

  const amountCents = Number(line?.netPayableMinor || line?.netPayableCents || 0);

  const transfer = await initiatePaystackTransfer({
    amountCents,
    recipientCode: recipient.recipientCode,
    reference,
    currency: line?.currency || bankDetails!.currency || 'ZAR',
    reason: 'Ambulant+ CarePort partner settlement',
    metadata: {
      source: 'ambulant_careport_settlement_line_payout',
      orgId,
      settlementLineId: line?.id,
      batchId: line?.batchId || null,
      recipientType: line?.recipientType,
      recipientId: line?.recipientId,
      generatedByRole: actorRole,
    },
  });

  const nextStatus = a5gfCarePortTransferStatus(transfer.status);
  const now = new Date();

  const nextMeta: any = {
    ...currentMeta,
    paystackTransfer: {
      provider: 'paystack',
      transferEnabled: true,
      reference: transfer.reference || reference,
      transferCode: transfer.transferCode || existingTransfer.transferCode || null,
      recipientCode: transfer.recipientCode || recipient.recipientCode,
      status: transfer.status,
      amountCents: transfer.amountCents ?? amountCents,
      currency: transfer.currency || line?.currency || bankDetails!.currency || 'ZAR',
      message: transfer.message || null,
      submittedAt: now.toISOString(),
      submittedByRole: actorRole,
      recipientSource: existingRecipientCode ? 'existing' : 'created',
      bankDetailsSource: bankDetails!.source || null,
      raw: transfer.raw,
    },
  };

  const updateData: any = {
    metadata: nextMeta,
    remittanceRef: transfer.reference || reference,
    status: nextStatus,
  };

  if (nextStatus === 'PAID') {
    updateData.paidAt = now;
    updateData.failedAt = null;
    updateData.failureReason = null;
  }

  if (nextStatus === 'FAILED') {
    updateData.failedAt = now;
    updateData.failureReason = transfer.message || 'paystack_transfer_failed';
    nextMeta.failureReason = updateData.failureReason;
    nextMeta.paystackTransfer.failureReason = updateData.failureReason;
  }

  const updated = await db.carePortSettlementLine.update({
    where: { id: line.id },
    data: updateData,
  });

  await db.auditEvent?.create?.({
    data: {
      kind: 'careport_paystack_transfer_submitted',
      actorId: null,
      actorRole: actorRole || 'admin',
      subjectId: line.id,
      meta: {
        orgId,
        batchId: line?.batchId || null,
        settlementLineId: line?.id,
        recipientType: line?.recipientType,
        recipientId: line?.recipientId,
        reference: transfer.reference || reference,
        transferCode: transfer.transferCode || null,
        paystackStatus: transfer.status,
        settlementStatus: nextStatus,
      },
      at: new Date(),
    },
  }).catch(() => null);

  return {
    ok: true,
    settlementLineId: line.id,
    batchId: line.batchId || null,
    recipientType: line.recipientType,
    recipientId: line.recipientId,
    amountCents,
    currency: transfer.currency || line?.currency || bankDetails!.currency || 'ZAR',
    paystackStatus: transfer.status,
    settlementStatus: nextStatus,
    paid: nextStatus === 'PAID',
    failed: nextStatus === 'FAILED',
    reference: transfer.reference || reference,
    transferCode: transfer.transferCode || null,
    recipientCode: transfer.recipientCode || recipient.recipientCode,
    updated,
  };
}

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ["admin", "admin_staff"]);
    const body = await req.json().catch(() => ({}));
    const action = clean(body?.action || "generate", 40).toLowerCase();
    const db: any = prisma;


    if (action === "check_paystack_balance" || action === "paystack_balance") {
      const currency = clean(body?.currency || "ZAR", 8).toUpperCase() || "ZAR";
      const balance = await checkPaystackTransferBalance(currency);

      return json({
        ok: true,
        action,
        provider: "paystack",
        transferEnabled: true,
        balance,
      });
    }

    if (["send_paystack_transfer", "send_paystack_transfers", "paystack_transfer"].includes(action)) {
      const settlementLineIds = a5gfIds(body?.settlementLineIds || body?.settlementLineId || body?.lineIds || body?.lineId || body?.ids);
      const batchId = clean(body?.batchId, 120);

      if (!settlementLineIds.length && !batchId) {
        return json({ ok: false, error: "settlementLineIds_or_batchId_required" }, 400);
      }

      if (!db.carePortSettlementLine?.findMany || !db.carePortSettlementLine?.update) {
        return json({ ok: false, error: "careport_settlement_line_transfer_update_not_configured" }, 501);
      }

      const lineWhere = settlementLineIds.length
        ? { orgId, id: { in: settlementLineIds } }
        : { orgId, batchId };

      const lines = await db.carePortSettlementLine.findMany({
        where: lineWhere,
        orderBy: { createdAt: "asc" },
      });

      const transferActorRole = a5gfText(who.role || req.headers.get("x-user-role") || req.headers.get("x-role") || "admin", 80);

      const results: any[] = [];
      const skipped: any[] = [];

      for (const line of lines) {
        if (String(line?.status || "").toUpperCase() === "PAID") {
          skipped.push({
            settlementLineId: line.id,
            batchId: line.batchId || null,
            reason: "already_paid",
            remittanceRef: line.remittanceRef || null,
          });
          continue;
        }

        if (Number(line?.netPayableMinor || 0) <= 0) {
          skipped.push({
            settlementLineId: line.id,
            batchId: line.batchId || null,
            reason: "net_amount_not_positive",
          });
          continue;
        }

        try {
          results.push(await a5gfSendCarePortPaystackTransferForLine(db, line, orgId, transferActorRole));
        } catch (error: any) {
          results.push({
            ok: false,
            settlementLineId: line.id,
            batchId: line.batchId || null,
            recipientType: line.recipientType,
            recipientId: line.recipientId,
            status: "failed",
            error: error?.message || "careport_paystack_transfer_failed",
            payload: error?.payload || null,
          });
        }
      }

      return json({
        ok: true,
        action,
        provider: "paystack",
        transferEnabled: true,
        requestedLineCount: settlementLineIds.length,
        batchId: batchId || null,
        foundLineCount: lines.length,
        transferredCount: results.filter((row: any) => row?.ok).length,
        failedCount: results.filter((row: any) => row?.ok === false).length,
        skippedCount: skipped.length,
        transferResults: results,
        skippedSettlementLines: skipped,
      });
    }

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
