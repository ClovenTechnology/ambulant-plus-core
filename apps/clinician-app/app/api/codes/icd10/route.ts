// apps/clinician-app/app/api/codes/icd10/route.ts
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

function copyHeaders(req: NextRequest) {
  const headers = new Headers();
  const passthrough = [
    'authorization',
    'cookie',
    'x-uid',
    'x-role',
    'x-org',
    'x-org-id',
    'x-admin-key',
  ];

  for (const key of passthrough) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  headers.set('accept', 'application/json');
  return headers;
}

export async function GET(req: NextRequest) {
  try {
    const base = apiGatewayBase();

    if (!base) {
      return NextResponse.json(
        { ok: false, error: 'api_gateway_base_not_configured', results: [] },
        { status: 503 },
      );
    }

    const incoming = new URL(req.url);
    const target = new URL('/api/codes/icd10', base);

    incoming.searchParams.forEach((value, key) => {
      target.searchParams.set(key, value);
    });

    const upstream = await fetch(target.toString(), {
      cache: 'no-store',
      headers: copyHeaders(req),
    });

    const data = await upstream.json().catch(() => null);

    return NextResponse.json(data ?? { ok: false, results: [] }, {
      status: upstream.status,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || 'icd10_proxy_failed',
        results: [],
      },
      { status: 500 },
    );
  }
}