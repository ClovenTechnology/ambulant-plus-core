// apps/clinician-app/app/api/_store.ts
export type AppointmentStatus = 'booked' | 'confirmed' | 'cancelled';

export interface PatientProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface Appointment {
  id: string;
  clinicianId: string;
  startISO: string;
  endISO: string;
  durationMin: number;
  priceZAR: number;
  status: AppointmentStatus;
  patient: PatientProfile;
  createdAt: string;
  updatedAt: string;
}

const APPTS = new Map<string, Appointment>();

function rid(prefix = 'apt'): string {
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${r}`;
}

export function createAppointment(input: {
  clinicianId: string;
  startISO: string;
  durationMin?: number;
  priceZAR?: number;
  patient?: Partial<PatientProfile>;
}): Appointment {
  const durationMin = input.durationMin ?? 30;
  const start = new Date(input.startISO);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + durationMin);

  const now = new Date().toISOString();
  const appt: Appointment = {
    id: rid('apt'),
    clinicianId: input.clinicianId,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    durationMin,
    priceZAR: input.priceZAR ?? 850,
    status: 'booked',
    patient: {
      id: input.patient?.id ?? 'pat_demo',
      name: input.patient?.name ?? 'Demo Patient',
      email: input.patient?.email ?? 'demo@patient.local',
      phone: input.patient?.phone ?? '+0000000000',
    },
    createdAt: now,
    updatedAt: now,
  };

  APPTS.set(appt.id, appt);
  return appt;
}

export function listAppointments(): Appointment[] {
  return Array.from(APPTS.values()).sort((a,b)=>a.startISO.localeCompare(b.startISO));
}

export function getAppointment(id: string): Appointment | undefined {
  return APPTS.get(id);
}

export function updateAppointment(id: string, patch: Partial<Appointment>): Appointment | undefined {
  const cur = APPTS.get(id);
  if (!cur) return undefined;
  const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
  APPTS.set(id, next);
  return next;
}

export function confirmAppointment(id: string): Appointment | undefined {
  return updateAppointment(id, { status: 'confirmed' });
}

export function rescheduleAppointment(id: string, newStartISO: string): Appointment | undefined {
  const cur = APPTS.get(id);
  if (!cur) return undefined;
  const start = new Date(newStartISO);
  const end = new Date(start);
  end.setMinutes(start.getMinutes() + (cur.durationMin || 30));
  return updateAppointment(id, { startISO: start.toISOString(), endISO: end.toISOString() });
}
