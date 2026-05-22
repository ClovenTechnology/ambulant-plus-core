// FILE: apps/patient-app/app/api/careport/stream/route.ts
import { NextRequest } from 'next/server';
import { forwardAuthHeaders, getGatewayBase } from '@/app/api/careport/_gw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sseHeaders() {
  return {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  } as Record<string, string>;
}

function jsonResponse(data: any, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
}

export async function GET(req: NextRequest) {
  const base = getGatewayBase();

  if (!base) {
    return jsonResponse(
      { ok: false, error: 'service_not_configured', service: 'careport_stream' },
      503,
    );
  }

  const incoming = new URL(req.url);
  const upstream = new URL('/api/careport/stream', base);

  incoming.searchParams.forEach((value, key) => {
    upstream.searchParams.set(key, value);
  });

  try {
    const res = await fetch(upstream.toString(), {
      method: 'GET',
      headers: forwardAuthHeaders(req),
      cache: 'no-store',
      signal: req.signal,
    });

    if (res.status === 404) {
      return jsonResponse(
        { ok: false, error: 'careport_stream_service_not_configured' },
        503,
      );
    }

    if (!res.ok) {
      return jsonResponse(
        { ok: false, error: `careport_stream_http_${res.status}` },
        res.status,
      );
    }

    if (!res.body) {
      return jsonResponse(
        { ok: false, error: 'careport_stream_empty_body' },
        502,
      );
    }

    return new Response(res.body, {
      status: 200,
      headers: sseHeaders(),
    });
  } catch (err: any) {
    return jsonResponse(
      { ok: false, error: err?.message || 'careport_stream_proxy_failed' },
      502,
    );
  }
}
