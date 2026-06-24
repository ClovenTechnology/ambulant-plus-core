// apps/patient-app/app/api/clinicians/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANONICAL_API_GATEWAY = 'https://api-gateway.ambulantplus.co.za';

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

function trimSlash(value: string) {
  return String(value || '').replace(/\/+$/, '');
}

function gatewayBase() {
  return trimSlash(
    process.env.APIGW_BASE ||
      process.env.API_GATEWAY_BASE_URL ||
      process.env.API_GATEWAY_URL ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
      CANONICAL_API_GATEWAY,
  );
}

function gatewayUrl(req: NextRequest) {
  const src = new URL(req.url);
  const dest = new URL('/api/clinicians', gatewayBase());

  src.searchParams.forEach((value, key) => {
    dest.searchParams.append(key, value);
  });

  return dest.toString();
}

function forwardHeaders(req: NextRequest) {
  const headers = new Headers();

  for (const key of [
    'authorization',
    'cookie',
    'x-ambulant-identity',
    'x-ambulant-user-id',
    'x-ambulant-role',
    'x-ambulant-org-id',
    'x-user-id',
    'x-uid',
    'x-role',
    'x-org-id',
    'x-actor-ref-id',
    'x-patient-id',
    'x-current-patient-id',
    'x-request-id',
    'x-correlation-id',
  ]) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  headers.set('accept', 'application/json');

  if (!headers.get('x-role') && !headers.get('x-ambulant-role')) {
    headers.set('x-role', 'patient');
  }

  const defaultOrg = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || '';
  if (defaultOrg && !headers.get('x-org-id') && !headers.get('x-ambulant-org-id')) {
    headers.set('x-org-id', defaultOrg);
  }

  return headers;
}

function relayHeaders(upstream: Response) {
  const headers = new Headers();

  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  headers.set('cache-control', 'no-store, max-age=0');
  return headers;
}

export async function GET(req: NextRequest) {
  try {
    const upstream = await fetch(gatewayUrl(req), {
      method: 'GET',
      headers: forwardHeaders(req),
      cache: 'no-store',
    });

    const contentType = upstream.headers.get('content-type') || '';
    const headers = relayHeaders(upstream);

    if (contentType.includes('application/json')) {
      const json: any = await upstream.json().catch(() => null);

      if (json && typeof json === 'object') {
        const items = Array.isArray(json.items)
          ? json.items
          : Array.isArray(json.clinicians)
            ? json.clinicians
            : Array.isArray(json.data)
              ? json.data
              : [];

        const meta =
          json.meta && typeof json.meta === 'object'
            ? {
                ...json.meta,
                total: Number(json.meta.total ?? items.length),
                page: Number(json.meta.page ?? 1),
                perPage: Number(json.meta.perPage ?? json.meta.pageSize ?? 25),
              }
            : { total: items.length, page: 1, perPage: 25 };

        return NextResponse.json(
          {
            ...json,
            ok: json.ok !== false,
            items,
            clinicians: items,
            data: items,
            meta,
          },
          {
            status: upstream.status,
            headers,
          },
        );
      }

      return NextResponse.json(
        {
          ok: false,
          error: 'invalid_clinician_directory_response',
          items: [],
          clinicians: [],
          data: [],
          meta: { total: 0, page: 1, perPage: 25 },
        },
        {
          status: upstream.status,
          headers,
        },
      );
    }

    const text = await upstream.text().catch(() => '');
    return new NextResponse(text, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: 'clinician_directory_proxy_failed',
        message: error instanceof Error ? error.message : String(error),
        items: [],
        clinicians: [],
        meta: { total: 0, page: 1, perPage: 25 },
      },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  }
}
