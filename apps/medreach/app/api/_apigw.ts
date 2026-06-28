// apps/medreach/app/api/_apigw.ts
import { NextRequest, NextResponse } from 'next/server';

type JsonLike = Record<string, unknown> | unknown[] | string | number | boolean | null;

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

const IDENTITY_HEADER_ALLOWLIST = [
  'authorization',
  'cookie',
  'x-ambulant-identity',
  'x-ambulant-user-id',
  'x-ambulant-role',
  'x-ambulant-org-id',
  'x-ambulant-workspace',
  'x-ambulant-trusted',
  'x-user-id',
  'x-uid',
  'x-role',
  'x-org-id',
  'x-lab-id',
  'x-staff-lab-id',
  'x-actor-ref-id',
  'x-patient-id',
  'x-current-patient-id',
  'x-idempotency-key',
  'x-medreach-broadcast-key',
  'x-medreach-server-actor',
];

export function apigwBase() {
  const base =
    process.env.APIGW_BASE ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL;

  if (!base) {
    throw new Error(
      'Missing APIGW_BASE. Set APIGW_BASE to the production API Gateway origin.',
    );
  }

  return base.replace(/\/+$/, '');
}

export function apigwUrl(path: string, searchParams?: URLSearchParams) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(cleanPath, apigwBase());

  if (searchParams) {
    searchParams.forEach((value, key) => {
      url.searchParams.append(key, value);
    });
  }

  return url;
}

export function jsonError(
  error: string,
  status: number,
  details?: JsonLike,
) {
  return NextResponse.json(
    {
      ok: false,
      error,
      details: details ?? null,
    },
    {
      status,
      headers: {
        'cache-control': 'no-store',
      },
    },
  );
}

export function upstreamNotImplemented(path: string, upstreamStatus?: number) {
  return jsonError('gateway_endpoint_not_implemented', 501, {
    path,
    upstreamStatus: upstreamStatus ?? null,
  });
}

export function badRequest(error: string, details?: JsonLike) {
  return jsonError(error, 400, details);
}

export function copyRequestHeaders(
  req: NextRequest,
  extra?: Record<string, string | null | undefined>,
) {
  const headers = new Headers();

  for (const name of IDENTITY_HEADER_ALLOWLIST) {
    const value = req.headers.get(name);

    if (value) {
      headers.set(name, value);
    }
  }

  headers.set('accept', 'application/json');

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value != null && value !== '') {
        headers.set(key, String(value));
      }
    }
  }

  return headers;
}

export async function proxyJsonResponse(upstream: Response) {
  const headers = new Headers();

  headers.set('cache-control', 'no-store');

  const contentType = upstream.headers.get('content-type') || '';

  if (contentType) {
    headers.set('content-type', contentType);
  }

  if (contentType.includes('application/json')) {
    const data = await upstream.json().catch(() => null);

    return NextResponse.json(data, {
      status: upstream.status,
      headers,
    });
  }

  const text = await upstream.text().catch(() => '');

  return new NextResponse(text, {
    status: upstream.status,
    headers,
  });
}

export async function proxyToGateway(req: NextRequest, input: {
  path: string;
  method?: string;
  searchParams?: URLSearchParams;
  body?: unknown;
  headers?: Record<string, string | null | undefined>;
}) {
  const url = apigwUrl(input.path, input.searchParams);
  const method = input.method || req.method;
  const headers = copyRequestHeaders(req, input.headers);

  const init: RequestInit = {
    method,
    headers,
    cache: 'no-store',
  };

  if (!['GET', 'HEAD'].includes(method.toUpperCase())) {
    headers.set('content-type', 'application/json');
    init.body = JSON.stringify(input.body ?? {});
  }

  let upstream: Response;

  try {
    upstream = await fetch(url.toString(), init);
  } catch (err) {
    return jsonError('gateway_unreachable', 502, {
      path: input.path,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  if (upstream.status === 404) {
    return upstreamNotImplemented(input.path, upstream.status);
  }

  return proxyJsonResponse(upstream);
}

export function stripHopByHopHeaders(headers: Headers) {
  const out = new Headers();

  headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      out.set(key, value);
    }
  });

  return out;
}