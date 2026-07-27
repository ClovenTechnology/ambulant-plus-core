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

async function readJson(
  request: NextRequest,
) {
  return request
    .json()
    .catch(() => ({}));
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
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        'cache-control':
          'no-store',
      },
    },
  );
}

async function forward(
  request: NextRequest,
  method: 'GET' | 'POST',
) {
  const search =
    method === 'GET'
      ? request.nextUrl.search
      : '';

  const body =
    method === 'POST'
      ? await readJson(request)
      : null;

  const upstream =
    await fetch(
      gatewayBase() +
        '/api/roles/requests' +
        search,
      {
        method,
        headers: {
          accept:
            'application/json',
          cookie:
            request.headers.get(
              'cookie',
            ) || '',
          'x-admin-origin':
            request.nextUrl.origin,
          ...(
            method === 'POST'
              ? {
                  'content-type':
                    'application/json',
                }
              : {}
          ),
        },
        body:
          method === 'POST'
            ? JSON.stringify(body)
            : undefined,
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

export async function GET(
  request: NextRequest,
) {
  try {
    return await forward(
      request,
      'GET',
    );
  }
  catch (error) {
    console.error(
      '[admin role-request proxy] list failed',
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

export async function POST(
  request: NextRequest,
) {
  try {
    return await forward(
      request,
      'POST',
    );
  }
  catch (error) {
    console.error(
      '[admin role-request proxy] create failed',
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