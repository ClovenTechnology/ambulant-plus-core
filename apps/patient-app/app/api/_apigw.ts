// apps/patient-app/app/api/_apigw.ts
import { NextRequest, NextResponse } from 'next/server';

export const CANONICAL_API_GATEWAY = 'https://api-gateway.ambulantplus.co.za';

function trimSlash(value: string) {
  return String(value || '').replace(/\/+$/, '');
}

export function apigwBase() {
  const configured =
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    '';

  return trimSlash(configured.trim() || CANONICAL_API_GATEWAY);
}

export function jsonError(
  errorOrMessage: unknown,
  statusOrCode: number | string = 400,
  extraOrStatus?: Record<string, unknown> | number,
) {
  let status = 400;
  let error = 'request_failed';
  let extra: Record<string, unknown> = {};

  if (typeof statusOrCode === 'number') {
    status = statusOrCode;
    error =
      typeof errorOrMessage === 'string'
        ? errorOrMessage
        : (errorOrMessage as any)?.code || (errorOrMessage as any)?.name || 'request_failed';

    if (extraOrStatus && typeof extraOrStatus === 'object') {
      extra = extraOrStatus;
    }
  } else {
    error = statusOrCode || 'request_failed';
    status = typeof extraOrStatus === 'number' ? extraOrStatus : 400;
  }

  const message =
    typeof errorOrMessage === 'string'
      ? errorOrMessage
      : (errorOrMessage as any)?.message
        ? String((errorOrMessage as any).message)
        : undefined;

  return NextResponse.json(
    {
      ok: false,
      error,
      ...(message ? { message } : {}),
      ...extra,
    },
    {
      status,
      headers: { 'cache-control': 'no-store' },
    },
  );
}

function searchParamsFrom(source: URL | string | NextRequest | URLSearchParams | null | undefined) {
  if (!source) return null;

  if (source instanceof URLSearchParams) return source;
  if (source instanceof URL) return source.searchParams;

  if (typeof source === 'string') {
    try {
      return new URL(source).searchParams;
    } catch {
      try {
        return new URL(source, 'http://localhost').searchParams;
      } catch {
        return null;
      }
    }
  }

  const nextUrl = (source as any)?.nextUrl;
  if (nextUrl instanceof URL) return nextUrl.searchParams;
  if (nextUrl?.searchParams instanceof URLSearchParams) return nextUrl.searchParams;

  const url = (source as any)?.url;
  if (typeof url === 'string') {
    try {
      return new URL(url).searchParams;
    } catch {
      return null;
    }
  }

  return null;
}

export function appendIncomingSearchParams(
  first: URL | string | NextRequest | URLSearchParams,
  second?: URL | string | NextRequest | URLSearchParams | null,
  options?: { overwrite?: boolean; exclude?: string[] } | string[],
) {
  const firstIsTarget = first instanceof URL;
  const secondIsTarget = second instanceof URL;

  const target =
    firstIsTarget
      ? first
      : secondIsTarget
        ? second
        : new URL(String(first));

  const source = firstIsTarget ? second : first;

  const overwrite = !Array.isArray(options) && options?.overwrite === true;
  const excludeList = Array.isArray(options) ? options : options?.exclude || [];
  const exclude = new Set(excludeList.map((x) => String(x)));

  const searchParams = searchParamsFrom(source);
  if (!searchParams) return target;

  searchParams.forEach((value, key) => {
    if (exclude.has(key)) return;

    if (overwrite) {
      target.searchParams.set(key, value);
      return;
    }

    if (!target.searchParams.has(key)) {
      target.searchParams.append(key, value);
    }
  });

  return target;
}

export function forwardHeaders(
  req: NextRequest,
  extra?: HeadersInit,
  contentType?: string | null,
) {
  const headers = new Headers(extra || undefined);

  const passthrough = [
    'authorization',
    'cookie',
    'x-ambulant-identity',
    'x-ambulant-user-id',
    'x-ambulant-org-id',
    'x-ambulant-role',
    'x-user-id',
    'x-uid',
    'x-role',
    'x-email',
    'x-name',
    'x-display-name',
    'x-org-id',
    'x-correlation-id',
    'x-request-id',
    'x-patient-id',
    'x-actor-ref-id',
  ];

  for (const key of passthrough) {
    const value = req.headers.get(key);
    if (value && !headers.has(key)) headers.set(key, value);
  }

  if (contentType !== null && !headers.has('content-type')) {
    headers.set('content-type', contentType || 'application/json');
  }

  if (!headers.has('accept')) {
    headers.set('accept', 'application/json');
  }

  return headers;
}

export async function relayJsonResponse(
  upstream: Response,
  fallbackStatus?: number,
  extraHeaders?: HeadersInit,
) {
  const text = await upstream.text();

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { ok: upstream.ok, raw: text };
  }

  const headers = new Headers(extraHeaders || undefined);
  headers.set('cache-control', 'no-store');

  return NextResponse.json(data ?? {}, {
    status: fallbackStatus || upstream.status || 200,
    headers,
  });
}

export async function relayAnyResponse(
  upstream: Response,
  fallbackStatus?: number,
  extraHeaders?: HeadersInit,
) {
  const headers = new Headers(extraHeaders || undefined);
  headers.set('cache-control', 'no-store');

  const contentType = upstream.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  const body = await upstream.arrayBuffer();

  return new NextResponse(body, {
    status: fallbackStatus || upstream.status || 200,
    headers,
  });
}

export function apigwUrl(pathname: string, req?: NextRequest | null) {
  const base = apigwBase();
  const safePath = pathname.startsWith('/') ? pathname : '/' + pathname;
  const url = new URL(safePath, base);

  if (req) appendIncomingSearchParams(url, req);

  return url;
}
