// apps/medreach/app/api/shop/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  apigwBase,
  jsonError,
} from '@/app/api/_apigw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
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