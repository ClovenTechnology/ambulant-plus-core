// apps/admin-dashboard/app/api/auth/login/route.ts
import {
  NextRequest,
  NextResponse,
} from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_SESSION_SECONDS =
  60 * 60 * 8;

const APIGW =
  process.env.APIGW_BASE ||
  process.env.APIGW_BASE_URL ||
  process.env.API_GATEWAY_BASE_URL ||
  process.env.API_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_APIGW_BASE ||
  (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'
      ? 'https://api-gateway.ambulantplus.co.za'
      : 'http://localhost:3010'
  );

function secureCookie() {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'
  );
}

async function readBody(
  request: NextRequest,
) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function validSessionToken(
  value: string | null,
) {
  const token =
    String(value || '').trim();

  return (
    token &&
    token.split('.').length === 3
      ? token
      : null
  );
}

function dashboardLoginResponse(
  upstream: Response,
  body: unknown,
  status: number,
) {
  const response =
    NextResponse.json(
      body,
      {
        status,
        headers: {
          'cache-control':
            'no-store',
        },
      },
    );

  /*
   * Preferred production path:
   *
   * API Gateway authenticates and signs the session.
   * The Dashboard proxy then issues the cookie from
   * admin.ambulantplus.co.za as a host-only cookie.
   */
  const sessionToken =
    validSessionToken(
      upstream.headers.get(
        'x-ambulant-admin-session',
      ),
    );

  if (sessionToken) {
    response.cookies.set({
      name:
        'adm.profile',
      value:
        sessionToken,
      httpOnly:
        true,
      sameSite:
        'lax',
      secure:
        secureCookie(),
      path:
        '/',
      maxAge:
        ADMIN_SESSION_SECONDS,
    });

    return response;
  }

  /*
   * Retain the previous Set-Cookie forwarding behaviour
   * as a compatibility fallback.
   */
  const setCookie =
    upstream.headers.get(
      'set-cookie',
    );

  if (setCookie) {
    response.headers.set(
      'set-cookie',
      setCookie,
    );
  }

  return response;
}

export async function POST(
  request: NextRequest,
) {
  const body =
    await readBody(
      request,
    );

  const upstream =
    await fetch(
      `${String(APIGW || '')
        .trim()
        .replace(/\/+$/, '')}/api/auth/login`,
      {
        method:
          'POST',
        headers: {
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
          JSON.stringify({
            ...body,
            kind:
              'admin',
          }),
        cache:
          'no-store',
      },
    );

  const text =
    await upstream.text();

  let data: unknown =
    null;

  try {
    data =
      text
        ? JSON.parse(text)
        : null;
  } catch {
    data = {
      ok:
        false,
      error:
        text ||
        upstream.statusText,
    };
  }

  return dashboardLoginResponse(
    upstream,
    data,
    upstream.status,
  );
}