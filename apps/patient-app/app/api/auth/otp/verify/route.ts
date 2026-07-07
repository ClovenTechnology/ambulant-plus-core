// apps/patient-app/app/api/auth/otp/verify/route.ts
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OtpVerifyBody = {
  email?: string;
  identifier?: string;
  code?: string;
  remember?: boolean;
};

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
}

function normalizeEmail(v: unknown) {
  return String(v || '').trim().toLowerCase();
}

function normalizeCode(v: unknown) {
  return String(v || '').replace(/\D/g, '').slice(0, 6);
}

function sha256Hex(s: string) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function otpHash(identifier: string, code: string) {
  const pepper = process.env.AUTH_OTP_SECRET || process.env.AUTH_SESSION_SECRET || '';
  if (!pepper) throw new Error('Missing AUTH_OTP_SECRET or AUTH_SESSION_SECRET.');
  return sha256Hex(`${pepper}:${identifier}:${code}`);
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

function signJwtHs256(payload: any, secret: string) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const h = b64urlJson(header);
  const p = b64urlJson(payload);
  const data = `${h}.${p}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest();
  return `${data}.${b64url(sig)}`;
}

type Bucket = { count: number; resetAt: number };
const RL = (globalThis as any).__AMB_OTP_VERIFY_RL__ ?? new Map<string, Bucket>();
(globalThis as any).__AMB_OTP_VERIFY_RL__ = RL;

function hitLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const cur = RL.get(key);
  if (!cur || now > cur.resetAt) {
    RL.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  cur.count += 1;
  RL.set(key, cur);
  return cur.count > limit;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function POST(req: Request) {
  const h = headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
  const ua = h.get('user-agent') || null;

  let body: OtpVerifyBody = {};
  try {
    body = (await req.json().catch(() => ({}))) as OtpVerifyBody;
  } catch {
    body = {};
  }

  const email = normalizeEmail(body.email || body.identifier || '');
  const code = normalizeCode(body.code || '');
  const remember = Boolean(body.remember);

  if (!email || !code || code.length !== 6) {
    return json(400, { ok: false, error: 'Enter the 6-digit sign-in code.' });
  }

  const rlKey = `otp:verify:${ip || 'unknown'}:${email}`;
  if (hitLimit(rlKey, 12, 15 * 60 * 1000)) {
    return json(429, { ok: false, error: 'Too many verification attempts. Please wait and try again.' });
  }

  const now = new Date();

  const challenge = await prisma.authOtpChallenge
    .findFirst({
      where: {
        identifier: email,
        channel: 'email',
        purpose: 'login',
        consumedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    })
    .catch(() => null);

  if (!challenge) {
    return json(400, { ok: false, error: 'Code is invalid or expired.' });
  }

  if (challenge.attempts >= challenge.maxAttempts) {
    await prisma.authOtpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: now },
    }).catch(() => null);

    return json(400, { ok: false, error: 'Code is invalid or expired.' });
  }

  const expectedHash = otpHash(email, code);
  const expected = Buffer.from(challenge.codeHash, 'utf8');
  const got = Buffer.from(expectedHash, 'utf8');

  const matches = expected.length === got.length && crypto.timingSafeEqual(expected, got);

  if (!matches) {
    await prisma.authOtpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    }).catch(() => null);

    return json(400, { ok: false, error: 'Code is invalid or expired.' });
  }

  const cred = await prisma.authCredential
    .findUnique({ where: { email } })
    .catch(() => null);

  if (!cred || cred.disabled || cred.actorType !== 'PATIENT') {
    await prisma.authOtpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: now },
    }).catch(() => null);

    return json(401, { ok: false, error: 'Code is invalid or expired.' });
  }

  const patientProfile = await prisma.patientProfile
    .findFirst({
      where: { userId: cred.id },
      select: {
        id: true,
        userId: true,
        name: true,
        contactEmail: true,
        mrn: true,
      },
    })
    .catch(() => null);

  const actorRefId = patientProfile?.id ?? null;

  const sess = await prisma.presenceSession
    .create({
      data: {
        userId: cred.id,
        actorType: cred.actorType,
        actorRefId,
        app: 'patient-app',
        lastSeenAt: now,
        ipCountry: null,
        ipCity: null,
        userAgent: ua || undefined,
        meta: ip ? { ip, authMethod: 'email_otp' } : { authMethod: 'email_otp' },
      },
    })
    .catch(() => null);

  await prisma.authOtpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: now, attempts: { increment: 1 } },
  }).catch(() => null);

  await prisma.authCredential.update({
    where: { id: cred.id },
    data: { lastLoginAt: now },
  }).catch(() => null);

  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
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
      sub: cred.id,
      actorType: cred.actorType,
      actorRefId,
      orgId: cred.orgId || process.env.DEFAULT_ORG_ID || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || 'org-default',
      iat,
      exp,
      amr: ['email_otp'],
    },
    secret,
  );

  const res = NextResponse.json(
    {
      ok: true,
      userId: cred.id,
      actorType: cred.actorType,
      actorRefId,
      profile: patientProfile
        ? {
            patientId: patientProfile.id,
            id: patientProfile.id,
            mrn: patientProfile.mrn ?? null,
            userId: patientProfile.userId,
            name: patientProfile.name ?? null,
            email: patientProfile.contactEmail ?? email,
          }
        : null,
    },
    { status: 200 },
  );

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
