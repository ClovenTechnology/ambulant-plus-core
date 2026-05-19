// apps/patient-app/app/api/availability/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function trimSlash(value: string) {
  return String(value || '').replace(/\/+$/, '');
}

function gatewayBase() {
  return trimSlash(
    process.env.APIGW_BASE ||
      process.env.API_GATEWAY_BASE_URL ||
      process.env.API_GATEWAY_URL ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
      '',
  );
}

function forwardHeaders(req: NextRequest) {
  const headers = new Headers();

  for (const key of [
    'authorization',
    'cookie',
    'x-uid',
    'x-user-id',
    'x-role',
    'x-org',
    'x-org-id',
    'x-ambulant-identity',
    'x-ambulant-user-id',
    'x-ambulant-org-id',
    'x-ambulant-role',
  ]) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  headers.set('accept', 'application/json');
  return headers;
}

export async function GET(req: NextRequest) {
  const base = gatewayBase();

  if (!base) {
    return NextResponse.json(
      {
        ok: false,
        error: 'service_not_configured',
        clinicians: [],
        slots: [],
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const incoming = new URL(req.url);
    const upstream = new URL('/api/availability', base);

    incoming.searchParams.forEach((value, key) => {
      upstream.searchParams.set(key, value);
    });

    const res = await fetch(upstream.toString(), {
      method: 'GET',
      headers: forwardHeaders(req),
      cache: 'no-store',
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: data?.error || data?.message || `availability_http_${res.status}`,
          clinicians: [],
          slots: [],
        },
        { status: res.status, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const clinicians = Array.isArray(data)
      ? []
      : Array.isArray(data?.clinicians)
        ? data.clinicians
        : [];

    const slots = Array.isArray(data?.slots) ? data.slots : [];

    return NextResponse.json(
      {
        ok: true,
        clinicians,
        slots,
        source: 'api_gateway',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || 'availability_proxy_failed',
        clinicians: [],
        slots: [],
      },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}