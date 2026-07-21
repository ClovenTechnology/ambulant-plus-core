import { NextRequest, NextResponse } from 'next/server';

function gatewayBase() {
  const raw =
    process.env.APIGW_BASE ||
    process.env.APIGW_BASE_URL ||
    process.env.GATEWAY_URL ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_GATEWAY_BASE ||
    process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
    '';

  return String(raw).trim().replace(/\/+$/, '');
}

function forwardedHeaders(request: NextRequest) {
  const headers = new Headers();

  [
    'cookie',
    'authorization',
    'x-role',
    'x-uid',
    'x-user-id',
    'x-org-id',
    'x-actor-ref-id',
    'x-ambulant-identity',
    'x-ambulant-session-id',
    'user-agent',
    'accept-language',
  ].forEach((name) => {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  });

  headers.set('accept', 'application/json');
  return headers;
}

export async function proxyTrainingRequest(
  request: NextRequest,
  upstreamPath: string,
) {
  const gateway = gatewayBase();

  if (!gateway) {
    return NextResponse.json(
      {
        ok: false,
        error: 'gateway_not_configured',
      },
      { status: 500 },
    );
  }

  const target = new URL(upstreamPath, gateway);

  request.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });

  const method = request.method.toUpperCase();
  const body =
    method === 'GET' || method === 'HEAD'
      ? undefined
      : await request.text();

  const headers = forwardedHeaders(request);

  if (body) {
    headers.set(
      'content-type',
      request.headers.get('content-type') ||
        'application/json',
    );
  }

  try {
    const upstream = await fetch(target, {
      method,
      headers,
      body,
      cache: 'no-store',
    });

    const text = await upstream.text();

    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        'content-type':
          upstream.headers.get('content-type') ||
          'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error(
      '[clinician-app][training proxy] gateway error',
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error: 'training_service_unavailable',
      },
      { status: 502 },
    );
  }
}
