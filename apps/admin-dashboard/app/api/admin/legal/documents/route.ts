import {
  NextRequest,
  NextResponse,
} from 'next/server';

export const runtime =
  'nodejs';

export const dynamic =
  'force-dynamic';

function gatewayBase() {
  return String(
    process.env.APIGW_BASE_URL ||
      process.env.API_GATEWAY_URL ||
      process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
      '',
  )
    .trim()
    .replace(
      /\/+$/,
      '',
    );
}

function adminKey() {
  return String(
    process.env.ADMIN_API_KEY ||
      '',
  ).trim();
}

function response(
  body: unknown,
  status = 200,
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        'Cache-Control':
          'no-store',
      },
    },
  );
}

function forwardedHeaders(
  request: NextRequest,
  includeContentType = false,
  actor: any = null,
) {
  const headers =
    new Headers();

  const names = [
    'cookie',
    'authorization',
    'x-role',
    'x-uid',
    'x-org-id',
    'x-ambulant-identity',
  ];

  for (
    const name of
    names
  ) {
    const value =
      request.headers.get(
        name,
      );

    if (
      value
    ) {
      headers.set(
        name,
        value,
      );
    }
  }

  const key =
    adminKey();

  if (
    key
  ) {
    headers.set(
      'x-admin-key',
      key,
    );
  }

  const actorId =
    String(
      actor?.id ||
        '',
    ).trim();

  const actorEmail =
    String(
      actor?.email ||
        '',
    )
      .trim()
      .toLowerCase();

  if (actorId) {
    headers.set(
      'x-admin-actor-id',
      actorId,
    );
  }

  if (actorEmail) {
    headers.set(
      'x-admin-actor-email',
      actorEmail,
    );
  }

  headers.set(
    'accept',
    'application/json',
  );

  if (
    includeContentType
  ) {
    headers.set(
      'content-type',
      'application/json',
    );
  }

  return headers;
}

async function authenticate(
  request: NextRequest,
) {
  const base =
    gatewayBase();

  if (
    !base
  ) {
    return {
      ok:
        false,
      status:
        500,
      error:
        'api_gateway_base_missing',
      user:
        null,
    };
  }

  const upstream =
    await fetch(
      base +
        '/api/auth/me',
      {
        method:
          'GET',
        headers:
          forwardedHeaders(
            request,
          ),
        cache:
          'no-store',
      },
    );

  const body =
    await upstream
      .json()
      .catch(
        () => null,
      );

  if (
    !upstream.ok ||
    body?.authenticated ===
      false
  ) {
    return {
      ok:
        false,
      status:
        upstream.status ===
          403
          ? 403
          : 401,
      error:
        body?.error ||
        'admin_authentication_required',
      user:
        null,
    };
  }

  return {
    ok:
      true,
    status:
      200,
    error:
      null,
    user:
      body?.user ||
      null,
  };
}

async function forward(
  request: NextRequest,
  method: 'GET' | 'POST' | 'PATCH',
) {
  const base =
    gatewayBase();

  if (
    !base
  ) {
    return response(
      {
        ok:
          false,
        error:
          'api_gateway_base_missing',
      },
      500,
    );
  }

  const auth =
    await authenticate(
      request,
    );

  if (
    !auth.ok
  ) {
    return response(
      {
        ok:
          false,
        error:
          auth.error,
      },
      auth.status,
    );
  }

  const sourceUrl =
    new URL(
      request.url,
    );

  const upstreamUrl =
    new URL(
      base +
        '/api/admin/legal/documents',
    );

  sourceUrl.searchParams.forEach(
    (
      value,
      key,
    ) => {
      upstreamUrl.searchParams.append(
        key,
        value,
      );
    },
  );

  const body =
    method ===
    'GET'
      ? undefined
      : await request.text();

  const upstream =
    await fetch(
      upstreamUrl,
      {
        method,
        headers:
          forwardedHeaders(
            request,
            method !==
              'GET',
            auth.user,
          ),
        body:
          body ||
          undefined,
        cache:
          'no-store',
      },
    );

  const raw =
    await upstream.text();

  return new NextResponse(
    raw,
    {
      status:
        upstream.status,
      headers: {
        'content-type':
          upstream.headers.get(
            'content-type',
          ) ||
          'application/json',
        'Cache-Control':
          'no-store',
      },
    },
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
  } catch (
    error: any
  ) {
    return response(
      {
        ok:
          false,
        error:
          error?.message ||
          'legal_proxy_fetch_failed',
      },
      500,
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
  } catch (
    error: any
  ) {
    return response(
      {
        ok:
          false,
        error:
          error?.message ||
          'legal_proxy_action_failed',
      },
      500,
    );
  }
}

export async function PATCH(
  request: NextRequest,
) {
  try {
    return await forward(
      request,
      'PATCH',
    );
  } catch (
    error: any
  ) {
    return response(
      {
        ok:
          false,
        error:
          error?.message ||
          'legal_proxy_action_failed',
      },
      500,
    );
  }
}
