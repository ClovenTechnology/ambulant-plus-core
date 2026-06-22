
// apps/admin-dashboard/app/api/admin/patients/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function trimSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function gatewayBase(req: NextRequest) {
  const configured =
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    '';

  if (configured.trim()) return trimSlash(configured.trim());

  const host = req.headers.get('host') || '';
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return 'http://127.0.0.1:3010';
  }

  return 'https://api.ambulantplus.co.za';
}

function forwardHeaders(req: NextRequest) {
  const headers = new Headers();
  const cookie = req.headers.get('cookie');
  const authorization = req.headers.get('authorization');
  const adminKey = process.env.ADMIN_API_KEY?.trim();

  headers.set('accept', 'application/json');
  headers.set('x-role', 'admin');

  if (cookie) headers.set('cookie', cookie);
  if (authorization) headers.set('authorization', authorization);
  if (adminKey) headers.set('x-admin-key', adminKey);

  const uid = req.headers.get('x-uid');
  const orgId = req.headers.get('x-org-id');
  const identity = req.headers.get('x-ambulant-identity');

  if (uid) headers.set('x-uid', uid);
  if (orgId) headers.set('x-org-id', orgId);
  if (identity) headers.set('x-ambulant-identity', identity);

  return headers;
}

export async function GET(req: NextRequest) {
  try {
    const upstream = new URL('/api/admin/patients', gatewayBase(req));
    req.nextUrl.searchParams.forEach((value, key) => upstream.searchParams.set(key, value));

    const res = await fetch(upstream.toString(), {
      method: 'GET',
      headers: forwardHeaders(req),
      cache: 'no-store',
    });

    const text = await res.text().catch(() => '');

    return new NextResponse(text || JSON.stringify({ ok: res.ok }), {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') || 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'admin_patients_proxy_failed', items: [] },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  }
}
