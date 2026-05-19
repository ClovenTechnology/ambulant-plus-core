// apps/patient-app/app/api/careport/state/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  forwardAuthHeaders,
  gatewayNotConfigured,
  getGatewayBase,
  readJsonResponse,
} from '@/app/api/careport/_gw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const base = getGatewayBase();

  if (!base) {
    return gatewayNotConfigured('careport_state');
  }

  const incoming = new URL(req.url);
  const id = (
    incoming.searchParams.get('id') ||
    incoming.searchParams.get('orderId') ||
    ''
  ).trim();

  if (!id) {
    return NextResponse.json(
      { ok: false, error: 'orderId_required' },
      { status: 400 },
    );
  }

  const upstream = new URL(`/api/careport/orders/${encodeURIComponent(id)}`, base);

  try {
    const res = await fetch(upstream.toString(), {
      method: 'GET',
      headers: forwardAuthHeaders(req),
      cache: 'no-store',
    });

    const data = await readJsonResponse(res);

    if (res.status === 404) {
      return NextResponse.json(
        {
          ok: false,
          error: 'careport_order_state_service_not_configured_or_not_found',
        },
        { status: 503 },
      );
    }

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(
      {
        ok: true,
        id,
        state: data?.order ?? data,
        source: 'api_gateway',
      },
      { status: 200 },
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || 'careport_state_proxy_failed',
      },
      { status: 502 },
    );
  }
}