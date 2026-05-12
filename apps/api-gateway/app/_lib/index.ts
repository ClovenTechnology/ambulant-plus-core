// apps/api-gateway/app/_lib/index.ts
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

export function issueRtcToken(payload: Record<string, any>) {
  const secret = process.env.RTC_SIGNING_SECRET || 'dev-secret';
  const body = JSON.stringify({ ...payload, iat: Date.now() });
  const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return Buffer.from(`${body}.${sig}`).toString('base64url');
}
