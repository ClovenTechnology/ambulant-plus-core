// apps/clinician-app/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CLINICIAN_SESSION_COOKIE =
  process.env.CLINICIAN_SESSION_COOKIE || 'ambulant_clinician_session';

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
}

function normEmail(v: any) {
  return String(v || '').trim().toLowerCase();
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

async function getAuth0MgmtToken() {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;

  if (!domain || !clientId || !clientSecret) return null;

  const tokenRes = await fetch(`https://${domain}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      audience: `https://${domain}/api/v2/`,
      grant_type: 'client_credentials',
    }),
  });

  if (!tokenRes.ok) return null;

  const tokenData = await tokenRes.json().catch(() => null);

  return tokenData?.access_token ? String(tokenData.access_token) : null;
}

async function auth0UserIdByEmail(email: string): Promise<string | null> {
  const domain = process.env.AUTH0_DOMAIN;
  const mgmtToken = await getAuth0MgmtToken();

  if (!domain || !mgmtToken) return null;

  const res = await fetch(
    `https://${domain}/api/v2/users-by-email?email=${encodeURIComponent(email)}`,
    {
      headers: {
        Authorization: `Bearer ${mgmtToken}`,
      },
    },
  );

  if (!res.ok) return null;

  const arr = await res.json().catch(() => null);
  const user = Array.isArray(arr) ? arr[0] : null;

  return user?.user_id ? String(user.user_id) : null;
}

async function verifyPasswordAuth0(
  email: string,
  password: string,
): Promise<{ ok: boolean; token?: string }> {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_ROPG_CLIENT_ID;
  const clientSecret = process.env.AUTH0_ROPG_CLIENT_SECRET;
  const realm =
    process.env.AUTH0_DB_CONNECTION || 'Username-Password-Authentication';

  if (!domain || !clientId || !clientSecret) {
    return { ok: false };
  }

  const res = await fetch(`https://${domain}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'http://auth0.com/oauth/grant-type/password-realm',
      realm,
      username: email,
      password,
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'openid profile email',
    }),
  });

  if (!res.ok) return { ok: false };

  const data = await res.json().catch(() => null);
  const token = data?.id_token || data?.access_token;

  return token ? { ok: true, token: String(token) } : { ok: true };
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

    const auth0 = await verifyPasswordAuth0(email, password);

    if (
      process.env.AUTH0_ROPG_CLIENT_ID &&
      process.env.AUTH0_ROPG_CLIENT_SECRET &&
      !auth0.ok
    ) {
      return json({ ok: false, error: 'Invalid email or password' }, 401);
    }

    let clinician = await prisma.clinicianProfile.findFirst({
      where: {
        OR: [{ userId: email }, { email } as any],
      } as any,
    });

    if (!clinician) {
      const auth0Id = await auth0UserIdByEmail(email);

      if (auth0Id) {
        clinician = await prisma.clinicianProfile.findFirst({
          where: {
            OR: [{ userId: auth0Id }, { id: auth0Id } as any],
          } as any,
        });
      }
    }

    if (!clinician) {
      return json({ ok: false, error: 'Invalid email or password' }, 401);
    }

    const clinicianAny = clinician as any;
    const meta = parseObject(clinicianAny.metadata ?? clinicianAny.meta ?? null);
    const profileJson = parseObject(meta.rawProfile ?? meta.rawProfileJson ?? null);

    const status = String(clinician.status || 'pending').toLowerCase();
    const visibleToPatients = status === 'active';
    const canPractice = status === 'active';

    const token = auth0.token || `dev-${clinician.id}-${Date.now()}`;

    const profile = {
      id: clinician.id,
      userId: clinician.userId,
      name: clinician.displayName,
      email,
      status,
      specialty: clinician.specialty,
      canPractice,
      visibleToPatients,
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
      issuedAt: now,
      expiresAt: now + SESSION_MAX_AGE_SECONDS * 1000,
    };

    const res = json({
      ok: true,
      token,
      profile,
      redirectTo: canPractice ? undefined : trainingRedirect(clinician.id),
    });

    res.cookies.set(CLINICIAN_SESSION_COOKIE, b64urlJson(sessionPayload), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

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

