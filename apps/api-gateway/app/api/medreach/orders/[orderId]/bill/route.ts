import { NextRequest, NextResponse } from "next/server";
import { buildMedReachBillableEventsFromOrder } from "@ambulant/client-core/src/medreach";
import { prisma } from "@/src/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLICY_KEY = "medreach.commercial_policy";

type MedReachCommercialPolicy = {
  currency: string;
  country: string;
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
};

const DEFAULT_POLICY: MedReachCommercialPolicy = {
  currency: "ZAR",
  country: "ZA",
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
};

function clean(value: unknown, max = 128) {
  return String(value || "").trim().slice(0, max);
}

function roleOf(req: NextRequest) {
  return clean(req.headers.get("x-user-role") || req.headers.get("x-role") || "admin", 64).toLowerCase();
}

function orgIdFromHeaders(headers: Headers) {
  return clean(headers.get("x-org-id") || headers.get("x-tenant-id") || headers.get("x-organization-id") || "org-default", 128) || "org-default";
}

function asInt(value: unknown, fallback = 0, min = 0, max = 100_000_000) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function safeJson<T = any>(value: unknown): T | null {
  if (!value) return null;
  if (typeof value === "object") return value as T;

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  return null;
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

function normalizePolicy(input: any): MedReachCommercialPolicy {
  const raw = input || {};

  return {
    currency: clean(raw.currency, 3).toUpperCase() || DEFAULT_POLICY.currency,
    country: clean(raw.country, 2).toUpperCase() || DEFAULT_POLICY.country,
    labCommissionBps: asInt(raw.labCommissionBps, DEFAULT_POLICY.labCommissionBps, 0, 5000),
    medreachCommissionBps: asInt(raw.medreachCommissionBps, DEFAULT_POLICY.medreachCommissionBps, 0, 5000),
    paymentProviderFeeBps: asInt(raw.paymentProviderFeeBps, DEFAULT_POLICY.paymentProviderFeeBps, 0, 2000),
    paymentProviderFixedFeeCents: asInt(raw.paymentProviderFixedFeeCents, DEFAULT_POLICY.paymentProviderFixedFeeCents),
    passPaymentProviderFeeToLab: raw.passPaymentProviderFeeToLab === true,
    phlebCalloutFeeCents: asInt(raw.phlebCalloutFeeCents, DEFAULT_POLICY.phlebCalloutFeeCents),
    phlebPerKmFeeCents: asInt(raw.phlebPerKmFeeCents, DEFAULT_POLICY.phlebPerKmFeeCents),
    phlebUrgentDrawSurchargeCents: asInt(raw.phlebUrgentDrawSurchargeCents, DEFAULT_POLICY.phlebUrgentDrawSurchargeCents),
    specimenTransportBaseFeeCents: asInt(raw.specimenTransportBaseFeeCents, DEFAULT_POLICY.specimenTransportBaseFeeCents),
    specimenTransportPerKmFeeCents: asInt(raw.specimenTransportPerKmFeeCents, DEFAULT_POLICY.specimenTransportPerKmFeeCents),
    coldChainSurchargeCents: asInt(raw.coldChainSurchargeCents, DEFAULT_POLICY.coldChainSurchargeCents),
  };
}

async function loadCommercialPolicy(orgId: string) {
  const delegate = settingsDelegate();

  if (!delegate?.findUnique && !delegate?.findFirst) {
    return { policy: DEFAULT_POLICY, source: "defaults", persistence: "missing_model" };
  }

  const row = delegate.findUnique
    ? await delegate.findUnique({ where: { orgId_key: { orgId, key: POLICY_KEY } } }).catch(() => null)
    : await delegate.findFirst({ where: { orgId, key: POLICY_KEY }, orderBy: { updatedAt: "desc" } }).catch(() => null);

  return {
    policy: normalizePolicy(row?.value || DEFAULT_POLICY),
    source: row?.value ? "database" : "defaults",
    persistence: "available",
  };
}

function firstPositive(...values: unknown[]) {
  for (const value of values) {
    const n = asInt(value, 0);
    if (n > 0) return n;
  }

  return 0;
}

function amountFromObject(value: any): number {
  if (!value || typeof value !== "object") return 0;

  return firstPositive(
    value.totalPriceCents,
    value.totalCents,
    value.priceCents,
    value.priceMinor,
    value.amountCents,
    value.derivedPriceCents,
    value.panelPriceCents
  );
}

function sumArrayPrices(value: any): number {
  if (!Array.isArray(value)) return 0;

  return value.reduce((sum, item) => {
    if (!item || typeof item !== "object") return sum;
    return sum + amountFromObject(item);
  }, 0);
}

function deriveSubtotalCents(...snapshots: any[]) {
  for (const snapshot of snapshots) {
    if (!snapshot || typeof snapshot !== "object") continue;

    const direct = amountFromObject(snapshot);
    if (direct > 0) return direct;

    const nested =
      sumArrayPrices(snapshot.tests) ||
      sumArrayPrices(snapshot.panels) ||
      sumArrayPrices(snapshot.items) ||
      sumArrayPrices(snapshot.requestedItems) ||
      sumArrayPrices(snapshot.offers);

    if (nested > 0) return nested;
  }

  return 0;
}

function valueHasColdChain(value: any): boolean {
  if (!value || typeof value !== "object") return false;

  if (value.requiresColdChain === true) return true;
  if (String(value.temperatureBand || "").toUpperCase().includes("COLD")) return true;
  if (String(value.storageCondition || "").toUpperCase().includes("COLD")) return true;

  for (const key of Object.keys(value)) {
    const child = value[key];

    if (Array.isArray(child) && child.some(valueHasColdChain)) return true;
    if (child && typeof child === "object" && valueHasColdChain(child)) return true;
  }

  return false;
}

function valueIsUrgent(value: any): boolean {
  if (!value || typeof value !== "object") return false;

  const text = [
    value.priority,
    value.urgency,
    value.serviceLevel,
    value.collectionPriority,
    value.turnaroundPriority,
  ]
    .map((item) => String(item || "").toUpperCase())
    .join(" ");

  if (text.includes("URGENT") || text.includes("STAT") || text.includes("EXPRESS")) return true;

  for (const key of Object.keys(value)) {
    const child = value[key];

    if (Array.isArray(child) && child.some(valueIsUrgent)) return true;
    if (child && typeof child === "object" && valueIsUrgent(child)) return true;
  }

  return false;
}

function distanceKmFrom(...snapshots: any[]) {
  const keys = ["distanceKm", "routeDistanceKm", "travelDistanceKm", "estimatedDistanceKm", "collectionDistanceKm"];

  for (const snapshot of snapshots) {
    if (!snapshot || typeof snapshot !== "object") continue;

    for (const key of keys) {
      const n = Number(snapshot[key]);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }

  return 0;
}

function commission(amountCents: number, bps: number) {
  return Math.max(0, Math.round((amountCents * bps) / 10000));
}

function paymentProviderFee(amountCents: number, policy: MedReachCommercialPolicy) {
  if (amountCents <= 0) return 0;
  return Math.max(0, Math.round((amountCents * policy.paymentProviderFeeBps) / 10000) + policy.paymentProviderFixedFeeCents);
}

function chooseEligibility(rows: any[]) {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const preferred = ["ACCEPTED", "SELECTED", "ASSIGNED", "ACTIVE", "ELIGIBLE"];
  return (
    rows.find((row) => preferred.includes(String(row?.status || "").toUpperCase())) ||
    rows[0] ||
    null
  );
}

function asObjectValue(value: unknown): Record<string, any> {
  const parsed = safeJson<Record<string, any>>(value);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }

  return parsed;
}

type PhlebFeeSchedule = {
  source: "commercial_policy_default" | "phleb_fee_governance";
  status: string;
  phlebProfileId: string | null;
  phlebUserId: string | null;
  currency: string;
  phlebCalloutFeeCents: number;
  phlebPerKmFeeCents: number;
  phlebUrgentDrawSurchargeCents: number;
};

function resolvePhlebFeeSchedule(phlebProfile: any, policy: MedReachCommercialPolicy): PhlebFeeSchedule {
  const defaults: PhlebFeeSchedule = {
    source: "commercial_policy_default",
    status: "INHERIT_DEFAULT",
    phlebProfileId: phlebProfile?.id || null,
    phlebUserId: phlebProfile?.userId || null,
    currency: policy.currency || "ZAR",
    phlebCalloutFeeCents: policy.phlebCalloutFeeCents,
    phlebPerKmFeeCents: policy.phlebPerKmFeeCents,
    phlebUrgentDrawSurchargeCents: policy.phlebUrgentDrawSurchargeCents,
  };

  const serviceAreaMeta = asObjectValue(phlebProfile?.serviceAreaMeta);
  const feeGovernance = asObjectValue(serviceAreaMeta.feeGovernance);
  const status = clean(feeGovernance.status, 80).toUpperCase();

  if (status !== "ACTIVE") {
    return defaults;
  }

  return {
    source: "phleb_fee_governance",
    status,
    phlebProfileId: phlebProfile?.id || null,
    phlebUserId: phlebProfile?.userId || null,
    currency: clean(feeGovernance.currency, 3).toUpperCase() || defaults.currency,
    phlebCalloutFeeCents: asInt(feeGovernance.phlebCalloutFeeCents, defaults.phlebCalloutFeeCents),
    phlebPerKmFeeCents: asInt(feeGovernance.phlebPerKmFeeCents, defaults.phlebPerKmFeeCents),
    phlebUrgentDrawSurchargeCents: asInt(
      feeGovernance.phlebUrgentDrawSurchargeCents,
      defaults.phlebUrgentDrawSurchargeCents
    ),
  };
}

async function ensureFinancialSnapshot(req: NextRequest, orderId: string) {
  const orgId = orgIdFromHeaders(req.headers);
  const { policy, source, persistence } = await loadCommercialPolicy(orgId);

  const draw = await (prisma as any).draw.findFirst({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  });

  if (!draw) {
    return {
      ok: false,
      status: 404,
      body: { ok: false, error: "draw_not_found_for_order" },
    };
  }

  const [existing, bundle, eligibilityRows] = await Promise.all([
    (prisma as any).medReachOrderFinancial.findUnique({ where: { orderId } }).catch(() => null),
    (prisma as any).medReachSpecimenBundle
      .findFirst({
        where: { OR: [{ orderId }, { drawId: draw.id }] },
        orderBy: { createdAt: "desc" },
      })
      .catch(() => null),
    (prisma as any).medReachOrderEligibleLab.findMany({ where: { orderId } }).catch(() => []),
  ]);

  const eligibility = chooseEligibility(eligibilityRows);
  const drawTests = safeJson<any>((draw as any).testsSnapshot) || {};
  const drawPayer = safeJson<any>((draw as any).payerSnapshot) || {};
  const drawCollection = safeJson<any>((draw as any).collectionWindow) || {};
  const drawMeta = safeJson<any>((draw as any).meta) || {};
  const eligibilityMeta = safeJson<any>(eligibility?.meta) || {};
  const bundleMeta = safeJson<any>(bundle?.meta) || {};

  const headerLabId = clean(req.headers.get("x-lab-id") || req.headers.get("x-staff-lab-id") || "", 128) || null;

  const labId =
    clean((draw as any).partnerId, 128) ||
    clean((bundle as any)?.labId, 128) ||
    clean(eligibility?.labId, 128) ||
    headerLabId ||
    clean(existing?.labId, 128);

  if (!labId) {
    return {
      ok: false,
      status: 409,
      body: {
        ok: false,
        error: "medreach_lab_required_before_billing",
        message: "Assign or select a lab before building MedReach billable events.",
        orderId,
        drawId: draw.id,
      },
    };
  }

  const phlebId =
    clean((bundle as any)?.phlebId, 128) ||
    clean((bundle as any)?.assignedPhlebId, 128) ||
    clean((draw as any).phlebId, 128) ||
    clean((draw as any).assignedPhlebId, 128) ||
    clean(existing?.phlebId, 128) ||
    null;

  const phlebProfile = phlebId
    ? await (prisma as any).medReachPhlebProfile
        .findFirst({
          where: {
            OR: [{ id: phlebId }, { userId: phlebId }],
          },
          select: {
            id: true,
            userId: true,
            serviceAreaMeta: true,
          },
        })
        .catch(() => null)
    : null;

  const phlebFee = resolvePhlebFeeSchedule(phlebProfile, policy);

  const distanceKm = distanceKmFrom(drawCollection, drawMeta, eligibilityMeta, bundleMeta, drawTests);
  const coldChain = valueHasColdChain(drawTests) || valueHasColdChain(eligibilityMeta) || valueHasColdChain(bundleMeta);
  const urgent = valueIsUrgent(drawTests) || valueIsUrgent(drawMeta) || valueIsUrgent(eligibilityMeta);

  const subtotalCents =
    firstPositive(existing?.subtotalCents) ||
    deriveSubtotalCents(eligibilityMeta, drawTests, bundleMeta, drawMeta);

  const phlebGrossCents = phlebId
    ? phlebFee.phlebCalloutFeeCents + Math.round(distanceKm * phlebFee.phlebPerKmFeeCents)
    : firstPositive(existing?.phlebGrossCents);

  const logisticsFeeCents =
    firstPositive(existing?.logisticsFeeCents) ||
    (policy.specimenTransportBaseFeeCents + Math.round(distanceKm * policy.specimenTransportPerKmFeeCents));

  const urgentSurchargeCents = urgent
    ? phlebFee.phlebUrgentDrawSurchargeCents
    : firstPositive(existing?.urgentSurchargeCents);

  const coldChainSurchargeCents =
    firstPositive(existing?.coldChainSurchargeCents) ||
    (coldChain ? policy.coldChainSurchargeCents : 0);

  const labGrossCents = firstPositive(existing?.labGrossCents) || subtotalCents;

  const grossCents =
    labGrossCents +
    phlebGrossCents +
    logisticsFeeCents +
    urgentSurchargeCents +
    coldChainSurchargeCents;

  const effectiveCommissionBps = policy.medreachCommissionBps || policy.labCommissionBps;
  const commissionCents = commission(labGrossCents, effectiveCommissionBps);
  const providerFeeCents = paymentProviderFee(grossCents, policy);

  const platformFeeCents =
    commissionCents + (policy.passPaymentProviderFeeToLab ? 0 : providerFeeCents);

  const labNetCents = Math.max(
    0,
    labGrossCents - commissionCents - (policy.passPaymentProviderFeeToLab ? providerFeeCents : 0)
  );

  const phlebNetCents = phlebGrossCents;

  const sponsorAmountMinor = Math.min(
    grossCents,
    firstPositive(
      existing?.sponsorAmountMinor,
      (draw as any).sponsorAmountMinor,
      drawPayer.sponsorAmountMinor,
      drawPayer.coveredAmountMinor
    )
  );

  const explicitPatientCopay = firstPositive(
    existing?.patientCopayMinor,
    (draw as any).patientCopayMinor,
    drawPayer.patientCopayMinor,
    drawPayer.gapAmountMinor
  );

  const patientCopayMinor = explicitPatientCopay > 0 ? explicitPatientCopay : Math.max(0, grossCents - sponsorAmountMinor);

  const pricingSnapshot = {
    source: "medreach.commercial_policy",
    policySource: source,
    persistence,
    policyKey: POLICY_KEY,
    orderId,
    drawId: draw.id,
    labId,
    phlebId,
    phlebFeeSource: phlebFee.source,
    phlebFeeStatus: phlebFee.status,
    phlebFeePhlebProfileId: phlebFee.phlebProfileId,
    phlebFeeUserId: phlebFee.phlebUserId,
    phlebFeeSchedule: {
      currency: phlebFee.currency,
      phlebCalloutFeeCents: phlebFee.phlebCalloutFeeCents,
      phlebPerKmFeeCents: phlebFee.phlebPerKmFeeCents,
      phlebUrgentDrawSurchargeCents: phlebFee.phlebUrgentDrawSurchargeCents,
    },
    distanceKm,
    coldChain,
    urgent,
    effectiveCommissionBps,
    commissionCents,
    providerFeeCents,
    passPaymentProviderFeeToLab: policy.passPaymentProviderFeeToLab,
    derivedAt: new Date().toISOString(),
  };

  const data: any = {
    drawId: draw.id,
    labId,
    phlebId,
    clientId: (draw as any).clientId ?? existing?.clientId ?? null,
    clientMemberId: (draw as any).clientMemberId ?? existing?.clientMemberId ?? null,
    coveragePlanId: (draw as any).coveragePlanId ?? existing?.coveragePlanId ?? null,
    authorizationId: (draw as any).coverageAuthorizationId ?? existing?.authorizationId ?? null,
    currency: policy.currency || existing?.currency || "ZAR",
    subtotalCents,
    logisticsFeeCents,
    urgentSurchargeCents,
    coldChainSurchargeCents,
    platformFeeCents,
    labGrossCents,
    phlebGrossCents,
    labNetCents,
    phlebNetCents,
    sponsorAmountMinor,
    patientCopayMinor,
    pricingSnapshot,
  };

  const financial = await (prisma as any).medReachOrderFinancial.upsert({
    where: { orderId },
    update: data,
    create: {
      orderId,
      ...data,
    },
  });

  return {
    ok: true,
    status: 200,
    financial,
    policy: {
      source,
      persistence,
      currency: policy.currency,
      effectiveCommissionBps,
      providerFeeCents,
    },
  };
}

export async function POST(req: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    const role = roleOf(req);

    if (!["admin", "admin_staff", "system", "lab", "lab_staff"].includes(role)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const orderId = clean(params.orderId, 128);
    if (!orderId) {
      return NextResponse.json({ ok: false, error: "orderId_required" }, { status: 400 });
    }

    const snapshot = await ensureFinancialSnapshot(req, orderId);
    if (!snapshot.ok) {
      return NextResponse.json(snapshot.body, { status: snapshot.status });
    }

    if (req.nextUrl.searchParams.get("dryRun") === "1") {
      return NextResponse.json(
        {
          ok: true,
          orderId,
          dryRun: true,
          financial: snapshot.financial,
          policy: snapshot.policy,
        },
        { status: 200 }
      );
    }

    const items = await buildMedReachBillableEventsFromOrder(orderId);

    return NextResponse.json(
      {
        ok: true,
        orderId,
        financial: snapshot.financial,
        policy: snapshot.policy,
        createdCount: items.length,
        items,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build MedReach billable events.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest, ctx: { params: { orderId: string } }) {
  return POST(req, ctx);
}

export async function OPTIONS() {
  return NextResponse.json({ ok: true });
}
