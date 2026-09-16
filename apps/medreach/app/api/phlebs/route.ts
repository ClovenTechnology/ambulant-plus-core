import { withPartnerRoute } from '@/lib/partner-route';
// apps/medreach/app/api/phlebs/route.ts
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

function normalizePhlebs(raw: any) {
  const data = raw?.data || raw?.phlebs || raw?.items || [];

  return Array.isArray(data) ? data : [];
}

async function partnerOriginalGET(req: NextRequest) {
  const url = new URL(req.url);
  const upstreamUrl = gatewayUrl('/api/medreach/phlebs', url.search);

  if (!upstreamUrl) {
    return NextResponse.json(
      {
        ok: false,
        error: 'api_gateway_not_configured',
        data: [],
        phlebs: [],
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
        error: json?.error || 'phlebs_upstream_failed',
        detail: json,
        data: [],
        phlebs: [],
      },
      { status: upstream.status },
    );
  }

  const phlebs = normalizePhlebs(json);

  return NextResponse.json({
    ok: true,
    data: phlebs,
    phlebs,
    meta: json?.meta || {
      count: phlebs.length,
    },
    upstream: json,
  });
}

async function partnerOriginalPOST(req: NextRequest) {
  const upstreamUrl = gatewayUrl('/api/medreach/phlebs');

  if (!upstreamUrl) {
    return NextResponse.json(
      { ok: false, error: 'api_gateway_not_configured' },
      { status: 503 },
    );
  }

  const body = await req.text();

  const upstream = await fetch(upstreamUrl, {
    method: 'POST',
    headers: {
      ...Object.fromEntries(copyHeaders(req).entries()),
      'content-type': req.headers.get('content-type') || 'application/json',
    },
    body,
    cache: 'no-store',
  });

  const json = await upstream.json().catch(() => null);

  return NextResponse.json(json || { ok: upstream.ok }, {
    status: upstream.status,
  });
}
export const GET = withPartnerRoute(partnerOriginalGET);
export const POST = withPartnerRoute(partnerOriginalPOST);
