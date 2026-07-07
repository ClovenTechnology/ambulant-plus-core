// apps/medreach/app/api/onboarding/_gateway.ts
import { NextRequest, NextResponse } from 'next/server';

export function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
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

export function medreachHeaders(req: NextRequest, actorRef?: string) {
  const headers = new Headers();

  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();

    if (
      lower === 'authorization' ||
      lower === 'cookie' ||
      lower.startsWith('x-')
    ) {
      headers.set(key, value);
    }
  });

  headers.set('accept', 'application/json');
  headers.set('content-type', 'application/json');

  if (!headers.get('x-role')) headers.set('x-role', 'system');
  if (!headers.get('x-user-id')) headers.set('x-user-id', actorRef || 'medreach-onboarding');
  if (!headers.get('x-actor-ref-id')) {
    headers.set('x-actor-ref-id', actorRef || 'medreach-onboarding');
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

  const upstream = await fetch(url, {
    method: 'POST',
    headers: medreachHeaders(req, options.actorRef),
    body: JSON.stringify(options.body),
    cache: 'no-store',
  });

  const json = await upstream.json().catch(() => null);

  return NextResponse.json(json || { ok: upstream.ok }, {
    status: upstream.status,
  });
}