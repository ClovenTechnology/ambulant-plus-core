// apps/api-gateway/app/api/clinicians/me/fees/extended/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

function money(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
}

function currency(value: unknown) {
  const c = String(value || 'ZAR').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : 'ZAR';
}

async function resolveClinician(req: NextRequest) {
  const uid = String(req.headers.get('x-uid') || req.headers.get('x-clinician-id') || '').trim();

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
  const cur = currency(profile.currency || profile.billingCurrency || profile.consultationCurrency);

  const consultationCents = money(
    clinician?.feeCents ?? profile.consultationFeeCents ?? profile.standardConsultFeeCents ?? profile.feeCents,
    0,
  );

  const followupCents = money(
    profile.followupFeeCents ?? profile.followUpFeeCents,
    consultationCents > 0 ? Math.round(consultationCents * 0.75) : 0,
  );

  const clinicianServices = Array.isArray(profile.clinicianServices) ? profile.clinicianServices : [];
  const adminServices = Array.isArray(profile.adminServices) ? profile.adminServices : [];
  const adminStaff = Array.isArray(profile.adminStaff) ? profile.adminStaff : [];

  return {
    ok: true,
    clinicianId: clinician.id,
    clinicianUserId: clinician.userId,
    currency: cur,
    baseFees: {
      consultationCents,
      followupCents,
    },
    baseConsultation: {
      amountCents: consultationCents,
      followupAmountCents: followupCents,
      currency: cur,
    },
    clinicianServices,
    adminStaff: {
      staff: adminStaff,
      services: adminServices,
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const { error, clinician } = await resolveClinician(req);
    if (error || !clinician) return error;

    return json(buildResponse(clinician));
  } catch (err: any) {
    console.error('[api-gateway] GET /api/clinicians/me/fees/extended failed', err);
    return json({ ok: false, error: err?.message || 'fees_load_failed' }, 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { error, clinician } = await resolveClinician(req);
    if (error || !clinician) return error;

    const body = await req.json().catch(() => ({} as any));
    const baseFees = parseObject(body.baseFees);
    const cur = currency(baseFees.currency || body.currency || 'ZAR');
    const consultationCents = money(baseFees.consultationCents ?? body.consultationCents, 0);
    const followupCents = money(baseFees.followupCents ?? body.followupCents, 0);

    const services = Array.isArray(body.services) ? body.services : [];
    const clinicianServices = services.filter((s: any) => s?.ownerType !== 'admin_staff');
    const adminServices = services.filter((s: any) => s?.ownerType === 'admin_staff');

    const { meta, profile } = readProfileJson(clinician);

    const nextProfile = {
      ...profile,
      currency: cur,
      billingCurrency: cur,
      feeCents: consultationCents,
      consultationFeeCents: consultationCents,
      standardConsultFeeCents: consultationCents,
      followupFeeCents: followupCents,
      followUpFeeCents: followupCents,
      clinicianServices,
      adminServices,
      adminStaffComp: Array.isArray(body.adminStaffComp) ? body.adminStaffComp : profile.adminStaffComp,
    };

    const nextMeta = {
      ...meta,
      rawProfile: nextProfile,
      rawProfileJson: JSON.stringify(nextProfile),
    };

    const updated = await (prisma as any).clinicianProfile.update({
      where: { id: clinician.id },
      data: {
        feeCents: consultationCents,
        meta: nextMeta,
      },
    });

    return json(buildResponse(updated));
  } catch (err: any) {
    console.error('[api-gateway] PUT /api/clinicians/me/fees/extended failed', err);
    return json({ ok: false, error: err?.message || 'fees_save_failed' }, 500);
  }
}
