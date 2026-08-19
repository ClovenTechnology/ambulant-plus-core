// apps/admin-dashboard/app/api/admin/training/materials/route.ts

import {
  NextRequest,
  NextResponse,
} from 'next/server';
import {
  gatewayBaseFromEnv,
  requireAdminCaller,
} from '../../clinicians/onboarding/_helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function forward(
  request: NextRequest,
) {
  const caller =
    await requireAdminCaller(
      request,
    );

  if (!caller.ok) {
    return caller.response;
  }

  const gateway =
    gatewayBaseFromEnv();

  const upstreamUrl =
    new URL(
      '/api/admin/training/materials',
      gateway,
    );

  request.nextUrl
    .searchParams
    .forEach(
      (value, key) => {
        upstreamUrl
          .searchParams
          .set(key, value);
      },
    );

  const method =
    request.method
      .toUpperCase();

  const body =
    method === 'GET' ||
    method === 'HEAD'
      ? undefined
      : await request.text();

  const upstreamHeaders =
    new Headers({
      accept:
        'application/json',
      'cache-control':
        'no-store',
      'x-admin-origin':
        request.nextUrl.origin,
    });

  if (body) {
    upstreamHeaders.set(
      'content-type',
      'application/json',
    );
  }

  const cookie =
    request.headers.get(
      'cookie',
    ) || '';

  const authorization =
    request.headers.get(
      'authorization',
    ) || '';

  const adminKey =
    String(
      process.env
        .ADMIN_API_KEY ||
      '',
    ).trim();

  if (cookie) {
    upstreamHeaders.set(
      'cookie',
      cookie,
    );
  }

  if (authorization) {
    upstreamHeaders.set(
      'authorization',
      authorization,
    );
  }

  if (adminKey) {
    upstreamHeaders.set(
      'x-admin-key',
      adminKey,
    );
  }

  const upstream =
    await fetch(
      upstreamUrl,
      {
        method,
        headers:
          upstreamHeaders,
        body,
        cache: 'no-store',
      },
    );

  const text =
    await upstream.text();

  return new NextResponse(
    text,
    {
      status:
        upstream.status,
      headers: {
        'content-type':
          upstream.headers.get(
            'content-type',
          ) ||
          'application/json',
        'cache-control':
          'no-store',
      },
    },
  );
}

export async function GET(
  request: NextRequest,
) {
  return forward(request);
}

export async function PATCH(
  request: NextRequest,
) {
  return forward(request);
}

export async function POST(
  request: NextRequest,
) {
  return forward(request);
}
