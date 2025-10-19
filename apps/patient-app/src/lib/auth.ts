// apps/patient-app/src/lib/auth.ts
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN; // e.g. dev-xxxxx.us.auth0.com
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE; // optional, recommended (API Identifier)
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || null;

/**
 * Verify a bearer token against Auth0 JWKS and return the token payload on success.
 * Uses `jose` createRemoteJWKSet under the hood (caching/fetch handled by library).
 *
 * Returns payload or null if verification fails.
 */
export async function verifyAuth0Token(token: string): Promise<JWTPayload | null> {
  if (!AUTH0_DOMAIN) return null;
  try {
    const jwks = createRemoteJWKSet(new URL(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`));
    const options: any = { issuer: `https://${AUTH0_DOMAIN}/` };
    if (AUTH0_AUDIENCE) options.audience = AUTH0_AUDIENCE;
    const { payload } = await jwtVerify(token, jwks, options);
    return payload as JWTPayload;
  } catch (err) {
    // verification failed
    return null;
  }
}

/**
 * Convenience: extract bearer token from NextRequest-like headers string and verify.
 * Accepts either:
 *  - x-admin-key header (matches ADMIN_API_KEY) -> returns { isAdmin: true, payload: null }
 *  - Authorization: Bearer <token> -> verifies token and inspects claims for admin role
 *
 * Admin detection heuristic:
 *  - If token payload contains a claim 'roles' or 'https://ambulant/roles' containing 'admin' => admin
 *  - If token payload contains 'permissions' or scope including 'admin' => admin
 *  - You can customize this to match your Auth0 rule that injects roles into the token.
 */
export async function authorizeAdminFromHeaders(headers: Headers): Promise<{ ok: boolean; payload?: JWTPayload | null; reason?: string }> {
  // 1) admin key header (short-circuit)
  const headerKey = headers.get('x-admin-key') || '';
  if (ADMIN_API_KEY && headerKey && headerKey === ADMIN_API_KEY) {
    return { ok: true, payload: null };
  }

  // 2) bearer token
  const auth = headers.get('authorization') || headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    return { ok: false, reason: 'no_bearer' };
  }
  const token = auth.slice(7).trim();
  const payload = await verifyAuth0Token(token);
  if (!payload) return { ok: false, reason: 'invalid_token' };

  // Common places to put roles/claims:
  // - payload.roles (array)
  // - payload.permissions (array)
  // - a namespaced claim like payload['https://yourapp/roles']
  const rolesClaim = payload['roles'] ?? payload['role'] ?? payload['https://ambulant/roles'] ?? payload['https://ambulant/roles'] ?? null;
  const permissionsClaim = payload['permissions'] ?? payload['scope'] ?? null;

  const hasAdminRole =
    Array.isArray(rolesClaim) ? (rolesClaim as any[]).includes('admin') :
    typeof rolesClaim === 'string' ? rolesClaim === 'admin' :
    false;

  const hasAdminPerm =
    Array.isArray(permissionsClaim) ? (permissionsClaim as any[]).includes('admin') :
    typeof permissionsClaim === 'string' ? permissionsClaim.split(' ').includes('admin') : false;

  if (hasAdminRole || hasAdminPerm) {
    return { ok: true, payload };
  }

  // If you want alternate admin detection (e.g. check email against ADMIN_EMAILS), implement here:
  // const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);
  // if (payload.email && adminEmails.includes(String(payload.email))) return { ok:true, payload };

  return { ok: false, reason: 'not_admin' };
}
