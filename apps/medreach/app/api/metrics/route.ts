// apps/medreach/app/api/metrics/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Scope = 'admin' | 'lab' | 'phleb';

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

function daysFromRange(value: string | null) {
  const range = clean(value).toLowerCase();

  if (range === 'today') return '1';
  if (range === '7d') return '7';
  if (range === '30d') return '30';
  if (range === '90d') return '90';

  return '';
}

function copyHeaders(req: NextRequest, scope: Scope, id: string) {
  const headers = new Headers();

  for (const [key, value] of req.headers.entries()) {
    const lower = key.toLowerCase();

    if (
      lower === 'authorization' ||
      lower === 'cookie' ||
      lower.startsWith('x-')
    ) {
      headers.set(key, value);
    }
  }

  headers.set('accept', 'application/json');

  /**
   * These are convenience headers for the MedReach app proxy.
   * In production, the API Gateway should still enforce real identity.
   */
  if (scope === 'lab' && id) {
    headers.set('x-lab-id', headers.get('x-lab-id') || id);
    headers.set('x-role', headers.get('x-role') || 'lab');
  }

  if (scope === 'phleb' && id) {
    headers.set('x-user-id', headers.get('x-user-id') || id);
    headers.set('x-role', headers.get('x-role') || 'phleb');
  }

  return headers;
}

function getPayload(raw: any) {
  return raw?.data || raw || {};
}

function statusCount(obj: any, keys: string[]) {
  const counts = obj || {};

  return keys.reduce((sum, key) => sum + Number(counts[key] || 0), 0);
}

function adaptMetrics(raw: any, scope: Scope, id: string | null) {
  const data = getPayload(raw);
  const registry = data.registry || {};
  const marketplace = data.marketplace || {};
  const specimens = data.specimens || {};
  const finance = data.finance || {};
  const operations = data.operations || {};
  const drawStatusCounts = marketplace.drawStatusCounts || {};
  const bundleStatusCounts = specimens.bundleStatusCounts || {};

  if (scope === 'lab') {
    const orders = Number(marketplace.draws || 0);

    return {
      ok: raw?.ok !== false,
      data,
      scope: 'lab',
      labId: id,
      summary: {
        ordersToday: orders,
        ordersThisWeek: orders,
        ordersThisMonth: orders,
        marketplaceOpen: statusCount(drawStatusCounts, [
          'MARKETPLACE_OPEN',
          'WAITING_LAB_SELECTION',
        ]),
        deliveredToLab: statusCount(drawStatusCounts, [
          'DELIVERED_TO_LAB',
          'RECEIVED_AT_LAB',
        ]),
        resultsPending: statusCount(drawStatusCounts, [
          'WAITING_LAB_SELECTION',
          'WAITING_PHLEB',
          'ASSIGNED',
          'IN_PROGRESS',
        ]),
        resultsReady: statusCount(bundleStatusCounts, ['ACCEPTED']),
        resultsSent: statusCount(bundleStatusCounts, ['ACCEPTED']),
      },
      registry,
      marketplace,
      specimens,
      finance,
      operations,
      upstream: raw,
    };
  }

  if (scope === 'phleb') {
    const jobs = Number(marketplace.draws || 0);
    const gross = Number(finance.phlebGrossCents || 0) / 100;

    return {
      ok: raw?.ok !== false,
      data,
      scope: 'phleb',
      phlebId: id,
      config: {
        baseCalloutFeeZAR: 0,
        perKmAfterFreeZAR: 0,
        freeKm: 0,
      },
      summary: {
        jobsToday: jobs,
        jobsThisWeek: jobs,
        jobsThisMonth: jobs,
        activeJobs: statusCount(drawStatusCounts, [
          'WAITING_PHLEB',
          'PHLEB_EN_ROUTE_TO_PATIENT',
          'PHLEB_ARRIVED',
          'SAMPLING_IN_PROGRESS',
          'PHLEB_EN_ROUTE_TO_LAB',
        ]),
      },
      earnings: {
        todayZAR: gross,
        thisWeekZAR: gross,
        thisMonthZAR: gross,
        allTimeZAR: gross,
      },
      perJob: [],
      registry,
      marketplace,
      specimens,
      finance,
      operations,
      upstream: raw,
    };
  }

  const draws = Number(marketplace.draws || 0);
  const pendingCollections = statusCount(drawStatusCounts, [
    'WAITING_PHLEB',
    'PHLEB_EN_ROUTE_TO_PATIENT',
    'PHLEB_ARRIVED',
    'SAMPLING_IN_PROGRESS',
    'PHLEB_EN_ROUTE_TO_LAB',
  ]);

  return {
    ok: raw?.ok !== false,
    data,
    scope: 'admin',
    surface: 'medreach',
    jobsToday: draws,
    pendingCollections,
    completedLabs: Number(registry.activeLabs || 0),
    chart: {
      labels: ['Draws', 'Eligible labs', 'Bundles', 'Audit events'],
      values: [
        Number(marketplace.draws || 0),
        Number(marketplace.eligibleLabRows || 0),
        Number(specimens.bundles || 0),
        Number(operations.auditEvents || 0),
      ],
    },
    registry,
    marketplace,
    specimens,
    finance,
    operations,
    upstream: raw,
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const scope = (clean(url.searchParams.get('scope')) || 'admin') as Scope;
  const id = clean(url.searchParams.get('id'));

  const days =
    clean(url.searchParams.get('days')) ||
    daysFromRange(url.searchParams.get('range')) ||
    '30';

  const upstreamSearch = new URLSearchParams();
  upstreamSearch.set('days', days);

  if (scope) upstreamSearch.set('scope', scope);
  if (id) upstreamSearch.set('id', id);

  const upstreamUrl = gatewayUrl(
    '/api/medreach/metrics',
    `?${upstreamSearch.toString()}`,
  );

  if (!upstreamUrl) {
    return NextResponse.json(
      {
        ok: false,
        error: 'api_gateway_not_configured',
        detail:
          'Set APIGW_BASE, NEXT_PUBLIC_APIGW_BASE or NEXT_PUBLIC_API_GATEWAY_BASE_URL. Local metric fallbacks are disabled.',
      },
      { status: 503 },
    );
  }

  const upstream = await fetch(upstreamUrl, {
    method: 'GET',
    headers: copyHeaders(req, scope, id),
    cache: 'no-store',
  });

  const json = await upstream.json().catch(() => null);

  if (!upstream.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: json?.error || 'metrics_upstream_failed',
        detail: json,
      },
      { status: upstream.status },
    );
  }

  return NextResponse.json(adaptMetrics(json, scope, id || null));
}