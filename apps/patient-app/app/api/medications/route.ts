// apps/patient-app/app/api/medications/route.ts
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
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

function forwardHeaders(req: NextRequest, includeJson = false) {
  const headers = new Headers();

  for (const key of [
    'authorization',
    'cookie',
    'x-ambulant-identity',
    'x-ambulant-user-id',
    'x-ambulant-org-id',
    'x-ambulant-role',
    'x-correlation-id',
    'x-request-id',
    'idempotency-key',
    'x-idempotency-key',
  ]) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  headers.set('accept', 'application/json');
  if (includeJson) headers.set('content-type', 'application/json');

  return headers;
}

async function readPayload(res: Response) {
  const text = await res.text().catch(() => '');
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function forward(req: NextRequest, method: 'GET' | 'POST' | 'PATCH') {
  const base = gatewayBase();
  if (!base) {
    return json(
      {
        ok: false,
        error: 'api_gateway_base_required',
        message: 'Medication service is temporarily unavailable because the API gateway is not configured.',
      },
      503,
    );
  }

  const incoming = new URL(req.url);
  const upstream = new URL(`${base}/api/medications`);
  incoming.searchParams.forEach((value, key) => upstream.searchParams.set(key, value));

  const init: RequestInit = {
    method,
    cache: 'no-store',
    headers: forwardHeaders(req, method !== 'GET'),
  };

  if (method !== 'GET') {
    const body = await req.text().catch(() => '');
    init.body = body || '{}';
  }

  const res = await fetch(upstream.toString(), init);
  const payload = await readPayload(res);
  return json(payload ?? { ok: res.ok }, res.status);
}

export async function GET(req: NextRequest) {
  return forward(req, 'GET');
}

export async function POST(req: NextRequest) {
  return forward(req, 'POST');
}

export async function PATCH(req: NextRequest) {
  return forward(req, 'PATCH');
}
