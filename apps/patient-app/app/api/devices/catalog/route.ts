import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANONICAL_API_GATEWAY =
  'https://api-gateway.ambulantplus.co.za';

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function isProductionRuntime() {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'
  );
}

function gatewayBase() {
  const configured = clean(
    process.env.APIGW_BASE ||
      process.env.APIGW_ORIGIN ||
      process.env.API_GATEWAY_ORIGIN ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
      process.env.NEXT_PUBLIC_API_GATEWAY_BASE,
    500,
  ).replace(/\/+$/, '');

  if (configured) return configured;

  if (isProductionRuntime()) {
    return CANONICAL_API_GATEWAY;
  }

  return 'http://localhost:3010';
}

export async function GET() {
  try {
    const upstream = await fetch(
      `${gatewayBase()}/api/devices/catalog`,
      {
        method: 'GET',
        cache: 'no-store',
        headers: {
          accept: 'application/json',
        },
      },
    );

    const body = await upstream.text();

    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        'content-type':
          upstream.headers.get('content-type') ||
          'application/json; charset=utf-8',
        'cache-control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error(
      '[patient-app][devices/catalog] proxy failed',
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          'device_catalog_unavailable',
      },
      {
        status: 503,
        headers: {
          'cache-control': 'no-store, max-age=0',
        },
      },
    );
  }
}