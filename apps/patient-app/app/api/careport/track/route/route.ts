// apps/patient-app/app/api/careport/track/route/route.ts
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
  const upstream = new URL('/api/careport/track/route', base);

  incoming.searchParams.forEach((value, key) => {
    upstream.searchParams.set(key, value);
  });

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
          error: 'careport_tracking_route_service_not_configured',
          route: [],
        },
        { status: 503 },
      );
    }

    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || 'careport_tracking_route_proxy_failed',
        route: [],
      },
      { status: 502 },
    );
  }
}