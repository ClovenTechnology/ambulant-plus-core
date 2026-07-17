// apps/admin-dashboard/app/api/orders/index/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type AuthMePayload = {
  authenticated?: boolean;
  user?: {
    id?: string;
    userId?: string;
    email?: string;
    scopes?: unknown[];
  };
};

function jsonError(
  error: string,
  status: number,
) {
  return NextResponse.json(
    {
      ok: false,
      error,
      rows: [],
      warnings: [],
    },
    {
      status,
      headers: {
        'Cache-Control':
          'no-store',
      },
    },
  );
}

function gatewayHeaders(
  req: NextRequest,
) {
  const headers =
    new Headers({
      accept:
        'application/json',
      'cache-control':
        'no-store',
    });

  const pass = [
    'authorization',
    'cookie',
    'x-user-id',
    'x-user-role',
    'x-user-roles',
    'x-org-id',
    'x-tenant-id',
    'x-correlation-id',
    'x-ambulant-identity',
  ];

  for (
    const key of
    pass
  ) {
    const value =
      req.headers.get(
        key,
      );

    if (value) {
      headers.set(
        key,
        value,
      );
    }
  }

  const adminKey =
    process.env
      .ADMIN_API_KEY
      ?.trim();

  if (adminKey) {
    headers.set(
      'x-admin-key',
      adminKey,
    );
  }

  return headers;
}

async function requireOrdersCaller(
  req: NextRequest,
) {
  const cookie =
    req.headers.get(
      'cookie',
    ) ||
    '';

  const authorization =
    req.headers.get(
      'authorization',
    ) ||
    '';

  if (
    !cookie &&
    !authorization
  ) {
    return jsonError(
      'unauthorized',
      401,
    );
  }

  let response:
    Response;

  try {
    response =
      await fetch(
        new URL(
          '/api/auth/me',
          apigwBase(),
        ),
        {
          method:
            'GET',
          headers:
            gatewayHeaders(
              req,
            ),
          cache:
            'no-store',
        },
      );
  } catch {
    return jsonError(
      'orders_auth_unavailable',
      503,
    );
  }

  const body =
    (
      await response
        .json()
        .catch(
          () =>
            null,
        )
    ) as
      | AuthMePayload
      | null;

  if (
    !response.ok ||
    body
      ?.authenticated !==
      true ||
    !body.user
  ) {
    return jsonError(
      'unauthorized',
      401,
    );
  }

  return null;
}

export async function GET(
  req: NextRequest,
) {
  const rejection =
    await requireOrdersCaller(
      req,
    );

  if (rejection) {
    return rejection;
  }

  const upstream =
    new URL(
      '/api/orders/index',
      apigwBase(),
    );

  req.nextUrl
    .searchParams
    .forEach(
      (
        value,
        key,
      ) =>
        upstream
          .searchParams
          .set(
            key,
            value,
          ),
    );

  upstream
    .searchParams
    .set(
      'scope',
      'all',
    );

  try {
    const response =
      await fetch(
        upstream.toString(),
        {
          method:
            'GET',
          headers:
            gatewayHeaders(
              req,
            ),
          cache:
            'no-store',
        },
      );

    const text =
      await response.text();

    return new NextResponse(
      text,
      {
        status:
          response.status,
        headers: {
          'content-type':
            response.headers.get(
              'content-type',
            ) ||
            'application/json',
          'cache-control':
            'no-store',
        },
      },
    );
  } catch {
    return jsonError(
      'orders_upstream_unavailable',
      502,
    );
  }
}
