// apps/careport/app/api/careport/pharmacies/me/offers/[offerId]/decline/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function forwardJsonHeaders(req: NextRequest) {
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
  h.set('content-type', 'application/json');
  return h;
}

export async function POST(req: NextRequest, { params }: { params: { offerId: string } }) {
  const offerId = String(params.offerId || '').trim();
  if (!offerId) {
    return NextResponse.json({ ok: false, error: 'offerId_required' }, { status: 400 });
  }

  const incoming = new URL(req.url);
  const upstream = new URL(
    `/api/careport/pharmacies/me/offers/${encodeURIComponent(offerId)}/decline`,
    apigwBase(),
  );

  incoming.searchParams.forEach((value, key) => {
    upstream.searchParams.set(key, value);
  });

  const body = await req.text().catch(() => '{}');

  try {
    const res = await fetch(upstream.toString(), {
      method: 'POST',
      headers: forwardJsonHeaders(req),
      body,
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'careport_pharmacy_offer_decline_proxy_failed' },
      { status: 502 },
    );
  }
}
