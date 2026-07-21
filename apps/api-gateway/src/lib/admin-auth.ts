import { NextRequest } from 'next/server';
import {
  createRemoteJWKSet,
  jwtVerify,
} from 'jose';
import {
  readIdentity,
} from '@/src/lib/identity';

const ADMIN_API_KEY =
  process.env.ADMIN_API_KEY || '';
const AUTH0_DOMAIN =
  process.env.AUTH0_DOMAIN || '';
const AUTH0_AUDIENCE =
  process.env.AUTH0_AUDIENCE || '';
const ALLOW_ALL_ADMIN =
  process.env.ALLOW_ALL_ADMIN === 'true';

function canonicalAuthority(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

export async function verifyAdminRequest(
  request: NextRequest,
) {
  if (
    ALLOW_ALL_ADMIN &&
    process.env.NODE_ENV !== 'production'
  ) {
    return true;
  }

  const headerKey =
    request.headers.get('x-admin-key') || '';

  if (
    ADMIN_API_KEY &&
    headerKey &&
    headerKey === ADMIN_API_KEY
  ) {
    return true;
  }

  const who = readIdentity(request.headers);

  if (
    who.trusted === true &&
    who.uid &&
    (
      who.role === 'admin' ||
      who.role === 'admin_staff'
    )
  ) {
    return true;
  }

  const authorization =
    request.headers.get('authorization') || '';

  if (
    authorization.startsWith('Bearer ') &&
    AUTH0_DOMAIN
  ) {
    const token = authorization.slice(7);

    try {
      const jwks = createRemoteJWKSet(
        new URL(
          `https://${AUTH0_DOMAIN}/.well-known/jwks.json`,
        ),
      );

      const { payload } = await jwtVerify(
        token,
        jwks,
        {
          issuer: `https://${AUTH0_DOMAIN}/`,
          ...(AUTH0_AUDIENCE
            ? { audience: AUTH0_AUDIENCE }
            : {}),
        } as any,
      );

      const possibleRoles =
        payload['https://ambulant.example/roles'] ||
        payload['https://ambulant.example.com/roles'] ||
        payload.roles ||
        payload.role ||
        [];
      const roles = Array.isArray(possibleRoles)
        ? possibleRoles.map(canonicalAuthority)
        : [canonicalAuthority(possibleRoles)];
      const scope =
        typeof payload.scope === 'string'
          ? payload.scope.split(' ')
          : [];
      const permissions =
        Array.isArray(payload.permissions)
          ? payload.permissions.map((item) =>
              String(item || '').toLowerCase(),
            )
          : [];

      if (
        roles.includes('admin') ||
        roles.includes('superadmin') ||
        scope.includes('admin') ||
        scope.includes('admin:all') ||
        permissions.includes('admin') ||
        permissions.includes('admin:all')
      ) {
        return true;
      }
    }
    catch (error) {
      console.warn(
        '[verifyAdminRequest] JWT verification failed:',
        String(error),
      );
    }
  }

  return false;
}

export function assertAdmin(
  request: NextRequest,
) {
  const key = process.env.ADMIN_API_KEY || '';

  if (!key && process.env.NODE_ENV !== 'production') {
    return;
  }

  const headerKey =
    request.headers.get('x-admin-key') || '';

  if (!key || headerKey !== key) {
    const error = new Error(
      'Unauthorized',
    ) as Error & { status?: number };
    error.status = 401;
    throw error;
  }
}
