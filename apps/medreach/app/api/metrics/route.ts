// apps/medreach/app/api/metrics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import type { JobStatus } from '@shared/fsm';
import {
  getDefaultEarningsConfig,
  computePerJobEarnings,
  summarizeEarnings,
} from '@/lib/earnings';

type Scope = 'phleb' | 'lab' | 'admin';

type AdminMedreachMetrics = {
  scope: 'admin';
  surface: 'medreach';
  jobsToday: number;
  pendingCollections: number;
  completedLabs: number;
  chart: {
    labels: string[];
    values: number[];
  };
};

type PhlebMetricsResponse = {
  scope: 'phleb';
  phlebId: string;
  config: {
    baseCalloutFeeZAR: number;
    perKmAfterFreeZAR: number;
    freeKm: number;
  };
  summary: {
    jobsToday: number;
    jobsThisWeek: number;
    jobsThisMonth: number;
    activeJobs: number;
  };
  earnings: {
    todayZAR: number;
    thisWeekZAR: number;
    thisMonthZAR: number;
    allTimeZAR: number;
  };
  perJob: {
    jobId: string;
    displayId: string;
    status: JobStatus;
    createdAt: string;
    deliveredAt?: string | null;
    distanceKm?: number;
    earningsZAR: number;
  }[];
};

type LabMetricsResponse = {
  scope: 'lab';
  labId: string;
  summary: {
    ordersToday: number;
    ordersThisWeek: number;
    ordersThisMonth: number;
    marketplaceOpen: number;
    deliveredToLab: number;
    resultsPending: number;
    resultsReady: number;
    resultsSent: number;
  };
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scope = (searchParams.get('scope') as Scope | null) ?? 'phleb';
  const id = searchParams.get('id');
  const surface = searchParams.get('surface') || undefined;
  const range = (searchParams.get('range') as 'today' | '7d' | '30d' | null) ?? '7d';

  const gatewayBase = process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL;

  // Admin MedReach overview
  if (scope === 'admin' && surface === 'medreach') {
    if (gatewayBase) {
      try {
        const upstreamUrl = new URL('/medreach/metrics', gatewayBase);
        upstreamUrl.searchParams.set('surface', 'medreach');
        upstreamUrl.searchParams.set('range', range);
        const upstream = await fetch(upstreamUrl.toString(), { cache: 'no-store' });
        if (upstream.ok) {
          const data = await upstream.json();
          return NextResponse.json(data);
        }
        console.error('Upstream admin medreach metrics error:', upstream.status);
      } catch (e) {
        console.error('Upstream admin medreach metrics failed:', e);
      }
    }

    const adminMetrics = buildLocalAdminMedreachMetrics(range);
    return NextResponse.json(adminMetrics);
  }

  if (!scope || (scope === 'phleb' && !id)) {
    return NextResponse.json(
      { error: 'Missing scope or id' },
      { status: 400 },
    );
  }

  if (gatewayBase) {
    try {
      const upstreamUrl = new URL('/medreach/metrics', gatewayBase);
      upstreamUrl.searchParams.set('scope', scope);
      if (id) upstreamUrl.searchParams.set('id', id);
      if (surface) upstreamUrl.searchParams.set('surface', surface);
      if (range) upstreamUrl.searchParams.set('range', range);

      const upstream = await fetch(upstreamUrl.toString(), {
        cache: 'no-store',
      });

      if (upstream.ok) {
        const data = await upstream.json();
        return NextResponse.json(data);
      }
      console.error('Upstream metrics error:', upstream.status);
    } catch (e) {
      console.error('Upstream metrics fetch failed:', e);
      // fall through to local
    }
  }

  if (scope === 'phleb' && id) {
    const data = await buildLocalPhlebMetrics(id, req);
    return NextResponse.json(data);
  }

  if (scope === 'lab' && id) {
    const data = await buildLocalLabMetrics(id, req);
    return NextResponse.json(data);
  }

  if (scope === 'admin') {
    return NextResponse.json({
      scope: 'admin',
      summary: {
        totalLabs: 5,
        totalPhlebs: 18,
        jobsToday: 63,
      },
    });
  }

  return NextResponse.json({ error: 'Unsupported scope' }, { status: 400 });
}

// ---- Local Admin MedReach metrics ----

function buildLocalAdminMedreachMetrics(range: 'today' | '7d' | '30d'): AdminMedreachMetrics {
  let labels: string[] = [];
  let values: number[] = [];

  if (range === 'today') {
    labels = ['08h', '10h', '12h', '14h', '16h', '18h'];
    values = [3, 5, 8, 6, 4, 2];
  } else if (range === '7d') {
    labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    values = [12, 18, 15, 20, 24, 10, 8];
  } else {
    labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    values = [60, 74, 89, 81];
  }

  const jobsToday = range === 'today' ? values.reduce((a, b) => a + b, 0) : 24;
  const pendingCollections = 9;
  const completedLabs = 42;

  return {
    scope: 'admin',
    surface: 'medreach',
    jobsToday,
    pendingCollections,
    completedLabs,
    chart: { labels, values },
  };
}

// ---- Local PHLEB metrics ----

async function buildLocalPhlebMetrics(
  phlebId: string,
  req: NextRequest,
): Promise<PhlebMetricsResponse> {
  const config = getDefaultEarningsConfig();

  const url = new URL(req.url);
  url.pathname = '/api/phleb-jobs';
  url.searchParams.set('phlebId', phlebId);

  const jobsRes = await fetch(url.toString(), { cache: 'no-store' });
  const jobsJson = await jobsRes.json();
  const jobs = (jobsJson.jobs || []) as Array<{
    id: string;
    displayId: string;
    status: JobStatus;
    createdAt: string;
    distanceKm?: number;
  }>;

  const perJobRaw = jobs.map((job) => ({
    jobId: job.id,
    displayId: job.displayId,
    status: job.status,
    createdAt: job.createdAt,
    deliveredAt: job.status === 'DELIVERED_TO_LAB' ? job.createdAt : undefined,
    distanceKm: job.distanceKm,
  }));

  const perJob = computePerJobEarnings(perJobRaw, config);
  const earningsSummary = summarizeEarnings(perJob);

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  let jobsToday = 0;
  let jobsThisWeek = 0;
  let jobsThisMonth = 0;
  let activeJobs = 0;

  for (const job of jobs) {
    const created = new Date(job.createdAt).getTime();
    if (created >= startOfToday.getTime()) jobsToday += 1;
    if (created >= sevenDaysAgo.getTime()) jobsThisWeek += 1;
    if (created >= thirtyDaysAgo.getTime()) jobsThisMonth += 1;

    if (job.status !== 'DELIVERED_TO_LAB') activeJobs += 1;
  }

  return {
    scope: 'phleb',
    phlebId,
    config,
    summary: {
      jobsToday,
      jobsThisWeek,
      jobsThisMonth,
      activeJobs,
    },
    earnings: {
      todayZAR: earningsSummary.todayZAR,
      thisWeekZAR: earningsSummary.thisWeekZAR,
      thisMonthZAR: earningsSummary.thisMonthZAR,
      allTimeZAR: earningsSummary.allTimeZAR,
    },
    perJob,
  };
}

// ---- Local LAB metrics ----

async function buildLocalLabMetrics(
  labId: string,
  req: NextRequest,
): Promise<LabMetricsResponse> {
  const url = new URL(req.url);
  url.pathname = '/api/lab-orders';
  url.searchParams.set('labId', labId);

  const res = await fetch(url.toString(), { cache: 'no-store' });
  const json = await res.json();
  const assigned = (json.assigned || []) as Array<{
    id: string;
    createdAt: string;
    status: JobStatus;
    resultStatus: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'SENT';
  }>;
  const marketplace = (json.marketplace || []) as any[];

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  let ordersToday = 0;
  let ordersThisWeek = 0;
  let ordersThisMonth = 0;
  let deliveredToLab = 0;
  let resultsPending = 0;
  let resultsReady = 0;
  let resultsSent = 0;

  for (const o of assigned) {
    const created = new Date(o.createdAt).getTime();
    if (created >= startOfToday.getTime()) ordersToday += 1;
    if (created >= sevenDaysAgo.getTime()) ordersThisWeek += 1;
    if (created >= thirtyDaysAgo.getTime()) ordersThisMonth += 1;

    if (o.status === 'DELIVERED_TO_LAB') {
      deliveredToLab += 1;
    }

    if (o.resultStatus === 'PENDING' || o.resultStatus === 'IN_PROGRESS') {
      resultsPending += 1;
    } else if (o.resultStatus === 'READY') {
      resultsReady += 1;
    } else if (o.resultStatus === 'SENT') {
      resultsSent += 1;
    }
  }

  const marketplaceOpen = marketplace.length;

  return {
    scope: 'lab',
    labId,
    summary: {
      ordersToday,
      ordersThisWeek,
      ordersThisMonth,
      marketplaceOpen,
      deliveredToLab,
      resultsPending,
      resultsReady,
      resultsSent,
    },
  };
}
