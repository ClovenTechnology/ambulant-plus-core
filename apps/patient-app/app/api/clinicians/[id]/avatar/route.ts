// apps/patient-app/app/api/clinicians/[id]/avatar/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANONICAL_API_GATEWAY = 'https://api-gateway.ambulantplus.co.za';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
  'content-encoding',
  'content-md5',
  'etag',
]);

function trimSlash(value: string) {
  return String(value || '').replace(/\/+$/, '');
}

function gatewayBase() {
  return trimSlash(
    process.env.APIGW_BASE ||
      process.env.API_GATEWAY_BASE_URL ||
      process.env.API_GATEWAY_URL ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
      CANONICAL_API_GATEWAY,
  );
}

function forwardHeaders(req: NextRequest) {
  const headers = new Headers();

  for (const key of [
    'authorization',
    'cookie',
    'x-ambulant-identity',
    'x-ambulant-user-id',
    'x-ambulant-role',
    'x-ambulant-org-id',
    'x-user-id',
    'x-uid',
    'x-role',
    'x-org-id',
    'x-actor-ref-id',
    'x-patient-id',
    'x-current-patient-id',
    'x-request-id',
    'x-correlation-id',
  ]) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  headers.set('accept', 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8');
  if (!headers.get('x-role') && !headers.get('x-ambulant-role')) headers.set('x-role', 'patient');

  return headers;
}

function relayHeaders(upstream: Response) {
  const headers = new Headers();

  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  headers.delete('content-length');
  headers.delete('transfer-encoding');
  headers.delete('content-encoding');
  headers.delete('etag');

  if (!headers.get('cache-control')) {
    headers.set('cache-control', 'public, max-age=3600, stale-while-revalidate=86400');
  }

  return headers;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const cleanId = decodeURIComponent(String(params.id || '')).trim();
    if (!cleanId) return NextResponse.json({ ok: false, error: 'clinician_id_required' }, { status: 400 });

    const upstreamUrl = new URL(
      `/api/clinicians/${encodeURIComponent(cleanId)}/avatar`,
      gatewayBase(),
    ).toString();

    const upstream = await fetch(upstreamUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: forwardHeaders(req),
    });

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: relayHeaders(upstream),
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: 'clinician_avatar_proxy_failed', detail: String(err?.message || err) },
      { status: 502 },
    );
  }
}
