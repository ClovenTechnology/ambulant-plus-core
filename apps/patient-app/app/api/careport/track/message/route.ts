// apps/patient-app/app/api/careport/track/message/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  forwardJsonHeaders,
  gatewayNotConfigured,
  getGatewayBase,
  readJsonResponse,
} from '@/app/api/careport/_gw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const base = getGatewayBase();

  if (!base) {
    return gatewayNotConfigured('careport_tracking_message');
  }

  const body = await req.text();
  const upstream = new URL('/api/careport/track/message', base);

  try {
    const res = await fetch(upstream.toString(), {
      method: 'POST',
      headers: forwardJsonHeaders(req),
      body,
      cache: 'no-store',
    });

    const data = await readJsonResponse(res);

    if (res.status === 404) {
      return NextResponse.json(
        {
          ok: false,
          error: 'careport_tracking_message_service_not_configured',
        },
        { status: 503 },
      );
    }

    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || 'careport_tracking_message_proxy_failed',
      },
      { status: 502 },
    );
  }
}