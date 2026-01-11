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

  const res = await fetch(`https://${domain}/api/v2/users-by-email?email=${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${mgmtToken}` },
  });
  if (!res.ok) return null;
  const arr = await res.json().catch(() => null);
  const u = Array.isArray(arr) ? arr[0] : null;
  return u?.user_id ? String(u.user_id) : null;
}

/**
 * Optional password verification (recommended):
 * Set these env vars:
 * - AUTH0_ROPG_CLIENT_ID
 * - AUTH0_ROPG_CLIENT_SECRET
 * - AUTH0_DOMAIN
 * - AUTH0_DB_CONNECTION (optional, default Username-Password-Authentication)
 */
async function verifyPasswordAuth0(email: string, password: string): Promise<{ ok: boolean; token?: string }> {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_ROPG_CLIENT_ID;
  const clientSecret = process.env.AUTH0_ROPG_CLIENT_SECRET;
  const realm = process.env.AUTH0_DB_CONNECTION || 'Username-Password-Authentication';

  if (!domain || !clientId || !clientSecret) return { ok: false };

  // Password realm grant (must be enabled on the Auth0 tenant)
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
    if (!body || typeof body !== 'object') return json({ ok: false, error: 'Invalid request body' }, 400);

    const email = normEmail(body.email);
    const password = String(body.password || '');

    if (!email) return json({ ok: false, error: 'Email required' }, 400);
    if (!password) return json({ ok: false, error: 'Password required' }, 400);

    // Verify password via Auth0 if configured; otherwise scaffold mode.
    const auth0 = await verifyPasswordAuth0(email, password);
    // If Auth0 is configured but rejects password, fail hard.
    if (process.env.AUTH0_ROPG_CLIENT_ID && process.env.AUTH0_ROPG_CLIENT_SECRET && !auth0.ok) {
      return json({ ok: false, error: 'Invalid email or password' }, 401);
    }

    // Find clinician profile by email userId OR by Auth0 user_id fallback
    let clinician = await prisma.clinicianProfile.findFirst({
      where: { userId: email },
      include: { metadata: true },
    });

    if (!clinician) {
      const auth0Id = await auth0UserIdByEmail(email);
      if (auth0Id) {
        clinician = await prisma.clinicianProfile.findFirst({
          where: { userId: auth0Id },
          include: { metadata: true },
        });
      }
    }

    if (!clinician) {
      // Do not leak “exists/doesn’t exist” too loudly
      return json({ ok: false, error: 'Invalid email or password' }, 401);
    }

    let profileJson: any = {};
    if (clinician.metadata?.rawProfileJson) {
      try {
        profileJson = JSON.parse(clinician.metadata.rawProfileJson);
      } catch {
        profileJson = {};
      }
    }

    // Status gating:
    // - Clinicians may log in while pending/onboarding.
    // - They become visible to patients only after admin certification sets status 'active' (or your chosen flag).
    const status = clinician.status || 'pending';
    const visibleToPatients = status === 'active';
    const canPractice = status === 'active'; // you can broaden to 'certified' if you add that status later

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

      // Useful onboarding payload (captured at signup)
      onboarding: profileJson?.onboarding ?? null,

      // compliance bits
      hpcsaPracticeNumber: profileJson?.hpcsaPracticeNumber ?? null,
      hpcsaNextRenewalDate: profileJson?.hpcsaNextRenewalDate ?? null,
      insurerName: clinician.metadata?.insurerName ?? profileJson?.insurerName ?? null,
      insuranceType: clinician.metadata?.insuranceType ?? profileJson?.insuranceType ?? null,
    };

    // Let client decide route; but you can nudge with redirectTo later.
    return json({ ok: true, token, profile });
  } catch (err: any) {
    console.error('clinician login error', err);
    return json({ ok: false, error: err?.message || 'Login failed' }, 500);
  }
}
