// apps/admin-dashboard/src/lib/auth.ts
//
// Native Ambulant Admin authentication.
// Auth0 has been retired as an authentication dependency.
// Admin access is established through the signed API Gateway session.

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
      session.user.roles || [];


    const isAdmin =
      roles.includes('admin') ||
      roles.includes('superadmin') ||
      roles.includes('admin_staff');


    if (!isAdmin) {
      return {
        ok: false,
        error: 'insufficient_role',
      };
    }


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
          session.user.scopes || [],

        source:
          'gateway-session',

      } as JWTPayload,
    };

  }
  catch (error: any) {

    return {
      ok: false,
      error:
        error?.message ||
        'gateway_session_failed',
    };

  }
}