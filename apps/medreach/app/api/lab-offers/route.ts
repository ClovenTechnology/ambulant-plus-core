// apps/medreach/app/api/lab-offers/route.ts
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

function gatewayUrl(path: string) {
  const base = gatewayBase();
  if (!base) return null;

  const cleanPath = path.replace(/^\/+/, '');
  const finalPath =
    base.endsWith('/api') && cleanPath.startsWith('api/')
      ? cleanPath.slice(4)
      : cleanPath;

  return `${base}/${finalPath}`;
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
  headers.set('content-type', req.headers.get('content-type') || 'application/json');
  headers.set('x-lab-id', headers.get('x-lab-id') || labId);

  return headers;
}

export async function POST(req: NextRequest) {
  const bodyText = await req.text();

  let body: any;

  try {
    body = JSON.parse(bodyText || '{}');
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const labId = clean(body.labId);

  if (!labId) {
    return NextResponse.json({ ok: false, error: 'missing_labId' }, { status: 400 });
  }

  const upstreamUrl = gatewayUrl(
    `/api/medreach/labs/${encodeURIComponent(labId)}/offers`,
  );

  if (!upstreamUrl) {
    return NextResponse.json(
      { ok: false, error: 'api_gateway_not_configured' },
      { status: 503 },
    );
  }

  const upstream = await fetch(upstreamUrl, {
    method: 'POST',
    headers: copyHeaders(req, labId),
    body: bodyText,
    cache: 'no-store',
  });

  const json = await upstream.json().catch(() => null);

  return NextResponse.json(json || { ok: upstream.ok }, {
    status: upstream.status,
  });
}