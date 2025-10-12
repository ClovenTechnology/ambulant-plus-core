// apps/api-gateway/src/appointmentsStore.ts
import { store, nextApptId, type Appointment } from '@ambulant/shared-runtime/src/store';

type CreateInput = {
  encounterId?: string;
  sessionId?: string;
  caseId?: string;
  clinicianId?: string;
  patientId?: string;
  patientName?: string;
  clinicianName?: string;
  startsAt?: string;
  endsAt?: string;
  roomId?: string;
};

/** Inclusive overlap check using startsAt/endsAt fields on objects */
function overlaps(a: { startsAt?: string; endsAt?: string }, b: { startsAt?: string; endsAt?: string }) {
  const a0 = new Date(a.startsAt as string).getTime();
  const a1 = new Date(a.endsAt   ?? a.startsAt as string).getTime();
  const b0 = new Date(b.startsAt as string).getTime();
  const b1 = new Date(b.endsAt   ?? b.startsAt as string).getTime();
  return Math.max(a0, b0) < Math.min(a1, b1);
}

export function listAppts(opts?: { clinicianId?: string }) {
  const all = Array.from(store.appointments.values());
  return opts?.clinicianId
    ? all.filter(a => a.clinicianId === opts.clinicianId)
    : all;
}

/** Creates normalized Appointment and enforces conflict rules (clinician/patient). */
export function createAppt(input: CreateInput) {
  const id = nextApptId();

  const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
  const endsAt   = input.endsAt   ? new Date(input.endsAt)   : new Date(startsAt.getTime() + 30 * 60 * 1000);

  const startsAtISO = startsAt.toISOString();
  const endsAtISO   = endsAt.toISOString();

  const patientId   = input.patientId   || 'pt-za-001';
  const clinicianId = input.clinicianId || 'clin-za-001';
  const sessionId   = input.sessionId   || 'sess-001';
  const encounterId = input.encounterId || 'enc-za-001';
  const caseId      = input.caseId      || 'case-za-001';

  // Check against all non-canceled appointments
  const existingActive = Array.from(store.appointments.values()).filter(a => a.status !== 'canceled');

  // Clinician availability
  const clashClin = existingActive.find(x =>
    x.clinicianId === clinicianId &&
    overlaps(x, { startsAt: startsAtISO, endsAt: endsAtISO })
  );
  if (clashClin) {
    const err: any = new Error('clinician_conflict');
    err.code = 'conflict_clinician';
    err.details = { apptId: clashClin.id };
    throw err;
  }

  // Patient availability
  const clashPat = existingActive.find(x =>
    x.patientId === patientId &&
    overlaps(x, { startsAt: startsAtISO, endsAt: endsAtISO })
  );
  if (clashPat) {
    const err: any = new Error('patient_conflict');
    err.code = 'conflict_patient';
    err.details = { apptId: clashPat.id };
    throw err;
  }

  // OK — create and store
  const appt: Appointment = {
    id,
    encounterId,
    sessionId,
    caseId,
    clinicianId,
    patientId,
    startsAt: startsAtISO,
    endsAt: endsAtISO,
    status: 'scheduled',
    meta: {
      roomId: input.roomId,
      patientName: input.patientName || patientId,
      clinicianName: input.clinicianName || clinicianId,
    },
  };

  store.appointments.set(id, appt);
  return appt;
}

export function updateApptStatus(id: string, status: Appointment['status']) {
  const appt = store.appointments.get(id);
  if (!appt) return null;
  appt.status = status;
  store.appointments.set(id, appt);
  return appt;
}

export function rescheduleAppt(id: string, startsAtISO: string, endsAtISO: string) {
  const appt = store.appointments.get(id);
  if (!appt) return null;

  const others = Array.from(store.appointments.values()).filter(a => a.id !== id && a.status !== 'canceled');

  // Patient conflict
  const conflictPatient = others.find(a =>
    a.patientId === appt.patientId &&
    overlaps({ startsAt: startsAtISO, endsAt: endsAtISO }, a)
  );
  if (conflictPatient) {
    const err: any = new Error('patient_conflict');
    err.code = 'conflict_patient';
    err.details = { apptId: conflictPatient.id };
    throw err;
  }

  // Clinician conflict
  const conflictClin = others.find(a =>
    a.clinicianId === appt.clinicianId &&
    overlaps({ startsAt: startsAtISO, endsAt: endsAtISO }, a)
  );
  if (conflictClin) {
    const err: any = new Error('clinician_conflict');
    err.code = 'conflict_clinician';
    err.details = { apptId: conflictClin.id };
    throw err;
  }

  appt.startsAt = new Date(startsAtISO).toISOString();
  appt.endsAt   = new Date(endsAtISO).toISOString();
  store.appointments.set(id, appt);
  return appt;
}
