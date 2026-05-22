import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { readIdentity } from "@/src/lib/identity";
import { orgIdFromHeaders, requireRole } from "@/src/lib/careport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = "careport.commercial_policy";

type CommercialPolicy = {
  currency: string;
  country: string;
  pharmacyOnboardingFeeCents: number;
  pharmacyMonthlyPlatformFeeCents: number;
  pharmacyInventoryHostingFeeCents: number;
  platformCommissionBps: number;
  passPaymentProviderFeeToPharmacy: boolean;
  paymentProviderFeeBps: number;
  paymentProviderFixedFeeCents: number;
  riderDeliveryShareBps: number;
  riderBaseFeeCents: number;
  riderPerKmFeeCents: number;
  settlementCycle: "daily" | "weekly" | "monthly";
  pharmacyPayoutHoldDays: number;
  riderPayoutHoldDays: number;
  medicalAidEnabled: boolean;
  medicalAidRequiresPreflight: boolean;
};

const DEFAULT_POLICY: CommercialPolicy = {
  currency: "ZAR",
  country: "ZA",
  pharmacyOnboardingFeeCents: 0,
  pharmacyMonthlyPlatformFeeCents: 0,
  pharmacyInventoryHostingFeeCents: 0,
  platformCommissionBps: 0,
  passPaymentProviderFeeToPharmacy: false,
  paymentProviderFeeBps: 0,
  paymentProviderFixedFeeCents: 0,
  riderDeliveryShareBps: 10000,
  riderBaseFeeCents: 0,
  riderPerKmFeeCents: 0,
  settlementCycle: "monthly",
  pharmacyPayoutHoldDays: 2,
  riderPayoutHoldDays: 2,
  medicalAidEnabled: true,
  medicalAidRequiresPreflight: true,
};

function clean(v: unknown, max = 120) {
  return String(v ?? "").trim().slice(0, max);
}

function asInt(v: unknown, fallback: number, min = 0, max = 100_000_000) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function asBool(v: unknown, fallback: boolean) {
  if (typeof v === "boolean") return v;
  const s = clean(v, 20).toLowerCase();
  if (["true", "1", "yes", "y"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  return fallback;
}

function asCycle(v: unknown): CommercialPolicy["settlementCycle"] {
  const s = clean(v, 20).toLowerCase();
  if (s === "daily" || s === "weekly" || s === "monthly") return s;
  return DEFAULT_POLICY.settlementCycle;
}

function settingsDelegate() {
  const db: any = prisma;
  return db.carePortOperationalSetting || db.carePortSetting || db.careportSetting || null;
}

function normalizePolicy(input: any): CommercialPolicy {
  return {
    currency: clean(input?.currency, 3).toUpperCase() || DEFAULT_POLICY.currency,
    country: clean(input?.country, 2).toUpperCase() || DEFAULT_POLICY.country,
    pharmacyOnboardingFeeCents: asInt(input?.pharmacyOnboardingFeeCents, DEFAULT_POLICY.pharmacyOnboardingFeeCents),
    pharmacyMonthlyPlatformFeeCents: asInt(input?.pharmacyMonthlyPlatformFeeCents, DEFAULT_POLICY.pharmacyMonthlyPlatformFeeCents),
    pharmacyInventoryHostingFeeCents: asInt(input?.pharmacyInventoryHostingFeeCents, DEFAULT_POLICY.pharmacyInventoryHostingFeeCents),
    platformCommissionBps: asInt(input?.platformCommissionBps, DEFAULT_POLICY.platformCommissionBps, 0, 5000),
    passPaymentProviderFeeToPharmacy: asBool(input?.passPaymentProviderFeeToPharmacy, DEFAULT_POLICY.passPaymentProviderFeeToPharmacy),
    paymentProviderFeeBps: asInt(input?.paymentProviderFeeBps, DEFAULT_POLICY.paymentProviderFeeBps, 0, 2000),
    paymentProviderFixedFeeCents: asInt(input?.paymentProviderFixedFeeCents, DEFAULT_POLICY.paymentProviderFixedFeeCents),
    riderDeliveryShareBps: asInt(input?.riderDeliveryShareBps, DEFAULT_POLICY.riderDeliveryShareBps, 0, 10000),
    riderBaseFeeCents: asInt(input?.riderBaseFeeCents, DEFAULT_POLICY.riderBaseFeeCents),
    riderPerKmFeeCents: asInt(input?.riderPerKmFeeCents, DEFAULT_POLICY.riderPerKmFeeCents),
    settlementCycle: asCycle(input?.settlementCycle),
    pharmacyPayoutHoldDays: asInt(input?.pharmacyPayoutHoldDays, DEFAULT_POLICY.pharmacyPayoutHoldDays, 0, 60),
    riderPayoutHoldDays: asInt(input?.riderPayoutHoldDays, DEFAULT_POLICY.riderPayoutHoldDays, 0, 60),
    medicalAidEnabled: asBool(input?.medicalAidEnabled, DEFAULT_POLICY.medicalAidEnabled),
    medicalAidRequiresPreflight: asBool(input?.medicalAidRequiresPreflight, DEFAULT_POLICY.medicalAidRequiresPreflight),
  };
}

async function loadPolicy(orgId: string) {
  const delegate = settingsDelegate();
  if (!delegate?.findUnique && !delegate?.findFirst) {
    return { policy: DEFAULT_POLICY, source: "defaults" as const, persistence: "missing_model" as const };
  }

  const row = delegate.findUnique
    ? await delegate.findUnique({ where: { orgId_key: { orgId, key: KEY } } }).catch(() => null)
    : await delegate.findFirst({ where: { orgId, key: KEY }, orderBy: { updatedAt: "desc" } }).catch(() => null);

  const value = row?.value ?? row?.json ?? row?.payload ?? row?.metadata ?? null;
  return {
    policy: normalizePolicy(value || DEFAULT_POLICY),
    source: value ? ("database" as const) : ("defaults" as const),
    persistence: "available" as const,
  };
}

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } });
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ["admin", "admin_staff"]);
    const loaded = await loadPolicy(orgId);
    return json({ ok: true, orgId, ...loaded });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "commercial_policy_load_failed" }, e?.status || 500);
  }
}

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ["admin", "admin_staff"]);
    const delegate = settingsDelegate();

    if (!delegate?.upsert && !delegate?.create) {
      return json(
        {
          ok: false,
          error: "careport_operational_settings_model_not_configured",
          message: "Add CarePortOperationalSetting to Prisma schema before saving commercial policy.",
          policy: DEFAULT_POLICY,
        },
        409,
      );
    }

    const body = await req.json().catch(() => ({}));
    const policy = normalizePolicy(body?.policy || body || {});

    let item: any;
    if (delegate.upsert) {
      item = await delegate.upsert({
        where: { orgId_key: { orgId, key: KEY } },
        update: { value: policy },
        create: { orgId, key: KEY, value: policy },
      });
    } else {
      const existing = await delegate.findFirst?.({ where: { orgId, key: KEY } }).catch(() => null);
      item = existing
        ? await delegate.update({ where: { id: existing.id }, data: { value: policy } })
        : await delegate.create({ data: { orgId, key: KEY, value: policy } });
    }

    await (prisma as any).auditEvent?.create?.({
      data: {
        kind: "careport_commercial_policy_updated",
        actorId: who.uid ?? null,
        actorRole: who.role ?? null,
        subjectId: item?.id ?? null,
        meta: { orgId, policy },
      },
    }).catch(() => null);

    return json({ ok: true, orgId, source: "database", persistence: "available", policy });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "commercial_policy_save_failed" }, e?.status || 500);
  }
}