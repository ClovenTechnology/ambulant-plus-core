// apps/admin-dashboard/lib/analytics/patientEngagementTypes.ts

/* ------------ Core enums / aliases ------------ */

export type PlanTier = 'free' | 'premium' | 'enterprise' | 'unknown';

export type Gender = 'male' | 'female' | 'other' | 'unknown';

export type AgeBand =
  | '0-12'
  | '13-17'
  | '18-24'
  | '25-34'
  | '35-44'
  | '45-54'
  | '55-64'
  | '65+'
  | 'unknown';

export type RegionLevel = 'country' | 'province' | 'city';

/* ------------ High-level summary ------------ */

export interface PatientEngagementSummary {
  // population
  totalPatients: number;
  totalVerifiedPatients: number;
  totalPremiumPatients: number;
  totalFreePatients: number;

  // engagement window
  activePatients30d: number;
  activePatients90d: number;
  dau7dAvg: number; // average daily active in last 7d
  wau4wAvg: number; // average weekly active in last 4w

  // retention / churn (as proportions 0..1)
  retention30d: number;
  retention90d: number;
  churnRate90d: number;

  // behaviour
  avgSessionsPerActive30d: number;
  medianSessionsPerActive30d: number;
  avgMinutesPerActive30d: number;

  // conversion / monetisation
  activationRate: number; // registered → verified → first consult / first order
  firstConsultConversionRate: number;
  firstOrderConversionRate: number;
  avgRevenuePerActive30d: number; // ARPA for last 30d
  avgRevenuePerPatientLTV: number; // lifetime to date

  // adherence / clinical-ish
  avgMedicationAdherenceScore: number; // 0..1
  highRiskNonAdherentShare: number; // 0..1
}

/* ------------ Plan & revenue breakdown ------------ */

export interface PlanEngagementSnapshot {
  plan: PlanTier;
  label: string; // e.g. "Free", "Premium", "Enterprise"
  activePatients30d: number;
  activePatients90d: number;
  newPatients30d: number;
  churnedPatients90d: number;
  avgSessionsPerActive30d: number;
  avgMinutesPerActive30d: number;
  avgRevenuePerActive30d: number;
  totalRevenue30d: number;
  medicationAdherenceScore: number; // 0..1
}

/* ------------ Activation funnel ------------ */

export interface ActivationFunnelStage {
  key:
    | 'registered'
    | 'verified'
    | 'first_consult'
    | 'first_order'
    | 'repeat_consult'
    | 'repeat_order';
  label: string;
  count: number;
  conversionFromPrevious: number; // 0..1
}

/* ------------ Cohort retention ------------ */

export interface RetentionCohortRow {
  cohortKey: string; // e.g. "2025-W42" or "2025-10"
  cohortLabel: string; // human-friendly label
  cohortSize: number;

  // percentages 0..1 for day/week/month buckets
  d7Retained: number;
  d30Retained: number;
  d60Retained: number;
  d90Retained: number;
}

/* ------------ Feature usage ------------ */

export interface FeatureUsageItem {
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
  // 0..1: proportion of active patients in last 30 days who used this feature
  penetrationActive30d: number;
}

/* ------------ IoMT usage ------------ */

export interface DeviceUsageItem {
  deviceSlug: string; // e.g. "nexring", "hc-03", "hc-21"
  label: string; // human readable
  modality: string; // e.g. "ring", "health-monitor", "stethoscope"
  activeUsers30d: number;
  measurements30d: number;
  avgMeasurementsPerUser30d: number;
  // 0..1: proportion of active patients with this device bound
  penetrationActive30d: number;
}

/* ------------ Medication adherence ------------ */

export interface AdherenceBucket {
  bucketKey: 'high' | 'medium' | 'low' | 'unknown';
  label: string;
  patients: number;
  avgScore: number; // 0..1
}

export interface MedicationAdherenceStats {
  buckets: AdherenceBucket[];
  avgScoreOverall: number;
  avgScorePremium: number;
  avgScoreFree: number;
  // e.g. share of high-risk chronic patients who are low-adherent (0..1)
  highRiskLowAdherentShare: number;
}

/* ------------ Demographic & regional segments ------------ */

export interface GeoRegion {
  regionCode: string; // e.g. "ZA-GP"
  regionName: string; // e.g. "Gauteng"
  level: RegionLevel;
}

export interface SegmentKey {
  ageBand: AgeBand;
  gender: Gender;
  plan: PlanTier;
  regionCode?: string; // optional, if applicable
}

export interface EngagementSegmentMetrics {
  // engagement
  activePatients30d: number;
  sessionsPerActive30d: number;
  minutesPerActive30d: number;
  consultsPerActive30d: number;

  // lifestyle metrics (example from NexRing + others)
  avgDailySteps: number;
  avgDailyCalories: number;
  avgSleepHours: number;

  // monetisation
  avgRevenuePerActive30d: number;

  // adherence
  medicationAdherenceScore: number; // 0..1
}

export interface SegmentRow {
  key: SegmentKey;
  metrics: EngagementSegmentMetrics;
}

export interface StepsAndCaloriesAggregate {
  segmentKey: SegmentKey;
  avgDailySteps: number;
  avgDailyCalories: number;
  sampleSize: number;
}

/* ------------ Aggregate “Patient Engagement” payload ------------ */

export interface PatientEngagementPayload {
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

/* ------------ API envelope ------------ */

export interface PatientEngagementApiResponse {
  ok: boolean;
  asAt: string; // ISO timestamp
  range: '30d' | '90d' | '180d' | '365d';
  data: PatientEngagementPayload;
}
