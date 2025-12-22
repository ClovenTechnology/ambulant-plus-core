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

// DELETE /api/clinicians/me/admin-staff/[id]
export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const clinician = await getCurrentClinician(_req);
    if (!clinician) {
      return json({ ok: false, error: 'unauthorized_or_not_found' }, 401);
    }

    const staffId = ctx.params.id;
    let profileJson = loadProfileJson(clinician);
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

    const updatedMetaData = buildUpdatedMetaData(clinician, profileJson);

    await prisma.clinicianProfile.update({
      where: { id: clinician.id },
      data: {
        metadata: clinician.metadata ? { update: updatedMetaData } : { create: updatedMetaData },
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
