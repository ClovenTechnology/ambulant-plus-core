import { NextRequest, NextResponse } from 'next/server';

function apiGatewayBase() {
  return (
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    ''
  ).replace(/\/$/, '');
}

function forwardHeaders(req: NextRequest) {
  const headers = new Headers();

  for (const key of [
    'authorization',
    'cookie',
    'x-ambulant-role',
    'x-ambulant-user-id',
    'x-role',
    'x-user-id',
    'x-org-id',
    'x-tenant',
  ]) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  if (!headers.get('x-role')) headers.set('x-role', 'admin');
  if (!headers.get('x-ambulant-role')) headers.set('x-ambulant-role', 'admin');

  return headers;
}

async function readJson(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: text };
  }
}

export async function GET(req: NextRequest) {
  const base = apiGatewayBase();

  if (!base) {
    return NextResponse.json({ ok: false, error: 'api_gateway_base_url_missing', pharmacies: [] }, { status: 500 });
  }

  const url = base + '/api/careport/pharmacies' + req.nextUrl.search;

  const res = await fetch(url, {
    method: 'GET',
    headers: forwardHeaders(req),
    cache: 'no-store',
  });

  return NextResponse.json(await readJson(res), { status: res.status });
}
