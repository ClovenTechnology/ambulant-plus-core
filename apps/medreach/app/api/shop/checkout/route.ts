// apps/medreach/app/api/shop/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  apigwBase,
  jsonError,
} from '@/app/api/_apigw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function forwardIdentityHeaders(req: NextRequest, json = false) {
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
    'x-email',
    'x-name',
    'x-display-name',
    'x-org-id',
    'x-correlation-id',
    'x-request-id',
  ].forEach((key) => {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  });
  headers.set('accept', 'application/json');
  if (json) headers.set('content-type', 'application/json');
  return headers;
}


export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return jsonError('invalid_json', 400);
  }

  const payload =
    body && typeof body === 'object'
      ? {
          ...(body as Record<string, unknown>),
          channel: 'medreach',
        }
      : {
          channel: 'medreach',
        };

  let res: Response;

  try {
    res = await fetch(`${apigwBase()}/api/shop/checkout`, {
      method: 'POST',
      headers: forwardIdentityHeaders(req, true),
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return jsonError('gateway_unreachable', 502, {
      path: '/api/shop/checkout',
      message: err instanceof Error ? err.message : String(err),
    });
  }

  const js = await res.json().catch(() => null);

  return NextResponse.json(js, {
    status: res.status,
    headers: {
      'cache-control': 'no-store',
    },
  });
}