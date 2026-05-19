// apps/patient-app/app/api/careport/timeline/route.ts
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
    return gatewayNotConfigured('careport');
  }

  const incoming = new URL(req.url);
  const id = (incoming.searchParams.get('id') || incoming.searchParams.get('orderId') || '').trim();

  if (!id) {
    return NextResponse.json(
      { ok: false, error: 'orderId_required', timeline: [] },
      { status: 400 },
    );
  }

  const upstream = new URL(
    `/api/careport/orders/${encodeURIComponent(id)}/timeline`,
    base,
  );

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
          error: 'careport_timeline_service_not_configured',
          timeline: [],
        },
        { status: 503 },
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: data?.error || `careport_gateway_http_${res.status}`,
          timeline: [],
        },
        { status: res.status },
      );
    }

    const timeline = Array.isArray(data?.timeline)
      ? data.timeline
      : Array.isArray(data?.items)
        ? data.items
        : [];

    return NextResponse.json({
      ok: true,
      id,
      timeline,
      source: 'api_gateway',
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || 'careport_timeline_proxy_failed',
        timeline: [],
      },
      { status: 502 },
    );
  }
}