// apps/patient-app/app/api/medreach/stream/route.ts
import { NextRequest } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonResponse(data: any, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
}

function sseHeaders() {
  return {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  } as Record<string, string>;
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

  headers.set('accept', 'text/event-stream');

  return headers;
}

export async function GET(req: NextRequest) {
  const base = apigwBase();

  if (!base) {
    return jsonResponse(
      {
        ok: false,
        error: 'service_not_configured',
        service: 'medreach_stream',
      },
      503,
    );
  }

  const incoming = new URL(req.url);

  const orderId =
    incoming.searchParams.get('orderId') ||
    incoming.searchParams.get('id') ||
    '';

  const drawId = incoming.searchParams.get('drawId') || '';
  const bundleId = incoming.searchParams.get('bundleId') || '';

  if (!orderId && !drawId && !bundleId) {
    return jsonResponse(
      {
        ok: false,
        error: 'orderId_or_drawId_or_bundleId_required',
      },
      400,
    );
  }

  const upstream = new URL('/api/medreach/stream', base);

  if (orderId) upstream.searchParams.set('orderId', orderId);
  if (drawId) upstream.searchParams.set('drawId', drawId);
  if (bundleId) upstream.searchParams.set('bundleId', bundleId);

  try {
    const res = await fetch(upstream.toString(), {
      method: 'GET',
      headers: forwardHeaders(req),
      cache: 'no-store',
      signal: req.signal,
    });

    if (!res.ok) {
      return jsonResponse(
        {
          ok: false,
          error: `medreach_stream_http_${res.status}`,
        },
        res.status === 404 ? 503 : res.status,
      );
    }

    if (!res.body) {
      return jsonResponse(
        {
          ok: false,
          error: 'medreach_stream_empty_body',
        },
        502,
      );
    }

    return new Response(res.body, {
      status: 200,
      headers: sseHeaders(),
    });
  } catch (err: any) {
    return jsonResponse(
      {
        ok: false,
        error: err?.message || 'medreach_stream_proxy_failed',
      },
      502,
    );
  }
}