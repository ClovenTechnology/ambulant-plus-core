// apps/admin-dashboard/app/api/admin/medreach/_gateway.ts
import { NextRequest, NextResponse } from 'next/server';

export function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function gatewayBase() {
  return (
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    ''
  ).replace(/\/+$/, '');
}

export function gatewayUrl(path: string, search = '') {
  const base = gatewayBase();

  if (!base) return null;

  const cleanPath = path.replace(/^\/+/, '');
  const finalPath =
    base.endsWith('/api') && cleanPath.startsWith('api/')
      ? cleanPath.slice(4)
      : cleanPath;

  return `${base}/${finalPath}${search}`;
}

export async function readJson(req: NextRequest) {
  return (await req.json().catch(() => ({}))) as Record<string, unknown>;
}

export function adminHeaders(req: NextRequest, extra?: Record<string, string | undefined>) {
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

  if (!headers.get('x-role')) headers.set('x-role', 'admin');
  if (!headers.get('x-user-id')) headers.set('x-user-id', 'admin-dashboard');
  if (!headers.get('x-actor-ref-id')) headers.set('x-actor-ref-id', 'admin-dashboard');

  const adminKey = clean(process.env.ADMIN_API_KEY);
  if (adminKey && !headers.get('x-admin-key')) {
    headers.set('x-admin-key', adminKey);
  }

  Object.entries(extra || {}).forEach(([key, value]) => {
    if (value) headers.set(key, value);
  });

  return headers;
}

export async function proxyJson(
  req: NextRequest,
  options: {
    method: 'GET' | 'POST' | 'PATCH';
    path: string;
    search?: string;
    body?: unknown;
    headers?: Record<string, string | undefined>;
  },
) {
  const url = gatewayUrl(options.path, options.search || '');

  if (!url) {
    return NextResponse.json(
      {
        ok: false,
        error: 'api_gateway_not_configured',
        detail:
          'Set APIGW_BASE or API_GATEWAY_BASE_URL for admin MedReach onboarding.',
      },
      { status: 503 },
    );
  }

  const headers = adminHeaders(req, options.headers);

  if (options.method !== 'GET') {
    headers.set('content-type', 'application/json');
  }

  const upstream = await fetch(url, {
    method: options.method,
    headers,
    body: options.method === 'GET' ? undefined : JSON.stringify(options.body || {}),
    cache: 'no-store',
  });

  const json = await upstream.json().catch(() => null);

  return NextResponse.json(json || { ok: upstream.ok }, {
    status: upstream.status,
  });
}