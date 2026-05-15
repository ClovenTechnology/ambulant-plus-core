// apps/clinician-app/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function normEmail(v: any) {
  return String(v || '').trim().toLowerCase();
}

async function getAuth0MgmtToken() {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;

  if (!domain || !clientId || !clientSecret) {
    return null;
  }

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

  if (!tokenRes.ok) {
    return null;
  }

  const tokenData = await tokenRes.json().catch(() => null);

  return tokenData?.access_token ? String(tokenData.access_token) : null;
}

async function auth0UserIdByEmail(email: string): Promise<string | null> {
  const domain = process.env.AUTH0_DOMAIN;
  const mgmtToken = await getAuth0MgmtToken();

  if (!domain || !mgmtToken) {
    return null;
  }

  const res = await fetch(
    `https://${domain}/api/v2/users-by-email?email=${encodeURIComponent(email)}`,
    {
      headers: {
        Authorization: `Bearer ${mgmtToken}`,
      },
    },
  );

  if (!res.ok) {
    return null;
  }

  const arr = await res.json().catch(() => null);
  const user = Array.isArray(arr) ? arr[0] : null;

  return user?.user_id ? String(user.user_id) : null;
}

/**
 * Optional password verification.
 *
 * Required env vars:
 * - AUTH0_ROPG_CLIENT_ID
 * - AUTH0_ROPG_CLIENT_SECRET
 * - AUTH0_DOMAIN
 * - AUTH0_DB_CONNECTION optional, defaults to Username-Password-Authentication
 */
async function verifyPasswordAuth0(
  email: string,
  password: string,
): Promise<{ ok: boolean; token?: string }> {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_ROPG_CLIENT_ID;
  const clientSecret = process.env.AUTH0_ROPG_CLIENT_SECRET;
  const realm = process.env.AUTH0_DB_CONNECTION || 'Username-Password-Authentication';

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

  if (!res.ok) {
    return { ok: false };
  }

  const data = await res.json().catch(() => null);
  const token = data?.id_token || data?.access_token;

  return token ? { ok: true, token: String(token) } : { ok: true };
}

function parseRawProfileJson(raw: unknown) {
  if (!raw || typeof raw !== 'string') {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return json({ ok: false, error: 'Invalid request body' }, 400);
    }

    const email = normEmail((body as any).email);
    const password = String((body as any).password || '');

    if (!email) {
      return json({ ok: false, error: 'Email required' }, 400);
    }

    if (!password) {
      return json({ ok: false, error: 'Password required' }, 400);
    }

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
        userId: email,
      },
    });

    if (!clinician) {
      const auth0Id = await auth0UserIdByEmail(email);

      if (auth0Id) {
        clinician = await prisma.clinicianProfile.findFirst({
          where: {
            userId: auth0Id,
          },
        });
      }
    }

    if (!clinician) {
      return json({ ok: false, error: 'Invalid email or password' }, 401);
    }

    /**
     * Current Prisma ClinicianProfile type does not expose a `metadata` relation.
     * Keep this optional so the route compiles and remains compatible if metadata
     * is added later as a JSON field/relation.
     */
    const clinicianAny = clinician as any;
    const metadata = clinicianAny.metadata ?? null;
    const profileJson = parseRawProfileJson(metadata?.rawProfileJson);

    const status = clinician.status || 'pending';
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

      onboarding: (profileJson as any)?.onboarding ?? null,

      hpcsaPracticeNumber: (profileJson as any)?.hpcsaPracticeNumber ?? null,
      hpcsaNextRenewalDate: (profileJson as any)?.hpcsaNextRenewalDate ?? null,
      insurerName: metadata?.insurerName ?? (profileJson as any)?.insurerName ?? null,
      insuranceType: metadata?.insuranceType ?? (profileJson as any)?.insuranceType ?? null,
    };

    return json({
      ok: true,
      token,
      profile,
    });
  } catch (err: any) {
    console.error('clinician login error', err);

    return json(
      {
        ok: false,
        error: err?.message || 'Login failed',
      },
      500,
    );
  }
}