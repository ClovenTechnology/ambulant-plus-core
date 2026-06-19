// apps/api-gateway/app/api/settings/consult/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import {
  getAdminPolicy,
  getClinicianConsult,
  setClinicianConsult,
} from '@/src/store/consult';

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

function num(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function resolveClinician(req: NextRequest) {
  const uid = String(req.headers.get('x-uid') || '').trim();

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

async function writeConsultMeta(clinician: any, patch: Record<string, any>) {
  const { meta, profile } = readProfileJson(clinician);
  const prevConsult = parseObject(profile.consultSettings);

  const nextProfile = {
    ...profile,
    consultSettings: {
      ...prevConsult,
      ...patch,
    },
  };

  const nextMeta = {
    ...meta,
    rawProfile: nextProfile,
    rawProfileJson: JSON.stringify(nextProfile),
  };

  return (prisma as any).clinicianProfile.update({
    where: { id: clinician.id },
    data: { meta: nextMeta },
  });
}

async function buildResponse(clinician: any) {
  const userId = clinician.userId || clinician.id;
  const [admin, consult] = await Promise.all([
    getAdminPolicy(),
    getClinicianConsult(userId),
  ]);

  const { profile } = readProfileJson(clinician);
  const storedConsult = parseObject(profile.consultSettings);
  const bufferMinutes = Math.max(
    0,
    Math.round(num(storedConsult.bufferMinutes ?? profile.bufferMinutes, admin.bufferAfterMinutes)),
  );

  return {
    ok: true,
    clinicianId: clinician.id,
    clinicianUserId: userId,
    defaultMinutes: consult.defaultStandardMin,
    defaultStandardMin: consult.defaultStandardMin,
    defaultFollowupMin: consult.defaultFollowupMin,
    bufferMinutes,
    minAdvanceMinutes: consult.minAdvanceMinutes,
    maxAdvanceDays: consult.maxAdvanceDays,
    adminMinimums: {
      minStandardMinutes: admin.minStandardMinutes,
      minFollowupMinutes: admin.minFollowupMinutes,
      bufferAfterMinutes: admin.bufferAfterMinutes,
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const { error, clinician } = await resolveClinician(req);
    if (error || !clinician) return error;

    return json(await buildResponse(clinician));
  } catch (err: any) {
    console.error('[api-gateway] GET /api/settings/consult failed', err);
    return json({ ok: false, error: err?.message || 'consult_settings_failed' }, 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { error, clinician } = await resolveClinician(req);
    if (error || !clinician) return error;

    const body = await req.json().catch(() => ({} as any));
    const current = await getClinicianConsult(clinician.userId || clinician.id);

    const defaultStandardMin = Math.max(
      1,
      Math.round(num(body.defaultStandardMin ?? body.defaultMinutes, current.defaultStandardMin)),
    );
    const defaultFollowupMin = Math.max(
      1,
      Math.round(num(body.defaultFollowupMin ?? body.followupMinutes, current.defaultFollowupMin)),
    );
    const minAdvanceMinutes = Math.max(
      0,
      Math.round(num(body.minAdvanceMinutes, current.minAdvanceMinutes)),
    );
    const maxAdvanceDays = Math.max(
      1,
      Math.round(num(body.maxAdvanceDays, current.maxAdvanceDays)),
    );
    const bufferMinutes = Math.max(0, Math.round(num(body.bufferMinutes, 5)));

    await setClinicianConsult(clinician.userId || clinician.id, {
      defaultStandardMin,
      defaultFollowupMin,
      minAdvanceMinutes,
      maxAdvanceDays,
    });

    const updated = await writeConsultMeta(clinician, {
      defaultMinutes: defaultStandardMin,
      defaultStandardMin,
      defaultFollowupMin,
      minAdvanceMinutes,
      maxAdvanceDays,
      bufferMinutes,
    });

    return json(await buildResponse(updated));
  } catch (err: any) {
    console.error('[api-gateway] PUT /api/settings/consult failed', err);
    return json({ ok: false, error: err?.message || 'consult_settings_save_failed' }, 500);
  }
}
