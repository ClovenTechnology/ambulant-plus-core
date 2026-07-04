// apps/admin-dashboard/src/lib/session.ts
// Server-only helper to read the current admin session from the API Gateway,
// forwarding the user's admin-dashboard cookies.

import { cookies } from 'next/headers';

export type GatewaySession = {
  authenticated: boolean;
  tenant?: unknown;
  user?: {
    id: string | null;
    email: string | null;
    name: string | null;
    departmentId: string | null;
    designationId: string | null;
    roles: string[];
    scopes: string[];
  };
};

const APIGW =
  process.env.API_GATEWAY_URL ||
  process.env.API_GATEWAY_BASE_URL ||
  process.env.APIGW_BASE_URL ||
  process.env.APIGW_BASE ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
  process.env.NEXT_PUBLIC_APIGW_BASE ||
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
  ((process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') ? 'https://api-gateway.ambulantplus.co.za' : 'http://localhost:3010');

function gatewayBase() {
  return String(APIGW || '').replace(/\/+$/, '');
}

function serializeRequestCookies(): string {
  try {
    const jar = cookies().getAll();
    return jar.map((c) => c.name + '=' + encodeURIComponent(c.value)).join('; ');
  } catch {
    return '';
  }
}

export async function getSessionFromGateway(): Promise<GatewaySession> {
  const cookieHeader = serializeRequestCookies();

  try {
    const res = await fetch(gatewayBase() + '/api/auth/me', {
      cache: 'no-store',
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });

    if (!res.ok) {
      return { authenticated: false };
    }

    const json = (await res.json().catch(() => null)) as GatewaySession | null;
    return json ?? { authenticated: false };
  } catch {
    return { authenticated: false };
  }
}
