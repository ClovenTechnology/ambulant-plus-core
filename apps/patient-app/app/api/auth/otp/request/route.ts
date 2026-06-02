// apps/patient-app/app/api/auth/otp/request/route.ts
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OtpRequestBody = {
  email?: string;
  identifier?: string;
  purpose?: 'login';
};

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
}

function normalizeEmail(v: unknown) {
  return String(v || '').trim().toLowerCase();
}

function looksLikeEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function sha256Hex(s: string) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function otpHash(identifier: string, code: string) {
  const pepper = process.env.AUTH_OTP_SECRET || process.env.AUTH_SESSION_SECRET || '';
  if (!pepper) throw new Error('Missing AUTH_OTP_SECRET or AUTH_SESSION_SECRET.');
  return sha256Hex(`${pepper}:${identifier}:${code}`);
}

function generateOtpCode() {
  // 000000 - 999999, then pad.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function escapeHtml(s: string) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildOtpEmailText(params: {
  code: string;
  expiryMinutes: number;
  supportEmail: string;
  privacyUrl: string;
}) {
  return `Ambulant+

Your sign-in code

Use this one-time code to sign in to your Ambulant+ patient account:

${params.code}

For your security:
- This code expires in ${params.expiryMinutes} minutes.
- It can be used only once.
- Do not share this code with anyone. Ambulant+ staff will never ask you for your password or sign-in code.

If you did not request this code, you can ignore this email.

Support: ${params.supportEmail}
Privacy: ${params.privacyUrl}
`;
}

function buildOtpEmailHtml(params: {
  code: string;
  expiryMinutes: number;
  supportEmail: string;
  privacyUrl: string;
  year: number;
}) {
  const code = escapeHtml(params.code);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Ambulant+ sign-in code</title>
  </head>
  <body style="margin:0;background:#f8fafc;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
    <div style="max-width:640px;margin:0 auto;padding:28px 16px;">
      <div style="padding:22px 22px;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;">
        <div style="font-size:12px;font-weight:800;color:#0f766e;letter-spacing:0.08em;text-transform:uppercase;">Ambulant+</div>
        <h1 style="margin:10px 0 0 0;font-size:24px;line-height:1.25;color:#0f172a;">Your sign-in code</h1>
        <p style="margin:10px 0 0 0;font-size:14px;line-height:1.7;color:#334155;">
          Use this one-time code to sign in to your Ambulant+ patient account.
        </p>

        <div style="margin:22px 0;padding:18px;border-radius:18px;background:#ecfeff;border:1px solid #bae6fd;text-align:center;">
          <div style="font-size:34px;letter-spacing:0.22em;font-weight:900;color:#0f172a;">${code}</div>
        </div>

        <p style="margin:0;font-size:13px;line-height:1.7;color:#475569;">
          This code expires in <strong>${params.expiryMinutes} minutes</strong> and can be used only once.
          Do not share it with anyone.
        </p>

        <hr style="border:none;border-top:1px solid #e2e8f0;margin:18px 0;" />

        <p style="margin:0;font-size:11px;line-height:1.6;color:#94a3b8;">
          If you did not request this code, you can safely ignore this email.<br/>
          Support: ${escapeHtml(params.supportEmail)}<br/>
          <a href="${escapeHtml(params.privacyUrl)}" style="color:#64748b;text-decoration:underline;">Privacy</a>
        </p>
      </div>

      <p style="margin:14px 0 0 0;text-align:center;font-size:11px;color:#94a3b8;">
        © ${params.year} Ambulant+ • All rights reserved
      </p>
    </div>
  </body>
</html>`;
}

async function sendEmailViaWebhook(args: { to: string; subject: string; html: string; text: string }) {
  const url = process.env.AUTH_EMAIL_WEBHOOK_URL || process.env.EMAIL_WEBHOOK_URL;
  if (!url) {
    console.warn('[auth/otp/request] EMAIL_WEBHOOK_URL not set; OTP email skipped.');
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
      source: 'patient-app-auth-otp',
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`OTP email webhook failed: ${res.status} ${detail.slice(0, 300)}`);
  }

  return { ok: true };
}

type Bucket = { count: number; resetAt: number };
const RL = (globalThis as any).__AMB_OTP_RL__ ?? new Map<string, Bucket>();
(globalThis as any).__AMB_OTP_RL__ = RL;

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

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function POST(req: Request) {
  const h = headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
  const ua = h.get('user-agent') || null;

  let body: OtpRequestBody = {};
  try {
    body = (await req.json().catch(() => ({}))) as OtpRequestBody;
  } catch {
    body = {};
  }

  const email = normalizeEmail(body.email || body.identifier || '');
  const purpose = 'login';

  // Always return generic success to avoid account enumeration, but validate basic email shape.
  if (!email || !looksLikeEmail(email)) {
    return json(200, { ok: true, sent: true });
  }

  const rlKey = `otp:req:${ip || 'unknown'}:${email}`;
  if (hitLimit(rlKey, 5, 15 * 60 * 1000)) {
    return json(429, { ok: false, error: 'Too many code requests. Please wait and try again.' });
  }

  const cred = await prisma.authCredential
    .findUnique({
      where: { email },
      select: { id: true, email: true, disabled: true, actorType: true },
    })
    .catch(() => null);

  // Generic success: do not reveal whether the account exists.
  if (!cred || cred.disabled || cred.actorType !== 'PATIENT') {
    return json(200, { ok: true, sent: true });
  }

  const code = generateOtpCode();
  const expiryMinutes = Number(process.env.AUTH_OTP_EXPIRY_MINUTES || '10');
  const expiresAt = new Date(Date.now() + Math.max(2, Math.min(expiryMinutes, 30)) * 60 * 1000);

  // Invalidate previous active login OTPs for this identifier.
  await prisma.authOtpChallenge
    .updateMany({
      where: {
        identifier: email,
        purpose,
        channel: 'email',
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    })
    .catch(() => null);

  await prisma.authOtpChallenge.create({
    data: {
      identifier: email,
      channel: 'email',
      purpose,
      codeHash: otpHash(email, code),
      expiresAt,
      attempts: 0,
      maxAttempts: 5,
      requestedByIp: ip || undefined,
      requestedByUa: ua || undefined,
      meta: { userId: cred.id },
    },
  });

  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || process.env.SUPPORT_EMAIL || 'support@ambulantplus.co.za';
  const siteUrl = process.env.NEXT_PUBLIC_PATIENT_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://patient.ambulantplus.co.za';
  const privacyUrl = `${siteUrl.replace(/\/+$/, '')}/privacy`;

  await sendEmailViaWebhook({
    to: email,
    subject: 'Your Ambulant+ sign-in code',
    text: buildOtpEmailText({ code, expiryMinutes, supportEmail, privacyUrl }),
    html: buildOtpEmailHtml({ code, expiryMinutes, supportEmail, privacyUrl, year: new Date().getFullYear() }),
  }).catch((err) => {
    console.error('[auth/otp/request] email send failed', err);
    // Do not expose delivery internals to user.
  });

  return json(200, { ok: true, sent: true });
}
