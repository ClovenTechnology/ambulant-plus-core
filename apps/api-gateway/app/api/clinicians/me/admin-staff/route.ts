// apps/api-gateway/app/api/clinicians/me/admin-staff/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PlanTierId = 'solo' | 'starter' | 'team' | 'group';

type AdminStaffMember = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  type: 'medical' | 'non-medical';
  role?: string | null;
  status: 'active' | 'invited' | 'disabled';
};

type AdminStaffListResponse = {
  ok: boolean;
  maxSlots: number;
  activeSlots: number;
  staff: AdminStaffMember[];
};

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

function loadProfileJson(clinician: any): any {
  const meta = parseMeta(clinician?.meta);

  const rawProfileJson = meta.rawProfileJson ?? meta.rawProfile;

  if (!rawProfileJson) return meta;

  if (typeof rawProfileJson === 'object' && !Array.isArray(rawProfileJson)) {
    return rawProfileJson;
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

function buildUpdatedMeta(clinician: any, profileJson: any) {
  const currentMeta = parseMeta(clinician?.meta);

  return {
    ...currentMeta,
    rawProfileJson: JSON.stringify(profileJson),
  };
}

async function getCurrentClinician(req: NextRequest) {
  const who = readIdentity(req.headers);

  if (who.role !== 'clinician' || !who.uid) return null;

  return prisma.clinicianProfile.findUnique({
    where: { userId: who.uid },
  });
}

function normalizeStaffArray(raw: any): AdminStaffMember[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((s) => {
      const id = String(s.id || '').trim();
      const name = String(s.name || '').trim();
      const email = String(s.email || '').trim();

      if (!id || !name || !email) return null;

      const statusRaw = String(s.status || 'active').toLowerCase();

      return {
        id,
        name,
        email,
        phone: s.phone ? String(s.phone).trim() : null,
        type: s.type === 'medical' ? 'medical' : 'non-medical',
        role: s.role ? String(s.role).trim() : null,
        status:
          statusRaw === 'disabled'
            ? 'disabled'
            : statusRaw === 'invited'
              ? 'invited'
              : 'active',
      };
    })
    .filter(Boolean) as AdminStaffMember[];
}

function countActive(staff: AdminStaffMember[]): number {
  return staff.filter((s) => s.status !== 'disabled').length;
}

// GET /api/clinicians/me/admin-staff
export async function GET(req: NextRequest) {
  try {
    const clinician = await getCurrentClinician(req);

    if (!clinician) {
      return json({ ok: false, error: 'unauthorized_or_not_found' }, 401);
    }

    const profileJson = loadProfileJson(clinician);
    const payout = profileJson.payoutSettings || {};
    const plan = normalizePlanId(payout.planTierId);

    const staff = normalizeStaffArray(profileJson.adminStaff || []);
    const activeSlots = countActive(staff);

    const maxSlots =
      typeof payout.maxAdminStaffSlotsOverride === 'number'
        ? payout.maxAdminStaffSlotsOverride
        : defaultMaxAdminSlotsForPlan(plan);

    profileJson.payoutSettings = {
      ...payout,
      planTierId: plan,
      activeAdminStaffSlots: activeSlots,
    };

    await prisma.clinicianProfile.update({
      where: { id: clinician.id },
      data: {
        meta: buildUpdatedMeta(clinician, profileJson),
      },
    });

    const resp: AdminStaffListResponse = {
      ok: true,
      maxSlots,
      activeSlots,
      staff,
    };

    return json(resp);
  } catch (err: any) {
    console.error('GET /api/clinicians/me/admin-staff error', err);

    return json(
      { ok: false, error: err?.message || 'failed_to_load_admin_staff' },
      500,
    );
  }
}

// POST /api/clinicians/me/admin-staff
export async function POST(req: NextRequest) {
  try {
    const clinician = await getCurrentClinician(req);

    if (!clinician) {
      return json({ ok: false, error: 'unauthorized_or_not_found' }, 401);
    }

    const body = await req.json().catch(() => ({} as any));

    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const phone = body.phone ? String(body.phone).trim() : null;
    const role = body.role ? String(body.role).trim() : null;
    const type: 'medical' | 'non-medical' =
      body.type === 'medical' ? 'medical' : 'non-medical';

    if (!name || !email) {
      return json({ ok: false, error: 'name_and_email_required' }, 400);
    }

    const profileJson = loadProfileJson(clinician);
    const payout = profileJson.payoutSettings || {};
    const plan = normalizePlanId(payout.planTierId);

    const staff = normalizeStaffArray(profileJson.adminStaff || []);
    const maxSlots =
      typeof payout.maxAdminStaffSlotsOverride === 'number'
        ? payout.maxAdminStaffSlotsOverride
        : defaultMaxAdminSlotsForPlan(plan);

    const activeSlotsBefore = countActive(staff);

    if (maxSlots > 0 && activeSlotsBefore >= maxSlots) {
      return json({ ok: false, error: 'admin_staff_slot_limit_reached' }, 400);
    }

    const newStaff: AdminStaffMember = {
      id: `as-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
      name,
      email,
      phone,
      role,
      type,
      status: 'active',
    };

    const nextStaff = [...staff, newStaff];
    const activeSlots = countActive(nextStaff);

    profileJson.adminStaff = nextStaff;
    profileJson.payoutSettings = {
      ...payout,
      planTierId: plan,
      activeAdminStaffSlots: activeSlots,
    };

    await prisma.clinicianProfile.update({
      where: { id: clinician.id },
      data: {
        meta: buildUpdatedMeta(clinician, profileJson),
      },
    });

    return json({
      ok: true,
      staff: newStaff,
      maxSlots,
      activeSlots,
    });
  } catch (err: any) {
    console.error('POST /api/clinicians/me/admin-staff error', err);

    return json(
      { ok: false, error: err?.message || 'failed_to_add_admin_staff' },
      500,
    );
  }
}