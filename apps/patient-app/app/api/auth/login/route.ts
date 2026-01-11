//apps/patient-app/app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LoginBody = { email?: string; password?: string; remember?: boolean };

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
}

function normalizeEmail(v: string) {
  return String(v || '').trim().toLowerCase();
}

function b64url(buf: Buffer) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}
function b64urlJson(obj: any) {
  return b64url(Buffer.from(JSON.stringify(obj), 'utf8'));
}

/** Minimal HS256 JWT signer (no deps) */
function signJwtHs256(payload: any, secret: string) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const h = b64urlJson(header);
  const p = b64urlJson(payload);
  const data = `${h}.${p}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest();
  return `${data}.${b64url(sig)}`;
}

function base64urlToBuffer(s: string) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

async function verifyPasswordScrypt(password: string, stored: string) {
  // stored: scrypt$N$r$p$salt$hash
  try {
    const parts = String(stored || '').split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    const salt = base64urlToBuffer(parts[4]);
    const expected = base64urlToBuffer(parts[5]);

    const derived = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(password, salt, expected.length, { N, r, p }, (err, dk) => {
        if (err) reject(err);
        else resolve(dk as Buffer);
      });
    });

    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

// Prisma singleton
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function POST(req: Request) {
  const h = headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
  const ua = h.get('user-agent') || null;

  let body: LoginBody = {};
  try {
    body = (await req.json().catch(() => ({}))) as LoginBody;
  } catch {
    body = {};
  }

  const email = normalizeEmail(body?.email || '');
  const password = String(body?.password || '');
  const remember = Boolean(body?.remember);

  if (!email || !password) {
    return json(400, { ok: false, error: 'Email and password are required.' });
  }

  const cred = await prisma.authCredential.findUnique({ where: { email } }).catch(() => null);

  // Generic error (don’t reveal which part failed)
  const invalid = () => json(401, { ok: false, error: 'Invalid email or password.' });

  if (!cred || cred.disabled) return invalid();

  const ok = await verifyPasswordScrypt(password, cred.passwordHash);
  if (!ok) return invalid();

  const now = new Date();

  // Create presence session (server-side)
  const sess = await prisma.presenceSession
    .create({
      data: {
        userId: cred.id,
        actorType: cred.actorType,
        actorRefId: null,
        app: 'patient-app',
        lastSeenAt: now,
        ipCountry: null,
        ipCity: null,
        userAgent: ua || undefined,
        meta: ip ? { ip } : undefined,
      },
    })
    .catch(() => null);

  // Update lastLoginAt (best effort)
  await prisma.authCredential.update({ where: { id: cred.id }, data: { lastLoginAt: now } }).catch(() => null);

  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    // You can still return ok, but no session cookie means UI won’t stay logged in.
    return json(500, { ok: false, error: 'Server auth is not configured (missing AUTH_SESSION_SECRET).' });
  }

  const ttlDays = Number(process.env.AUTH_SESSION_TTL_DAYS || (remember ? '14' : '7'));
  const ttlSec = Math.max(1, Math.min(ttlDays, 60)) * 24 * 60 * 60;

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ttlSec;

  const token = signJwtHs256(
    {
      sid: sess?.id || null,
      uid: cred.id,
      actorType: cred.actorType,
      orgId: cred.orgId || 'org-default',
      iat,
      exp,
    },
    secret,
  );

  const res = NextResponse.json({ ok: true, userId: cred.id, actorType: cred.actorType }, { status: 200 });

  res.cookies.set({
    name: 'ambulant_session',
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ttlSec,
  });

  return res;
}
