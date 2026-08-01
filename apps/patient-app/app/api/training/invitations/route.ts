import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function base() {
  return String(
    process.env.APIGW_BASE_URL ||
    process.env.APIGW_BASE ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.API_GATEWAY_URL ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
    process.env.GATEWAY_URL ||
    '',
  ).trim().replace(/\/+$/, '');
}

async function forward(request: NextRequest) {
  const gateway = base();
  if (!gateway) {
    return NextResponse.json({ ok: false, error: 'api_gateway_not_configured' }, { status: 500 });
  }

  const method = request.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.text();
  const cookie = request.headers.get('cookie');
  const authorization = request.headers.get('authorization');

  const response = await fetch(`${gateway}/api/patients/me/training/invitations`, {
    method,
    headers: {
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...(authorization ? { authorization } : {}),
    },
    body,
    cache: 'no-store',
  });

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') || 'application/json',
      'cache-control': 'no-store',
    },
  });
}

export async function GET(request: NextRequest) {
  return forward(request);
}

export async function POST(request: NextRequest) {
  return forward(request);
}