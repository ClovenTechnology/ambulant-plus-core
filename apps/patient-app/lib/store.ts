// apps/patient-app/lib/store.ts
import crypto from 'crypto';

export type Televisit = {
  id: string;
  title: string;
  startAt: number; // ms epoch
  endAt: number;   // ms epoch
};

export type Ticket = {
  token: string;
  visitId: string;
  userId: string;
  issuedAt: number;   // ms epoch
  expiresAt: number;  // ms epoch
};

export type Encounter = {
  id: string;
  case: string;
  startedAt: number;
  status: 'Open' | 'Closed' | 'In Review';
  summary: string;
  patientName: string;
  vitals?: Array<{ t: number; hr: number; spo2: number; temp: number }>;
};

export type UserSettings = {
  userId: string;
  contactEmail: string;
  notifications: boolean;
  theme: 'light' | 'dark' | 'system';
  shareData: boolean;
};

type Store = {
  televisits: Map<string, Televisit>;
  tickets: Map<string, Ticket>; // key: `${visitId}:${userId}`
  encounters: Map<string, Encounter>;
  settings: Map<string, UserSettings>;
};

declare global {
  // eslint-disable-next-line no-var
  var __AMBULANT_STORE__: Store | undefined;
}

function seed(): Store {
  const s: Store = {
    televisits: new Map(),
    tickets: new Map(),
    encounters: new Map(),
    settings: new Map(),
  };

  // Seed a demo televisit scheduled soon for easy testing
  const now = Date.now();
  const startAt = now + 5 * 60_000; // in 5 minutes
  const endAt = startAt + 20 * 60_000; // +20 minutes
  s.televisits.set('demo-visit', {
    id: 'demo-visit',
    title: 'Follow-up: Hypertension (Tele-visit)',
    startAt,
    endAt,
  });

  // Seed encounters
  for (let i = 1; i <= 8; i++) {
    const id = `enc-${i.toString().padStart(3, '0')}`;
    s.encounters.set(id, {
      id,
      case: i % 2 ? 'Hypertension Management' : 'Diabetes Review',
      startedAt: now - i * 86_400_000,
      status: (['Open', 'Closed', 'In Review'] as const)[i % 3],
      summary:
        i % 2
          ? 'Routine BP monitoring and medication titration.'
          : 'Glycemic control assessment and lifestyle counseling.',
      patientName: i % 2 ? 'John Dlamini' : 'Amahle Nkosi',
      vitals: Array.from({ length: 20 }).map((_, k) => ({
        t: now - k * 3_600_000,
        hr: 65 + ((i * k) % 15),
        spo2: 95 + (k % 3),
        temp: 36 + ((k % 5) * 0.1),
      })),
    });
  }

  return s;
}

export const store: Store = global.__AMBULANT_STORE__ ?? seed();
if (!global.__AMBULANT_STORE__) global.__AMBULANT_STORE__ = store;

// Helpers
export function getJoinWindow(visit: Televisit) {
  const startOffsetMin = parseInt(process.env.JOIN_WINDOW_START_MIN || '-10', 10);
  const endOffsetMin = parseInt(process.env.JOIN_WINDOW_END_MIN || '15', 10);
  const openAt = visit.startAt + startOffsetMin * 60_000;
  const closeAt = visit.endAt + endOffsetMin * 60_000;
  return { openAt, closeAt };
}

export function upsertTicket(visitId: string, userId: string, ttlSec?: number) {
  const key = `${visitId}:${userId}`;
  const existing = store.tickets.get(key);
  const now = Date.now();
  const ttl = (ttlSec ?? parseInt(process.env.JOIN_TOKEN_TTL_SEC || '90', 10)) * 1000;

  if (existing && existing.expiresAt > now) {
    return existing;
  }

  const token = crypto.randomBytes(24).toString('base64url');
  const ticket: Ticket = {
    token,
    visitId,
    userId,
    issuedAt: now,
    expiresAt: now + ttl,
  };
  store.tickets.set(key, ticket);
  return ticket;
}

export function getTicket(visitId: string, userId: string) {
  const key = `${visitId}:${userId}`;
  const t = store.tickets.get(key);
  if (t && t.expiresAt > Date.now()) return t;
  return null;
}
