// DEV-ONLY in-memory store (survives hot reload via globalThis)
export type Appointment = {
  id: string;
  patientId?: string;
  patientName?: string;
  clinicianId: string;
  clinicianName?: string;
  startsAt: string; // ISO
  endsAt?: string;  // ISO
  roomId?: string;
  status: 'scheduled'|'in_progress'|'completed'|'canceled';
  createdAt: number;
};

type Store = {
  list: Appointment[];
  seq: number;
};

const g = globalThis as any;
if (!g.__APPTS_STORE__) g.__APPTS_STORE__ = { list: [], seq: 0 } as Store;
const store: Store = g.__APPTS_STORE__;

function newId() {
  store.seq += 1;
  const r = Math.random().toString(36).slice(2, 7);
  return `apt_${r}${store.seq}`;
}

export function create(appt: Omit<Appointment,'id'|'status'|'createdAt'> & { status?: Appointment['status'] }) {
  const a: Appointment = {
    id: newId(),
    status: 'scheduled',
    createdAt: Date.now(),
    ...appt,
  };
  store.list.unshift(a);
  return a;
}

export function setStatus(id: string, status: Appointment['status']) {
  const a = store.list.find(x => x.id === id);
  if (a) a.status = status;
  return a || null;
}

export function list(opts?: { clinicianId?: string }) {
  let arr = store.list.slice();
  if (opts?.clinicianId) arr = arr.filter(a => a.clinicianId === opts.clinicianId);
  // Stable order: newest first
  return arr;
}
