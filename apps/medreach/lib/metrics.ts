// apps/medreach/app/api/metrics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import type { JobStatus } from '@shared/fsm';
import { getDefaultEarningsConfig, computePerJobEarnings, summarizeEarnings } from '@/lib/earnings';

type Scope = 'phleb' | 'lab' | 'admin';

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

// ---- Root handler ----
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scope = (searchParams.get('scope') as Scope | null) ?? 'phleb';
  const id = searchParams.get('id');

  if (!scope || (scope === 'phleb' && !id)) {
    return NextResponse.json(
      { error: 'Missing scope or id' },
      { status: 400 },
    );
  }

  // 1) Try hitting API gateway if configured
  const gatewayBase = process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL;
  if (gatewayBase) {
    try {
      const upstreamUrl = new URL('/medreach/metrics', gatewayBase);
      if (scope) upstreamUrl.searchParams.set('scope', scope);
      if (id) upstreamUrl.searchParams.set('id', id);

      const upstream = await fetch(upstreamUrl.toString(), {
        cache: 'no-store',
      });

      if (upstream.ok) {
        const data = await upstream.json();
        return NextResponse.json(data);
      }
      // fall through to local mock if not ok
      console.error('Upstream metrics error:', upstream.status);
    } catch (e) {
      console.error('Upstream metrics fetch failed:', e);
      // fall through to local
    }
  }

  // 2) Local mock / computation
  if (scope === 'phleb' && id) {
    const data = await buildLocalPhlebMetrics(id, req);
    return NextResponse.json(data);
  }

  // Minimal mocks for other scopes for now
  if (scope === 'lab' && id) {
    return NextResponse.json({
      scope: 'lab',
      labId: id,
      summary: {
        jobsToday: 12,
        jobsThisWeek: 78,
        jobsThisMonth: 220,
      },
    });
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

// ---- Local phleb metrics implementation ----
async function buildLocalPhlebMetrics(
  phlebId: string,
  req: NextRequest,
): Promise<PhlebMetricsResponse> {
  const config = getDefaultEarningsConfig();

  // Call our own phleb-jobs API to reuse matching + mocks
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
