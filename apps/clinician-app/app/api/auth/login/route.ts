// apps/clinician-app/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { prisma } from '@/src/lib/prisma';
import {
  CLINICIAN_SESSION_COOKIE,
  CLINICIAN_SESSION_MAX_AGE_SECONDS,
  signClinicianSessionToken,
} from '@/src/lib/clinician-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
}

function normEmail(v: any) {
  return String(v || '').trim().toLowerCase();
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

function base64urlToBuffer(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;

  try {
    const pad =
      value.length % 4 === 0
        ? ''
        : '='.repeat(4 - (value.length % 4));
    const base64 = (value + pad)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    return Buffer.from(base64, 'base64');
  }
  catch {
    return null;
  }
}

function bufferToBase64url(value: Buffer) {
  return value
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

type ParsedScryptHash = {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  expected: Buffer;
  compactLegacyHash: boolean;
};

function saneScryptParameters(
  N: number,
  r: number,
  p: number,
) {
  return (
    Number.isInteger(N) &&
    N >= 1024 &&
    N <= 65536 &&
    (N & (N - 1)) === 0 &&
    Number.isInteger(r) &&
    r >= 1 &&
    r <= 32 &&
    Number.isInteger(p) &&
    p >= 1 &&
    p <= 16
  );
}

function parseScryptHash(
  stored: string,
): ParsedScryptHash | null {
  const value = String(stored || '').trim();
  const parts = value.split('$');

  if (parts.length === 6 && parts[0] === 'scrypt') {
    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    const salt = base64urlToBuffer(parts[4]);
    const expected = base64urlToBuffer(parts[5]);

    if (
      !saneScryptParameters(N, r, p) ||
      !salt ||
      salt.length < 8 ||
      salt.length > 64 ||
      !expected ||
      expected.length < 32 ||
      expected.length > 128
    ) {
      return null;
    }

    return {
      N,
      r,
      p,
      salt,
      expected,
      compactLegacyHash: false,
    };
  }

  const compact =
    /^scrypt1638481([A-Za-z0-9_-]{22})([A-Za-z0-9_-]{86})$/.exec(
      value,
    );

  if (!compact) return null;

  const salt = base64urlToBuffer(compact[1]);
  const expected = base64urlToBuffer(compact[2]);

  if (
    !salt ||
    salt.length !== 16 ||
    !expected ||
    expected.length !== 64
  ) {
    return null;
  }

  return {
    N: 16384,
    r: 8,
    p: 1,
    salt,
    expected,
    compactLegacyHash: true,
  };
}

async function verifyPasswordScrypt(
  password: string,
  stored: string,
) {
  const parsed = parseScryptHash(stored);
  if (!parsed) return null;

  try {
    const derived = await new Promise<Buffer>(
      (resolve, reject) => {
        crypto.scrypt(
          password,
          parsed.salt,
          parsed.expected.length,
          {
            N: parsed.N,
            r: parsed.r,
            p: parsed.p,
            maxmem: 128 * 1024 * 1024,
          },
          (error, key) => {
            if (error) reject(error);
            else resolve(key as Buffer);
          },
        );
      },
    );

    const ok =
      derived.length === parsed.expected.length &&
      crypto.timingSafeEqual(
        derived,
        parsed.expected,
      );

    return ok
      ? {
          compactLegacyHash:
            parsed.compactLegacyHash,
        }
      : null;
  }
  catch {
    return null;
  }
}

async function hashPasswordScrypt(
  password: string,
) {
  const salt = crypto.randomBytes(16);
  const N = 16384;
  const r = 8;
  const p = 1;
  const keyLength = 64;

  const hash = await new Promise<Buffer>(
    (resolve, reject) => {
      crypto.scrypt(
        password,
        salt,
        keyLength,
        {
          N,
          r,
          p,
          maxmem: 128 * 1024 * 1024,
        },
        (error, key) => {
          if (error) reject(error);
          else resolve(key as Buffer);
        },
      );
    },
  );

  return (
    'scrypt$' +
    N +
    '$' +
    r +
    '$' +
    p +
    '$' +
    bufferToBase64url(salt) +
    '$' +
    bufferToBase64url(hash)
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return json({ ok: false, error: 'Invalid request body' }, 400);
    }

    const email = normEmail((body as any).email);
    const password = String((body as any).password || '');

    if (!email) return json({ ok: false, error: 'Email required' }, 400);
    if (!password) return json({ ok: false, error: 'Password required' }, 400);

    const credential =
      await prisma.authCredential
        .findUnique({
          where: { email },
        })
        .catch(() => null);

    const passwordResult =
      credential && !credential.disabled
        ? await verifyPasswordScrypt(
            password,
            credential.passwordHash,
          )
        : null;

    if (!credential || !passwordResult) {
      return json(
        {
          ok: false,
          error: 'Invalid email or password',
        },
        401,
      );
    }

    let clinician =
      await prisma.clinicianProfile.findFirst({
        where: {
          OR: [
            { userId: email },
            { userId: credential.id },
            { email } as any,
          ],
        } as any,
      });

    if (!clinician) {
      return json({ ok: false, error: 'Invalid email or password' }, 401);
    }

    const credentialUpdate =
      passwordResult.compactLegacyHash
        ? {
            passwordHash:
              await hashPasswordScrypt(
                password,
              ),
            lastLoginAt: new Date(),
          }
        : {
            lastLoginAt: new Date(),
          };

    await prisma.authCredential
      .update({
        where: { id: credential.id },
        data: credentialUpdate,
      })
      .catch(() => null);

    const clinicianAny = clinician as any;
    const meta = parseObject(clinicianAny.metadata ?? clinicianAny.meta ?? null);
    const profileJson = parseObject(meta.rawProfile ?? meta.rawProfileJson ?? null);

    const status = String(clinician.status || 'pending').toLowerCase();

    const onboardingStage = String(profileJson?.onboarding?.stage || '').toLowerCase();
    const trainingStatus = String(profileJson?.training?.status || '').toLowerCase();
    const trainingCertificate = parseObject(profileJson?.trainingCertificate ?? meta?.trainingCertificate ?? null);

    const additionalQualifications = Array.isArray(profileJson?.additionalQualifications)
      ? profileJson.additionalQualifications
      : [];

    const hasTrainingQualification = additionalQualifications.some(
      (q: any) =>
        String(q?.degree || '').trim() === 'Ambulant+ Mandatory Clinician Training' &&
        Boolean(q?.certificateNumber || q?.completedAt),
    );

    const trainingCompleted =
      clinicianAny.trainingCompleted === true ||
      onboardingStage === 'training_completed' ||
      trainingStatus === 'completed' ||
      Boolean(profileJson?.training?.certificateNumber && profileJson?.training?.completedAt) ||
      Boolean(trainingCertificate?.certificateNumber && (trainingCertificate?.completedAt || trainingCertificate?.issuedAt)) ||
      hasTrainingQualification;

    const visibleToPatients = status === 'active';
    const simulationMode = trainingCompleted && !visibleToPatients;
    const canPractice = visibleToPatients || simulationMode;

    const token = 'session-established';

    const profile = {
      id: clinician.id,
      userId: clinician.userId,
      name: clinician.displayName,
      email,
      status,
      specialty: clinician.specialty,
      canPractice,
      visibleToPatients,
      trainingCompleted,
      simulationMode,
      onboarding: profileJson?.onboarding ?? null,
      hpcsaPracticeNumber: profileJson?.hpcsaPracticeNumber ?? null,
      hpcsaNextRenewalDate: profileJson?.hpcsaNextRenewalDate ?? null,
      insurerName: meta?.insurerName ?? profileJson?.insurerName ?? null,
      insuranceType: meta?.insuranceType ?? profileJson?.insuranceType ?? null,
    };

    const now = Date.now();
    const sessionPayload = {
      sub: clinician.id,
      role: 'clinician',
      clinicianId: clinician.id,
      email,
      name: clinician.displayName ?? 'Clinician',
      status,
      canPractice,
      visibleToPatients,
      trainingCompleted,
      simulationMode,
      issuedAt: now,
      expiresAt:
        now +
        CLINICIAN_SESSION_MAX_AGE_SECONDS * 1000,
    };

    const sessionToken =
      signClinicianSessionToken(sessionPayload);

    const res = json({
      ok: true,
      token,
      profile,
      redirectTo: canPractice ? undefined : trainingRedirect(clinician.id),
    });

    res.cookies.set(
      CLINICIAN_SESSION_COOKIE,
      sessionToken,
      {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
        maxAge:
          CLINICIAN_SESSION_MAX_AGE_SECONDS,
      },
    );

    return res;
  } catch (err: any) {
    console.error('clinician login error', err);

    return json(
      {
        ok: false,
        error: 'Unable to sign you in right now. Please try again shortly.',
      },
      500,
    );
  }
}
