import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function trimSlash(value: string) {
  return String(value || '').replace(/\/+$/, '');
}

function gatewayBase() {
  const configured =
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    '';

  return configured ? trimSlash(configured) : '';
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
}

function forwardHeaders(req: NextRequest, contentType = '') {
  const headers = new Headers();

  for (const key of [
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
  ]) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  headers.set('accept', 'application/json');
  if (contentType) headers.set('content-type', contentType);
  if (!headers.has('x-role')) headers.set('x-role', 'admin');
  if (!headers.has('x-ambulant-role')) headers.set('x-ambulant-role', 'admin');

  return headers;
}

async function readPayload(res: Response) {
  const text = await res.text().catch(() => '');
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function GET(req: NextRequest) {
  const base = gatewayBase();

  if (!base) {
    return json({ ok: false, error: 'api_gateway_base_required' }, 503);
  }

  const upstream = await fetch(`${base}/api/medreach/lab-reviews${req.nextUrl.search || ''}`, {
    method: 'GET',
    cache: 'no-store',
    headers: forwardHeaders(req),
  });

  const payload = await readPayload(upstream);
  return json(payload ?? { ok: upstream.ok }, upstream.status);
}
