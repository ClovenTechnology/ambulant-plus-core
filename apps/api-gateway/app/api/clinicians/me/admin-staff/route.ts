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

async function getCurrentClinician(req: NextRequest) {
  const who = readIdentity(req.headers);
  if (who.role !== 'clinician' || !who.uid) return null;

  const clinician = await prisma.clinicianProfile.findUnique({
    where: { userId: who.uid },
    include: { metadata: true },
  });

  return clinician;
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

function normalizeStaffArray(raw: any): AdminStaffMember[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => {
      const id = String(s.id || '');
      const name = String(s.name || '').trim();
      const email = String(s.email || '').trim();
      if (!id || !name || !email) return null;

      const type: 'medical' | 'non-medical' = s.type === 'medical' ? 'medical' : 'non-medical';
      const role = s.role ? String(s.role).trim() : null;
      const phone = s.phone ? String(s.phone).trim() : null;
      const statusRaw = (s.status || '').toString().toLowerCase();
      const status: AdminStaffMember['status'] =
        statusRaw === 'disabled' ? 'disabled' : statusRaw === 'invited' ? 'invited' : 'active';

      return { id, name, email, type, role, phone, status };
    })
    .filter(Boolean) as AdminStaffMember[];
}

function countActive(staff: AdminStaffMember[]): number {
  return staff.filter((s) => s.status !== 'disabled').length;
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

// GET /api/clinicians/me/admin-staff
export async function GET(req: NextRequest) {
  try {
    const clinician = await getCurrentClinician(req);
    if (!clinician) {
      return json({ ok: false, error: 'unauthorized_or_not_found' }, 401);
    }

    let profileJson = loadProfileJson(clinician);
    const payout = profileJson.payoutSettings || {};
    const plan = normalizePlanId(payout.planTierId);

    const staff = normalizeStaffArray(profileJson.adminStaff || []);
    const activeSlots = countActive(staff);

    const maxSlots =
      typeof payout.maxAdminStaffSlotsOverride === 'number'
        ? payout.maxAdminStaffSlotsOverride
        : defaultMaxAdminSlotsForPlan(plan);

    // sync active count back into payoutSettings
    profileJson.payoutSettings = {
      ...payout,
      planTierId: plan,
      activeAdminStaffSlots: activeSlots,
    };

    const updatedMetaData = buildUpdatedMetaData(clinician, profileJson);

    await prisma.clinicianProfile.update({
      where: { id: clinician.id },
      data: {
        metadata: clinician.metadata ? { update: updatedMetaData } : { create: updatedMetaData },
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
    const type: 'medical' | 'non-medical' = body.type === 'medical' ? 'medical' : 'non-medical';

    if (!name || !email) {
      return json({ ok: false, error: 'name_and_email_required' }, 400);
    }

    let profileJson = loadProfileJson(clinician);
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

    const updatedMetaData = buildUpdatedMetaData(clinician, profileJson);

    await prisma.clinicianProfile.update({
      where: { id: clinician.id },
      data: {
        metadata: clinician.metadata ? { update: updatedMetaData } : { create: updatedMetaData },
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
      { ok: false, error: err?.message || 'failed_to_create_admin_staff' },
      500,
    );
  }
}
