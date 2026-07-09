import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function gatewayBase() {
  return (
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    ''
  ).replace(/\/$/, '');
}

function forwardHeaders(req: NextRequest) {
  const headers = new Headers();

  [
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
    'idempotency-key',
    'x-idempotency-key',
  ].forEach((key) => {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  });

  if (!headers.get('x-role')) headers.set('x-role', 'admin');
  if (!headers.get('x-ambulant-role')) headers.set('x-ambulant-role', 'admin');
  if (!headers.get('x-org-id')) headers.set('x-org-id', 'org-default');

  headers.set('content-type', 'application/json');

  return headers;
}

async function readJson(res: Response) {
  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: text || 'invalid_gateway_response' };
  }
}

export async function GET(req: NextRequest) {
  const base = gatewayBase();

  if (!base) {
    return NextResponse.json({ ok: false, error: 'api_gateway_base_url_missing', items: [] }, { status: 500 });
  }

  const url = base + '/api/careport/admin/catalogue/normalisation' + req.nextUrl.search;
  const res = await fetch(url, {
    method: 'GET',
    headers: forwardHeaders(req),
    cache: 'no-store',
  });

  return NextResponse.json(await readJson(res), { status: res.status });
}

export async function PATCH(req: NextRequest) {
  const base = gatewayBase();

  if (!base) {
    return NextResponse.json({ ok: false, error: 'api_gateway_base_url_missing' }, { status: 500 });
  }

  const body = await req.text();
  const res = await fetch(base + '/api/careport/admin/catalogue/normalisation', {
    method: 'PATCH',
    headers: forwardHeaders(req),
    body,
    cache: 'no-store',
  });

  return NextResponse.json(await readJson(res), { status: res.status });
}
