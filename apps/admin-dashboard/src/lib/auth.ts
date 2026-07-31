// apps/admin-dashboard/src/lib/auth.ts
//
// Native Ambulant Admin authentication.
// Auth0 is not an authentication dependency.

import type { JWTPayload } from 'jose';
import { getSessionFromGateway } from './session';

type VerifyAdminResult =
  | {
      ok: true;
      payload: JWTPayload;
    }
  | {
      ok: false;
      error: string;
      payload?: JWTPayload;
    };

export async function verifyAdminToken(
  _token?: string,
): Promise<VerifyAdminResult> {
  try {
    const session =
      await getSessionFromGateway();

    /*
     * The API Gateway returns authenticated=true only
     * after verifying the signed adm.profile cookie and
     * resolving the matching live AdminUserProfile.
     *
     * Department and route-specific authorisation remains
     * enforced through scopes by middleware and API routes.
     */
    if (
      !session.authenticated ||
      !session.user?.email
    ) {
      return {
        ok: false,
        error: 'missing_admin_session',
      };
    }

    const roles =
      Array.isArray(session.user.roles)
        ? session.user.roles
        : [];

    const scopes =
      Array.isArray(session.user.scopes)
        ? session.user.scopes
        : [];

    return {
      ok: true,
      payload: {
        sub:
          session.user.id ||
          session.user.email,
        email:
          session.user.email,
        name:
          session.user.name,
        roles,
        permissions:
          scopes,
        source:
          'gateway-session',
      } as JWTPayload,
    };
  } catch (error: any) {
    return {
      ok: false,
      error:
        error?.message ||
        'gateway_session_failed',
    };
  }
}