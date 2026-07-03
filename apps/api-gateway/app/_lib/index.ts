import crypto from 'node:crypto';

export function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function randomId(prefix = 'id') {
  return `${prefix}_${crypto.randomBytes(10).toString('hex')}`;
}

export function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function envFirst(names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return '';
}

export function issueRtcToken(payload: Record<string, any>) {
  const secret = envFirst([
    'RTC_SIGNING_SECRET',
    'TELEVISIT_JOIN_JWT_SECRET',
    'RTC_JOIN_JWT_SECRET',
    'JOIN_TICKET_JWT_SECRET',
  ]);

  if (!secret) {
    throw new Error(
      'Missing RTC_SIGNING_SECRET or TELEVISIT_JOIN_JWT_SECRET for RTC token signing.',
    );
  }

  const body = JSON.stringify({ ...payload, iat: Date.now() });
  const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return Buffer.from(`${body}.${sig}`).toString('base64url');
}
