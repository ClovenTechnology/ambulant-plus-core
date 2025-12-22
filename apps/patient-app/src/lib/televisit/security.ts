// apps/patient-app/src/lib/televisit/security.ts
import crypto from 'crypto';

export function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function ipFromReq(req: Request) {
  // best-effort, behind proxies
  const xf = req.headers.get('x-forwarded-for') || '';
  const ip = xf.split(',')[0]?.trim() || '';
  return ip || null;
}

export function safeUA(req: Request) {
  return req.headers.get('user-agent') || null;
}
