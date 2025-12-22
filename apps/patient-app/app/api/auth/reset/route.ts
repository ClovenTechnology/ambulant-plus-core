//apps/patient-app/app/api/auth/reset/route.ts
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

export const runtime = 'nodejs';

type ResetBody = {
  token?: string;
  password?: string;
};

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

function isStrongPassword(pw: string) {
  // Keep aligned with UI: >=8 + upper + lower + number + symbol
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

/**
 * Minimal HS256 JWT verify (no external deps).
 * Expected payload includes: { email: string, exp: number }
 */
function verifyJwtHs256(token: string, secret: string): { ok: true; payload: any } | { ok: false } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { ok: false };

    const [h, p, sig] = parts;
    const data = `${h}.${p}`;
    const expected = crypto.createHmac('sha256', secret).update(data).digest();
    const got = base64urlToBuffer(sig);

    // constant-time compare
    if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) return { ok: false };

    const payloadJson = base64urlToBuffer(p).toString('utf8');
    const payload = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    if (payload?.exp && typeof payload.exp === 'number' && now > payload.exp) return { ok: false };

    return { ok: true, payload };
  } catch {
    return { ok: false };
  }
}

// Prisma singleton (safe in dev)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

async function hashPasswordScrypt(password: string) {
  // Format: scrypt$N$r$p$salt$hash
  const salt = crypto.randomBytes(16);
  const N = 16384; // cost
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

  /**
   * Mode A (Recommended): proxy to your real auth service
   * Set:
   *  - AUTH_RESET_WEBHOOK_URL="https://your-auth-service/reset"
   *  - AUTH_RESET_WEBHOOK_SECRET="shared-secret"
   */
  const webhookUrl = process.env.AUTH_RESET_WEBHOOK_URL;
  const webhookSecret = process.env.AUTH_RESET_WEBHOOK_SECRET;

  if (webhookUrl) {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(webhookSecret ? { 'x-ambulant-reset-secret': webhookSecret } : {}),
        },
        body: JSON.stringify({ token, password, ip, ua }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        return json(400, {
          ok: false,
          error: data?.error || data?.message || 'Reset failed. Link may be expired or already used.',
        });
      }

      return json(200, { ok: true, message: 'Password reset successful.' });
    } catch (e) {
      console.error('Reset proxy failed', e);
      return json(502, { ok: false, error: 'Reset service unavailable. Please try again shortly.' });
    }
  }

  /**
   * Mode B (Local fallback):
   * - If token looks like JWT (3 parts), verify using AUTH_RESET_TOKEN_SECRET and get email from payload.
   * - Else attempt to look up token in Prisma model "passwordResetToken" (if you have it).
   *
   * IMPORTANT:
   * Your login flow must use the SAME hashing scheme as whatever sets the user password.
   * If your current login uses bcrypt/argon2/etc, wire this route to that same code path.
   */
  try {
    let email: string | null = null;

    // JWT path
    if (token.split('.').length === 3 && process.env.AUTH_RESET_TOKEN_SECRET) {
      const v = verifyJwtHs256(token, process.env.AUTH_RESET_TOKEN_SECRET);
      if (v.ok && typeof v.payload?.email === 'string') {
        email = v.payload.email.trim().toLowerCase();
      } else {
        return json(400, { ok: false, error: 'Reset link is invalid or expired.' });
      }
    } else {
      // Opaque token path (requires you to have a token table)
      // Expected fields (example):
      // passwordResetToken: { token, email, expiresAt, usedAt, usedByIp, usedByUa }
      const pr = prisma as any;

      const row =
        (await pr?.passwordResetToken?.findUnique?.({ where: { token } }).catch(() => null)) ||
        (await pr?.passwordResetToken?.findFirst?.({ where: { token } }).catch(() => null));

      if (!row) return json(400, { ok: false, error: 'Reset link is invalid or expired.' });

      const exp = row?.expiresAt ? new Date(row.expiresAt).getTime() : null;
      const usedAt = row?.usedAt ? new Date(row.usedAt).getTime() : null;

      if (usedAt) return json(400, { ok: false, error: 'This reset link has already been used.' });
      if (exp && Date.now() > exp) return json(400, { ok: false, error: 'Reset link is expired.' });

      if (typeof row?.email === 'string') email = row.email.trim().toLowerCase();
      if (!email) return json(500, { ok: false, error: 'Reset token record is missing email.' });
    }

    // Update user password (requires a user table/model)
    const pr = prisma as any;

    const user =
      (await pr?.user?.findUnique?.({ where: { email } }).catch(() => null)) ||
      (await pr?.user?.findFirst?.({ where: { email } }).catch(() => null));

    if (!user) {
      // For reset, it’s okay to be generic.
      return json(400, { ok: false, error: 'Reset failed. Link may be expired or invalid.' });
    }

    const passwordHash = await hashPasswordScrypt(password);

    // Try update by id (most reliable)
    await pr?.user?.update?.({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordUpdatedAt: new Date(),
      },
    });

    // Mark token used for opaque-token mode (best effort)
    if (token.split('.').length !== 3) {
      await pr?.passwordResetToken?.update?.({
        where: { token },
        data: {
          usedAt: new Date(),
          usedByIp: ip,
          usedByUa: ua,
        },
      }).catch(() => null);
    }

    return json(200, { ok: true, message: 'Password reset successful.' });
  } catch (e) {
    console.error('Local reset failed', e);

    return json(501, {
      ok: false,
      error:
        'Reset is not fully wired yet. Configure AUTH_RESET_WEBHOOK_URL (recommended) or ensure Prisma models/fields exist (user.passwordHash, user.passwordUpdatedAt, and optionally passwordResetToken.*).',
    });
  }
}
