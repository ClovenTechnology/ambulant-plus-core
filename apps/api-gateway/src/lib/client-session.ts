import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';

export const CLIENT_SESSION_TOKEN_COOKIE = 'ambulant_client_session_token';

const SESSION_ISSUER = 'ambulant-api-gateway';
const SESSION_AUDIENCE = 'ambulant-client-app';
const DEFAULT_TTL_SECONDS = 60 * 60 * 12;
const MAX_TTL_SECONDS = 60 * 60 * 24;

export type ClientSessionTokenPayload = {
  sub: string;
  uid: string;
  orgId: string;
  email?: string | null;
  orgType?: string | null;
  workspace?: string | null;
  role: string;
  scopes: string[];
  orgName?: string | null;
  orgStatus?: string | null;
  iat: number;
  exp: number;
  iss: typeof SESSION_ISSUER;
  aud: typeof SESSION_AUDIENCE;
  sessionType: 'client';
};

function baseSecret() {
  return String(
    process.env.AUTH_SESSION_SECRET ||
      process.env.NEXTAUTH_SECRET ||
      '',
  ).trim();
}

function signingKey() {
  const secret = baseSecret();
  if (!secret) {
    const error = new Error('client_session_secret_not_configured') as Error & {
      status?: number;
    };
    error.status = 503;
    throw error;
  }

  return secret;
}

function encodeJson(value: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeJson(value: string): Record<string, unknown> | null {
  try {
    return JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => clean(item)).filter(Boolean);
}

export function signClientSessionToken(
  input: Record<string, unknown>,
  ttlSeconds = DEFAULT_TTL_SECONDS,
) {
  const sub = clean(input.uid || input.sub || input.email);
  const orgId = clean(input.orgId);
  const role = clean(input.role);

  if (!sub || !orgId || !role) {
    throw new Error('invalid_client_session_subject');
  }

  const now = Math.floor(Date.now() / 1000);
  const safeTtl = Math.max(
    300,
    Math.min(Math.floor(ttlSeconds || DEFAULT_TTL_SECONDS), MAX_TTL_SECONDS),
  );

  const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeJson({
    sub,
    uid: sub,
    orgId,
    email: clean(input.email) || null,
    orgType: clean(input.orgType) || null,
    workspace: clean(input.workspace) || null,
    role,
    scopes: stringArray(input.scopes),
    orgName: clean(input.orgName) || null,
    orgStatus: clean(input.orgStatus) || null,
    iat: now,
    exp: now + safeTtl,
    iss: SESSION_ISSUER,
    aud: SESSION_AUDIENCE,
    sessionType: 'client',
  });

  const unsigned = `${header}.${payload}`;
  const signature = crypto
    .createHmac('sha256', signingKey())
    .update(unsigned)
    .digest('base64url');

  return `${unsigned}.${signature}`;
}

export function verifyClientSessionToken(
  token?: string | null,
): ClientSessionTokenPayload | null {
  try {
    const raw = String(token || '').trim();
    const parts = raw.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const header = decodeJson(encodedHeader);
    const payload = decodeJson(encodedPayload);

    if (!header || !payload) return null;
    if (String(header.alg || '').toUpperCase() !== 'HS256') return null;

    const expected = crypto
      .createHmac('sha256', signingKey())
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    if (!safeEqual(signature, expected)) return null;

    const now = Math.floor(Date.now() / 1000);
    const sub = clean(payload.sub || payload.uid);
    const orgId = clean(payload.orgId);
    const role = clean(payload.role);
    const iat = Number(payload.iat || 0);
    const exp = Number(payload.exp || 0);

    if (!sub || !orgId || !role) return null;
    if (payload.iss !== SESSION_ISSUER) return null;
    if (payload.aud !== SESSION_AUDIENCE) return null;
    if (payload.sessionType !== 'client') return null;
    if (!Number.isFinite(iat) || iat > now + 60) return null;
    if (!Number.isFinite(exp) || exp <= now) return null;

    return {
      sub,
      uid: sub,
      orgId,
      email: clean(payload.email) || null,
      orgType: clean(payload.orgType) || null,
      workspace: clean(payload.workspace) || null,
      role,
      scopes: stringArray(payload.scopes),
      orgName: clean(payload.orgName) || null,
      orgStatus: clean(payload.orgStatus) || null,
      iat,
      exp,
      iss: SESSION_ISSUER,
      aud: SESSION_AUDIENCE,
      sessionType: 'client',
    };
  } catch {
    return null;
  }
}

export function readClientSessionToken(req: NextRequest) {
  const cookieToken = req.cookies.get(CLIENT_SESSION_TOKEN_COOKIE)?.value;
  if (cookieToken) return cookieToken;

  const authorization = String(req.headers.get('authorization') || '').trim();
  if (authorization.toLowerCase().startsWith('bearer ')) {
    const bearer = authorization.slice(7).trim();
    if (bearer) return bearer;
  }

  return null;
}

export function readVerifiedClientSession(req: NextRequest) {
  return verifyClientSessionToken(readClientSessionToken(req));
}
