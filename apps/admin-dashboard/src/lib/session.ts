//apps/admin-dashboard/src/lib/session.ts
// Server-only helper to read the current admin session from the Gateway
// via /api/auth/me, forwarding the user's cookies.
//
// Usage (server component): const session = await getSessionFromGateway()

import { cookies } from 'next/headers';

export type GatewaySession = {
  authenticated: boolean;
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
  process.env.NEXT_PUBLIC_APIGW_BASE ||
  process.env.APIGW_BASE ||
  'http://localhost:3010';

function serializeRequestCookies(): string {
  try {
    const jar = cookies().getAll();
    return jar.map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join('; ');
  } catch {
    return '';
  }
}

export async function getSessionFromGateway(): Promise<GatewaySession> {
  const cookieHeader = serializeRequestCookies();

  try {
    const res = await fetch(`${APIGW}/api/auth/me`, {
      // ensure we don’t cache session
      cache: 'no-store',
      // forward cookies to Gateway so it can read adm.profile etc.
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      // (credentials isn’t required for cross-origin here as we manually forward cookies)
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return { authenticated: false };
    }
    const json = (await res.json()) as GatewaySession;
    return json ?? { authenticated: false };
  } catch {
    return { authenticated: false };
  }
}
