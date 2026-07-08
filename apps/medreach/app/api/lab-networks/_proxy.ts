// apps/medreach/app/api/lab-networks/_proxy.ts
import { NextRequest, NextResponse } from 'next/server';

export function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function gatewayBase() {
  return (
    process.env.APIGW_BASE ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_BASE_URL ||
    ''
  ).replace(/\/+$/, '');
}

function gatewayUrl(path: string, search = '') {
  const base = gatewayBase();

  if (!base) return null;

  const cleanPath = path.replace(/^\/+/, '');
  const finalPath =
    base.endsWith('/api') && cleanPath.startsWith('api/')
      ? cleanPath.slice(4)
      : cleanPath;

  return `${base}/${finalPath}${search}`;
}

function copyHeaders(req: NextRequest, extraHeaders: Record<string, string> = {}) {
  const headers = new Headers();

  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();

    if (lower === 'authorization' || lower === 'cookie' || lower.startsWith('x-')) {
      headers.set(key, value);
    }
  });

  headers.set('accept', 'application/json');

  Object.entries(extraHeaders).forEach(([key, value]) => {
    if (value) headers.set(key, value);
  });

  return headers;
}

export async function proxyGateway(
  req: NextRequest,
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  extraHeaders: Record<string, string> = {},
) {
  const upstreamUrl = gatewayUrl(path, new URL(req.url).search);

  if (!upstreamUrl) {
    return NextResponse.json(
      { ok: false, error: 'api_gateway_not_configured' },
      { status: 503 },
    );
  }

  const hasBody = method === 'POST' || method === 'PATCH';
  const body = hasBody ? await req.text() : undefined;
  const headers = copyHeaders(req, extraHeaders);

  if (hasBody) {
    headers.set('content-type', req.headers.get('content-type') || 'application/json');
  }

  const upstream = await fetch(upstreamUrl, {
    method,
    headers,
    body,
    cache: 'no-store',
  });

  const json = await upstream.json().catch(() => null);

  return NextResponse.json(json || { ok: upstream.ok }, {
    status: upstream.status,
  });
}