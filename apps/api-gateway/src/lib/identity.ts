// FILE: apps/api-gateway/src/lib/identity.ts
import crypto from 'node:crypto';

export type WhoRole =
  | 'patient'
  | 'clinician'
  | 'admin'
  | 'admin_staff'
  | 'clinician_staff_medical'
  | 'clinician_staff_non_medical'
  | 'pharmacy'
  | 'pharmacy_staff'
  | 'rider'
  | 'phleb'
  | 'lab'
  | 'system'
  | 'anonymous';

export type IdentitySource =
  | 'session_cookie'
  | 'authorization_bearer'
  | 'signed_internal_header'
  | 'unsafe_dev_header'
  | 'none';

export type Who = {
  role: WhoRole;
  uid: string | null;
  orgId?: string | null;
  actorRefId?: string | null;
  sid?: string | null;
  source?: IdentitySource;
  trusted?: boolean;
};

const COOKIE_CANDIDATES = [
  '__Host-ambulant_session',
  'ambulant_session',
  'ambulant.session',
  'auth_session',
  'session',
  'token',
];

function headerGet(
  h: Headers | Record<string, string | null | undefined>,
  key: string,
): string | null {
  if (h instanceof Headers) return h.get(key);
  const direct = h?.[key];
  if (typeof direct === 'string') return direct;
  const lower = h?.[key.toLowerCase()];
  return typeof lower === 'string' ? lower : null;
}

function b64urlToBuffer(value: string) {
  const pad = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4));
  const b64 = `${value}${pad}`.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

function safeJsonParse<T = any>(value: Buffer | string): T | null {
  try {
    const raw = Buffer.isBuffer(value) ? value.toString('utf8') : value;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function timingSafeEqualText(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function verifyJwtHs256(token: string, secret: string): any | null {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

    const header = safeJsonParse<Record<string, unknown>>(b64urlToBuffer(encodedHeader));
    if (!header || String(header.alg || '').toUpperCase() !== 'HS256') return null;

    const data = `${encodedHeader}.${encodedPayload}`;
    const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    if (!timingSafeEqualText(encodedSignature, expected)) return null;

    const payload = safeJsonParse<Record<string, unknown>>(b64urlToBuffer(encodedPayload));
    if (!payload) return null;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && payload.exp <= now) return null;
    if (typeof payload.nbf === 'number' && payload.nbf > now + 30) return null;

    return payload;
  } catch {
    return null;
  }
}

function parseCookieHeader(cookieHeader: string): Record<string, string> {
  const out: Record<string, string> = {};

  for (const part of String(cookieHeader || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!name) continue;
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }

  return out;
}

function readSessionCookie(
  h: Headers | Record<string, string | null | undefined>,
): string {
  const cookieHeader = String(headerGet(h, 'cookie') || '').trim();
  if (!cookieHeader) return '';
  const cookies = parseCookieHeader(cookieHeader);
  for (const name of COOKIE_CANDIDATES) {
    if (cookies[name]) return cookies[name];
  }
  return '';
}

function normalizeRole(value: unknown): WhoRole {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'patient' || raw === 'patient_user' || raw === 'pat') return 'patient';
  if (raw === 'clinician' || raw === 'doctor') return 'clinician';
  if (raw === 'admin') return 'admin';
  if (raw === 'system') return 'system';
  if (raw === 'admin_staff' || raw === 'staff' || raw === 'support') return 'admin_staff';
  if (raw === 'clinician_staff_medical') return 'clinician_staff_medical';
  if (raw === 'clinician_staff_non_medical') return 'clinician_staff_non_medical';
  if (raw === 'pharmacy') return 'pharmacy';
  if (raw === 'pharmacy_staff') return 'pharmacy_staff';
  if (raw === 'rider') return 'rider';
  if (raw === 'phleb') return 'phleb';
  if (raw === 'lab') return 'lab';
  return 'anonymous';
}

function roleFromSessionPayload(payload: Record<string, unknown>): WhoRole {
  return normalizeRole(
    payload.role ||
      payload.actorRole ||
      payload.actor_type ||
      payload.actorType ||
      payload.type,
  );
}

function stringOrNull(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function whoFromPayload(
  payload: Record<string, unknown>,
  source: IdentitySource,
): Who | null {
  const uid = stringOrNull(payload.sub || payload.uid || payload.userId || payload.user_id);
  const role = roleFromSessionPayload(payload);
  const orgId = stringOrNull(payload.orgId || payload.org_id || payload.tenantId || payload.tenant_id);
  const actorRefId = stringOrNull(payload.actorRefId || payload.actor_ref_id || payload.patientId || payload.patient_id);
  const sid = stringOrNull(payload.sid || payload.sessionId || payload.session_id);
  if (!uid || role === 'anonymous') return null;
  return { role, uid, orgId, actorRefId, sid, source, trusted: true };
}

function readVerifiedSessionIdentity(
  h: Headers | Record<string, string | null | undefined>,
): Who | null {
  const secret = process.env.AUTH_SESSION_SECRET || process.env.NEXTAUTH_SECRET || '';
  if (!secret) return null;
  const token = readSessionCookie(h);
  if (!token) return null;
  const payload = verifyJwtHs256(token, secret);
  return payload ? whoFromPayload(payload, 'session_cookie') : null;
}

function readVerifiedBearerIdentity(
  h: Headers | Record<string, string | null | undefined>,
): Who | null {
  const secret = process.env.AUTH_SESSION_SECRET || process.env.NEXTAUTH_SECRET || '';
  if (!secret) return null;
  const header = String(headerGet(h, 'authorization') || '').trim();
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  const payload = verifyJwtHs256(token, secret);
  return payload ? whoFromPayload(payload, 'authorization_bearer') : null;
}

function readSignedInternalIdentity(
  h: Headers | Record<string, string | null | undefined>,
): Who | null {
  const secret = process.env.AMBULANT_INTERNAL_IDENTITY_SECRET || process.env.INTERNAL_IDENTITY_SECRET || '';
  if (!secret) return null;
  const value = String(headerGet(h, 'x-ambulant-identity') || '').trim();
  if (!value || !value.includes('.')) return null;
  const [encodedPayload, signature] = value.split('.');
  if (!encodedPayload || !signature) return null;
  const expected = crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  if (!timingSafeEqualText(signature, expected)) return null;
  const payload = safeJsonParse<Record<string, unknown>>(b64urlToBuffer(encodedPayload));
  if (!payload) return null;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp <= now) return null;
  if (typeof payload.nbf === 'number' && payload.nbf > now + 30) return null;
  return whoFromPayload(payload, 'signed_internal_header');
}

function unsafeHeaderIdentity(
  h: Headers | Record<string, string | null | undefined>,
): Who {
  const rawRole = headerGet(h, 'x-role') || headerGet(h, 'x-ambulant-role') || headerGet(h, 'x-user-role') || '';
  const uid = stringOrNull(headerGet(h, 'x-uid') || headerGet(h, 'x-user-id') || headerGet(h, 'x-ambulant-user-id'));
  const orgId = stringOrNull(headerGet(h, 'x-org-id') || headerGet(h, 'x-org') || headerGet(h, 'x-ambulant-org-id'));
  return {
    role: normalizeRole(rawRole),
    uid,
    orgId,
    actorRefId: stringOrNull(headerGet(h, 'x-actor-ref-id') || headerGet(h, 'x-patient-id')),
    source: 'unsafe_dev_header',
    trusted: false,
  };
}

function allowUnsafeHeaderIdentity() {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.ALLOW_UNSAFE_IDENTITY_HEADERS === '1' ||
    process.env.ALLOW_UNSAFE_IDENTITY_HEADERS === 'true'
  );
}

export function readIdentity(
  h: Headers | Record<string, string | null | undefined>,
): Who {
  const session = readVerifiedSessionIdentity(h);
  if (session) return session;
  const bearer = readVerifiedBearerIdentity(h);
  if (bearer) return bearer;
  const signedInternal = readSignedInternalIdentity(h);
  if (signedInternal) return signedInternal;
  if (allowUnsafeHeaderIdentity()) return unsafeHeaderIdentity(h);
  return { role: 'anonymous', uid: null, orgId: null, actorRefId: null, source: 'none', trusted: false };
}

export function hasTrustedAuthCarrier(
  h: Headers | Record<string, string | null | undefined>,
): boolean {
  return Boolean(readVerifiedSessionIdentity(h) || readVerifiedBearerIdentity(h) || readSignedInternalIdentity(h));
}

export function isAuthenticatedWho(who: Who): boolean {
  return Boolean(who.uid && who.role !== 'anonymous');
}

export function requireTrustedIdentityInProduction(
  _h: Headers | Record<string, string | null | undefined>,
  who: Who,
) {
  if (process.env.NODE_ENV !== 'production') return;
  if (!who.trusted || !isAuthenticatedWho(who)) throw new Error('Unauthorized');
}

export function requireAuthenticatedIdentity(who: Who) {
  if (!isAuthenticatedWho(who)) throw new Error('Unauthorized');
}
