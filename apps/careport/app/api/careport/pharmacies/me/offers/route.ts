// apps/careport/app/api/careport/pharmacies/me/offers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function forwardHeaders(req: NextRequest) {
  const h = new Headers();
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
    if (value) h.set(key, value);
  });
  h.set('accept', 'application/json');
  return h;
}

export async function GET(req: NextRequest) {
  const incoming = new URL(req.url);
  const upstream = new URL('/api/careport/pharmacies/me/offers', apigwBase());

  incoming.searchParams.forEach((value, key) => {
    upstream.searchParams.set(key, value);
  });

  try {
    const res = await fetch(upstream.toString(), {
      method: 'GET',
      headers: forwardHeaders(req),
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'careport_pharmacy_offers_proxy_failed' },
      { status: 502 },
    );
  }
}
