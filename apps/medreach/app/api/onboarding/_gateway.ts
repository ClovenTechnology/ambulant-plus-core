// apps/medreach/app/api/onboarding/_gateway.ts
import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isProductionRuntime() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

export function gatewayBase() {
  return (
    process.env.APIGW_BASE ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_BASE_URL ||
    ''
  ).replace(/\/+$/, '');
}

export function gatewayUrl(path: string) {
  const base = gatewayBase();
  if (!base) return null;

  const cleanPath = path.replace(/^\/+/, '');
  const finalPath =
    base.endsWith('/api') && cleanPath.startsWith('api/')
      ? cleanPath.slice(4)
      : cleanPath;

  return `${base}/${finalPath}`;
}

export async function readJson(req: NextRequest) {
  return (await req.json().catch(() => ({}))) as Record<string, unknown>;
}

export function gatewayErrorMessage(
  value: unknown,
  fallback = 'medreach_gateway_request_failed',
): string {
  const seen = new Set<unknown>();

  function visit(input: unknown, depth = 0): string {
    if (depth > 4 || input == null || seen.has(input)) return '';

    if (typeof input === 'string') {
      const text = input.trim();
      return text && text !== '[object Object]' ? text : '';
    }

    if (input instanceof Error) return visit(input.message, depth + 1);

    if (Array.isArray(input)) {
      for (const item of input) {
        const text = visit(item, depth + 1);
        if (text) return text;
      }
      return '';
    }

    if (typeof input === 'object') {
      seen.add(input);
      const record = input as Record<string, unknown>;

      for (const key of ['message', 'error', 'detail', 'reason', 'code', 'statusText']) {
        const text = visit(record[key], depth + 1);
        if (text) return text;
      }

      for (const key of ['errors', 'issues', 'data']) {
        const text = visit(record[key], depth + 1);
        if (text) return text;
      }
    }

    return '';
  }

  return visit(value) || fallback;
}

function internalIdentitySecret() {
  return (
    process.env.AMBULANT_INTERNAL_IDENTITY_SECRET ||
    process.env.INTERNAL_IDENTITY_SECRET ||
    ''
  ).trim();
}

function safeActorRef(value: unknown) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9@.+_-]+/g, '-')
    .slice(0, 120) || 'applicant';
}

function signedOnboardingIdentity(actorRef?: string) {
  const secret = internalIdentitySecret();

  if (!secret) {
    if (isProductionRuntime()) {
      throw new Error('medreach_onboarding_internal_identity_not_configured');
    }
    return '';
  }

  const now = Math.floor(Date.now() / 1000);
  const subject = `medreach-onboarding:${safeActorRef(actorRef)}`;
  const payload = {
    sub: subject,
    uid: subject,
    role: 'system',
    actorRefId: safeActorRef(actorRef),
    orgId: 'org-default',
    iat: now,
    nbf: now - 5,
    exp: now + 90,
    sid: `medreach-onboarding-${crypto.randomUUID()}`,
    jti: crypto.randomUUID(),
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

export function medreachHeaders(req: NextRequest, actorRef?: string) {
  const headers = new Headers();

  // Public onboarding must never trust caller-supplied role/user x-headers.
  for (const key of ['x-correlation-id', 'x-request-id']) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  headers.set('accept', 'application/json');
  headers.set('content-type', 'application/json');

  const signedIdentity = signedOnboardingIdentity(actorRef);

  if (signedIdentity) {
    headers.set('x-ambulant-identity', signedIdentity);
  } else {
    // Local-development fallback only. API Gateway ignores unsafe headers in production.
    headers.set('x-role', 'system');
    headers.set('x-user-id', `medreach-onboarding:${safeActorRef(actorRef)}`);
    headers.set('x-actor-ref-id', safeActorRef(actorRef));
  }

  return headers;
}

export async function postToGateway(
  req: NextRequest,
  options: {
    path: string;
    body: Record<string, unknown>;
    actorRef?: string;
  },
) {
  const url = gatewayUrl(options.path);

  if (!url) {
    return NextResponse.json(
      {
        ok: false,
        error: 'api_gateway_not_configured',
        detail:
          'Set APIGW_BASE or API_GATEWAY_BASE_URL before accepting MedReach applications.',
      },
      { status: 503 },
    );
  }

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: medreachHeaders(req, options.actorRef),
      body: JSON.stringify(options.body),
      cache: 'no-store',
    });

    const json = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: gatewayErrorMessage(json, `gateway_http_${upstream.status}`),
        },
        { status: upstream.status },
      );
    }

    return NextResponse.json(
      json && typeof json === 'object' ? json : { ok: true },
      { status: upstream.status },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: gatewayErrorMessage(error, 'medreach_gateway_unavailable'),
      },
      { status: 503 },
    );
  }
}
