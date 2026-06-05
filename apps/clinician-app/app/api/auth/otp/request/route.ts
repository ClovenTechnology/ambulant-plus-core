// apps/clinician-app/app/api/auth/otp/request/route.ts
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'node:crypto';

import { prisma } from '@/src/lib/prisma';
import { sendEmail } from '@/src/lib/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OTP_PURPOSE = 'clinician_login';

type OtpRequestBody = {
  email?: string;
  identifier?: string;
};

type Bucket = { count: number; resetAt: number };
const RL = (globalThis as any).__AMB_CLINICIAN_OTP_RL__ ?? new Map<string, Bucket>();
(globalThis as any).__AMB_CLINICIAN_OTP_RL__ = RL;

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
  const pepper =
    process.env.CLINICIAN_OTP_SECRET ||
    process.env.AUTH_OTP_SECRET ||
    process.env.AUTH_SESSION_SECRET ||
    '';

  if (!pepper) {
    throw new Error('Missing CLINICIAN_OTP_SECRET, AUTH_OTP_SECRET, or AUTH_SESSION_SECRET.');
  }

  return sha256Hex(`${pepper}:${OTP_PURPOSE}:${identifier}:${code}`);
}

function generateOtpCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

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

function escapeHtml(s: unknown) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildClinicianOtpEmail(params: {
  name: string;
  code: string;
  expiryMinutes: number;
  supportEmail: string;
}) {
  const code = escapeHtml(params.code);
  const name = escapeHtml(params.name || 'Clinician');
  const support = escapeHtml(params.supportEmail);

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#f8fafc;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:24px;">
        <div style="font-size:12px;font-weight:800;color:#4338ca;letter-spacing:0.08em;text-transform:uppercase;">
          Ambulant+ Clinician
        </div>

        <h1 style="margin:10px 0 0;color:#0f172a;font-size:24px;">Your clinician sign-in code</h1>

        <p style="color:#334155;font-size:14px;line-height:1.7;">
          Hi ${name}, use this one-time code to sign in to your Ambulant+ clinician account.
        </p>

        <div style="margin:22px 0;padding:18px;border-radius:18px;background:#eef2ff;border:1px solid #c7d2fe;text-align:center;">
          <div style="font-size:34px;letter-spacing:0.22em;font-weight:900;color:#0f172a;">${code}</div>
        </div>

        <p style="font-size:13px;line-height:1.7;color:#475569;">
          This code expires in <strong>${params.expiryMinutes} minutes</strong> and can be used only once.
          Do not share it with anyone.
        </p>

        <p style="font-size:12px;line-height:1.6;color:#64748b;">
          If you did not request this code, you can ignore this email.
          Support: ${support}
        </p>
      </div>
    </div>
  `;
}

export async function POST(req: Request) {
  const h = headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
  const ua = h.get('user-agent') || null;

  let body: OtpRequestBody = {};

  try {
    body = (await req.json().catch(() => ({}))) as OtpRequestBody;
  } catch {
    body = {};
  }

  const email = normalizeEmail(body.email || body.identifier || '');

  if (!email || !looksLikeEmail(email)) {
    return json(200, { ok: true, sent: true });
  }

  const rlKey = `clinician-otp:req:${ip}:${email}`;
  if (hitLimit(rlKey, 5, 15 * 60 * 1000)) {
    return json(429, {
      ok: false,
      error: 'Too many code requests. Please wait and try again.',
    });
  }

  const clinician = await prisma.clinicianProfile
    .findFirst({
      where: {
        OR: [{ email }, { userId: email }],
      } as any,
      select: {
        id: true,
        email: true,
        userId: true,
        displayName: true,
        status: true,
        disabled: true,
        archived: true,
      } as any,
    })
    .catch(() => null);

  // Generic success: do not reveal whether this email exists.
  if (!clinician || (clinician as any).disabled || (clinician as any).archived) {
    return json(200, { ok: true, sent: true });
  }

  const code = generateOtpCode();
  const expiryMinutes = Number(process.env.AUTH_OTP_EXPIRY_MINUTES || '10');
  const expiresAt = new Date(Date.now() + Math.max(2, Math.min(expiryMinutes, 30)) * 60 * 1000);

  await prisma.authOtpChallenge
    .updateMany({
      where: {
        identifier: email,
        channel: 'email',
        purpose: OTP_PURPOSE,
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
      purpose: OTP_PURPOSE,
      codeHash: otpHash(email, code),
      attempts: 0,
      maxAttempts: 5,
      expiresAt,
      requestedByIp: ip,
      requestedByUa: ua || undefined,
      meta: {
        clinicianId: clinician.id,
        status: String((clinician as any).status || 'pending'),
        app: 'clinician-app',
      },
    },
  });

  const supportEmail =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
    process.env.SUPPORT_EMAIL ||
    'support@ambulantplus.co.za';

  await sendEmail(
    email,
    'Your Ambulant+ clinician sign-in code',
    buildClinicianOtpEmail({
      name: String((clinician as any).displayName || 'Clinician'),
      code,
      expiryMinutes,
      supportEmail,
    }),
  ).catch((err) => {
    console.error('[clinician auth/otp/request] email send failed', err);
  });

  return json(200, { ok: true, sent: true });
}
