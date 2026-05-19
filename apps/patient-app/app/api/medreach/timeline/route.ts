// apps/patient-app/app/api/medreach/timeline/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function forwardHeaders(req: NextRequest) {
  const headers = new Headers();

  const passthrough = [
    'authorization',
    'cookie',
    'x-ambulant-identity',
    'x-ambulant-user-id',
    'x-ambulant-org-id',
    'x-ambulant-role',
    'x-user-id',
    'x-uid',
    'x-role',
    'x-org-id',
    'x-correlation-id',
    'x-request-id',
  ];

  for (const key of passthrough) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  if (!headers.has('x-role')) {
    headers.set('x-role', 'patient');
  }

  headers.set('accept', 'application/json');

  return headers;
}

export async function GET(req: NextRequest) {
  const base = apigwBase();

  if (!base) {
    return json(
      {
        ok: false,
        error: 'service_not_configured',
        service: 'medreach_timeline',
        timeline: [],
      },
      503,
    );
  }

  const incoming = new URL(req.url);
  const id = (
    incoming.searchParams.get('id') ||
    incoming.searchParams.get('orderId') ||
    ''
  ).trim();

  if (!id) {
    return json(
      {
        ok: false,
        error: 'orderId_required',
        timeline: [],
      },
      400,
    );
  }

  /*
   * There is no confirmed gateway /timeline route.
   * Build a timeline from the real lab-order projection where available.
   */
  const upstream = new URL(`/api/medreach/labs/orders/${encodeURIComponent(id)}`, base);

  try {
    const res = await fetch(upstream.toString(), {
      method: 'GET',
      headers: forwardHeaders(req),
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 404) {
      return json(
        {
          ok: false,
          error: 'medreach_timeline_service_not_configured_or_order_not_found',
          timeline: [],
        },
        503,
      );
    }

    if (!res.ok) {
      return json(
        {
          ok: false,
          error: data?.error || `medreach_gateway_http_${res.status}`,
          timeline: [],
        },
        res.status,
      );
    }

    const order = data?.data ?? data?.order ?? data;

    const timeline = [
      ['created', order.createdAt],
      ['assigned', order.assignedAt],
      ['collection_scheduled', order.collectionTime],
      ['received_at_lab', order.receivedAtLabAt],
      ['accepted', order.acceptedAt],
      ['rejected', order.rejectedAt],
      ['result_ready', order.resultReadyAt],
      ['result_sent', order.resultSentAt],
    ]
      .filter(([, at]) => Boolean(at))
      .map(([status, at]) => ({
        status,
        at,
      }))
      .sort((a, b) => Date.parse(String(a.at)) - Date.parse(String(b.at)));

    return json({
      ok: true,
      id,
      timeline,
      source: 'api_gateway',
    });
  } catch (err: any) {
    return json(
      {
        ok: false,
        error: err?.message || 'medreach_timeline_proxy_failed',
        timeline: [],
      },
      502,
    );
  }
}