// apps/patient-app/src/lib/auth.ts
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

const AUTH0_DOMAIN = (process.env.AUTH0_DOMAIN || '').trim(); // e.g. dev-xxxxx.us.auth0.com
const AUTH0_AUDIENCE = (process.env.AUTH0_AUDIENCE || '').trim(); // optional but recommended (API Identifier)
const ADMIN_API_KEY = (process.env.ADMIN_API_KEY || '').trim() || null;

function assertDomain(domain: string) {
  // allow dev-xxxxx.us.auth0.com OR your custom domain
  return domain && !domain.includes('http') && domain.includes('.');
}

/**
 * Verify a bearer token against Auth0 JWKS and return payload on success.
 */
export async function verifyAuth0Token(token: string): Promise<JWTPayload | null> {
  if (!assertDomain(AUTH0_DOMAIN)) return null;

  try {
    const jwks = createRemoteJWKSet(new URL(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`));
    const options: any = { issuer: `https://${AUTH0_DOMAIN}/` };
    if (AUTH0_AUDIENCE) options.audience = AUTH0_AUDIENCE;

    const { payload } = await jwtVerify(token, jwks, options);
    return payload as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Admin authorization helper.
 * Supports:
 *  - x-admin-key header
 *  - Authorization: Bearer <token> + role/permission claim heuristics
 */
export async function authorizeAdminFromHeaders(
  headers: Headers
): Promise<{ ok: boolean; payload?: JWTPayload | null; reason?: string }> {
  // 1) admin key header short-circuit
  const headerKey = (headers.get('x-admin-key') || '').trim();
  if (ADMIN_API_KEY && headerKey && headerKey === ADMIN_API_KEY) {
    return { ok: true, payload: null };
  }

  // 2) bearer token
  const auth = headers.get('authorization') || headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return { ok: false, reason: 'no_bearer' };

  const token = auth.slice(7).trim();
  const payload = await verifyAuth0Token(token);
  if (!payload) return { ok: false, reason: 'invalid_token' };

  const rolesClaim =
    (payload as any).roles ??
    (payload as any).role ??
    (payload as any)['https://ambulant/roles'] ??
    (payload as any)['https://ambulant.io/roles'] ??
    null;

  const permissionsClaim =
    (payload as any).permissions ??
    (payload as any).scope ??
    (payload as any)['https://ambulant/permissions'] ??
    null;

  const hasAdminRole =
    Array.isArray(rolesClaim) ? rolesClaim.includes('admin') :
    typeof rolesClaim === 'string' ? rolesClaim.split(' ').includes('admin') || rolesClaim === 'admin' :
    false;

  const hasAdminPerm =
    Array.isArray(permissionsClaim) ? permissionsClaim.includes('admin') :
    typeof permissionsClaim === 'string' ? permissionsClaim.split(' ').includes('admin') :
    false;

  if (hasAdminRole || hasAdminPerm) return { ok: true, payload };

  return { ok: false, reason: 'not_admin' };
}
