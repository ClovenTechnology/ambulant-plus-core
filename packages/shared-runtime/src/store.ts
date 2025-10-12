// packages/shared-runtime/src/store.ts
// Minimal in-memory shared runtime for demos/dev.
// Single source of truth used by patient, clinician, admin.

export type Id = string;
export type ISO = string;

export type Encounter = {
  id: Id;             // enc-za-***
  caseId: Id;         // case-za-***
  patientId: Id;      // pt-za-***
  clinicianId?: Id;
  createdAt: ISO;
  updatedAt: ISO;
  status: 'open' | 'closed';
};

export type Appointment = {
  id: Id;
  encounterId: Id;
  sessionId: Id;          // sess-***
  caseId: Id;
  clinicianId: Id;
  patientId: Id;
  startsAt: ISO;
  endsAt: ISO;
  status: 'scheduled' | 'cancelled' | 'completed' | 'no_show';
  meta?: {
    patientName?: string;
    clinicianName?: string;
    roomId?: string;
    [k: string]: any;
  };
};

export type ErxOrder = {
  id: Id;                 // ERX-1001
  kind: 'pharmacy';
  encounterId: Id;
  sessionId: Id;
  caseId: Id;
  eRx: { drug: string; sig: string };
  createdAt: ISO;
};

export type LabOrder = {
  id: Id;                 // LAB-2001
  kind: 'lab';
  encounterId: Id;
  sessionId: Id;
  caseId: Id;
  panel: string;
  createdAt: ISO;
};

export type Payment = {
  id: Id;                 // pay-***
  encounterId: Id;
  caseId: Id;
  amountCents: number;
  currency: 'ZAR';
  status: 'initiated' | 'captured' | 'refunded' | 'failed';
  createdAt: ISO;
  updatedAt: ISO;
  meta?: Record<string, any>;
};

export type Televisit = {
  id: Id;                 // demo-visit
  title?: string;
  startsAt: number;       // ms epoch
  durationMin: number;
  joinOpenLeadSec: number;
  joinCloseLagSec: number;
};

export type Ticket = {
  token: string;
  issuedAt: number;
  expiresAt: number;
  visitId: Id;
  userId: Id;
};

function nowISO(): ISO {
  return new Date().toISOString();
}

export const store = {
  // core
  encounters: new Map<Id, Encounter>(),
  appointments: new Map<Id, Appointment>(),

  // logistics
  erxOrders: new Map<Id, ErxOrder>(),
  labOrders: new Map<Id, LabOrder>(),

  // payments
  payments: new Map<Id, Payment>(),

  // televisit
  televisits: new Map<Id, Televisit>(),
  tickets: new Map<string, Ticket>(), // key = `${visitId}:${userId}`
};

// --- Seeds (ZA context) ---
(function seed() {
  if (!store.televisits.has('demo-visit')) {
    const t0 = Date.now();
    store.televisits.set('demo-visit', {
      id: 'demo-visit',
      title: 'Televisit: Demo',
      startsAt: t0 + 5 * 60 * 1000, // 5 minutes from now
      durationMin: 15,
      joinOpenLeadSec: 15 * 60,
      joinCloseLagSec: 15 * 60,
    });
  }

  if (!store.encounters.has('enc-za-001')) {
    const e: Encounter = {
      id: 'enc-za-001',
      caseId: 'case-za-001',
      patientId: 'pt-za-001',
      clinicianId: 'clin-za-001',
      createdAt: nowISO(),
      updatedAt: nowISO(),
      status: 'open',
    };
    store.encounters.set(e.id, e);
  }
})();

// --- Helpers used by app routes ---
export function getJoinWindow(v: Televisit) {
  const openAt = v.startsAt - v.joinOpenLeadSec * 1000;
  const closeAt = v.startsAt + v.durationMin * 60_000 + v.joinCloseLagSec * 1000;
  return { openAt, closeAt };
}

export function upsertTicket(visitId: Id, userId: Id, ttlSec: number) {
  const key = `${visitId}:${userId}`;
  const now = Date.now();
  const prev = store.tickets.get(key);
  if (prev && prev.expiresAt > now + 10_000) return prev;
  const token = `TV.${Math.random().toString(36).slice(2)}.${Math.random().toString(36).slice(2).toUpperCase()}`;
  const issuedAt = now;
  const expiresAt = now + ttlSec * 1000;
  const t: Ticket = { token, issuedAt, expiresAt, visitId, userId };
  store.tickets.set(key, t);
  return t;
}

export function getTicket(visitId: Id, userId: Id) {
  const t = store.tickets.get(`${visitId}:${userId}`);
  if (!t) return null;
  if (t.expiresAt <= Date.now()) {
    store.tickets.delete(`${visitId}:${userId}`);
    return null;
  }
  return t;
}

// ID helpers (simple demo sequences)
let erxSeq = 1001, labSeq = 2001, paySeq = 3001, apptSeq = 4001;
export function nextErxId() { return `ERX-${erxSeq++}`; }
export function nextLabId() { return `LAB-${labSeq++}`; }
export function nextPayId() { return `pay-${paySeq++}`; }
export function nextApptId() { return `appt-${apptSeq++}`; }

/* =======================================================================================
 *  New: Events bus (very small, in-memory)
 *  - Primary API (RuntimeEvent / emitEvent / readInbox)
 *  - Back-compat shim for legacy AppEvent / getInbox / events
 * =======================================================================================
 */

// ---- Events bus (very small, in-memory) ----
export type RuntimeEvent = {
  id: string;
  ts: number;
  kind:
    | 'appointment_created'
    | 'appointment_cancelled'
    | 'appointment_rescheduled'
    | 'order_created'
    | 'payment_captured'
    | 'payment_refunded';
  encounterId?: Id;
  patientId?: Id;
  clinicianId?: Id;
  payload?: Record<string, any>;
  targets?: { patientId?: Id; clinicianId?: Id; admin?: boolean };
};

const _events: RuntimeEvent[] = [];
let _evtSeq = 1;

export function emitEvent(e: Omit<RuntimeEvent, 'id' | 'ts'>): RuntimeEvent {
  const evt: RuntimeEvent = { id: `evt-${_evtSeq++}`, ts: Date.now(), ...e };
  _events.push(evt);
  // simple cap so memory doesn’t grow forever (keep last 2k)
  if (_events.length > 2000) _events.splice(0, _events.length - 2000);

  // --- Back-compat mirror for legacy 'events' array (see below)
  const legacy: AppEvent = {
    id: evt.id,
    at: new Date(evt.ts).toISOString(),
    // keep only the three legacy kinds; others still flow but carry through as-is
    kind:
      evt.kind === 'appointment_created' ||
      evt.kind === 'appointment_cancelled' ||
      evt.kind === 'appointment_rescheduled'
        ? evt.kind
        : 'appointment_created',
    encounterId: evt.encounterId,
    patientId: evt.patientId,
    clinicianId: evt.clinicianId,
    payload: evt.payload,
    targets: evt.targets,
  };
  _legacyEvents.push(legacy);
  if (_legacyEvents.length > 500) _legacyEvents.splice(0, _legacyEvents.length - 500);

  return evt;
}

export function readInbox(opts: {
  afterId?: string;
  patientId?: Id;
  clinicianId?: Id;
  admin?: boolean;
}): { events: RuntimeEvent[] } {
  let startIdx = 0;
  if (opts.afterId) {
    const i = _events.findIndex((x) => x.id === opts.afterId);
    if (i >= 0) startIdx = i + 1;
  }
  const slice = _events.slice(startIdx);

  const filtered = slice.filter((ev) => {
    // admin sees admin-tagged events
    if (opts.admin) return !!ev.targets?.admin;
    // clinician sees those targeted at them
    if (opts.clinicianId) return ev.targets?.clinicianId === opts.clinicianId;
    // patient sees those targeted at them
    if (opts.patientId) return ev.targets?.patientId === opts.patientId;
    return false;
  });

  return { events: filtered };
}

/* -----------------------------
 * Legacy compatibility shim
 * -----------------------------
 * Some existing callers may import AppEvent APIs. Keep them working by
 * mirroring to a legacy array and mapping read operations.
 */

export type AppEvent = {
  id: Id;
  at: ISO; // ISO mirror of ts
  kind: 'appointment_created' | 'appointment_cancelled' | 'appointment_rescheduled';
  encounterId?: Id;
  patientId?: Id;
  clinicianId?: Id;
  payload?: Record<string, any>;
  targets?: { patientId?: Id; clinicianId?: Id; admin?: boolean };
};

// legacy in-memory mirror used only for back-compat exports
const _legacyEvents: AppEvent[] = [];

// Back-compat: expose a readonly view of legacy events (avoid direct mutation)
export const events: AppEvent[] = _legacyEvents;

// Back-compat: getInbox -> map from RuntimeEvent log
export function getInbox(opts: { patientId?: Id; clinicianId?: Id; admin?: boolean; afterId?: Id }) {
  const { events: current } = readInbox({
    afterId: opts.afterId,
    patientId: opts.patientId,
    clinicianId: opts.clinicianId,
    admin: opts.admin,
  });
  // Only legacy kinds are surfaced here
  const legacyKinds: AppEvent['kind'][] = [
    'appointment_created',
    'appointment_cancelled',
    'appointment_rescheduled',
  ];
  return current
    .filter((ev) => legacyKinds.includes(ev.kind as AppEvent['kind']))
    .map<AppEvent>((ev) => ({
      id: ev.id,
      at: new Date(ev.ts).toISOString(),
      kind: ev.kind as AppEvent['kind'],
      encounterId: ev.encounterId,
      patientId: ev.patientId,
      clinicianId: ev.clinicianId,
      payload: ev.payload,
      targets: ev.targets,
    }));
}
