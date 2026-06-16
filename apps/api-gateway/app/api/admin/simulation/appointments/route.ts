import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { upsertTicket } from '@/src/lib/join';
import { verifyAdminRequest } from '../../utils/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'cache-control': 'no-store, max-age=0',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST,OPTIONS',
      'access-control-allow-headers':
        'content-type,authorization,cookie,x-uid,x-role,x-org-id,x-ambulant-identity',
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST,OPTIONS',
      'access-control-allow-headers':
        'content-type,authorization,cookie,x-uid,x-role,x-org-id,x-ambulant-identity',
    },
  });
}

function cleanStr(value: unknown, max = 240): string {
  return String(value ?? '').trim().slice(0, max);
}

function cleanOptional(value: unknown, max = 240): string | null {
  const s = cleanStr(value, max);
  return s ? s : null;
}

function positiveInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function validDateOrDefault(value: unknown, fallback: Date) {
  const raw = cleanStr(value, 120);
  if (!raw) return fallback;

  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d : fallback;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

function appOrigin(req: NextRequest, names: string[], fallback: string) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim().replace(/\/+$/, '');
  }

  const origin = req.headers.get('origin');
  if (origin && origin.trim()) return origin.trim().replace(/\/+$/, '');

  return fallback.replace(/\/+$/, '');
}

function buildJoinPath(args: {
  app: 'clinician' | 'patient';
  roomId: string;
  visitId: string;
  appointmentId: string;
  participantId: string;
  participantRole: string;
  joinToken?: string | null;
  context?: Record<string, string | number | boolean | null | undefined>;
}) {
  const qs = new URLSearchParams();
  qs.set('appointmentId', args.appointmentId);
  qs.set('visitId', args.visitId);
  qs.set('participantId', args.participantId);
  qs.set('participantRole', args.participantRole);

  if (args.joinToken) {
    qs.set('joinToken', args.joinToken);
    qs.set('jt', args.joinToken);
  }

  if (args.context) {
    for (const [key, value] of Object.entries(args.context)) {
      if (value === null || value === undefined || value === '') continue;
      qs.set(key, String(value));
    }
  }

  const basePath = args.app === 'clinician' ? '/sfu' : '/televisit';
  return `${basePath}/${encodeURIComponent(args.roomId)}?${qs.toString()}`;
}

function canCreateSimulation(adminCheck: any) {
  if (adminCheck?.ok === false) return false;
  if (adminCheck === false || adminCheck == null) return false;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const adminCheck = await verifyAdminRequest(req as any);

    if ((adminCheck as any)?.ok === false) {
      return (adminCheck as any).response;
    }

    if (!canCreateSimulation(adminCheck)) {
      return json({ ok: false, error: 'admin_required' }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as any;

    const clinicianId = cleanStr(body.clinicianId, 120);
    if (!clinicianId) {
      return json({ ok: false, error: 'clinicianId_required' }, 400);
    }

    const now = new Date();
    const durationMinutes = positiveInt(body.durationMinutes, 30, 10, 120);
    const sessionNumber = positiveInt(body.sessionNumber, 1, 1, 3);

    const startsAt = validDateOrDefault(body.startsAt, addMinutes(now, 2));
    const endsAt = addMinutes(startsAt, durationMinutes);

    const joinOpensAt = addMinutes(startsAt, -15);
    const joinClosesAt = addMinutes(endsAt, 30);

    const clinician = await prisma.clinicianProfile.findUnique({
      where: { id: clinicianId },
      select: {
        id: true,
        displayName: true,
        specialty: true,
        email: true,
        trainingCompleted: true,
        disabled: true,
        archived: true,
      },
    });

    if (!clinician) {
      return json({ ok: false, error: 'clinician_not_found' }, 404);
    }

    if (clinician.disabled || clinician.archived) {
      return json({ ok: false, error: 'clinician_not_active' }, 409);
    }

    if (!clinician.trainingCompleted) {
      return json(
        {
          ok: false,
          error: 'training_not_completed',
          message: 'Simulation appointments can only be created after mandatory training is completed.',
        },
        409,
      );
    }

    const appointmentId = uid('sim-appt');
    const encounterId = uid('sim-enc');
    const caseId = uid('sim-case');
    const roomId = `simulation-${clinicianId.slice(-8)}-${Date.now()}`;

    const patientId =
      cleanOptional(body.patientId, 120) ||
      `sim-patient-${clinicianId.slice(-8)}`;

    const patientName =
      cleanOptional(body.patientName, 180) ||
      `Simulation Patient ${sessionNumber}`;

    const clinicianParticipantId = `clin-${clinicianId}`;
    const patientParticipantId = `pat-${patientId}`;

    const adminUid =
      cleanOptional(req.headers.get('x-uid'), 120) ||
      cleanOptional((adminCheck as any)?.uid, 120) ||
      'admin';

    const orgId =
      cleanOptional(req.headers.get('x-org-id'), 120) ||
      cleanOptional(body.orgId, 120) ||
      'org-default';

    const reason =
      cleanOptional(body.reason, 500) ||
      `Supervised simulation consultation ${sessionNumber}/3`;

    const appointmentMeta = {
      simulation: true,
      billingMode: 'simulation',
      source: 'admin.simulation',
      supervised: true,
      sessionNumber,
      paymentWaived: true,
      createdByAdminId: adminUid,
      patientDisplayName: patientName,
      participants: [
        {
          partyId: clinicianParticipantId,
          role: 'LEAD_CLINICIAN',
          clinicianId,
          name: clinician.displayName || 'Clinician',
          specialty: clinician.specialty || null,
          required: true,
          source: 'implicit',
          access: {
            canJoinTelevisit: true,
            canViewHealth: true,
            canBookAppointments: false,
          },
        },
        {
          partyId: patientParticipantId,
          role: 'PRIMARY_PATIENT',
          patientId,
          name: patientName,
          required: true,
          source: 'requested',
          access: {
            canJoinTelevisit: true,
            canViewHealth: false,
            canBookAppointments: false,
          },
        },
      ],
      simulationChecklist: {
        appointmentBooked: true,
        televisitCreated: true,
        tokenFlowRequired: true,
        cardPaymentRequired: false,
        medicalAidClaimRequired: false,
        payoutEligible: false,
      },
    };

    const created = await prisma.$transaction(async (tx) => {
      const encounter = await tx.encounter.create({
        data: {
          id: encounterId,
          caseId,
          patientId,
          clinicianId,
          visitMode: 'TELEVISIT',
          status: 'simulation_scheduled',
          orgId,
          summaryPayload: {
            simulation: true,
            source: 'admin.simulation',
            sessionNumber,
          },
        },
      });

      const appointment = await tx.appointment.create({
        data: {
          id: appointmentId,
          encounterId: encounter.id,
          caseId,
          clinicianId,
          patientId,
          subjectPatientId: patientId,
          roomId,
          reason,
          kind: 'STANDARD',
          visitMode: 'TELEVISIT',
          startsAt,
          endsAt,
          status: 'confirmed',
          confirmedAt: now,

          paymentStatus: 'NOT_REQUIRED',
          paymentProvider: 'simulation',
          paymentRef: `simulation-waived-${appointmentId}`,

          priceCents: 0,
          currency: 'ZAR',
          platformFeeCents: 0,
          clinicianTakeCents: 0,

          amountMinor: 0,
          subtotalMinor: 0,
          taxMinor: 0,
          discountMinor: 0,
          totalMinor: 0,

          patientCopayMinor: 0,
          sponsorAmountMinor: 0,
          sponsorCurrency: 'ZAR',
          coverageDecision: 'simulation_not_billable',

          bookingSource: 'admin_simulation',
          meta: appointmentMeta,
          orgId,
        },
      });

      const televisit = await tx.televisit.create({
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
        },
      });

      await tx.appointmentAuditEvent.create({
        data: {
          appointmentId: appointment.id,
          action: 'simulation_appointment_created',
          actorType: 'admin',
          actorUserId: adminUid,
          reason,
          afterJson: {
            appointmentId: appointment.id,
            televisitId: televisit.id,
            roomId,
            clinicianId,
            patientId,
            sessionNumber,
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
          },
          orgId,
        },
      }).catch(() => null);

      return { encounter, appointment, televisit };
    });

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

    const joinTokenTtlSec = Math.max(
      900,
      Math.ceil((new Date(created.televisit.joinClosesAt).getTime() - Date.now()) / 1000),
    );

    const clinicianTicket = await upsertTicket(
      created.televisit.id,
      clinicianParticipantId,
      joinTokenTtlSec,
      'clinician' as any,
      req as any,
    );

    const patientTicket = await upsertTicket(
      created.televisit.id,
      patientParticipantId,
      joinTokenTtlSec,
      'patient' as any,
      req as any,
    );

    if (!clinicianTicket?.token || !patientTicket?.token) {
      throw new Error('simulation_join_token_not_issued');
    }

    const createdAppointment = created.appointment as any;
    const createdTelevisit = created.televisit as any;
    const createdAppointmentMeta =
      createdAppointment?.meta && typeof createdAppointment.meta === 'object'
        ? (createdAppointment.meta as any)
        : {};

    const participants = Array.isArray(createdAppointmentMeta.participants)
      ? createdAppointmentMeta.participants
      : [];

    const clinicianParty =
      participants.find((p: any) => String(p?.role || '').toUpperCase().includes('CLINICIAN')) || {};
    const patientParty =
      participants.find((p: any) => String(p?.role || '').toUpperCase().includes('PATIENT')) || {};

    const startIso = createdAppointment?.startsAt
      ? new Date(createdAppointment.startsAt).toISOString()
      : undefined;

    const endIso = createdAppointment?.endsAt
      ? new Date(createdAppointment.endsAt).toISOString()
      : undefined;

    const durationMin =
      startIso && endIso
        ? Math.max(1, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000))
        : undefined;

    const simulationContext = {
      simulation: '1',
      simulationSession: String(createdAppointmentMeta.sessionNumber || ''),
      bookingSource: 'admin.simulation',

      roomId,
      visitId: createdTelevisit.id,
      appointmentId,
      encounterId: createdAppointment?.encounterId,

      clinicianId: createdAppointment?.clinicianId || clinicianParty?.clinicianId,
      clinicianName: clinicianParty?.name,
      clinicianSpecialty: clinicianParty?.specialty,

      patientId: createdAppointment?.patientId || patientParty?.patientId,
      patientName: createdAppointmentMeta.patientDisplayName || patientParty?.name,

      reason: createdAppointment?.reason || createdAppointmentMeta.reason,
      startsAt: startIso,
      scheduledStartAt: startIso,
      endsAt: endIso,
      scheduledEndAt: endIso,
      durationMin,
      sessionDurationMin: durationMin,

      paymentStatus: createdAppointment?.paymentStatus,
      paymentMethod: createdAppointment?.paymentMethod || 'SIMULATION',
      feeZar: 0,
    };

    const clinicianPath = buildJoinPath({
      app: 'clinician',
      roomId,
      visitId: created.televisit.id,
      appointmentId,
      participantId: clinicianParticipantId,
      participantRole: 'clinician',
      joinToken: clinicianTicket.token,
      context: simulationContext,
    });

    const patientPath = buildJoinPath({
      app: 'patient',
      roomId,
      visitId: created.televisit.id,
      appointmentId,
      participantId: patientParticipantId,
      participantRole: 'patient',
      joinToken: patientTicket.token,
      context: simulationContext,
    });

    return json({
      ok: true,
      mode: 'simulation',
      appointment: {
        id: created.appointment.id,
        clinicianId,
        patientId,
        status: created.appointment.status,
        paymentStatus: created.appointment.paymentStatus,
        startsAt: created.appointment.startsAt,
        endsAt: created.appointment.endsAt,
        roomId,
        meta: created.appointment.meta,
      },
      televisit: {
        id: created.televisit.id,
        roomId: created.televisit.roomId,
        appointmentId: created.televisit.appointmentId,
        joinOpensAt: created.televisit.joinOpensAt,
        joinClosesAt: created.televisit.joinClosesAt,
        scheduledStartAt: created.televisit.scheduledStartAt,
        scheduledEndAt: created.televisit.scheduledEndAt,
        status: created.televisit.status,
      },
      join: {
        clinician: {
          participantId: clinicianParticipantId,
          path: clinicianPath,
          url: `${clinicianOrigin}${clinicianPath}`,
          tokenIssued: true,
          tokenExpiresAt: clinicianTicket.expiresAt,
        },
        testPatient: {
          participantId: patientParticipantId,
          path: patientPath,
          url: `${patientOrigin}${patientPath}`,
          tokenIssued: true,
          tokenExpiresAt: patientTicket.expiresAt,
        },
      },
    });
  } catch (err: any) {
    console.error('[api-gateway][admin][simulation][appointments] error', err);

    return json(
      {
        ok: false,
        error: String(err?.message || 'simulation_appointment_failed'),
      },
      500,
    );
  }
}
