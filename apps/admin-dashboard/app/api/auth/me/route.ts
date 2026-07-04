// apps/admin-dashboard/app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APIGW =
  process.env.APIGW_BASE ||
  process.env.APIGW_BASE_URL ||
  process.env.API_GATEWAY_BASE_URL ||
  process.env.API_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_APIGW_BASE ||
  ((process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') ? 'https://api-gateway.ambulantplus.co.za' : 'http://localhost:3010');

export async function GET(req: NextRequest) {
  const upstream = await fetch(`${APIGW.replace(/\/+$/, '')}/api/auth/me`, {
    method: 'GET',
    headers: {
      cookie: req.headers.get('cookie') || '',
      'x-admin-origin': req.nextUrl.origin,
    },
    cache: 'no-store',
  });

  const text = await upstream.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { authenticated: false, error: text || upstream.statusText };
  }

  return NextResponse.json(data, {
    status: upstream.status,
    headers: { 'cache-control': 'no-store' },
  });
}
