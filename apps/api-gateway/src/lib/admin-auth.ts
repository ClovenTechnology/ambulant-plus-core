import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import {
  verifyLegacyAdminSessionToken,
} from './admin-session-compat';

const ADMIN_API_KEY =
  process.env.ADMIN_API_KEY || '';

const ALLOW_ALL_ADMIN =
  process.env.ALLOW_ALL_ADMIN === 'true';

function safeEqual(
  left: string,
  right: string,
) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);

  return (
    a.length === b.length &&
    crypto.timingSafeEqual(a, b)
  );
}

function hasTrustedAdminKey(
  request: NextRequest,
) {
  const expected =
    String(ADMIN_API_KEY || '').trim();

  const actual =
    String(
      request.headers.get('x-admin-key') ||
        '',
    ).trim();

  return (
    Boolean(expected) &&
    Boolean(actual) &&
    safeEqual(actual, expected)
  );
}

/**
 * Verifies an Admin request using:
 *
 * 1. The signed Ambulant adm.profile session.
 * 2. ADMIN_API_KEY for trusted machine callers.
 * 3. ALLOW_ALL_ADMIN only where explicitly configured.
 *
 * Auth0 is no longer an authentication dependency.
 */
export async function verifyAdminRequest(
  request: NextRequest,
): Promise<boolean> {
  if (ALLOW_ALL_ADMIN) {
    return true;
  }

  const session =
    verifyLegacyAdminSessionToken(
      request.cookies
        .get('adm.profile')
        ?.value,
    );

  if (session) {
    return true;
  }

  return hasTrustedAdminKey(request);
}

/**
 * Machine-only compatibility guard.
 *
 * This intentionally retains ADMIN_API_KEY for
 * trusted internal callers that have no human session.
 */
export function assertAdmin(
  request: NextRequest,
): void {
  if (
    !ADMIN_API_KEY &&
    process.env.NODE_ENV !== 'production'
  ) {
    return;
  }

  if (!hasTrustedAdminKey(request)) {
    const error: any =
      new Error('Unauthorized');

    error.status = 401;
    throw error;
  }
}
