// apps/api-gateway/app/api/admin/analytics/patient-engagement/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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
  retention30d: number;
  retention90d: number;
  churnRate90d: number;
  avgSessionsPerActive30d: number;
  medianSessionsPerActive30d: number;
  avgMinutesPerActive30d: number;
  activationRate: number;
  firstConsultConversionRate: number;
  firstOrderConversionRate: number;
  avgRevenuePerActive30d: number;
  avgRevenuePerPatientLTV: number;
  avgMedicationAdherenceScore: number;
  highRiskNonAdherentShare: number;
}

interface PlanEngagementSnapshot {
  plan: PlanTier;
  label: string;
  activePatients30d: number;
  activePatients90d: number;
  newPatients30d: number;
  churnedPatients90d: number;
  avgSessionsPerActive30d: number;
  avgMinutesPerActive30d: number;
  avgRevenuePerActive30d: number;
  totalRevenue30d: number;
  medicationAdherenceScore: number;
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
  d7Retained: number;
  d30Retained: number;
  d60Retained: number;
  d90Retained: number;
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
  avgScore: number;
}

interface MedicationAdherenceStats {
  buckets: AdherenceBucket[];
  avgScoreOverall: number;
  avgScorePremium: number;
  avgScoreFree: number;
  highRiskLowAdherentShare: number;
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
  adherence: MedicationAdherenceStats;
  segments: SegmentRow[];
  stepsAndCalories: StepsAndCaloriesAggregate[];
}

interface PatientEngagementApiResponse {
  ok: boolean;
  asAt: string;
  range: RangeKey;
  data: PatientEngagementPayload;
}

/* ---------------- Mock data helpers ---------------- */

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function buildSummary(range: RangeKey): PatientEngagementSummary {
  const totalPatients = 12000;
  const totalVerifiedPatients = 9800;
  const totalPremiumPatients = 4200;
  const totalFreePatients = 7800;

  const activeFactor =
    range === '30d' ? 0.45 : range === '90d' ? 0.6 : range === '180d' ? 0.7 : 0.8;

  const active30d = Math.round(totalPatients * 0.45);
  const active90d = Math.round(totalPatients * activeFactor);

  return {
    totalPatients,
    totalVerifiedPatients,
    totalPremiumPatients,
    totalFreePatients,
    activePatients30d: active30d,
    activePatients90d: active90d,
    dau7dAvg: Math.round(active30d * 0.35),
    wau4wAvg: Math.round(active30d * 0.75),
    retention30d: 0.72,
    retention90d: 0.61,
    churnRate90d: 0.18,
    avgSessionsPerActive30d: 4.6,
    medianSessionsPerActive30d: 3.1,
    avgMinutesPerActive30d: 27.5,
    activationRate: 0.81,
    firstConsultConversionRate: 0.67,
    firstOrderConversionRate: 0.54,
    avgRevenuePerActive30d: 210.75,
    avgRevenuePerPatientLTV: 1243.4,
    avgMedicationAdherenceScore: 0.79,
    highRiskNonAdherentShare: 0.16,
  };
}

function buildPlanSnapshots(): PlanEngagementSnapshot[] {
  return [
    {
      plan: 'free',
      label: 'Free',
      activePatients30d: 4200,
      activePatients90d: 6100,
      newPatients30d: 840,
      churnedPatients90d: 950,
      avgSessionsPerActive30d: 3.4,
      avgMinutesPerActive30d: 19.2,
      avgRevenuePerActive30d: 42.15,
      totalRevenue30d: 177030,
      medicationAdherenceScore: 0.73,
    },
    {
      plan: 'premium',
      label: 'Premium',
      activePatients30d: 3100,
      activePatients90d: 3900,
      newPatients30d: 620,
      churnedPatients90d: 410,
      avgSessionsPerActive30d: 5.8,
      avgMinutesPerActive30d: 34.6,
      avgRevenuePerActive30d: 389.9,
      totalRevenue30d: 1208690,
      medicationAdherenceScore: 0.84,
    },
    {
      plan: 'enterprise',
      label: 'Enterprise',
      activePatients30d: 680,
      activePatients90d: 920,
      newPatients30d: 120,
      churnedPatients90d: 65,
      avgSessionsPerActive30d: 6.2,
      avgMinutesPerActive30d: 38.4,
      avgRevenuePerActive30d: 512.4,
      totalRevenue30d: 348432,
      medicationAdherenceScore: 0.88,
    },
    {
      plan: 'unknown',
      label: 'Unknown',
      activePatients30d: 120,
      activePatients90d: 190,
      newPatients30d: 25,
      churnedPatients90d: 18,
      avgSessionsPerActive30d: 2.1,
      avgMinutesPerActive30d: 10.3,
      avgRevenuePerActive30d: 0,
      totalRevenue30d: 0,
      medicationAdherenceScore: 0.5,
    },
  ];
}

function buildFunnel(summary: PatientEngagementSummary): ActivationFunnelStage[] {
  const registered = summary.totalPatients;
  const verified = Math.round(registered * summary.activationRate);
  const firstConsult = Math.round(verified * summary.firstConsultConversionRate);
  const firstOrder = Math.round(firstConsult * summary.firstOrderConversionRate);
  const repeatConsult = Math.round(firstConsult * 0.62);
  const repeatOrder = Math.round(firstOrder * 0.58);

  const computeConv = (current: number, prev: number) =>
    prev === 0 ? 0 : clamp01(current / prev);

  return [
    {
      key: 'registered',
      label: 'Registered',
      count: registered,
      conversionFromPrevious: 1,
    },
    {
      key: 'verified',
      label: 'Verified accounts',
      count: verified,
      conversionFromPrevious: computeConv(verified, registered),
    },
    {
      key: 'first_consult',
      label: 'First consult',
      count: firstConsult,
      conversionFromPrevious: computeConv(firstConsult, verified),
    },
    {
      key: 'first_order',
      label: 'First CarePort / MedReach order',
      count: firstOrder,
      conversionFromPrevious: computeConv(firstOrder, firstConsult),
    },
    {
      key: 'repeat_consult',
      label: 'Repeat consult',
      count: repeatConsult,
      conversionFromPrevious: computeConv(repeatConsult, firstConsult),
    },
    {
      key: 'repeat_order',
      label: 'Repeat order',
      count: repeatOrder,
      conversionFromPrevious: computeConv(repeatOrder, firstOrder),
    },
  ];
}

function buildCohorts(): RetentionCohortRow[] {
  return [
    { cohortKey: '2025-06', cohortLabel: 'Jun 2025 signups', cohortSize: 2100, d7Retained: 0.78, d30Retained: 0.69, d60Retained: 0.63, d90Retained: 0.58 },
    { cohortKey: '2025-07', cohortLabel: 'Jul 2025 signups', cohortSize: 1950, d7Retained: 0.76, d30Retained: 0.68, d60Retained: 0.61, d90Retained: 0.55 },
    { cohortKey: '2025-08', cohortLabel: 'Aug 2025 signups', cohortSize: 2300, d7Retained: 0.79, d30Retained: 0.7, d60Retained: 0.64, d90Retained: 0.59 },
    { cohortKey: '2025-09', cohortLabel: 'Sep 2025 signups', cohortSize: 1880, d7Retained: 0.75, d30Retained: 0.67, d60Retained: 0.6, d90Retained: 0.54 },
    { cohortKey: '2025-10', cohortLabel: 'Oct 2025 signups', cohortSize: 2400, d7Retained: 0.8, d30Retained: 0.72, d60Retained: 0.66, d90Retained: 0.6 },
    { cohortKey: '2025-11', cohortLabel: 'Nov 2025 signups', cohortSize: 2160, d7Retained: 0.77, d30Retained: 0.7, d60Retained: 0.63, d90Retained: 0.57 },
  ];
}

function buildFeatureUsage(summary: PatientEngagementSummary): FeatureUsageItem[] {
  const active = summary.activePatients30d;
  return [
    { key: 'consult_video', label: 'Video consults', dailyActiveUsers: Math.round(active * 0.22), weeklyActiveUsers: Math.round(active * 0.47), monthlyActiveUsers: Math.round(active * 0.68), avgSessionsPerUser30d: 2.1, avgMinutesPerUser30d: 18.4, penetrationActive30d: 0.68 },
    { key: 'consult_chat', label: 'Chat consults', dailyActiveUsers: Math.round(active * 0.18), weeklyActiveUsers: Math.round(active * 0.39), monthlyActiveUsers: Math.round(active * 0.6), avgSessionsPerUser30d: 1.9, avgMinutesPerUser30d: 11.3, penetrationActive30d: 0.6 },
    { key: 'self_checks', label: 'Self-checks & symptom flows', dailyActiveUsers: Math.round(active * 0.14), weeklyActiveUsers: Math.round(active * 0.32), monthlyActiveUsers: Math.round(active * 0.54), avgSessionsPerUser30d: 2.7, avgMinutesPerUser30d: 9.1, penetrationActive30d: 0.54 },
    { key: 'medication_schedule', label: 'Medication schedule & reminders', dailyActiveUsers: Math.round(active * 0.16), weeklyActiveUsers: Math.round(active * 0.36), monthlyActiveUsers: Math.round(active * 0.55), avgSessionsPerUser30d: 4.2, avgMinutesPerUser30d: 12.5, penetrationActive30d: 0.55 },
    { key: 'vitals_dashboard', label: 'NexRing / vitals dashboard', dailyActiveUsers: Math.round(active * 0.21), weeklyActiveUsers: Math.round(active * 0.44), monthlyActiveUsers: Math.round(active * 0.63), avgSessionsPerUser30d: 5.1, avgMinutesPerUser30d: 16.8, penetrationActive30d: 0.63 },
    { key: 'erx_refill', label: 'eRx refills via CarePort', dailyActiveUsers: Math.round(active * 0.09), weeklyActiveUsers: Math.round(active * 0.24), monthlyActiveUsers: Math.round(active * 0.41), avgSessionsPerUser30d: 1.6, avgMinutesPerUser30d: 8.4, penetrationActive30d: 0.41 },
    { key: 'lab_results', label: 'Lab results (MedReach)', dailyActiveUsers: Math.round(active * 0.07), weeklyActiveUsers: Math.round(active * 0.19), monthlyActiveUsers: Math.round(active * 0.34), avgSessionsPerUser30d: 1.2, avgMinutesPerUser30d: 7.6, penetrationActive30d: 0.34 },
    { key: 'careplan_tasks', label: 'Care plan tasks', dailyActiveUsers: Math.round(active * 0.12), weeklyActiveUsers: Math.round(active * 0.29), monthlyActiveUsers: Math.round(active * 0.49), avgSessionsPerUser30d: 2.3, avgMinutesPerUser30d: 10.2, penetrationActive30d: 0.49 },
    { key: 'shop', label: 'Ambulant+ shop', dailyActiveUsers: Math.round(active * 0.05), weeklyActiveUsers: Math.round(active * 0.15), monthlyActiveUsers: Math.round(active * 0.28), avgSessionsPerUser30d: 1.3, avgMinutesPerUser30d: 6.3, penetrationActive30d: 0.28 },
    { key: 'rewards', label: 'Rewards & challenges', dailyActiveUsers: Math.round(active * 0.08), weeklyActiveUsers: Math.round(active * 0.21), monthlyActiveUsers: Math.round(active * 0.4), avgSessionsPerUser30d: 2.0, avgMinutesPerUser30d: 8.9, penetrationActive30d: 0.4 },
    { key: 'other', label: 'Other flows', dailyActiveUsers: Math.round(active * 0.03), weeklyActiveUsers: Math.round(active * 0.09), monthlyActiveUsers: Math.round(active * 0.16), avgSessionsPerUser30d: 1.1, avgMinutesPerUser30d: 4.2, penetrationActive30d: 0.16 },
  ];
}

function buildDevices(summary: PatientEngagementSummary): DeviceUsageItem[] {
  const active = summary.activePatients30d;
  return [
    { deviceSlug: 'nexring', label: 'NexRing smart ring', modality: 'ring', activeUsers30d: Math.round(active * 0.36), measurements30d: 36000, avgMeasurementsPerUser30d: 28.5, penetrationActive30d: 0.36 },
    { deviceSlug: 'hc-03', label: 'HC-03 Health Monitor', modality: 'health-monitor', activeUsers30d: Math.round(active * 0.24), measurements30d: 19800, avgMeasurementsPerUser30d: 23.7, penetrationActive30d: 0.24 },
    { deviceSlug: 'hc-21', label: 'HC-21 Digital Stethoscope', modality: 'stethoscope', activeUsers30d: Math.round(active * 0.11), measurements30d: 6900, avgMeasurementsPerUser30d: 17.2, penetrationActive30d: 0.11 },
    { deviceSlug: 'hc-41', label: 'HC-41 HD Otoscope', modality: 'otoscope', activeUsers30d: Math.round(active * 0.07), measurements30d: 3400, avgMeasurementsPerUser30d: 14.5, penetrationActive30d: 0.07 },
  ];
}

function buildAdherence(summary: PatientEngagementSummary): MedicationAdherenceStats {
  const total = summary.activePatients30d;

  const high = Math.round(total * 0.49);
  const medium = Math.round(total * 0.31);
  const low = Math.round(total * 0.16);
  const unknown = total - high - medium - low;

  return {
    buckets: [
      { bucketKey: 'high', label: 'High adherence (80–100%)', patients: high, avgScore: 0.9 },
      { bucketKey: 'medium', label: 'Medium adherence (50–79%)', patients: medium, avgScore: 0.66 },
      { bucketKey: 'low', label: 'Low adherence (< 50%)', patients: low, avgScore: 0.36 },
      { bucketKey: 'unknown', label: 'Unknown / insufficient data', patients: unknown, avgScore: 0.4 },
    ],
    avgScoreOverall: summary.avgMedicationAdherenceScore,
    avgScorePremium: 0.85,
    avgScoreFree: 0.74,
    highRiskLowAdherentShare: summary.highRiskNonAdherentShare,
  };
}

function segment(
  ageBand: AgeBand,
  gender: Gender,
  plan: PlanTier,
  activePatients30d: number,
  sessions: number,
  minutes: number,
  consults: number,
  steps: number,
  calories: number,
  sleep: number,
  revenue: number,
  adherenceScore: number,
): SegmentRow {
  return {
    key: { ageBand, gender, plan },
    metrics: {
      activePatients30d,
      sessionsPerActive30d: sessions,
      minutesPerActive30d: minutes,
      consultsPerActive30d: consults,
      avgDailySteps: steps,
      avgDailyCalories: calories,
      avgSleepHours: sleep,
      avgRevenuePerActive30d: revenue,
      medicationAdherenceScore: adherenceScore,
    },
  };
}

function stepsAgg(
  ageBand: AgeBand,
  gender: Gender,
  plan: PlanTier,
  steps: number,
  calories: number,
  sampleSize: number,
): StepsAndCaloriesAggregate {
  return {
    segmentKey: { ageBand, gender, plan },
    avgDailySteps: steps,
    avgDailyCalories: calories,
    sampleSize,
  };
}

function buildSegmentsAndLifestyle(): {
  segments: SegmentRow[];
  stepsAndCalories: StepsAndCaloriesAggregate[];
} {
  const segments: SegmentRow[] = [
    segment('18-24', 'female', 'free', 620, 4.1, 23.5, 1.3, 8100, 2150, 7.1, 120.3, 0.76),
    segment('25-34', 'female', 'premium', 740, 5.4, 32.8, 1.9, 9200, 2280, 7.2, 345.6, 0.84),
    segment('25-34', 'male', 'premium', 690, 5.1, 30.7, 1.8, 8800, 2410, 6.8, 332.1, 0.83),
    segment('35-44', 'female', 'premium', 540, 4.8, 29.2, 1.7, 8600, 2220, 7.3, 362.9, 0.86),
    segment('35-44', 'male', 'free', 580, 3.6, 21.1, 1.2, 7600, 2320, 6.6, 145.7, 0.71),
    segment('45-54', 'female', 'premium', 410, 4.9, 27.4, 1.6, 8300, 2180, 7.4, 351.4, 0.88),
    segment('55-64', 'female', 'free', 360, 3.2, 19.5, 1.0, 6900, 2070, 7.6, 112.3, 0.79),
    segment('65+', 'male', 'free', 280, 2.7, 17.3, 0.8, 6400, 1950, 7.8, 98.2, 0.77),
  ];

  const stepsAndCalories: StepsAndCaloriesAggregate[] = [
    stepsAgg('18-24', 'female', 'free', 8100, 2150, 430),
    stepsAgg('25-34', 'female', 'premium', 9200, 2280, 520),
    stepsAgg('25-34', 'male', 'premium', 8800, 2410, 480),
    stepsAgg('35-44', 'female', 'premium', 8600, 2220, 380),
    stepsAgg('35-44', 'male', 'free', 7600, 2320, 410),
    stepsAgg('45-54', 'female', 'premium', 8300, 2180, 300),
    stepsAgg('55-64', 'female', 'free', 6900, 2070, 260),
    stepsAgg('65+', 'male', 'free', 6400, 1950, 190),
  ];

  return { segments, stepsAndCalories };
}

/* ---------------- Route handler ---------------- */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rangeParam = url.searchParams.get('range') as RangeKey | null;
  const range: RangeKey =
    rangeParam === '30d' ||
    rangeParam === '90d' ||
    rangeParam === '180d' ||
    rangeParam === '365d'
      ? rangeParam
      : '90d';

  const summary = buildSummary(range);
  const planSnapshots = buildPlanSnapshots();
  const funnelStages = buildFunnel(summary);
  const retentionCohorts = buildCohorts();
  const featureUsage = buildFeatureUsage(summary);
  const deviceUsage = buildDevices(summary);
  const adherence = buildAdherence(summary);
  const { segments, stepsAndCalories } = buildSegmentsAndLifestyle();

  const payload: PatientEngagementPayload = {
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

  const response: PatientEngagementApiResponse = {
    ok: true,
    asAt: new Date().toISOString(),
    range,
    data: payload,
  };

  return NextResponse.json(response);
}
