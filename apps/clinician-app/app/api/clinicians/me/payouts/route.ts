import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PayoutSchedule = 'fortnightly' | 'monthly';
type PlanTierId = 'solo' | 'starter' | 'team' | 'group';

const PLAN_SHARE: Record<PlanTierId, number> = {
  solo: 80,
  starter: 82,
  team: 84,
  group: 86,
};

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
        ? parsed as Record<string, any>
        : {};
    } catch {
      return {};
    }
  }

  return {};
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

function normalizePlanId(raw: unknown): PlanTierId {
  return raw === 'starter' || raw === 'team' || raw === 'group' || raw === 'solo'
    ? raw
    : 'solo';
}

function normalizeSchedule(raw: unknown): PayoutSchedule {
  return raw === 'monthly' ? 'monthly' : 'fortnightly';
}

async function getClinician(req: NextRequest) {
  const url = new URL(req.url);
  const clinicianId = url.searchParams.get('clinicianId')?.trim();

  if (clinicianId) {
    return prisma.clinicianProfile.findUnique({
      where: { id: clinicianId },
    });
  }

  return prisma.clinicianProfile.findFirst({
    orderBy: { createdAt: 'asc' },
  });
}

function dateRange(req: NextRequest) {
  const url = new URL(req.url);
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);

  const from = url.searchParams.get('from') || thirtyDaysAgo.toISOString().slice(0, 10);
  const to = url.searchParams.get('to') || today.toISOString().slice(0, 10);

  return { from, to };
}

function buildEmptySummary(clinician: any, profileJson: Record<string, any>, req: NextRequest) {
  const payoutSettings = parseObject(profileJson.payoutSettings);
  const currentPlanId = normalizePlanId(payoutSettings.planTierId);
  const clinicianPct = PLAN_SHARE[currentPlanId];
  const platformPct = 100 - clinicianPct;
  const { from, to } = dateRange(req);

  return {
    ok: true,
    clinicianId: clinician.id,
    currency: 'ZAR',
    splitPercent: {
      clinician: clinicianPct,
      platform: platformPct,
    },
    range: { from, to },
    earnings: {
      grossCents: 0,
      netToClinicianCents: 0,
      platformShareCents: 0,
      thisWeekNetCents: 0,
      avgMonthlyNetCents: 0,
    },
    lastPayout: {
      amountCents: 0,
      at: null,
    },
    nextPayout: {
      amountCents: 0,
      at: null,
    },
    payoutSettings: {
      schedule: normalizeSchedule(payoutSettings.schedule),
    },
    demographics: {
      byGender: {},
      byCity: [],
      byProvince: [],
    },
    rows: [],
  };
}

export async function GET(req: NextRequest) {
  try {
    const clinician = await getClinician(req);

    if (!clinician) {
      return json({ ok: false, error: 'no_clinician_found' }, 404);
    }

    const profileJson = getProfileJson(clinician);

    return json(buildEmptySummary(clinician, profileJson, req));
  } catch (err: any) {
    console.error('GET /api/clinicians/me/payouts error', err);

    return json(
      { ok: false, error: err?.message || 'failed_to_load_payouts' },
      500
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const clinician = await getClinician(req);

    if (!clinician) {
      return json({ ok: false, error: 'no_clinician_found' }, 404);
    }

    const body = await req.json().catch(() => ({} as any));
    const schedule = normalizeSchedule(body.schedule);

    const clinicianAny = clinician as any;
    const existingMeta = parseObject(clinicianAny.meta);
    const profileJson = getProfileJson(clinician);
    const prevPayout = parseObject(profileJson.payoutSettings);

    const nextProfileJson = {
      ...profileJson,
      payoutSettings: {
        ...prevPayout,
        schedule,
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

    return json(buildEmptySummary(updated, updatedProfileJson, req));
  } catch (err: any) {
    console.error('PUT /api/clinicians/me/payouts error', err);

    return json(
      { ok: false, error: err?.message || 'failed_to_update_payout_schedule' },
      500
    );
  }
}
