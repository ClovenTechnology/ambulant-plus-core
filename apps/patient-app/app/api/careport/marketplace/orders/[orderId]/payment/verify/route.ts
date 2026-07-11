import { NextRequest, NextResponse } from 'next/server';
import { forwardAuthHeaders, forwardJsonHeaders, getGatewayBase } from '@/app/api/careport/_gw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function marketplaceReturnUrl(req: NextRequest, orderId: string, payment: string, reference: string, message?: string) {
  const url = new URL(`/careport/marketplace/${encodeURIComponent(orderId)}`, req.url);
  url.searchParams.set('payment', payment);

  if (reference) {
    url.searchParams.set('paymentRef', reference);
  }

  if (message) {
    url.searchParams.set('message', message);
  }

  return url;
}

export async function GET(
  req: NextRequest,
  ctx: { params: { orderId: string } },
) {
  const base = getGatewayBase();

  if (!base) {
    const orderId = clean(ctx?.params?.orderId, 120);
    return NextResponse.redirect(
      marketplaceReturnUrl(req, orderId, 'failed', '', 'careport_gateway_not_configured'),
      { status: 303 },
    );
  }

  const orderId = clean(ctx?.params?.orderId, 120);
  const url = new URL(req.url);
  const reference =
    clean(url.searchParams.get('reference'), 180) ||
    clean(url.searchParams.get('trxref'), 180) ||
    clean(url.searchParams.get('paymentRef'), 180) ||
    clean(url.searchParams.get('paymentReference'), 180);

  if (!orderId || !reference) {
    return NextResponse.redirect(
      marketplaceReturnUrl(req, orderId, 'failed', reference, 'payment_reference_required'),
      { status: 303 },
    );
  }

  const upstream = new URL(`/api/careport/marketplace/orders/${encodeURIComponent(orderId)}/payment/verify`, base);
  upstream.searchParams.set('reference', reference);

  const response = await fetch(upstream, {
    method: 'GET',
    headers: forwardAuthHeaders(req),
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({}));
  const payment = response.ok && payload?.paid ? 'success' : response.ok ? 'pending' : 'failed';

  return NextResponse.redirect(
    marketplaceReturnUrl(req, orderId, payment, reference, payload?.error || payload?.status || ''),
    { status: 303 },
  );
}

export async function POST(
  req: NextRequest,
  ctx: { params: { orderId: string } },
) {
  const base = getGatewayBase();

  if (!base) {
    return NextResponse.json(
      { ok: false, error: 'careport_gateway_not_configured' },
      { status: 503 },
    );
  }

  const orderId = encodeURIComponent(String(ctx?.params?.orderId || ''));
  const upstream = new URL(`/api/careport/marketplace/orders/${orderId}/payment/verify`, base);

  const response = await fetch(upstream, {
    method: 'POST',
    headers: forwardJsonHeaders(req),
    body: await req.text(),
    cache: 'no-store',
  });

  const text = await response.text();

  return new NextResponse(text, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') || 'application/json',
      'cache-control': 'no-store',
    },
  });
}