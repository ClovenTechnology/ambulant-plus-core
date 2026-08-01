// apps/api-gateway/app/api/rtc/token/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { decodeJwt, jwtVerify } from 'jose';
import {
  TrainingAdmissionError,
  verifyTrainingAdmissionToken,
} from '@/src/clinicians/onboarding/training-admission';

// -----------------------------
// Prisma (local, safe singleton)
// -----------------------------
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// -----------------------------
// CORS
// -----------------------------
// Allow-list. Example: "https://patient.yourdomain.com,https://clinician.yourdomain.com"
const ORIGINS = (process.env.RTC_CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function cors(req: NextRequest) {
  const origin = req.headers.get('origin') || '';
  const allowOrigin = ORIGINS.length === 0 ? '*' : ORIGINS.includes(origin) ? origin : '';

  const h = new Headers();
  if (allowOrigin) h.set('access-control-allow-origin', allowOrigin);
  if (ORIGINS.length > 0) h.set('vary', 'Origin');

  h.set('access-control-allow-methods', 'POST, OPTIONS');
  h.set(
    'access-control-allow-headers',
    [
      'content-type',
      'authorization',
      'x-uid',
      'x-role',
      'x-join-token',
      'x-org-id',
      'x-request-id',
    ].join(', '),
  );
  h.set('access-control-max-age', '600');
  h.set('cache-control', 'no-store');
  return h;
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req) });
}

// -----------------------------
// Helpers
// -----------------------------
function sha256Hex(s: string) {
  return createHash('sha256').update(s).digest('hex');
}

function envFirst(names: string[]) {
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim()) return v.trim();
  }
  return '';
}

function asString(v: unknown) {
  return typeof v === 'string' ? v : '';
}

function pickClaim(payload: any, keys: string[]) {
  for (const k of keys) {
    const v = payload?.[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function mustRole(role: string) {
  const r = role.trim();
  if (!['patient', 'clinician', 'staff', 'observer', 'admin'].includes(r)) return '';
  return r as 'patient' | 'clinician' | 'staff' | 'observer' | 'admin';
}

function normaliseParticipantRoleForAuth(raw: unknown, authRole: string) {
  const value = String(raw || '').trim().toLowerCase().replace(/_/g, '-');

  if (authRole === 'clinician' || authRole === 'staff' || authRole === 'admin') {
    return 'clinician';
  }

  const allowedPatientSide = new Set([
    'patient',
    'parent',
    'mother',
    'father',
    'mum',
    'mom',
    'dad',
    'guardian',
    'legal-guardian',
    'caregiver',
    'carer',
    'care-ally',
    'care-giver',
    'partner',
    'spouse',
    'wife',
    'husband',
    'couple',
    'interpreter',
    'translator',
    'guest',
    'observer',
  ]);

  if (!allowedPatientSide.has(value)) {
    return authRole === 'observer' ? 'observer' : 'patient';
  }

  if (['mother', 'father', 'mum', 'mom', 'dad'].includes(value)) return 'parent';
  if (value === 'legal-guardian') return 'guardian';
  if (['carer', 'care-ally', 'care-giver'].includes(value)) return 'caregiver';
  if (['spouse', 'wife', 'husband', 'couple'].includes(value)) return 'partner';
  if (value === 'translator') return 'interpreter';

  return value || (authRole === 'observer' ? 'observer' : 'patient');
}

function pickBodyString(body: any, keys: string[]) {
  for (const key of keys) {
    const value = body?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function buildParticipantMetadata(body: any, args: {
  uid: string;
  roomId: string;
  visitId: string;
  role: string;
  orgId: string;
}) {
  const supplied =
    body?.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
      ? body.metadata
      : {};

  const participantRole = normaliseParticipantRoleForAuth(
    pickBodyString(body, ['participantRole', 'speakerRole', 'relationshipToPatient', 'relationship']) ||
      pickBodyString(supplied, ['participantRole', 'speakerRole', 'relationshipToPatient', 'relationship']),
    args.role,
  );

  const displayName =
    pickBodyString(body, ['displayName', 'participantName', 'speakerName', 'name']) ||
    pickBodyString(supplied, ['displayName', 'participantName', 'speakerName', 'name']) ||
    args.uid;

  const encounterId =
    pickBodyString(body, ['encounterId', 'encounter', 'enc']) ||
    pickBodyString(supplied, ['encounterId', 'encounter', 'enc']);

  const appointmentId =
    pickBodyString(body, ['appointmentId', 'appointment', 'appt']) ||
    pickBodyString(supplied, ['appointmentId', 'appointment', 'appt']);

  return {
    participantRole,
    speakerRole: participantRole,
    displayName,
    participantName: displayName,
    speakerName: displayName,
    relationshipToPatient:
      pickBodyString(body, ['relationshipToPatient', 'relationship']) ||
      pickBodyString(supplied, ['relationshipToPatient', 'relationship']) ||
      (participantRole === 'patient' || participantRole === 'clinician' ? undefined : participantRole),
    encounterId: encounterId || undefined,
    appointmentId: appointmentId || undefined,
    visitId: args.visitId,
    roomId: args.roomId,
    orgId: args.orgId || undefined,
    authRole: args.role,
    uid: args.uid,
  };
}

async function mintTrainingRoomToken(
  admission: Awaited<ReturnType<typeof verifyTrainingAdmissionToken>>,
) {
  const livekitKey = envFirst(['LIVEKIT_API_KEY', 'LK_API_KEY']);
  const livekitSecret = envFirst(['LIVEKIT_API_SECRET', 'LK_API_SECRET']);
  const livekitUrl = envFirst(['LIVEKIT_WS_URL', 'LIVEKIT_URL', 'LK_WS_URL', 'LK_URL']);

  if (!livekitKey || !livekitSecret || !livekitUrl) {
    throw new TrainingAdmissionError('server_misconfig', 500);
  }

  const remainingSeconds = Math.floor(
    (admission.expiresAt.getTime() - Date.now()) / 1000,
  );

  if (remainingSeconds <= 0) {
    throw new TrainingAdmissionError('invalid_training_admission', 401);
  }

  const permissions = Array.isArray(admission.permissions)
    ? admission.permissions.map((permission) => String(permission))
    : [];
  const canPublish = admission.role !== 'observer';
  const canPublishData =
    canPublish &&
    (admission.role !== 'patient' || permissions.includes('training:iomt:publish'));
  const metadata = {
    kind: 'training_admission',
    admissionId: admission.admissionId,
    assignmentId: admission.assignmentId,
    trainingSlotId: admission.trainingSlotId,
    sessionKey: admission.sessionKey,
    subjectId: admission.subjectId,
    ...(admission.role === 'patient' ? { patientId: admission.subjectId } : {}),
    uid: admission.uid,
    roomId: admission.roomId,
    visitId: admission.trainingSlotId,
    displayName: admission.displayName,
    participantName: admission.displayName,
    speakerName: admission.displayName,
    participantRole: admission.role,
    speakerRole: admission.role,
    authRole: admission.role,
    orgId: admission.orgId || undefined,
    permissions,
  };

  const { AccessToken } = await import('livekit-server-sdk');
  const accessToken = new AccessToken(livekitKey, livekitSecret, {
    identity: admission.uid,
    name: admission.displayName || admission.uid,
    ttl: Math.max(1, Math.min(remainingSeconds, 6 * 60 * 60)),
    metadata: JSON.stringify(metadata),
    attributes: {
      participantRole: admission.role,
      authRole: admission.role,
      trainingSlotId: admission.trainingSlotId,
    },
  });

  accessToken.addGrant({
    room: admission.roomId,
    roomJoin: true,
    canPublish,
    canPublishData,
    canSubscribe: true,
  });

  return {
    rtcToken: await accessToken.toJwt(),
    livekitUrl,
    metadata,
  };
}

// -----------------------------
// POST /api/rtc/token
// Requires: x-join-token (JWT join ticket)
// Returns: LiveKit access token
// -----------------------------
export async function POST(req: NextRequest) {
  const h = cors(req);

  try {
    let body: any = {};

    try {

      body = await req.json();

    } catch {

      body = {};

    }


    const joinJwt = (req.headers.get('x-join-token') || '').trim();

    if (!joinJwt) {
      return NextResponse.json(
        { ok: false, error: 'missing_join_token', message: 'Missing x-join-token' },
        { status: 401, headers: h },
      );
    }

    let unverifiedPayload: any = {};

    try {
      unverifiedPayload = decodeJwt(joinJwt);
    } catch {
      unverifiedPayload = {};
    }

    if (unverifiedPayload.kind === 'training_admission') {
      const expectedRoomId = pickBodyString(body, ['roomId', 'room', 'rid']) || null;
      const admission = await verifyTrainingAdmissionToken(joinJwt, expectedRoomId);
      const minted = await mintTrainingRoomToken(admission);

      return NextResponse.json(
        {
          ok: true,
          provider: 'livekit',
          wsUrl: minted.livekitUrl,
          token: minted.rtcToken,
          url: minted.livekitUrl,
          livekitUrl: minted.livekitUrl,
          roomId: admission.roomId,
          identity: admission.uid,
          role: admission.role,
          participantRole: admission.role,
          metadata: minted.metadata,
          visitId: admission.trainingSlotId,
          orgId: admission.orgId,
          ticketExpiresAt: admission.expiresAt.toISOString(),
        },
        { status: 200, headers: h },
      );
    }

    // Verify legacy Televisit join-ticket JWT (signature + nbf/exp)
    const joinSecret = envFirst(['TELEVISIT_JOIN_JWT_SECRET', 'RTC_JOIN_JWT_SECRET', 'JOIN_TICKET_JWT_SECRET']);
    if (!joinSecret) {
      return NextResponse.json(
        {
          ok: false,
          error: 'server_misconfig',
          message: 'Missing TELEVISIT_JOIN_JWT_SECRET on api-gateway',
        },
        { status: 500, headers: h },
      );
    }

    const issuer = envFirst(['TELEVISIT_JOIN_JWT_ISSUER', 'JOIN_TICKET_JWT_ISSUER']);
    const audience = envFirst(['TELEVISIT_JOIN_JWT_AUDIENCE', 'JOIN_TICKET_JWT_AUDIENCE']);

    const secretKey = new TextEncoder().encode(joinSecret);

    const { payload } = await jwtVerify(joinJwt, secretKey, {
      algorithms: ['HS256'],
      clockTolerance: 10, // seconds
      ...(issuer ? { issuer } : {}),
      ...(audience ? { audience } : {}),
    });

    // Flexible claim mapping (so you donâ€™t brick older tokens if you rename keys)
    const uid = pickClaim(payload, ['uid', 'sub', 'userId', 'u']);
    const roomId = pickClaim(payload, ['roomId', 'rid', 'room', 'r']);
    const visitId = pickClaim(payload, ['visitId', 'vid', 'visit', 'v']);
    const orgId = pickClaim(payload, ['orgId', 'org', 'tenant']) || '';
    const role = mustRole(pickClaim(payload, ['role', 'televisitRole', 'rRole'])) || 'patient';

    if (!uid || !roomId || !visitId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'invalid_join_token',
          message: 'Join token missing required claims (uid, visitId, roomId)',
        },
        { status: 401, headers: h },
      );
    }

    // DB revocation + expiry check (hash-of-JWT string)
    const tokenHash = sha256Hex(joinJwt);
    const now = new Date();

    const ticket = await prisma.televisitJoinTicket.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        visitId: true,
        uid: true,
        role: true,
        orgId: true,
        expiresAt: true,
        revokedAt: true,
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { ok: false, error: 'ticket_not_found', message: 'Join ticket not recognized (no DB record)' },
        { status: 401, headers: h },
      );
    }

    if (ticket.revokedAt) {
      return NextResponse.json(
        { ok: false, error: 'ticket_revoked', message: 'Join ticket has been revoked' },
        { status: 403, headers: h },
      );
    }

    if (new Date(ticket.expiresAt).getTime() <= now.getTime()) {
      return NextResponse.json(
        { ok: false, error: 'ticket_expired', message: 'Join ticket has expired' },
        { status: 403, headers: h },
      );
    }

    // Consistency checks (prevents token reuse across users/roles/visits)
    if (ticket.visitId !== visitId || ticket.uid !== uid || ticket.role !== role) {
      return NextResponse.json(
        { ok: false, error: 'ticket_mismatch', message: 'Join ticket does not match visit/user/role' },
        { status: 403, headers: h },
      );
    }

    // Tenant guard (optional but recommended)
    if ((ticket.orgId || '') !== (orgId || '')) {
      return NextResponse.json(
        { ok: false, error: 'tenant_mismatch', message: 'Join ticket tenant mismatch' },
        { status: 403, headers: h },
      );
    }

    // Touch lastUsedAt (best-effort)
    prisma.televisitJoinTicket
      .update({
        where: { tokenHash },
        data: { lastUsedAt: now },
      })
      .catch(() => {
        // ignore
      });

    // Mint RTC token (LiveKit)
    const livekitKey = envFirst(['LIVEKIT_API_KEY', 'LK_API_KEY']);
    const livekitSecret = envFirst(['LIVEKIT_API_SECRET', 'LK_API_SECRET']);
    const livekitUrl = envFirst(['LIVEKIT_WS_URL', 'LIVEKIT_URL', 'LK_WS_URL', 'LK_URL']);

    if (!livekitKey || !livekitSecret || !livekitUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: 'server_misconfig',
          message: 'Missing LIVEKIT_API_KEY / LIVEKIT_API_SECRET / LIVEKIT_WS_URL (or LIVEKIT_URL)',
        },
        { status: 500, headers: h },
      );
    }

    // Import here to keep route resilient in build graph
    const { AccessToken } = await import('livekit-server-sdk');

    // Permissions by role (tweak as you like)
    const canPublish = role !== 'observer';
    const canPublishData = role !== 'observer';
    const canSubscribe = true;

    const participantMetadata = buildParticipantMetadata(body, {


      uid,


      roomId,


      visitId,


      role,


      orgId,


    });



    const at = new AccessToken(livekitKey, livekitSecret, {


      identity: uid,


      name: participantMetadata.displayName || uid,


      metadata: JSON.stringify(participantMetadata),


      attributes: {


        participantRole: String(participantMetadata.participantRole || role),


        authRole: role,


        ...(participantMetadata.encounterId ? { encounterId: String(participantMetadata.encounterId) } : {}),


        ...(participantMetadata.appointmentId ? { appointmentId: String(participantMetadata.appointmentId) } : {}),


      },


      // TTL is optional; ticket expiry already gates.


    });

    at.addGrant({
      room: roomId,
      roomJoin: true,
      canPublish,
      canPublishData,
      canSubscribe,
    });

    const rtcToken = await at.toJwt();

    return NextResponse.json(
      {
        ok: true,
        provider: 'livekit',
        wsUrl: livekitUrl,
        token: rtcToken,
        url: livekitUrl,
        livekitUrl: livekitUrl,
        roomId,
        identity: uid,
        role,

        participantRole: participantMetadata.participantRole,

        metadata: participantMetadata,

        visitId,

        orgId,
        ticketExpiresAt: new Date(ticket.expiresAt).toISOString(),
      },
      { status: 200, headers: h },
    );
  } catch (e: any) {
    if (e instanceof TrainingAdmissionError) {
      return NextResponse.json(
        { ok: false, error: e.code, ...(e.details || {}) },
        { status: e.status, headers: h },
      );
    }

    const msg = asString(e?.message) || 'Unknown error';
    const status = msg.toLowerCase().includes('jwt') || msg.toLowerCase().includes('token') ? 401 : 400;

    return NextResponse.json(
      { ok: false, error: 'rtc_token_failed', message: msg },
      { status, headers: h },
    );
  }
}
