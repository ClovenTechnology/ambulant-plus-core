import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import {
  authErrorResponse,
  requireClinicianAuth,
} from '@/src/lib/clinician-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PresenceMethod = 'GET' | 'POST';

type ClinicianProxyIdentity = {
  uid: string;
  role: string;
  clinicianId: string;
  orgId: string | null;
};

type IdentityResult =
  | {
      ok: true;
      value: ClinicianProxyIdentity;
    }
  | {
      ok: false;
      response: NextResponse;
    };

function gatewayBase() {
  return (
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.API_BASE_URL ||
    ''
  ).replace(/\/+$/, '');
}

function responseHeaders() {
  return {
    'content-type': 'application/json',
    'cache-control': 'no-store',
  };
}

function identitySecret() {
  return (
    process.env.AUTH_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    ''
  );
}

function signInternalIdentity(
  identity: ClinicianProxyIdentity,
) {
  const secret = identitySecret();

  if (!secret) {
    throw new Error(
      'presence_identity_signing_not_configured',
    );
  }

  const now = Math.floor(Date.now() / 1000);

  const payload: Record<string, unknown> = {
    sub: identity.uid,
    role: identity.role,
    actorRefId: identity.clinicianId,
    iat: now,
    nbf: now - 5,
    exp: now + 60,
  };

  if (identity.orgId) {
    payload.orgId = identity.orgId;
  }

  const encoded = Buffer.from(
    JSON.stringify(payload),
    'utf8',
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', secret)
    .update(encoded)
    .digest('base64url');

  return encoded + '.' + signature;
}

async function resolveProxyIdentity(
  req: NextRequest,
): Promise<IdentityResult> {
  const auth: any = await requireClinicianAuth(
    req,
    {
      allowAdmin: true,
      allowAdminStaff: true,
    },
  );

  if (!auth.ok) {
    return {
      ok: false,
      response: authErrorResponse(auth),
    };
  }

  const clinicianId = String(
    auth.clinicianId || '',
  ).trim();

  const uid =
    auth.role === 'clinician'
      ? clinicianId
      : String(
          auth.session?.sub ||
            auth.clinician?.userId ||
            clinicianId ||
            '',
        ).trim();

  if (
    !uid ||
    (auth.role === 'clinician' &&
      !clinicianId)
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error:
            'missing_clinician_identity',
        },
        {
          status: 401,
          headers: responseHeaders(),
        },
      ),
    };
  }

  const orgId =
    String(
      req.headers.get('x-org-id') ||
        req.headers.get(
          'x-ambulant-org-id',
        ) ||
        '',
    ).trim() || null;

  return {
    ok: true,
    value: {
      uid,
      role: String(
        auth.role || 'clinician',
      )
        .trim()
        .toLowerCase(),
      clinicianId,
      orgId,
    },
  };
}

function forwardHeaders(
  req: NextRequest,
  identity: ClinicianProxyIdentity,
) {
  const headers = new Headers();

  for (const key of [
    'content-type',
    'x-request-id',
    'x-correlation-id',
  ]) {
    const value = req.headers.get(key);

    if (value) {
      headers.set(key, value);
    }
  }

  headers.set('accept', 'application/json');

  if (!headers.has('content-type')) {
    headers.set(
      'content-type',
      'application/json',
    );
  }

  headers.set(
    'x-ambulant-identity',
    signInternalIdentity(identity),
  );

  headers.set('x-role', identity.role);
  headers.set(
    'x-ambulant-role',
    identity.role,
  );

  headers.set('x-uid', identity.uid);
  headers.set(
    'x-user-id',
    identity.uid,
  );
  headers.set(
    'x-ambulant-user-id',
    identity.uid,
  );

  if (identity.clinicianId) {
    headers.set(
      'x-actor-ref-id',
      identity.clinicianId,
    );

    headers.set(
      'x-clinician-id',
      identity.clinicianId,
    );
  }

  if (identity.orgId) {
    headers.set(
      'x-org-id',
      identity.orgId,
    );

    headers.set(
      'x-ambulant-org-id',
      identity.orgId,
    );
  }

  return headers;
}

async function proxyPresence(
  req: NextRequest,
  method: PresenceMethod,
) {
  const base = gatewayBase();

  if (!base) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'api_gateway_not_configured',
      },
      {
        status: 500,
        headers: responseHeaders(),
      },
    );
  }

  const identityResult =
    await resolveProxyIdentity(req);

  if (!identityResult.ok) {
    return identityResult.response;
  }

  const url = new URL(
    '/api/televisit/presence',
    base,
  );

  if (method === 'GET') {
    req.nextUrl.searchParams.forEach(
      (value, key) => {
        url.searchParams.set(key, value);
      },
    );
  }

  try {
    const init: RequestInit = {
      method,
      cache: 'no-store',
      headers: forwardHeaders(
        req,
        identityResult.value,
      ),
    };

    if (method === 'POST') {
      init.body = await req.text();
    }

    const upstream = await fetch(
      url.toString(),
      init,
    );

    const text = await upstream
      .text()
      .catch(() => '');

    return new NextResponse(
      text || '{}',
      {
        status: upstream.status,
        headers: responseHeaders(),
      },
    );
  } catch (error: any) {
    const code = String(
      error?.message ||
        'presence_proxy_failed',
    );

    const status =
      code ===
      'presence_identity_signing_not_configured'
        ? 500
        : 502;

    return NextResponse.json(
      {
        ok: false,
        error: code,
      },
      {
        status,
        headers: responseHeaders(),
      },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'cache-control': 'no-store',
      'access-control-allow-methods':
        'GET,POST,OPTIONS',
      'access-control-allow-headers':
        'content-type,authorization,cookie,x-ambulant-identity,x-uid,x-user-id,x-ambulant-user-id,x-role,x-ambulant-role,x-org-id,x-ambulant-org-id,x-actor-ref-id,x-clinician-id,x-request-id,x-correlation-id',
    },
  });
}

export async function GET(
  req: NextRequest,
) {
  return proxyPresence(req, 'GET');
}

export async function POST(
  req: NextRequest,
) {
  return proxyPresence(req, 'POST');
}
