// apps/api-gateway/app/api/clinicians/me/payout-settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PlanTierId = 'solo' | 'starter' | 'team' | 'group';
type SmartIdDispatchOption = 'collect' | 'courier';
type BillingCycle = 'monthly' | 'annual';

const PLAN_IDS: PlanTierId[] = ['solo', 'starter', 'team', 'group'];

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function parseObject(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function normalizePlanId(raw: unknown): PlanTierId {
  return typeof raw === 'string' && PLAN_IDS.includes(raw as PlanTierId) ? raw as PlanTierId : 'solo';
}

function normalizeBillingCycle(raw: unknown): BillingCycle {
  return raw === 'annual' ? 'annual' : 'monthly';
}

function normalizeDispatch(raw: unknown): SmartIdDispatchOption {
  return raw === 'courier' ? 'courier' : 'collect';
}

async function resolveClinician(req: NextRequest) {
  const uid = String(req.headers.get('x-clinician-id') || req.headers.get('x-uid') || '').trim();

  if (!uid) {
    return { error: json({ ok: false, error: 'missing_clinician_identity' }, 401), clinician: null };
  }

  const clinician = await (prisma as any).clinicianProfile.findFirst({
    where: {
      OR: [
        { id: uid },
        { userId: uid },
        { email: uid },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!clinician) {
    return { error: json({ ok: false, error: 'clinician_not_found' }, 404), clinician: null };
  }

  return { error: null, clinician };
}

function readProfileJson(clinician: any) {
  const meta = parseObject(clinician?.meta);
  const profile =
    meta.rawProfile && typeof meta.rawProfile === 'object'
      ? meta.rawProfile
      : typeof meta.rawProfileJson === 'string'
        ? parseObject(meta.rawProfileJson)
        : meta;

  return { meta, profile };
}

function buildResponse(clinician: any) {
  const { profile } = readProfileJson(clinician);
  const payout = parseObject(profile.payoutSettings);

  return {
    ok: true,
    clinicianId: clinician.id,
    currentPlanId: normalizePlanId(payout.planTierId),
    smartIdDispatch: normalizeDispatch(payout.smartIdDispatch),
    billingCycle: normalizeBillingCycle(payout.billingCycle),
    maxAdminStaffSlots:
      typeof payout.maxAdminStaffSlotsOverride === 'number'
        ? payout.maxAdminStaffSlotsOverride
        : null,
    activeAdminStaffSlots:
      typeof payout.activeAdminStaffSlots === 'number'
        ? payout.activeAdminStaffSlots
        : 0,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { error, clinician } = await resolveClinician(req);
    if (error || !clinician) return error;

    return json(buildResponse(clinician));
  } catch (err: any) {
    console.error('[api-gateway] GET /api/clinicians/me/payout-settings failed', err);
    return json({ ok: false, error: err?.message || 'payout_settings_load_failed' }, 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { error, clinician } = await resolveClinician(req);
    if (error || !clinician) return error;

    const body = await req.json().catch(() => ({} as any));
    const { meta, profile } = readProfileJson(clinician);
    const prev = parseObject(profile.payoutSettings);

    const nextProfile = {
      ...profile,
      payoutSettings: {
        ...prev,
        planTierId: normalizePlanId(body.planTierId),
        billingCycle: normalizeBillingCycle(body.billingCycle),
        smartIdDispatch: normalizeDispatch(body.smartIdDispatch),
      },
    };

    const nextMeta = {
      ...meta,
      rawProfile: nextProfile,
      rawProfileJson: JSON.stringify(nextProfile),
    };

    const updated = await (prisma as any).clinicianProfile.update({
      where: { id: clinician.id },
      data: { meta: nextMeta },
    });

    return json(buildResponse(updated));
  } catch (err: any) {
    console.error('[api-gateway] PUT /api/clinicians/me/payout-settings failed', err);
    return json({ ok: false, error: err?.message || 'payout_settings_save_failed' }, 500);
  }
}
