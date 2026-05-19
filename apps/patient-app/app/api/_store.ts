// apps/patient-app/app/api/_store.ts

export type AppointmentStatus = 'booked' | 'confirmed' | 'rescheduled' | 'cancelled';

export type Appointment = {
  id: string;
  clinicianId: string;
  startISO: string;
  endISO: string;
  durationMin: number;
  status: AppointmentStatus;
  priceZAR: number;
  currency: 'ZAR';
  patient: { id: string; name: string; email?: string; phone?: string };
  notifications?: { email?: boolean; sms?: boolean };
  createdAt: string;
  updatedAt: string;
};

type Store = {
  appointments: Record<string, Appointment>;
};

const g = globalThis as any;

if (!g.__AMBULANT_PATIENT_APP_TRANSIENT_STORE__) {
  g.__AMBULANT_PATIENT_APP_TRANSIENT_STORE__ = { appointments: {} } as Store;
}

const store: Store = g.__AMBULANT_PATIENT_APP_TRANSIENT_STORE__;

export function genId(prefix = 'apt_') {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';

  for (let i = 0; i < 6; i += 1) {
    s += abc[Math.floor(Math.random() * abc.length)];
  }

  return `${prefix}${s}`;
}

export function getCurrentUser() {
  throw new Error('patient_auth_identity_not_configured_for_transient_store');
}

export function priceForClinician(_clinicianId: string): number {
  throw new Error('clinician_price_lookup_not_configured');
}

export function createAppointment(input: {
  clinicianId: string;
  startISO: string;
  durationMin: number;
  priceZAR?: number;
  patient?: { id: string; name: string; email?: string; phone?: string };
}): Appointment {
  if (!input.clinicianId) {
    throw new Error('clinicianId_required');
  }

  if (!input.startISO) {
    throw new Error('startISO_required');
  }

  if (!input.patient?.id) {
    throw new Error('patient_identity_required');
  }

  if (!Number.isFinite(Number(input.priceZAR))) {
    throw new Error('appointment_price_required');
  }

  const id = genId();
  const start = new Date(input.startISO);

  if (Number.isNaN(start.getTime())) {
    throw new Error('invalid_startISO');
  }

  const durationMin = Number(input.durationMin || 30);
  const end = new Date(start.getTime() + durationMin * 60_000);

  const appt: Appointment = {
    id,
    clinicianId: input.clinicianId,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    durationMin,
    status: 'booked',
    priceZAR: Number(input.priceZAR),
    currency: 'ZAR',
    patient: input.patient,
    notifications: { email: false, sms: false },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.appointments[id] = appt;
  return appt;
}

export function getAppointment(id: string): Appointment | null {
  return store.appointments[id] ?? null;
}

export function listAppointments(): Appointment[] {
  return Object.values(store.appointments).sort(
    (a, b) => new Date(b.startISO).getTime() - new Date(a.startISO).getTime(),
  );
}

export function updateAppointment(
  id: string,
  patch: Partial<Appointment>,
): Appointment | null {
  const cur = store.appointments[id];

  if (!cur) return null;

  const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
  store.appointments[id] = next;

  return next;
}

export async function sendEmail() {
  throw new Error('email_provider_not_configured');
}

export async function sendSMS() {
  throw new Error('sms_provider_not_configured');
}