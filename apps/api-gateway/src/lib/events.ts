// apps/api-gateway/src/lib/events.ts

export type RuntimeEvent = {
  id: string;
  kind: string;
  ts: number;
  orgId?: string | null;
  encounterId?: string | null;
  patientId?: string | null;
  clinicianId?: string | null;
  payload?: any;
  targetPatientId?: string | null;
  targetClinicianId?: string | null;
  targetAdmin?: boolean;
};

export type EmitEventInput = {
  kind: string;
  orgId?: string | null;
  encounterId?: string | null;
  patientId?: string | null;
  clinicianId?: string | null;
  payload?: any;
  targets?: {
    patientId?: string | null;
    clinicianId?: string | null;
    admin?: boolean;
  };
};

export type ReadInboxInput = {
  afterId?: string;
  patientId?: string;
  clinicianId?: string;
  admin?: boolean;
};

const globalEvents = globalThis as unknown as {
  __ambulantRuntimeEvents?: RuntimeEvent[];
  __ambulantRuntimeEventSeq?: number;
};

function eventStore(): RuntimeEvent[] {
  if (!globalEvents.__ambulantRuntimeEvents) {
    globalEvents.__ambulantRuntimeEvents = [];
  }

  return globalEvents.__ambulantRuntimeEvents;
}

function nextEventId() {
  const next = (globalEvents.__ambulantRuntimeEventSeq ?? 0) + 1;
  globalEvents.__ambulantRuntimeEventSeq = next;

  return `evt-${Date.now()}-${next}`;
}

function cleanStr(value: unknown): string | null {
  const s = String(value ?? '').trim();
  return s || null;
}

function normalisePayload(value: unknown) {
  if (value == null) return null;

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

export function emitEvent(input: EmitEventInput): RuntimeEvent {
  const kind = cleanStr(input.kind);

  if (!kind) {
    throw new Error('event_kind_required');
  }

  const event: RuntimeEvent = {
    id: nextEventId(),
    kind,
    ts: Date.now(),
    orgId: cleanStr(input.orgId),
    encounterId: cleanStr(input.encounterId),
    patientId: cleanStr(input.patientId),
    clinicianId: cleanStr(input.clinicianId),
    payload: normalisePayload(input.payload),
    targetPatientId: cleanStr(input.targets?.patientId),
    targetClinicianId: cleanStr(input.targets?.clinicianId),
    targetAdmin: Boolean(input.targets?.admin),
  };

  const store = eventStore();
  store.push(event);

  // Keep memory bounded in long-running local/server processes.
  if (store.length > 1000) {
    store.splice(0, store.length - 1000);
  }

  return event;
}

export function readInbox(input: ReadInboxInput = {}) {
  const store = eventStore();

  let events = store.slice();

  if (input.afterId) {
    const idx = events.findIndex((e) => e.id === input.afterId);

    if (idx >= 0) {
      events = events.slice(idx + 1);
    }
  }

  if (input.patientId) {
    events = events.filter(
      (e) =>
        e.targetPatientId === input.patientId ||
        e.patientId === input.patientId,
    );
  } else if (input.clinicianId) {
    events = events.filter(
      (e) =>
        e.targetClinicianId === input.clinicianId ||
        e.clinicianId === input.clinicianId,
    );
  } else if (input.admin) {
    events = events.filter((e) => e.targetAdmin === true);
  } else {
    events = [];
  }

  events = events.sort((a, b) => a.ts - b.ts).slice(-100);

  return {
    ok: true,
    events,
    lastId: events.length ? events[events.length - 1].id : input.afterId ?? null,
  };
}