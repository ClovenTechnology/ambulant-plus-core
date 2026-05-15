// apps/clinician-app/app/api/clinicians/me/payout-settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PlanTierId = 'solo' | 'starter' | 'team' | 'group';
type SmartIdDispatchOption = 'collect' | 'courier';
type BillingCycle = 'monthly' | 'annual';

const ALLOWED_PLAN_IDS: PlanTierId[] = ['solo', 'starter', 'team', 'group'];

function normalizePlanId(raw: unknown): PlanTierId {
  if (typeof raw === 'string' && ALLOWED_PLAN_IDS.includes(raw as PlanTierId)) {
    return raw as PlanTierId;
  }

  return 'solo';
}

function normalizeBillingCycle(raw: unknown): BillingCycle {
  return raw === 'annual' ? 'annual' : 'monthly';
}

function normalizeDispatch(raw: unknown): SmartIdDispatchOption {
  return raw === 'courier' ? 'courier' : 'collect';
}

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function parseObject(value: unknown): Record<string, any> {
  if (!value) return {};

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, any>)
        : {};
    } catch {
      return {};
    }
  }

  return {};
}

/**
 * Current dev-only "current clinician".
 * Mirrors /api/me: first clinician by createdAt.
 *
 * Important:
 * Current Prisma ClinicianProfile does not expose a `metadata` relation.
 * Profile/onboarding data is stored on ClinicianProfile.meta.
 */
async function getCurrentClinician() {
  return prisma.clinicianProfile.findFirst({
    orderBy: { createdAt: 'asc' },
  });
}

function getProfileJson(clinician: any): Record<string, any> {
  const meta = parseObject(clinician?.meta);

  if (meta.rawProfile && typeof meta.rawProfile === 'object') {
    return meta.rawProfile as Record<string, any>;
  }

  if (typeof meta.rawProfileJson === 'string') {
    return parseObject(meta.rawProfileJson);
  }

  return meta;
}

function buildResponse(clinician: any, profileJson: Record<string, any>) {
  const payout = parseObject(profileJson.payoutSettings);

  const currentPlanId = normalizePlanId(payout.planTierId);
  const billingCycle = normalizeBillingCycle(payout.billingCycle);
  const smartIdDispatch = normalizeDispatch(payout.smartIdDispatch);

  const maxAdminStaffSlots =
    typeof payout.maxAdminStaffSlotsOverride === 'number'
      ? payout.maxAdminStaffSlotsOverride
      : null;

  const activeAdminStaffSlots =
    typeof payout.activeAdminStaffSlots === 'number'
      ? payout.activeAdminStaffSlots
      : 0;

  return {
    ok: true,
    clinicianId: clinician.id,
    currentPlanId,
    smartIdDispatch,
    billingCycle,
    maxAdminStaffSlots,
    activeAdminStaffSlots,
  };
}

/**
 * GET /api/clinicians/me/payout-settings
 */
export async function GET(_req: NextRequest) {
  try {
    const clinician = await getCurrentClinician();

    if (!clinician) {
      return json({ ok: false, error: 'no_clinician_found' }, 404);
    }

    const profileJson = getProfileJson(clinician);

    return json(buildResponse(clinician, profileJson));
  } catch (err: any) {
    console.error('GET /api/clinicians/me/payout-settings error', err);

    return json(
      {
        ok: false,
        error: err?.message || 'failed_to_load_payout_settings',
      },
      500,
    );
  }
}

/**
 * PUT /api/clinicians/me/payout-settings
 *
 * Body:
 * - planTierId: PlanTierId
 * - smartIdDispatch: 'collect' | 'courier'
 * - billingCycle: 'monthly' | 'annual'
 */
export async function PUT(req: NextRequest) {
  try {
    const clinician = await getCurrentClinician();

    if (!clinician) {
      return json({ ok: false, error: 'no_clinician_found' }, 404);
    }

    const body = await req.json().catch(() => ({} as any));

    const planTierId = normalizePlanId(body.planTierId);
    const billingCycle = normalizeBillingCycle(body.billingCycle);
    const smartIdDispatch = normalizeDispatch(body.smartIdDispatch);

    const clinicianAny = clinician as any;
    const existingMeta = parseObject(clinicianAny.meta);
    const profileJson = getProfileJson(clinician);

    const prevPayout = parseObject(profileJson.payoutSettings);

    const nextProfileJson = {
      ...profileJson,
      payoutSettings: {
        ...prevPayout,
        planTierId,
        billingCycle,
        smartIdDispatch,
      },
    };

    const nextMeta = {
      ...existingMeta,
      rawProfile: nextProfileJson,
      rawProfileJson: JSON.stringify(nextProfileJson),
    };

    const updated = await prisma.clinicianProfile.update({
      where: { id: clinician.id },
      data: {
        meta: nextMeta as any,
      } as any,
    });

    const updatedProfileJson = getProfileJson(updated);

    return json(buildResponse(updated, updatedProfileJson));
  } catch (err: any) {
    console.error('PUT /api/clinicians/me/payout-settings error', err);

    return json(
      {
        ok: false,
        error: err?.message || 'failed_to_update_payout_settings',
      },
      500,
    );
  }
}