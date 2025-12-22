// apps/api-gateway/app/api/utils/auth.ts
import { NextRequest } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || '';
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE || '';
const ALLOW_ALL_ADMIN = process.env.ALLOW_ALL_ADMIN === 'true';

/**
 * Accept ANY of the following:
 * 1) x-admin-key header === ADMIN_API_KEY
 * 2) Valid Auth0 Bearer token with an admin role/permission
 * 3) Cookie "adm.profile" JSON containing role 'superadmin' or 'admin' (dev-friendly)
 * 4) (dev) ALLOW_ALL_ADMIN=true
 */
export async function verifyAdminRequest(req: NextRequest): Promise<boolean> {
  // 0) Dev escape hatch
  if (ALLOW_ALL_ADMIN) return true;

  // 1) Header key (CLI, CRON, tests)
  const headerKey = req.headers.get('x-admin-key') || '';
  if (ADMIN_API_KEY && headerKey && headerKey === ADMIN_API_KEY) return true;

  // 2) Cookie-based session (Admin UI forwards cookies on server fetch)
  try {
    const rawCookie = req.cookies.get('adm.profile')?.value;
    if (rawCookie) {
      const parsed = JSON.parse(decodeURIComponent(rawCookie));
      const role = String(parsed?.role || parsed?.roles?.[0] || '').toLowerCase();
      if (role === 'superadmin' || role === 'admin') return true;
    }
  } catch {
    // ignore cookie parse errors
  }

  // 3) Auth0 JWT (Authorization: Bearer <token>)
  const auth = req.headers.get('authorization') || '';
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7);
    if (AUTH0_DOMAIN) {
      try {
        const jwks = createRemoteJWKSet(new URL(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`));
        const { payload } = await jwtVerify(token, jwks, {
          issuer: `https://${AUTH0_DOMAIN}/`,
          ...(AUTH0_AUDIENCE ? { audience: AUTH0_AUDIENCE } : {}),
        } as any);

        // Pull role/permission from common places
        const possibleRoles =
          (payload['https://ambulant.example/roles'] as any) ||
          (payload['https://ambulant.example.com/roles'] as any) ||
          (payload['roles'] as any) ||
          (payload['role'] as any) ||
          [];

        const scope =
          (payload['scope'] as string | undefined) || ''; // space-separated scopes
        const permissions =
          (payload['permissions'] as string[] | undefined) || [];

        const rolesArr = Array.isArray(possibleRoles)
          ? possibleRoles.map((r) => String(r).toLowerCase())
          : typeof possibleRoles === 'string'
          ? [possibleRoles.toLowerCase()]
          : [];

        const hasAdminRole =
          rolesArr.includes('admin') || rolesArr.includes('superadmin');
        const hasAdminScope = typeof scope === 'string' && scope.split(' ').includes('admin');
        const hasAdminPermission = Array.isArray(permissions) && permissions.map((p) => p.toLowerCase()).includes('admin');

        if (hasAdminRole || hasAdminScope || hasAdminPermission) return true;
      } catch (err) {
        console.warn('[verifyAdminRequest] JWT verify failed:', String(err));
      }
    }
  }

  return false;
}
