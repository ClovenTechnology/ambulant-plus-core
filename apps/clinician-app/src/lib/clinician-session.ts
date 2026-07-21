import crypto from 'node:crypto';

export const CLINICIAN_SESSION_COOKIE =
  process.env.CLINICIAN_SESSION_COOKIE ||
  'ambulant_clinician_session';

export const CLINICIAN_SESSION_MAX_AGE_SECONDS =
  60 * 60 * 24 * 7;

const SESSION_ISSUER = 'ambulant-clinician-app';
const SESSION_AUDIENCE = 'ambulant-clinician-app';

export type ClinicianSessionRole =
  | 'clinician'
  | 'admin'
  | 'admin_staff';

export type ClinicianSessionPayload = {
  sub: string;
  role: ClinicianSessionRole;
  clinicianId?: string | null;
  email?: string | null;
  name?: string | null;
  issuedAt?: number;
  expiresAt?: number;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
  [key: string]: unknown;
};

function sessionSecret() {
  const secret =
    process.env.CLINICIAN_SESSION_SECRET ||
    process.env.AUTH_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    '';

  if (!secret) {
    const error = new Error(
      'clinician_session_secret_missing',
    ) as Error & { status?: number };
    error.status = 503;
    throw error;
  }

  return secret;
}

function internalIdentitySecret() {
  const secret =
    process.env.AMBULANT_INTERNAL_IDENTITY_SECRET ||
    process.env.INTERNAL_IDENTITY_SECRET ||
    '';

  if (!secret) {
    const error = new Error(
      'internal_identity_secret_missing',
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

function isRole(
  value: unknown,
): value is ClinicianSessionRole {
  return (
    value === 'clinician' ||
    value === 'admin' ||
    value === 'admin_staff'
  );
}

function textOrNull(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

export function signClinicianSessionToken(
  input: Record<string, any>,
) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + CLINICIAN_SESSION_MAX_AGE_SECONDS;

  const sub = String(input.sub || '').trim();
  const role = input.role;

  if (!sub || !isRole(role)) {
    throw new Error('invalid_clinician_session_payload');
  }

  const payload: ClinicianSessionPayload = {
    ...input,
    sub,
    role,
    clinicianId: textOrNull(input.clinicianId),
    email: textOrNull(input.email),
    name: textOrNull(input.name),
    iss: SESSION_ISSUER,
    aud: SESSION_AUDIENCE,
    iat: now,
    exp,
    issuedAt: now * 1000,
    expiresAt: exp * 1000,
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

export function verifyClinicianSessionToken(
  token?: string | null,
): ClinicianSessionPayload | null {
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
    const role = payload.role;
    const exp = Number(payload.exp || 0);
    const iat = Number(payload.iat || 0);

    if (!sub || !isRole(role)) return null;
    if (payload.iss !== SESSION_ISSUER) return null;
    if (payload.aud !== SESSION_AUDIENCE) return null;
    if (!Number.isFinite(exp) || exp <= now) return null;
    if (!Number.isFinite(iat) || iat > now + 60) return null;

    return {
      ...payload,
      sub,
      role,
      clinicianId: textOrNull(payload.clinicianId),
      email: textOrNull(payload.email),
      name: textOrNull(payload.name),
      issuedAt: iat * 1000,
      expiresAt: exp * 1000,
      iat,
      exp,
      iss: SESSION_ISSUER,
      aud: SESSION_AUDIENCE,
    };
  }
  catch {
    return null;
  }
}

function parseCookieHeader(value: string) {
  const cookies: Record<string, string> = {};

  for (const item of String(value || '').split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0) continue;

    const name = item.slice(0, separator).trim();
    const rawValue = item.slice(separator + 1).trim();
    if (!name) continue;

    try {
      cookies[name] = decodeURIComponent(rawValue);
    }
    catch {
      cookies[name] = rawValue;
    }
  }

  return cookies;
}

export function readClinicianSessionFromRequest(
  request: Request,
) {
  const cookies = parseCookieHeader(
    request.headers.get('cookie') || '',
  );

  return verifyClinicianSessionToken(
    cookies[CLINICIAN_SESSION_COOKIE] || null,
  );
}

export function createTrustedClinicianIdentityHeader(
  request: Request,
) {
  const session = readClinicianSessionFromRequest(request);

  if (!session) {
    const error = new Error(
      'unauthenticated',
    ) as Error & { status?: number };
    error.status = 401;
    throw error;
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = encodeJson({
    sub: session.sub,
    role: session.role,
    actorRefId:
      session.clinicianId ||
      session.sub,
    email: session.email || null,
    iat: now,
    exp: now + 60,
    iss: SESSION_ISSUER,
  });

  const signature = crypto
    .createHmac(
      'sha256',
      internalIdentitySecret(),
    )
    .update(payload)
    .digest('base64url');

  return `${payload}.${signature}`;
}
