// apps/api-gateway/app/api/televisit/presence/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PresenceRole = 'patient' | 'clinician';
type PresenceSurface = 'lobby' | 'room';

type PresenceEntry = {
  contextKey: string;
  role: PresenceRole;
  surface: PresenceSurface;
  participantId: string;
  displayName: string;
  roomId: string;
  appointmentId: string;
  visitId: string;
  patientId: string;
  clinicianId: string;
  lastSeenAt: string;
  lastSeenMs: number;
  expiresAtMs: number;
};

type PresenceStore = Map<string, PresenceEntry>;

type PresenceSummary = {
  online: boolean;
  count: number;
  lastSeenAt: string | null;
  displayName: string | null;
  participantId: string | null;
};

const DEFAULT_TTL_MS = 45_000;
const MAX_STORE_SIZE = 2_000;

const configuredTtl = Number.parseInt(process.env.TELEVISIT_PRESENCE_TTL_MS || '', 10);
const PRESENCE_TTL_MS = Number.isFinite(configuredTtl) && configuredTtl > 5_000 ? configuredTtl : DEFAULT_TTL_MS;

const globalForPresence = globalThis as unknown as {
  __ambulantTelevisitPresence?: PresenceStore;
};

const presenceStore: PresenceStore =
  globalForPresence.__ambulantTelevisitPresence || new Map<string, PresenceEntry>();

globalForPresence.__ambulantTelevisitPresence = presenceStore;

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers':
      'content-type,authorization,cookie,x-uid,x-role,x-org-id,x-ambulant-identity,x-request-id',
    'cache-control': 'no-store',
  };
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function normaliseRole(value: unknown): PresenceRole | null {
  const role = clean(value, 40).toLowerCase();

  if (role === 'patient') return 'patient';
  if (role === 'clinician' || role === 'doctor' || role === 'provider') return 'clinician';

  return null;
}

function normaliseSurface(value: unknown): PresenceSurface {
  const surface = clean(value, 40).toLowerCase();

  return surface === 'room' || surface === 'televisit' || surface === 'sfu' ? 'room' : 'lobby';
}

function contextKeyFrom(input: {
  appointmentId?: unknown;
  visitId?: unknown;
  roomId?: unknown;
}) {
  const appointmentId = clean(input.appointmentId, 160);
  const visitId = clean(input.visitId, 160);
  const roomId = clean(input.roomId, 160);

  if (appointmentId) return 'appointment:' + appointmentId;
  if (visitId) return 'visit:' + visitId;
  if (roomId) return 'room:' + roomId;

  return '';
}

function entryKey(entry: Pick<PresenceEntry, 'contextKey' | 'role' | 'surface' | 'participantId'>) {
  return [entry.contextKey, entry.role, entry.surface, entry.participantId].join(':');
}

function prunePresenceStore(now = Date.now()) {
  for (const [key, entry] of presenceStore.entries()) {
    if (entry.expiresAtMs <= now) presenceStore.delete(key);
  }

  if (presenceStore.size <= MAX_STORE_SIZE) return;

  const oldest = [...presenceStore.entries()].sort((a, b) => a[1].lastSeenMs - b[1].lastSeenMs);
  const overflow = presenceStore.size - MAX_STORE_SIZE;

  for (const [key] of oldest.slice(0, overflow)) {
    presenceStore.delete(key);
  }
}

function summarise(contextKey: string, role: PresenceRole, surface: PresenceSurface, now = Date.now()): PresenceSummary {
  const entries = [...presenceStore.values()]
    .filter((entry) => {
      return (
        entry.contextKey === contextKey &&
        entry.role === role &&
        entry.surface === surface &&
        entry.expiresAtMs > now
      );
    })
    .sort((a, b) => b.lastSeenMs - a.lastSeenMs);

  const latest = entries[0];

  return {
    online: entries.length > 0,
    count: entries.length,
    lastSeenAt: latest?.lastSeenAt || null,
    displayName: latest?.displayName || null,
    participantId: latest?.participantId || null,
  };
}

function snapshot(context: {
  contextKey: string;
  roomId?: unknown;
  appointmentId?: unknown;
  visitId?: unknown;
}) {
  const now = Date.now();

  prunePresenceStore(now);

  return {
    ok: true,
    now,
    ttlMs: PRESENCE_TTL_MS,
    context: {
      key: context.contextKey,
      roomId: clean(context.roomId, 160) || null,
      appointmentId: clean(context.appointmentId, 160) || null,
      visitId: clean(context.visitId, 160) || null,
    },
    patient: {
      lobby: summarise(context.contextKey, 'patient', 'lobby', now),
      room: summarise(context.contextKey, 'patient', 'room', now),
    },
    clinician: {
      lobby: summarise(context.contextKey, 'clinician', 'lobby', now),
      room: summarise(context.contextKey, 'clinician', 'room', now),
    },
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const contextKey = contextKeyFrom({
    appointmentId: url.searchParams.get('appointmentId'),
    visitId: url.searchParams.get('visitId'),
    roomId: url.searchParams.get('roomId') || url.searchParams.get('roomName'),
  });

  if (!contextKey) {
    return NextResponse.json(
      { ok: false, error: 'presence_context_required' },
      { status: 400, headers: corsHeaders() },
    );
  }

  return NextResponse.json(
    snapshot({
      contextKey,
      roomId: url.searchParams.get('roomId') || url.searchParams.get('roomName'),
      appointmentId: url.searchParams.get('appointmentId'),
      visitId: url.searchParams.get('visitId'),
    }),
    { headers: corsHeaders() },
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const role = normaliseRole(body.role || body.participantRole || req.headers.get('x-role'));
    const surface = normaliseSurface(body.surface || body.location || body.state);

    const roomId = clean(body.roomId || body.roomName, 160);
    const appointmentId = clean(body.appointmentId, 160);
    const visitId = clean(body.visitId || body.televisitId, 160);
    const contextKey = contextKeyFrom({ appointmentId, visitId, roomId });

    if (!contextKey) {
      return NextResponse.json(
        { ok: false, error: 'presence_context_required' },
        { status: 400, headers: corsHeaders() },
      );
    }

    if (!role) {
      return NextResponse.json(
        { ok: false, error: 'presence_role_required' },
        { status: 400, headers: corsHeaders() },
      );
    }

    const patientId = clean(body.patientId || body.subjectPatientId, 160);
    const clinicianId = clean(body.clinicianId, 160);

    const participantId =
      clean(body.participantId || body.partyId, 180) ||
      (role === 'patient' ? patientId : clinicianId) ||
      role;

    const displayName =
      clean(body.displayName || body.name || (role === 'patient' ? body.patientName : body.clinicianName), 180) ||
      (role === 'patient' ? 'Patient' : 'Clinician');

    const now = Date.now();
    const entry: PresenceEntry = {
      contextKey,
      role,
      surface,
      participantId,
      displayName,
      roomId,
      appointmentId,
      visitId,
      patientId,
      clinicianId,
      lastSeenAt: new Date(now).toISOString(),
      lastSeenMs: now,
      expiresAtMs: now + PRESENCE_TTL_MS,
    };

    presenceStore.set(entryKey(entry), entry);
    prunePresenceStore(now);

    return NextResponse.json(
      {
        ...snapshot({ contextKey, roomId, appointmentId, visitId }),
        self: {
          role,
          surface,
          participantId,
          displayName,
          lastSeenAt: entry.lastSeenAt,
        },
      },
      { headers: corsHeaders() },
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: 'presence_update_failed',
        message: String(err?.message || err || 'Unknown error'),
      },
      { status: 500, headers: corsHeaders() },
    );
  }
}
