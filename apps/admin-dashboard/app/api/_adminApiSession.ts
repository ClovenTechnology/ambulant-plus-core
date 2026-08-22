import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';

export type AdminApiSession = {
  authenticated?: boolean;
  tenant?: unknown;
  user?: {
    id?: string | null;
    profileId?: string | null;
    email?: string | null;
    name?: string | null;
    roles?: string[];
    scopes?: string[];
  };
};

function canonicalAuthority(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s&_.:-]+/g, '');
}

export function adminGatewayHeaders(req: NextRequest) {
  const headers = new Headers({
    accept: 'application/json',
    'cache-control': 'no-store',
  });

  const cookie = req.headers.get('cookie');
  const authorization = req.headers.get('authorization');

  if (cookie) headers.set('cookie', cookie);
  if (authorization) headers.set('authorization', authorization);

  headers.set('x-admin-origin', req.nextUrl.origin);

  return headers;
}

export function hasAdminAuthority(
  session: AdminApiSession | null,
  required: string[],
) {
  const roles = Array.isArray(session?.user?.roles)
    ? session?.user?.roles ?? []
    : [];
  const scopes = Array.isArray(session?.user?.scopes)
    ? session?.user?.scopes ?? []
    : [];

  const values = [...roles, ...scopes];
  const exact = new Set(values);
  const canonical = new Set(values.map(canonicalAuthority));

  if (
    exact.has('*') ||
    canonical.has('adminall') ||
    canonical.has('superadmin')
  ) {
    return true;
  }

  return required.some((value) => {
    if (exact.has(value)) return true;
    const normalized = canonicalAuthority(value);
    return Boolean(normalized) && canonical.has(normalized);
  });
}

export async function requireAdminApiSession(
  req: NextRequest,
  required: string[],
): Promise<
  | {
      ok: true;
      session: AdminApiSession;
      gatewayHeaders: Headers;
    }
  | {
      ok: false;
      response: NextResponse;
    }
> {
  const gatewayHeaders = adminGatewayHeaders(req);

  let upstream: Response;

  try {
    upstream = await fetch(
      new URL('/api/auth/me', apigwBase()),
      {
        method: 'GET',
        headers: gatewayHeaders,
        cache: 'no-store',
      },
    );
  }
  catch {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: 'admin_session_unavailable',
        },
        {
          status: 503,
          headers: {
            'cache-control': 'no-store',
          },
        },
      ),
    };
  }

  const session = (await upstream
    .json()
    .catch(() => null)) as AdminApiSession | null;

  if (
    !upstream.ok ||
    session?.authenticated !== true ||
    !session.user?.email
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: 'unauthorized',
        },
        {
          status: 401,
          headers: {
            'cache-control': 'no-store',
          },
        },
      ),
    };
  }

  if (!hasAdminAuthority(session, required)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: 'forbidden',
        },
        {
          status: 403,
          headers: {
            'cache-control': 'no-store',
          },
        },
      ),
    };
  }

  return {
    ok: true,
    session,
    gatewayHeaders,
  };
}
