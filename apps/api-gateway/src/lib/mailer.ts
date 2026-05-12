// apps/api-gateway/src/lib/mailer.ts

type SendResult = {
  ok: boolean;
  error?: string;
  res?: unknown;
};

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const EMAIL_FROM =
  process.env.EMAIL_FROM ||
  process.env.SENDGRID_FROM ||
  'no-reply@ambulant.cloventechnology.com';

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string,
): Promise<SendResult> {
  if (!SENDGRID_API_KEY) {
    console.warn('[mailer] SENDGRID_API_KEY missing; skipping email to', to);
    return { ok: false, error: 'no_sendgrid' };
  }

  try {
    const content: { type: string; value: string }[] = [];

    if (text) {
      content.push({ type: 'text/plain', value: text });
    }

    content.push({ type: 'text/html', value: html });

    const payload = {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: EMAIL_FROM },
      subject,
      content,
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
    return { ok: false, error: String(err?.message || err) };
  }
}

export async function sendSms(to: string, body: string): Promise<SendResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
  const authToken = process.env.TWILIO_AUTH_TOKEN || '';
  const from = process.env.TWILIO_FROM || '';

  if (!accountSid || !authToken || !from) {
    console.warn('[mailer] Twilio SMS env missing; skipping SMS to', to);
    return { ok: false, error: 'no_twilio' };
  }

  try {
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const params = new URLSearchParams();
    params.set('To', to);
    params.set('From', from);
    params.set('Body', body);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, error: `twilio:${res.status}`, res: txt };
    }

    return { ok: true, res: await res.json().catch(() => null) };
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err) };
  }
}