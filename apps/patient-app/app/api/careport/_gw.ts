// FILE: apps/patient-app/app/api/careport/_gw.ts
import { NextRequest, NextResponse } from 'next/server';

function cleanBase(raw?: string | null) {
  const v = (raw ?? '').trim().replace(/\/+$/, '');
  return v || '';
}

export function getGatewayBase() {
  return (
    cleanBase(process.env.APIGW_BASE) ||
    cleanBase(process.env.API_GATEWAY_BASE_URL) ||
    cleanBase(process.env.API_GATEWAY_URL) ||
    cleanBase(process.env.NEXT_PUBLIC_APIGW_BASE) ||
    cleanBase(process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL)
  );
}

export function gatewayNotConfigured(service = 'careport') {
  return NextResponse.json(
    {
      ok: false,
      error: 'service_not_configured',
      service,
      message: 'API gateway base URL is not configured for this service.',
    },
    { status: 503 },
  );
}

export function forwardAuthHeaders(req: NextRequest) {
  const h = new Headers();

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
    'x-email',
    'x-name',
    'x-display-name',
    'x-org-id',
    'x-correlation-id',
    'x-request-id',
  ];

  for (const key of passthrough) {
    const value = req.headers.get(key);
    if (value) h.set(key, value);
  }

  if (!h.has('x-role')) {
    h.set('x-role', 'patient');
  }

  h.set('accept', 'application/json');

  return h;
}

export function forwardJsonHeaders(req: NextRequest) {
  const h = forwardAuthHeaders(req);
  h.set('content-type', 'application/json');
  return h;
}

export async function readJsonResponse(res: Response) {
  const text = await res.text().catch(() => '');

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {
      ok: false,
      error: 'invalid_gateway_json',
      raw: text.slice(0, 500),
    };
  }
}