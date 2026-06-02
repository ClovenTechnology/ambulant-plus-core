// apps/patient-app/app/api/auth/passkey/_lib.ts
import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

export const SESSION_COOKIE_NAME = 'ambulant_session';

export function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
}

export function normalizeEmail(v: unknown) {
  return String(v || '').trim().toLowerCase();
}

export function cleanStr(v: unknown, max = 240) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return s.length > max ? s.slice(0, max) : s;
}

export function b64url(buf: Buffer | Uint8Array) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function b64urlJson(obj: any) {
  return b64url(Buffer.from(JSON.stringify(obj), 'utf8'));
}

export function base64urlToBuffer(s: string) {
  const raw = String(s || '');
  const pad = raw.length % 4 === 0 ? '' : '='.repeat(4 - (raw.length % 4));
  const b64 = (raw + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

export function signJwtHs256(payload: any, secret: string) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const h = b64urlJson(header);
  const p = b64urlJson(payload);
  const data = `${h}.${p}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest();
  return `${data}.${b64url(sig)}`;
}

function safeJsonParse(buf: Buffer) {
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    return null;
  }
}

export function verifyJwtHs256(token: string, secret: string): any | null {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;

    const [h, p, sig] = parts;
    const data = `${h}.${p}`;

    const expected = crypto.createHmac('sha256', secret).update(data).digest();
    const got = base64urlToBuffer(sig);

    if (got.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(got, expected)) return null;

    const payload = safeJsonParse(base64urlToBuffer(p));
    if (!payload) return null;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp <= now) return null;
    if (!payload.sub && !payload.uid) return null;

    if (typeof payload.actorType === 'string' && payload.actorType !== 'PATIENT') {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getRpID(req?: Request) {
  const configured = process.env.WEBAUTHN_RP_ID || process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID;
  if (configured && configured.trim()) return configured.trim();

  try {
    const host =
      req ? new URL(req.url).hostname : headers().get('x-forwarded-host') || headers().get('host') || '';
    return String(host || 'localhost').split(':')[0];
  } catch {
    return 'localhost';
  }
}

export function getOrigin(req?: Request) {
  const configured = process.env.WEBAUTHN_ORIGIN || process.env.NEXT_PUBLIC_PATIENT_APP_URL || process.env.APP_BASE_URL;
  if (configured && configured.trim()) return configured.trim().replace(/\/+$/, '');

  if (req) {
    const url = new URL(req.url);
    return `${url.protocol}//${url.host}`;
  }

  const h = headers();
  const proto = h.get('x-forwarded-proto') || 'http';
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

export function getRpName() {
  return process.env.WEBAUTHN_RP_NAME || 'Ambulant+';
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function requirePatientSession() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    return { ok: false as const, status: 500, error: 'Missing AUTH_SESSION_SECRET.' };
  }

  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return { ok: false as const, status: 401, error: 'Not signed in.' };
  }

  const payload = verifyJwtHs256(token, secret);
  if (!payload) {
    return { ok: false as const, status: 401, error: 'Invalid session.' };
  }

  const userId = String(payload.sub || payload.userId || payload.uid || '');
  if (!userId) {
    return { ok: false as const, status: 401, error: 'Invalid session.' };
  }

  return {
    ok: true as const,
    payload,
    userId,
    actorRefId: payload.actorRefId ? String(payload.actorRefId) : null,
    orgId: payload.orgId ? String(payload.orgId) : 'org-default',
  };
}

export async function createPatientSessionResponse(params: {
  userId: string;
  actorRefId?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  authMethod: string;
  remember?: boolean;
}) {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) return json(500, { ok: false, error: 'Server auth is not configured.' });

  const now = new Date();

  const sess = await prisma.presenceSession
    .create({
      data: {
        userId: params.userId,
        actorType: 'PATIENT',
        actorRefId: params.actorRefId || null,
        app: 'patient-app',
        lastSeenAt: now,
        ipCountry: null,
        ipCity: null,
        userAgent: params.userAgent || undefined,
        meta: params.ip ? { ip: params.ip, authMethod: params.authMethod } : { authMethod: params.authMethod },
      },
    })
    .catch(() => null);

  await prisma.authCredential.update({
    where: { id: params.userId },
    data: { lastLoginAt: now },
  }).catch(() => null);

  const ttlDays = Number(process.env.AUTH_SESSION_TTL_DAYS || (params.remember ? '14' : '7'));
  const ttlSec = Math.max(1, Math.min(ttlDays, 60)) * 24 * 60 * 60;

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ttlSec;

  const token = signJwtHs256(
    {
      sid: sess?.id || null,
      uid: params.userId,
      sub: params.userId,
      actorType: 'PATIENT',
      actorRefId: params.actorRefId || null,
      orgId: 'org-default',
      iat,
      exp,
      amr: [params.authMethod],
    },
    secret,
  );

  const patientProfile = await prisma.patientProfile
    .findFirst({
      where: { userId: params.userId },
      select: {
        id: true,
        userId: true,
        name: true,
        contactEmail: true,
        mrn: true,
      },
    })
    .catch(() => null);

  const res = NextResponse.json(
    {
      ok: true,
      userId: params.userId,
      actorType: 'PATIENT',
      actorRefId: params.actorRefId || patientProfile?.id || null,
      profile: patientProfile
        ? {
            patientId: patientProfile.id,
            id: patientProfile.id,
            mrn: patientProfile.mrn ?? null,
            userId: patientProfile.userId,
            name: patientProfile.name ?? null,
            email: patientProfile.contactEmail ?? null,
          }
        : null,
    },
    { status: 200 },
  );

  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ttlSec,
  });

  return res;
}

export function getRequestMeta() {
  const h = headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
  const ua = h.get('user-agent') || null;
  return { ip, ua };
}

export function publicKeyToBase64Url(value: any) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return b64url(Buffer.from(value));
}

export function toBigIntSafe(value: unknown) {
  try {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return BigInt(value);
    if (typeof value === 'string' && value.trim()) return BigInt(value);
  } catch {
    return BigInt(0);
  }
  return BigInt(0);
}

export function passkeyDisplay(row: any) {
  return {
    id: row.id,
    deviceLabel: row.deviceLabel || 'Passkey',
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    backedUp: Boolean(row.backedUp),
    disabledAt: row.disabledAt,
    transports: row.transports ?? null,
  };
}
