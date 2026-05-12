// apps/api-gateway/app/api/clinicians/me/payout-settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PlanTierId = 'solo' | 'starter' | 'team' | 'group';
type SmartIdDispatchOption = 'collect' | 'courier';
type BillingCycle = 'monthly' | 'annual';

const ALLOWED_PLAN_IDS: PlanTierId[] = ['solo', 'starter', 'team', 'group'];

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

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

/**
 * Default max admin slots per plan.
 * Keep this logically in sync with UI PLAN_TIERS.
 *
 * Free/solo plan: 0 active admin staff slots.
 */
function defaultMaxAdminSlotsForPlan(plan: PlanTierId): number {
  switch (plan) {
    case 'solo':
      return 0;
    case 'starter':
      return 2;
    case 'team':
      return 5;
    case 'group':
      return 10;
    default:
      return 0;
  }
}

function parseMeta(raw: unknown): Record<string, any> {
  if (!raw) return {};

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, any>;
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }

  return {};
}

async function getCurrentClinician(req: NextRequest) {
  const who = readIdentity(req.headers);

  if (who.role !== 'clinician' || !who.uid) return null;

  const clinician = await prisma.clinicianProfile.findUnique({
    where: { userId: who.uid },
  });

  return { clinician, who };
}

function loadProfileJson(clinician: any): Record<string, any> {
  const meta = parseMeta(clinician?.meta);
  const rawProfileJson = meta.rawProfileJson ?? meta.rawProfile;

  if (!rawProfileJson) return meta;

  if (typeof rawProfileJson === 'object' && !Array.isArray(rawProfileJson)) {
    return rawProfileJson as Record<string, any>;
  }

  try {
    const parsed = JSON.parse(String(rawProfileJson));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function normalizeStaffArray(raw: any): any[] {
  if (!Array.isArray(raw)) return [];

  return raw.filter((s) => s && typeof s === 'object');
}

function countActiveFromStaff(staff: any[]): number {
  return staff.filter((s) => {
    const status = String(s?.status || '').toLowerCase();
    return status !== 'disabled';
  }).length;
}

function buildUpdatedMeta(clinician: any, profileJson: Record<string, any>) {
  const currentMeta = parseMeta(clinician?.meta);

  return {
    ...currentMeta,
    rawProfileJson: JSON.stringify(profileJson),
  };
}

/**
 * GET /api/clinicians/me/payout-settings
 *
 * Returns:
 * {
 *   ok: true,
 *   clinicianId: string,
 *   currentPlanId: PlanTierId,
 *   smartIdDispatch: 'collect' | 'courier',
 *   billingCycle: 'monthly' | 'annual',
 *   maxAdminStaffSlots: number,
 *   activeAdminStaffSlots: number
 * }
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getCurrentClinician(req);

    if (!ctx || !ctx.clinician) {
      return json({ ok: false, error: 'unauthorized_or_not_found' }, 401);
    }

    const clinician = ctx.clinician;

    const profileJson = loadProfileJson(clinician);
    const payout = profileJson.payoutSettings || {};
    const adminStaffRaw = normalizeStaffArray(profileJson.adminStaff || []);

    const plan = normalizePlanId(payout.planTierId);
    const billingCycle = normalizeBillingCycle(payout.billingCycle);
    const smartIdDispatch = normalizeDispatch(payout.smartIdDispatch);

    const activeFromStaff = countActiveFromStaff(adminStaffRaw);
    const storedActive =
      typeof payout.activeAdminStaffSlots === 'number'
        ? payout.activeAdminStaffSlots
        : 0;

    const activeAdminStaffSlots = activeFromStaff > 0 ? activeFromStaff : storedActive;

    const maxAdminStaffSlots =
      typeof payout.maxAdminStaffSlotsOverride === 'number'
        ? payout.maxAdminStaffSlotsOverride
        : defaultMaxAdminSlotsForPlan(plan);

    const nextProfileJson = {
      ...profileJson,
      payoutSettings: {
        ...payout,
        planTierId: plan,
        billingCycle,
        smartIdDispatch,
        activeAdminStaffSlots,
      },
    };

    await prisma.clinicianProfile.update({
      where: { id: clinician.id },
      data: {
        meta: buildUpdatedMeta(clinician, nextProfileJson),
      },
    });

    return json({
      ok: true,
      clinicianId: clinician.id,
      currentPlanId: plan,
      smartIdDispatch,
      billingCycle,
      maxAdminStaffSlots,
      activeAdminStaffSlots,
    });
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
 *  - planTierId: PlanTierId
 *  - smartIdDispatch: 'collect' | 'courier'
 *  - billingCycle: 'monthly' | 'annual'
 */
export async function PUT(req: NextRequest) {
  try {
    const ctx = await getCurrentClinician(req);

    if (!ctx || !ctx.clinician) {
      return json({ ok: false, error: 'unauthorized_or_not_found' }, 401);
    }

    const clinician = ctx.clinician;
    const body = await req.json().catch(() => ({} as any));

    const profileJson = loadProfileJson(clinician);
    const prevPayout = profileJson.payoutSettings || {};
    const adminStaffRaw = normalizeStaffArray(profileJson.adminStaff || []);

    const planTierId = normalizePlanId(body.planTierId ?? prevPayout.planTierId);
    const billingCycle = normalizeBillingCycle(body.billingCycle ?? prevPayout.billingCycle);
    const smartIdDispatch = normalizeDispatch(
      body.smartIdDispatch ?? prevPayout.smartIdDispatch,
    );

    const activeFromStaff = countActiveFromStaff(adminStaffRaw);
    const storedActive =
      typeof prevPayout.activeAdminStaffSlots === 'number'
        ? prevPayout.activeAdminStaffSlots
        : 0;

    const activeAdminStaffSlots = activeFromStaff > 0 ? activeFromStaff : storedActive;

    const maxAdminStaffSlots =
      typeof prevPayout.maxAdminStaffSlotsOverride === 'number'
        ? prevPayout.maxAdminStaffSlotsOverride
        : defaultMaxAdminSlotsForPlan(planTierId);

    const nextProfileJson = {
      ...profileJson,
      payoutSettings: {
        ...prevPayout,
        planTierId,
        billingCycle,
        smartIdDispatch,
        activeAdminStaffSlots,
      },
    };

    const updated = await prisma.clinicianProfile.update({
      where: { id: clinician.id },
      data: {
        meta: buildUpdatedMeta(clinician, nextProfileJson),
      },
    });

    const outJson = loadProfileJson(updated);
    const payout = outJson.payoutSettings || {};

    const curPlan = normalizePlanId(payout.planTierId);
    const outBilling = normalizeBillingCycle(payout.billingCycle);
    const outDispatch = normalizeDispatch(payout.smartIdDispatch);

    const outMaxSlots =
      typeof payout.maxAdminStaffSlotsOverride === 'number'
        ? payout.maxAdminStaffSlotsOverride
        : defaultMaxAdminSlotsForPlan(curPlan);

    const outActive =
      typeof payout.activeAdminStaffSlots === 'number'
        ? payout.activeAdminStaffSlots
        : 0;

    return json({
      ok: true,
      clinicianId: updated.id,
      currentPlanId: curPlan,
      smartIdDispatch: outDispatch,
      billingCycle: outBilling,
      maxAdminStaffSlots: outMaxSlots,
      activeAdminStaffSlots: outActive,
    });
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