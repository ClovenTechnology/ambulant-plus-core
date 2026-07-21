import crypto from 'node:crypto';

export const ADMIN_SESSION_COOKIE = 'adm.profile';

export const ADMIN_SESSION_MAX_AGE_SECONDS =
  60 * 60 * 24 * 7;

const SESSION_ISSUER = 'ambulant-api-gateway';
const SESSION_AUDIENCE = 'ambulant-admin-dashboard';

export type AdminSessionPayload = {
  sub: string;
  role: 'admin' | 'admin_staff';
  email: string;
  name?: string | null;
  profileId?: string | null;
  departmentId?: string | null;
  designationId?: string | null;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
  [key: string]: unknown;
};

function sessionSecret() {
  const secret =
    process.env.AUTH_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    '';

  if (!secret) {
    const error = new Error(
      'admin_session_secret_missing',
    ) as Error & { status?: number };
    error.status = 503;
    throw error;
  }

  return secret;
}

function encodeJson(value: unknown) {
  return Buffer.from(
    JSON.stringify(value),
    'utf8',
  ).toString('base64url');
}

function decodeJson(value: string) {
  try {
    return JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
  }
  catch {
    return null;
  }
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);

  return (
    a.length === b.length &&
    crypto.timingSafeEqual(a, b)
  );
}

function textOrNull(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function isAdminRole(
  value: unknown,
): value is AdminSessionPayload['role'] {
  return (
    value === 'admin' ||
    value === 'admin_staff'
  );
}

export function signAdminSessionToken(
  input: Record<string, any>,
) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ADMIN_SESSION_MAX_AGE_SECONDS;
  const sub = String(input.sub || '').trim();
  const email = String(input.email || '')
    .trim()
    .toLowerCase();
  const role = input.role;

  if (!sub || !email || !isAdminRole(role)) {
    throw new Error('invalid_admin_session_payload');
  }

  const payload: AdminSessionPayload = {
    ...input,
    sub,
    email,
    role,
    name: textOrNull(input.name),
    profileId: textOrNull(input.profileId),
    departmentId: textOrNull(input.departmentId),
    designationId: textOrNull(input.designationId),
    iss: SESSION_ISSUER,
    aud: SESSION_AUDIENCE,
    iat: now,
    exp,
  };

  const header = encodeJson({
    alg: 'HS256',
    typ: 'JWT',
  });
  const body = encodeJson(payload);
  const signingInput = `${header}.${body}`;
  const signature = crypto
    .createHmac('sha256', sessionSecret())
    .update(signingInput)
    .digest('base64url');

  return `${signingInput}.${signature}`;
}

export function verifyAdminSessionToken(
  token?: string | null,
): AdminSessionPayload | null {
  try {
    const parts = String(token || '').trim().split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const header = decodeJson(encodedHeader);
    const payload = decodeJson(encodedPayload);

    if (
      !header ||
      !payload ||
      String(header.alg || '').toUpperCase() !== 'HS256'
    ) {
      return null;
    }

    const expected = crypto
      .createHmac('sha256', sessionSecret())
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    if (!safeEqual(signature, expected)) return null;

    const now = Math.floor(Date.now() / 1000);
    const sub = String(payload.sub || '').trim();
    const email = String(payload.email || '')
      .trim()
      .toLowerCase();
    const role = payload.role;
    const exp = Number(payload.exp || 0);
    const iat = Number(payload.iat || 0);

    if (!sub || !email || !isAdminRole(role)) return null;
    if (payload.iss !== SESSION_ISSUER) return null;
    if (payload.aud !== SESSION_AUDIENCE) return null;
    if (!Number.isFinite(exp) || exp <= now) return null;
    if (!Number.isFinite(iat) || iat > now + 60) return null;

    return {
      ...payload,
      sub,
      email,
      role,
      name: textOrNull(payload.name),
      profileId: textOrNull(payload.profileId),
      departmentId: textOrNull(payload.departmentId),
      designationId: textOrNull(payload.designationId),
      iss: SESSION_ISSUER,
      aud: SESSION_AUDIENCE,
      iat,
      exp,
    } as AdminSessionPayload;
  }
  catch {
    return null;
  }
}
