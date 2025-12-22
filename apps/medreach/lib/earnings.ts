// apps/medreach/lib/earnings.ts
import type { JobStatus } from '@shared/fsm';

export type EarningsConfig = {
  baseCalloutFeeZAR: number;
  perKmAfterFreeZAR: number;
  freeKm: number;
};

export type EarningsJobInput = {
  jobId: string;
  displayId: string;
  status: JobStatus;
  createdAt: string;
  deliveredAt?: string | null;
  distanceKm?: number;
};

export type PerJobEarnings = EarningsJobInput & {
  earningsZAR: number;
};

export type EarningsSummary = {
  todayZAR: number;
  thisWeekZAR: number;
  thisMonthZAR: number;
  allTimeZAR: number;
  todayJobs: number;
  thisWeekJobs: number;
  thisMonthJobs: number;
  allTimeJobs: number;
};

export function getDefaultEarningsConfig(): EarningsConfig {
  const base = Number(process.env.NEXT_PUBLIC_CALLOUT_BASE_FEE_ZAR ?? '50');
  const perKm = Number(process.env.NEXT_PUBLIC_CALLOUT_RATE_PER_KM_ZAR ?? '5');
  const freeKm = Number(process.env.NEXT_PUBLIC_CALLOUT_FREE_KM ?? '5');

  return {
    baseCalloutFeeZAR: isNaN(base) ? 50 : base,
    perKmAfterFreeZAR: isNaN(perKm) ? 5 : perKm,
    freeKm: isNaN(freeKm) ? 5 : freeKm,
  };
}

export function computeJobEarnings(
  distanceKm: number | undefined,
  config: EarningsConfig,
): number {
  const d = typeof distanceKm === 'number' && distanceKm >= 0 ? distanceKm : 0;
  const extraKm = Math.max(0, d - config.freeKm);
  return config.baseCalloutFeeZAR + extraKm * config.perKmAfterFreeZAR;
}

export function computePerJobEarnings(
  jobs: EarningsJobInput[],
  config: EarningsConfig,
): PerJobEarnings[] {
  return jobs.map((job) => ({
    ...job,
    earningsZAR: computeJobEarnings(job.distanceKm, config),
  }));
}

export function summarizeEarnings(
  jobs: PerJobEarnings[],
): EarningsSummary {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const isCompleted = (status: JobStatus) => status === 'DELIVERED_TO_LAB';

  let todayZAR = 0,
    thisWeekZAR = 0,
    thisMonthZAR = 0,
    allTimeZAR = 0;
  let todayJobs = 0,
    thisWeekJobs = 0,
    thisMonthJobs = 0,
    allTimeJobs = 0;

  for (const job of jobs) {
    if (!isCompleted(job.status)) continue;

    const completedAt = job.deliveredAt
      ? new Date(job.deliveredAt)
      : new Date(job.createdAt);
    const t = completedAt.getTime();

    allTimeZAR += job.earningsZAR;
    allTimeJobs += 1;

    if (t >= thirtyDaysAgo.getTime()) {
      thisMonthZAR += job.earningsZAR;
      thisMonthJobs += 1;
    }
    if (t >= sevenDaysAgo.getTime()) {
      thisWeekZAR += job.earningsZAR;
      thisWeekJobs += 1;
    }
    if (t >= startOfToday.getTime()) {
      todayZAR += job.earningsZAR;
      todayJobs += 1;
    }
  }

  return {
    todayZAR,
    thisWeekZAR,
    thisMonthZAR,
    allTimeZAR,
    todayJobs,
    thisWeekJobs,
    thisMonthJobs,
    allTimeJobs,
  };
}
