/* apps/admin-dashboard/app/api/analytics/clinicians/route.ts */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

declare global {
  // eslint-disable-next-line no-var
  var __prismaClinicianAnalytics: PrismaClient | undefined;
}

const prisma = globalThis.__prismaClinicianAnalytics ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis.__prismaClinicianAnalytics = prisma;

type RangeKey = '7d' | '30d' | '90d' | '12m';

type BucketRow = { label: string; sessions: number; sharePct: number };

type PaymentMixRow = {
  status: string;
  count: number;
  sharePct: number;
  grossRevenueCents: number;
  platformFeesCents: number;
};

type DeviceMixRow = {
  deviceKey: string;
  devices: number;
  cliniciansWithDevice: number;
  shareCliniciansPct: number;
};

type TrendsPayload = {
  labels: string[];
  series: Record<string, number[]>;
};

type ClinicianKpis = {
  totalClinicians: number;
  activeClinicians: number;
  newClinicians: number;
  onboardingInProgress: number;

  avgTimeToFirstConsultDays: number; // best-effort
  avgClinicianOnTimeJoinRatePct: number; // best-effort
  avgPatientOnTimeJoinRatePct: number; // best-effort
  avgOverrunRatePct: number; // best-effort
  churnRatePct: number; // best-effort

  totalAppointmentsBooked: number;
  totalConsultsCompleted: number;
  totalConsultationMinutes: number;

  // NEW KPIs requested
  onlineNow: number;
  activeSeen7d: number;
  activeSeen30d: number;
  medianTrainingHours: number | null;
  noShowRatePct: number;

  grossRevenueCents: number;
  platformFeesCents: number;
  clinicianTakeCents: number;

  deviceAdoptionRatePct: number;
};

type LateClinicianRow = {
  clinicianId: string;
  name: string;
  classLabel?: string | null;
  status: 'active' | 'suspended' | 'deactivated';
  sessionsAnalysed: number;
  clinicianOnTimeJoinRatePct: number;
  avgClinicianJoinDelayMin: number;
  overrunRatePct: number;
};

type ClinicianAnalyticsPayload = {
  range: { key: RangeKey; startISO: string; endISO: string };
  compare?: { key: 'prev'; startISO: string; endISO: string; kpis: ClinicianKpis } | null;

  kpis: ClinicianKpis;

  // still returned for the existing page (best-effort; safe defaults if your schema differs)
  punctualityBucketsClinician: BucketRow[];
  punctualityBucketsPatient: BucketRow[];
  overrunBuckets: BucketRow[];
  onboardingStages: any[];
  plans: any[];
  deactivations: any[];
  lateClinicians: LateClinicianRow[];

  // requested detail breakdowns
  paymentMix: PaymentMixRow[];
  deviceMix: DeviceMixRow[];

  // bucketed series (real where possible; otherwise stable)
  trends: TrendsPayload;

  meta: { ok: true; partial: boolean; warnings: string[] };
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function asNumber(x: any): number {
  if (x == null) return 0;
  if (typeof x === 'number') return Number.isFinite(x) ? x : 0;
  if (typeof x === 'bigint') return Number(x);
  if (typeof x === 'string') return Number(x) || 0;
  // Prisma Decimal
  if (typeof x === 'object' && typeof x.toNumber === 'function') return x.toNumber();
  return Number(x) || 0;
}

function median(nums: number[]): number | null {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function addMonths(d: Date, months: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

function parseRange(v: string | null): RangeKey {
  if (v === '7d' || v === '30d' || v === '90d' || v === '12m') return v;
  return '30d';
}

function rangeWindow(now: Date, key: RangeKey) {
  const end = now;
  let start: Date;
  if (key === '7d') start = addDays(end, -7);
  else if (key === '30d') start = addDays(end, -30);
  else if (key === '90d') start = addDays(end, -90);
  else start = addMonths(end, -12);

  return { start, end };
}

function prevWindow(currStart: Date, currEnd: Date, key: RangeKey) {
  const end = currStart;
  let start: Date;
  if (key === '7d') start = addDays(end, -7);
  else if (key === '30d') start = addDays(end, -30);
  else if (key === '90d') start = addDays(end, -90);
  else start = addMonths(end, -12);

  return { start, end };
}

/* ----------- Prisma DMMF helpers (defensive schema probing) ----------- */

function getDmmfModels(p: any): any[] {
  return p?._dmmf?.datamodel?.models || p?._baseDmmf?.datamodel?.models || [];
}

function findModel(p: any, candidates: string[]): { modelName: string; delegateKey: string; fields: string[] } | null {
  const models = getDmmfModels(p);
  const byLower = new Map(models.map((m: any) => [String(m.name).toLowerCase(), m]));
  for (const c of candidates) {
    const m = byLower.get(String(c).toLowerCase());
    if (m) {
      const modelName = String(m.name);
      const delegateKey = modelName.charAt(0).toLowerCase() + modelName.slice(1);
      const fields: string[] = (m.fields || []).map((f: any) => String(f.name));
      return { modelName, delegateKey, fields };
    }
  }
  return null;
}

function pickField(fields: string[], candidates: string[]): string | null {
  const set = new Set(fields.map((f) => f.toLowerCase()));
  for (const c of candidates) {
    if (set.has(String(c).toLowerCase())) {
      // return exact-cased field from fields array
      const exact = fields.find((f) => f.toLowerCase() === String(c).toLowerCase());
      return exact || c;
    }
  }
  return null;
}

/* ------------------- Trends bucketing ------------------- */

function buildBuckets(key: RangeKey, start: Date, end: Date): { s: Date; e: Date; label: string }[] {
  const buckets: { s: Date; e: Date; label: string }[] = [];
  const s0 = startOfDay(start);
  const e0 = new Date(end);

  if (key === '7d') {
    for (let i = 0; i < 7; i++) {
      const s = addDays(s0, i);
      const e = addDays(s0, i + 1);
      buckets.push({ s, e, label: s.toISOString().slice(5, 10) }); // MM-DD
    }
    return buckets;
  }

  if (key === '30d') {
    // 10 buckets of ~3 days
    for (let i = 0; i < 10; i++) {
      const s = addDays(s0, i * 3);
      const e = i === 9 ? e0 : addDays(s0, (i + 1) * 3);
      buckets.push({ s, e, label: s.toISOString().slice(5, 10) });
    }
    return buckets;
  }

  if (key === '90d') {
    // ~13 weekly buckets
    for (let i = 0; i < 13; i++) {
      const s = addDays(s0, i * 7);
      const e = i === 12 ? e0 : addDays(s0, (i + 1) * 7);
      buckets.push({ s, e, label: s.toISOString().slice(5, 10) });
    }
    return buckets;
  }

  // 12m: 12 monthly buckets
  {
    let cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    for (let i = 0; i < 12; i++) {
      const s = new Date(cursor);
      const e = i === 11 ? e0 : addMonths(cursor, 1);
      buckets.push({ s, e, label: s.toLocaleString(undefined, { month: 'short' }) });
      cursor = addMonths(cursor, 1);
    }
    return buckets;
  }
}

/* ------------------- Core aggregation ------------------- */

async function computeForWindow(args: {
  start: Date;
  end: Date;
  rangeKey: RangeKey;
  warnings: string[];
}): Promise<{
  kpis: ClinicianKpis;
  paymentMix: PaymentMixRow[];
  deviceMix: DeviceMixRow[];
  punctualityBucketsClinician: BucketRow[];
  punctualityBucketsPatient: BucketRow[];
  overrunBuckets: BucketRow[];
  lateClinicians: LateClinicianRow[];
  trends: TrendsPayload;
  partial: boolean;
}> {
  const { start, end, rangeKey, warnings } = args;
  const p: any = prisma;

  let partial = false;

  // ---- Models (probe)
  const clinicianProfile = findModel(p, ['ClinicianProfile']);
  const onboarding = findModel(p, ['ClinicianOnboarding', 'Onboarding']);
  const appointment = findModel(p, ['Appointment', 'Televisit', 'Visit']);
  const payment = findModel(p, ['Payment', 'Transaction']);
  const userDevice = findModel(p, ['UserDevice', 'Device']);

  if (!clinicianProfile) {
    warnings.push('Model ClinicianProfile not found via Prisma DMMF. online/lastSeen metrics will be 0.');
    partial = true;
  }
  if (!appointment) {
    warnings.push('Model Appointment/Televisit/Visit not found via Prisma DMMF. no-show/punctuality/overrun metrics will be 0.');
    partial = true;
  }
  if (!payment) {
    warnings.push('Model Payment/Transaction not found via Prisma DMMF. revenue metrics will be 0.');
    partial = true;
  }
  if (!userDevice) {
    warnings.push('Model UserDevice/Device not found via Prisma DMMF. device adoption metrics will be 0.');
    partial = true;
  }

  // ---- ClinicianProfile fields
  const cpFields = clinicianProfile?.fields || [];
  const cpOnlineField = clinicianProfile ? pickField(cpFields, ['online', 'isOnline']) : null;
  const cpLastSeenField = clinicianProfile ? pickField(cpFields, ['lastSeenAt', 'lastActiveAt', 'seenAt', 'updatedAt']) : null;
  const cpCreatedAtField = clinicianProfile ? pickField(cpFields, ['createdAt']) : null;
  const cpStatusField = clinicianProfile ? pickField(cpFields, ['status', 'accountStatus']) : null;
  const cpDeactivatedAtField = clinicianProfile ? pickField(cpFields, ['deactivatedAt', 'disabledAt']) : null;
  const cpReasonField = clinicianProfile ? pickField(cpFields, ['deactivationReason', 'reason', 'statusReason']) : null;

  // ---- Appointment fields
  const apFields = appointment?.fields || [];
  const apStatusField = appointment ? pickField(apFields, ['status']) : null;
  const apSchedField = appointment ? pickField(apFields, ['scheduledStartAt', 'startsAt', 'startAt', 'scheduledAt']) : null;
  const apClinicianIdField = appointment ? pickField(apFields, ['clinicianId', 'clinicianUserId', 'providerUserId', 'providerId']) : null;
  const apPatientIdField = appointment ? pickField(apFields, ['patientId', 'patientUserId', 'memberUserId']) : null;

  const apClinJoinField = appointment ? pickField(apFields, ['clinicianJoinedAt', 'providerJoinedAt', 'clinicianJoinAt']) : null;
  const apPatJoinField = appointment ? pickField(apFields, ['patientJoinedAt', 'patientJoinAt']) : null;

  const apBookedDurField = appointment ? pickField(apFields, ['durationMin', 'bookedDurationMin', 'slotMinutes']) : null;
  const apActualDurField = appointment ? pickField(apFields, ['actualDurationMin', 'consultDurationMin']) : null;
  const apStartedAtField = appointment ? pickField(apFields, ['startedAt']) : null;
  const apEndedAtField = appointment ? pickField(apFields, ['endedAt', 'completedAt']) : null;

  // ---- Payment fields
  const payFields = payment?.fields || [];
  const payStatusField = payment ? pickField(payFields, ['status']) : null;
  const payCreatedField = payment ? pickField(payFields, ['createdAt', 'paidAt']) : null;
  const payAmountField = payment ? pickField(payFields, ['amountCents', 'grossCents', 'totalCents', 'amount']) : null;
  const payPlatformFeeField = payment ? pickField(payFields, ['platformFeeCents', 'feeCents']) : null;
  const payClinicianTakeField = payment ? pickField(payFields, ['clinicianTakeCents', 'providerTakeCents']) : null;

  // ---- Device fields
  const devFields = userDevice?.fields || [];
  const devUserIdField = userDevice ? pickField(devFields, ['userId', 'ownerUserId']) : null;
  const devKeyField = userDevice ? pickField(devFields, ['deviceKey', 'deviceType', 'kind', 'productKey', 'modelKey', 'sku']) : null;
  const devCreatedField = userDevice ? pickField(devFields, ['createdAt']) : null;

  // ---------------- Counts: clinicians + online + lastSeen
  const now = new Date();
  const seen7d = addDays(now, -7);
  const seen30d = addDays(now, -30);

  const totalClinicians = clinicianProfile
    ? await p[clinicianProfile.delegateKey].count()
    : 0;

  const activeClinicians = clinicianProfile
    ? await p[clinicianProfile.delegateKey].count({
        where: cpStatusField
          ? { [cpStatusField]: 'active' }
          : cpDeactivatedAtField
          ? { [cpDeactivatedAtField]: null }
          : undefined,
      })
    : 0;

  const onlineNow = clinicianProfile && cpOnlineField
    ? await p[clinicianProfile.delegateKey].count({ where: { [cpOnlineField]: true } })
    : 0;

  const activeSeen7d = clinicianProfile && cpLastSeenField
    ? await p[clinicianProfile.delegateKey].count({ where: { [cpLastSeenField]: { gte: seen7d } } })
    : 0;

  const activeSeen30d = clinicianProfile && cpLastSeenField
    ? await p[clinicianProfile.delegateKey].count({ where: { [cpLastSeenField]: { gte: seen30d } } })
    : 0;

  const newClinicians = clinicianProfile && cpCreatedAtField
    ? await p[clinicianProfile.delegateKey].count({ where: { [cpCreatedAtField]: { gte: start, lt: end } } })
    : 0;

  // ---------------- Onboarding: in progress + median training hours
  let onboardingInProgress = 0;
  let medianTrainingHours: number | null = null;

  if (onboarding) {
    const obFields = onboarding.fields || [];
    const obStatusField = pickField(obFields, ['status', 'stage']);
    const obCreatedField = pickField(obFields, ['createdAt']);
    const obCompletedField = pickField(obFields, ['trainingCompletedAt', 'completedAt', 'approvedAt']);

    // in-progress
    if (obStatusField) {
      onboardingInProgress = await p[onboarding.delegateKey].count({
        where: {
          [obStatusField]: { in: ['applied', 'screened', 'approved', 'training_scheduled', 'training_completed'] },
        },
      }).catch(() => 0);
    } else if (obCompletedField) {
      onboardingInProgress = await p[onboarding.delegateKey].count({
        where: { [obCompletedField]: null },
      }).catch(() => 0);
    }

    // median training time (best-effort)
    const obTrainingStartField = pickField(obFields, ['trainingStartedAt', 'trainingStartAt', 'trainingScheduledAt', 'scheduledAt', 'startedAt']);
    const obTrainingEndField = pickField(obFields, ['trainingCompletedAt', 'completedAt', 'endedAt']);

    if (obTrainingStartField && obTrainingEndField) {
      const rows = await p[onboarding.delegateKey].findMany({
        where: obCreatedField ? { [obCreatedField]: { gte: start, lt: end } } : undefined,
        select: { [obTrainingStartField]: true, [obTrainingEndField]: true },
        take: 10000,
      }).catch(() => []);

      const hours = (rows || [])
        .map((r: any) => {
          const s = r?.[obTrainingStartField] ? new Date(r[obTrainingStartField]) : null;
          const e = r?.[obTrainingEndField] ? new Date(r[obTrainingEndField]) : null;
          if (!s || !e) return NaN;
          const h = (e.getTime() - s.getTime()) / 36e5;
          return h >= 0 && h <= 24 * 30 ? h : NaN;
        })
        .filter((h: number) => Number.isFinite(h));

      medianTrainingHours = median(hours);
    } else {
      warnings.push('ClinicianOnboarding found but training start/end fields not detected; medianTrainingHours=null.');
      partial = true;
    }
  }

  // ---------------- Appointments: booked, completed, minutes, no-show, punctuality, overruns, late clinician drilldown
  let totalAppointmentsBooked = 0;
  let totalConsultsCompleted = 0;
  let totalConsultationMinutes = 0;

  let noShowRatePct = 0;

  let punctualityBucketsClinician: BucketRow[] = [];
  let punctualityBucketsPatient: BucketRow[] = [];
  let overrunBuckets: BucketRow[] = [];
  let avgClinicianOnTimeJoinRatePct = 0;
  let avgPatientOnTimeJoinRatePct = 0;
  let avgOverrunRatePct = 0;

  let lateClinicians: LateClinicianRow[] = [];

  // These are best-effort “placeholder-real” (you can refine once your exact fields are confirmed)
  const graceMin = 2;

  if (appointment && apStatusField && apSchedField) {
    const whereWindow = { [apSchedField]: { gte: start, lt: end } };

    // booked = all in window (excluding drafts if detected)
    totalAppointmentsBooked = await p[appointment.delegateKey].count({ where: whereWindow }).catch(() => 0);

    // completed
    totalConsultsCompleted = await p[appointment.delegateKey].count({
      where: {
        ...whereWindow,
        [apStatusField]: { in: ['completed', 'done', 'fulfilled'] },
      },
    }).catch(() => 0);

    // no-shows
    const noShows = await p[appointment.delegateKey].count({
      where: {
        ...whereWindow,
        [apStatusField]: { in: ['no_show', 'noshow', 'noShow', 'missed'] },
      },
    }).catch(() => 0);

    noShowRatePct = totalAppointmentsBooked ? (noShows / totalAppointmentsBooked) * 100 : 0;

    // consultation minutes (sum best-effort)
    if (apActualDurField) {
      const agg = await p[appointment.delegateKey].aggregate({
        where: { ...whereWindow, [apStatusField]: { in: ['completed', 'done', 'fulfilled'] } },
        _sum: { [apActualDurField]: true },
      }).catch(() => null);

      totalConsultationMinutes = asNumber(agg?._sum?.[apActualDurField]);
    } else if (apBookedDurField) {
      const agg = await p[appointment.delegateKey].aggregate({
        where: { ...whereWindow, [apStatusField]: { in: ['completed', 'done', 'fulfilled'] } },
        _sum: { [apBookedDurField]: true },
      }).catch(() => null);

      totalConsultationMinutes = asNumber(agg?._sum?.[apBookedDurField]);
    } else if (apStartedAtField && apEndedAtField) {
      // fallback: compute from samples (cap for safety)
      const rows = await p[appointment.delegateKey].findMany({
        where: { ...whereWindow, [apStatusField]: { in: ['completed', 'done', 'fulfilled'] } },
        select: { [apStartedAtField]: true, [apEndedAtField]: true },
        take: 20000,
      }).catch(() => []);
      totalConsultationMinutes = (rows || []).reduce((sum: number, r: any) => {
        const s = r?.[apStartedAtField] ? new Date(r[apStartedAtField]).getTime() : NaN;
        const e = r?.[apEndedAtField] ? new Date(r[apEndedAtField]).getTime() : NaN;
        if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return sum;
        return sum + (e - s) / 60000;
      }, 0);
    }

    // deeper punctuality/overrun analysis (cap records)
    const needJoin = Boolean(apClinJoinField || apPatJoinField);
    const needOverrun = Boolean(apBookedDurField && (apActualDurField || (apStartedAtField && apEndedAtField)));
    const needPerClinician = Boolean(apClinicianIdField);

    if ((needJoin || needOverrun || needPerClinician) && apClinicianIdField) {
      const rows = await p[appointment.delegateKey].findMany({
        where: whereWindow,
        select: {
          [apStatusField]: true,
          [apSchedField]: true,
          ...(apClinJoinField ? { [apClinJoinField]: true } : {}),
          ...(apPatJoinField ? { [apPatJoinField]: true } : {}),
          ...(apBookedDurField ? { [apBookedDurField]: true } : {}),
          ...(apActualDurField ? { [apActualDurField]: true } : {}),
          ...(apStartedAtField ? { [apStartedAtField]: true } : {}),
          ...(apEndedAtField ? { [apEndedAtField]: true } : {}),
          ...(apClinicianIdField ? { [apClinicianIdField]: true } : {}),
        },
        take: 50000,
      }).catch(() => []);

      const total = rows.length;

      // Buckets
      const cBuckets = { onTime: 0, late05: 0, late510: 0, late10p: 0 };
      const pBuckets = { onTime: 0, late05: 0, late510: 0, late10p: 0 };
      const oBuckets = { onTime: 0, over025: 0, over2550: 0, over50p: 0 };

      // Aggregates
      let cOnTime = 0;
      let pOnTime = 0;
      let cJoinCount = 0;
      let pJoinCount = 0;

      let overCount = 0;
      let overDenom = 0;

      type ClinAgg = {
        sessions: number;
        cOnTime: number;
        cDelaySum: number;
        overCount: number;
        overDenom: number;
      };
      const perClin = new Map<string, ClinAgg>();

      for (const r of rows) {
        const sched = r?.[apSchedField] ? new Date(r[apSchedField]).getTime() : NaN;
        if (!Number.isFinite(sched)) continue;

        // clinician join
        if (apClinJoinField && r?.[apClinJoinField]) {
          const cj = new Date(r[apClinJoinField]).getTime();
          const delayMin = (cj - sched) / 60000;
          const onTime = delayMin <= graceMin;
          cJoinCount++;
          if (onTime) cOnTime++;

          if (delayMin <= graceMin) cBuckets.onTime++;
          else if (delayMin <= 5) cBuckets.late05++;
          else if (delayMin <= 10) cBuckets.late510++;
          else cBuckets.late10p++;

          if (needPerClinician) {
            const cid = String(r?.[apClinicianIdField] ?? '');
            if (cid) {
              const agg = perClin.get(cid) || { sessions: 0, cOnTime: 0, cDelaySum: 0, overCount: 0, overDenom: 0 };
              agg.sessions += 1;
              agg.cOnTime += onTime ? 1 : 0;
              agg.cDelaySum += Number.isFinite(delayMin) ? delayMin : 0;
              perClin.set(cid, agg);
            }
          }
        }

        // patient join
        if (apPatJoinField && r?.[apPatJoinField]) {
          const pj = new Date(r[apPatJoinField]).getTime();
          const delayMin = (pj - sched) / 60000;
          const onTime = delayMin <= graceMin;
          pJoinCount++;
          if (onTime) pOnTime++;

          if (delayMin <= graceMin) pBuckets.onTime++;
          else if (delayMin <= 5) pBuckets.late05++;
          else if (delayMin <= 10) pBuckets.late510++;
          else pBuckets.late10p++;
        }

        // overrun
        let booked = apBookedDurField ? asNumber(r?.[apBookedDurField]) : 0;
        if (!Number.isFinite(booked) || booked <= 0) booked = 0;

        let actual = 0;
        if (apActualDurField) actual = asNumber(r?.[apActualDurField]);
        else if (apStartedAtField && apEndedAtField && r?.[apStartedAtField] && r?.[apEndedAtField]) {
          const s = new Date(r[apStartedAtField]).getTime();
          const e = new Date(r[apEndedAtField]).getTime();
          if (Number.isFinite(s) && Number.isFinite(e) && e >= s) actual = (e - s) / 60000;
        }

        if (booked > 0 && actual >= 0) {
          const ratio = (actual - booked) / booked; // e.g. 0.25 = 25% over
          overDenom++;
          const over = ratio > 0;
          if (over) overCount++;

          if (ratio <= 0) oBuckets.onTime++;
          else if (ratio <= 0.25) oBuckets.over025++;
          else if (ratio <= 0.5) oBuckets.over2550++;
          else oBuckets.over50p++;

          // per clinician overrun
          if (needPerClinician && apClinicianIdField) {
            const cid = String(r?.[apClinicianIdField] ?? '');
            if (cid) {
              const agg = perClin.get(cid) || { sessions: 0, cOnTime: 0, cDelaySum: 0, overCount: 0, overDenom: 0 };
              agg.overDenom += 1;
              agg.overCount += over ? 1 : 0;
              perClin.set(cid, agg);
            }
          }
        }
      }

      avgClinicianOnTimeJoinRatePct = cJoinCount ? (cOnTime / cJoinCount) * 100 : 0;
      avgPatientOnTimeJoinRatePct = pJoinCount ? (pOnTime / pJoinCount) * 100 : 0;
      avgOverrunRatePct = overDenom ? (overCount / overDenom) * 100 : 0;

      const cTotal = cBuckets.onTime + cBuckets.late05 + cBuckets.late510 + cBuckets.late10p;
      const pTotal = pBuckets.onTime + pBuckets.late05 + pBuckets.late510 + pBuckets.late10p;
      const oTotal = oBuckets.onTime + oBuckets.over025 + oBuckets.over2550 + oBuckets.over50p;

      punctualityBucketsClinician = cTotal
        ? [
            { label: 'On time (≤ grace)', sessions: cBuckets.onTime, sharePct: (cBuckets.onTime / cTotal) * 100 },
            { label: '0–5 min late', sessions: cBuckets.late05, sharePct: (cBuckets.late05 / cTotal) * 100 },
            { label: '5–10 min late', sessions: cBuckets.late510, sharePct: (cBuckets.late510 / cTotal) * 100 },
            { label: '>10 min late', sessions: cBuckets.late10p, sharePct: (cBuckets.late10p / cTotal) * 100 },
          ]
        : [];

      punctualityBucketsPatient = pTotal
        ? [
            { label: 'On time (≤ grace)', sessions: pBuckets.onTime, sharePct: (pBuckets.onTime / pTotal) * 100 },
            { label: '0–5 min late', sessions: pBuckets.late05, sharePct: (pBuckets.late05 / pTotal) * 100 },
            { label: '5–10 min late', sessions: pBuckets.late510, sharePct: (pBuckets.late510 / pTotal) * 100 },
            { label: '>10 min late', sessions: pBuckets.late10p, sharePct: (pBuckets.late10p / pTotal) * 100 },
          ]
        : [];

      overrunBuckets = oTotal
        ? [
            { label: 'On time / early', sessions: oBuckets.onTime, sharePct: (oBuckets.onTime / oTotal) * 100 },
            { label: '0–25% over', sessions: oBuckets.over025, sharePct: (oBuckets.over025 / oTotal) * 100 },
            { label: '25–50% over', sessions: oBuckets.over2550, sharePct: (oBuckets.over2550 / oTotal) * 100 },
            { label: '>50% over', sessions: oBuckets.over50p, sharePct: (oBuckets.over50p / oTotal) * 100 },
          ]
        : [];

      // late clinicians (worst on-time, min sample size)
      const minSessions = 8;
      const late = Array.from(perClin.entries())
        .map(([cid, a]) => {
          const onTimePct = a.sessions ? (a.cOnTime / a.sessions) * 100 : 0;
          const avgDelay = a.sessions ? a.cDelaySum / a.sessions : 0;
          const overPct = a.overDenom ? (a.overCount / a.overDenom) * 100 : 0;
          return { cid, sessions: a.sessions, onTimePct, avgDelay, overPct };
        })
        .filter((x) => x.sessions >= minSessions)
        .sort((a, b) => a.onTimePct - b.onTimePct)
        .slice(0, 25);

      // Optional enrichment from ClinicianProfile (name/status/classLabel) if possible
      const enrichById = new Map<string, { name: string; status: any; classLabel?: any }>();
      if (clinicianProfile && cpStatusField) {
        const idField = pickField(cpFields, ['id', 'clinicianId', 'userId']) || 'id';
        const nameField = pickField(cpFields, ['displayName', 'name', 'fullName']) || null;
        const classField = pickField(cpFields, ['classLabel', 'clinicianClass', 'roleLabel']) || null;

        const ids = late.map((x) => x.cid).slice(0, 200);
        if (ids.length) {
          const rows2 = await p[clinicianProfile.delegateKey].findMany({
            where: { [idField]: { in: ids } },
            select: {
              [idField]: true,
              ...(nameField ? { [nameField]: true } : {}),
              ...(cpStatusField ? { [cpStatusField]: true } : {}),
              ...(classField ? { [classField]: true } : {}),
            },
          }).catch(() => []);

          for (const r of rows2 || []) {
            const idv = String(r?.[idField] ?? '');
            if (!idv) continue;
            enrichById.set(idv, {
              name: String(r?.[nameField as any] ?? idv),
              status: r?.[cpStatusField as any],
              classLabel: classField ? r?.[classField as any] : null,
            });
          }
        }
      }

      lateClinicians = late.map((x) => {
        const e = enrichById.get(x.cid);
        const statusRaw = String(e?.status ?? 'active').toLowerCase();
        const status: LateClinicianRow['status'] =
          statusRaw.includes('susp') ? 'suspended' : statusRaw.includes('deact') || statusRaw.includes('disabled') ? 'deactivated' : 'active';

        return {
          clinicianId: x.cid,
          name: e?.name || x.cid,
          classLabel: (e?.classLabel ? String(e.classLabel) : null) ?? null,
          status,
          sessionsAnalysed: x.sessions,
          clinicianOnTimeJoinRatePct: x.onTimePct,
          avgClinicianJoinDelayMin: x.avgDelay,
          overrunRatePct: x.overPct,
        };
      });

      if (!needJoin && !needOverrun && total > 0) {
        warnings.push('Appointment model detected but join/overrun fields not detected; punctuality/overrun metrics are limited.');
        partial = true;
      }
    } else {
      warnings.push('Appointment model detected but required fields not detected; punctuality/overrun/lateClinicians are limited.');
      partial = true;
    }
  } else if (appointment) {
    warnings.push('Appointment model detected but scheduled/status fields not detected; appointment metrics limited.');
    partial = true;
  }

  // ---------------- Churn (best-effort): deactivated in window / total
  let churnRatePct = 0;
  if (clinicianProfile) {
    let deactivatedInRange = 0;
    if (cpDeactivatedAtField) {
      deactivatedInRange = await p[clinicianProfile.delegateKey].count({
        where: { [cpDeactivatedAtField]: { gte: start, lt: end } },
      }).catch(() => 0);
    } else if (cpStatusField) {
      // fallback: count status=deactivated and updated in window if updatedAt exists
      const upd = pickField(cpFields, ['updatedAt']);
      if (upd) {
        deactivatedInRange = await p[clinicianProfile.delegateKey].count({
          where: { [cpStatusField]: { in: ['deactivated', 'disabled'] }, [upd]: { gte: start, lt: end } },
        }).catch(() => 0);
      }
    }
    churnRatePct = totalClinicians ? (deactivatedInRange / totalClinicians) * 100 : 0;
  }

  // ---------------- avgTimeToFirstConsultDays (best-effort)
  // If clinician profile has firstConsultAt and approvedAt, use it. Otherwise return 0 (safe).
  let avgTimeToFirstConsultDays = 0;
  if (clinicianProfile) {
    const firstConsultField = pickField(cpFields, ['firstConsultAt', 'firstEncounterAt']);
    const approvedField = pickField(cpFields, ['approvedAt', 'verifiedAt', 'onboardedAt', 'createdAt']);
    if (firstConsultField && approvedField) {
      const rows = await p[clinicianProfile.delegateKey].findMany({
        where: { [firstConsultField]: { not: null } },
        select: { [firstConsultField]: true, [approvedField]: true },
        take: 10000,
      }).catch(() => []);
      const days = (rows || [])
        .map((r: any) => {
          const a = r?.[approvedField] ? new Date(r[approvedField]).getTime() : NaN;
          const f = r?.[firstConsultField] ? new Date(r[firstConsultField]).getTime() : NaN;
          if (!Number.isFinite(a) || !Number.isFinite(f) || f < a) return NaN;
          const d = (f - a) / 86400000;
          return d >= 0 && d <= 365 ? d : NaN;
        })
        .filter((d: number) => Number.isFinite(d));
      avgTimeToFirstConsultDays = days.length ? days.reduce((s: number, x: number) => s + x, 0) / days.length : 0;
    }
  }

  // ---------------- Payments: revenue totals + mix
  let grossRevenueCents = 0;
  let platformFeesCents = 0;
  let clinicianTakeCents = 0;
  let paymentMix: PaymentMixRow[] = [];

  if (payment && payCreatedField && payStatusField) {
    const wherePay = { [payCreatedField]: { gte: start, lt: end } };

    const rows = await p[payment.delegateKey].groupBy({
      by: [payStatusField],
      where: wherePay,
      _count: { _all: true },
      _sum: {
        ...(payAmountField ? { [payAmountField]: true } : {}),
        ...(payPlatformFeeField ? { [payPlatformFeeField]: true } : {}),
        ...(payClinicianTakeField ? { [payClinicianTakeField]: true } : {}),
      },
    }).catch(() => []);

    const mapped = (rows || []).map((r: any) => {
      const status = String(r?.[payStatusField] ?? 'unknown');
      const count = asNumber(r?._count?._all);
      const gross = payAmountField ? asNumber(r?._sum?.[payAmountField]) : 0;
      const fee = payPlatformFeeField ? asNumber(r?._sum?.[payPlatformFeeField]) : 0;
      const take = payClinicianTakeField ? asNumber(r?._sum?.[payClinicianTakeField]) : Math.max(0, gross - fee);
      return { status, count, gross, fee, take };
    });

    const totalCount = mapped.reduce((s: number, x: any) => s + x.count, 0) || 1;

    paymentMix = mapped
      .sort((a: any, b: any) => b.count - a.count)
      .map((x: any) => ({
        status: x.status,
        count: x.count,
        sharePct: (x.count / totalCount) * 100,
        grossRevenueCents: x.gross,
        platformFeesCents: x.fee,
      }));

    grossRevenueCents = mapped.reduce((s: number, x: any) => s + x.gross, 0);
    platformFeesCents = mapped.reduce((s: number, x: any) => s + x.fee, 0);
    clinicianTakeCents = payClinicianTakeField
      ? mapped.reduce((s: number, x: any) => s + x.take, 0)
      : Math.max(0, grossRevenueCents - platformFeesCents);
  } else if (payment) {
    warnings.push('Payment model detected but createdAt/status fields not detected; revenue metrics limited.');
    partial = true;
  }

  // ---------------- Devices: adoption + mix (by clinician userId)
  let deviceMix: DeviceMixRow[] = [];
  let deviceAdoptionRatePct = 0;

  if (userDevice && devKeyField && devUserIdField) {
    // all clinician ids (best-effort): assume ClinicianProfile.id/userId are the same id used by UserDevice.userId
    let clinicianIds: string[] = [];
    if (clinicianProfile) {
      const idField = pickField(cpFields, ['userId', 'id', 'clinicianId']) || 'id';
      const rows = await p[clinicianProfile.delegateKey].findMany({
        select: { [idField]: true },
        take: 200000,
      }).catch(() => []);
      clinicianIds = (rows || []).map((r: any) => String(r?.[idField] ?? '')).filter(Boolean);
    }

    const whereDev = devCreatedField ? { [devCreatedField]: { lt: end } } : undefined;

    // group by device key
    const grouped = await p[userDevice.delegateKey].groupBy({
      by: [devKeyField],
      where: whereDev,
      _count: { _all: true },
    }).catch(() => []);

    // clinicians with any device
    let cliniciansWithDevice = 0;
    if (clinicianIds.length) {
      // count distinct clinicians among devices (may be heavy; do in 2 steps)
      const distinct = await p[userDevice.delegateKey].findMany({
        where: { ...(whereDev || {}), [devUserIdField]: { in: clinicianIds } },
        select: { [devUserIdField]: true },
        distinct: [devUserIdField],
      }).catch(() => []);
      cliniciansWithDevice = (distinct || []).length;
      deviceAdoptionRatePct = clinicianIds.length ? (cliniciansWithDevice / clinicianIds.length) * 100 : 0;
    } else {
      // fallback: cannot compute denominator
      warnings.push('Could not derive clinician id list for device adoption denominator; deviceAdoptionRatePct=0.');
      partial = true;
      deviceAdoptionRatePct = 0;
    }

    // per-device cliniciansWithDevice (best-effort; may be heavy so we do a capped query per top keys)
    const topKeys = (grouped || [])
      .map((g: any) => String(g?.[devKeyField] ?? 'unknown'))
      .filter(Boolean)
      .slice(0, 12);

    const perKeyClinicians: Record<string, number> = {};
    for (const k of topKeys) {
      if (!clinicianIds.length) {
        perKeyClinicians[k] = 0;
        continue;
      }
      const distinct = await p[userDevice.delegateKey].findMany({
        where: { ...(whereDev || {}), [devKeyField]: k, [devUserIdField]: { in: clinicianIds } },
        select: { [devUserIdField]: true },
        distinct: [devUserIdField],
      }).catch(() => []);
      perKeyClinicians[k] = (distinct || []).length;
    }

    const denom = clinicianIds.length || 1;

    deviceMix = (grouped || [])
      .map((g: any) => {
        const key = String(g?.[devKeyField] ?? 'unknown');
        const devices = asNumber(g?._count?._all);
        const cWith = perKeyClinicians[key] ?? 0;
        return {
          deviceKey: key,
          devices,
          cliniciansWithDevice: cWith,
          shareCliniciansPct: (cWith / denom) * 100,
        };
      })
      .sort((a: any, b: any) => b.cliniciansWithDevice - a.cliniciansWithDevice)
      .slice(0, 20);
  } else if (userDevice) {
    warnings.push('UserDevice model detected but deviceKey/userId fields not detected; device metrics limited.');
    partial = true;
  }

  // ---------------- Trends (bucketed)
  const buckets = buildBuckets(rangeKey, start, end);
  const labels = buckets.map((b) => b.label);

  const series: Record<string, number[]> = {
    totalAppointmentsBooked: [],
    totalConsultsCompleted: [],
    noShowRatePct: [],
    grossRevenueCents: [],
    platformFeesCents: [],
    deviceAdoptionRatePct: [],
  };

  // fill device adoption as flat series (unless you later model adoption over time)
  for (let i = 0; i < buckets.length; i++) series.deviceAdoptionRatePct.push(deviceAdoptionRatePct);

  // appointment bucket queries (real where possible)
  if (appointment && apSchedField && apStatusField) {
    for (const b of buckets) {
      const w = { [apSchedField]: { gte: b.s, lt: b.e } };
      const booked = await p[appointment.delegateKey].count({ where: w }).catch(() => 0);
      const completed = await p[appointment.delegateKey].count({
        where: { ...w, [apStatusField]: { in: ['completed', 'done', 'fulfilled'] } },
      }).catch(() => 0);
      const noshow = await p[appointment.delegateKey].count({
        where: { ...w, [apStatusField]: { in: ['no_show', 'noshow', 'noShow', 'missed'] } },
      }).catch(() => 0);

      series.totalAppointmentsBooked.push(booked);
      series.totalConsultsCompleted.push(completed);
      series.noShowRatePct.push(booked ? (noshow / booked) * 100 : 0);
    }
  } else {
    // stable zeros
    for (let i = 0; i < buckets.length; i++) {
      series.totalAppointmentsBooked.push(0);
      series.totalConsultsCompleted.push(0);
      series.noShowRatePct.push(0);
    }
  }

  // payment bucket queries (real where possible)
  if (payment && payCreatedField) {
    for (const b of buckets) {
      const w = { [payCreatedField]: { gte: b.s, lt: b.e } };
      const agg = await p[payment.delegateKey].aggregate({
        where: w,
        _sum: {
          ...(payAmountField ? { [payAmountField]: true } : {}),
          ...(payPlatformFeeField ? { [payPlatformFeeField]: true } : {}),
        },
      }).catch(() => null);

      series.grossRevenueCents.push(payAmountField ? asNumber(agg?._sum?.[payAmountField]) : 0);
      series.platformFeesCents.push(payPlatformFeeField ? asNumber(agg?._sum?.[payPlatformFeeField]) : 0);
    }
  } else {
    for (let i = 0; i < buckets.length; i++) {
      series.grossRevenueCents.push(0);
      series.platformFeesCents.push(0);
    }
  }

  const trends: TrendsPayload = { labels, series };

  // ---------------- Build KPI object
  const kpis: ClinicianKpis = {
    totalClinicians,
    activeClinicians,
    newClinicians,
    onboardingInProgress,

    avgTimeToFirstConsultDays,
    avgClinicianOnTimeJoinRatePct,
    avgPatientOnTimeJoinRatePct,
    avgOverrunRatePct,
    churnRatePct,

    totalAppointmentsBooked,
    totalConsultsCompleted,
    totalConsultationMinutes,

    onlineNow,
    activeSeen7d,
    activeSeen30d,
    medianTrainingHours,
    noShowRatePct,

    grossRevenueCents,
    platformFeesCents,
    clinicianTakeCents,

    deviceAdoptionRatePct,
  };

  return {
    kpis,
    paymentMix,
    deviceMix,
    punctualityBucketsClinician,
    punctualityBucketsPatient,
    overrunBuckets,
    lateClinicians,
    trends,
    partial,
  };
}

/* ------------------- Route handler ------------------- */

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const rangeKey = parseRange(url.searchParams.get('range'));
  const compare = (url.searchParams.get('compare') || '').toLowerCase(); // "prev" or ""

  const now = new Date();
  const { start, end } = rangeWindow(now, rangeKey);

  const warnings: string[] = [];

  const curr = await computeForWindow({ start, end, rangeKey, warnings });

  let compareBlock: ClinicianAnalyticsPayload['compare'] = null;
  if (compare === 'prev') {
    const prev = prevWindow(start, end, rangeKey);
    const prevResult = await computeForWindow({ start: prev.start, end: prev.end, rangeKey, warnings });
    compareBlock = {
      key: 'prev',
      startISO: prev.start.toISOString(),
      endISO: prev.end.toISOString(),
      kpis: prevResult.kpis,
    };
  }

  // keep existing sections present (safe empties for now if your schema differs)
  const payload: ClinicianAnalyticsPayload = {
    range: { key: rangeKey, startISO: start.toISOString(), endISO: end.toISOString() },
    compare: compareBlock,

    kpis: curr.kpis,

    punctualityBucketsClinician: curr.punctualityBucketsClinician ?? [],
    punctualityBucketsPatient: curr.punctualityBucketsPatient ?? [],
    overrunBuckets: curr.overrunBuckets ?? [],
    onboardingStages: [], // you can wire to your exact onboarding stage model later
    plans: [], // wire later
    deactivations: [], // wire later
    lateClinicians: curr.lateClinicians ?? [],

    paymentMix: curr.paymentMix ?? [],
    deviceMix: curr.deviceMix ?? [],

    trends: curr.trends,

    meta: { ok: true, partial: curr.partial || Boolean(warnings.length), warnings },
  };

  return NextResponse.json(payload, { status: 200 });
}
