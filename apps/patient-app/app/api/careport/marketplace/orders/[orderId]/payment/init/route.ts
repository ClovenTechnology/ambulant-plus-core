import { NextRequest, NextResponse } from 'next/server';
import { forwardJsonHeaders, getGatewayBase } from '@/app/api/careport/_gw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  const upstream = new URL(`/api/careport/marketplace/orders/${orderId}/payment/init`, base);

  const response = await fetch(upstream, {
    method: 'POST',
    headers: forwardJsonHeaders(req.headers),
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