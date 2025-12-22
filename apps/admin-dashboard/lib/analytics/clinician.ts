// apps/admin-dashboard/lib/analytics/clinician.ts

import type { PrismaClient } from '@prisma/client';

/* --------------------------------------------------------- */
/* Types                                                     */
/* --------------------------------------------------------- */

export type ClinicianAnalyticsTimeRange = {
  from: string; // ISO 8601
  to: string;   // ISO 8601
  granularity: 'day' | 'week' | 'month';
};

export type ClinicianProductivityKpis = {
  totalCliniciansActive: number;
  totalConsults: number;
  totalAsyncThreads: number;
  totalRevenueCents: number;

  avgRevenuePerConsultCents: number;
  avgRevenuePerClinicianCents: number;

  medianTimeToFirstResponseMinutes: number;
  p90TimeToFirstResponseMinutes: number;

  avgRating: number;
  ratingCount: number;

  avgPanelSize90d: number;
  avgUtilizationRate: number; // 0–1
};

export type ClinicianTimeseriesPoint = {
  ts: string; // bucket start ISO date
  consults: number;
  asyncThreads: number;
  revenueCents: number;
  medianTimeToFirstResponseMinutes: number;
};

export type DistributionBucket = {
  label: string;
  count: number;
};

export type CaseMixEntry = {
  syndrome: string;  // e.g. 'respiratory'
  consults: number;
  share: number;     // 0–1
};

export type ClinicianOutlierType =
  | 'high_no_show'
  | 'high_refund'
  | 'slow_response'
  | 'burnout_risk'
  | 'underutilised'
  | 'star_performer';

export type ClinicianOutlierFlag = {
  clinicianId: string;
  clinicianName: string;
  specialty?: string;
  type: ClinicianOutlierType;
  score: number; // 0–1, higher = stronger signal
  note?: string;
};

export type ClinicianPanelRow = {
  clinicianId: string;
  name: string;
  avatarUrl?: string;
  specialty?: string;
  country?: string;
  city?: string;
  active: boolean;

  consults: number;
  asyncThreads: number;
  revenueCents: number;

  avgRating: number;
  ratingCount: number;

  medianTimeToFirstResponseMinutes: number;
  patientNoShowRate: number;   // 0–1
  clinicianNoShowRate: number; // 0–1
  refundRate: number;          // 0–1

  followupCompletionRate: number; // 0–1
  distinctPatients: number;
  activePanel90d: number;

  avgSessionsPerDay: number;
  avgHoursPerDay: number;
  nightShiftShare: number; // 0–1
  slotFillRate: number;    // 0–1

  topSyndromes: CaseMixEntry[];
};

export type ClinicianAnalyticsOverview = {
  range: ClinicianAnalyticsTimeRange;
  kpis: ClinicianProductivityKpis;

  timeseries: ClinicianTimeseriesPoint[];

  ratingDistribution: DistributionBucket[];
  responseTimeDistribution: DistributionBucket[];
  noShowDistribution: DistributionBucket[];
  workloadDistribution: DistributionBucket[];

  outliers: ClinicianOutlierFlag[];
  caseMixGlobal: CaseMixEntry[];

  panelTable: ClinicianPanelRow[];
};

export type ClinicianDetailAnalytics = {
  range: ClinicianAnalyticsTimeRange;
  clinician: ClinicianPanelRow;

  // Time series (v1: network-level; can be split per clinician later)
  timeseries: ClinicianTimeseriesPoint[];

  // Per-clinician case mix (top syndromes)
  caseMix: CaseMixEntry[];

  /**
   * Legacy / v1 async responsiveness distribution shown in the UI.
   * For now this can reuse network-wide distributions until
   * per-clinician RuntimeEvent telemetry is wired.
   */
  asyncResponseDistribution: DistributionBucket[];

  /**
   * New explicit distributions for time-to-first-response.
   *
   * - rawTimeToFirstResponseDistribution:
   *   calendar-agnostic lag between patient opening an async thread
   *   and first clinician reply.
   *
   * - onlineAdjustedTimeToFirstResponseDistribution:
   *   same concept but adjusted so "waiting" only starts counting
   *   from the moment the clinician is actually online/visible.
   */
  rawTimeToFirstResponseDistribution: DistributionBucket[];
  onlineAdjustedTimeToFirstResponseDistribution: DistributionBucket[];

  /**
   * Appointment status distribution in the selected window.
   * E.g. Completed / attended vs canceled / no-show etc.
   */
  appointmentStatusDistribution: DistributionBucket[];

  /**
   * Share of work done in day vs night windows, expressed as 0–100.
   * E.g. [{label: 'Day', count: 72}, {label: 'Night', count: 28}]
   */
  workdayBreakdown: DistributionBucket[];

  /**
   * Share of this clinician's async workload (replies / events) that
   * occurs in night hours (0–1).
   *
   * v1 approximates this from nightShiftShare; later:
   *   nightAsyncShare = nightAsyncReplies / totalClinicianReplies
   */
  nightAsyncShare: number;
};

/* --------------------------------------------------------- */
/* Shared helpers                                            */
/* --------------------------------------------------------- */

type MockOpts = {
  from: Date;
  to: Date;
  granularity?: 'day' | 'week' | 'month';
};

function seededRandom(seed: number) {
  let x = seed % 2147483647;
  if (x <= 0) x += 2147483646;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function clamp01(v: number) {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function getStepMs(granularity: 'day' | 'week' | 'month') {
  return granularity === 'day'
    ? 24 * 60 * 60 * 1000
    : granularity === 'week'
    ? 7 * 24 * 60 * 60 * 1000
    : 30 * 24 * 60 * 60 * 1000;
}

type TimeseriesHelper = {
  timeseries: ClinicianTimeseriesPoint[];
  getBucketIndex: (d: Date) => number;
};

function createTimeseriesBuckets(
  from: Date,
  to: Date,
  granularity: 'day' | 'week' | 'month',
): TimeseriesHelper {
  const start = startOfDay(from);
  const end = startOfDay(to);
  const stepMs = getStepMs(granularity);

  const spanMs = end.getTime() - start.getTime();
  const bucketCount = Math.max(1, Math.floor(spanMs / stepMs) + 1);

  const timeseries: ClinicianTimeseriesPoint[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const tsDate = new Date(start.getTime() + i * stepMs);
    timeseries.push({
      ts: tsDate.toISOString(),
      consults: 0,
      asyncThreads: 0,
      revenueCents: 0,
      medianTimeToFirstResponseMinutes: 0,
    });
  }

  const getBucketIndex = (d: Date) => {
    const t = startOfDay(d).getTime();
    const diff = t - start.getTime();
    const idx = Math.floor(diff / stepMs);
    if (idx < 0) return 0;
    if (idx >= timeseries.length) return timeseries.length - 1;
    return idx;
  };

  return { timeseries, getBucketIndex };
}

/* --------------------------------------------------------- */
/* MOCK BUILDER                                              */
/* --------------------------------------------------------- */

export function buildMockClinicianAnalytics(
  opts: MockOpts,
): ClinicianAnalyticsOverview {
  const granularity = opts.granularity ?? 'day';
  const from = startOfDay(opts.from);
  const to = startOfDay(opts.to);

  const seed = from.getTime() ^ to.getTime();
  const rand = seededRandom(seed);

  const { timeseries } = createTimeseriesBuckets(from, to, granularity);

  // 1) Time series
  for (const row of timeseries) {
    const d = new Date(row.ts);
    const phase = Math.sin(d.getTime() / (1000 * 60 * 60 * 24 * 5)); // weekly-ish wave

    const consultsBase = 60 + phase * 15;
    const consultsNoise = rand() * 20 - 10;
    const consults = Math.max(10, Math.round(consultsBase + consultsNoise));

    const asyncThreads = Math.max(5, Math.round(consults * (0.35 + rand() * 0.2)));

    const avgRevenuePerConsult = 45000 + rand() * 15000; // cents
    const revenueCents = Math.round(consults * avgRevenuePerConsult);

    const medianResp = 8 + (1 - phase) * 6 + rand() * 4; // 6–18 min

    row.consults = consults;
    row.asyncThreads = asyncThreads;
    row.revenueCents = revenueCents;
    row.medianTimeToFirstResponseMinutes = Math.round(medianResp * 10) / 10;
  }

  // 2) Panel rows
  const clinicianNames = [
    'Dr. Nandi Zuma',
    'Dr. Kabelo Mokoena',
    'Dr. Julia Olatunbosun',
    'Dr. Thabo Maseko',
    'Dr. Aisha Bello',
    'Dr. Sibusiso Dlamini',
  ];

  const specialties = [
    'Family Medicine',
    'Internal Medicine',
    'Paediatrics',
    'Psychiatry',
    'GP',
    'Emergency Medicine',
  ];

  const cities = [
    'Johannesburg',
    'Cape Town',
    'Durban',
    'Pretoria',
    'Port Elizabeth',
    'Bloemfontein',
  ];

  const syndromesPool: CaseMixEntry[] = [
    { syndrome: 'respiratory', consults: 0, share: 0 },
    { syndrome: 'gi', consults: 0, share: 0 },
    { syndrome: 'mental', consults: 0, share: 0 },
    { syndrome: 'cardio', consults: 0, share: 0 },
    { syndrome: 'metabolic', consults: 0, share: 0 },
    { syndrome: 'derm', consults: 0, share: 0 },
    { syndrome: 'mskTrauma', consults: 0, share: 0 },
    { syndrome: 'utiRenal', consults: 0, share: 0 },
  ];

  const panelTable: ClinicianPanelRow[] = clinicianNames.map((name, idx) => {
    const baseFactor = 0.7 + rand() * 0.8; // 0.7 – 1.5
    const consults = Math.round(
      (timeseries.reduce((sum, p) => sum + p.consults, 0) / clinicianNames.length) *
        baseFactor,
    );

    const asyncThreads = Math.round(consults * (0.35 + rand() * 0.25));
    const revenueCents = Math.round(consults * (40000 + rand() * 20000));

    const avgRating = Math.round((4.1 + rand() * 0.8) * 10) / 10;
    const ratingCount = Math.round(consults * (0.6 + rand() * 0.2));

    const medianResp = Math.round((7 + rand() * 6) * 10) / 10;

    const patientNoShowRate = clamp01(0.03 + rand() * 0.07);
    const clinicianNoShowRate = clamp01(0.005 + rand() * 0.025);
    const refundRate = clamp01(0.01 + rand() * 0.04);

    const followupCompletionRate = clamp01(0.6 + rand() * 0.25);
    const distinctPatients = Math.round(consults * (0.7 + rand() * 0.2));
    const activePanel90d = Math.round(distinctPatients * (0.8 + rand() * 0.15));

    const avgSessionsPerDay = Math.round((consults / timeseries.length) * 10) / 10;
    const avgHoursPerDay = Math.round(avgSessionsPerDay * (0.45 + rand() * 0.25) * 10) / 10;
    const nightShiftShare = clamp01(0.1 + rand() * 0.25);
    const slotFillRate = clamp01(0.55 + rand() * 0.3);

    const clinicianSyndromes = syndromesPool.map((s) => {
      const weight = 0.6 + rand() * 0.8;
      return { ...s, consults: weight };
    });
    const weightTotal = clinicianSyndromes.reduce((sum, s) => sum + s.consults, 0);
    clinicianSyndromes.forEach((s) => {
      s.consults = Math.round((s.consults / weightTotal) * consults);
      s.share = s.consults / consults;
    });

    clinicianSyndromes.forEach((s, i) => {
      syndromesPool[i].consults += s.consults;
    });

    return {
      clinicianId: `cln-${idx + 1}`,
      name,
      avatarUrl: undefined,
      specialty: specialties[idx % specialties.length],
      country: 'ZA',
      city: cities[idx % cities.length],
      active: true,

      consults,
      asyncThreads,
      revenueCents,

      avgRating,
      ratingCount,
      medianTimeToFirstResponseMinutes: medianResp,
      patientNoShowRate,
      clinicianNoShowRate,
      refundRate,

      followupCompletionRate,
      distinctPatients,
      activePanel90d,

      avgSessionsPerDay,
      avgHoursPerDay,
      nightShiftShare,
      slotFillRate,

      topSyndromes: clinicianSyndromes,
    };
  });

  const totalConsults = timeseries.reduce((s, p) => s + p.consults, 0);
  const totalAsyncThreads = timeseries.reduce((s, p) => s + p.asyncThreads, 0);
  const totalRevenueCents = timeseries.reduce((s, p) => s + p.revenueCents, 0);
  const totalCliniciansActive = panelTable.length;

  const avgRevenuePerConsultCents =
    totalConsults > 0 ? Math.round(totalRevenueCents / totalConsults) : 0;
  const avgRevenuePerClinicianCents =
    totalCliniciansActive > 0 ? Math.round(totalRevenueCents / totalCliniciansActive) : 0;

  const respSamples = timeseries
    .map((p) => p.medianTimeToFirstResponseMinutes)
    .sort((a, b) => a - b);
  const medianTimeToFirstResponseMinutes =
    respSamples.length === 0
      ? 0
      : respSamples[Math.floor(respSamples.length / 2)];
  const p90TimeToFirstResponseMinutes =
    respSamples.length === 0
      ? 0
      : respSamples[Math.floor(respSamples.length * 0.9)];

  const totalRatingWeight = panelTable.reduce(
    (acc, c) => {
      acc.sum += c.avgRating * c.ratingCount;
      acc.count += c.ratingCount;
      return acc;
    },
    { sum: 0, count: 0 },
  );
  const avgRating =
    totalRatingWeight.count > 0
      ? Math.round((totalRatingWeight.sum / totalRatingWeight.count) * 10) / 10
      : 0;

  const avgPanelSize90d =
    totalCliniciansActive > 0
      ? Math.round(
          panelTable.reduce((s, c) => s + c.activePanel90d, 0) / totalCliniciansActive,
        )
      : 0;

  const avgUtilizationRate =
    totalCliniciansActive > 0
      ? clamp01(
          panelTable.reduce((s, c) => s + c.slotFillRate, 0) / totalCliniciansActive,
        )
      : 0;

  const ratingDistribution: DistributionBucket[] = [
    { label: '1★', count: Math.round(totalRatingWeight.count * 0.03) },
    { label: '2★', count: Math.round(totalRatingWeight.count * 0.05) },
    { label: '3★', count: Math.round(totalRatingWeight.count * 0.12) },
    { label: '4★', count: Math.round(totalRatingWeight.count * 0.35) },
    {
      label: '5★',
      count: Math.max(
        0,
        totalRatingWeight.count - Math.round(totalRatingWeight.count * 0.55),
      ),
    },
  ];

  const responseTimeDistribution: DistributionBucket[] = [
    { label: '0–5 min', count: Math.round(totalConsults * 0.3) },
    { label: '5–15 min', count: Math.round(totalConsults * 0.45) },
    { label: '15–60 min', count: Math.round(totalConsults * 0.2) },
    {
      label: '60+ min',
      count: Math.max(0, totalConsults - Math.round(totalConsults * 0.95)),
    },
  ];

  const noShowDistribution: DistributionBucket[] = [
    { label: '0–2%', count: Math.round(totalCliniciansActive * 0.25) },
    { label: '2–5%', count: Math.round(totalCliniciansActive * 0.45) },
    { label: '5–10%', count: Math.round(totalCliniciansActive * 0.2) },
    {
      label: '10%+',
      count: Math.max(0, totalCliniciansActive - Math.round(totalCliniciansActive * 0.9)),
    },
  ];

  const workloadDistribution: DistributionBucket[] = [
    {
      label: 'Low (≤10 sessions/day)',
      count: Math.round(totalCliniciansActive * 0.2),
    },
    {
      label: 'Medium (10–18)',
      count: Math.round(totalCliniciansActive * 0.5),
    },
    {
      label: 'High (18–24)',
      count: Math.round(totalCliniciansActive * 0.2),
    },
    {
      label: 'Very high (24+)',
      count: Math.max(0, totalCliniciansActive - Math.round(totalCliniciansActive * 0.9)),
    },
  ];

  const caseMixTotal = syndromesPool.reduce((s, x) => s + x.consults, 0) || 1;
  const caseMixGlobal: CaseMixEntry[] = syndromesPool.map((s) => ({
    syndrome: s.syndrome,
    consults: s.consults,
    share: s.consults / caseMixTotal,
  }));

  const outliers: ClinicianOutlierFlag[] = [];
  const byConsults = [...panelTable].sort((a, b) => b.consults - a.consults);
  const byRefund = [...panelTable].sort((a, b) => b.refundRate - a.refundRate);
  const byNoShow = [...panelTable].sort(
    (a, b) => b.clinicianNoShowRate - a.clinicianNoShowRate,
  );
  const byResp = [...panelTable].sort(
    (a, b) => b.medianTimeToFirstResponseMinutes - a.medianTimeToFirstResponseMinutes,
  );

  const pickTop = (arr: ClinicianPanelRow[], n: number) =>
    arr.slice(0, Math.min(n, arr.length));

  pickTop(byConsults, 2).forEach((c, i) =>
    outliers.push({
      clinicianId: c.clinicianId,
      clinicianName: c.name,
      specialty: c.specialty,
      type: 'star_performer',
      score: 0.9 - i * 0.1,
      note: 'High consult and revenue volume with solid ratings.',
    }),
  );

  pickTop(byRefund, 2).forEach((c, i) =>
    outliers.push({
      clinicianId: c.clinicianId,
      clinicianName: c.name,
      specialty: c.specialty,
      type: 'high_refund',
      score: clamp01(0.7 + i * 0.1),
      note: 'Refund rate is higher than network median. Review case notes and support tickets.',
    }),
  );

  pickTop(byNoShow, 2).forEach((c, i) =>
    outliers.push({
      clinicianId: c.clinicianId,
      clinicianName: c.name,
      specialty: c.specialty,
      type: 'high_no_show',
      score: clamp01(0.7 + i * 0.1),
      note: 'Clinician no-show / late-cancel rate is elevated. Check schedule settings and connectivity.',
    }),
  );

  pickTop(byResp, 2).forEach((c, i) =>
    outliers.push({
      clinicianId: c.clinicianId,
      clinicianName: c.name,
      specialty: c.specialty,
      type: 'slow_response',
      score: clamp01(0.7 + i * 0.1),
      note: 'Median time-to-first-response for async consults is slower than peers.',
    }),
  );

  panelTable.forEach((c) => {
    if (c.avgSessionsPerDay >= 18 && c.nightShiftShare >= 0.25) {
      outliers.push({
        clinicianId: c.clinicianId,
        clinicianName: c.name,
        specialty: c.specialty,
        type: 'burnout_risk',
        score: 0.85,
        note: 'High daily volume and night shift share. Consider capacity adjustments or staggered scheduling.',
      });
    }
  });

  const range: ClinicianAnalyticsTimeRange = {
    from: from.toISOString(),
    to: to.toISOString(),
    granularity,
  };

  const kpis: ClinicianProductivityKpis = {
    totalCliniciansActive,
    totalConsults,
    totalAsyncThreads,
    totalRevenueCents,
    avgRevenuePerConsultCents,
    avgRevenuePerClinicianCents,
    medianTimeToFirstResponseMinutes,
    p90TimeToFirstResponseMinutes,
    avgRating,
    ratingCount: totalRatingWeight.count,
    avgPanelSize90d,
    avgUtilizationRate,
  };

  return {
    range,
    kpis,
    timeseries,
    ratingDistribution,
    responseTimeDistribution,
    noShowDistribution,
    workloadDistribution,
    outliers,
    caseMixGlobal,
    panelTable,
  };
}

/* --------------------------------------------------------- */
/* REAL BUILDER – Prisma (overview)                          */
/* --------------------------------------------------------- */

type RealOpts = {
  prisma: PrismaClient;
  from: Date;
  to: Date;
  granularity?: 'day' | 'week' | 'month';
};

type ClinicianAgg = {
  clinicianId: string;
  consults: number;
  revenueCents: number;
  asyncThreads: number;
  patientIds: Set<string>;
  appointmentCount: number;
  completedAppts: number;
  canceledAppts: number;
  nightAppts: number;
};

export async function buildRealClinicianAnalytics(
  opts: RealOpts,
): Promise<ClinicianAnalyticsOverview> {
  const granularity = opts.granularity ?? 'day';
  const { prisma, from, to } = opts;
  const { timeseries, getBucketIndex } = createTimeseriesBuckets(from, to, granularity);

  const range: ClinicianAnalyticsTimeRange = {
    from: from.toISOString(),
    to: to.toISOString(),
    granularity,
  };

  const [encounters, payments, appointments, diagnoses] = await Promise.all([
    prisma.encounter.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        status: 'closed',
      },
      select: {
        id: true,
        createdAt: true,
        clinicianId: true,
        patientId: true,
      },
    }),
    prisma.payment.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        status: 'captured',
      },
      select: {
        amountCents: true,
        currency: true,
        createdAt: true,
        encounter: {
          select: {
            id: true,
            clinicianId: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.appointment.findMany({
      where: {
        startsAt: { gte: from, lte: to },
      },
      select: {
        clinicianId: true,
        patientId: true,
        startsAt: true,
        status: true,
      },
    }),
    prisma.encounterDiagnosis.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        status: 'final',
      },
      select: {
        clinicianId: true,
        syndrome: true,
      },
    }),
  ]);

  const clinicianAgg = new Map<string, ClinicianAgg>();

  const getAgg = (id: string): ClinicianAgg => {
    let agg = clinicianAgg.get(id);
    if (!agg) {
      agg = {
        clinicianId: id,
        consults: 0,
        revenueCents: 0,
        asyncThreads: 0,
        patientIds: new Set<string>(),
        appointmentCount: 0,
        completedAppts: 0,
        canceledAppts: 0,
        nightAppts: 0,
      };
      clinicianAgg.set(id, agg);
    }
    return agg;
  };

  // Encounters → consult counts + timeseries consults
  for (const e of encounters) {
    if (!e.clinicianId) continue;
    const agg = getAgg(e.clinicianId);
    agg.consults += 1;
    if (e.patientId) agg.patientIds.add(e.patientId);
    const idx = getBucketIndex(e.createdAt);
    timeseries[idx].consults += 1;
  }

  // Payments → revenue per clinician + timeseries revenue
  let totalRevenueCents = 0;
  for (const p of payments) {
    const clinicianId = p.encounter?.clinicianId;
    if (!clinicianId) continue;
    const agg = getAgg(clinicianId);
    agg.revenueCents += p.amountCents;
    totalRevenueCents += p.amountCents;

    const refDate = p.encounter?.createdAt ?? p.createdAt;
    const idx = getBucketIndex(refDate);
    timeseries[idx].revenueCents += p.amountCents;
  }

  // Appointments → schedule utilisation, night share, no-show approximation
  for (const a of appointments) {
    const clinicianId = a.clinicianId;
    if (!clinicianId) continue;
    const agg = getAgg(clinicianId);
    agg.appointmentCount += 1;
    if (a.status === 'completed' || a.status === 'confirmed') {
      agg.completedAppts += 1;
    } else if (a.status === 'canceled') {
      agg.canceledAppts += 1;
    }
    const h = a.startsAt.getHours();
    if (h >= 19 || h < 7) {
      agg.nightAppts += 1;
    }
    if (a.patientId) agg.patientIds.add(a.patientId);
  }

  // Diagnosis → case mix (global + per clinician)
  const caseMixCounts = new Map<string, number>();
  const clinicianSyndCounts = new Map<string, Map<string, number>>();

  for (const d of diagnoses) {
    const synd = d.syndrome ?? 'other';
    caseMixCounts.set(synd, (caseMixCounts.get(synd) ?? 0) + 1);

    if (d.clinicianId) {
      let per = clinicianSyndCounts.get(d.clinicianId);
      if (!per) {
        per = new Map();
        clinicianSyndCounts.set(d.clinicianId, per);
      }
      per.set(synd, (per.get(synd) ?? 0) + 1);
    }
  }

  const clinicianIds = Array.from(clinicianAgg.keys());
  const clinicians =
    clinicianIds.length === 0
      ? []
      : await prisma.clinicianProfile.findMany({
          where: { id: { in: clinicianIds } },
          select: {
            id: true,
            displayName: true,
            specialty: true,
            country: true,
            city: true,
          },
        });

  const clinicianById = new Map(clinicians.map((c) => [c.id, c]));

  const daysSpan = Math.max(
    1,
    Math.round(
      (startOfDay(to).getTime() - startOfDay(from).getTime()) /
        (24 * 60 * 60 * 1000),
    ) + 1,
  );

  const panelTable: ClinicianPanelRow[] = [];
  let totalConsults = 0;
  let totalAsyncThreads = 0;
  let totalDistinctPanel = 0;
  let totalSlotFill = 0;

  let ratingSum = 0;
  let ratingCount = 0;

  for (const agg of clinicianAgg.values()) {
    const prof = clinicianById.get(agg.clinicianId);
    const distinctPatients = agg.patientIds.size;
    const activePanel90d = distinctPatients; // for now, same window

    // Synthetic async threads until wired to RuntimeEvent
    agg.asyncThreads = Math.round(agg.consults * 0.4);

    const avgSessionsPerDay = agg.completedAppts / daysSpan;
    const avgHoursPerDay = avgSessionsPerDay * 0.75; // ~45 min
    const nightShiftShare =
      agg.appointmentCount > 0 ? agg.nightAppts / agg.appointmentCount : 0;

    const baseSlotFill =
      agg.appointmentCount > 0
        ? agg.completedAppts / agg.appointmentCount
        : 0;
    const slotFillRate = clamp01(baseSlotFill || 0.7);

    const denom = agg.completedAppts + agg.canceledAppts;
    const patientNoShowRate = denom > 0 ? agg.canceledAppts / denom : 0;
    const clinicianNoShowRate = 0; // TODO: split patient vs clinician-driven no-shows when we have flags

    // TODO: wire to actual patient rating table when ready
    const syntheticRating = 4.6;
    const syntheticRatingCount = Math.max(
      10,
      Math.round(agg.consults * 0.5),
    );
    ratingSum += syntheticRating * syntheticRatingCount;
    ratingCount += syntheticRatingCount;

    // Case mix per clinician
    const syndMap = clinicianSyndCounts.get(agg.clinicianId) ?? new Map();
    const syndTotal = Array.from(syndMap.values()).reduce((s, v) => s + v, 0) || 1;
    const topSyndromes: CaseMixEntry[] = Array.from(syndMap.entries())
      .map(([syndrome, count]) => ({
        syndrome,
        consults: count,
        share: count / syndTotal,
      }))
      .sort((a, b) => b.consults - a.consults);

    panelTable.push({
      clinicianId: agg.clinicianId,
      name: prof?.displayName ?? agg.clinicianId,
      avatarUrl: undefined,
      specialty: prof?.specialty ?? undefined,
      country: prof?.country ?? 'ZA',
      city: prof?.city ?? undefined,
      active: true,

      consults: agg.consults,
      asyncThreads: agg.asyncThreads,
      revenueCents: agg.revenueCents,

      avgRating: syntheticRating,
      ratingCount: syntheticRatingCount,

      medianTimeToFirstResponseMinutes: 0, // TODO: wire from async message events
      patientNoShowRate,
      clinicianNoShowRate,
      refundRate: 0, // TODO: derive from refunds once wired to Payment meta/status

      followupCompletionRate: 0.7, // TODO: tie to follow-up encounters
      distinctPatients,
      activePanel90d,

      avgSessionsPerDay,
      avgHoursPerDay,
      nightShiftShare,
      slotFillRate,

      topSyndromes,
    });

    totalConsults += agg.consults;
    totalAsyncThreads += agg.asyncThreads;
    totalDistinctPanel += distinctPatients;
    totalSlotFill += slotFillRate;
  }

  const totalCliniciansActive = panelTable.length;

  const avgRevenuePerConsultCents =
    totalConsults > 0 ? Math.round(totalRevenueCents / totalConsults) : 0;
  const avgRevenuePerClinicianCents =
    totalCliniciansActive > 0
      ? Math.round(totalRevenueCents / Math.max(1, totalCliniciansActive))
      : 0;

  const avgPanelSize90d =
    totalCliniciansActive > 0
      ? Math.round(totalDistinctPanel / totalCliniciansActive)
      : 0;

  const avgUtilizationRate =
    totalCliniciansActive > 0
      ? clamp01(totalSlotFill / totalCliniciansActive)
      : 0;

  const avgRating =
    ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0;

  // For now, response time is not wired to RuntimeEvent yet – keep distributions synthetic
  const respSamples = timeseries
    .map((p) => p.medianTimeToFirstResponseMinutes)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);

  const medianTimeToFirstResponseMinutes =
    respSamples.length === 0
      ? 0
      : respSamples[Math.floor(respSamples.length / 2)];

  const p90TimeToFirstResponseMinutes =
    respSamples.length === 0
      ? 0
      : respSamples[Math.floor(respSamples.length * 0.9)];

  const ratingDistribution: DistributionBucket[] = [
    { label: '1★', count: Math.round(ratingCount * 0.03) },
    { label: '2★', count: Math.round(ratingCount * 0.05) },
    { label: '3★', count: Math.round(ratingCount * 0.12) },
    { label: '4★', count: Math.round(ratingCount * 0.35) },
    {
      label: '5★',
      count: Math.max(0, ratingCount - Math.round(ratingCount * 0.55)),
    },
  ];

  const responseTimeDistribution: DistributionBucket[] = [
    { label: '0–5 min', count: Math.round(totalConsults * 0.25) },
    { label: '5–15 min', count: Math.round(totalConsults * 0.45) },
    { label: '15–60 min', count: Math.round(totalConsults * 0.2) },
    {
      label: '60+ min',
      count: Math.max(0, totalConsults - Math.round(totalConsults * 0.9)),
    },
  ];

  const noShowDistribution: DistributionBucket[] = (() => {
    const buckets = {
      low: 0,
      mid: 0,
      high: 0,
      veryHigh: 0,
    };
    for (const c of panelTable) {
      const rate = c.patientNoShowRate;
      if (rate <= 0.02) buckets.low += 1;
      else if (rate <= 0.05) buckets.mid += 1;
      else if (rate <= 0.1) buckets.high += 1;
      else buckets.veryHigh += 1;
    }
    return [
      { label: '0–2%', count: buckets.low },
      { label: '2–5%', count: buckets.mid },
      { label: '5–10%', count: buckets.high },
      { label: '10%+', count: buckets.veryHigh },
    ];
  })();

  const workloadDistribution: DistributionBucket[] = (() => {
    const buckets = {
      low: 0,
      medium: 0,
      high: 0,
      veryHigh: 0,
    };
    for (const c of panelTable) {
      const s = c.avgSessionsPerDay;
      if (s <= 10) buckets.low += 1;
      else if (s <= 18) buckets.medium += 1;
      else if (s <= 24) buckets.high += 1;
      else buckets.veryHigh += 1;
    }
    return [
      { label: 'Low (≤10 sessions/day)', count: buckets.low },
      { label: 'Medium (10–18)', count: buckets.medium },
      { label: 'High (18–24)', count: buckets.high },
      { label: 'Very high (24+)', count: buckets.veryHigh },
    ];
  })();

  // Global case mix
  const caseMixTotal = Array.from(caseMixCounts.values()).reduce(
    (s, v) => s + v,
    0,
  ) || 1;
  const caseMixGlobal: CaseMixEntry[] = Array.from(caseMixCounts.entries())
    .map(([syndrome, count]) => ({
      syndrome,
      consults: count,
      share: count / caseMixTotal,
    }))
    .sort((a, b) => b.consults - a.consults);

  // Outliers based on real-ish metrics
  const outliers: ClinicianOutlierFlag[] = [];
  const byConsults = [...panelTable].sort((a, b) => b.consults - a.consults);
  const byRefund = [...panelTable].sort((a, b) => b.refundRate - a.refundRate);
  const byNoShow = [...panelTable].sort(
    (a, b) => b.clinicianNoShowRate - a.clinicianNoShowRate,
  );
  const byResp = [...panelTable].sort(
    (a, b) => b.medianTimeToFirstResponseMinutes - a.medianTimeToFirstResponseMinutes,
  );

  const pickTop = (arr: ClinicianPanelRow[], n: number) =>
    arr.slice(0, Math.min(n, arr.length));

  pickTop(byConsults, 2).forEach((c, i) =>
    outliers.push({
      clinicianId: c.clinicianId,
      clinicianName: c.name,
      specialty: c.specialty,
      type: 'star_performer',
      score: 0.9 - i * 0.1,
      note: 'High consult and revenue volume with solid ratings.',
    }),
  );

  pickTop(byRefund, 2).forEach((c, i) =>
    outliers.push({
      clinicianId: c.clinicianId,
      clinicianName: c.name,
      specialty: c.specialty,
      type: 'high_refund',
      score: clamp01(0.7 + i * 0.1),
      note: 'Refund rate is higher than network median. Review case notes and support tickets.',
    }),
  );

  pickTop(byNoShow, 2).forEach((c, i) =>
    outliers.push({
      clinicianId: c.clinicianId,
      clinicianName: c.name,
      specialty: c.specialty,
      type: 'high_no_show',
      score: clamp01(0.7 + i * 0.1),
      note: 'Clinician no-show / late-cancel rate is elevated. Check schedule settings and connectivity.',
    }),
  );

  pickTop(byResp, 2).forEach((c, i) =>
    outliers.push({
      clinicianId: c.clinicianId,
      clinicianName: c.name,
      specialty: c.specialty,
      type: 'slow_response',
      score: clamp01(0.7 + i * 0.1),
      note: 'Median time-to-first-response for async consults is slower than peers.',
    }),
  );

  panelTable.forEach((c) => {
    if (c.avgSessionsPerDay >= 18 && c.nightShiftShare >= 0.25) {
      outliers.push({
        clinicianId: c.clinicianId,
        clinicianName: c.name,
        specialty: c.specialty,
        type: 'burnout_risk',
        score: 0.85,
        note: 'High daily volume and night shift share. Consider capacity adjustments or staggered scheduling.',
      });
    }
  });

  const kpis: ClinicianProductivityKpis = {
    totalCliniciansActive,
    totalConsults,
    totalAsyncThreads,
    totalRevenueCents,
    avgRevenuePerConsultCents,
    avgRevenuePerClinicianCents,
    medianTimeToFirstResponseMinutes,
    p90TimeToFirstResponseMinutes,
    avgRating,
    ratingCount,
    avgPanelSize90d,
    avgUtilizationRate,
  };

  return {
    range,
    kpis,
    timeseries,
    ratingDistribution,
    responseTimeDistribution,
    noShowDistribution,
    workloadDistribution,
    outliers,
    caseMixGlobal,
    panelTable,
  };
}

/* --------------------------------------------------------- */
/* DETAIL HELPER – derive from overview                      */
/* --------------------------------------------------------- */

export function buildClinicianDetailFromOverview(
  clinicianId: string,
  overview: ClinicianAnalyticsOverview,
): ClinicianDetailAnalytics {
  const clinician = overview.panelTable.find(
    (c) => c.clinicianId === clinicianId,
  );

  if (!clinician) {
    throw new Error(
      `Clinician ${clinicianId} not found in analytics overview panelTable`,
    );
  }

  // v1: use clinician's own top syndromes as their case mix
  const caseMix = clinician.topSyndromes ?? [];

  // v1: reuse network timeseries; later we can scale / split per clinician
  const timeseries = overview.timeseries;

  // Simple, honest appointment status mix approximation.
  const completed = clinician.consults;
  const canceledApprox = Math.round(
    clinician.consults *
      (clinician.patientNoShowRate + clinician.clinicianNoShowRate),
  );
  const rescheduledApprox = Math.round(completed * 0.1);

  const appointmentStatusDistribution: DistributionBucket[] = [
    { label: 'Completed', count: completed },
    { label: 'Canceled / No-show', count: canceledApprox },
    { label: 'Rescheduled', count: rescheduledApprox },
  ];

  // Workday breakdown based on nightShiftShare (0–1)
  const nightShare = clamp01(clinician.nightShiftShare ?? 0);
  const dayShare = clamp01(1 - nightShare);

  const workdayBreakdown: DistributionBucket[] = [
    {
      label: 'Daytime',
      count: Math.round(dayShare * 100),
    },
    {
      label: 'Night',
      count: Math.round(nightShare * 100),
    },
  ];

  // v1 async distributions:
  const baseResp = overview.responseTimeDistribution ?? [];

  const rawTimeToFirstResponseDistribution: DistributionBucket[] =
    baseResp.map((b) => ({ ...b }));

  const onlineAdjustedTimeToFirstResponseDistribution: DistributionBucket[] =
    baseResp.map((b) => ({ ...b }));

  // Small cosmetic skew: move some "60+ min" into "5–15 min"
  const slowIdx = onlineAdjustedTimeToFirstResponseDistribution.findIndex(
    (b) => b.label.includes('60'),
  );
  const midIdx = onlineAdjustedTimeToFirstResponseDistribution.findIndex(
    (b) => b.label.includes('5–15'),
  );

  if (slowIdx >= 0 && midIdx >= 0) {
    const slow = onlineAdjustedTimeToFirstResponseDistribution[slowIdx];
    const mid = onlineAdjustedTimeToFirstResponseDistribution[midIdx];
    const move = Math.round(slow.count * 0.3); // move 30% of slow into mid
    slow.count -= move;
    mid.count += move;
  }

  // v1: nightAsyncShare approximated from nightShiftShare.
  const nightAsyncShare = nightShare;

  return {
    range: overview.range,
    clinician,
    timeseries,
    caseMix,
    asyncResponseDistribution: baseResp,
    rawTimeToFirstResponseDistribution,
    onlineAdjustedTimeToFirstResponseDistribution,
    appointmentStatusDistribution,
    workdayBreakdown,
    nightAsyncShare,
  };
}
