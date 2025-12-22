// apps/api-gateway/app/api/rtc/_lib.ts
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';

// -----------------------------
// Prisma (local, safe singleton)
// -----------------------------
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// -----------------------------
// CORS
// -----------------------------
const ORIGINS = (process.env.RTC_CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export function cors(req: NextRequest) {
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

export function sha256Hex(s: string) {
  return createHash('sha256').update(s).digest('hex');
}

export function envFirst(names: string[]) {
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim()) return v.trim();
  }
  return '';
}

export function asString(v: unknown) {
  return typeof v === 'string' ? v : '';
}

export function pickClaim(payload: any, keys: string[]) {
  for (const k of keys) {
    const v = payload?.[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

export function mustRole(role: string) {
  const r = role.trim();
  if (!['patient', 'clinician', 'staff', 'observer', 'admin'].includes(r)) return '';
  return r as 'patient' | 'clinician' | 'staff' | 'observer' | 'admin';
}

function toHttpUrl(url: string) {
  const u = (url || '').trim();
  if (!u) return '';
  if (u.startsWith('wss://')) return 'https://' + u.slice('wss://'.length);
  if (u.startsWith('ws://')) return 'http://' + u.slice('ws://'.length);
  return u;
}

export type VerifiedJoin = {
  joinJwt: string;
  tokenHash: string;
  uid: string;
  role: 'patient' | 'clinician' | 'staff' | 'observer' | 'admin';
  roomId: string;
  visitId: string;
  orgId: string;
  ticket: {
    id: string;
    visitId: string;
    uid: string;
    role: 'patient' | 'clinician' | 'staff' | 'observer' | 'admin';
    orgId: string | null;
    expiresAt: Date;
    revokedAt: Date | null;
  };
};

export async function verifyJoinTicket(req: NextRequest): Promise<VerifiedJoin> {
  const joinJwt = (req.headers.get('x-join-token') || '').trim();
  if (!joinJwt) throw new Error('missing_join_token');

  const joinSecret = envFirst(['TELEVISIT_JOIN_JWT_SECRET', 'RTC_JOIN_JWT_SECRET', 'JOIN_TICKET_JWT_SECRET']);
  if (!joinSecret) throw new Error('server_misconfig_missing_join_secret');

  const issuer = envFirst(['TELEVISIT_JOIN_JWT_ISSUER', 'JOIN_TICKET_JWT_ISSUER']);
  const audience = envFirst(['TELEVISIT_JOIN_JWT_AUDIENCE', 'JOIN_TICKET_JWT_AUDIENCE']);

  const secretKey = new TextEncoder().encode(joinSecret);
  const { payload } = await jwtVerify(joinJwt, secretKey, {
    algorithms: ['HS256'],
    clockTolerance: 10,
    ...(issuer ? { issuer } : {}),
    ...(audience ? { audience } : {}),
  });

  const uid = pickClaim(payload, ['uid', 'sub', 'userId', 'u']);
  const roomId = pickClaim(payload, ['roomId', 'rid', 'room', 'r']);
  const visitId = pickClaim(payload, ['visitId', 'vid', 'visit', 'v']);
  const orgId = pickClaim(payload, ['orgId', 'org', 'tenant']) || 'org-default';
  const role = mustRole(pickClaim(payload, ['role', 'televisitRole', 'rRole'])) || 'patient';

  if (!uid || !roomId || !visitId) throw new Error('invalid_join_token_missing_claims');

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

  if (!ticket) throw new Error('ticket_not_found');
  if (ticket.revokedAt) throw new Error('ticket_revoked');
  if (new Date(ticket.expiresAt).getTime() <= now.getTime()) throw new Error('ticket_expired');

  if (ticket.visitId !== visitId || ticket.uid !== uid || ticket.role !== role) {
    throw new Error('ticket_mismatch');
  }

  if ((ticket.orgId || 'org-default') !== (orgId || 'org-default')) {
    throw new Error('tenant_mismatch');
  }

  return {
    joinJwt,
    tokenHash,
    uid,
    role,
    roomId,
    visitId,
    orgId,
    ticket: {
      id: ticket.id,
      visitId: ticket.visitId,
      uid: ticket.uid,
      role: ticket.role,
      orgId: ticket.orgId,
      expiresAt: ticket.expiresAt,
      revokedAt: ticket.revokedAt,
    },
  };
}

export function requireRole(role: string, allowed: string[]) {
  if (!allowed.includes(role)) throw new Error('forbidden_role');
}

export async function roomServiceClient() {
  const livekitKey = envFirst(['LIVEKIT_API_KEY', 'LK_API_KEY']);
  const livekitSecret = envFirst(['LIVEKIT_API_SECRET', 'LK_API_SECRET']);
  const livekitUrlRaw = envFirst(['LIVEKIT_API_URL', 'LIVEKIT_WS_URL', 'LIVEKIT_URL', 'LK_URL', 'LK_WS_URL']);

  if (!livekitKey || !livekitSecret || !livekitUrlRaw) throw new Error('server_misconfig_missing_livekit_creds');

  const livekitUrl = toHttpUrl(livekitUrlRaw);

  const { RoomServiceClient } = await import('livekit-server-sdk');
  return new RoomServiceClient(livekitUrl, livekitKey, livekitSecret);
}

/**
 * Best-effort audit log.
 * If you later add a Prisma model named TelevisitRtcActionLog (or televisitRtcActionLog),
 * this will start persisting automatically.
 */
export async function auditBestEffort(entry: Record<string, any>) {
  try {
    const model =
      (prisma as any).televisitRtcActionLog ||
      (prisma as any).TelevisitRtcActionLog ||
      (prisma as any).televisitActionLog ||
      null;

    if (model?.create) {
      await model.create({ data: entry });
      return;
    }
  } catch {
    // ignore
  }
}
