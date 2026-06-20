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

function shapeAppointment(item: any, visitByAppt: Map<string, any>) {
  const visit = visitByAppt.get(String(item.id));
  const meta = item?.meta && typeof item.meta === 'object' ? item.meta : {};

  return {
    ...item,
    appointmentId: item.id,
    startsAt: item.startsAt instanceof Date ? item.startsAt.toISOString() : item.startsAt,
    endsAt: item.endsAt instanceof Date ? item.endsAt.toISOString() : item.endsAt,
    createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
    updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt,
    visitId: visit?.id ?? meta.visitId ?? null,
    televisitId: visit?.id ?? meta.televisitId ?? null,
    roomId: item.roomId ?? visit?.roomId ?? meta.roomId ?? null,
    patientJoinUrl: meta.patientJoinUrl ?? null,
    clinicianJoinUrl: meta.clinicianJoinUrl ?? null,
    patientParticipantId: meta.patientParticipantId ?? (item.patientId ? 'pat-' + item.patientId : null),
    clinicianParticipantId: meta.clinicianParticipantId ?? (item.clinicianId ? 'clin-' + item.clinicianId : null),
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: NextRequest) {
  try {
    const u = new URL(req.url);
    const patientId = clean(u.searchParams.get('patientId')) || undefined;
    const clinicianId = clean(u.searchParams.get('clinicianId')) || undefined;
    const excludeSimulation =
      u.searchParams.get('excludeSimulation') === '1' ||
      u.searchParams.get('production') === '1' ||
      u.searchParams.get('production-check') === '1';

    const where: any = {};
    if (patientId) where.patientId = patientId;
    if (clinicianId) where.clinicianId = clinicianId;

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

    const visitByAppt = new Map(visitRows.map((v) => [String(v.appointmentId), v]));
    const items = filtered.map((item) => shapeAppointment(item, visitByAppt));

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

    const conflict = await prisma.appointment.findFirst({
      where: {
        clinicianId: clinician.id,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        status: { notIn: ['cancelled', 'canceled', 'Cancelled', 'completed', 'Completed'] },
      },
      select: { id: true },
    });

    if (conflict) return json({ ok: false, error: 'clinician_conflict', appointmentId: conflict.id }, 409);

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
      patientDisplayName: clean(body.patientName || body.patient_name) || 'Patient',
      clinicianDisplayName: clinician.displayName || 'Clinician',
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
          name: clean(body.patientName || body.patient_name) || 'Patient',
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
          subjectPatientId: patientId,
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
