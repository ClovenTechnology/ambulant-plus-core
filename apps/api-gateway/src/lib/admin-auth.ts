// apps/api-gateway/src/lib/admin-auth.ts
import { NextRequest } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || '';
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE || '';
const ALLOW_ALL_ADMIN = process.env.ALLOW_ALL_ADMIN === 'true';

/**
 * Admin verification helper.
 *
 * Accepts any of:
 * 1. x-admin-key header matching ADMIN_API_KEY
 * 2. adm.profile cookie with role admin/superadmin
 * 3. Auth0 Bearer token with admin/superadmin role, admin scope, or admin permission
 * 4. ALLOW_ALL_ADMIN=true
 */
export async function verifyAdminRequest(req: NextRequest): Promise<boolean> {
  if (ALLOW_ALL_ADMIN) return true;

  const headerKey = req.headers.get('x-admin-key') || '';
  if (ADMIN_API_KEY && headerKey && headerKey === ADMIN_API_KEY) return true;

  try {
    const rawCookie = req.cookies.get('adm.profile')?.value;

    if (rawCookie) {
      const parsed = JSON.parse(decodeURIComponent(rawCookie));
      const role = String(parsed?.role || parsed?.roles?.[0] || '').toLowerCase();

      if (role === 'superadmin' || role === 'admin') return true;
    }
  } catch {
    // Ignore malformed cookies.
  }

  const auth = req.headers.get('authorization') || '';

  if (auth.startsWith('Bearer ') && AUTH0_DOMAIN) {
    const token = auth.slice(7);

    try {
      const jwks = createRemoteJWKSet(
        new URL(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`),
      );

      const { payload } = await jwtVerify(token, jwks, {
        issuer: `https://${AUTH0_DOMAIN}/`,
        ...(AUTH0_AUDIENCE ? { audience: AUTH0_AUDIENCE } : {}),
      } as any);

      const possibleRoles =
        (payload['https://ambulant.example/roles'] as any) ||
        (payload['https://ambulant.example.com/roles'] as any) ||
        (payload.roles as any) ||
        (payload.role as any) ||
        [];

      const scope = (payload.scope as string | undefined) || '';
      const permissions = (payload.permissions as string[] | undefined) || [];

      const rolesArr = Array.isArray(possibleRoles)
        ? possibleRoles.map((r) => String(r).toLowerCase())
        : typeof possibleRoles === 'string'
          ? [possibleRoles.toLowerCase()]
          : [];

      const hasAdminRole =
        rolesArr.includes('admin') || rolesArr.includes('superadmin');

      const hasAdminScope =
        typeof scope === 'string' && scope.split(' ').includes('admin');

      const hasAdminPermission =
        Array.isArray(permissions) &&
        permissions.map((p) => p.toLowerCase()).includes('admin');

      if (hasAdminRole || hasAdminScope || hasAdminPermission) return true;
    } catch (err) {
      console.warn('[verifyAdminRequest] JWT verify failed:', String(err));
    }
  }

  return false;
}

export function assertAdmin(req: NextRequest): void {
  const key = process.env.ADMIN_API_KEY || '';

  if (!key && process.env.NODE_ENV !== 'production') return;

  const headerKey = req.headers.get('x-admin-key') || '';

  if (!key || headerKey !== key) {
    const err: any = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
}