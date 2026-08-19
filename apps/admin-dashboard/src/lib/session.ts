// apps/admin-dashboard/src/lib/session.ts
// Server-only helper for resolving the current signed Admin session.

import { headers } from 'next/headers';

export type GatewaySession = {
  authenticated: boolean;
  tenant?: unknown;
  user?: {
    id: string | null;
    profileId: string | null;
    email: string | null;
    name: string | null;
    departmentId: string | null;
    designationId: string | null;
    directReportIds?: string[];
    roles: string[];
    scopes: string[];
  };
};

const APIGW =
  process.env.APIGW_BASE ||
  process.env.APIGW_BASE_URL ||
  process.env.API_GATEWAY_BASE_URL ||
  process.env.API_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_APIGW_BASE ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
  (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'
      ? 'https://api-gateway.ambulantplus.co.za'
      : 'http://localhost:3010'
  );

function gatewayBase() {
  return String(APIGW || '')
    .trim()
    .replace(/\/+$/, '');
}

function requestCookieHeader() {
  try {
    return headers().get('cookie') || '';
  } catch {
    return '';
  }
}

export async function getSessionFromGateway(): Promise<GatewaySession> {
  const cookieHeader =
    requestCookieHeader();

  if (!cookieHeader) {
    return {
      authenticated: false,
    };
  }

  try {
    const response =
      await fetch(
        gatewayBase() + '/api/auth/me',
        {
          method: 'GET',
          cache: 'no-store',
          headers: {
            accept: 'application/json',
            cookie: cookieHeader,
          },
        },
      );

    if (!response.ok) {
      return {
        authenticated: false,
      };
    }

    const session =
      await response
        .json()
        .catch(() => null) as GatewaySession | null;

    return (
      session ?? {
        authenticated: false,
      }
    );
  } catch {
    return {
      authenticated: false,
    };
  }
}