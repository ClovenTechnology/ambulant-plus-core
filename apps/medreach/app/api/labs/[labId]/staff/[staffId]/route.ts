// apps/medreach/app/api/labs/[labId]/staff/[staffId]/route.ts
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

  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();

    if (lower === 'authorization' || lower === 'cookie' || lower.startsWith('x-')) {
      headers.set(key, value);
    }
  });

  headers.set('accept', 'application/json');
  headers.set('x-lab-id', headers.get('x-lab-id') || labId);

  return headers;
}

async function proxy(
  req: NextRequest,
  labId: string,
  staffId: string,
  method: 'PATCH' | 'DELETE',
) {
  const upstreamUrl = gatewayUrl(
    `/api/medreach/labs/${encodeURIComponent(labId)}/staff/${encodeURIComponent(staffId)}`,
    new URL(req.url).search,
  );

  if (!upstreamUrl) {
    return NextResponse.json(
      { ok: false, error: 'api_gateway_not_configured' },
      { status: 503 },
    );
  }

  const body = method === 'PATCH' ? await req.text() : undefined;
  const headers = copyHeaders(req, labId);

  if (method === 'PATCH') {
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { labId: string; staffId: string } },
) {
  const labId = clean(params.labId);
  const staffId = clean(params.staffId);

  if (!labId) {
    return NextResponse.json({ ok: false, error: 'missing_labId' }, { status: 400 });
  }

  if (!staffId) {
    return NextResponse.json({ ok: false, error: 'missing_staffId' }, { status: 400 });
  }

  return proxy(req, labId, staffId, 'PATCH');
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { labId: string; staffId: string } },
) {
  const labId = clean(params.labId);
  const staffId = clean(params.staffId);

  if (!labId) {
    return NextResponse.json({ ok: false, error: 'missing_labId' }, { status: 400 });
  }

  if (!staffId) {
    return NextResponse.json({ ok: false, error: 'missing_staffId' }, { status: 400 });
  }

  return proxy(req, labId, staffId, 'DELETE');
}