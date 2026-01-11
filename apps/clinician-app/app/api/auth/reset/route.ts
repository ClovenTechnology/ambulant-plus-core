// apps/clinician-app/app/api/auth/reset/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function unb64url(s: string) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64');
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

async function auth0FindUserByEmail(email: string) {
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

async function auth0SetPassword(userId: string, newPassword: string) {
  const domain = process.env.AUTH0_DOMAIN;
  const mgmtToken = await getAuth0MgmtToken();
  if (!domain || !mgmtToken) return false;

  const res = await fetch(`https://${domain}/api/v2/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${mgmtToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ password: newPassword }),
  });
  return res.ok;
}

function verifyToken(token: string): { ok: true; email: string } | { ok: false; error: string } {
  const secret = process.env.AUTH_RESET_SECRET || process.env.AUTH_SECRET || 'dev-reset-secret';

  let decoded = '';
  try {
    decoded = unb64url(token).toString('utf8');
  } catch {
    return { ok: false, error: 'Invalid token' };
  }

  const parts = decoded.split('|');
  if (parts.length < 4) return { ok: false, error: 'Invalid token' };

  const email = String(parts[0] || '').trim().toLowerCase();
  const expMs = Number(parts[1] || 0);
  const nonce = String(parts[2] || '');
  const sig = String(parts[3] || '');

  if (!email || !expMs || !nonce || !sig) return { ok: false, error: 'Invalid token' };
  if (Date.now() > expMs) return { ok: false, error: 'Token expired. Request a new reset link.' };

  const payload = `${email}|${expMs}|${nonce}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
    return { ok: false, error: 'Invalid token' };
  }

  return { ok: true, email };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || '');
    const newPassword = String(body.newPassword || '');

    if (!token) return json({ ok: false, message: 'Missing token' }, 400);
    if (!newPassword || newPassword.length < 8) return json({ ok: false, message: 'Password must be at least 8 characters' }, 400);

    const v = verifyToken(token);
    if (!v.ok) return json({ ok: false, message: v.error }, 400);

    // Auth0 required for real password change in this scaffold
    const userId = await auth0FindUserByEmail(v.email);
    if (!userId) {
      // keep generic response
      return json({ ok: true, message: 'If the account exists, password was updated.' });
    }

    const ok = await auth0SetPassword(userId, newPassword);
    if (!ok) return json({ ok: false, message: 'Could not update password. Please try again.' }, 500);

    return json({ ok: true, message: 'Password updated' });
  } catch (err: any) {
    console.error('reset error', err);
    return json({ ok: false, message: 'Reset failed' }, 500);
  }
}
