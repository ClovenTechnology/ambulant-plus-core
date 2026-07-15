import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function gatewayBase() {
  return (
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.API_BASE_URL ||
    ''
  ).replace(/\/+$/, '');
}

function responseHeaders() {
  return {
    'content-type': 'application/json',
    'cache-control': 'no-store',
  };
}

function forwardHeaders(req: NextRequest) {
  const headers = new Headers();

  const allowed = [
    'authorization',
    'cookie',
    'content-type',
    'x-uid',
    'x-role',
    'x-org-id',
    'x-ambulant-identity',
    'x-request-id',
  ];

  for (const key of allowed) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  if (!headers.has('content-type')) headers.set('content-type', 'application/json');

  return headers;
}

async function proxyPresence(req: NextRequest, method: 'GET' | 'POST') {
  const base = gatewayBase();

  if (!base) {
    return NextResponse.json(
      { ok: false, error: 'api_gateway_not_configured' },
      { status: 500, headers: responseHeaders() },
    );
  }

  const url = new URL('/api/televisit/presence', base);

  if (method === 'GET') {
    req.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
  }

  const init: RequestInit = {
    method,
    cache: 'no-store',
    headers: forwardHeaders(req),
  };

  if (method === 'POST') {
    init.body = await req.text();
  }

  const upstream = await fetch(url.toString(), init);
  const text = await upstream.text();

  return new NextResponse(text || '{}', {
    status: upstream.status,
    headers: responseHeaders(),
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'cache-control': 'no-store',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization,cookie,x-uid,x-role,x-org-id,x-ambulant-identity,x-request-id',
    },
  });
}

export async function GET(req: NextRequest) {
  return proxyPresence(req, 'GET');
}

export async function POST(req: NextRequest) {
  return proxyPresence(req, 'POST');
}
