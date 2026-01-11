//apps/patient-app/app/api/auth/reset/route.ts
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ResetBody = { token?: string; password?: string };

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
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

function sha256Hex(s: string) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
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
  // Format: scrypt$N$r$p$salt$hash
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

export async function POST(req: Request) {
  const h = headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
  const ua = h.get('user-agent') || null;

  let body: ResetBody = {};
  try {
    body = (await req.json().catch(() => ({}))) as ResetBody;
  } catch {
    body = {};
  }

  const token = String(body?.token || '').trim();
  const password = String(body?.password || '');

  if (!token) return json(400, { ok: false, error: 'Reset token is required.' });
  if (!password) return json(400, { ok: false, error: 'New password is required.' });
  if (!isStrongPassword(password)) {
    return json(400, {
      ok: false,
      error: 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol.',
    });
  }

  const tokenHash = sha256Hex(token);

  try {
    const now = new Date();

    // Look up token row by hash
    const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash } }).catch(() => null);
    if (!row) return json(400, { ok: false, error: 'Reset link is invalid or expired.' });

    if (row.usedAt) return json(400, { ok: false, error: 'This reset link has already been used.' });
    if (row.expiresAt && now.getTime() > new Date(row.expiresAt).getTime()) {
      return json(400, { ok: false, error: 'Reset link is invalid or expired.' });
    }

    const email = String(row.email || '').trim().toLowerCase();
    if (!email) return json(400, { ok: false, error: 'Reset link is invalid or expired.' });

    const cred = await prisma.authCredential.findUnique({ where: { email } }).catch(() => null);
    if (!cred || cred.disabled) {
      return json(400, { ok: false, error: 'Reset failed. Link may be expired or invalid.' });
    }

    const newHash = await hashPasswordScrypt(password);

    // Transaction: update password + mark token used
    await prisma.$transaction([
      prisma.authCredential.update({
        where: { id: cred.id },
        data: {
          passwordHash: newHash,
          lastLoginAt: null, // optional; leave as-is if you prefer
          // updatedAt handled by Prisma
        },
      }),
      prisma.passwordResetToken.update({
        where: { tokenHash },
        data: {
          usedAt: now,
          // schema doesn't have usedByIp/usedByUa — keep it clean & consistent.
          // ip/ua captured on request in forgot route.
        },
      }),
    ]);

    // Optional: record an audit event if you want (not required)
    // await prisma.auditLog.create({ ... })

    // Never log token / email to console here.
    void ip;
    void ua;

    return json(200, { ok: true, message: 'Password reset successful.' });
  } catch (e) {
    console.error('[auth/reset] failed');
    return json(500, { ok: false, error: 'Reset failed. Please try again shortly.' });
  }
}
