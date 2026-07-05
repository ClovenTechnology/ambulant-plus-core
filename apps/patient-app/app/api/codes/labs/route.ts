import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANONICAL_API_GATEWAY = 'https://api-gateway.ambulantplus.co.za';

function isProductionRuntime() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

function cleanBase(value: unknown) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function apiGatewayBase() {
  const configured =
    cleanBase(process.env.APIGW_BASE) ||
    cleanBase(process.env.API_GATEWAY_BASE_URL) ||
    cleanBase(process.env.API_GATEWAY_URL) ||
    cleanBase(process.env.NEXT_PUBLIC_APIGW_BASE) ||
    cleanBase(process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL) ||
    cleanBase(process.env.NEXT_PUBLIC_API_GATEWAY_URL);

  if (configured) return configured;
  if (isProductionRuntime()) return CANONICAL_API_GATEWAY;
  throw new Error('APIGW_BASE_required');
}

function copyHeaders(req: NextRequest) {
  const headers = new Headers();
  for (const key of ['authorization', 'cookie', 'x-uid', 'x-role', 'x-org', 'x-org-id', 'x-admin-key']) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }
  headers.set('accept', 'application/json');
  return headers;
}

export async function GET(req: NextRequest) {
  try {
    const incoming = new URL(req.url);
    const q = incoming.searchParams.get('q')?.trim() || '';

    if (q.length < 2) {
      return NextResponse.json({ ok: true, items: [] });
    }

    const target = new URL('/api/codes/labs', apiGatewayBase());
    incoming.searchParams.forEach((value, key) => target.searchParams.set(key, value));

    const upstream = await fetch(target.toString(), {
      cache: 'no-store',
      headers: copyHeaders(req),
    });

    const data = await upstream.json().catch(() => null);
    return NextResponse.json(
      data ?? { ok: false, error: 'labs_empty_response', items: [] },
      { status: upstream.status },
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'labs_proxy_failed', items: [] },
      { status: 502 },
    );
  }
}
