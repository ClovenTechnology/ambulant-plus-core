// apps/api-gateway/src/appointmentsStore.ts

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'canceled'
  | 'cancelled'
  | string;

export type Appointment = {
  id: string;
  encounterId?: string;
  sessionId?: string;
  caseId?: string;
  clinicianId: string;
  patientId: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  meta?: Record<string, any>;
};

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

const store = {
  appointments: new Map<string, Appointment>(),
};

let apptSeq = 1;

function nextApptId() {
  const id = `appt-${Date.now()}-${apptSeq}`;
  apptSeq += 1;
  return id;
}

/** Inclusive overlap check using startsAt/endsAt fields on objects */
function overlaps(
  a: { startsAt?: string; endsAt?: string },
  b: { startsAt?: string; endsAt?: string },
) {
  const a0 = new Date(a.startsAt as string).getTime();
  const a1 = new Date(a.endsAt ?? (a.startsAt as string)).getTime();
  const b0 = new Date(b.startsAt as string).getTime();
  const b1 = new Date(b.endsAt ?? (b.startsAt as string)).getTime();

  if (
    !Number.isFinite(a0) ||
    !Number.isFinite(a1) ||
    !Number.isFinite(b0) ||
    !Number.isFinite(b1)
  ) {
    return false;
  }

  return Math.max(a0, b0) < Math.min(a1, b1);
}

export function listAppts(opts?: { clinicianId?: string }) {
  const all = Array.from(store.appointments.values());

  return opts?.clinicianId
    ? all.filter((a) => a.clinicianId === opts.clinicianId)
    : all;
}

/** Creates normalized Appointment and enforces conflict rules. */
export function createAppt(input: CreateInput) {
  const id = nextApptId();

  const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
  const endsAt = input.endsAt
    ? new Date(input.endsAt)
    : new Date(startsAt.getTime() + 30 * 60 * 1000);

  if (Number.isNaN(startsAt.getTime())) {
    const err: any = new Error('invalid_startsAt');
    err.code = 'invalid_startsAt';
    throw err;
  }

  if (Number.isNaN(endsAt.getTime())) {
    const err: any = new Error('invalid_endsAt');
    err.code = 'invalid_endsAt';
    throw err;
  }

  if (endsAt <= startsAt) {
    const err: any = new Error('end_before_start');
    err.code = 'end_before_start';
    throw err;
  }

  const startsAtISO = startsAt.toISOString();
  const endsAtISO = endsAt.toISOString();

  const patientId = input.patientId || 'pt-za-001';
  const clinicianId = input.clinicianId || 'clin-za-001';
  const sessionId = input.sessionId || 'sess-001';
  const encounterId = input.encounterId || 'enc-za-001';
  const caseId = input.caseId || 'case-za-001';

  const existingActive = Array.from(store.appointments.values()).filter(
    (a) => a.status !== 'canceled' && a.status !== 'cancelled',
  );

  const clashClin = existingActive.find(
    (x) =>
      x.clinicianId === clinicianId &&
      overlaps(x, { startsAt: startsAtISO, endsAt: endsAtISO }),
  );

  if (clashClin) {
    const err: any = new Error('clinician_conflict');
    err.code = 'conflict_clinician';
    err.details = { apptId: clashClin.id };
    throw err;
  }

  const clashPat = existingActive.find(
    (x) =>
      x.patientId === patientId &&
      overlaps(x, { startsAt: startsAtISO, endsAt: endsAtISO }),
  );

  if (clashPat) {
    const err: any = new Error('patient_conflict');
    err.code = 'conflict_patient';
    err.details = { apptId: clashPat.id };
    throw err;
  }

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

  const updated: Appointment = {
    ...appt,
    status,
  };

  store.appointments.set(id, updated);

  return updated;
}

export function rescheduleAppt(
  id: string,
  startsAtISO: string,
  endsAtISO: string,
) {
  const appt = store.appointments.get(id);

  if (!appt) return null;

  const startsAt = new Date(startsAtISO);
  const endsAt = new Date(endsAtISO);

  if (Number.isNaN(startsAt.getTime())) {
    const err: any = new Error('invalid_startsAt');
    err.code = 'invalid_startsAt';
    throw err;
  }

  if (Number.isNaN(endsAt.getTime())) {
    const err: any = new Error('invalid_endsAt');
    err.code = 'invalid_endsAt';
    throw err;
  }

  if (endsAt <= startsAt) {
    const err: any = new Error('end_before_start');
    err.code = 'end_before_start';
    throw err;
  }

  const nextStartsAt = startsAt.toISOString();
  const nextEndsAt = endsAt.toISOString();

  const others = Array.from(store.appointments.values()).filter(
    (a) => a.id !== id && a.status !== 'canceled' && a.status !== 'cancelled',
  );

  const conflictPatient = others.find(
    (a) =>
      a.patientId === appt.patientId &&
      overlaps({ startsAt: nextStartsAt, endsAt: nextEndsAt }, a),
  );

  if (conflictPatient) {
    const err: any = new Error('patient_conflict');
    err.code = 'conflict_patient';
    err.details = { apptId: conflictPatient.id };
    throw err;
  }

  const conflictClin = others.find(
    (a) =>
      a.clinicianId === appt.clinicianId &&
      overlaps({ startsAt: nextStartsAt, endsAt: nextEndsAt }, a),
  );

  if (conflictClin) {
    const err: any = new Error('clinician_conflict');
    err.code = 'conflict_clinician';
    err.details = { apptId: conflictClin.id };
    throw err;
  }

  const updated: Appointment = {
    ...appt,
    startsAt: nextStartsAt,
    endsAt: nextEndsAt,
  };

  store.appointments.set(id, updated);

  return updated;
}