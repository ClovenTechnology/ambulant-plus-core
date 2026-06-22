// apps/api-gateway/app/api/appointments/preflight/route.ts
import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization,cookie,x-uid,x-role,x-org-id,x-ambulant-identity',
      'cache-control': 'no-store',
    },
  });
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function dateFrom(value: unknown) {
  const d = new Date(String(value || ''));
  return Number.isFinite(d.getTime()) ? d : null;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  try {
    const who = readIdentity(req.headers);
    const body = await req.json().catch(() => ({} as any));

    const clinicianRef = clean(body.clinicianId || body.clinician_id);
    const startsAt = dateFrom(body.startsAt || body.starts_at || body.start || body.startTime);
    const endsAt = dateFrom(body.endsAt || body.ends_at || body.end || body.endTime);

    const patientId = clean(body.patientId || body.patient_id || who.actorRefId || who.uid);
    const hostUserId = clean(body.hostUserId || body.host_user_id || who.uid || patientId);
    const subjectPatientId = clean(body.subjectPatientId || body.subject_patient_id || body.person?.subjectPatientId || patientId);

    if (!clinicianRef || !startsAt || !endsAt) {
      return json({ ok: false, error: 'clinicianId_startsAt_endsAt_required' }, 400);
    }

    if (endsAt <= startsAt) {
      return json({ ok: false, error: 'invalid_time_range' }, 400);
    }

    if (!patientId) {
      return json({ ok: false, error: 'patient_identity_required' }, 401);
    }

    const clinician = await prisma.clinicianProfile.findFirst({
      where: {
        OR: [
          { id: clinicianRef },
          { userId: clinicianRef },
          { email: clinicianRef },
        ],
      },
      select: {
        id: true,
        displayName: true,
        feeCents: true,
        currency: true,
        status: true,
        disabled: true,
        archived: true,
      },
    });

    if (!clinician) return json({ ok: false, error: 'unknown_clinician' }, 404);

    if (
      clinician.disabled ||
      clinician.archived ||
      String(clinician.status || '').toLowerCase() !== 'active'
    ) {
      return json({ ok: false, error: 'clinician_not_bookable' }, 409);
    }

    const activeStatuses = ['cancelled', 'canceled', 'Cancelled', 'completed', 'Completed'];

    const clinicianConflict = await prisma.appointment.findFirst({
      where: {
        clinicianId: clinician.id,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        status: { notIn: activeStatuses },
      },
      select: { id: true, startsAt: true, endsAt: true },
    });

    if (clinicianConflict) {
      return json({ ok: false, error: 'clinician_conflict', conflict: clinicianConflict }, 409);
    }

    const patientConflictOr: any[] = [];
    if (patientId) patientConflictOr.push({ patientId }, { hostUserId: patientId });
    if (hostUserId) patientConflictOr.push({ hostUserId });
    if (subjectPatientId) patientConflictOr.push({ subjectPatientId });

    const patientConflict = patientConflictOr.length
      ? await prisma.appointment.findFirst({
          where: {
            OR: patientConflictOr,
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
            status: { notIn: activeStatuses },
          },
          select: { id: true, startsAt: true, endsAt: true, clinicianId: true },
        })
      : null;

    if (patientConflict) {
      return json({ ok: false, error: 'patient_conflict', conflict: patientConflict }, 409);
    }

    const amountMinor = Math.max(0, Math.round(Number(body.priceCents || body.amountMinor || clinician.feeCents || 0)));

    return json({
      ok: true,
      eligible: true,
      clinicianId: clinician.id,
      patientId,
      subjectPatientId,
      hostUserId,
      priceLock: {
        token: 'plock-' + crypto.randomUUID(),
        amountMinor,
        currency: clean(body.currency, 3) || clinician.currency || 'ZAR',
        expiresInSeconds: 900,
      },
      warnings: [],
    });
  } catch (e: any) {
    console.error('[appointments.preflight] error', e);
    return json({ ok: false, error: e?.message || 'appointment_preflight_failed' }, 500);
  }
}
