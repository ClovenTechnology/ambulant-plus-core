// apps/patient-app/app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SESSION_COOKIE_NAME = 'ambulant_session';

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeEmail(value: unknown) {
  const email = clean(value, 240).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
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
 * Verify HS256 JWT issued by the patient-app login route.
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
    if (typeof payload.exp !== 'number' || payload.exp <= now) return null;

    if (!payload.sub && !payload.uid && !payload.userId) return null;

    if (typeof payload.actorType === 'string' && payload.actorType !== 'PATIENT') {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

async function readPatientProfileSummary(args: {
  userId: string;
  actorRefId: string | null;
}) {
  const userId = clean(args.userId, 180);
  const actorRefId = clean(args.actorRefId, 180);

  if (!userId && !actorRefId) return null;

  try {
    return await prisma.patientProfile.findFirst({
      where: actorRefId ? { id: actorRefId } : { userId },
      select: {
        id: true,
        userId: true,
        mrn: true,
        name: true,
        contactEmail: true,
        phone: true,
        updatedAt: true,
      },
    });
  } catch (error) {
    console.error('[patient-auth-me] profile lookup failed', error);
    return null;
  }
}

export async function GET() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) return json(500, { ok: false, error: 'Missing AUTH_SESSION_SECRET.' });

  const token = cookies().get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return json(401, { ok: false, error: 'Not signed in.' });
  }

  const payload = verifyJwtHs256(token, secret);

  if (!payload) {
    return json(401, { ok: false, error: 'Invalid session.' });
  }

  const userId = clean(payload.sub || payload.userId || payload.uid, 180);
  const actorType = clean(payload.actorType || 'PATIENT', 40) || 'PATIENT';
  const payloadActorRefId = payload.actorRefId ? clean(payload.actorRefId, 180) : null;
  const orgId = clean(payload.orgId || payload.org_id, 120) || null;

  const profile = await readPatientProfileSummary({
    userId,
    actorRefId: payloadActorRefId,
  });

  const actorRefId = payloadActorRefId || profile?.id || null;
  const email =
    normalizeEmail(payload.email || payload.contactEmail) ||
    normalizeEmail(profile?.contactEmail) ||
    null;

  const name =
    clean(payload.name || payload.displayName || profile?.name, 240) || null;

  const displayName =
    clean(payload.displayName || payload.name || profile?.name, 240) || name;

  const profileSummary = profile
    ? {
        id: profile.id,
        patientId: profile.id,
        userId: profile.userId,
        mrn: profile.mrn ?? null,
        name: profile.name ?? null,
        email: profile.contactEmail ?? null,
        contactEmail: profile.contactEmail ?? null,
        phone: profile.phone ?? null,
        updatedAt: profile.updatedAt?.toISOString?.() ?? null,
      }
    : null;

  return json(200, {
    ok: true,

    uid: userId || null,
    userId: userId || null,
    id: userId || null,

    actorType,
    actorRefId,
    patientId: actorRefId,
    orgId,

    email,
    name,
    displayName,

    user: {
      id: userId || null,
      uid: userId || null,
      userId: userId || null,

      actorType,
      actorRefId,
      patientId: actorRefId,
      sid: payload.sid ?? null,
      orgId,

      email,
      name,
      displayName,
      profile: profileSummary,
    },

    profile: profileSummary,

    iat: payload.iat ?? null,
    exp: payload.exp ?? null,
  });
}
