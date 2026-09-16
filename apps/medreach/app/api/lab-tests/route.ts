import { withPartnerRoute } from '@/lib/partner-route';
// apps/medreach/app/api/lab-tests/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type LabTest = {
  id?: string;
  labId?: string;
  catalogTestId?: string | null;
  code: string;
  localCode?: string | null;
  name: string;
  localName?: string;
  category?: string | null;
  specimenType?: string | null;
  sampleType?: string | null;
  containerType?: string | null;
  priceCents?: number;
  priceZAR?: number;
  currency?: string;
  turnaroundHours?: number;
  etaDays?: number;
  requiresColdChain?: boolean;
  requiredTempMinC?: number | null;
  requiredTempMaxC?: number | null;
  maxTransitMins?: number | null;
  prepNotes?: string | null;
  instructions?: string;
  active?: boolean;
};

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

function normalizeTests(raw: any): LabTest[] {
  const data = raw?.data || raw?.tests || raw?.items || [];

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

  const search = method === 'GET' ? url.search : '';
  const upstreamUrl = gatewayUrl(
    `/api/medreach/labs/${encodeURIComponent(labId)}/tests`,
    search,
  );

  if (!upstreamUrl) {
    return NextResponse.json(
      { ok: false, error: 'api_gateway_not_configured', tests: [] },
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
        error: json?.error || 'lab_tests_upstream_failed',
        detail: json,
        tests: [],
      },
      { status: upstream.status },
    );
  }

  const tests = normalizeTests(json);

  return NextResponse.json({
    ok: true,
    data: tests,
    tests,
    meta: json?.meta || { labId, count: tests.length },
    upstream: json,
  });
}

async function partnerOriginalGET(req: NextRequest) {
  return proxy(req, 'GET');
}

async function partnerOriginalPOST(req: NextRequest) {
  return proxy(req, 'POST');
}

async function partnerOriginalPATCH(req: NextRequest) {
  return proxy(req, 'PATCH');
}
export const GET = withPartnerRoute(partnerOriginalGET);
export const POST = withPartnerRoute(partnerOriginalPOST);
export const PATCH = withPartnerRoute(partnerOriginalPATCH);
