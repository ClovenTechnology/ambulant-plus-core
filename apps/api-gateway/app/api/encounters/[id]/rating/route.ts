import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers':
      'content-type,authorization,cookie,x-uid,x-role,x-org-id,x-ambulant-identity,x-ambulant-user-id,x-ambulant-patient-id,x-ambulant-org-id,x-ambulant-role,x-user-id,x-patient-id,x-actor-ref-id,x-request-id,idempotency-key,x-idempotency-key',
    'cache-control': 'no-store, max-age=0',
  };
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function parseStars(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function safeJsonObject(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function unique(values: unknown[]) {
  return Array.from(new Set(values.map((value) => clean(value, 180)).filter(Boolean)));
}

function headerValue(req: NextRequest, names: string[]) {
  for (const name of names) {
    const value = clean(req.headers.get(name), 180);
    if (value) return value;
  }

  return '';
}

function isCompletedEncounter(encounter: any, appointment: any) {
  if (encounter?.consultationEndedAt) return true;
  if (appointment?.completedAt) return true;

  const statusBlob = [
    encounter?.status,
    appointment?.status,
    appointment?.paymentStatus,
    encounter?.summaryPayload?.status,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return ['completed', 'complete', 'closed', 'done', 'finished', 'ended'].some((token) =>
    statusBlob.includes(token),
  );
}

async function resolvePatientCandidates(req: NextRequest, uid: string, actorRefId: string | null) {
  const rawCandidates = unique([
    uid,
    actorRefId,
    headerValue(req, ['x-patient-id', 'x-ambulant-patient-id', 'x-current-patient-id']),
  ]);

  if (!rawCandidates.length) return [];

  const profiles = await (prisma as any).patientProfile.findMany({
    where: {
      OR: rawCandidates.flatMap((id) => [{ id }, { userId: id }]),
    },
    select: { id: true, userId: true },
    take: 20,
  });

  return unique(rawCandidates.concat(profiles.flatMap((profile: any) => [profile.id, profile.userId])));
}

async function loadEncounterAndAppointment(encounterId: string) {
  const encounter = await (prisma as any).encounter.findUnique({
    where: { id: encounterId },
  });

  if (!encounter) return { encounter: null, appointment: null };

  const appointment = await (prisma as any).appointment.findFirst({
    where: { encounterId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      encounterId: true,
      caseId: true,
      patientId: true,
      subjectPatientId: true,
      clinicianId: true,
      status: true,
      paymentStatus: true,
      startsAt: true,
      endsAt: true,
      completedAt: true,
      createdAt: true,
      orgId: true,
    },
  });

  return { encounter, appointment };
}

async function findClinicianProfile(clinicianRef: string) {
  if (!clinicianRef) return null;

  return (prisma as any).clinicianProfile.findFirst({
    where: {
      OR: [{ id: clinicianRef }, { userId: clinicianRef }],
    },
    select: {
      id: true,
      userId: true,
      displayName: true,
      ratingAvg: true,
      ratingCount: true,
      ratingSum: true,
      status: true,
      disabled: true,
      archived: true,
      meta: true,
    },
  });
}

function publicRatingPayload(clinician: any, governanceTriggered = false) {
  const ratingAvg = Number(clinician?.ratingAvg ?? 0);
  const ratingCount = Number(clinician?.ratingCount ?? 0);
  const ratingSum = Number(clinician?.ratingSum ?? 0);

  return {
    clinicianId: clinician?.id,
    clinicianUserId: clinician?.userId,
    rating: Number.isFinite(ratingAvg) ? ratingAvg : 0,
    ratingAvg: Number.isFinite(ratingAvg) ? ratingAvg : 0,
    ratingAverage: Number.isFinite(ratingAvg) ? ratingAvg : 0,
    ratingCount: Number.isFinite(ratingCount) ? ratingCount : 0,
    ratingsCount: Number.isFinite(ratingCount) ? ratingCount : 0,
    reviewCount: Number.isFinite(ratingCount) ? ratingCount : 0,
    totalRatings: Number.isFinite(ratingCount) ? ratingCount : 0,
    ratingSum: Number.isFinite(ratingSum) ? ratingSum : 0,
    governanceTriggered,
    status: clinician?.status ?? null,
    disabled: Boolean(clinician?.disabled),
  };
}

async function recalculateClinicianRating(tx: any, clinician: any, governance: any) {
  const aggregate = await tx.clinicianRating.aggregate({
    where: { clinicianUserId: clinician.userId },
    _sum: { stars: true },
    _count: { _all: true },
  });

  const ratingSum = Number(aggregate?._sum?.stars ?? 0);
  const ratingCount = Number(aggregate?._count?._all ?? 0);
  const ratingAvg = ratingCount > 0 ? Number((ratingSum / ratingCount).toFixed(2)) : 0;

  const meta = safeJsonObject(clinician.meta);
  const data: Record<string, any> = {
    ratingSum,
    ratingCount,
    ratingAvg,
  };

  if (governance?.triggered) {
    data.status = 'disciplinary';
    data.disabled = true;
    data.meta = Object.assign({}, meta, {
      governanceReview: Object.assign({}, safeJsonObject(meta.governanceReview), {
        active: true,
        reason: 'one_star_patient_rating',
        severity: 'high',
        source: 'encounter_rating',
        triggeredAt: new Date().toISOString(),
        encounterId: governance.encounterId,
        appointmentId: governance.appointmentId,
        patientId: governance.patientId,
        ratingId: governance.ratingId,
        action: 'temporary_booking_hold_pending_admin_investigation',
      }),
    });
  }

  return tx.clinicianProfile.update({
    where: { id: clinician.id },
    data,
    select: {
      id: true,
      userId: true,
      displayName: true,
      ratingAvg: true,
      ratingCount: true,
      ratingSum: true,
      status: true,
      disabled: true,
      archived: true,
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const encounterId = clean(params.id, 180);
    if (!encounterId) return json({ ok: false, error: 'missing_encounter_id' }, 400);

    const who = readIdentity(req.headers);
    const uid = clean((who as any)?.uid, 180);
    const role = clean((who as any)?.role || 'anonymous', 80).toLowerCase();

    if (!uid || role === 'anonymous') {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }

    const { encounter, appointment } = await loadEncounterAndAppointment(encounterId);
    if (!encounter) return json({ ok: false, error: 'encounter_not_found' }, 404);

    const patientCandidates = await resolvePatientCandidates(req, uid, (who as any)?.actorRefId || null);

    const allowed =
      ['admin', 'system', 'clinician'].includes(role) ||
      patientCandidates.includes(clean(encounter.patientId, 180)) ||
      patientCandidates.includes(clean(appointment?.patientId, 180)) ||
      patientCandidates.includes(clean(appointment?.subjectPatientId, 180));

    if (!allowed) return json({ ok: false, error: 'forbidden' }, 403);

    const clinician = await findClinicianProfile(clean(encounter.clinicianId || appointment?.clinicianId, 180));
    if (!clinician?.userId) return json({ ok: false, error: 'clinician_not_found' }, 404);

    const rating = await (prisma as any).clinicianRating.findFirst({
      where: {
        clinicianUserId: clinician.userId,
        patientId: clean(encounter.patientId || appointment?.patientId || appointment?.subjectPatientId, 180),
        ...(appointment?.id ? { appointmentId: appointment.id } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        appointmentId: true,
        stars: true,
        comment: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return json({
      ok: true,
      encounterId,
      caseId: encounter.caseId || appointment?.caseId || null,
      rating,
      clinician: publicRatingPayload(clinician),
    });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'encounter_rating_get_failed' }, 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const encounterId = clean(params.id, 180);
    if (!encounterId) return json({ ok: false, error: 'missing_encounter_id' }, 400);

    const who = readIdentity(req.headers);
    const uid = clean((who as any)?.uid, 180);
    const role = clean((who as any)?.role || 'anonymous', 80).toLowerCase();

    if (!uid || role === 'anonymous') {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }

    if (!['patient', 'admin', 'system'].includes(role)) {
      return json({ ok: false, error: 'patient_rating_required' }, 403);
    }

    const body = await req.json().catch(() => ({} as any));
    const stars = parseStars(body.stars ?? body.score ?? body.rating);
    const comment = clean(body.comment, 1200) || null;

    if (stars < 1 || stars > 5) {
      return json({ ok: false, error: 'invalid_rating_stars' }, 400);
    }

    const { encounter, appointment } = await loadEncounterAndAppointment(encounterId);
    if (!encounter) return json({ ok: false, error: 'encounter_not_found' }, 404);

    if (!isCompletedEncounter(encounter, appointment)) {
      return json(
        {
          ok: false,
          error: 'encounter_not_completed',
          message: 'Patients can rate only after the encounter has been completed.',
        },
        409,
      );
    }

    if (!appointment?.id) {
      return json(
        {
          ok: false,
          error: 'rating_requires_appointment_anchor',
          message:
            'This schema currently stores clinician ratings against appointments. A future EncounterReview model should add direct encounter/case anchoring.',
        },
        409,
      );
    }

    const patientCandidates = await resolvePatientCandidates(req, uid, (who as any)?.actorRefId || null);
    const encounterPatientId = clean(encounter.patientId || appointment.patientId || appointment.subjectPatientId, 180);

    const patientOwnsEncounter =
      patientCandidates.includes(encounterPatientId) ||
      patientCandidates.includes(clean(appointment.patientId, 180)) ||
      patientCandidates.includes(clean(appointment.subjectPatientId, 180));

    if (role === 'patient' && !patientOwnsEncounter) {
      return json({ ok: false, error: 'forbidden_patient_encounter_scope' }, 403);
    }

    const clinician = await findClinicianProfile(clean(encounter.clinicianId || appointment.clinicianId, 180));
    if (!clinician?.id || !clinician?.userId) {
      return json({ ok: false, error: 'clinician_not_found' }, 404);
    }

    const result = await (prisma as any).$transaction(async (tx: any) => {
      const existing = await tx.clinicianRating.findUnique({
        where: { appointmentId: appointment.id },
        select: { id: true, stars: true },
      });

      const rating = existing
        ? await tx.clinicianRating.update({
            where: { id: existing.id },
            data: { stars, comment },
          })
        : await tx.clinicianRating.create({
            data: {
              clinicianUserId: clinician.userId,
              patientId: encounterPatientId,
              appointmentId: appointment.id,
              stars,
              comment,
              orgId: clean(encounter.orgId || appointment.orgId, 120) || 'org-default',
            },
          });

      const governanceTriggered = stars === 1;

      const updatedClinician = await recalculateClinicianRating(tx, clinician, {
        triggered: governanceTriggered,
        encounterId,
        appointmentId: appointment.id,
        patientId: encounterPatientId,
        ratingId: rating.id,
      });

      return { rating, clinician: updatedClinician, governanceTriggered };
    });

    return json({
      ok: true,
      encounterId,
      caseId: encounter.caseId || appointment.caseId || null,
      appointmentId: appointment.id,
      rating: {
        id: result.rating.id,
        stars: result.rating.stars,
        comment: result.rating.comment,
        createdAt: result.rating.createdAt,
        updatedAt: result.rating.updatedAt,
      },
      clinician: publicRatingPayload(result.clinician, result.governanceTriggered),
      governance: result.governanceTriggered
        ? {
            triggered: true,
            action: 'temporary_booking_hold_pending_admin_investigation',
            clinicianStatus: result.clinician.status,
            clinicianDisabled: result.clinician.disabled,
          }
        : { triggered: false },
    });
  } catch (error: any) {
    const message = String(error?.message || 'encounter_rating_failed');
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;

    return json({ ok: false, error: message }, status);
  }
}