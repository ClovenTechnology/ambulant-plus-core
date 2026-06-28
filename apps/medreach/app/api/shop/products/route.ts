// apps/medreach/app/api/shop/products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  apigwBase,
  jsonError,
} from '@/app/api/_apigw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  url.searchParams.set('channel', 'medreach');

  const upstream = `${apigwBase()}/api/shop?${url.searchParams.toString()}`;

  let res: Response;

  try {
    res = await fetch(upstream, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
      },
    });
  } catch (err) {
    return jsonError('gateway_unreachable', 502, {
      path: '/api/shop',
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