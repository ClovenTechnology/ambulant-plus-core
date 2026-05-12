// apps/api-gateway/app/api/clinicians/me/admin-staff/[id]/route.ts
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

async function getCurrentClinician(req: NextRequest) {
  const who = readIdentity(req.headers);

  if (who.role !== 'clinician' || !who.uid) return null;

  return prisma.clinicianProfile.findUnique({
    where: { userId: who.uid },
  });
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

function normalizeStaffArray(raw: any): AdminStaffMember[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((s) => ({
    id: String(s.id || ''),
    name: String(s.name || '').trim(),
    email: String(s.email || '').trim(),
    phone: s.phone ? String(s.phone).trim() : null,
    type: s.type === 'medical' ? 'medical' : 'non-medical',
    role: s.role ? String(s.role).trim() : null,
    status:
      (s.status || '').toString().toLowerCase() === 'disabled'
        ? 'disabled'
        : (s.status || '').toString().toLowerCase() === 'invited'
          ? 'invited'
          : 'active',
  }));
}

function countActive(staff: AdminStaffMember[]): number {
  return staff.filter((s) => s.status !== 'disabled').length;
}

function buildUpdatedMeta(clinician: any, profileJson: any) {
  const currentMeta = parseMeta(clinician?.meta);

  return {
    ...currentMeta,
    rawProfileJson: JSON.stringify(profileJson),
  };
}

// DELETE /api/clinicians/me/admin-staff/[id]
export async function DELETE(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  try {
    const clinician = await getCurrentClinician(req);

    if (!clinician) {
      return json({ ok: false, error: 'unauthorized_or_not_found' }, 401);
    }

    const staffId = ctx.params.id;
    const profileJson = loadProfileJson(clinician);
    const payout = profileJson.payoutSettings || {};
    const plan = normalizePlanId(payout.planTierId);

    const staff = normalizeStaffArray(profileJson.adminStaff || []);
    const idx = staff.findIndex((s) => s.id === staffId);

    if (idx === -1) {
      return json({ ok: false, error: 'admin_staff_not_found' }, 404);
    }

    staff[idx] = { ...staff[idx], status: 'disabled' };
    const activeSlots = countActive(staff);

    profileJson.adminStaff = staff;
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

    const maxSlots =
      typeof payout.maxAdminStaffSlotsOverride === 'number'
        ? payout.maxAdminStaffSlotsOverride
        : defaultMaxAdminSlotsForPlan(plan);

    return json({
      ok: true,
      maxSlots,
      activeSlots,
    });
  } catch (err: any) {
    console.error('DELETE /api/clinicians/me/admin-staff/[id] error', err);

    return json(
      { ok: false, error: err?.message || 'failed_to_disable_admin_staff' },
      500,
    );
  }
}