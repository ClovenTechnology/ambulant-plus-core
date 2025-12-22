//apps/patient-app/app/api/auth/forgot/route.ts
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

export const runtime = 'nodejs';

type ForgotBody = {
  email?: string;
};

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: {
      'cache-control': 'no-store, max-age=0',
    },
  });
}

function normalizeEmail(v: string) {
  return String(v || '').trim().toLowerCase();
}

function looksLikeEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function b64url(buf: Buffer) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function b64urlJson(obj: any) {
  return b64url(Buffer.from(JSON.stringify(obj), 'utf8'));
}

/**
 * Minimal HS256 JWT signer (no deps)
 * Payload should include exp (unix seconds)
 */
function signJwtHs256(payload: any, secret: string) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const h = b64urlJson(header);
  const p = b64urlJson(payload);
  const data = `${h}.${p}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest();
  return `${data}.${b64url(sig)}`;
}

function randomToken(bytes = 32) {
  return b64url(crypto.randomBytes(bytes));
}

// Prisma singleton (safe in dev)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * In-memory rate limit fallback (works in dev / single instance).
 * For production multi-instance, replace with Redis/Upstash/etc.
 */
type Bucket = { count: number; resetAt: number };
const RL = (globalThis as any).__AMB_RL__ ?? new Map<string, Bucket>();
(globalThis as any).__AMB_RL__ = RL;

function hitLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const cur = RL.get(key);
  if (!cur || now > cur.resetAt) {
    RL.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  cur.count += 1;
  RL.set(key, cur);
  return cur.count > limit;
}

function getOriginFromRequest() {
  const h = headers();
  const proto = h.get('x-forwarded-proto') || 'http';
  const host = h.get('x-forwarded-host') || h.get('host');
  if (!host) return null;
  return `${proto}://${host}`;
}

function buildResetEmailText(params: {
  resetUrl: string;
  expiryHours: number;
  supportEmail: string;
  privacyUrl: string;
  legalFooterLines?: string[];
}) {
  const legal = (params.legalFooterLines || []).filter(Boolean).join('\n');
  return `Ambulant+

Password reset request

We received a request to reset the password for your Ambulant+ account. If an account exists for this email address, you can reset your password using the secure link below:

${params.resetUrl}

For your security:
- This link expires in ${params.expiryHours} hours and can be used only once.
- If you didn’t request a password reset, you can ignore this email. Your password will remain unchanged.
- Do not share this link with anyone. Ambulant+ staff will never ask you for your password.

Having trouble?
- If the link doesn’t work, copy and paste it into your browser.
- If you suspect unauthorized activity, reset your password immediately and contact support.

Support: ${params.supportEmail}

—
Ambulant+ (Cloven Technology group entities)
${legal ? legal + '\n' : ''}Privacy: ${params.privacyUrl}
`;
}

function buildResetEmailHtml(params: {
  resetUrl: string;
  expiryHours: number;
  supportEmail: string;
  privacyUrl: string;
  year: number;
  legalFooterLines?: string[];
}) {
  const legal = (params.legalFooterLines || [])
    .filter(Boolean)
    .map((l) => `${escapeHtml(l)}<br/>`)
    .join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Password Reset</title>
  </head>
  <body style="margin:0;background:#f8fafc;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
    <div style="max-width:640px;margin:0 auto;padding:28px 16px;">
      <div style="padding:18px 20px;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;">
        <div style="font-size:12px;font-weight:800;color:#64748b;letter-spacing:0.02em;">Ambulant+</div>
        <h1 style="margin:10px 0 0 0;font-size:22px;line-height:1.25;color:#0f172a;">
          Reset your password
        </h1>
        <p style="margin:10px 0 0 0;font-size:14px;line-height:1.6;color:#334155;">
          We received a request to reset the password for your Ambulant+ account.
          If an account exists for this email address, you can reset your password using the secure button below.
        </p>

        <div style="margin:18px 0 0 0;">
          <a href="${escapeAttr(params.resetUrl)}"
             style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;
                    padding:12px 16px;border-radius:14px;font-weight:800;font-size:14px;">
            Reset password
          </a>
        </div>

        <p style="margin:14px 0 0 0;font-size:12px;line-height:1.6;color:#64748b;">
          This link expires in <strong>${params.expiryHours} hours</strong> and can be used only once.
        </p>

        <div style="margin:16px 0 0 0;padding:12px 14px;border-radius:14px;background:#f1f5f9;border:1px solid #e2e8f0;">
          <div style="font-size:12px;font-weight:800;color:#0f172a;">Security tips</div>
          <ul style="margin:8px 0 0 18px;padding:0;color:#334155;font-size:12px;line-height:1.6;">
            <li>If you didn’t request this, ignore this email — your password will remain unchanged.</li>
            <li>Do not share this link. Ambulant+ staff will never ask you for your password.</li>
            <li>If the button doesn’t work, copy and paste the URL into your browser.</li>
          </ul>
        </div>

        <p style="margin:16px 0 0 0;font-size:12px;line-height:1.6;color:#64748b;">
          If you suspect unauthorized activity, reset your password immediately and contact support:
          <strong>${escapeHtml(params.supportEmail)}</strong>
        </p>

        <hr style="border:none;border-top:1px solid #e2e8f0;margin:18px 0;" />

        <p style="margin:0;font-size:11px;line-height:1.6;color:#94a3b8;">
          Ambulant+ (Cloven Technology group entities)<br/>
          ${legal}
          <a href="${escapeAttr(params.privacyUrl)}" style="color:#64748b;text-decoration:underline;">Privacy</a>
        </p>

        <p style="margin:12px 0 0 0;font-size:11px;line-height:1.6;color:#94a3b8;">
          If you did not make this request, you can safely ignore this email.
        </p>
      </div>

      <p style="margin:14px 0 0 0;text-align:center;font-size:11px;color:#94a3b8;">
        © ${params.year} Ambulant+ • All rights reserved
      </p>
    </div>
  </body>
</html>`;
}

function escapeHtml(s: string) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function escapeAttr(s: string) {
  // good enough for href/text attributes
  return escapeHtml(s).replace(/'/g, '&#39;');
}

async function sendEmailViaWebhook(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const url = process.env.AUTH_EMAIL_WEBHOOK_URL || process.env.EMAIL_WEBHOOK_URL;
  if (!url) {
    // Dev-friendly: don’t hard-fail, just log
    console.warn('[auth/forgot] EMAIL_WEBHOOK_URL not set; skipping email send.');
    return { ok: true, skipped: true };
  }

  const secret = process.env.AUTH_EMAIL_WEBHOOK_SECRET || process.env.EMAIL_WEBHOOK_SECRET;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(secret ? { 'x-ambulant-mail-secret': secret } : {}),
    },
    body: JSON.stringify({
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      // optional metadata
      tags: ['auth', 'password-reset'],
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.error('[auth/forgot] Email webhook error:', res.status, t);
    throw new Error('Email send failed');
  }

  return { ok: true };
}

export async function POST(req: Request) {
  const h = headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
  const ua = h.get('user-agent') || 'unknown';

  let body: ForgotBody = {};
  try {
    body = (await req.json().catch(() => ({}))) as ForgotBody;
  } catch {
    body = {};
  }

  const email = normalizeEmail(body?.email || '');

  // Always use a generic success response (prevents enumeration)
  const genericOk = () =>
    json(200, {
      ok: true,
      message: 'If an account exists for that email, a reset link has been sent.',
    });

  // Basic input validation (still generic response)
  if (!email || !looksLikeEmail(email)) {
    return genericOk();
  }

  // Rate limit parameters (tune as needed)
  const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  const IP_LIMIT = 12; // per 15 min
  const EMAIL_LIMIT = 6; // per 15 min
  const COOLDOWN_MS = 60 * 1000; // 1 minute per (email+ip) to reduce spam bursts

  // Rate limit keys (don’t reveal to client)
  const ipKey = `forgot:ip:${ip}`;
  const emailKey = `forgot:email:${email}`;
  const comboKey = `forgot:combo:${ip}:${email}`;

  // Cooldown bucket (simple: max 1 hit per minute)
  const comboLimited = hitLimit(comboKey, 1, COOLDOWN_MS);

  // Window limits
  const ipLimited = hitLimit(ipKey, IP_LIMIT, WINDOW_MS);
  const emailLimited = hitLimit(emailKey, EMAIL_LIMIT, WINDOW_MS);

  // If rate-limited, still return the same generic message (no enumeration)
  if (comboLimited || ipLimited || emailLimited) {
    return genericOk();
  }

  // Determine base URL for links
  const baseUrl =
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    getOriginFromRequest();

  if (!baseUrl) {
    // Still generic response (no leakage)
    console.warn('[auth/forgot] No base URL available to build reset link.');
    return genericOk();
  }

  // Find user (best effort, but do not reveal existence)
  let user: any = null;
  try {
    const pr = prisma as any;
    user =
      (await pr?.user?.findUnique?.({ where: { email } }).catch(() => null)) ||
      (await pr?.user?.findFirst?.({ where: { email } }).catch(() => null));
  } catch {
    user = null;
  }

  // If user does not exist: do nothing; still return OK (prevents enumeration)
  if (!user) return genericOk();

  // Token expiry (default 2 hours)
  const ttlMin = Number(process.env.AUTH_RESET_TOKEN_TTL_MIN || '120');
  const ttlMs = Math.max(15, Math.min(ttlMin, 24 * 60)) * 60 * 1000; // clamp 15min..24h
  const expiryHours = Math.round(ttlMs / (60 * 60 * 1000));

  // Prefer JWT (time-limited) when secret is available.
  // Else fallback to opaque token stored in DB (if you have passwordResetToken model).
  const jwtSecret = process.env.AUTH_RESET_TOKEN_SECRET;

  let token = '';
  let tokenMode: 'jwt' | 'opaque' = 'jwt';

  if (jwtSecret) {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + Math.floor(ttlMs / 1000);
    token = signJwtHs256(
      {
        email, // used by /api/auth/reset verify
        iat: now,
        exp,
        jti: randomToken(16),
      },
      jwtSecret,
    );
    tokenMode = 'jwt';
  } else {
    token = randomToken(32);
    tokenMode = 'opaque';

    // Store token so /api/auth/reset can validate it (best effort)
    try {
      const pr = prisma as any;
      const expiresAt = new Date(Date.now() + ttlMs);

      // Optional: delete/expire older tokens for same email (best effort)
      await pr?.passwordResetToken?.deleteMany?.({
        where: { email },
      }).catch(() => null);

      await pr?.passwordResetToken?.create?.({
        data: {
          token,
          email,
          expiresAt,
          usedAt: null,
          requestedByIp: ip,
          requestedByUa: ua,
        },
      });
    } catch (e) {
      // If you don’t have the model, fallback can’t work. Still do not leak.
      console.warn(
        '[auth/forgot] passwordResetToken model not available. Set AUTH_RESET_TOKEN_SECRET to use JWT tokens instead.',
      );
      return genericOk();
    }
  }

  const resetUrl = `${String(baseUrl).replace(/\/+$/, '')}/auth/reset?token=${encodeURIComponent(token)}`;

  // Email config
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@ambulant.plus';
  const privacyUrl = `${String(baseUrl).replace(/\/+$/, '')}/privacy`;

  const legalFooterLines = [
    process.env.LEGAL_FOOTER_LINE_1 || '',
    process.env.LEGAL_FOOTER_LINE_2 || '',
  ].filter(Boolean);

  const subject = 'Reset your Ambulant+ password';

  const text = buildResetEmailText({
    resetUrl,
    expiryHours,
    supportEmail,
    privacyUrl,
    legalFooterLines,
  });

  const html = buildResetEmailHtml({
    resetUrl,
    expiryHours,
    supportEmail,
    privacyUrl,
    year: new Date().getFullYear(),
    legalFooterLines,
  });

  // Send email (best effort)
  try {
    await sendEmailViaWebhook({
      to: email,
      subject,
      html,
      text,
    });
  } catch (e) {
    // Don’t leak; don’t fail user-facing response.
    console.error('[auth/forgot] send failed:', e);
    return genericOk();
  }

  // Generic success response (always same messaging)
  // Include no fields that reveal user existence.
  return genericOk();
}
