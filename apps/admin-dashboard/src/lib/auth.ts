// server-only helper: verify Auth0 JWT using JWKS (jose)
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE;

if (!AUTH0_DOMAIN) {
  console.warn('AUTH0_DOMAIN not set; admin JWT verification will fail.');
}

const jwksUri = AUTH0_DOMAIN ? new URL(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`).toString() : undefined;
const JWKS = jwksUri ? createRemoteJWKSet(new URL(jwksUri)) : null;

/**
 * Verifies bearer token and asserts admin role/permission.
 * Expects Auth0-issued access token (RS256) with aud === AUTH0_AUDIENCE.
 * Adjust checks below according to your Auth0 token claims (roles, permissions, scope).
 */
export async function verifyAdminToken(token?: string) {
  if (!token) return { ok: false, error: 'missing_token' };
  if (!JWKS) return { ok: false, error: 'jwks_missing' };
  try {
    const cleaned = token.trim().replace(/^Bearer\s+/i, '');
    const { payload } = await jwtVerify(cleaned, JWKS, {
      audience: AUTH0_AUDIENCE,
      issuer: AUTH0_DOMAIN ? `https://${AUTH0_DOMAIN}/` : undefined,
    });

    // Example role check: either `roles` claim or `permissions` or custom claim
    // Adjust the key below to match your Auth0 rule / claims mapping
    const roles = (payload as any)['https://ambulant.example/roles'] ?? (payload as any).roles ?? null;
    const scope = (payload as any).scope ?? '';
    const permissions = (payload as any).permissions ?? [];

    const isAdmin = (Array.isArray(roles) && roles.includes('admin'))
      || (typeof scope === 'string' && scope.split(' ').includes('admin'))
      || (Array.isArray(permissions) && permissions.includes('admin'));

    if (!isAdmin) {
      return { ok: false, error: 'insufficient_role', payload };
    }

    return { ok: true, payload: payload as JWTPayload };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}
