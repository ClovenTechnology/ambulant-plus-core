import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { orgIdFromHeaders, requireRole } from "@/src/lib/careport";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KEY = "medreach.commercial_policy";

type SettlementCycle = "daily" | "weekly" | "monthly";

type MedReachCommercialPolicy = {
  currency: string;
  country: string;

  labOnboardingFeeCents: number;
  labMonthlyPlatformFeeCents: number;
  labCatalogueHostingFeeCents: number;
  labTestHostingFeeCents: number;

  labCommissionBps: number;
  medreachCommissionBps: number;

  paymentProviderFeeBps: number;
  paymentProviderFixedFeeCents: number;
  passPaymentProviderFeeToLab: boolean;

  phlebCalloutFeeCents: number;
  phlebPerKmFeeCents: number;
  phlebUrgentDrawSurchargeCents: number;
  specimenTransportBaseFeeCents: number;
  specimenTransportPerKmFeeCents: number;
  coldChainSurchargeCents: number;

  labPayoutHoldDays: number;
  phlebPayoutHoldDays: number;
  settlementCycle: SettlementCycle;

  allowPhlebSelfSetCalloutFee: boolean;
  requireAdminApprovalForFeeChanges: boolean;
  medicalAidEnabled: boolean;
  medicalAidRequiresPreflight: boolean;
};

const DEFAULT_POLICY: MedReachCommercialPolicy = {
  currency: "ZAR",
  country: "ZA",

  labOnboardingFeeCents: 0,
  labMonthlyPlatformFeeCents: 0,
  labCatalogueHostingFeeCents: 0,
  labTestHostingFeeCents: 0,

  labCommissionBps: 0,
  medreachCommissionBps: 0,

  paymentProviderFeeBps: 0,
  paymentProviderFixedFeeCents: 0,
  passPaymentProviderFeeToLab: false,

  phlebCalloutFeeCents: 0,
  phlebPerKmFeeCents: 0,
  phlebUrgentDrawSurchargeCents: 0,
  specimenTransportBaseFeeCents: 0,
  specimenTransportPerKmFeeCents: 0,
  coldChainSurchargeCents: 0,

  labPayoutHoldDays: 2,
  phlebPayoutHoldDays: 2,
  settlementCycle: "monthly",

  allowPhlebSelfSetCalloutFee: false,
  requireAdminApprovalForFeeChanges: true,
  medicalAidEnabled: false,
  medicalAidRequiresPreflight: true,
};

function clean(value: unknown, max = 64) {
  return String(value || "").trim().slice(0, max);
}

function whoFromHeaders(headers: Headers) {
  return {
    role: clean(headers.get("x-user-role") || headers.get("x-role") || "admin", 64),
    uid: clean(headers.get("x-user-id") || headers.get("x-uid") || "", 128) || null,
    orgId: orgIdFromHeaders(headers),
  } as any;
}

function asBool(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(v)) return true;
    if (["false", "0", "no", "off"].includes(v)) return false;
  }
  return fallback;
}

function asInt(value: unknown, fallback: number, min = 0, max = 100_000_000) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function asCycle(value: unknown): SettlementCycle {
  const s = clean(value, 16).toLowerCase();
  if (s === "daily" || s === "weekly" || s === "monthly") return s;
  return DEFAULT_POLICY.settlementCycle;
}

function normalizePolicy(input: any): MedReachCommercialPolicy {
  const raw = input || {};

  return {
    currency: clean(raw.currency, 3).toUpperCase() || DEFAULT_POLICY.currency,
    country: clean(raw.country, 2).toUpperCase() || DEFAULT_POLICY.country,

    labOnboardingFeeCents: asInt(raw.labOnboardingFeeCents, DEFAULT_POLICY.labOnboardingFeeCents),
    labMonthlyPlatformFeeCents: asInt(raw.labMonthlyPlatformFeeCents, DEFAULT_POLICY.labMonthlyPlatformFeeCents),
    labCatalogueHostingFeeCents: asInt(raw.labCatalogueHostingFeeCents, DEFAULT_POLICY.labCatalogueHostingFeeCents),
    labTestHostingFeeCents: asInt(raw.labTestHostingFeeCents, DEFAULT_POLICY.labTestHostingFeeCents),

    labCommissionBps: asInt(raw.labCommissionBps, DEFAULT_POLICY.labCommissionBps, 0, 5000),
    medreachCommissionBps: asInt(raw.medreachCommissionBps, DEFAULT_POLICY.medreachCommissionBps, 0, 5000),

    paymentProviderFeeBps: asInt(raw.paymentProviderFeeBps, DEFAULT_POLICY.paymentProviderFeeBps, 0, 2000),
    paymentProviderFixedFeeCents: asInt(raw.paymentProviderFixedFeeCents, DEFAULT_POLICY.paymentProviderFixedFeeCents),
    passPaymentProviderFeeToLab: asBool(raw.passPaymentProviderFeeToLab, DEFAULT_POLICY.passPaymentProviderFeeToLab),

    phlebCalloutFeeCents: asInt(raw.phlebCalloutFeeCents, DEFAULT_POLICY.phlebCalloutFeeCents),
    phlebPerKmFeeCents: asInt(raw.phlebPerKmFeeCents, DEFAULT_POLICY.phlebPerKmFeeCents),
    phlebUrgentDrawSurchargeCents: asInt(raw.phlebUrgentDrawSurchargeCents, DEFAULT_POLICY.phlebUrgentDrawSurchargeCents),
    specimenTransportBaseFeeCents: asInt(raw.specimenTransportBaseFeeCents, DEFAULT_POLICY.specimenTransportBaseFeeCents),
    specimenTransportPerKmFeeCents: asInt(raw.specimenTransportPerKmFeeCents, DEFAULT_POLICY.specimenTransportPerKmFeeCents),
    coldChainSurchargeCents: asInt(raw.coldChainSurchargeCents, DEFAULT_POLICY.coldChainSurchargeCents),

    labPayoutHoldDays: asInt(raw.labPayoutHoldDays, DEFAULT_POLICY.labPayoutHoldDays, 0, 60),
    phlebPayoutHoldDays: asInt(raw.phlebPayoutHoldDays, DEFAULT_POLICY.phlebPayoutHoldDays, 0, 60),
    settlementCycle: asCycle(raw.settlementCycle),

    allowPhlebSelfSetCalloutFee: asBool(raw.allowPhlebSelfSetCalloutFee, DEFAULT_POLICY.allowPhlebSelfSetCalloutFee),
    requireAdminApprovalForFeeChanges: asBool(
      raw.requireAdminApprovalForFeeChanges,
      DEFAULT_POLICY.requireAdminApprovalForFeeChanges
    ),
    medicalAidEnabled: asBool(raw.medicalAidEnabled, DEFAULT_POLICY.medicalAidEnabled),
    medicalAidRequiresPreflight: asBool(raw.medicalAidRequiresPreflight, DEFAULT_POLICY.medicalAidRequiresPreflight),
  };
}

function settingsDelegate() {
  const db: any = prisma;
  return (
    db.medReachOperationalSetting ||
    db.medReachSetting ||
    db.medreachSetting ||
    db.carePortOperationalSetting ||
    db.carePortSetting ||
    db.careportSetting ||
    null
  );
}

async function loadPolicy(orgId: string) {
  const delegate = settingsDelegate();

  if (!delegate?.findUnique && !delegate?.findFirst) {
    return {
      policy: DEFAULT_POLICY,
      source: "defaults" as const,
      persistence: "missing_model" as const,
    };
  }

  const row = delegate.findUnique
    ? await delegate.findUnique({ where: { orgId_key: { orgId, key: KEY } } }).catch(() => null)
    : await delegate.findFirst({ where: { orgId, key: KEY }, orderBy: { updatedAt: "desc" } }).catch(() => null);

  const value = row?.value || null;

  return {
    policy: normalizePolicy(value || DEFAULT_POLICY),
    source: value ? ("database" as const) : ("defaults" as const),
    persistence: "available" as const,
  };
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const orgId = orgIdFromHeaders(req.headers);
    const who = whoFromHeaders(req.headers);

    requireRole(who, ["admin", "admin_staff"]);

    const loaded = await loadPolicy(orgId);
    return json({ ok: true, orgId, ...loaded });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || "medreach_commercial_policy_load_failed" }, error?.status || 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = orgIdFromHeaders(req.headers);
    const who = whoFromHeaders(req.headers);

    requireRole(who, ["admin", "admin_staff"]);

    const delegate = settingsDelegate();
    if (!delegate?.create) {
      return json(
        {
          ok: false,
          error: "medreach_operational_settings_model_not_configured",
          message: "Add MedReachOperationalSetting or reuse an org-scoped operational settings model before saving MedReach commercial policy.",
          policy: DEFAULT_POLICY,
          persistence: "missing_model",
        },
        501
      );
    }

    const body = await req.json().catch(() => ({}));
    const policy = normalizePolicy(body?.policy || body || {});

    const existing = delegate.findUnique
      ? await delegate.findUnique({ where: { orgId_key: { orgId, key: KEY } } }).catch(() => null)
      : await delegate.findFirst({ where: { orgId, key: KEY }, orderBy: { updatedAt: "desc" } }).catch(() => null);

    const saved = existing?.id
      ? await delegate.update({ where: { id: existing.id }, data: { value: policy } })
      : await delegate.create({ data: { orgId, key: KEY, value: policy } });

    await (prisma as any).auditEvent?.create?.({
      data: {
        orgId,
        kind: "medreach_commercial_policy_updated",
        actorId: clean(req.headers.get("x-user-id") || "", 128) || null,
        meta: { orgId, settingId: saved?.id || null, policy },
      },
    });

    return json({ ok: true, orgId, source: "database", persistence: "available", policy });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || "medreach_commercial_policy_save_failed" }, error?.status || 500);
  }
}

export async function OPTIONS() {
  return json({ ok: true });
}
