/* apps/admin-dashboard/app/api/analytics/patient-engagement/route.ts */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';
import {
  PrismaClient,
  PresenceActorType,
  AuditActorType,
  ReminderStatus,
} from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ---------------- Prisma singleton ---------------- */

declare global {
  // eslint-disable-next-line no-var
  var __prismaPatientEngagementAnalytics: PrismaClient | undefined;
}

const prisma =
  globalThis.__prismaPatientEngagementAnalytics ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') {
  globalThis.__prismaPatientEngagementAnalytics = prisma;
}

/* ---------------- Types (align to APIGW mock) ---------------- */

type RangeKey = '30d' | '90d' | '180d' | '365d';

type PlanTier = 'free' | 'premium' | 'enterprise' | 'unknown';
type Gender = 'male' | 'female' | 'other' | 'unknown';
type AgeBand =
  | '0-12'
  | '13-17'
  | '18-24'
  | '25-34'
  | '35-44'
  | '45-54'
  | '55-64'
  | '65+'
  | 'unknown';

interface PatientEngagementSummary {
  totalPatients: number;
  totalVerifiedPatients: number;
  totalPremiumPatients: number;
  totalFreePatients: number;
  activePatients30d: number;
  activePatients90d: number;
  dau7dAvg: number;
  wau4wAvg: number;
  retention30d: number | null;
  retention90d: number | null;
  churnRate90d: number | null;
  avgSessionsPerActive30d: number | null;
  medianSessionsPerActive30d: number | null;
  avgMinutesPerActive30d: number | null;
  activationRate: number | null;
  firstConsultConversionRate: number | null;
  firstOrderConversionRate: number | null;
  avgRevenuePerActive30d: number | null;
  avgRevenuePerPatientLTV: number | null;
  avgMedicationAdherenceScore: number | null;
  highRiskNonAdherentShare: number | null;
}

interface PlanEngagementSnapshot {
  plan: PlanTier;
  label: string;
  activePatients30d: number;
  activePatients90d: number;
  newPatients30d: number;
  churnedPatients90d: number;
  avgSessionsPerActive30d: number | null;
  avgMinutesPerActive30d: number | null;
  avgRevenuePerActive30d: number | null;
  totalRevenue30d: number | null;
  medicationAdherenceScore: number | null;
}

interface ActivationFunnelStage {
  key:
    | 'registered'
    | 'verified'
    | 'first_consult'
    | 'first_order'
    | 'repeat_consult'
    | 'repeat_order';
  label: string;
  count: number;
  conversionFromPrevious: number;
}

interface RetentionCohortRow {
  cohortKey: string;
  cohortLabel: string;
  cohortSize: number;
  d7Retained: number | null;
  d30Retained: number | null;
  d60Retained: number | null;
  d90Retained: number | null;
}

interface FeatureUsageItem {
  key:
    | 'consult_video'
    | 'consult_chat'
    | 'self_checks'
    | 'medication_schedule'
    | 'vitals_dashboard'
    | 'erx_refill'
    | 'lab_results'
    | 'careplan_tasks'
    | 'shop'
    | 'rewards'
    | 'other';
  label: string;
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  avgSessionsPerUser30d: number;
  avgMinutesPerUser30d: number;
  penetrationActive30d: number;
}

interface DeviceUsageItem {
  deviceSlug: string;
  label: string;
  modality: string;
  activeUsers30d: number;
  measurements30d: number;
  avgMeasurementsPerUser30d: number;
  penetrationActive30d: number;
}

interface AdherenceBucket {
  bucketKey: 'high' | 'medium' | 'low' | 'unknown';
  label: string;
  patients: number;
  avgScore: number | null;
}

interface MedicationAdherenceStats {
  buckets: AdherenceBucket[];
  avgScoreOverall: number | null;
  avgScorePremium: number | null;
  avgScoreFree: number | null;
  highRiskLowAdherentShare: number | null;
}

interface SegmentKey {
  ageBand: AgeBand;
  gender: Gender;
  plan: PlanTier;
  regionCode?: string;
}

interface EngagementSegmentMetrics {
  activePatients30d: number;
  sessionsPerActive30d: number;
  minutesPerActive30d: number;
  consultsPerActive30d: number;
  avgDailySteps: number;
  avgDailyCalories: number;
  avgSleepHours: number;
  avgRevenuePerActive30d: number;
  medicationAdherenceScore: number;
}

interface SegmentRow {
  key: SegmentKey;
  metrics: EngagementSegmentMetrics;
}

interface StepsAndCaloriesAggregate {
  segmentKey: SegmentKey;
  avgDailySteps: number;
  avgDailyCalories: number;
  sampleSize: number;
}

interface PatientEngagementPayload {
  summary: PatientEngagementSummary;
  planSnapshots: PlanEngagementSnapshot[];
  funnelStages: ActivationFunnelStage[];
  retentionCohorts: RetentionCohortRow[];
  featureUsage: FeatureUsageItem[];
  deviceUsage: DeviceUsageItem[];
  adherence: MedicationAdherenceStats | null;
  segments: SegmentRow[];
  stepsAndCalories: StepsAndCaloriesAggregate[];
}

interface PatientEngagementApiResponse {
  ok: boolean;
  asAt: string;
  range: RangeKey;
  data: PatientEngagementPayload;
}

/* ---------------- Helpers ---------------- */

function parseRange(v: string | null): RangeKey {
  if (v === '30d' || v === '90d' || v === '180d' || v === '365d') return v;
  return '90d';
}

function rangeDays(key: RangeKey): number {
  if (key === '30d') return 30;
  if (key === '90d') return 90;
  if (key === '180d') return 180;
  return 365;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function safeDiv(n: number, d: number): number | null {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return null;
  return n / d;
}

function clamp01(v: number | null): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return Math.max(0, Math.min(1, v));
}

function normGender(raw: any): Gender {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'male' || s === 'm') return 'male';
  if (s === 'female' || s === 'f') return 'female';
  if (s === 'other' || s === 'nonbinary' || s === 'non-binary') return 'other';
  if (s === 'unknown') return 'unknown';
  return s ? 'other' : 'unknown';
}

function ageBandFromDob(dob: Date | null, now: Date): AgeBand {
  if (!dob) return 'unknown';
  const age = Math.floor((now.getTime() - dob.getTime()) / 86400000 / 365.25);
  if (!Number.isFinite(age) || age < 0 || age > 120) return 'unknown';
  if (age <= 12) return '0-12';
  if (age <= 17) return '13-17';
  if (age <= 24) return '18-24';
  if (age <= 34) return '25-34';
  if (age <= 44) return '35-44';
  if (age <= 54) return '45-54';
  if (age <= 64) return '55-64';
  return '65+';
}

function slugify(s: string): string {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function statusIsCaptured(status: any): boolean {
  const s = String(status ?? '').toLowerCase();
  return (
    s === 'captured' ||
    s === 'paid' ||
    s === 'succeeded' ||
    s === 'success'
  );
}

function apptIsCompleted(status: any): boolean {
  const s = String(status ?? '').toLowerCase();
  return s === 'completed' || s === 'done' || s === 'fulfilled';
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const a = nums.slice().sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

/* ---------------- Core build ---------------- */

async function buildPatientEngagement(rangeKey: RangeKey): Promise<PatientEngagementPayload> {
  const now = new Date();
  const end = now;

  const startRange = addDays(end, -rangeDays(rangeKey));
  const start30 = addDays(end, -30);
  const start90 = addDays(end, -90);
  const start7 = addDays(end, -7);
  const start1 = addDays(end, -1);

  // Patients
  const totalPatients = await prisma.patientProfile.count().catch(() => 0);

  // “Verified” best-effort proxy: has userId + at least one contact/profile signal
  const totalVerifiedPatients = await prisma.patientProfile
    .count({
      where: {
        userId: { not: null },
        OR: [
          { phone: { not: null } },
          { contactEmail: { not: null } },
          { name: { not: null } },
        ],
      },
    })
    .catch(() => 0);

  const newPatients30d = await prisma.patientProfile
    .count({ where: { createdAt: { gte: start30, lt: end } } })
    .catch(() => 0);

  // Presence sessions (30d + 90d + range for retention lookups)
  type SessRow = {
    userId: string;
    _count: { _all: number };
    _max: { lastSeenAt: Date | null };
  };

  const sessRows30: SessRow[] = await prisma.presenceSession
    .groupBy({
      by: ['userId'],
      where: {
        actorType: PresenceActorType.PATIENT,
        lastSeenAt: { gte: start30, lt: end },
      },
      _count: { _all: true },
      _max: { lastSeenAt: true },
    })
    .catch(() => []);

  const sessRows90: SessRow[] = await prisma.presenceSession
    .groupBy({
      by: ['userId'],
      where: {
        actorType: PresenceActorType.PATIENT,
        lastSeenAt: { gte: start90, lt: end },
      },
      _count: { _all: true },
      _max: { lastSeenAt: true },
    })
    .catch(() => []);

  const sessRowsRange: SessRow[] = await prisma.presenceSession
    .groupBy({
      by: ['userId'],
      where: {
        actorType: PresenceActorType.PATIENT,
        lastSeenAt: { gte: startRange, lt: end },
      },
      _count: { _all: true },
      _max: { lastSeenAt: true },
    })
    .catch(() => []);

  const lastSeenByUserId = new Map<string, Date>();
  for (const r of sessRowsRange) {
    if (r?.userId && r?._max?.lastSeenAt) {
      lastSeenByUserId.set(r.userId, new Date(r._max.lastSeenAt));
    }
  }

  const activeUserIds30 = sessRows30.map((r) => r.userId).filter(Boolean);
  const activeUserIds90 = sessRows90.map((r) => r.userId).filter(Boolean);

  // Map active userIds → patientProfile ids (30d / 90d)
  const activeProfiles30 = activeUserIds30.length
    ? await prisma.patientProfile
        .findMany({
          where: { userId: { in: activeUserIds30.slice(0, 60_000) } },
          select: { id: true, userId: true, createdAt: true, gender: true, dob: true },
          take: 120_000,
        })
        .catch(() => [])
    : [];

  const activeProfiles90 = activeUserIds90.length
    ? await prisma.patientProfile
        .findMany({
          where: { userId: { in: activeUserIds90.slice(0, 60_000) } },
          select: { id: true },
          take: 120_000,
        })
        .catch(() => [])
    : [];

  const activePatientIds30 = new Set<string>(activeProfiles30.map((p: any) => String(p.id)));
  const activePatientIds90 = new Set<string>((activeProfiles90 as any[]).map((p) => String(p.id)));

  // Appointments (30d + 90d) for activation/consult metrics
  const appointments30 = await prisma.appointment
    .findMany({
      where: { startsAt: { gte: start30, lt: end } },
      select: { patientId: true, status: true, startsAt: true, endsAt: true },
      take: 200_000,
    })
    .catch(() => []);

  const appointments90 = await prisma.appointment
    .findMany({
      where: { startsAt: { gte: start90, lt: end } },
      select: { patientId: true },
      take: 200_000,
    })
    .catch(() => []);

  const consultCountByPatientId = new Map<string, number>();
  const minutesByPatientId = new Map<string, number>();

  let totalConsultMinutes30 = 0;

  const apptPatients30 = new Set<string>();
  for (const a of appointments30 as any[]) {
    const pid = String(a?.patientId ?? '');
    if (pid) apptPatients30.add(pid);

    if (!apptIsCompleted(a?.status)) continue;

    const s = a?.startsAt ? new Date(a.startsAt).getTime() : NaN;
    const e = a?.endsAt ? new Date(a.endsAt).getTime() : NaN;
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) continue;

    const min = Math.min(24 * 60, (e - s) / 60000);
    totalConsultMinutes30 += min;

    if (pid) {
      minutesByPatientId.set(pid, (minutesByPatientId.get(pid) ?? 0) + min);
      consultCountByPatientId.set(pid, (consultCountByPatientId.get(pid) ?? 0) + 1);
    }
  }

  const apptPatients90 = new Set<string>();
  for (const a of appointments90 as any[]) {
    const pid = String(a?.patientId ?? '');
    if (pid) apptPatients90.add(pid);
  }

  // Active patients include consult-only patients too
  for (const pid of apptPatients30) activePatientIds30.add(pid);
  for (const pid of apptPatients90) activePatientIds90.add(pid);

  const activePatients30d = activePatientIds30.size;
  const activePatients90d = activePatientIds90.size;

  // Sessions (30d)
  let totalSessions30 = 0;
  const sessionCounts30: number[] = [];
  const sessionsCountByUserId30 = new Map<string, number>();

  for (const r of sessRows30) {
    const c = Number(r?._count?._all ?? 0) || 0;
    totalSessions30 += c;
    sessionCounts30.push(c);
    if (r?.userId) sessionsCountByUserId30.set(r.userId, c);
  }

  const avgSessionsPerActive30d = safeDiv(totalSessions30, Math.max(1, activePatients30d));
  const medianSessionsPerActive30d = median(sessionCounts30);
  const avgMinutesPerActive30d = safeDiv(totalConsultMinutes30, Math.max(1, activePatients30d));

  // Payments (30d) revenue proxy
  const payments30 = await prisma.payment
    .findMany({
      where: { createdAt: { gte: start30, lt: end } },
      select: {
        amountCents: true,
        status: true,
        encounter: { select: { patientId: true } },
      },
      take: 200_000,
    })
    .catch(() => []);

  const revenueCentsByPatientId = new Map<string, number>();
  const paymentCountByPatientId = new Map<string, number>();
  let totalCapturedRevenueCents30 = 0;

  for (const p of payments30 as any[]) {
    if (!statusIsCaptured(p?.status)) continue;
    const cents = Number(p?.amountCents ?? 0) || 0;
    const pid = String(p?.encounter?.patientId ?? '');
    totalCapturedRevenueCents30 += cents;
    if (pid) {
      revenueCentsByPatientId.set(pid, (revenueCentsByPatientId.get(pid) ?? 0) + cents);
      paymentCountByPatientId.set(pid, (paymentCountByPatientId.get(pid) ?? 0) + 1);
    }
  }

  const totalCapturedAllTimeCents = await prisma.payment
    .aggregate({ _sum: { amountCents: true } })
    .then((r) => Number((r as any)?._sum?.amountCents ?? 0) || 0)
    .catch(() => 0);

  const avgRevenuePerActive30d = safeDiv(totalCapturedRevenueCents30 / 100, Math.max(1, activePatients30d));
  const avgRevenuePerPatientLTV = safeDiv(totalCapturedAllTimeCents / 100, Math.max(1, totalPatients));

  // DAU/WAU approximations
  const activeUsers7d = await prisma.presenceSession
    .groupBy({
      by: ['userId'],
      where: {
        actorType: PresenceActorType.PATIENT,
        lastSeenAt: { gte: start7, lt: end },
      },
      _count: { _all: true },
    })
    .then((rows: any[]) => rows.map((r) => String(r.userId)).filter(Boolean))
    .catch(() => []);

  const profiles7d = activeUsers7d.length
    ? await prisma.patientProfile
        .findMany({
          where: { userId: { in: activeUsers7d.slice(0, 60_000) } },
          select: { id: true },
          take: 120_000,
        })
        .catch(() => [])
    : [];

  const activePatientIds7d = new Set<string>((profiles7d as any[]).map((p) => String(p.id)));

  const appts7d = await prisma.appointment
    .findMany({
      where: { startsAt: { gte: start7, lt: end } },
      select: { patientId: true },
      take: 200_000,
    })
    .catch(() => []);

  for (const a of appts7d as any[]) {
    const pid = String(a?.patientId ?? '');
    if (pid) activePatientIds7d.add(pid);
  }

  const dau7dAvg = Math.round((activePatientIds7d.size || 0) / 7);
  const wau4wAvg = Math.round((activePatients30d || 0) / 4);

  // Retention (30/90) – cohort is within startRange and observable
  async function retentionFor(days: number): Promise<number | null> {
    const eligibleEnd = addDays(end, -days);
    if (eligibleEnd.getTime() <= startRange.getTime()) return null;

    const cohort = await prisma.patientProfile
      .findMany({
        where: {
          createdAt: { gte: startRange, lt: eligibleEnd },
          userId: { not: null },
        },
        select: { userId: true, createdAt: true },
        take: 200_000,
      })
      .catch(() => []);

    if (!cohort.length) return null;

    let eligible = 0;
    let retained = 0;

    for (const c of cohort as any[]) {
      const uid = String(c?.userId ?? '');
      const createdAt = c?.createdAt ? new Date(c.createdAt) : null;
      if (!uid || !createdAt) continue;

      const target = addDays(createdAt, days).getTime();
      if (target > end.getTime()) continue;

      eligible++;
      const lastSeen = lastSeenByUserId.get(uid);
      if (lastSeen && lastSeen.getTime() >= target) retained++;
    }

    return eligible ? clamp01(retained / eligible) : null;
  }

  const retention30d = await retentionFor(30);
  const retention90d = await retentionFor(90);
  const churnRate90d =
    retention90d == null ? null : clamp01(1 - retention90d);

  // Adherence (30d) (ReminderStatus Taken/Missed)
  const adherence: MedicationAdherenceStats | null = await (async () => {
    const rows = await prisma.reminder
      .groupBy({
        by: ['patientId', 'status'],
        where: {
          patientId: { not: null },
          createdAt: { gte: start30, lt: end },
        },
        _count: { _all: true },
      })
      .catch(() => []);

    if (!rows.length) return null;

    const perPatient = new Map<string, { taken: number; missed: number }>();
    for (const r of rows as any[]) {
      const pid = String(r?.patientId ?? '');
      if (!pid) continue;

      const status = String(r?.status ?? '');
      const c = Number(r?._count?._all ?? 0) || 0;

      const agg = perPatient.get(pid) || { taken: 0, missed: 0 };

      if (status === ReminderStatus.Taken || status.toLowerCase() === 'taken') agg.taken += c;
      else if (status === ReminderStatus.Missed || status.toLowerCase() === 'missed') agg.missed += c;

      perPatient.set(pid, agg);
    }

    const scores: Array<{ pid: string; score: number }> = [];
    for (const [pid, a] of perPatient.entries()) {
      const denom = a.taken + a.missed;
      if (denom <= 0) continue;
      scores.push({ pid, score: a.taken / denom });
    }

    const avgOverall =
      scores.length ? scores.reduce((s, x) => s + x.score, 0) / scores.length : null;

    const bucketDefs: Array<{
      key: AdherenceBucket['bucketKey'];
      label: string;
      test: (s: number) => boolean;
    }> = [
      { key: 'high', label: 'High adherence (80–100%)', test: (s) => s >= 0.8 },
      { key: 'medium', label: 'Medium adherence (50–79%)', test: (s) => s >= 0.5 && s < 0.8 },
      { key: 'low', label: 'Low adherence (< 50%)', test: (s) => s < 0.5 },
    ];

    const buckets: AdherenceBucket[] = bucketDefs.map((b) => {
      const inBucket = scores.filter((x) => b.test(x.score));
      const avg = inBucket.length
        ? inBucket.reduce((s, x) => s + x.score, 0) / inBucket.length
        : null;
      return { bucketKey: b.key, label: b.label, patients: inBucket.length, avgScore: avg };
    });

    // Unknown: activePatients30d minus those with a computed score (best-effort)
    const scored = new Set(scores.map((s) => s.pid));
    const unknownPatients = Math.max(0, activePatients30d - scored.size);
    if (unknownPatients > 0) {
      buckets.push({
        bucketKey: 'unknown',
        label: 'Unknown / insufficient data',
        patients: unknownPatients,
        avgScore: null,
      });
    }

    // High-risk low-adherent share (7d high/moderate RuntimeEvent + score < 50%)
    let highRiskLowAdherentShare: number | null = null;
    try {
      const since7d = BigInt(start7.getTime());
      const ev = await prisma.runtimeEvent.findMany({
        where: {
          ts: { gte: since7d },
          severity: { in: ['moderate', 'high'] as any },
          OR: [{ patientId: { not: null } }, { targetPatientId: { not: null } }],
        },
        select: { patientId: true, targetPatientId: true },
        take: 200_000,
      });

      const highRisk = new Set<string>();
      for (const r of ev as any[]) {
        const pid = String(r?.targetPatientId ?? r?.patientId ?? '');
        if (pid) highRisk.add(pid);
      }

      if (highRisk.size) {
        let low = 0;
        for (const pid of highRisk) {
          const s = scores.find((x) => x.pid === pid)?.score;
          if (s != null && s < 0.5) low++;
        }
        highRiskLowAdherentShare = clamp01(low / highRisk.size);
      }
    } catch {
      highRiskLowAdherentShare = null;
    }

    return {
      buckets,
      avgScoreOverall: avgOverall == null ? null : clamp01(avgOverall),
      avgScorePremium: avgOverall == null ? null : clamp01(avgOverall), // no plan mapping yet
      avgScoreFree: avgOverall == null ? null : clamp01(avgOverall),
      highRiskLowAdherentShare,
    };
  })();

  // Plan snapshots (no plan mapping yet → Unknown bucket)
  const churnedPatients90d = (() => {
    let churned = 0;
    for (const pid of activePatientIds90) {
      if (!activePatientIds30.has(pid)) churned++;
    }
    return churned;
  })();

  const planSnapshots: PlanEngagementSnapshot[] = [
    {
      plan: 'unknown',
      label: 'Unknown',
      activePatients30d,
      activePatients90d,
      newPatients30d,
      churnedPatients90d,
      avgSessionsPerActive30d,
      avgMinutesPerActive30d,
      avgRevenuePerActive30d,
      totalRevenue30d: totalCapturedRevenueCents30 / 100,
      medicationAdherenceScore: adherence?.avgScoreOverall ?? null,
    },
  ];

  // Funnel stages (best-effort)
  const distinctPaidPatients30 = new Set<string>();
  for (const [pid, c] of paymentCountByPatientId.entries()) {
    if (c > 0) distinctPaidPatients30.add(pid);
  }

  const repeatConsultPatients30 = (() => {
    let n = 0;
    for (const [, c] of consultCountByPatientId.entries()) {
      if (c >= 2) n++;
    }
    return n;
  })();

  const repeatOrderPatients30 = (() => {
    let n = 0;
    for (const [, c] of paymentCountByPatientId.entries()) {
      if (c >= 2) n++;
    }
    return n;
  })();

  function conv(curr: number, prev: number): number {
    return prev <= 0 ? 0 : Math.max(0, Math.min(1, curr / prev));
  }

  const funnelRaw: Array<{ key: ActivationFunnelStage['key']; label: string; count: number }> = [
    { key: 'registered', label: 'Registered', count: totalPatients },
    { key: 'verified', label: 'Verified accounts', count: totalVerifiedPatients },
    { key: 'first_consult', label: 'First consult', count: apptPatients30.size },
    { key: 'first_order', label: 'First CarePort / MedReach order', count: distinctPaidPatients30.size },
    { key: 'repeat_consult', label: 'Repeat consult', count: repeatConsultPatients30 },
    { key: 'repeat_order', label: 'Repeat order', count: repeatOrderPatients30 },
  ];

  const funnelStages: ActivationFunnelStage[] = funnelRaw.map((s, idx) => {
    const prev = idx === 0 ? s.count : funnelRaw[idx - 1].count;
    return {
      key: s.key,
      label: s.label,
      count: s.count,
      conversionFromPrevious: idx === 0 ? 1 : conv(s.count, prev),
    };
  });

  // Retention cohorts (weekly buckets inside startRange)
  const cohortPatients = await prisma.patientProfile
    .findMany({
      where: { createdAt: { gte: startRange, lt: end }, userId: { not: null } },
      select: { userId: true, createdAt: true },
      take: 200_000,
    })
    .catch(() => []);

  const weeks = Math.min(12, Math.max(1, Math.ceil(rangeDays(rangeKey) / 7)));
  const cohortBuckets: Array<{ s: Date; e: Date; key: string; label: string }> = [];
  for (let i = 0; i < weeks; i++) {
    const s = addDays(startRange, i * 7);
    const e = i === weeks - 1 ? end : addDays(startRange, (i + 1) * 7);
    const key = `${s.toISOString().slice(0, 10)}_${e.toISOString().slice(0, 10)}`;
    const label = `${s.toISOString().slice(5, 10)} → ${e.toISOString().slice(5, 10)}`;
    cohortBuckets.push({ s, e, key, label });
  }

  function retainedShare(patients: any[], days: number): number | null {
    let eligible = 0;
    let retained = 0;

    for (const p of patients) {
      const uid = String(p?.userId ?? '');
      const createdAt = p?.createdAt ? new Date(p.createdAt) : null;
      if (!uid || !createdAt) continue;

      const target = addDays(createdAt, days).getTime();
      if (target > end.getTime()) continue;

      eligible++;
      const lastSeen = lastSeenByUserId.get(uid);
      if (lastSeen && lastSeen.getTime() >= target) retained++;
    }

    return eligible ? clamp01(retained / eligible) : null;
  }

  const retentionCohorts: RetentionCohortRow[] = cohortBuckets.map((b) => {
    const patients = cohortPatients.filter((p: any) => {
      const t = p?.createdAt ? new Date(p.createdAt).getTime() : NaN;
      return Number.isFinite(t) && t >= b.s.getTime() && t < b.e.getTime();
    });

    return {
      cohortKey: b.key,
      cohortLabel: b.label,
      cohortSize: patients.length,
      d7Retained: retainedShare(patients, 7),
      d30Retained: retainedShare(patients, 30),
      d60Retained: retainedShare(patients, 60),
      d90Retained: retainedShare(patients, 90),
    };
  });

  // Feature usage (AuditLog best-effort)
  const featureUsage: FeatureUsageItem[] = await (async () => {
    const hasAudit = typeof (prisma as any).auditLog?.findMany === 'function';
    if (!hasAudit) return [];

    const logs = await (prisma as any).auditLog
      .findMany({
        where: {
          createdAt: { gte: start30, lt: end },
          app: 'patient-app',
          actorType: AuditActorType.PATIENT,
        },
        select: { actorUserId: true, action: true, createdAt: true },
        take: 80_000,
      })
      .catch(() => []);

    if (!logs.length) return [];

    const since1d = start1.getTime();
    const since7d = start7.getTime();
    const since30d = start30.getTime();

    const defs: Array<{ key: FeatureUsageItem['key']; label: string; re: RegExp }> = [
      { key: 'consult_video', label: 'Video consults', re: /(televisit|sfu|video|call|room)/i },
      { key: 'consult_chat', label: 'Chat consults', re: /(chat|message|inbox|thread)/i },
      { key: 'self_checks', label: 'Self-checks & symptom flows', re: /(self[-_ ]?check|symptom|triage)/i },
      { key: 'medication_schedule', label: 'Medication schedule & reminders', re: /(medication|reminder|rx|prescription)/i },
      { key: 'vitals_dashboard', label: 'NexRing / vitals dashboard', re: /(vital|bp|heart|spo2|steps|sleep)/i },
      { key: 'erx_refill', label: 'eRx refills via CarePort', re: /(careport|pharmacy|delivery|refill)/i },
      { key: 'lab_results', label: 'Lab results (MedReach)', re: /(medreach|lab|sample|phleb|result)/i },
      { key: 'careplan_tasks', label: 'Care plan tasks', re: /(careplan|task|plan)/i },
      { key: 'shop', label: 'Ambulant+ shop', re: /(shop|store|cart|checkout|order)/i },
      { key: 'rewards', label: 'Rewards & challenges', re: /(reward|challenge|streak|badge)/i },
    ];

    const out: FeatureUsageItem[] = [];
    for (const f of defs) {
      const dau = new Set<string>();
      const wau = new Set<string>();
      const mau = new Set<string>();
      let totalMatches30 = 0;

      for (const l of logs as any[]) {
        const uid = String(l?.actorUserId ?? '');
        if (!uid) continue;
        const action = String(l?.action ?? '');
        if (!f.re.test(action)) continue;

        const t = l?.createdAt ? new Date(l.createdAt).getTime() : NaN;
        if (!Number.isFinite(t)) continue;

        if (t >= since30d) totalMatches30 += 1;
        if (t >= since1d) dau.add(uid);
        if (t >= since7d) wau.add(uid);
        if (t >= since30d) mau.add(uid);
      }

      const monthlyActiveUsers = mau.size;
      out.push({
        key: f.key,
        label: f.label,
        dailyActiveUsers: dau.size,
        weeklyActiveUsers: wau.size,
        monthlyActiveUsers,
        avgSessionsPerUser30d: monthlyActiveUsers ? totalMatches30 / monthlyActiveUsers : 0,
        avgMinutesPerUser30d: 0,
        penetrationActive30d: clamp01(monthlyActiveUsers / Math.max(1, activePatients30d)) ?? 0,
      });
    }

    // “Other”
    const knownRe = new RegExp(defs.map((d) => d.re.source).join('|'), 'i');
    const otherDau = new Set<string>();
    const otherWau = new Set<string>();
    const otherMau = new Set<string>();
    let otherMatches30 = 0;

    for (const l of logs as any[]) {
      const uid = String(l?.actorUserId ?? '');
      if (!uid) continue;
      const action = String(l?.action ?? '');
      const t = l?.createdAt ? new Date(l.createdAt).getTime() : NaN;
      if (!Number.isFinite(t)) continue;

      if (knownRe.test(action)) continue;

      if (t >= since30d) otherMatches30 += 1;
      if (t >= since1d) otherDau.add(uid);
      if (t >= since7d) otherWau.add(uid);
      if (t >= since30d) otherMau.add(uid);
    }

    out.push({
      key: 'other',
      label: 'Other flows',
      dailyActiveUsers: otherDau.size,
      weeklyActiveUsers: otherWau.size,
      monthlyActiveUsers: otherMau.size,
      avgSessionsPerUser30d: otherMau.size ? otherMatches30 / otherMau.size : 0,
      avgMinutesPerUser30d: 0,
      penetrationActive30d: clamp01(otherMau.size / Math.max(1, activePatients30d)) ?? 0,
    });

    return out;
  })();

  // Device usage (VitalSample + Device best-effort)
  const deviceUsage: DeviceUsageItem[] = await (async () => {
    const top = await prisma.vitalSample
      .groupBy({
        by: ['deviceId'],
        where: { t: { gte: start30, lt: end } },
        _count: { _all: true },
        orderBy: { _count: { _all: 'desc' } },
        take: 20,
      })
      .catch(() => []);

    if (!top.length) return [];

    const deviceIds = top.map((r: any) => String(r?.deviceId ?? '')).filter(Boolean);

    const pairs = await prisma.vitalSample
      .groupBy({
        by: ['deviceId', 'patientId'],
        where: { t: { gte: start30, lt: end }, deviceId: { in: deviceIds } },
        _count: { _all: true },
        take: 200_000,
      })
      .catch(() => []);

    const usersByDevice = new Map<string, Set<string>>();
    for (const p of pairs as any[]) {
      const did = String(p?.deviceId ?? '');
      const pid = String(p?.patientId ?? '');
      if (!did || !pid) continue;
      const s = usersByDevice.get(did) || new Set<string>();
      s.add(pid);
      usersByDevice.set(did, s);
    }

    const devRows = await prisma.device
      .findMany({
        where: { deviceId: { in: deviceIds } },
        select: { deviceId: true, category: true, vendor: true, model: true },
      })
      .catch(() => []);

    const metaByDeviceId = new Map<string, { label: string; modality: string }>();
    for (const d of devRows as any[]) {
      const did = String(d?.deviceId ?? '');
      const label =
        String(d?.category ?? '').trim() ||
        [d?.vendor, d?.model].filter(Boolean).join(' ') ||
        did;

      const modality = String(d?.category ?? '').trim() || 'unknown';

      metaByDeviceId.set(did, { label, modality: slugify(modality) || 'unknown' });
    }

    return (top as any[]).map((r) => {
      const did = String(r?.deviceId ?? '');
      const meta = metaByDeviceId.get(did);
      const label = meta?.label || did || 'Unknown device';
      const modality = meta?.modality || 'unknown';

      const measurements = Number(r?._count?._all ?? 0) || 0;
      const activeUsers = usersByDevice.get(did)?.size ?? 0;
      const avg = safeDiv(measurements, Math.max(1, activeUsers)) ?? 0;

      return {
        deviceSlug: slugify(label) || slugify(did) || 'device',
        label,
        modality,
        activeUsers30d: activeUsers,
        measurements30d: measurements,
        avgMeasurementsPerUser30d: avg,
        penetrationActive30d: clamp01(activeUsers / Math.max(1, activePatients30d)) ?? 0,
      };
    });
  })();

  // Steps/calories/sleep sums for segments (30d)
  const vitAgg = await prisma.vitalSample
    .groupBy({
      by: ['patientId', 'vType'],
      where: {
        t: { gte: start30, lt: end },
        vType: {
          in: [
            'steps',
            'calories',
            'kcal',
            'calories_burned',
            'sleep_hours',
            'sleep',
            'sleep_duration',
          ],
        },
      },
      _sum: { valueNum: true },
      _count: { _all: true },
      take: 200_000,
    })
    .catch(() => []);

  const stepsByPatient = new Map<string, number>();
  const calsByPatient = new Map<string, number>();
  const sleepByPatient = new Map<string, number>();

  for (const r of vitAgg as any[]) {
    const pid = String(r?.patientId ?? '');
    if (!pid) continue;
    const t = String(r?.vType ?? '').toLowerCase();
    const sum = Number(r?._sum?.valueNum ?? 0) || 0;

    if (t === 'steps') stepsByPatient.set(pid, (stepsByPatient.get(pid) ?? 0) + sum);
    else if (t === 'sleep_hours' || t === 'sleep' || t === 'sleep_duration') {
      sleepByPatient.set(pid, (sleepByPatient.get(pid) ?? 0) + sum);
    } else {
      calsByPatient.set(pid, (calsByPatient.get(pid) ?? 0) + sum);
    }
  }

  // Build segment patient set: active30 + anyone with lifestyle data
  const segPatientIds = new Set<string>();
  for (const pid of activePatientIds30) segPatientIds.add(pid);
  for (const pid of stepsByPatient.keys()) segPatientIds.add(pid);
  for (const pid of calsByPatient.keys()) segPatientIds.add(pid);
  for (const pid of sleepByPatient.keys()) segPatientIds.add(pid);

  const idList = Array.from(segPatientIds).slice(0, 80_000);
  const profiles = idList.length
    ? await prisma.patientProfile
        .findMany({
          where: { id: { in: idList } },
          select: { id: true, userId: true, gender: true, dob: true },
          take: 120_000,
        })
        .catch(() => [])
    : [];

  const days30 = 30;

  // adherence score lookup by patientId (best-effort)
  const adherenceScoreByPid = new Map<string, number>();
  if (adherence?.buckets) {
    // We don’t have per-patient scores once bucketed, so compute from reminders again if present.
    // If you need per-patient segment adherence later, we can add a cheap lookup pass.
  }

  // Seg aggregation
  type SegAgg = {
    activePatients: number;
    sessions: number;
    minutes: number;
    consults: number;
    stepsPerDaySum: number;
    caloriesPerDaySum: number;
    sleepPerDaySum: number;
    lifestyleSample: number;
    revenueZAR: number;
    adherenceScores: number[];
  };

  const segMap = new Map<string, { key: SegmentKey; agg: SegAgg }>();

  for (const p of profiles as any[]) {
    const pid = String(p?.id ?? '');
    if (!pid) continue;

    const plan: PlanTier = 'unknown';
    const gender = normGender(p?.gender);
    const ageBand = ageBandFromDob(p?.dob ? new Date(p.dob) : null, end);

    const key: SegmentKey = { ageBand, gender, plan };
    const kStr = `${plan}|${gender}|${ageBand}`;

    const isActive = activePatientIds30.has(pid);

    const userId = p?.userId ? String(p.userId) : '';
    const sess = userId ? (sessionsCountByUserId30.get(userId) ?? 0) : 0;
    const mins = minutesByPatientId.get(pid) ?? 0;
    const consults = consultCountByPatientId.get(pid) ?? 0;
    const revenue = (revenueCentsByPatientId.get(pid) ?? 0) / 100;

    const stepsTotal = stepsByPatient.get(pid) ?? 0;
    const calsTotal = calsByPatient.get(pid) ?? 0;
    const sleepTotal = sleepByPatient.get(pid) ?? 0;

    const hasLifestyle = stepsTotal > 0 || calsTotal > 0 || sleepTotal > 0;

    const entry = segMap.get(kStr) || {
      key,
      agg: {
        activePatients: 0,
        sessions: 0,
        minutes: 0,
        consults: 0,
        stepsPerDaySum: 0,
        caloriesPerDaySum: 0,
        sleepPerDaySum: 0,
        lifestyleSample: 0,
        revenueZAR: 0,
        adherenceScores: [],
      },
    };

    if (isActive) {
      entry.agg.activePatients += 1;
      entry.agg.sessions += sess;
      entry.agg.minutes += mins;
      entry.agg.consults += consults;
      entry.agg.revenueZAR += revenue;

      if (hasLifestyle) {
        entry.agg.stepsPerDaySum += stepsTotal / days30;
        entry.agg.caloriesPerDaySum += calsTotal / days30;
        entry.agg.sleepPerDaySum += sleepTotal / days30;
        entry.agg.lifestyleSample += 1;
      }

      const adh = adherenceScoreByPid.get(pid);
      if (adh != null) entry.agg.adherenceScores.push(adh);
    }

    segMap.set(kStr, entry);
  }

  const segments: SegmentRow[] = [];
  const stepsAndCalories: StepsAndCaloriesAggregate[] = [];

  for (const { key, agg } of segMap.values()) {
    const sessionsPerActive = safeDiv(agg.sessions, Math.max(1, agg.activePatients)) ?? 0;
    const minutesPerActive = safeDiv(agg.minutes, Math.max(1, agg.activePatients)) ?? 0;
    const consultsPerActive = safeDiv(agg.consults, Math.max(1, agg.activePatients)) ?? 0;
    const revenuePerActive = safeDiv(agg.revenueZAR, Math.max(1, agg.activePatients)) ?? 0;

    const avgDailySteps = agg.lifestyleSample ? agg.stepsPerDaySum / agg.lifestyleSample : 0;
    const avgDailyCalories = agg.lifestyleSample ? agg.caloriesPerDaySum / agg.lifestyleSample : 0;
    const avgSleepHours = agg.lifestyleSample ? agg.sleepPerDaySum / agg.lifestyleSample : 0;

    const segAdh =
      agg.adherenceScores.length
        ? agg.adherenceScores.reduce((s, x) => s + x, 0) / agg.adherenceScores.length
        : 0;

    segments.push({
      key,
      metrics: {
        activePatients30d: agg.activePatients,
        sessionsPerActive30d: sessionsPerActive,
        minutesPerActive30d: minutesPerActive,
        consultsPerActive30d: consultsPerActive,
        avgDailySteps,
        avgDailyCalories,
        avgSleepHours,
        avgRevenuePerActive30d: revenuePerActive,
        medicationAdherenceScore: segAdh,
      },
    });

    stepsAndCalories.push({
      segmentKey: key,
      avgDailySteps,
      avgDailyCalories,
      sampleSize: agg.lifestyleSample,
    });
  }

  // Summary: “plan totals” not yet modeled → everything is free/unknown for now
  const totalPremiumPatients = 0;
  const totalFreePatients = totalPatients;

  const activationRate = clamp01(safeDiv(totalVerifiedPatients, Math.max(1, totalPatients)));
  const firstConsultConversionRate = clamp01(safeDiv(apptPatients30.size, Math.max(1, totalVerifiedPatients)));
  const firstOrderConversionRate = clamp01(safeDiv(distinctPaidPatients30.size, Math.max(1, apptPatients30.size)));

  const avgMedicationAdherenceScore = adherence?.avgScoreOverall ?? null;
  const highRiskNonAdherentShare = adherence?.highRiskLowAdherentShare ?? null;

  const summary: PatientEngagementSummary = {
    totalPatients,
    totalVerifiedPatients,
    totalPremiumPatients,
    totalFreePatients,
    activePatients30d,
    activePatients90d,
    dau7dAvg,
    wau4wAvg,
    retention30d,
    retention90d,
    churnRate90d,
    avgSessionsPerActive30d,
    medianSessionsPerActive30d,
    avgMinutesPerActive30d,
    activationRate,
    firstConsultConversionRate,
    firstOrderConversionRate,
    avgRevenuePerActive30d,
    avgRevenuePerPatientLTV,
    avgMedicationAdherenceScore,
    highRiskNonAdherentShare,
  };

  return {
    summary,
    planSnapshots,
    funnelStages,
    retentionCohorts,
    featureUsage,
    deviceUsage,
    adherence,
    segments,
    stepsAndCalories,
  };
}

/* ---------------- Route handler ---------------- */

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const rangeKey = parseRange(url.searchParams.get('range'));

  // Optional upstream APIGW passthrough
  const apigwBase =
    process.env.ANALYTICS_APIGW_BASE_URL ||
    process.env.AMBULANT_APIGW_URL ||
    '';

  if (apigwBase) {
    try {
      const upstream = new URL('/api/admin/analytics/patient-engagement', apigwBase);
      upstream.searchParams.set('range', rangeKey);

      const res = await fetch(upstream.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (res.ok) {
        const json = await res.json();
        return NextResponse.json(json, { status: 200 });
      }

      console.error(
        '[analytics/patient-engagement] Upstream non-OK:',
        res.status,
        await res.text().catch(() => ''),
      );
    } catch (e) {
      console.error('[analytics/patient-engagement] Upstream error:', e);
    }
  }

  const payload = await buildPatientEngagement(rangeKey);

  const response: PatientEngagementApiResponse = {
    ok: true,
    asAt: new Date().toISOString(),
    range: rangeKey,
    data: payload,
  };

  return NextResponse.json(response, { status: 200 });
}
