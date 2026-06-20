// apps/clinician-app/app/api/appointments/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function gatewayBase() {
  return (
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    ''
  ).replace(/\/+$/, '');
}

function forwardHeaders(req: NextRequest, includeJson = false) {
  const h = new Headers();

  for (const key of [
    'authorization',
    'cookie',
    'x-ambulant-identity',
    'x-ambulant-user-id',
    'x-ambulant-org-id',
    'x-ambulant-role',
    'x-user-id',
    'x-uid',
    'x-org-id',
    'x-role',
    'x-email',
    'x-request-id',
    'x-correlation-id',
  ]) {
    const value = req.headers.get(key);
    if (value) h.set(key, value);
  }

  h.set('accept', 'application/json');
  if (includeJson) h.set('content-type', 'application/json');
  if (!h.get('x-role') && !h.get('x-ambulant-role')) h.set('x-role', 'clinician');

  return h;
}

async function proxy(req: NextRequest, id: string, method: 'GET' | 'PUT') {
  const gw = gatewayBase();

  if (!gw) {
    return NextResponse.json(
      { ok: false, error: 'api_gateway_url_missing' },
      { status: 500, headers: { 'cache-control': 'no-store' } },
    );
  }

  const upstream = new URL('/api/appointments/' + encodeURIComponent(id), gw);

  const res = await fetch(upstream.toString(), {
    method,
    headers: forwardHeaders(req, method === 'PUT'),
    body: method === 'PUT' ? await req.text() : undefined,
    cache: 'no-store',
  });

  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') || 'application/json',
      'cache-control': 'no-store',
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return proxy(req, params.id, 'GET');
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return proxy(req, params.id, 'PUT');
}
