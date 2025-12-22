// apps/api-gateway/app/api/admin/clinicians/[id]/fees/extended/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { verifyAdminRequest } from '../../../utils/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ServiceKind = 'base_consult' | 'followup' | 'extra';

type Service = {
  id: string;
  kind: ServiceKind;
  name: string;
  description?: string | null;
  amountCents: number;
  currency: string;
  minMinutes?: number | null;
  maxMinutes?: number | null;
  active: boolean;
  includesMedicalStaff?: boolean;
};

type StaffCompConfig = {
  staffId: string;
  flatMonthlyCents?: number | null;
  sharePercentOfClinician?: number | null;
  servicesSharePercent?: number | null;
  notes?: string | null;
};

type AdminClinicianFeesVM = {
  ok: boolean;
  clinicianId: string;
  clinicianName: string;
  clinicianStatus?: string | null;
  currency: string;
  services: Service[];
  staff: {
    staffId: string;
    staffName: string;
    type: 'medical' | 'non-medical';
    role?: string | null;
    flatMonthlyCents?: number | null;
    sharePercentOfClinician?: number | null;
    servicesSharePercent?: number | null;
  }[];
};

// ---- helpers ----

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function parseProfileJson(raw: string | null | undefined): any {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function normaliseCurrency(raw: any): string {
  const c = String(raw || 'ZAR').toUpperCase().trim();
  if (!c) return 'ZAR';
  return c;
}

function normaliseService(raw: any, defaultCurrency: string): Service | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim();
  const name = String(raw.name || '').trim();
  if (!id || !name) return null;

  const kindRaw = String(raw.kind || 'extra') as ServiceKind;
  const kind: ServiceKind =
    kindRaw === 'base_consult' || kindRaw === 'followup' ? kindRaw : 'extra';

  const amountCentsNum = Number(raw.amountCents);
  const amountCents = Number.isFinite(amountCentsNum)
    ? Math.max(0, Math.round(amountCentsNum))
    : 0;

  const currency = normaliseCurrency(raw.currency || defaultCurrency);

  const minMinutes =
    raw.minMinutes != null && Number.isFinite(Number(raw.minMinutes))
      ? Math.max(0, Math.round(Number(raw.minMinutes)))
      : null;

  const maxMinutes =
    raw.maxMinutes != null && Number.isFinite(Number(raw.maxMinutes))
      ? Math.max(0, Math.round(Number(raw.maxMinutes)))
      : null;

  const active = Boolean(raw.active ?? true);
  const includesMedicalStaff = raw.includesMedicalStaff ? true : false;

  return {
    id,
    kind,
    name,
    description: raw.description ? String(raw.description).trim() : null,
    amountCents,
    currency,
    minMinutes,
    maxMinutes,
    active,
    includesMedicalStaff,
  };
}

function normaliseStaffComp(raw: any): StaffCompConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const staffId = String(raw.staffId || '').trim();
  if (!staffId) return null;

  const flatMonthlyCentsNum = Number(raw.flatMonthlyCents);
  const flatMonthlyCents = Number.isFinite(flatMonthlyCentsNum)
    ? Math.max(0, Math.round(flatMonthlyCentsNum))
    : null;

  const sharePctNum = Number(raw.sharePercentOfClinician);
  const sharePercentOfClinician = Number.isFinite(sharePctNum)
    ? Math.max(0, Math.min(100, sharePctNum))
    : null;

  const svcPctNum = Number(raw.servicesSharePercent);
  const servicesSharePercent = Number.isFinite(svcPctNum)
    ? Math.max(0, Math.min(100, svcPctNum))
    : null;

  return {
    staffId,
    flatMonthlyCents,
    sharePercentOfClinician,
    servicesSharePercent,
    notes: raw.notes ? String(raw.notes).trim() : null,
  };
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

// ---- GET: view extended fees & staff comp ----

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  try {
    const isAdmin = await verifyAdminRequest(req);
    if (!isAdmin) {
      return json({ ok: false, error: 'admin_required' }, 403);
    }

    const clinicianId = ctx.params.id;
    const clinician = await prisma.clinicianProfile.findUnique({
      where: { id: clinicianId },
      include: { metadata: true },
    });

    if (!clinician) {
      return json({ ok: false, error: 'not_found' }, 404);
    }

    const profileJson = parseProfileJson(clinician.metadata?.rawProfileJson);

    const serviceFees = profileJson.serviceFees || {};
    const currency = normaliseCurrency(
      serviceFees.currency || clinician.currency || 'ZAR',
    );

    const rawServices: any[] = Array.isArray(serviceFees.services)
      ? serviceFees.services
      : [];
    const services: Service[] = rawServices
      .map((s) => normaliseService(s, currency))
      .filter(Boolean) as Service[];

    const adminStaffRaw: any[] = Array.isArray(profileJson.adminStaff)
      ? profileJson.adminStaff
      : [];

    const adminStaffComp = profileJson.adminStaffComp || {};
    const rawComp: any[] = Array.isArray(adminStaffComp.staff)
      ? adminStaffComp.staff
      : [];

    const findComp = (staffId: string): StaffCompConfig | null => {
      const row = rawComp.find(
        (c) => String(c.staffId || '') === String(staffId),
      );
      if (!row) return null;
      return normaliseStaffComp(row);
    };

    const staff = adminStaffRaw
      .map((s) => {
        const staffId = String(s.id || '').trim();
        if (!staffId) return null;

        const staffName =
          String(s.name || '').trim() ||
          String(s.email || '').trim() ||
          'Admin staff';

        const type: 'medical' | 'non-medical' =
          s.type === 'medical' ? 'medical' : 'non-medical';

        const role = s.role ? String(s.role).trim() : null;

        const comp = findComp(staffId);

        return {
          staffId,
          staffName,
          type,
          role,
          flatMonthlyCents: comp?.flatMonthlyCents ?? null,
          sharePercentOfClinician: comp?.sharePercentOfClinician ?? null,
          servicesSharePercent: comp?.servicesSharePercent ?? null,
        };
      })
      .filter(Boolean) as AdminClinicianFeesVM['staff'];

    const out: AdminClinicianFeesVM = {
      ok: true,
      clinicianId: clinician.id,
      clinicianName:
        clinician.displayName || clinician.userId || 'Clinician',
      clinicianStatus: clinician.status ?? null,
      currency,
      services,
      staff,
    };

    return json(out);
  } catch (err: any) {
    console.error(
      'GET /api/admin/clinicians/[id]/fees/extended error',
      err,
    );
    return json(
      { ok: false, error: err?.message || 'failed_to_load_fees' },
      500,
    );
  }
}

// ---- PUT: update serviceFees + adminStaffComp (for future UI) ----

export async function PUT(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  try {
    const isAdmin = await verifyAdminRequest(req);
    if (!isAdmin) {
      return json({ ok: false, error: 'admin_required' }, 403);
    }

    const clinicianId = ctx.params.id;
    const clinician = await prisma.clinicianProfile.findUnique({
      where: { id: clinicianId },
      include: { metadata: true },
    });

    if (!clinician) {
      return json({ ok: false, error: 'not_found' }, 404);
    }

    const body = await req.json().catch(() => ({} as any));

    const baseCurrency = normaliseCurrency(body.currency || 'ZAR');

    const rawServices: any[] = Array.isArray(body.services)
      ? body.services
      : [];
    const services: Service[] = rawServices
      .map((s) => normaliseService(s, baseCurrency))
      .filter(Boolean) as Service[];

    const rawStaffComp: any[] = Array.isArray(body.staff)
      ? body.staff
      : [];
    const staffComp: StaffCompConfig[] = rawStaffComp
      .map((s) => normaliseStaffComp(s))
      .filter(Boolean) as StaffCompConfig[];

    const profileJson = parseProfileJson(clinician.metadata?.rawProfileJson);

    profileJson.serviceFees = {
      currency: baseCurrency,
      services,
    };

    profileJson.adminStaffComp = {
      currency: baseCurrency,
      staff: staffComp,
    };

    const updatedMeta = buildUpdatedMetaData(clinician, profileJson);

    await prisma.clinicianProfile.update({
      where: { id: clinician.id },
      data: {
        metadata: clinician.metadata
          ? { update: updatedMeta }
          : { create: updatedMeta },
      },
      include: { metadata: true },
    });

    return json({ ok: true });
  } catch (err: any) {
    console.error(
      'PUT /api/admin/clinicians/[id]/fees/extended error',
      err,
    );
    return json(
      { ok: false, error: err?.message || 'failed_to_update_fees' },
      500,
    );
  }
}
