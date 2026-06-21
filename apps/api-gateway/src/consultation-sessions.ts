// apps/api-gateway/src/consultation-sessions.ts
import { prisma } from '@/src/lib/db';

type ActorOk = {
  ok: true;
  uid: string;
  role: string;
  clinicianId: string;
};

type ActorBad = {
  ok: false;
  status: number;
  error: string;
};

export function readConsultationActor(headers: Headers): ActorOk | ActorBad {
  const uid = String(
    headers.get('x-clinician-id') ||
      headers.get('x-uid') ||
      headers.get('x-actor-ref-id') ||
      '',
  ).trim();

  const role = String(headers.get('x-role') || '').trim().toLowerCase();

  if (!uid) {
    return { ok: false, status: 401, error: 'missing_actor_identity' };
  }

  const allowed = ['clinician', 'admin', 'admin_staff', 'owner', 'ops'];
  if (!allowed.includes(role)) {
    return { ok: false, status: 403, error: 'forbidden_actor_role' };
  }

  return {
    ok: true,
    uid,
    role,
    clinicianId: uid,
  };
}

function iso(value: any): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function minor(value: any): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function authorizedMinorFromAppointment(appointment: any): number | null {
  return (
    minor(appointment.totalMinor) ??
    minor(appointment.amountMinor) ??
    minor(appointment.priceCents) ??
    null
  );
}

export function serializeSession(session: any) {
  return {
    id: session.id,
    appointmentId: session.appointmentId,
    encounterId: session.encounterId ?? null,
    caseId: session.caseId,
    clinicianId: session.clinicianId,
    patientId: session.patientId,
    hostUserId: session.hostUserId ?? null,
    visitMode: session.visitMode,
    roomId: session.roomId ?? null,
    state: session.state,
    startedAt: iso(session.startedAt),
    endedAt: iso(session.endedAt),
    outcome: session.outcome ?? null,
    currency: session.currency || 'ZAR',
  };
}

export async function getOrCreateSessionByAppointment(appointmentId: string) {
  const cleanId = String(appointmentId || '').trim();
  if (!cleanId) return null;

  const existing = await (prisma as any).consultationSession.findUnique({
    where: { appointmentId: cleanId },
  });

  if (existing) return existing;

  const appointment = await (prisma as any).appointment.findUnique({
    where: { id: cleanId },
  });

  if (!appointment) return null;

  const amount = authorizedMinorFromAppointment(appointment);
  const paymentStatus = String(appointment.paymentStatus || '').toUpperCase();
  const appointmentStatus = String(appointment.status || '').toLowerCase();

  try {
    return await (prisma as any).consultationSession.create({
      data: {
        appointmentId: appointment.id,
        encounterId: appointment.encounterId || null,
        caseId: appointment.caseId,
        clinicianId: appointment.clinicianId,
        patientId: appointment.subjectPatientId || appointment.patientId,
        hostUserId: appointment.hostUserId || null,
        visitMode: appointment.visitMode || 'TELEVISIT',
        roomId: appointment.roomId || null,
        state: appointmentStatus.includes('cancel') ? 'CANCELLED' : 'READY',
        currency: appointment.currency || 'ZAR',
        amountAuthorizedMinor: amount,
        amountCapturedMinor: paymentStatus === 'PAID' || paymentStatus === 'CAPTURED' ? amount : null,
        metadata: {
          source: 'appointment_auto_created',
          appointmentStatus: appointment.status,
          paymentStatus: appointment.paymentStatus,
          createdFrom: 'consultation-session-by-appointment',
        },
      },
    });
  } catch (err) {
    const afterRace = await (prisma as any).consultationSession.findUnique({
      where: { appointmentId: cleanId },
    });
    if (afterRace) return afterRace;
    throw err;
  }
}

export async function getSessionById(id: string) {
  const cleanId = String(id || '').trim();
  if (!cleanId) return null;

  return (prisma as any).consultationSession.findUnique({
    where: { id: cleanId },
  });
}

export async function checkInSession(id: string) {
  const existing = await getSessionById(id);
  if (!existing) return null;

  const now = new Date();

  return (prisma as any).consultationSession.update({
    where: { id: existing.id },
    data: {
      clinicianCheckedInAt: existing.clinicianCheckedInAt || now,
      state: existing.state === 'ACTIVE' ? 'ACTIVE' : 'CHECKED_IN',
    },
  });
}

export async function startSession(id: string, payload: any) {
  const existing = await getSessionById(id);
  if (!existing) return null;

  const now = new Date();
  const roomId = String(payload?.roomId || existing.roomId || '').trim() || existing.roomId || null;

  return (prisma as any).$transaction(async (tx: any) => {
    const session = await tx.consultationSession.update({
      where: { id: existing.id },
      data: {
        roomId,
        startedAt: existing.startedAt || now,
        state: 'ACTIVE',
      },
    });

    await tx.appointment.updateMany({
      where: { id: session.appointmentId },
      data: {
        roomId,
        startedAt: existing.startedAt || now,
        status: 'in_progress',
        sessionId: session.id,
      },
    });

    if (session.encounterId) {
      await tx.encounter.updateMany({
        where: { id: session.encounterId },
        data: {
          sessionId: session.id,
          consultationStartedAt: existing.startedAt || now,
          visitMode: session.visitMode,
          status: 'in_progress',
        },
      });
    }

    return session;
  });
}

export async function completeSession(id: string, payload: any) {
  const existing = await getSessionById(id);
  if (!existing) return null;

  const now = new Date();
  const encounterStatus = String(payload?.encounterStatus || 'completed').trim() || 'completed';

  return (prisma as any).$transaction(async (tx: any) => {
    const session = await tx.consultationSession.update({
      where: { id: existing.id },
      data: {
        endedAt: existing.endedAt || now,
        state: 'COMPLETED',
      },
    });

    await tx.appointment.updateMany({
      where: { id: session.appointmentId },
      data: {
        completedAt: existing.endedAt || now,
        status: 'completed',
      },
    });

    if (session.encounterId) {
      const encounterData: any = {
        consultationEndedAt: existing.endedAt || now,
        status: encounterStatus,
      };

      if (payload?.summaryPayload && typeof payload.summaryPayload === 'object') {
        encounterData.summaryPayload = payload.summaryPayload;
      }

      await tx.encounter.updateMany({
        where: { id: session.encounterId },
        data: encounterData,
      });
    }

    return session;
  });
}
