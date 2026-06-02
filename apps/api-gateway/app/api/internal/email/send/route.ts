// apps/api-gateway/app/api/internal/email/send/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/src/lib/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  to?: string;
  subject?: string;
  html?: string;
  text?: string;
  source?: string;
  tags?: string[];
};

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
}

function cleanStr(v: unknown, max = 5000) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return s.length > max ? s.slice(0, max) : s;
}

function looksLikeEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function safeSource(v: unknown) {
  return cleanStr(v, 120).replace(/[^a-zA-Z0-9:_-]/g, '');
}

export async function POST(req: NextRequest) {
  const expectedSecret =
    process.env.AUTH_EMAIL_WEBHOOK_SECRET ||
    process.env.EMAIL_WEBHOOK_SECRET ||
    process.env.INTERNAL_EMAIL_WEBHOOK_SECRET ||
    '';

  if (!expectedSecret) {
    return json(500, { ok: false, error: 'email_webhook_secret_not_configured' });
  }

  const providedSecret = req.headers.get('x-ambulant-mail-secret') || '';
  if (providedSecret !== expectedSecret) {
    return json(403, { ok: false, error: 'forbidden' });
  }

  const body = (await req.json().catch(() => ({}))) as Body;

  const to = cleanStr(body.to, 320).toLowerCase();
  const subject = cleanStr(body.subject, 240);
  const html = cleanStr(body.html, 200_000);
  const text = cleanStr(body.text, 50_000);
  const source = safeSource(body.source || 'internal-email');

  if (!to || !looksLikeEmail(to)) {
    return json(400, { ok: false, error: 'valid_to_required' });
  }

  if (!subject) {
    return json(400, { ok: false, error: 'subject_required' });
  }

  if (!html && !text) {
    return json(400, { ok: false, error: 'html_or_text_required' });
  }

  const finalHtml =
    html ||
    `<pre style="font-family:ui-sans-serif,system-ui;white-space:pre-wrap;">${text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')}</pre>`;

  const result = await sendEmail(to, subject, finalHtml, text || undefined);

  if (!result.ok) {
    console.error('[internal/email/send] send failed', {
      source,
      to,
      error: result.error,
      res: result.res,
    });

    return json(502, {
      ok: false,
      error: 'email_send_failed',
      detail: result.error,
    });
  }

  return json(200, { ok: true, source });
}