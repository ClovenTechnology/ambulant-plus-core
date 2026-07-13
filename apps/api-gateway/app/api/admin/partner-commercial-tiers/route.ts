import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KEY = "partner.commercial_tiers";

type PartnerModule = "careport" | "medreach";
type PartnerType = "pharmacy" | "lab";

type PartnerTier = {
  id: string;
  module: PartnerModule;
  partnerType: PartnerType;
  name: string;
  description: string;
  enabled: boolean;
  currency: string;
  monthlyPlatformFeeCents: number;
  catalogueHostingFeeCents: number;
  onboardingFeeCents: number;
  transactionCommissionBps: number;
  paymentProviderFeeBps: number;
  paymentProviderFixedFeeCents: number;
  includedSkuCount: number;
  includedTestCount: number;
  includedStorageMb: number;
  includedBranches: number;
  monthlyOrderLimit: number;
  autoAssignRules: {
    minSkuCount: number | null;
    maxSkuCount: number | null;
    minTestCount: number | null;
    maxTestCount: number | null;
    minStorageMb: number | null;
    maxStorageMb: number | null;
    minMonthlyOrders: number | null;
    maxMonthlyOrders: number | null;
  };
};

type TierConfig = {
  version: number;
  tiers: PartnerTier[];
};

function clean(value: unknown, max = 256) {
  return String(value || "").trim().slice(0, max);
}

function asInt(value: unknown, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function nullableInt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n));
}

function moduleOf(value: unknown): PartnerModule {
  return clean(value, 24).toLowerCase() === "medreach" ? "medreach" : "careport";
}

function partnerTypeOf(value: unknown, module: PartnerModule): PartnerType {
  const raw = clean(value, 24).toLowerCase();

  if (module === "medreach") return raw === "pharmacy" ? "pharmacy" : "lab";
  return raw === "lab" ? "lab" : "pharmacy";
}

function tierId(value: unknown, fallback: string) {
  return clean(value, 96)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || fallback;
}

function defaultRules(partial: any = {}) {
  return {
    minSkuCount: nullableInt(partial.minSkuCount),
    maxSkuCount: nullableInt(partial.maxSkuCount),
    minTestCount: nullableInt(partial.minTestCount),
    maxTestCount: nullableInt(partial.maxTestCount),
    minStorageMb: nullableInt(partial.minStorageMb),
    maxStorageMb: nullableInt(partial.maxStorageMb),
    minMonthlyOrders: nullableInt(partial.minMonthlyOrders),
    maxMonthlyOrders: nullableInt(partial.maxMonthlyOrders),
  };
}

function normalizeTier(raw: any, index: number): PartnerTier {
  const module = moduleOf(raw?.module);
  const partnerType = partnerTypeOf(raw?.partnerType, module);
  const fallback = module + "-" + partnerType + "-" + (index + 1);

  return {
    id: tierId(raw?.id, fallback),
    module,
    partnerType,
    name: clean(raw?.name, 120) || (module === "medreach" ? "MedReach" : "CarePort") + " " + partnerType + " tier",
    description: clean(raw?.description, 500),
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
    autoAssignRules: defaultRules(raw?.autoAssignRules || raw?.rules || {}),
  };
}

function defaults(): TierConfig {
  return {
    version: 1,
    tiers: [
      {
        id: "careport-pharmacy-small",
        module: "careport",
        partnerType: "pharmacy",
        name: "CarePort Pharmacy Small",
        description: "Starter tier for smaller pharmacy catalogues and low monthly fulfilment volume.",
        enabled: true,
        currency: "ZAR",
        monthlyPlatformFeeCents: 0,
        catalogueHostingFeeCents: 0,
        onboardingFeeCents: 0,
        transactionCommissionBps: 0,
        paymentProviderFeeBps: 0,
        paymentProviderFixedFeeCents: 0,
        includedSkuCount: 500,
        includedTestCount: 0,
        includedStorageMb: 512,
        includedBranches: 1,
        monthlyOrderLimit: 250,
        autoAssignRules: {
          minSkuCount: 0,
          maxSkuCount: 500,
          minTestCount: null,
          maxTestCount: null,
          minStorageMb: 0,
          maxStorageMb: 512,
          minMonthlyOrders: 0,
          maxMonthlyOrders: 250,
        },
      },
      {
        id: "careport-pharmacy-medium",
        module: "careport",
        partnerType: "pharmacy",
        name: "CarePort Pharmacy Medium",
        description: "Growth tier for larger catalogues, more active SKUs and higher monthly order volume.",
        enabled: true,
        currency: "ZAR",
        monthlyPlatformFeeCents: 0,
        catalogueHostingFeeCents: 0,
        onboardingFeeCents: 0,
        transactionCommissionBps: 0,
        paymentProviderFeeBps: 0,
        paymentProviderFixedFeeCents: 0,
        includedSkuCount: 2000,
        includedTestCount: 0,
        includedStorageMb: 2048,
        includedBranches: 3,
        monthlyOrderLimit: 1000,
        autoAssignRules: {
          minSkuCount: 501,
          maxSkuCount: 2000,
          minTestCount: null,
          maxTestCount: null,
          minStorageMb: 513,
          maxStorageMb: 2048,
          minMonthlyOrders: 251,
          maxMonthlyOrders: 1000,
        },
      },
      {
        id: "careport-pharmacy-large",
        module: "careport",
        partnerType: "pharmacy",
        name: "CarePort Pharmacy Large",
        description: "Enterprise tier for high-volume pharmacies, multi-branch operations and large catalogues.",
        enabled: true,
        currency: "ZAR",
        monthlyPlatformFeeCents: 0,
        catalogueHostingFeeCents: 0,
        onboardingFeeCents: 0,
        transactionCommissionBps: 0,
        paymentProviderFeeBps: 0,
        paymentProviderFixedFeeCents: 0,
        includedSkuCount: 10000,
        includedTestCount: 0,
        includedStorageMb: 10240,
        includedBranches: 20,
        monthlyOrderLimit: 10000,
        autoAssignRules: {
          minSkuCount: 2001,
          maxSkuCount: null,
          minTestCount: null,
          maxTestCount: null,
          minStorageMb: 2049,
          maxStorageMb: null,
          minMonthlyOrders: 1001,
          maxMonthlyOrders: null,
        },
      },
      {
        id: "medreach-lab-small",
        module: "medreach",
        partnerType: "lab",
        name: "MedReach Lab Small",
        description: "Starter tier for labs with a smaller published test menu and lower monthly draw volume.",
        enabled: true,
        currency: "ZAR",
        monthlyPlatformFeeCents: 0,
        catalogueHostingFeeCents: 0,
        onboardingFeeCents: 0,
        transactionCommissionBps: 0,
        paymentProviderFeeBps: 0,
        paymentProviderFixedFeeCents: 0,
        includedSkuCount: 0,
        includedTestCount: 100,
        includedStorageMb: 1024,
        includedBranches: 1,
        monthlyOrderLimit: 250,
        autoAssignRules: {
          minSkuCount: null,
          maxSkuCount: null,
          minTestCount: 0,
          maxTestCount: 100,
          minStorageMb: 0,
          maxStorageMb: 1024,
          minMonthlyOrders: 0,
          maxMonthlyOrders: 250,
        },
      },
      {
        id: "medreach-lab-medium",
        module: "medreach",
        partnerType: "lab",
        name: "MedReach Lab Medium",
        description: "Growth tier for labs with broader catalogues, multiple branches and moderate order volume.",
        enabled: true,
        currency: "ZAR",
        monthlyPlatformFeeCents: 0,
        catalogueHostingFeeCents: 0,
        onboardingFeeCents: 0,
        transactionCommissionBps: 0,
        paymentProviderFeeBps: 0,
        paymentProviderFixedFeeCents: 0,
        includedSkuCount: 0,
        includedTestCount: 1000,
        includedStorageMb: 4096,
        includedBranches: 5,
        monthlyOrderLimit: 1500,
        autoAssignRules: {
          minSkuCount: null,
          maxSkuCount: null,
          minTestCount: 101,
          maxTestCount: 1000,
          minStorageMb: 1025,
          maxStorageMb: 4096,
          minMonthlyOrders: 251,
          maxMonthlyOrders: 1500,
        },
      },
      {
        id: "medreach-lab-large",
        module: "medreach",
        partnerType: "lab",
        name: "MedReach Lab Large",
        description: "Enterprise tier for high-volume labs, large published menus, and multi-branch networks.",
        enabled: true,
        currency: "ZAR",
        monthlyPlatformFeeCents: 0,
        catalogueHostingFeeCents: 0,
        onboardingFeeCents: 0,
        transactionCommissionBps: 0,
        paymentProviderFeeBps: 0,
        paymentProviderFixedFeeCents: 0,
        includedSkuCount: 0,
        includedTestCount: 10000,
        includedStorageMb: 20480,
        includedBranches: 50,
        monthlyOrderLimit: 10000,
        autoAssignRules: {
          minSkuCount: null,
          maxSkuCount: null,
          minTestCount: 1001,
          maxTestCount: null,
          minStorageMb: 4097,
          maxStorageMb: null,
          minMonthlyOrders: 1501,
          maxMonthlyOrders: null,
        },
      },
    ],
  };
}

function normalizeConfig(raw: any): TierConfig {
  const base = raw && typeof raw === "object" ? raw : defaults();
  const rows = Array.isArray(base.tiers) ? base.tiers : defaults().tiers;
  const seen = new Set<string>();
  const tiers: PartnerTier[] = [];

  rows.forEach((row: any, index: number) => {
    const tier = normalizeTier(row, index);
    let id = tier.id;
    let suffix = 2;

    while (seen.has(id)) {
      id = tier.id + "-" + suffix;
      suffix += 1;
    }

    seen.add(id);
    tiers.push({ ...tier, id });
  });

  return {
    version: 1,
    tiers,
  };
}

function settingsDelegate() {
  const db = prisma as any;
  return db.carePortOperationalSetting || db.carePortSetting || db.careportSetting || null;
}

async function loadConfig(orgId: string) {
  const delegate = settingsDelegate();

  if (!delegate?.findFirst && !delegate?.findUnique) {
    return { config: defaults(), source: "defaults" as const, persistence: "missing_model" as const };
  }

  const row = delegate.findUnique
    ? await delegate.findUnique({ where: { orgId_key: { orgId, key: KEY } } }).catch(() => null)
    : await delegate.findFirst({ where: { orgId, key: KEY }, orderBy: { updatedAt: "desc" } }).catch(() => null);

  const value = row?.value && typeof row.value === "object" ? row.value : null;

  return {
    config: normalizeConfig(value || defaults()),
    source: value ? ("database" as const) : ("defaults" as const),
    persistence: "available" as const,
  };
}

function roleOf(req: NextRequest) {
  return clean(req.headers.get("x-user-role") || req.headers.get("x-role") || "admin", 64).toLowerCase();
}

function orgIdOf(req: NextRequest) {
  return clean(req.headers.get("x-org-id") || req.headers.get("x-tenant-id") || "org-default", 128) || "org-default";
}

function canAccess(role: string) {
  return ["admin", "admin_staff", "system"].includes(role);
}

function within(value: number, min: number | null, max: number | null) {
  if (min !== null && value < min) return false;
  if (max !== null && value > max) return false;
  return true;
}

function resolvePartnerCommercialTier(config: TierConfig, query: URLSearchParams) {
  const module = moduleOf(query.get("module"));
  const partnerType = partnerTypeOf(query.get("partnerType"), module);
  const skuCount = asInt(query.get("skuCount"), 0);
  const testCount = asInt(query.get("testCount"), 0);
  const storageMb = asInt(query.get("storageMb"), 0);
  const monthlyOrders = asInt(query.get("monthlyOrders"), 0);

  const candidates = config.tiers.filter((tier) => tier.enabled && tier.module === module && tier.partnerType === partnerType);

  const matched = candidates.find((tier) => {
    const rules = tier.autoAssignRules || defaultRules();

    return (
      within(skuCount, rules.minSkuCount, rules.maxSkuCount) &&
      within(testCount, rules.minTestCount, rules.maxTestCount) &&
      within(storageMb, rules.minStorageMb, rules.maxStorageMb) &&
      within(monthlyOrders, rules.minMonthlyOrders, rules.maxMonthlyOrders)
    );
  });

  return {
    module,
    partnerType,
    metrics: { skuCount, testCount, storageMb, monthlyOrders },
    tier: matched || candidates[0] || null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const role = roleOf(req);

    if (!canAccess(role)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const orgId = orgIdOf(req);
    const loaded = await loadConfig(orgId);
    const query = req.nextUrl.searchParams;

    const includeResolver =
      query.has("module") ||
      query.has("partnerType") ||
      query.has("skuCount") ||
      query.has("testCount") ||
      query.has("storageMb") ||
      query.has("monthlyOrders");

    return NextResponse.json({
      ok: true,
      orgId,
      key: KEY,
      ...loaded,
      resolver: includeResolver ? resolvePartnerCommercialTier(loaded.config, query) : null,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "partner_tiers_load_failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const role = roleOf(req);

    if (!canAccess(role)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const delegate = settingsDelegate();

    if (!delegate?.create && !delegate?.upsert) {
      return NextResponse.json(
        {
          ok: false,
          error: "partner_tier_settings_model_not_configured",
          config: defaults(),
        },
        { status: 501 },
      );
    }

    const orgId = orgIdOf(req);
    const body = await req.json().catch(() => ({}));
    const config = normalizeConfig(body?.config || body || {});
    const existing = delegate.findFirst
      ? await delegate.findFirst({ where: { orgId, key: KEY }, orderBy: { updatedAt: "desc" } }).catch(() => null)
      : null;

    const saved = delegate.upsert
      ? await delegate.upsert({
          where: { orgId_key: { orgId, key: KEY } },
          update: { value: config },
          create: { orgId, key: KEY, value: config },
        }).catch(async () => {
          if (existing?.id) return delegate.update({ where: { id: existing.id }, data: { value: config } });
          return delegate.create({ data: { orgId, key: KEY, value: config } });
        })
      : existing?.id
        ? await delegate.update({ where: { id: existing.id }, data: { value: config } })
        : await delegate.create({ data: { orgId, key: KEY, value: config } });

    await (prisma as any).auditEvent?.create?.({
      data: {
        actorUserId: clean(req.headers.get("x-user-id"), 128) || "system",
        actorRole: role,
        kind: "partner_commercial_tiers_updated",
        subjectType: "partner_commercial_tiers",
        subjectId: saved?.id || KEY,
        meta: { orgId, key: KEY, tierCount: config.tiers.length },
      },
    }).catch(() => null);

    return NextResponse.json({
      ok: true,
      orgId,
      key: KEY,
      source: "database",
      persistence: "available",
      config,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "partner_tiers_save_failed" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({ ok: true });
}
