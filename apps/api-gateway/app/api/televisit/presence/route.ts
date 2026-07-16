// apps/api-gateway/app/api/televisit/presence/route.ts
import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/src/lib/db';
import {
  readIdentity,
  requireTrustedIdentityInProduction,
  type Who,
} from '@/src/lib/identity';
import {
  getAppointmentParticipantsForAdmission,
  resolveParticipantAdmission,
  type ParticipantAdmission,
  type PersistedAppointmentParticipant,
} from '@/src/lib/televisit/appointment-admission';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PresenceSurface = 'lobby' | 'room';

type PresenceContext = {
  appointmentId: string;
  visitId: string | null;
  roomId: string;
  participants: PersistedAppointmentParticipant[];
};

type PresenceSummary = {
  online: boolean;
  count: number;
  lastSeenAt: string | null;
  displayName: string | null;
  participantId: string | null;
};

const DEFAULT_TTL_MS = 45_000;
const MAX_TTL_MS = 5 * 60_000;

const configuredTtl = Number.parseInt(
  process.env.TELEVISIT_PRESENCE_TTL_MS || '',
  10,
);

const PRESENCE_TTL_MS =
  Number.isFinite(configuredTtl) && configuredTtl >= 10_000
    ? Math.min(configuredTtl, MAX_TTL_MS)
    : DEFAULT_TTL_MS;

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers':
      'content-type,authorization,cookie,x-uid,x-role,x-org-id,x-ambulant-identity,x-actor-ref-id,x-patient-id,x-request-id',
    'cache-control': 'no-store',
  };
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function isAdminLike(role: string) {
  return role === 'admin' || role === 'admin_staff' || role === 'system';
}

function normaliseSurface(value: unknown): PresenceSurface {
  const surface = clean(value, 40).toLowerCase();

  return surface === 'room' ||
    surface === 'televisit' ||
    surface === 'sfu'
    ? 'room'
    : 'lobby';
}

function authenticatedWho(req: NextRequest): Who {
  const who = readIdentity(req.headers);

  requireTrustedIdentityInProduction(req.headers, who);

  if (!who.uid || who.role === 'anonymous') {
    throw new Error('unauthorized');
  }

  return who;
}

function actorCanUseParticipant(args: {
  actorRole: string;
  actorUid: string;
  actorRefId?: string | null;
  participant: PersistedAppointmentParticipant;
}) {
  const {
    actorRole,
    actorUid,
    actorRefId,
    participant,
  } = args;

  if (isAdminLike(actorRole)) return true;

  const partyId = clean(participant.partyId, 240);
  const patientId = clean(participant.patientId, 240);
  const clinicianId = clean(participant.clinicianId, 240);
  const hostUserId = clean(participant.hostUserId, 240);

  if (actorRole === 'clinician') {
    return (
      clinicianId === actorUid ||
      partyId === actorUid ||
      partyId === 'clin-' + actorUid
    );
  }

  if (actorRole === 'patient') {
    return (
      patientId === actorUid ||
      patientId === clean(actorRefId, 240) ||
      hostUserId === actorUid ||
      partyId === actorUid ||
      partyId === clean(actorRefId, 240) ||
      partyId === 'pat-' + actorUid ||
      (actorRefId
        ? partyId === 'pat-' + clean(actorRefId, 240)
        : false)
    );
  }

  return false;
}

function fallbackDisplayName(
  participant: PersistedAppointmentParticipant,
) {
  return (
    clean(participant.name, 180) ||
    clean(participant.specialty, 180) ||
    clean(participant.email, 180) ||
    clean(participant.phone, 180) ||
    clean(participant.patientId, 180) ||
    clean(participant.clinicianId, 180) ||
    clean(participant.partyId, 180) ||
    'Participant'
  );
}

async function resolvePresenceContext(input: {
  appointmentId?: unknown;
  visitId?: unknown;
  roomId?: unknown;
}): Promise<PresenceContext> {
  const requestedAppointmentId = clean(
    input.appointmentId,
    160,
  );

  const requestedVisitId = clean(
    input.visitId,
    160,
  );

  const requestedRoomId = clean(
    input.roomId,
    160,
  );

  if (
    !requestedAppointmentId &&
    !requestedVisitId &&
    !requestedRoomId
  ) {
    throw new Error('presence_context_required');
  }

  let visit:
    | {
        id: string;
        appointmentId: string | null;
        roomId: string;
      }
    | null = null;

  if (requestedVisitId) {
    visit = await prisma.televisit.findUnique({
      where: {
        id: requestedVisitId,
      },
      select: {
        id: true,
        appointmentId: true,
        roomId: true,
      },
    });

    if (!visit) {
      throw new Error('televisit_not_found');
    }
  } else if (requestedRoomId) {
    visit = await prisma.televisit.findUnique({
      where: {
        roomId: requestedRoomId,
      },
      select: {
        id: true,
        appointmentId: true,
        roomId: true,
      },
    });
  }

  if (
    visit &&
    requestedRoomId &&
    visit.roomId !== requestedRoomId
  ) {
    throw new Error('presence_context_mismatch');
  }

  let appointmentId =
    requestedAppointmentId ||
    clean(visit?.appointmentId, 160);

  if (!appointmentId && requestedRoomId) {
    const appointmentByRoom =
      await prisma.appointment.findFirst({
        where: {
          roomId: requestedRoomId,
        },
        orderBy: {
          startsAt: 'desc',
        },
        select: {
          id: true,
        },
      });

    appointmentId = clean(
      appointmentByRoom?.id,
      160,
    );
  }

  if (!appointmentId) {
    throw new Error('appointment_context_required');
  }

  if (!visit) {
    visit = await prisma.televisit.findFirst({
      where: {
        appointmentId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        appointmentId: true,
        roomId: true,
      },
    });
  }

  if (
    visit?.appointmentId &&
    visit.appointmentId !== appointmentId
  ) {
    throw new Error('presence_context_mismatch');
  }

  const {
    appointment,
    participants,
  } =
    await getAppointmentParticipantsForAdmission(
      appointmentId,
    );

  const roomId =
    clean(visit?.roomId, 160) ||
    clean(appointment.roomId, 160) ||
    requestedRoomId;

  if (!roomId) {
    throw new Error('room_context_required');
  }

  if (
    requestedRoomId &&
    roomId !== requestedRoomId
  ) {
    throw new Error('presence_context_mismatch');
  }

  return {
    appointmentId,
    visitId:
      clean(visit?.id, 160) ||
      requestedVisitId ||
      null,
    roomId,
    participants,
  };
}

async function resolveCallerAdmission(args: {
  context: PresenceContext;
  who: Who;
  requestedParticipantId?: unknown;
  requestedRole?: unknown;
}): Promise<ParticipantAdmission | null> {
  const {
    context,
    who,
  } = args;

  const requestedParticipantId = clean(
    args.requestedParticipantId,
    240,
  );

  const requestedRole = clean(
    args.requestedRole,
    80,
  );

  if (isAdminLike(who.role)) {
    if (!requestedParticipantId) {
      return null;
    }

    return resolveParticipantAdmission({
      appointmentId: context.appointmentId,
      participantId: requestedParticipantId,
      role: requestedRole || null,
    });
  }

  const actorUid = clean(who.uid, 240);

  if (!actorUid) {
    throw new Error('unauthorized');
  }

  let candidates =
    context.participants.filter((participant) =>
      actorCanUseParticipant({
        actorRole: who.role,
        actorUid,
        actorRefId: who.actorRefId,
        participant,
      }),
    );

  if (requestedParticipantId) {
    const requested = context.participants.find(
      (participant) =>
        clean(participant.partyId, 240) ===
        requestedParticipantId,
    );

    if (!requested) {
      throw new Error(
        'participant_not_authorized',
      );
    }

    if (
      !actorCanUseParticipant({
        actorRole: who.role,
        actorUid,
        actorRefId: who.actorRefId,
        participant: requested,
      })
    ) {
      throw new Error('forbidden');
    }

    candidates = [requested];
  }

  if (candidates.length === 0) {
    throw new Error('forbidden');
  }

  let sawRoleMismatch = false;

  for (const participant of candidates) {
    try {
      return await resolveParticipantAdmission({
        appointmentId: context.appointmentId,
        participantId: participant.partyId,
        role: requestedRole || null,
      });
    } catch (error: any) {
      const code = clean(
        error?.message,
        160,
      );

      if (code === 'participant_role_mismatch') {
        sawRoleMismatch = true;
        continue;
      }

      throw error;
    }
  }

  if (sawRoleMismatch) {
    throw new Error(
      'participant_role_mismatch',
    );
  }

  throw new Error('forbidden');
}

function summarise(
  rows: any[],
  rtcRole: 'patient' | 'clinician',
  surface: PresenceSurface,
): PresenceSummary {
  const entries = rows.filter(
    (row) =>
      row.rtcRole === rtcRole &&
      row.surface === surface,
  );

  const latest = entries[0];

  return {
    online: entries.length > 0,
    count: entries.length,
    lastSeenAt:
      latest?.lastSeenAt instanceof Date
        ? latest.lastSeenAt.toISOString()
        : latest?.lastSeenAt
          ? new Date(
              latest.lastSeenAt,
            ).toISOString()
          : null,
    displayName:
      clean(latest?.displayName, 180) ||
      null,
    participantId:
      clean(latest?.participantId, 240) ||
      null,
  };
}

async function snapshot(
  context: PresenceContext,
) {
  const now = new Date();

  await prisma.televisitPresence.deleteMany({
    where: {
      appointmentId: context.appointmentId,
      expiresAt: {
        lte: now,
      },
    },
  });

  const rows =
    await prisma.televisitPresence.findMany({
      where: {
        appointmentId: context.appointmentId,
        expiresAt: {
          gt: now,
        },
      },
      orderBy: {
        lastSeenAt: 'desc',
      },
      take: 100,
    });

  return {
    ok: true,
    now: now.getTime(),
    ttlMs: PRESENCE_TTL_MS,
    context: {
      key:
        'appointment:' +
        context.appointmentId,
      appointmentId:
        context.appointmentId,
      visitId:
        context.visitId,
      roomId:
        context.roomId,
    },
    patient: {
      lobby: summarise(
        rows,
        'patient',
        'lobby',
      ),
      room: summarise(
        rows,
        'patient',
        'room',
      ),
    },
    clinician: {
      lobby: summarise(
        rows,
        'clinician',
        'lobby',
      ),
      room: summarise(
        rows,
        'clinician',
        'room',
      ),
    },
  };
}

function statusForError(code: string) {
  if (
    code === 'unauthorized' ||
    code === 'Unauthorized'
  ) {
    return 401;
  }

  if (
    code === 'forbidden' ||
    code === 'participant_not_authorized' ||
    code === 'participant_join_not_allowed' ||
    code === 'participant_role_mismatch' ||
    code ===
      'presence_heartbeat_role_not_allowed'
  ) {
    return 403;
  }

  if (
    code === 'appointment_not_found' ||
    code === 'televisit_not_found'
  ) {
    return 404;
  }

  if (code === 'presence_context_mismatch') {
    return 409;
  }

  if (
    code === 'presence_context_required' ||
    code === 'appointment_context_required' ||
    code === 'room_context_required' ||
    code === 'participant_id_required'
  ) {
    return 400;
  }

  return 500;
}

function errorResponse(
  error: unknown,
  fallback: string,
) {
  const code =
    clean((error as any)?.message, 180) ||
    fallback;

  const status = statusForError(code);

  if (status >= 500) {
    console.error(
      '[televisit.presence] failed',
      {
        code,
      },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error:
        status >= 500
          ? fallback
          : code,
    },
    {
      status,
      headers: corsHeaders(),
    },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

export async function GET(
  req: NextRequest,
) {
  try {
    const who = authenticatedWho(req);
    const url = new URL(req.url);

    const context =
      await resolvePresenceContext({
        appointmentId:
          url.searchParams.get(
            'appointmentId',
          ),
        visitId:
          url.searchParams.get(
            'visitId',
          ),
        roomId:
          url.searchParams.get(
            'roomId',
          ) ||
          url.searchParams.get(
            'roomName',
          ),
      });

    await resolveCallerAdmission({
      context,
      who,
      requestedParticipantId:
        url.searchParams.get(
          'participantId',
        ),
      requestedRole:
        url.searchParams.get('role'),
    });

    return NextResponse.json(
      await snapshot(context),
      {
        headers: corsHeaders(),
      },
    );
  } catch (error) {
    return errorResponse(
      error,
      'presence_read_failed',
    );
  }
}

export async function POST(
  req: NextRequest,
) {
  try {
    const who = authenticatedWho(req);

    if (isAdminLike(who.role)) {
      throw new Error(
        'presence_heartbeat_role_not_allowed',
      );
    }

    const body = await req
      .json()
      .catch(() => ({} as any));

    const context =
      await resolvePresenceContext({
        appointmentId:
          body.appointmentId,
        visitId:
          body.visitId ||
          body.televisitId,
        roomId:
          body.roomId ||
          body.roomName,
      });

    const admission =
      await resolveCallerAdmission({
        context,
        who,
        requestedParticipantId:
          body.participantId ||
          body.partyId,
        requestedRole:
          body.role ||
          body.participantRole,
      });

    if (!admission) {
      throw new Error('forbidden');
    }

    const participant =
      admission.participant;

    const participantId = clean(
      participant.partyId,
      240,
    );

    if (!participantId) {
      throw new Error(
        'participant_id_required',
      );
    }

    const surface =
      normaliseSurface(
        body.surface ||
        body.location ||
        body.state,
      );

    const now = new Date();

    const expiresAt = new Date(
      now.getTime() + PRESENCE_TTL_MS,
    );

    const displayName =
      fallbackDisplayName(participant);

    await prisma.televisitPresence.upsert({
      where: {
        appointmentId_participantId_surface: {
          appointmentId:
            context.appointmentId,
          participantId,
          surface,
        },
      },
      create: {
        appointmentId:
          context.appointmentId,
        visitId:
          context.visitId,
        roomId:
          context.roomId,
        participantId,
        participantRole:
          admission.participantRole,
        rtcRole:
          admission.rtcRole,
        surface,
        actorUserId:
          clean(who.uid, 240),
        actorRefId:
          clean(who.actorRefId, 240) ||
          null,
        displayName,
        lastSeenAt: now,
        expiresAt,
      },
      update: {
        visitId:
          context.visitId,
        roomId:
          context.roomId,
        participantRole:
          admission.participantRole,
        rtcRole:
          admission.rtcRole,
        actorUserId:
          clean(who.uid, 240),
        actorRefId:
          clean(who.actorRefId, 240) ||
          null,
        displayName,
        lastSeenAt: now,
        expiresAt,
      },
    });

    return NextResponse.json(
      {
        ...(await snapshot(context)),
        self: {
          role:
            admission.rtcRole,
          participantRole:
            admission.participantRole,
          surface,
          participantId,
          displayName,
          lastSeenAt:
            now.toISOString(),
          expiresAt:
            expiresAt.toISOString(),
        },
      },
      {
        headers: corsHeaders(),
      },
    );
  } catch (error) {
    return errorResponse(
      error,
      'presence_update_failed',
    );
  }
}
