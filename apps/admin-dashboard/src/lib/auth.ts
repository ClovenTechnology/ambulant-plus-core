// apps/admin-dashboard/src/lib/auth.ts
// Legacy Auth0 helper retained for compatibility.
// Primary production admin access now falls back to the API Gateway session cookie.

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { getSessionFromGateway } from './session';

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE;

const jwksUri = AUTH0_DOMAIN
  ? new URL('https://' + AUTH0_DOMAIN + '/.well-known/jwks.json').toString()
  : undefined;

const JWKS = jwksUri ? createRemoteJWKSet(new URL(jwksUri)) : null;

type VerifyAdminResult =
  | { ok: true; payload: JWTPayload }
  | { ok: false; error: string; payload?: JWTPayload };

function hasAdminAccessFromSession(session: Awaited<ReturnType<typeof getSessionFromGateway>>) {
  if (!session?.authenticated || !session.user) return false;

  const roles = Array.isArray(session.user.roles) ? session.user.roles : [];
  const scopes = Array.isArray(session.user.scopes) ? session.user.scopes : [];

  return (
    roles.includes('admin') ||
    roles.includes('super_admin') ||
    roles.includes('compliance') ||
    roles.includes('ops') ||
    scopes.includes('admin') ||
    scopes.includes('admin:read') ||
    scopes.includes('admin:write') ||
    scopes.includes('*')
  );
}

async function verifyGatewaySessionFallback(originalError: string): Promise<VerifyAdminResult> {
  try {
    const session = await getSessionFromGateway();

    if (!hasAdminAccessFromSession(session)) {
      return { ok: false, error: originalError };
    }

    const user = session.user;

    return {
      ok: true,
      payload: {
        sub: user?.id || user?.email || 'gateway-admin-session',
        email: user?.email || undefined,
        name: user?.name || undefined,
        roles: user?.roles || [],
        permissions: user?.scopes || [],
        source: 'gateway-session',
      } as JWTPayload,
    };
  } catch {
    return { ok: false, error: originalError };
  }
}

/**
 * Verifies Auth0 bearer token when supplied.
 * If no bearer token is supplied, falls back to the current Admin Dashboard
 * session cookie via API Gateway /api/auth/me.
 */
export async function verifyAdminToken(token?: string): Promise<VerifyAdminResult> {
  if (!token) {
    return verifyGatewaySessionFallback('missing_token');
  }

  if (!JWKS) {
    return verifyGatewaySessionFallback('jwks_missing');
  }

  try {
    const cleaned = token.trim().replace(/^Bearer\s+/i, '');

    const { payload } = await jwtVerify(cleaned, JWKS, {
      audience: AUTH0_AUDIENCE,
      issuer: AUTH0_DOMAIN ? 'https://' + AUTH0_DOMAIN + '/' : undefined,
    });

    const roles =
      (payload as any)['https://ambulant.example/roles'] ??
      (payload as any).roles ??
      null;

    const scope = (payload as any).scope ?? '';
    const permissions = (payload as any).permissions ?? [];

    const isAdmin =
      (Array.isArray(roles) && roles.includes('admin')) ||
      (typeof scope === 'string' && scope.split(' ').includes('admin')) ||
      (Array.isArray(permissions) && permissions.includes('admin'));

    if (!isAdmin) {
      const fallback = await verifyGatewaySessionFallback('insufficient_role');
      if (fallback.ok) return fallback;

      return { ok: false, error: 'insufficient_role', payload: payload as JWTPayload };
    }

    return { ok: true, payload: payload as JWTPayload };
  } catch (err: any) {
    const message = err?.message || String(err) || 'auth0_verification_failed';
    const fallback = await verifyGatewaySessionFallback(message);
    if (fallback.ok) return fallback;

    return { ok: false, error: message };
  }
}
