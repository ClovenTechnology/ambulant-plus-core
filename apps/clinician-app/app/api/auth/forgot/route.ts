// apps/clinician-app/app/api/auth/forgot/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sendEmail } from '@/src/lib/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function normEmail(v: any) {
  return String(v || '').trim().toLowerCase();
}

function b64url(buf: Buffer) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function signResetToken(email: string, expMs: number) {
  const secret = process.env.AUTH_RESET_SECRET || process.env.AUTH_SECRET || 'dev-reset-secret';
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = `${email}|${expMs}|${nonce}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const token = b64url(Buffer.from(`${payload}|${sig}`, 'utf8'));
  return token;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = normEmail(body.email);

    // Always return ok (avoid account enumeration)
    if (!email) return json({ ok: true, message: 'If an account exists, a reset link was sent.' });

    const exp = Date.now() + 30 * 60 * 1000; // 30 minutes
    const token = signResetToken(email, exp);

    const origin = req.nextUrl.origin;
    const resetLink = `${origin}/auth/reset?token=${encodeURIComponent(token)}`;

    const subject = 'Ambulant+ Password Reset';
    const html = `
      <p>Hello,</p>
      <p>We received a request to reset your Ambulant+ clinician password.</p>
      <p><a href="${resetLink}">👉 Reset your password</a></p>
      <p>This link expires in 30 minutes.</p>
      <p>If you didn’t request this, you can ignore this email.</p>
    `;
    sendEmail(email, subject, html).catch(console.error);

    return json({ ok: true, message: 'If an account exists, a reset link was sent.' });
  } catch (err: any) {
    console.error('forgot error', err);
    // Still do not leak
    return json({ ok: true, message: 'If an account exists, a reset link was sent.' });
  }
}
