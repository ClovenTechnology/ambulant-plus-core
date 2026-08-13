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

  const upstream =
    await fetch(
      upstreamUrl,
      {
        method,
        headers: {
          accept:
            'application/json',
          ...(body
            ? {
                'content-type':
                  'application/json',
              }
            : {}),
          'x-admin-key':
            process.env
              .ADMIN_API_KEY ||
            '',
        },
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
