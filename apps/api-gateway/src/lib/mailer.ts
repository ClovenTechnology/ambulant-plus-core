// change signature
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string,          // <= new optional param
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
    return { ok: false, error: String(err) };
  }
}
