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
  allergies?: string[];
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

// Prisma singleton
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function POST(req: NextRequest) {
  try {
    const { payload } = await parseRequest(req);

    const email = normalizeEmail(payload.email || '');
    const password = String(payload.password || '');
    const name = String(payload.name || '').trim() || null;

    if (!email || !looksLikeEmail(email)) return json({ ok: false, error: 'Valid email is required.' }, 400);
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

    // Create AuthCredential + PatientProfile (single source of truth)
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

      await tx.patientProfile
        .create({
          data: {
            userId: cred.id,
            name: name || undefined,
            contactEmail: email,
            phone: payload.phone || undefined,
            gender: payload.gender || undefined,
            addressLine1: payload.address || undefined,
            allergies: Array.isArray(payload.allergies) ? payload.allergies.filter(Boolean).join(', ') : undefined,
          },
        })
        .catch(() => null);

      // Optional: wallet account, etc (leave for later)

      return cred;
    });

    return json({ ok: true, userId: created.id });
  } catch (err: any) {
    console.error('[auth/signup] error', err);
    return json({ ok: false, error: err?.message || 'signup failed' }, 500);
  }
}
