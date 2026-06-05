// apps/clinician-app/app/api/auth/otp/verify/route.ts
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'node:crypto';

import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OTP_PURPOSE = 'clinician_login';

const CLINICIAN_SESSION_COOKIE =
  process.env.CLINICIAN_SESSION_COOKIE || 'ambulant_clinician_session';

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type OtpVerifyBody = {
  email?: string;
  identifier?: string;
  code?: string;
};

type Bucket = { count: number; resetAt: number };
const RL = (globalThis as any).__AMB_CLINICIAN_OTP_VERIFY_RL__ ?? new Map<string, Bucket>();
(globalThis as any).__AMB_CLINICIAN_OTP_VERIFY_RL__ = RL;

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
  const pepper =
    process.env.CLINICIAN_OTP_SECRET ||
    process.env.AUTH_OTP_SECRET ||
    process.env.AUTH_SESSION_SECRET ||
    '';

  if (!pepper) {
    throw new Error('Missing CLINICIAN_OTP_SECRET, AUTH_OTP_SECRET, or AUTH_SESSION_SECRET.');
  }

  return sha256Hex(`${pepper}:${OTP_PURPOSE}:${identifier}:${code}`);
}

function b64urlJson(obj: any) {
  return Buffer.from(JSON.stringify(obj), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function parseObject(raw: unknown) {
  if (!raw) return {};

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, any>;
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, any>)
        : {};
    } catch {
      return {};
    }
  }

  return {};
}

function trainingRedirect(clinicianId: string) {
  return `/training/schedule?clinicianId=${encodeURIComponent(
    clinicianId,
  )}&reason=training_required`;
}

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

export async function POST(req: Request) {
  const h = headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
  const ua = h.get('user-agent') || null;

  let body: OtpVerifyBody = {};

  try {
    body = (await req.json().catch(() => ({}))) as OtpVerifyBody;
  } catch {
    body = {};
  }

  const email = normalizeEmail(body.email || body.identifier || '');
  const code = normalizeCode(body.code || '');

  if (!email || code.length !== 6) {
    return json(400, { ok: false, error: 'Enter the 6-digit sign-in code.' });
  }

  const rlKey = `clinician-otp:verify:${ip}:${email}`;
  if (hitLimit(rlKey, 12, 15 * 60 * 1000)) {
    return json(429, {
      ok: false,
      error: 'Too many verification attempts. Please wait and try again.',
    });
  }

  const now = new Date();

  const challenge = await prisma.authOtpChallenge
    .findFirst({
      where: {
        identifier: email,
        channel: 'email',
        purpose: OTP_PURPOSE,
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
    await prisma.authOtpChallenge
      .update({
        where: { id: challenge.id },
        data: { consumedAt: now },
      })
      .catch(() => null);

    return json(400, { ok: false, error: 'Code is invalid or expired.' });
  }

  const expectedHash = otpHash(email, code);
  const expected = Buffer.from(challenge.codeHash, 'utf8');
  const got = Buffer.from(expectedHash, 'utf8');

  const matches =
    expected.length === got.length && crypto.timingSafeEqual(expected, got);

  if (!matches) {
    await prisma.authOtpChallenge
      .update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      })
      .catch(() => null);

    return json(400, { ok: false, error: 'Code is invalid or expired.' });
  }

  const clinician = await prisma.clinicianProfile
    .findFirst({
      where: {
        OR: [{ email }, { userId: email }],
      } as any,
    })
    .catch(() => null);

  if (!clinician || (clinician as any).disabled || (clinician as any).archived) {
    await prisma.authOtpChallenge
      .update({
        where: { id: challenge.id },
        data: { consumedAt: now },
      })
      .catch(() => null);

    return json(401, { ok: false, error: 'Code is invalid or expired.' });
  }

  await prisma.authOtpChallenge
    .update({
      where: { id: challenge.id },
      data: { consumedAt: now, attempts: { increment: 1 } },
    })
    .catch(() => null);

  const clinicianAny = clinician as any;
  const meta = parseObject(clinicianAny.metadata ?? clinicianAny.meta ?? null);
  const profileJson = parseObject(meta.rawProfile ?? meta.rawProfileJson ?? null);

  const status = String(clinicianAny.status || 'pending').toLowerCase();
  const visibleToPatients = status === 'active';
  const canPractice = status === 'active';

  const profile = {
    id: clinicianAny.id,
    userId: clinicianAny.userId,
    name: clinicianAny.displayName,
    email,
    status,
    specialty: clinicianAny.specialty,
    canPractice,
    visibleToPatients,
    onboarding: profileJson?.onboarding ?? null,
    hpcsaPracticeNumber:
      profileJson?.hpcsaPracticeNumber ??
      profileJson?.hpcsaRegistrationNumber ??
      clinicianAny.regulatorRegistration ??
      null,
    hpcsaNextRenewalDate: profileJson?.hpcsaNextRenewalDate ?? null,
    insurerName: meta?.insurerName ?? profileJson?.insurerName ?? null,
    insuranceType: meta?.insuranceType ?? profileJson?.insuranceType ?? null,
  };

  const issuedAt = Date.now();

  const sessionPayload = {
    sub: clinicianAny.id,
    role: 'clinician',
    clinicianId: clinicianAny.id,
    email,
    name: clinicianAny.displayName ?? 'Clinician',
    status,
    canPractice,
    visibleToPatients,
    issuedAt,
    expiresAt: issuedAt + SESSION_MAX_AGE_SECONDS * 1000,
    amr: ['email_otp'],
  };

  const res = json(200, {
    ok: true,
    token: `otp-${clinicianAny.id}-${issuedAt}`,
    profile,
    redirectTo: canPractice ? undefined : trainingRedirect(clinicianAny.id),
  });

  res.cookies.set(CLINICIAN_SESSION_COOKIE, b64urlJson(sessionPayload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return res;
}
