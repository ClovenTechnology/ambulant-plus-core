import { withPartnerRoute } from '@/lib/partner-route';
// apps/medreach/app/api/phleb-jobs/route.ts
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

function copyHeaders(req: NextRequest, phlebId: string) {
  const headers = new Headers();

  for (const [key, value] of req.headers.entries()) {
    const lower = key.toLowerCase();

    if (lower === 'authorization' || lower === 'cookie' || lower.startsWith('x-')) {
      headers.set(key, value);
    }
  }

  headers.set('accept', 'application/json');
  headers.set('x-role', headers.get('x-role') || 'phleb');
  headers.set('x-user-id', headers.get('x-user-id') || phlebId);

  return headers;
}

function normalizeJobs(raw: any) {
  const data = raw?.data || raw?.jobs || raw?.items || [];

  return Array.isArray(data) ? data : [];
}

async function partnerOriginalGET(req: NextRequest) {
  const url = new URL(req.url);
  const phlebId = clean(url.searchParams.get('phlebId') || url.searchParams.get('id'));

  if (!phlebId) {
    return NextResponse.json(
      { ok: false, error: 'missing_phlebId', data: [], jobs: [] },
      { status: 400 },
    );
  }

  const passthrough = new URLSearchParams(url.searchParams);
  passthrough.delete('id');
  passthrough.delete('phlebId');

  const search = passthrough.toString() ? `?${passthrough.toString()}` : '';

  const upstreamUrl = gatewayUrl(
    `/api/medreach/phlebs/${encodeURIComponent(phlebId)}/jobs`,
    search,
  );

  if (!upstreamUrl) {
    return NextResponse.json(
      { ok: false, error: 'api_gateway_not_configured', data: [], jobs: [] },
      { status: 503 },
    );
  }

  const upstream = await fetch(upstreamUrl, {
    method: 'GET',
    headers: copyHeaders(req, phlebId),
    cache: 'no-store',
  });

  const json = await upstream.json().catch(() => null);

  if (!upstream.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: json?.error || 'phleb_jobs_upstream_failed',
        detail: json,
        data: [],
        jobs: [],
      },
      { status: upstream.status },
    );
  }

  const jobs = normalizeJobs(json);

  return NextResponse.json({
    ok: true,
    data: jobs,
    jobs,
    meta: json?.meta || { phlebId, count: jobs.length },
    upstream: json,
  });
}
export const GET = withPartnerRoute(partnerOriginalGET);
