import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function gatewayBase() {
  return (
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    process.env.GATEWAY_URL ||
    process.env.APIGW_BASE ||
    process.env.APIGW_BASE_URL ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    ''
  ).replace(/\/+$/, '');
}

function forwardHeaders(
  req: NextRequest,
) {
  const headers =
    new Headers();

  headers.set(
    'content-type',
    'application/json',
  );

  const auth =
    req.headers.get(
      'authorization',
    ) ||
    req.headers.get(
      'Authorization',
    );

  if (auth) {
    headers.set(
      'authorization',
      auth,
    );
  }

  const cookie =
    req.headers.get(
      'cookie',
    );

  if (cookie) {
    headers.set(
      'cookie',
      cookie,
    );
  }

  return headers;
}

export async function POST(
  req: NextRequest,
) {
  try {
    const body =
      await req.json().catch(
        () => ({}),
      );

    const gateway =
      gatewayBase();

    if (!gateway) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'gateway_not_configured',
        },
        { status: 500 },
      );
    }

    const upstream =
      await fetch(
        gateway +
          '/api/clinicians/onboarding/pay-later/request',
        {
          method: 'POST',
          headers:
            forwardHeaders(req),
          body:
            JSON.stringify(body),
          cache: 'no-store',
        },
      );

    const text =
      await upstream.text();

    return new NextResponse(
      text,
      {
        status:
          upstream.status,
        headers: {
          'content-type':
            upstream.headers.get(
              'content-type',
            ) ||
            'application/json',
          'cache-control':
            'no-store',
        },
      },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          'pay_later_request_proxy_failed',
      },
      { status: 500 },
    );
  }
}
