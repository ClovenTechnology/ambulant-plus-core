// apps/api-gateway/app/api/appointments/route.ts
import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { TelevisitRole } from '@prisma/client';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { upsertTicket } from '@/src/lib/join';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers':
      'content-type,authorization,cookie,x-uid,x-role,x-org-id,x-ambulant-identity,x-request-id,idempotency-key,x-idempotency-key',
    'cache-control': 'no-store',
  };
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: corsHeaders(),
  });
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function cents(value: unknown, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.round(n));
}

function dateFrom(value: unknown) {
  const d = new Date(String(value || ''));
  return Number.isFinite(d.getTime()) ? d : null;
}

function isSimulationAppointment(item: any) {
  const ids = [item?.id, item?.encounterId, item?.patientId, item?.roomId];
  if (ids.filter(Boolean).some((v) => String(v).startsWith('sim-') || String(v).startsWith('simulation-'))) {
    return true;
  }

  const source = String(item?.bookingSource || item?.meta?.source || '').toLowerCase();
  return source.includes('simulation') || item?.meta?.simulation === true;
}

function appOrigin(req: NextRequest, envKeys: string[], fallback: string) {
  for (const key of envKeys) {
    const v = clean(process.env[key]);
    if (v) return v.replace(/\/+$/, '');
  }

  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';

  if (host.includes('api') || host.includes('gateway')) return fallback;
  return host ? proto + '://' + host : fallback;
}

function buildJoinUrl(origin: string, roomId: string, params: Record<string, string | null | undefined>) {
  const url = new URL(origin.replace(/\/+$/, '') + '/sfu/' + encodeURIComponent(roomId));
  Object.entries(params).forEach(([key, value]) => {
    const v = clean(value);
    if (v) url.searchParams.set(key, v);
  });
  return url.toString();
}

function uniqueClean(values: unknown[]) {
  return Array.from(
    new Set(
      values
        .map((v) => clean(v))
        .filter(Boolean),
    ),
  );
}

function patientDisplay(profile: any, fallback: unknown) {
  return (
    clean(profile?.name) ||
    clean(profile?.displayName) ||
    clean(profile?.fullName) ||
    clean(fallback) ||
    'Patient'
  );
}

function clinicianDisplay(profile: any, fallback: unknown) {
  return (
    clean(profile?.displayName) ||
    clean(profile?.name) ||
    clean(profile?.email) ||
    clean(fallback) ||
    'Clinician'
  );
}

function shapeAppointment(
  item: any,
  visitByAppt: Map<string, any>,
  clinicianById = new Map<string, any>(),
  patientById = new Map<string, any>(),
) {
  const visit = visitByAppt.get(String(item.id));
  const meta = item?.meta && typeof item.meta === 'object' ? item.meta : {};

  const subjectId = item.subjectPatientId || item.patientId;
  const patient =
    patientById.get(String(subjectId || '')) ||
    patientById.get(String(item.patientId || '')) ||
    null;

  const clinician = clinicianById.get(String(item.clinicianId || '')) || null;

  const roomId = item.roomId ?? visit?.roomId ?? meta.roomId ?? null;
  const patientName = clean(meta.patientDisplayName) || patientDisplay(patient, subjectId || item.patientId);
  const clinicianName = clean(meta.clinicianDisplayName) || clinicianDisplay(clinician, item.clinicianId);

  return {
    ...item,
    appointmentId: item.id,
    startsAt: item.startsAt instanceof Date ? item.startsAt.toISOString() : item.startsAt,
    endsAt: item.endsAt instanceof Date ? item.endsAt.toISOString() : item.endsAt,
    createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
    updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt,
    visitId: visit?.id ?? meta.visitId ?? null,
    televisitId: visit?.id ?? meta.televisitId ?? null,
    roomId,
    patientJoinUrl: meta.patientJoinUrl ?? null,
    clinicianJoinUrl: meta.clinicianJoinUrl ?? null,
    patientParticipantId: meta.patientParticipantId ?? (item.patientId ? 'pat-' + item.patientId : null),
    clinicianParticipantId: meta.clinicianParticipantId ?? (item.clinicianId ? 'clin-' + item.clinicianId : null),

    patientName,
    patientDisplayName: patientName,
    patientAvatarUrl: patient?.photoUrl ?? meta.patientAvatarUrl ?? null,
    patientGender: patient?.gender ?? null,
    patientDob: patient?.dob instanceof Date ? patient.dob.toISOString() : patient?.dob ?? null,

    clinicianName,
    clinicianDisplayName: clinicianName,
    clinicianSpecialty: clinician?.specialty ?? meta.clinicianSpecialty ?? null,
    clinicianAvatarUrl: clinician?.photoUrl ?? meta.clinicianAvatarUrl ?? null,
    clinicianGender: clinician?.gender ?? null,
    clinicianLocation:
      clean(clinician?.city) ||
      clean(clinician?.practiceName) ||
      clean(clinician?.country) ||
      null,
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: NextRequest) {
  try {
    const who = readIdentity(req.headers);
    const u = new URL(req.url);

    let patientId = clean(u.searchParams.get('patientId')) || undefined;
    const subjectPatientId = clean(u.searchParams.get('subjectPatientId')) || undefined;
    const clinicianId = clean(u.searchParams.get('clinicianId')) || undefined;

    if (!patientId && who.role === 'patient') {
      patientId = clean(who.actorRefId || who.uid) || undefined;
    }

    const excludeSimulation =
      u.searchParams.get('excludeSimulation') === '1' ||
      u.searchParams.get('production') === '1' ||
      u.searchParams.get('production-check') === '1';

    const where: any = {};

    if (clinicianId) where.clinicianId = clinicianId;

    const patientOr: any[] = [];
    if (patientId) {
      patientOr.push({ patientId });
      patientOr.push({ hostUserId: patientId });
    }
    if (subjectPatientId) {
      patientOr.push({ subjectPatientId });
    }

    if (patientOr.length === 1) {
      Object.assign(where, patientOr[0]);
    } else if (patientOr.length > 1) {
      where.OR = patientOr;
    }

    const from = dateFrom(u.searchParams.get('from') || u.searchParams.get('dateFrom'));
    const to = dateFrom(u.searchParams.get('to') || u.searchParams.get('dateTo'));

    if (from || to) {
      where.startsAt = {};
      if (from) where.startsAt.gte = from;
      if (to) where.startsAt.lt = to;
    }

    const rawItems = await prisma.appointment.findMany({
      where,
      orderBy: { startsAt: 'desc' },
      take: 300,
    });

    const filtered = excludeSimulation
      ? rawItems.filter((item) => !isSimulationAppointment(item))
      : rawItems;

    const visitRows = filtered.length
      ? await prisma.televisit.findMany({
          where: { appointmentId: { in: filtered.map((item) => item.id) } },
        })
      : [];

    const clinicianIds = uniqueClean(filtered.map((item) => item.clinicianId));
    const patientIds = uniqueClean(
      filtered.flatMap((item) => [item.patientId, item.subjectPatientId, item.hostUserId]),
    );

    const [clinicianRows, patientRows] = await Promise.all([
      clinicianIds.length
        ? prisma.clinicianProfile.findMany({
            where: { id: { in: clinicianIds } },
            select: {
              id: true,
              userId: true,
              displayName: true,
              specialty: true,
              gender: true,
              photoUrl: true,
              city: true,
              country: true,
              practiceName: true,
              email: true,
            },
          })
        : Promise.resolve([]),
      patientIds.length
        ? prisma.patientProfile.findMany({
            where: {
              OR: [
                { id: { in: patientIds } },
                { userId: { in: patientIds } },
              ],
            },
            select: {
              id: true,
              userId: true,
              name: true,
              gender: true,
              dob: true,
              photoUrl: true,
              contactEmail: true,
              phone: true,
              city: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const visitByAppt = new Map(visitRows.map((v) => [String(v.appointmentId), v]));
    const clinicianById = new Map(clinicianRows.map((c) => [String(c.id), c]));

    const patientById = new Map();
    for (const p of patientRows as any[]) {
      patientById.set(String(p.id), p);
      if (p.userId) patientById.set(String(p.userId), p);
    }

    const items = filtered.map((item) =>
      shapeAppointment(item, visitByAppt, clinicianById, patientById),
    );

    return json({
      ok: true,
      appointments: items,
      items,
      total: items.length,
    });
  } catch (err: any) {
    console.error('[api-gateway][appointments.GET] error', err);
    return json({ ok: false, error: err?.message || 'appointments_load_failed' }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const who = readIdentity(req.headers);
    const body = await req.json().catch(() => ({} as any));

    const clinicianRef = clean(
      body.clinicianId ||
      body.clinician_id ||
      body.providerId ||
      body.provider_id,
    );

    const patientId = clean(
      body.patientId ||
      body.patient_id ||
      who.actorRefId ||
      who.uid,
    );

    if (!clinicianRef) return json({ ok: false, error: 'clinicianId_required' }, 400);
    if (!patientId) return json({ ok: false, error: 'patient_identity_required' }, 401);

    const hostUserId = clean(body.hostUserId || body.host_user_id || who.uid || patientId);
    const subjectPatientId = clean(
      body.subjectPatientId ||
        body.subject_patient_id ||
        body.person?.subjectPatientId ||
        patientId,
    );

    const startsAt = dateFrom(body.startsAt || body.starts_at || body.start || body.startTime);
    if (!startsAt) return json({ ok: false, error: 'startsAt_required' }, 400);

    const durationMin = Math.max(
      5,
      Math.min(
        240,
        Number(body.durationMin || body.durationMinutes || body.duration_min || 30) || 30,
      ),
    );

    const endsAt =
      dateFrom(body.endsAt || body.ends_at || body.end || body.endTime) ||
      new Date(startsAt.getTime() + durationMin * 60 * 1000);

    if (endsAt <= startsAt) return json({ ok: false, error: 'invalid_time_range' }, 400);

    const joinClosesAtPreview = new Date(endsAt.getTime() + 60 * 60 * 1000);

    if (joinClosesAtPreview.getTime() <= Date.now() + 30_000) {
      return json(
        {
          ok: false,
          error: 'appointment_window_expired',
          message: 'This slot is no longer available. Please choose a future slot.',
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          joinClosesAt: joinClosesAtPreview.toISOString(),
        },
        400,
      );
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
        userId: true,
        displayName: true,
        specialty: true,
        gender: true,
        photoUrl: true,
        city: true,
        country: true,
        practiceName: true,
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

    const patientProfile = subjectPatientId
      ? await prisma.patientProfile.findFirst({
          where: {
            OR: [
              { id: subjectPatientId },
              { userId: subjectPatientId },
              { id: patientId },
              { userId: patientId },
            ],
          },
          select: { id: true, userId: true, name: true, gender: true, dob: true, photoUrl: true },
        }).catch(() => null)
      : null;

    const activeStatuses = ['cancelled', 'canceled', 'Cancelled', 'completed', 'Completed'];

    const conflict = await prisma.appointment.findFirst({
      where: {
        clinicianId: clinician.id,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        status: { notIn: activeStatuses },
      },
      select: { id: true },
    });

    if (conflict) return json({ ok: false, error: 'clinician_conflict', appointmentId: conflict.id }, 409);

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
      return json(
        {
          ok: false,
          error: 'patient_conflict',
          appointmentId: patientConflict.id,
          startsAt: patientConflict.startsAt,
          endsAt: patientConflict.endsAt,
          clinicianId: patientConflict.clinicianId,
        },
        409,
      );
    }

    const now = new Date();
    const orgId = clean(body.orgId || body.org_id || req.headers.get('x-org-id')) || 'org-default';

    const appointmentId = clean(body.id || body.appointmentId) || 'appt-' + crypto.randomUUID();
    const encounterId = clean(body.encounterId || body.encounter_id) || 'enc-' + crypto.randomUUID();
    const caseId = clean(body.caseId || body.case_id) || 'case-' + crypto.randomUUID();
    const roomId = clean(body.roomId || body.room_id) || 'room-' + crypto.randomUUID();

    const patientParticipantId = 'pat-' + patientId;
    const clinicianParticipantId = 'clin-' + clinician.id;

    const priceCents = cents(body.priceCents ?? body.price_cents ?? body.amountMinor, clinician.feeCents || 0);
    const currency = clean(body.currency, 3) || clinician.currency || 'ZAR';
    const platformFeeCents = Math.round(priceCents * 0.2);
    const clinicianTakeCents = Math.max(0, priceCents - platformFeeCents);

    const paymentMethodRaw = clean(body.paymentMethod || body.payment_method).toUpperCase();
    const paymentMethod =
      paymentMethodRaw === 'MEDICAL_AID' || paymentMethodRaw === 'VOUCHER' || paymentMethodRaw === 'MPESA'
        ? paymentMethodRaw
        : paymentMethodRaw === 'CARD'
          ? 'CARD'
          : null;

    const paymentStatus =
      priceCents <= 0 || paymentMethod === 'VOUCHER'
        ? 'NOT_REQUIRED'
        : body.paymentStatus === 'AUTHORIZED'
          ? 'AUTHORIZED'
          : body.paymentStatus === 'CAPTURED'
            ? 'CAPTURED'
            : 'PENDING';

    const appointmentStatus =
      paymentStatus === 'PENDING' ? 'pending_payment' : 'confirmed';

    const joinOpensAt = new Date(startsAt.getTime() - 15 * 60 * 1000);
    const joinClosesAt = new Date(endsAt.getTime() + 60 * 60 * 1000);

    const baseMeta = {
      source: 'patient.booking',
      roomId,
      appointmentId,
      encounterId,
      caseId,
      patientParticipantId,
      clinicianParticipantId,
      patientDisplayName:
        clean(body.patientName || body.patient_name) ||
        clean(patientProfile?.name) ||
        'Patient',
      patientAvatarUrl: patientProfile?.photoUrl || null,
      patientGender: patientProfile?.gender || null,
      clinicianDisplayName: clinician.displayName || 'Clinician',
      clinicianAvatarUrl: clinician.photoUrl || null,
      clinicianSpecialty: clinician.specialty || null,
      clinicianGender: clinician.gender || null,
      clinicianLocation: clean(clinician.city) || clean(clinician.practiceName) || clean(clinician.country) || null,
      participants: [
        {
          partyId: clinicianParticipantId,
          clinicianId: clinician.id,
          role: 'LEAD_CLINICIAN',
          required: true,
          source: 'appointment',
          name: clinician.displayName || 'Clinician',
          specialty: clinician.specialty || null,
          access: {
            canJoinTelevisit: true,
            canViewHealth: true,
            canBookAppointments: false,
          },
        },
        {
          partyId: patientParticipantId,
          patientId,
          role: 'PRIMARY_PATIENT',
          required: true,
          source: 'appointment',
          name:
            clean(body.patientName || body.patient_name) ||
            clean(patientProfile?.name) ||
            'Patient',
          access: {
            canJoinTelevisit: true,
            canViewHealth: false,
            canBookAppointments: false,
          },
        },
      ],
    };

    const created = await prisma.$transaction(async (tx) => {
      const encounter = await tx.encounter.create({
        data: {
          id: encounterId,
          caseId,
          patientId,
          clinicianId: clinician.id,
          sessionId: null,
          visitMode: 'TELEVISIT',
          status: 'scheduled',
          orgId,
        } as any,
      });

      const appointment = await tx.appointment.create({
        data: {
          id: appointmentId,
          encounterId: encounter.id,
          sessionId: null,
          caseId,
          clinicianId: clinician.id,
          patientId,
          hostUserId,
          subjectPatientId,
          roomId,
          reason: clean(body.reason || body.title || body.notes) || 'Televisit consultation',
          kind: clean(body.kind).toUpperCase() === 'FOLLOWUP' ? 'FOLLOWUP' : 'STANDARD',
          visitMode: 'TELEVISIT',
          startsAt,
          endsAt,
          status: appointmentStatus,
          confirmedAt: appointmentStatus === 'confirmed' ? now : null,
          paymentMethod: paymentMethod as any,
          paymentStatus: paymentStatus as any,
          paymentProvider: clean(body.paymentProvider || body.payment_provider) || null,
          paymentRef: clean(body.paymentRef || body.payment_ref) || null,
          priceCents,
          currency,
          platformFeeCents,
          clinicianTakeCents,
          amountMinor: priceCents,
          subtotalMinor: priceCents,
          taxMinor: 0,
          discountMinor: 0,
          totalMinor: priceCents,
          patientCopayMinor: priceCents,
          sponsorAmountMinor: 0,
          sponsorCurrency: currency,
          coverageDecision: paymentMethod === 'MEDICAL_AID' ? 'pending_authorisation' : null,
          bookingSource: 'patient_app',
          meta: baseMeta,
          orgId,
        } as any,
      });

      const session = await tx.consultationSession.create({
        data: {
          appointmentId: appointment.id,
          encounterId: encounter.id,
          caseId,
          clinicianId: clinician.id,
          patientId,
          hostUserId,
          visitMode: 'TELEVISIT',
          roomId,
          state: 'READY',
          currency,
          amountAuthorizedMinor: priceCents,
          metadata: baseMeta,
        } as any,
      });

      const visit = await tx.televisit.create({
        data: {
          appointmentId: appointment.id,
          encounterId: encounter.id,
          roomId,
          scheduledStartAt: startsAt,
          scheduledEndAt: endsAt,
          joinOpensAt,
          joinClosesAt,
          status: 'planned',
          orgId,
        } as any,
      });

      await tx.appointmentAuditEvent.create({
        data: {
          appointmentId: appointment.id,
          action: 'patient_booking_created',
          actorType: who.role || 'patient',
          actorUserId: who.uid || patientId,
          reason: clean(body.reason || body.title || body.notes) || null,
          afterJson: {
            appointmentId: appointment.id,
            encounterId: encounter.id,
            consultationSessionId: session.id,
            televisitId: visit.id,
            roomId,
            clinicianId: clinician.id,
            patientId,
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            paymentStatus,
          },
          orgId,
        },
      }).catch(() => null);

      await tx.clinicianProfile.update({
        where: { id: clinician.id },
        data: {
          lastBookedAt: now,
          recentBookedCount: { increment: 1 },
        } as any,
      }).catch(() => null);

      return { encounter, appointment, session, visit };
    });

    const ttlSec = Math.max(3600, Math.ceil((joinClosesAt.getTime() - Date.now()) / 1000));

    const clinicianTicket = await upsertTicket(
      created.visit.id,
      clinicianParticipantId,
      ttlSec,
      TelevisitRole.clinician,
      req,
    );

    const patientTicket = await upsertTicket(
      created.visit.id,
      patientParticipantId,
      ttlSec,
      TelevisitRole.patient,
      req,
    );

    const clinicianOrigin = appOrigin(
      req,
      ['CLINICIAN_APP_ORIGIN', 'NEXT_PUBLIC_CLINICIAN_APP_ORIGIN'],
      'https://clinician.ambulantplus.co.za',
    );

    const patientOrigin = appOrigin(
      req,
      ['PATIENT_APP_ORIGIN', 'NEXT_PUBLIC_PATIENT_APP_ORIGIN'],
      'https://patient.ambulantplus.co.za',
    );

    const sharedParams = {
      visitId: created.visit.id,
      appointmentId: created.appointment.id,
      encounterId: created.encounter.id,
      clinicianId: clinician.id,
      patientId,
      reason: created.appointment.reason || '',
      patientName: baseMeta.patientDisplayName,
      clinicianName: baseMeta.clinicianDisplayName,
    };

    const clinicianJoinUrl = buildJoinUrl(clinicianOrigin, roomId, {
      ...sharedParams,
      participantId: clinicianParticipantId,
      joinToken: clinicianTicket.token || '',
    });

    const patientJoinUrl = buildJoinUrl(patientOrigin, roomId, {
      ...sharedParams,
      participantId: patientParticipantId,
      joinToken: patientTicket.token || '',
    });

    await prisma.appointment.update({
      where: { id: created.appointment.id },
      data: {
        meta: {
          ...baseMeta,
          visitId: created.visit.id,
          televisitId: created.visit.id,
          clinicianJoinUrl,
          patientJoinUrl,
        },
      } as any,
    }).catch(() => null);

    const appointment = {
      ...created.appointment,
      startsAt: created.appointment.startsAt.toISOString(),
      endsAt: created.appointment.endsAt.toISOString(),
      createdAt: created.appointment.createdAt.toISOString(),
      updatedAt: created.appointment.updatedAt.toISOString(),
      visitId: created.visit.id,
      televisitId: created.visit.id,
      roomId,
      clinicianJoinUrl,
      patientJoinUrl,
      clinicianParticipantId,
      patientParticipantId,
      patientName: baseMeta.patientDisplayName,
      patientDisplayName: baseMeta.patientDisplayName,
      patientAvatarUrl: baseMeta.patientAvatarUrl,
      clinicianName: baseMeta.clinicianDisplayName,
      clinicianDisplayName: baseMeta.clinicianDisplayName,
      clinicianAvatarUrl: baseMeta.clinicianAvatarUrl,
      clinicianSpecialty: baseMeta.clinicianSpecialty,
      clinicianLocation: baseMeta.clinicianLocation,
    };

    return json({
      ok: true,
      appointment,
      appointmentId: created.appointment.id,
      appointment_id: created.appointment.id,
      encounterId: created.encounter.id,
      encounter_id: created.encounter.id,
      consultationSessionId: created.session.id,
      visitId: created.visit.id,
      televisitId: created.visit.id,
      roomId,
      clinicianJoinUrl,
      patientJoinUrl,
      paymentStatus,
      status: appointmentStatus,
    }, 201);
  } catch (err: any) {
    console.error('[api-gateway][appointments.POST] error', err);
    const msg = String(err?.message || 'appointment_create_failed');
    const status =
      msg.includes('Unique constraint') ? 409 :
      msg.includes('unauthorized') ? 401 :
      500;

    return json({ ok: false, error: msg }, status);
  }
}
