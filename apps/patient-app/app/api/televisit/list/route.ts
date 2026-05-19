// apps/patient-app/app/api/televisit/list/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function apiGatewayBase() {
  return (
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    ''
  ).replace(/\/+$/, '');
}

function forwardHeaders(req: NextRequest) {
  const headers = new Headers();

  [
    'authorization',
    'cookie',
    'x-ambulant-identity',
    'x-ambulant-user-id',
    'x-ambulant-org-id',
    'x-ambulant-role',
    'x-user-id',
    'x-uid',
    'x-role',
    'x-email',
    'x-name',
    'x-display-name',
    'x-org-id',
    'x-correlation-id',
    'x-request-id',
  ].forEach((key) => {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  });

  headers.set('accept', 'application/json');
  return headers;
}

export async function GET(req: NextRequest) {
  const base = apiGatewayBase();

  if (!base) {
    return NextResponse.json(
      {
        ok: false,
        error: 'api_gateway_base_not_configured',
        items: [],
      },
      { status: 503 },
    );
  }

  const incoming = new URL(req.url);
  const upstream = new URL('/api/televisit/list', base);

  incoming.searchParams.forEach((value, key) => {
    upstream.searchParams.set(key, value);
  });

  try {
    const res = await fetch(upstream.toString(), {
      method: 'GET',
      headers: forwardHeaders(req),
      cache: 'no-store',
    });

    const data = await res.json().catch(() => null);

    if (res.status === 404) {
      return NextResponse.json(
        {
          ok: false,
          error: 'televisit_list_service_not_configured',
          items: [],
        },
        { status: 503 },
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: data?.error || `televisit_gateway_http_${res.status}`,
          items: [],
        },
        { status: res.status },
      );
    }

    const items = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.appointments)
        ? data.appointments
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data)
            ? data
            : [];

    return NextResponse.json(
      {
        ok: true,
        items,
        serverNow: new Date().toISOString(),
        source: 'api_gateway',
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || 'televisit_list_proxy_failed',
        items: [],
      },
      { status: 502 },
    );
  }
}