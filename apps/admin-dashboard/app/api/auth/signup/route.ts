// apps/admin-dashboard/app/api/auth/signup/route.ts
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

async function readBody(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function withForwardedSetCookie(res: Response, body: unknown, status: number) {
  const out = NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });

  const setCookie = res.headers.get('set-cookie');
  if (setCookie) out.headers.set('set-cookie', setCookie);

  return out;
}

export async function POST(req: NextRequest) {
  const body = await readBody(req);

  const upstream = await fetch(`${APIGW.replace(/\/+$/, '')}/api/auth/signup`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: req.headers.get('cookie') || '',
      'x-admin-origin': req.nextUrl.origin,
    },
    body: JSON.stringify({
      ...body,
      kind: 'admin',
    }),
    cache: 'no-store',
  });

  const text = await upstream.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { ok: false, error: text || upstream.statusText };
  }

  return withForwardedSetCookie(upstream, data, upstream.status);
}
