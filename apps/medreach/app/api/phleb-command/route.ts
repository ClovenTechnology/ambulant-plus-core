// apps/medreach/app/api/phleb-command/route.ts
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

function copyHeaders(req: NextRequest, phlebId: string) {
  const headers = new Headers();

  for (const [key, value] of req.headers.entries()) {
    const lower = key.toLowerCase();

    if (lower === 'authorization' || lower === 'cookie' || lower.startsWith('x-')) {
      headers.set(key, value);
    }
  }

  headers.set('accept', 'application/json');
  headers.set('content-type', req.headers.get('content-type') || 'application/json');
  headers.set('x-role', headers.get('x-role') || 'phleb');
  headers.set('x-user-id', headers.get('x-user-id') || phlebId);

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

  const phlebId = clean(body.phlebId);
  const jobId = clean(body.jobId || body.drawId || body.orderId);

  if (!phlebId || !jobId) {
    return NextResponse.json(
      { ok: false, error: 'missing_phlebId_or_jobId' },
      { status: 400 },
    );
  }

  const upstreamUrl = gatewayUrl(
    `/api/medreach/phlebs/${encodeURIComponent(phlebId)}/jobs/${encodeURIComponent(jobId)}/command`,
  );

  if (!upstreamUrl) {
    return NextResponse.json(
      { ok: false, error: 'api_gateway_not_configured' },
      { status: 503 },
    );
  }

  const upstream = await fetch(upstreamUrl, {
    method: 'POST',
    headers: copyHeaders(req, phlebId),
    body: bodyText,
    cache: 'no-store',
  });

  const json = await upstream.json().catch(() => null);

  return NextResponse.json(json || { ok: upstream.ok }, {
    status: upstream.status,
  });
}