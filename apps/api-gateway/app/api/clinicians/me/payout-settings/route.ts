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
  if (raw === 'annual') return 'annual';
  return 'monthly';
}

function normalizeDispatch(raw: unknown): SmartIdDispatchOption {
  return raw === 'courier' ? 'courier' : 'collect';
}

/**
 * Default max admin slots per plan.
 * Keep this logically in sync with UI PLAN_TIERS.
 *
 * Free plan: 0 slots (even though UI shows maxAdminSlots=1).
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

async function getCurrentClinician(req: NextRequest) {
  const who = readIdentity(req.headers);
  if (who.role !== 'clinician' || !who.uid) return null;

  // Gateway uses userId = who.uid
  const clinician = await prisma.clinicianProfile.findUnique({
    where: { userId: who.uid },
    include: { metadata: true },
  });
  return { clinician, who };
}

function loadProfileJson(clinician: any): any {
  if (clinician?.metadata?.rawProfileJson) {
    try {
      return JSON.parse(clinician.metadata.rawProfileJson);
    } catch {
      return {};
    }
  }
  return {};
}

function normalizeStaffArray(raw: any): any[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s) => s && typeof s === 'object');
}

function countActiveFromStaff(staff: any[]): number {
  return staff.filter((s) => {
    const status = (s?.status || '').toString().toLowerCase();
    return status !== 'disabled';
  }).length;
}

function buildUpdatedMetaData(clinician: any, profileJson: any) {
  return {
    rawProfileJson: JSON.stringify(profileJson),
    hpcsaS3Key: clinician.metadata?.hpcsaS3Key ?? null,
    hpcsaFileMeta: clinician.metadata?.hpcsaFileMeta ?? null,
    hpcsaNextRenewalDate: clinician.metadata?.hpcsaNextRenewalDate ?? null,
    insurerName: clinician.metadata?.insurerName ?? null,
    insuranceType: clinician.metadata?.insuranceType ?? null,
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

    let profileJson = loadProfileJson(clinician);
    const payout = profileJson.payoutSettings || {};
    const adminStaffRaw = normalizeStaffArray(profileJson.adminStaff || []);

    const plan = normalizePlanId(payout.planTierId);
    const billingCycle = normalizeBillingCycle(payout.billingCycle);
    const smartIdDispatch = normalizeDispatch(payout.smartIdDispatch);

    // active slots: prefer dynamic count from staff list
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

    // keep payoutSettings in sync
    profileJson.payoutSettings = {
      ...payout,
      planTierId: plan,
      billingCycle,
      smartIdDispatch,
      activeAdminStaffSlots,
    };

    const updatedMeta = buildUpdatedMetaData(clinician, profileJson);

    await prisma.clinicianProfile.update({
      where: { id: clinician.id },
      data: {
        metadata: clinician.metadata ? { update: updatedMeta } : { create: updatedMeta },
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
      { ok: false, error: err?.message || 'failed_to_load_payout_settings' },
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

    const planTierId = normalizePlanId(body.planTierId);
    const billingCycle = normalizeBillingCycle(body.billingCycle);
    const smartIdDispatch = normalizeDispatch(body.smartIdDispatch);

    let profileJson = loadProfileJson(clinician);
    const prevPayout = profileJson.payoutSettings || {};
    const adminStaffRaw = normalizeStaffArray(profileJson.adminStaff || []);

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

    profileJson.payoutSettings = {
      ...prevPayout,
      planTierId,
      billingCycle,
      smartIdDispatch,
      activeAdminStaffSlots,
    };

    const updatedMeta = buildUpdatedMetaData(clinician, profileJson);

    const updated = await prisma.clinicianProfile.update({
      where: { id: clinician.id },
      data: {
        metadata: clinician.metadata ? { update: updatedMeta } : { create: updatedMeta },
      },
      include: { metadata: true },
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
      typeof payout.activeAdminStaffSlots === 'number' ? payout.activeAdminStaffSlots : 0;

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
      { ok: false, error: err?.message || 'failed_to_update_payout_settings' },
      500,
    );
  }
}
