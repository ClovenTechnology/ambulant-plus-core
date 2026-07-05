// apps/patient-app/app/api/medreach/collect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function forwardJsonHeaders(req: NextRequest) {
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
    'x-email',
    'x-name',
    'x-display-name',
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

  headers.set('content-type', 'application/json');
  headers.set('accept', 'application/json');

  return headers;
}

export async function POST(req: NextRequest) {
  const base = apigwBase();

  if (!base) {
    return json(
      {
        ok: false,
        error: 'service_not_configured',
        service: 'medreach_collect',
      },
      503,
    );
  }

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || body?.orderId || '').trim();
  const status = String(body?.status || 'SAMPLE_COLLECTED').trim();

  if (!id) {
    return json({ ok: false, error: 'orderId_required' }, 400);
  }

  /*
   * Use the gateway lab-order PATCH workflow so collection updates remain tied
   * to the live MedReach order, custody, timeline, and result pipeline.
   */
  const upstream = new URL(`/api/medreach/labs/orders/${encodeURIComponent(id)}`, base);

  try {
    const res = await fetch(upstream.toString(), {
      method: 'PATCH',
      headers: forwardJsonHeaders(req),
      body: JSON.stringify({
        action: 'updateStatus',
        status,
      }),
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 404) {
      return json(
        {
          ok: false,
          error: 'medreach_collect_service_not_configured_or_order_not_found',
        },
        503,
      );
    }

    return json(data, res.status);
  } catch (err: any) {
    return json(
      {
        ok: false,
        error: err?.message || 'medreach_collect_proxy_failed',
      },
      502,
    );
  }
}