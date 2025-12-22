// apps/api-gateway/app/api/rtc/token/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';

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

// -----------------------------
// POST /api/rtc/token
// Requires: x-join-token (JWT join ticket)
// Returns: LiveKit access token
// -----------------------------
export async function POST(req: NextRequest) {
  const h = cors(req);

  try {
    const joinJwt = (req.headers.get('x-join-token') || '').trim();
    if (!joinJwt) {
      return NextResponse.json(
        { ok: false, error: 'missing_join_token', message: 'Missing x-join-token' },
        { status: 401, headers: h },
      );
    }

    // Verify join-ticket JWT (signature + nbf/exp)
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

    // Flexible claim mapping (so you don’t brick older tokens if you rename keys)
    const uid = pickClaim(payload, ['uid', 'sub', 'userId', 'u']);
    const roomId = pickClaim(payload, ['roomId', 'rid', 'room', 'r']);
    const visitId = pickClaim(payload, ['visitId', 'vid', 'visit', 'v']);
    const orgId = pickClaim(payload, ['orgId', 'org', 'tenant']) || 'org-default';
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
    if ((ticket.orgId || 'org-default') !== (orgId || 'org-default')) {
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

    const at = new AccessToken(livekitKey, livekitSecret, {
      identity: uid,
      name: uid, // optionally override from client body later
      // TTL is optional; ticket expiry already gates.
      // If you want: ttl: Math.max(60, Math.floor((ticket.expiresAt.getTime() - now.getTime()) / 1000))
    });

    at.addGrant({
      room: roomId,
      roomJoin: true,
      canPublish,
      canPublishData,
      canSubscribe,
    });

    const rtcToken = at.toJwt();

    return NextResponse.json(
      {
        ok: true,
        provider: 'livekit',
        wsUrl: livekitUrl,
        token: rtcToken,
        roomId,
        identity: uid,
        role,
        visitId,
        orgId,
        ticketExpiresAt: new Date(ticket.expiresAt).toISOString(),
      },
      { status: 200, headers: h },
    );
  } catch (e: any) {
    const msg = asString(e?.message) || 'Unknown error';
    const status = msg.toLowerCase().includes('jwt') || msg.toLowerCase().includes('token') ? 401 : 400;

    return NextResponse.json(
      { ok: false, error: 'rtc_token_failed', message: msg },
      { status, headers: h },
    );
  }
}
