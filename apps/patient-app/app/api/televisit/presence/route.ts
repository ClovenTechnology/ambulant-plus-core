import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PresenceMethod = 'GET' | 'POST';

type PatientProxyIdentity = {
  token: string;
  uid: string;
  actorRefId: string;
  orgId: string;
};

const SESSION_COOKIE_CANDIDATES = [
  '__Host-ambulant_session',
  'ambulant_session',
  'ambulant.session',
  'auth_session',
  'session',
  'token',
];

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

function cookieValue(
  req: NextRequest,
  name: string,
) {
  const raw =
    req.headers.get('cookie') || '';

  const parts = raw
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    const equalsAt = part.indexOf('=');

    if (equalsAt <= 0) continue;

    const key = part
      .slice(0, equalsAt)
      .trim();

    const value = part
      .slice(equalsAt + 1)
      .trim();

    if (key === name) {
      return decodeURIComponent(value);
    }
  }

  return '';
}

function sessionTokenFromRequest(
  req: NextRequest,
) {
  for (
    const name of
    SESSION_COOKIE_CANDIDATES
  ) {
    const value = cookieValue(
      req,
      name,
    );

    if (value) return value;
  }

  return '';
}

function base64urlToBuffer(
  value: string,
) {
  const padding =
    value.length % 4 === 0
      ? ''
      : '='.repeat(
          4 - (value.length % 4),
        );

  const base64 = (
    value + padding
  )
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  return Buffer.from(
    base64,
    'base64',
  );
}

function safeJsonParse(
  value: Buffer,
) {
  try {
    return JSON.parse(
      value.toString('utf8'),
    );
  } catch {
    return null;
  }
}

function timingSafeEqualText(
  left: string,
  right: string,
) {
  const leftBuffer =
    Buffer.from(left);

  const rightBuffer =
    Buffer.from(right);

  if (
    leftBuffer.length !==
    rightBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    leftBuffer,
    rightBuffer,
  );
}

function verifyPatientSessionToken(
  token: string,
) {
  const secret = identitySecret();

  if (!secret) return null;

  try {
    const parts = String(
      token || '',
    ).split('.');

    if (parts.length !== 3) {
      return null;
    }

    const [
      header,
      payloadPart,
      signature,
    ] = parts;

    const expected = crypto
      .createHmac('sha256', secret)
      .update(
        header +
          '.' +
          payloadPart,
      )
      .digest('base64url');

    if (
      !timingSafeEqualText(
        signature,
        expected,
      )
    ) {
      return null;
    }

    const payload = safeJsonParse(
      base64urlToBuffer(
        payloadPart,
      ),
    );

    if (!payload) return null;

    const now = Math.floor(
      Date.now() / 1000,
    );

    if (
      typeof payload.exp ===
        'number' &&
      payload.exp <= now
    ) {
      return null;
    }

    if (
      typeof payload.nbf ===
        'number' &&
      payload.nbf > now + 30
    ) {
      return null;
    }

    const role = String(
      payload.role ||
        payload.actorRole ||
        payload.actorType ||
        payload.actor_type ||
        '',
    )
      .trim()
      .toLowerCase();

    if (
      role &&
      role !== 'patient' &&
      role !== 'pat'
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function patientSessionIdentity(
  req: NextRequest,
): PatientProxyIdentity | null {
  const token =
    sessionTokenFromRequest(req);

  const payload = token
    ? verifyPatientSessionToken(token)
    : null;

  if (!payload) return null;

  const uid = String(
    payload.sub ||
      payload.uid ||
      payload.userId ||
      payload.user_id ||
      '',
  ).trim();

  if (!uid) return null;

  const actorRefId = String(
    payload.actorRefId ||
      payload.actor_ref_id ||
      payload.patientId ||
      payload.patient_id ||
      '',
  ).trim();

  const orgId =
    String(
      payload.orgId ||
        payload.org_id ||
        payload.tenantId ||
        payload.tenant_id ||
        '',
    ).trim() ||
    process.env.DEFAULT_ORG_ID ||
    process.env
      .NEXT_PUBLIC_DEFAULT_ORG_ID ||
    'org-default';

  return {
    token,
    uid,
    actorRefId,
    orgId,
  };
}

function signInternalIdentity(
  identity: PatientProxyIdentity,
) {
  const secret = identitySecret();

  if (!secret) {
    throw new Error(
      'presence_identity_signing_not_configured',
    );
  }

  const now = Math.floor(
    Date.now() / 1000,
  );

  const payload: Record<
    string,
    unknown
  > = {
    sub: identity.uid,
    role: 'patient',
    iat: now,
    nbf: now - 5,
    exp: now + 60,
  };

  if (identity.actorRefId) {
    payload.actorRefId =
      identity.actorRefId;
  }

  if (identity.orgId) {
    payload.orgId =
      identity.orgId;
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

function forwardHeaders(
  req: NextRequest,
  identity: PatientProxyIdentity,
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

  headers.set('x-role', 'patient');
  headers.set(
    'x-ambulant-role',
    'patient',
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

  if (identity.actorRefId) {
    headers.set(
      'x-actor-ref-id',
      identity.actorRefId,
    );

    headers.set(
      'x-patient-id',
      identity.actorRefId,
    );

    headers.set(
      'x-current-patient-id',
      identity.actorRefId,
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

  if (!identitySecret()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'presence_identity_signing_not_configured',
      },
      {
        status: 500,
        headers: responseHeaders(),
      },
    );
  }

  const identity =
    patientSessionIdentity(req);

  if (!identity) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'patient_session_required',
      },
      {
        status: 401,
        headers: responseHeaders(),
      },
    );
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
        identity,
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
    return NextResponse.json(
      {
        ok: false,
        error: String(
          error?.message ||
            'presence_proxy_failed',
        ),
      },
      {
        status: 502,
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
        'content-type,authorization,cookie,x-ambulant-identity,x-uid,x-user-id,x-ambulant-user-id,x-role,x-ambulant-role,x-org-id,x-ambulant-org-id,x-actor-ref-id,x-patient-id,x-current-patient-id,x-request-id,x-correlation-id',
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
