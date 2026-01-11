//apps/patient-app/app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
}

function base64urlToBuffer(s: string) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

function safeJsonParse(buf: Buffer) {
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Verify HS256 JWT (minimal, no deps)
 * Returns payload if valid and not expired; otherwise null.
 */
function verifyJwtHs256(token: string, secret: string): any | null {
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
    if (typeof payload.exp === 'number' && payload.exp <= now) return null;

    return payload;
  } catch {
    return null;
  }
}

const COOKIE_CANDIDATES = [
  '__Host-ambulant_session',
  'ambulant_session',
  'ambulant.session',
  'auth_session',
  'session',
  'token',
];

export async function GET() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) return json(500, { ok: false, error: 'Missing AUTH_SESSION_SECRET.' });

  const jar = cookies();

  let token = '';
  for (const name of COOKIE_CANDIDATES) {
    const v = jar.get(name)?.value;
    if (v) {
      token = v;
      break;
    }
  }

  if (!token) return json(401, { ok: false, error: 'Not signed in.' });

  const payload = verifyJwtHs256(token, secret);
  if (!payload) return json(401, { ok: false, error: 'Invalid session.' });

  const userId = String(payload.sub || payload.userId || payload.uid || '');
  const actorType = String(payload.actorType || payload.role || '');
  const actorRefId = payload.actorRefId ? String(payload.actorRefId) : null;

  return json(200, {
    ok: true,
    user: {
      id: userId || null,
      actorType: actorType || null,
      actorRefId,
      sid: payload.sid ?? null,
      orgId: payload.orgId ?? null,
    },
    iat: payload.iat ?? null,
    exp: payload.exp ?? null,
  });
}
