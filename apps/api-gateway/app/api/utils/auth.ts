// apps/api-gateway/app/api/utils/auth.ts
import { NextRequest } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || '';

/**
 * Quick helper: returns true if (a) x-admin-key header matches ADMIN_API_KEY OR
 * (b) Authorization Bearer token is valid and contains role=admin.
 */
export async function verifyAdminRequest(req: NextRequest): Promise<boolean> {
  // 1) header key
  const headerKey = req.headers.get('x-admin-key') || '';
  if (ADMIN_API_KEY && headerKey === ADMIN_API_KEY) return true;

  // 2) Auth0 JWT
  const auth = req.headers.get('authorization') || '';
  if (!auth?.startsWith('Bearer ')) return false;
  const token = auth.slice(7);

  if (!AUTH0_DOMAIN) return false;

  try {
    // Build JWKS URL and verifier
    const jwks = createRemoteJWKSet(new URL(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`));
    // verify and decode
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://${AUTH0_DOMAIN}/`,
      // audience can be optional; if you use AUDIENCE set it here
      // audience: process.env.AUTH0_AUDIENCE,
    } as any);
    // Expect a role claim or 'roles' array and a preferred_username or sub
    const role = (payload['https://ambulant.example.com/role'] || payload['role'] || payload['https://schemas.openid.net/roles'] || payload['roles']) as any;
    // Accept either direct 'admin' or roles array including 'admin'
    if (!role) return false;
    if (Array.isArray(role)) return role.includes('admin');
    if (typeof role === 'string') return role === 'admin';
    return false;
  } catch (err) {
    console.warn('JWT verify failed', String(err));
    return false;
  }
}
