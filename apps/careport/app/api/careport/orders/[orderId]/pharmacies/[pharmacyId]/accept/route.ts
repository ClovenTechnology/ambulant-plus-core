// apps/careport/app/api/careport/orders/[orderId]/pharmacies/[pharmacyId]/accept/route.ts
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

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string; pharmacyId: string } },
) {
  const orderId = String(params.orderId || '').trim();
  const pharmacyId = String(params.pharmacyId || '').trim();

  if (!orderId || !pharmacyId) {
    return NextResponse.json({ ok: false, error: 'orderId_and_pharmacyId_required' }, { status: 400 });
  }

  const upstream = new URL(
    `/api/careport/orders/${encodeURIComponent(orderId)}/pharmacies/${encodeURIComponent(pharmacyId)}/accept`,
    apigwBase(),
  );

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
      { ok: false, error: err?.message || 'careport_offer_accept_proxy_failed' },
      { status: 502 },
    );
  }
}
