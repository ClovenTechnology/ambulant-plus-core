// apps/medreach/app/api/lab-panels/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown) {
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

function copyHeaders(req: NextRequest, labId: string) {
  const headers = new Headers();

  for (const [key, value] of req.headers.entries()) {
    const lower = key.toLowerCase();

    if (lower === 'authorization' || lower === 'cookie' || lower.startsWith('x-')) {
      headers.set(key, value);
    }
  }

  headers.set('accept', 'application/json');
  headers.set('x-lab-id', headers.get('x-lab-id') || labId);

  return headers;
}

function normalizePanels(raw: any) {
  const data = raw?.data || raw?.panels || raw?.items || [];

  return Array.isArray(data) ? data : [];
}

async function proxy(req: NextRequest, method: 'GET' | 'POST' | 'PATCH') {
  const url = new URL(req.url);
  let labId = clean(url.searchParams.get('labId'));
  let bodyText: string | undefined;

  if (method !== 'GET') {
    bodyText = await req.text();

    try {
      const body = JSON.parse(bodyText || '{}');
      labId = labId || clean(body.labId);
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
    }
  }

  if (!labId) {
    return NextResponse.json({ ok: false, error: 'missing_labId' }, { status: 400 });
  }

  const upstreamUrl = gatewayUrl(
    `/api/medreach/labs/${encodeURIComponent(labId)}/panels`,
    method === 'GET' ? url.search : '',
  );

  if (!upstreamUrl) {
    return NextResponse.json(
      { ok: false, error: 'api_gateway_not_configured', panels: [] },
      { status: 503 },
    );
  }

  const headers = copyHeaders(req, labId);

  if (method !== 'GET') {
    headers.set('content-type', req.headers.get('content-type') || 'application/json');
  }

  const upstream = await fetch(upstreamUrl, {
    method,
    headers,
    body: method === 'GET' ? undefined : bodyText,
    cache: 'no-store',
  });

  const json = await upstream.json().catch(() => null);

  if (!upstream.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: json?.error || 'lab_panels_upstream_failed',
        detail: json,
        panels: [],
      },
      { status: upstream.status },
    );
  }

  const panels = normalizePanels(json);

  return NextResponse.json({
    ok: true,
    data: panels,
    panels,
    meta: json?.meta || { labId, count: panels.length },
    upstream: json,
  });
}

export async function GET(req: NextRequest) {
  return proxy(req, 'GET');
}

export async function POST(req: NextRequest) {
  return proxy(req, 'POST');
}

export async function PATCH(req: NextRequest) {
  return proxy(req, 'PATCH');
}