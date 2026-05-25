// apps/patient-app/app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { PrismaClient, PresenceActorType } from '@prisma/client';

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
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  idNumber?: string;
  allergies?: string[];
  redirectTo?: string;
};

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
}

async function parseRequest(req: NextRequest): Promise<{ payload: JsonPayload; avatar?: File | null }> {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const fd = await req.formData();
    const payloadRaw = fd.get('payload') as FormDataEntryValue | null;

    let payload: JsonPayload = {};
    if (payloadRaw && typeof payloadRaw === 'string') {
      try {
        payload = JSON.parse(payloadRaw);
      } catch {
        payload = {};
      }
    }

    const avatar = fd.get('avatar') as File | null;
    return { payload, avatar };
  }

  try {
    const body = await req.json();
    return { payload: body as JsonPayload, avatar: null };
  } catch {
    return { payload: {}, avatar: null };
  }
}

function normalizeEmail(v: string) {
  return String(v || '').trim().toLowerCase();
}

function looksLikeEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isStrongPassword(pw: string) {
  return (
    typeof pw === 'string' &&
    pw.length >= 8 &&
    /[A-Z]/.test(pw) &&
    /[a-z]/.test(pw) &&
    /[0-9]/.test(pw) &&
    /[^A-Za-z0-9]/.test(pw)
  );
}

function cleanString(value: unknown, max = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function nullableString(value: unknown, max = 500) {
  const out = cleanString(value, max);
  return out || null;
}

function normalizeGender(value: unknown) {
  const raw = cleanString(value, 40).toLowerCase();
  if (!raw) return null;
  if (['female', 'f', 'woman'].includes(raw)) return 'female';
  if (['male', 'm', 'man'].includes(raw)) return 'male';
  if (['other', 'non_binary', 'non-binary', 'prefer_not', 'prefer-not-to-say', 'prefer_not_to_say'].includes(raw)) return raw.replace(/-/g, '_');
  return cleanString(value, 40);
}

function dateOnlyToDate(value: unknown) {
  const raw = cleanString(value, 32);
  if (!raw) return null;

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return null;

  const d = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  if (d > new Date()) return null;

  const year = Number(m[1]);
  if (year < 1900) return null;

  return d;
}

function safeInternalPath(p: unknown, fallback = '/') {
  const v = String(p || '').trim();
  if (v.startsWith('/') && !v.startsWith('//')) return v;
  return fallback;
}

function base64urlToBuffer(s: string) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

function bufferToBase64url(buf: Buffer) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function b64urlJson(obj: any) {
  return bufferToBase64url(Buffer.from(JSON.stringify(obj), 'utf8'));
}

function signJwtHs256(payload: any, secret: string) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const h = b64urlJson(header);
  const p = b64urlJson(payload);
  const data = `${h}.${p}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest();
  return `${data}.${bufferToBase64url(sig)}`;
}

async function hashPasswordScrypt(password: string) {
  const salt = crypto.randomBytes(16);
  const N = 16384;
  const r = 8;
  const p = 1;
  const keyLen = 64;

  const hash = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, keyLen, { N, r, p }, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });

  return `scrypt$${N}$${r}$${p}$${bufferToBase64url(salt)}$${bufferToBase64url(hash)}`;
}

function generateMrnCandidate(now = new Date()) {
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const suffix = crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
  return `AMB-${yy}${mm}-${suffix}`;
}

async function generateUniqueMrn(tx: any) {
  for (let i = 0; i < 12; i += 1) {
    const mrn = generateMrnCandidate();
    const existing = await tx.patientProfile
      .findUnique({ where: { mrn }, select: { id: true } })
      .catch(() => null);

    if (!existing) return mrn;
  }

  throw new Error('Unable to allocate a unique patient MRN. Please try again.');
}

// Prisma singleton
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function POST(req: NextRequest) {
  try {
    const { payload } = await parseRequest(req);

    const email = normalizeEmail(payload.email || '');
    const password = String(payload.password || '');
    const name = cleanString(payload.name, 180) || null;
    const dob = dateOnlyToDate(payload.dob);
    const gender = normalizeGender(payload.gender);
    const phone = nullableString(payload.phone, 80);
    const addressLine1 = nullableString(payload.addressLine1 ?? payload.address, 240);
    const addressLine2 = nullableString(payload.addressLine2, 240);
    const city = nullableString(payload.city, 120);
    const postalCode = nullableString(payload.postalCode, 40);
    const idNumber = nullableString(payload.idNumber, 120);
    const redirectTo = safeInternalPath(payload.redirectTo, '/');

    if (!email || !looksLikeEmail(email)) return json({ ok: false, error: 'Valid email is required.' }, 400);
    if (!name) return json({ ok: false, error: 'Full name is required.' }, 400);
    if (!dob) return json({ ok: false, error: 'A valid date of birth is required.' }, 400);
    if (!gender) return json({ ok: false, error: 'Gender is required.' }, 400);
    if (!addressLine1) return json({ ok: false, error: 'Address line 1 is required.' }, 400);
    if (!city) return json({ ok: false, error: 'City is required.' }, 400);

    if (!isStrongPassword(password)) {
      return json(
        {
          ok: false,
          error: 'Password must be 8+ chars and include uppercase, lowercase, a number, and a symbol.',
        },
        400,
      );
    }

    const existing = await prisma.authCredential.findUnique({ where: { email } }).catch(() => null);
    if (existing) return json({ ok: false, error: 'An account with this email already exists.' }, 409);

    const passwordHash = await hashPasswordScrypt(password);
    const orgId = process.env.DEFAULT_ORG_ID || 'org-default';
    const now = new Date();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
    const ua = req.headers.get('user-agent') || null;

    const created = await prisma.$transaction(async (tx) => {
      const cred = await tx.authCredential.create({
        data: {
          email,
          passwordHash,
          actorType: PresenceActorType.PATIENT,
          disabled: false,
          orgId,
        },
      });

      const mrn = await generateUniqueMrn(tx);

      const patientProfile = await tx.patientProfile.create({
        data: {
          userId: cred.id,
          mrn,
          name,
          contactEmail: email,
          phone: phone || undefined,
          dob,
          gender,
          idNumber: idNumber || undefined,
          addressLine1,
          addressLine2: addressLine2 || undefined,
          city,
          postalCode: postalCode || undefined,
          allergies: Array.isArray(payload.allergies) ? payload.allergies.filter(Boolean).join(', ') : undefined,
        },
      });

      const sess = await tx.presenceSession
        .create({
          data: {
            userId: cred.id,
            actorType: cred.actorType,
            actorRefId: patientProfile.id,
            app: 'patient-app',
            lastSeenAt: now,
            ipCountry: null,
            ipCity: null,
            userAgent: ua || undefined,
            meta: ip ? { ip } : undefined,
          },
        })
        .catch(() => null);

      await tx.authCredential.update({ where: { id: cred.id }, data: { lastLoginAt: now } }).catch(() => null);

      return { cred, patientProfile, sessionId: sess?.id || null };
    });

    const profile = {
      patientId: created.patientProfile.id,
      id: created.patientProfile.id,
      userId: created.cred.id,
      mrn: created.patientProfile.mrn,
      name: created.patientProfile.name ?? null,
      email: created.patientProfile.contactEmail ?? email,
      contactEmail: created.patientProfile.contactEmail ?? email,
      phone: created.patientProfile.phone ?? null,
      dob: created.patientProfile.dob?.toISOString().slice(0, 10) ?? null,
      gender: created.patientProfile.gender ?? null,
      addressLine1: created.patientProfile.addressLine1 ?? null,
      addressLine2: created.patientProfile.addressLine2 ?? null,
      city: created.patientProfile.city ?? null,
      postalCode: created.patientProfile.postalCode ?? null,
    };

    const secret = process.env.AUTH_SESSION_SECRET;
    if (!secret) {
      return json({
        ok: true,
        userId: created.cred.id,
        actorType: created.cred.actorType,
        actorRefId: created.patientProfile.id,
        profile,
        redirectTo,
        warning: 'Account created, but server auth is not configured because AUTH_SESSION_SECRET is missing.',
      });
    }

    const ttlDays = Number(process.env.AUTH_SESSION_TTL_DAYS || '7');
    const ttlSec = Math.max(1, Math.min(ttlDays, 60)) * 24 * 60 * 60;
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + ttlSec;

    const token = signJwtHs256(
      {
        sid: created.sessionId,
        uid: created.cred.id,
        sub: created.cred.id,
        actorType: created.cred.actorType,
        actorRefId: created.patientProfile.id,
        orgId: created.cred.orgId || orgId,
        iat,
        exp,
      },
      secret,
    );

    const res = NextResponse.json(
      {
        ok: true,
        userId: created.cred.id,
        actorType: created.cred.actorType,
        actorRefId: created.patientProfile.id,
        profile,
        redirectTo,
      },
      { status: 200, headers: { 'cache-control': 'no-store, max-age=0' } },
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
  } catch (err: any) {
    console.error('[auth/signup] error', err);
    return json({ ok: false, error: err?.message || 'signup failed' }, 500);
  }
}
