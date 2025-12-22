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
  if (raw === 'annual') return 'annual';
  return 'monthly';
}

function normalizeDispatch(raw: unknown): SmartIdDispatchOption {
  return raw === 'courier' ? 'courier' : 'collect';
}

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Helper: dev-only "current clinician".
 * Mirrors /api/me: first clinician by createdAt.
 */
async function getCurrentClinician() {
  const clinician = await prisma.clinicianProfile.findFirst({
    orderBy: { createdAt: 'asc' },
    include: { metadata: true },
  });
  return clinician;
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
 *   maxAdminStaffSlots: number | null,
 *   activeAdminStaffSlots: number
 * }
 */
export async function GET(_req: NextRequest) {
  try {
    const clinician = await getCurrentClinician();
    if (!clinician) {
      return json({ ok: false, error: 'no_clinician_found' }, 404);
    }

    let profileJson: any = {};
    if (clinician.metadata?.rawProfileJson) {
      try {
        profileJson = JSON.parse(clinician.metadata.rawProfileJson);
      } catch {
        profileJson = {};
      }
    }

    const payout = profileJson.payoutSettings || {};

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

    return json({
      ok: true,
      clinicianId: clinician.id,
      currentPlanId,
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
 * Body (JSON):
 *  - planTierId: PlanTierId
 *  - smartIdDispatch: 'collect' | 'courier'
 *  - billingCycle: 'monthly' | 'annual'
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

    let profileJson: any = {};
    if (clinician.metadata?.rawProfileJson) {
      try {
        profileJson = JSON.parse(clinician.metadata.rawProfileJson);
      } catch {
        profileJson = {};
      }
    }

    const prev = profileJson.payoutSettings || {};
    profileJson.payoutSettings = {
      ...prev,
      planTierId,
      billingCycle,
      smartIdDispatch,
      // Leave maxAdminStaffSlotsOverride / activeAdminStaffSlots untouched for now.
    };

    const updatedMetaData = {
      rawProfileJson: JSON.stringify(profileJson),
      // keep existing metadata fields in sync if present
      hpcsaS3Key: clinician.metadata?.hpcsaS3Key ?? null,
      hpcsaFileMeta: clinician.metadata?.hpcsaFileMeta ?? null,
      hpcsaNextRenewalDate: clinician.metadata?.hpcsaNextRenewalDate ?? null,
      insurerName: clinician.metadata?.insurerName ?? null,
      insuranceType: clinician.metadata?.insuranceType ?? null,
    };

    let updated;
    if (clinician.metadata) {
      updated = await prisma.clinicianProfile.update({
        where: { id: clinician.id },
        data: {
          metadata: {
            update: updatedMetaData,
          },
        },
        include: { metadata: true },
      });
    } else {
      updated = await prisma.clinicianProfile.update({
        where: { id: clinician.id },
        data: {
          metadata: {
            create: updatedMetaData,
          },
        },
        include: { metadata: true },
      });
    }

    let newProfileJson: any = {};
    if (updated.metadata?.rawProfileJson) {
      try {
        newProfileJson = JSON.parse(updated.metadata.rawProfileJson);
      } catch {
        newProfileJson = {};
      }
    }

    const payout = newProfileJson.payoutSettings || {};

    const currentPlanId = normalizePlanId(payout.planTierId);
    const outBilling = normalizeBillingCycle(payout.billingCycle);
    const outDispatch = normalizeDispatch(payout.smartIdDispatch);

    const maxAdminStaffSlots =
      typeof payout.maxAdminStaffSlotsOverride === 'number'
        ? payout.maxAdminStaffSlotsOverride
        : null;

    const activeAdminStaffSlots =
      typeof payout.activeAdminStaffSlots === 'number'
        ? payout.activeAdminStaffSlots
        : 0;

    return json({
      ok: true,
      clinicianId: updated.id,
      currentPlanId,
      smartIdDispatch: outDispatch,
      billingCycle: outBilling,
      maxAdminStaffSlots,
      activeAdminStaffSlots,
    });
  } catch (err: any) {
    console.error('PUT /api/clinicians/me/payout-settings error', err);
    return json(
      { ok: false, error: err?.message || 'failed_to_update_payout_settings' },
      500,
    );
  }
}
