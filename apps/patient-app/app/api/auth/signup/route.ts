// apps/patient-app/app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type JsonPayload = {
  name?: string;
  email?: string;
  password?: string;
  dob?: string;
  gender?: string;
  phone?: string;
  address?: string;
  emergencyContact?: { name?: string; phone?: string };
  bloodType?: string;
  allergies?: string[];
  chronicConditions?: string[];
};

// Helper: respond JSON
function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

// Try to read JSON OR form-data (multipart)
async function parseRequest(req: NextRequest): Promise<{ payload: JsonPayload; avatar?: File | null }> {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    // Next.js Request supports formData() on the server
    const fd = await req.formData();
    const payloadRaw = fd.get('payload') as FormDataEntryValue | null;
    let payload: JsonPayload = {};
    if (payloadRaw && typeof payloadRaw === 'string') {
      try { payload = JSON.parse(payloadRaw); } catch { payload = {}; }
    } else if (payloadRaw && typeof payloadRaw === 'object' && (payloadRaw as any).toString) {
      // unlikely, but guard
      try { payload = JSON.parse(String(payloadRaw)); } catch {}
    }

    const avatar = fd.get('avatar') as File | null;
    return { payload, avatar };
  } else {
    // assume JSON
    try {
      const body = await req.json();
      return { payload: body as JsonPayload, avatar: null };
    } catch {
      return { payload: {}, avatar: null };
    }
  }
}

async function createAuth0User(email: string, password: string, name?: string) {
  const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
  const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID;
  const AUTH0_CLIENT_SECRET = process.env.AUTH0_CLIENT_SECRET;
  // Minimal checks
  if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID || !AUTH0_CLIENT_SECRET) {
    throw new Error('Auth0 config missing');
  }

  // 1) get management token
  const tokenRes = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: AUTH0_CLIENT_ID,
      client_secret: AUTH0_CLIENT_SECRET,
      audience: `https://${AUTH0_DOMAIN}/api/v2/`,
    }),
  });
  if (!tokenRes.ok) {
    const ttxt = await tokenRes.text().catch(() => '');
    throw new Error(`Auth0 token error: ${tokenRes.status} ${ttxt}`);
  }
  const tokenJson = await tokenRes.json();
  const mgmtToken = tokenJson.access_token;

  // 2) create user
  // NOTE: adjust connection name to your tenant (often "Username-Password-Authentication")
  const createRes = await fetch(`https://${AUTH0_DOMAIN}/api/v2/users`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${mgmtToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      email,
      name,
      connection: process.env.AUTH0_DB_CONNECTION || 'Username-Password-Authentication',
      password,
      email_verified: false, // recommend sending a verification email separately
      user_metadata: { createdBy: 'ambulant-signup' },
    }),
  });

  if (!createRes.ok) {
    const txt = await createRes.text().catch(() => '');
    throw new Error(`Auth0 create user failed: ${createRes.status} ${txt}`);
  }
  const created = await createRes.json();
  return created; // returns the Auth0 user object
}

export async function POST(req: NextRequest) {
  try {
    const { payload, avatar } = await parseRequest(req);
    // Required: email + password (password optional if you plan SSO-only)
    const email = payload.email?.trim();
    const password = payload.password || '';
    const name = payload.name || '';

    if (!email) return json({ error: 'Missing email' }, 400);
    if (!password || password.length < 6) {
      // if your flow allows passwordless, adapt this check
      return json({ error: 'Password must be provided and >= 6 chars' }, 400);
    }

    // Try Auth0 if configured
    try {
      if (process.env.AUTH0_DOMAIN && process.env.AUTH0_CLIENT_ID && process.env.AUTH0_CLIENT_SECRET) {
        const created = await createAuth0User(email, password, name);
        // Optionally: store avatar somewhere (S3) and user profile in your DB
        return json({ ok: true, userId: created.user_id || created.sub || created._id });
      }
    } catch (err: any) {
      // if Auth0 fails, log and continue to fallback stub (but if you want to fail hard, return error)
      console.error('Auth0 signup failed:', err?.message || err);
      // fall through to stub fallback
    }

    // Fallback dev stub: create a lightweight local user id
    const userId = `local:${randomUUID()}`;
    // Optionally persist to your datastore here
    // // TODO: write to DB or call your gateway
    return json({ ok: true, userId });
  } catch (err: any) {
    console.error('signup route error', err);
    return json({ error: err?.message || 'signup failed' }, 500);
  }
}
