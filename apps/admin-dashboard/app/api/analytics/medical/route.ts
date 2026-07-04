// apps/admin-dashboard/app/api/analytics/medical/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function apiGatewayBase() {
  return (
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    ((process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') ? 'https://api-gateway.ambulantplus.co.za' : 'http://localhost:3010')
  ).replace(/\/+$/, '');
}

function copyForwardHeaders(req: NextRequest) {
  const headers = new Headers();

  const passthrough = [
    'authorization',
    'cookie',
    'x-admin-key',
    'x-uid',
    'x-role',
    'x-org',
    'x-org-id',
    'content-type',
  ];

  for (const key of passthrough) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  return headers;
}

async function proxy(req: NextRequest, method: 'GET' | 'POST') {
  try {
    const incomingUrl = new URL(req.url);
    const target = new URL('/api/analytics/medical', apiGatewayBase());

    incomingUrl.searchParams.forEach((value, key) => {
      target.searchParams.set(key, value);
    });

    const init: RequestInit = {
      method,
      headers: copyForwardHeaders(req),
      cache: 'no-store',
    };

    if (method !== 'GET') {
      init.body = await req.text();
    }

    const upstream = await fetch(target.toString(), init);

    const contentType = upstream.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await upstream.json().catch(() => null);
      return NextResponse.json(data, { status: upstream.status });
    }

    const text = await upstream.text().catch(() => '');
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        'content-type': contentType || 'text/plain',
      },
    });
  } catch (err: any) {
    console.error('admin-dashboard analytics medical proxy error', err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || 'analytics_medical_proxy_failed',
      },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return proxy(req, 'GET');
}

export async function POST(req: NextRequest) {
  return proxy(req, 'POST');
}