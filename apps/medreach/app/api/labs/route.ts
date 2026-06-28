// apps/medreach/app/api/labs/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function gatewayBase() {
  return (
    process.env.APIGW_BASE ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_BASE_URL ||
    ''
  ).replace(/\/+$/, '');
}

function gatewayUrl(path: string, search = '') {
  const base = gatewayBase();
  if (!base) return null;

  const cleanPath = path.replace(/^\/+/, '');
  const finalPath =
    base.endsWith('/api') && cleanPath.startsWith('api/')
      ? cleanPath.slice(4)
      : cleanPath;

  return `${base}/${finalPath}${search}`;
}

function copyHeaders(req: NextRequest) {
  const headers = new Headers();

  for (const [key, value] of req.headers.entries()) {
    const lower = key.toLowerCase();

    if (
      lower === 'authorization' ||
      lower === 'cookie' ||
      lower.startsWith('x-')
    ) {
      headers.set(key, value);
    }
  }

  headers.set('accept', 'application/json');
  return headers;
}

function normalizeLabs(raw: any) {
  const data = raw?.data || raw?.labs || raw?.items || [];

  return Array.isArray(data) ? data : [];
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const upstreamUrl = gatewayUrl('/api/medreach/labs', url.search);

  if (!upstreamUrl) {
    return NextResponse.json(
      {
        ok: false,
        error: 'api_gateway_not_configured',
        data: [],
        labs: [],
      },
      { status: 503 },
    );
  }

  const upstream = await fetch(upstreamUrl, {
    method: 'GET',
    headers: copyHeaders(req),
    cache: 'no-store',
  });

  const json = await upstream.json().catch(() => null);

  if (!upstream.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: json?.error || 'labs_upstream_failed',
        detail: json,
        data: [],
        labs: [],
      },
      { status: upstream.status },
    );
  }

  const labs = normalizeLabs(json);

  return NextResponse.json({
    ok: true,
    data: labs,
    labs,
    meta: json?.meta || {
      count: labs.length,
    },
    upstream: json,
  });
}