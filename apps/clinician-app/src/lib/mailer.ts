// apps/clinician-app/src/lib/mailer.ts
/**
 * Mailer utilities for server runtime.
 *
 * Notes:
 * - Do NOT import 'node-fetch' here. Next.js / Node 18+ provides a global fetch on the server.
 * - Ensure these env vars exist in your environment or .env:
 *    SENDGRID_API_KEY
 *    EMAIL_FROM (optional, defaults to no-reply@...)
 *    TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM
 *
 * If you run this in the Edge runtime, Buffer may not be available; the code handles that case.
 */

type SendResult = { ok: boolean; error?: string; res?: any };

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@ambulant.cloventechnology.com';

export async function sendEmail(to: string, subject: string, html: string): Promise<SendResult> {
  if (!SENDGRID_API_KEY) {
    console.warn('SendGrid API key missing; skipping email to', to);
    return { ok: false, error: 'no_sendgrid' };
  }

  try {
    const payload = {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: EMAIL_FROM },
      subject,
      content: [{ type: 'text/html', value: html }],
    };

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, error: `sendgrid:${res.status}`, res: txt };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: String(err) };
  }
}

const TWILIO_SID = process.env.TWILIO_SID;
const TWILIO_TOKEN = process.env.TWILIO_TOKEN;
const TWILIO_FROM = process.env.TWILIO_FROM;

function isEdgeRuntime() {
  // In Next.js Edge runtime Buffer may be undefined. We use this simple check to switch auth encoding.
  return typeof Buffer === 'undefined';
}

function encodeBasicAuth(user: string, pass: string): string {
  if (isEdgeRuntime()) {
    // btoa is available in Edge runtimes
    return btoa(`${user}:${pass}`);
  }
  // Node server runtime
  return Buffer.from(`${user}:${pass}`).toString('base64');
}

export async function sendSms(to: string, body: string): Promise<SendResult> {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    console.warn('Twilio credentials missing; skipping SMS to', to);
    return { ok: false, error: 'no_twilio' };
  }
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
    const params = new URLSearchParams();
    params.append('From', TWILIO_FROM);
    params.append('To', to);
    params.append('Body', body);

    const auth = encodeBasicAuth(TWILIO_SID, TWILIO_TOKEN);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, error: `twilio:${res.status}`, res: txt };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: String(err) };
  }
}
