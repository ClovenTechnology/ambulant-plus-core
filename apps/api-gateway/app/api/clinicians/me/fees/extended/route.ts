// apps/api-gateway/app/api/clinicians/me/fees/extended/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type BillingUnit =
  | 'per_consult'
  | 'per_followup'
  | 'per_hour'
  | 'per_day'
  | 'per_task';

type ServiceOwnerType = 'clinician' | 'admin_staff';

type ServiceFee = {
  id: string;
  ownerType: ServiceOwnerType;
  ownerAdminStaffId?: string;
  code?: string;
  label: string;
  description?: string | null;
  billingUnit: BillingUnit;
  amountCents: number;
  currency: string;
  active: boolean;
};

type AdminStaffCompMode = 'none' | 'flat_monthly' | 'percent_revenue';

type AdminStaffCompensation = {
  mode: AdminStaffCompMode;
  amountCents?: number | null;
  percent?: number | null;
};

type AdminStaffNormalized = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  type: 'medical' | 'non-medical';
  role?: string | null;
  status: 'active' | 'invited' | 'disabled';
  compensation: AdminStaffCompensation;
  canHaveServices: boolean;
};

type FeesExtendedGetResponse = {
  ok: boolean;
  currency: string;
  baseFees: {
    consultationCents: number;
    followupCents: number;
  };
  clinicianServices: ServiceFee[];
  adminStaff: {
    staff: AdminStaffNormalized[];
    services: ServiceFee[];
  };
};

type FeesExtendedPutBody = {
  baseFees?: {
    consultationCents?: number;
    followupCents?: number;
    currency?: string;
  };
  services?: Array<{
    id?: string;
    ownerType: ServiceOwnerType;
    ownerAdminStaffId?: string;
    code?: string;
    label: string;
    description?: string | null;
    billingUnit: BillingUnit;
    amountCents: number;
    currency?: string;
    active?: boolean;
  }>;
  adminStaffComp?: Array<{
    adminStaffId: string;
    mode: AdminStaffCompMode;
    amountCents?: number | null;
    percent?: number | null;
  }>;
};

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function sanitizeCurrency(raw: unknown): string {
  const s = String(raw || 'ZAR').toUpperCase();
  if (!/^[A-Z]{3}$/.test(s)) return 'ZAR';
  return s;
}

function normalizeBillingUnit(raw: unknown): BillingUnit {
  const v = String(raw || '').toLowerCase();

  switch (v) {
    case 'per_followup':
      return 'per_followup';
    case 'per_hour':
      return 'per_hour';
    case 'per_day':
      return 'per_day';
    case 'per_task':
      return 'per_task';
    case 'per_consult':
    default:
      return 'per_consult';
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

function buildUpdatedMeta(clinician: any, profileJson: any) {
  const currentMeta = parseMeta(clinician?.meta);

  return {
    ...currentMeta,
    rawProfileJson: JSON.stringify(profileJson),
  };
}

function normalizeServiceFees(
  raw: any,
  staffList: AdminStaffNormalized[],
  defaultCurrency: string,
): ServiceFee[] {
  const arr: any[] = Array.isArray(raw) ? raw : [];
  const staffIds = new Set(
    staffList.filter((s) => s.canHaveServices).map((s) => s.id),
  );

  const fees: ServiceFee[] = [];

  for (const s of arr) {
    const id = String(s?.id || '').trim();
    const ownerType: ServiceOwnerType =
      s?.ownerType === 'admin_staff' ? 'admin_staff' : 'clinician';

    let ownerAdminStaffId: string | undefined;

    if (ownerType === 'admin_staff') {
      const sid = String(s?.ownerAdminStaffId || '').trim();

      if (!sid || !staffIds.has(sid)) {
        continue;
      }

      ownerAdminStaffId = sid;
    }

    const label = String(s?.label || '').trim();
    if (!label) continue;

    const code = s?.code ? String(s.code).trim() : undefined;
    const description = s?.description ? String(s.description).trim() : undefined;

    const amountCentsNum = Number(s?.amountCents ?? 0);
    if (!Number.isFinite(amountCentsNum) || amountCentsNum < 0) continue;

    const currency = sanitizeCurrency(s?.currency || defaultCurrency);
    const billingUnit = normalizeBillingUnit(s?.billingUnit);
    const active = s?.active === false ? false : true;

    fees.push({
      id: id || `sf-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
      ownerType,
      ownerAdminStaffId,
      code,
      label,
      description,
      billingUnit,
      amountCents: Math.round(amountCentsNum),
      currency,
      active,
    });
  }

  return fees;
}

function normalizeAdminStaff(raw: any): AdminStaffNormalized[] {
  const arr: any[] = Array.isArray(raw) ? raw : [];

  return arr
    .map((s) => {
      const id = String(s?.id || '').trim();
      const name = String(s?.name || '').trim();
      const email = String(s?.email || '').trim();

      if (!id || !name || !email) return null;

      const type: 'medical' | 'non-medical' =
        s?.type === 'medical' ? 'medical' : 'non-medical';

      const role = s?.role ? String(s.role).trim() : undefined;
      const phone = s?.phone ? String(s.phone).trim() : undefined;

      const statusRaw = String(s?.status || '').toLowerCase();
      const status: AdminStaffNormalized['status'] =
        statusRaw === 'disabled'
          ? 'disabled'
          : statusRaw === 'invited'
            ? 'invited'
            : 'active';

      const compRaw = s?.compensation || {};
      const modeRaw = String(compRaw?.mode || 'none') as AdminStaffCompMode;
      const mode: AdminStaffCompMode =
        modeRaw === 'flat_monthly' || modeRaw === 'percent_revenue'
          ? modeRaw
          : 'none';

      let amountCents: number | null = null;
      let percent: number | null = null;

      if (mode === 'flat_monthly') {
        const v = Number(compRaw?.amountCents ?? 0);
        amountCents = Number.isFinite(v) && v >= 0 ? Math.round(v) : 0;
      } else if (mode === 'percent_revenue') {
        const p = Number(compRaw?.percent ?? 0);
        percent = Number.isFinite(p) && p >= 0 && p <= 100 ? p : 0;
      }

      return {
        id,
        name,
        email,
        phone: phone ?? null,
        role: role ?? null,
        type,
        status,
        compensation: {
          mode,
          amountCents,
          percent,
        },
        canHaveServices: type === 'medical',
      } satisfies AdminStaffNormalized;
    })
    .filter(Boolean) as AdminStaffNormalized[];
}

function applyAdminStaffCompUpdates(
  staff: AdminStaffNormalized[],
  updates: FeesExtendedPutBody['adminStaffComp'],
): AdminStaffNormalized[] {
  if (!Array.isArray(updates) || updates.length === 0) return staff;

  const byId = new Map<string, AdminStaffNormalized>();
  staff.forEach((s) => byId.set(s.id, s));

  for (const u of updates) {
    if (!u || !u.adminStaffId) continue;

    const cur = byId.get(u.adminStaffId);
    if (!cur) continue;

    const modeRaw = u.mode as AdminStaffCompMode;
    const mode: AdminStaffCompMode =
      modeRaw === 'flat_monthly' || modeRaw === 'percent_revenue'
        ? modeRaw
        : 'none';

    let amountCents: number | null = null;
    let percent: number | null = null;

    if (mode === 'flat_monthly') {
      const v = Number(u.amountCents ?? 0);
      amountCents = Number.isFinite(v) && v >= 0 ? Math.round(v) : 0;
    } else if (mode === 'percent_revenue') {
      const p = Number(u.percent ?? 0);
      percent = Number.isFinite(p) && p >= 0 && p <= 100 ? p : 0;
    }

    cur.compensation = { mode, amountCents, percent };
    byId.set(cur.id, cur);
  }

  return Array.from(byId.values());
}

export async function GET(req: NextRequest) {
  try {
    const clinician = await getCurrentClinician(req);

    if (!clinician) {
      return json({ ok: false, error: 'unauthorized_or_not_found' }, 401);
    }

    const profileJson = loadProfileJson(clinician);

    const rawFees = profileJson.fees || {};
    const rawAdminStaff = profileJson.adminStaff || [];
    const rawServiceFees = profileJson.serviceFees || [];

    const baseCurrency = sanitizeCurrency(rawFees.currency || clinician.currency || 'ZAR');

    const staff = normalizeAdminStaff(rawAdminStaff);
    const allFees = normalizeServiceFees(rawServiceFees, staff, baseCurrency);

    const clinicianServices = allFees.filter((f) => f.ownerType === 'clinician');
    const adminServices = allFees.filter((f) => f.ownerType === 'admin_staff');

    const consultationCents = Number.isFinite(Number(clinician.feeCents))
      ? Number(clinician.feeCents)
      : 0;

    const followupCentsRaw = Number(rawFees.followupCents ?? 0);
    const followupCents =
      Number.isFinite(followupCentsRaw) && followupCentsRaw >= 0
        ? Math.round(followupCentsRaw)
        : 0;

    const payload: FeesExtendedGetResponse = {
      ok: true,
      currency: baseCurrency,
      baseFees: {
        consultationCents,
        followupCents,
      },
      clinicianServices,
      adminStaff: {
        staff,
        services: adminServices,
      },
    };

    return json(payload);
  } catch (err: any) {
    console.error('GET /api/clinicians/me/fees/extended error', err);

    return json(
      {
        ok: false,
        error: err?.message || 'failed_to_load_fees_extended',
      },
      500,
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const clinician = await getCurrentClinician(req);

    if (!clinician) {
      return json({ ok: false, error: 'unauthorized_or_not_found' }, 401);
    }

    const body: FeesExtendedPutBody = await req.json().catch(() => ({} as any));

    const profileJson = loadProfileJson(clinician);

    const rawFees = profileJson.fees || {};
    const rawAdminStaff = profileJson.adminStaff || [];
    const rawServiceFees = profileJson.serviceFees || [];

    const baseCurrency = sanitizeCurrency(
      body.baseFees?.currency || rawFees.currency || clinician.currency || 'ZAR',
    );

    let staff = normalizeAdminStaff(rawAdminStaff);
    staff = applyAdminStaffCompUpdates(staff, body.adminStaffComp);

    let consultationCents =
      Number.isFinite(Number(clinician.feeCents)) && Number(clinician.feeCents) >= 0
        ? Number(clinician.feeCents)
        : 0;

    if (body.baseFees?.consultationCents != null) {
      const v = Number(body.baseFees.consultationCents);
      consultationCents = Number.isFinite(v) && v >= 0 ? Math.round(v) : 0;
    }

    let followupCents =
      Number.isFinite(Number(rawFees.followupCents)) && Number(rawFees.followupCents) >= 0
        ? Math.round(Number(rawFees.followupCents))
        : 0;

    if (body.baseFees?.followupCents != null) {
      const v = Number(body.baseFees.followupCents);
      followupCents = Number.isFinite(v) && v >= 0 ? Math.round(v) : 0;
    }

    const allFees = normalizeServiceFees(
      body.services ?? rawServiceFees,
      staff,
      baseCurrency,
    );

    const clinicianServices = allFees.filter((f) => f.ownerType === 'clinician');
    const adminServices = allFees.filter((f) => f.ownerType === 'admin_staff');

    profileJson.fees = {
      consultationCents,
      followupCents,
      currency: baseCurrency,
    };

    profileJson.adminStaff = staff.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      phone: s.phone ?? null,
      type: s.type,
      role: s.role ?? null,
      status: s.status,
      compensation: s.compensation,
    }));

    profileJson.serviceFees = [...clinicianServices, ...adminServices];

    const updatedMeta = buildUpdatedMeta(clinician, profileJson);

    const updated = await prisma.clinicianProfile.update({
      where: { id: clinician.id },
      data: {
        feeCents: consultationCents,
        meta: updatedMeta,
      },
    });

    const updatedJson = loadProfileJson(updated);
    const updatedFees = updatedJson.fees || {};
    const updatedAdminStaff = normalizeAdminStaff(updatedJson.adminStaff || []);
    const updatedServiceFees = normalizeServiceFees(
      updatedJson.serviceFees || [],
      updatedAdminStaff,
      sanitizeCurrency(updatedFees.currency || baseCurrency || 'ZAR'),
    );

    const updatedCurrency = sanitizeCurrency(updatedFees.currency || baseCurrency || 'ZAR');

    const updatedClinicianServices = updatedServiceFees.filter(
      (f) => f.ownerType === 'clinician',
    );
    const updatedAdminServices = updatedServiceFees.filter(
      (f) => f.ownerType === 'admin_staff',
    );

    const resp: FeesExtendedGetResponse = {
      ok: true,
      currency: updatedCurrency,
      baseFees: {
        consultationCents:
          Number(updated.feeCents) >= 0 ? Number(updated.feeCents) : 0,
        followupCents:
          Number.isFinite(Number(updatedFees.followupCents)) &&
          Number(updatedFees.followupCents) >= 0
            ? Math.round(Number(updatedFees.followupCents))
            : 0,
      },
      clinicianServices: updatedClinicianServices,
      adminStaff: {
        staff: updatedAdminStaff,
        services: updatedAdminServices,
      },
    };

    return json(resp);
  } catch (err: any) {
    console.error('PUT /api/clinicians/me/fees/extended error', err);

    return json(
      {
        ok: false,
        error: err?.message || 'failed_to_update_fees_extended',
      },
      500,
    );
  }
}