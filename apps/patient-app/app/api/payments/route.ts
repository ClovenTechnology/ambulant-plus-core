// apps/patient-app/app/api/payments/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANONICAL_GATEWAY = 'https://ambulant-plus-core-api-gateway-kdon.vercel.app';

function gatewayBase() {
  return (
    process.env.APIGW_BASE ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.API_GATEWAY_URL ||
    process.env.API_GATEWAY_BASE_URL ||
    CANONICAL_GATEWAY
  ).replace(/\/+$/, '');
}

function forwardHeaders(req: NextRequest, includeJson = false) {
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
    'x-org',
    'x-org-id',
    'x-role',
    'x-email',
    'x-name',
    'x-display-name',
    'x-correlation-id',
    'x-request-id',
    'idempotency-key',
    'x-idempotency-key',
  ].forEach((key) => {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  });

  headers.set('accept', 'application/json');
  if (includeJson) headers.set('content-type', 'application/json');
  if (!headers.get('x-role') && !headers.get('x-ambulant-role')) headers.set('x-role', 'patient');

  return headers;
}

async function readBody(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

function targetUrl(req: NextRequest) {
  const incoming = new URL(req.url);
  const target = new URL('/api/payments', gatewayBase());
  incoming.searchParams.forEach((value, key) => target.searchParams.set(key, value));
  return target.toString();
}

export async function GET(req: NextRequest) {
  try {
    const res = await fetch(targetUrl(req), {
      method: 'GET',
      headers: forwardHeaders(req),
      cache: 'no-store',
    });

    const payload = await readBody(res);
    return json(payload ?? { ok: res.ok }, res.status);
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'payments_gateway_failed' }, 502);
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json().catch(() => ({}));

    const res = await fetch(targetUrl(req), {
      method: 'POST',
      headers: forwardHeaders(req, true),
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const body = await readBody(res);
    return json(body ?? { ok: res.ok }, res.status);
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'payments_gateway_failed' }, 502);
  }
}
