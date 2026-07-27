import {
  NextRequest,
  NextResponse,
} from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APIGW =
  process.env.APIGW_BASE ||
  process.env.APIGW_BASE_URL ||
  process.env.API_GATEWAY_BASE_URL ||
  process.env.API_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_APIGW_BASE ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
  (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'
      ? 'https://api-gateway.ambulantplus.co.za'
      : 'http://localhost:3010'
  );

function gatewayBase() {
  return String(APIGW || '')
    .replace(/\/+$/, '');
}

async function parseUpstream(
  response: Response,
) {
  const text =
    await response.text();

  try {
    return text
      ? JSON.parse(text)
      : null;
  }
  catch {
    return {
      ok: false,
      error:
        text ||
        response.statusText ||
        'invalid_gateway_response',
    };
  }
}

function dashboardResponse(
  body: unknown,
  status: number,
  additionalHeaders?: Record<
    string,
    string
  >,
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        'cache-control':
          'no-store',
        ...additionalHeaders,
      },
    },
  );
}

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: {
      id: string;
    };
  },
) {
  try {
    const body =
      await request
        .json()
        .catch(() => ({}));

    const upstream =
      await fetch(
        gatewayBase() +
          '/api/roles/requests/' +
          encodeURIComponent(
            params.id,
          ),
        {
          method:
            'PATCH',
          headers: {
            accept:
              'application/json',
            'content-type':
              'application/json',
            cookie:
              request.headers.get(
                'cookie',
              ) || '',
            'x-admin-origin':
              request.nextUrl.origin,
          },
          body:
            JSON.stringify(
              body,
            ),
          cache:
            'no-store',
        },
      );

    const data =
      await parseUpstream(
        upstream,
      );

    return dashboardResponse(
      data,
      upstream.status,
    );
  }
  catch (error) {
    console.error(
      '[admin role-request proxy] decision failed',
      error,
    );

    return dashboardResponse(
      {
        ok: false,
        error:
          'role_request_gateway_unavailable',
      },
      502,
    );
  }
}

export async function DELETE() {
  return dashboardResponse(
    {
      ok: false,
      error:
        'role_request_history_is_immutable',
    },
    405,
    {
      allow:
        'PATCH',
    },
  );
}