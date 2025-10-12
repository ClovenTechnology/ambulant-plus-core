// apps/patient-app/app/api/_store.ts
import { CLINICIANS } from '@/mock/clinicians';

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

const g = global as any;
if (!g.__AMBULANT_STORE__) {
  g.__AMBULANT_STORE__ = { appointments: {} } as Store;
}
const store: Store = g.__AMBULANT_STORE__;

export function genId(prefix = 'apt_') {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return `${prefix}${s}`;
}

export function getCurrentUser() {
  // Demo user â€” replace with real auth later
  return {
    id: 'u_demo',
    name: 'Ambulant Patient',
    email: 'patient@example.com',
    phone: '+27 60 000 0000',
  };
}

export function priceForClinician(clinicianId: string): number {
  const c = CLINICIANS.find(x => x.id === clinicianId);
  // fallback sensible demo default
  return c?.priceZAR ?? 850;
}

export function createAppointment(input: {
  clinicianId: string;
  startISO: string;
  durationMin: number;
  priceZAR?: number;
}): Appointment {
  const id = genId();
  const start = new Date(input.startISO);
  const end = new Date(start.getTime() + (input.durationMin || 30) * 60_000);
  const patient = getCurrentUser();
  const price = Number.isFinite(input.priceZAR as number)
    ? (input.priceZAR as number)
    : priceForClinician(input.clinicianId);

  const appt: Appointment = {
    id,
    clinicianId: input.clinicianId,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    durationMin: input.durationMin || 30,
    status: 'booked',
    priceZAR: price,
    currency: 'ZAR',
    patient,
    notifications: { email: true, sms: true },
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
    (a, b) => new Date(b.startISO).getTime() - new Date(a.startISO).getTime()
  );
}

export function updateAppointment(id: string, patch: Partial<Appointment>): Appointment | null {
  const cur = store.appointments[id];
  if (!cur) return null;
  const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
  store.appointments[id] = next;
  return next;
}

// ---- demo "notifications" ----
export async function sendEmail(to: string, subject: string, text: string) {
  console.log('[demo:email]', { to, subject, text });
}
export async function sendSMS(to: string, text: string) {
  console.log('[demo:sms]', { to, text });
}
