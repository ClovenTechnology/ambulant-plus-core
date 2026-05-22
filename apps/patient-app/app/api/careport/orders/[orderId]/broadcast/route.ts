// FILE: apps/patient-app/app/api/careport/orders/[orderId]/broadcast/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  forwardJsonHeaders,
  gatewayNotConfigured,
  getGatewayBase,
  readJsonResponse,
} from '@/app/api/careport/_gw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { orderId: string } }) {
  const orderId = String(params.orderId || '').trim();

  if (!orderId) {
    return NextResponse.json({ ok: false, error: 'orderId_required' }, { status: 400 });
  }

  const base = getGatewayBase();

  if (!base) {
    return gatewayNotConfigured('careport_broadcast');
  }

  const body = await req.text().catch(() => '{}');
  const upstream = new URL(`/api/careport/orders/${encodeURIComponent(orderId)}/broadcast`, base);

  try {
    const res = await fetch(upstream.toString(), {
      method: 'POST',
      headers: forwardJsonHeaders(req),
      body: body || '{}',
      cache: 'no-store',
    });

    const data = await readJsonResponse(res);

    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'careport_broadcast_proxy_failed' },
      { status: 502 },
    );
  }
}
