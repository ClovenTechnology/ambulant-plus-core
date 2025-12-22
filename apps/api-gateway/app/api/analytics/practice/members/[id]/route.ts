// apps/api-gateway/app/api/analytics/practice/members/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  type PlanTier,
  getViewerPlanTier,
} from '@/lib/planTier';

type RangeKey = '30d' | '90d' | '12m';

type BucketRow = {
  label: string;
  sessions: number;
  sharePct: number;
};

type MemberKpis = {
  totalTelevisits: number;
  totalInPerson: number;
  totalPatients: number;
  newPatients: number;
  repeatRatePct: number;

  clinicianOnTimeJoinRatePct: number;
  patientOnTimeJoinRatePct: number;
  avgClinicianJoinDelayMin: number;

  overrunRatePct: number;
  avgOverrunMin: number;

  cancellations: number;
  noShows: number;
};

type MemberLifecycleSummary = {
  starterKitShippedAt?: string | null;
  firstShiftAt?: string | null;
  firstConsultAt?: string | null;

  totalCompletedSessions: number;
  totalConsultationMinutes: number;

  totalEarningsCents?: number | null;
  avgMonthlyEarningsCents?: number | null;
  totalPayThisMonthCents?: number | null;

  avgWorkDaysPerMonth: number;
  avgWorkHoursPerMonth: number;
  avgWorkHoursPerDay: number;
  totalWorkDaysInRange: number;
  totalWorkDaysThisMonth: number;

  avgPatientsPerMonth: number;
  totalPatientsThisMonth: number;
};

type MemberBadgeCounters = {
  topRated: boolean;
  avgRating?: number | null;
  ratingsCount?: number | null;

  suspendedCount: number;
  disciplinaryCount: number;
  inactiveCount: number;
};

type MemberSessionPoint = {
  bucket: string; // e.g. 'Jan', '2025-01', etc.
  sessions: number;
  clinicianOnTimeJoinRatePct: number;
  overrunRatePct: number;
  revenueCents?: number | null;
};

export type TeamMemberAnalyticsPayload = {
  viewerPlanTier: PlanTier;
  practiceName: string;

  memberId: string;
  name: string;
  roleLabel: string;
  isClinician: boolean;
  classLabel?: string | null;

  planTier: PlanTier;
  status?: string | null;

  kpis: MemberKpis;
  lifecycleSummary: MemberLifecycleSummary;
  badgeCounters: MemberBadgeCounters;

  punctualityBucketsClinician: BucketRow[];
  punctualityBucketsPatient: BucketRow[];
  overrunBuckets: BucketRow[];

  timeSeries: MemberSessionPoint[];
};

/* ---------- Demo builder (swap for real DB lookup later) ---------- */

function buildDemoMemberAnalytics(
  viewerTier: PlanTier,
  practiceName: string,
  memberId: string,
): TeamMemberAnalyticsPayload {
  return {
    viewerPlanTier: viewerTier,
    practiceName,
    memberId,
    name: 'Dr N. Naidoo',
    roleLabel: 'Clinician',
    isClinician: true,
    classLabel: 'Class A — Doctors',
    planTier: 'host',
    status: 'active',
    kpis: {
      totalTelevisits: 120,
      totalInPerson: 20,
      totalPatients: 140,
      newPatients: 35,
      repeatRatePct: 75,
      clinicianOnTimeJoinRatePct: 84,
      patientOnTimeJoinRatePct: 79,
      avgClinicianJoinDelayMin: 3.8,
      overrunRatePct: 27,
      avgOverrunMin: 5.9,
      cancellations: 4,
      noShows: 3,
    },
    lifecycleSummary: {
      starterKitShippedAt: new Date().toISOString(),
      firstShiftAt: new Date().toISOString(),
      firstConsultAt: new Date().toISOString(),
      totalCompletedSessions: 140,
      totalConsultationMinutes: 3200,
      totalEarningsCents: 910_000,
      avgMonthlyEarningsCents: 455_000,
      totalPayThisMonthCents: 230_000,
      avgWorkDaysPerMonth: 14.5,
      avgWorkHoursPerMonth: 58,
      avgWorkHoursPerDay: 4.0,
      totalWorkDaysInRange: 26,
      totalWorkDaysThisMonth: 9,
      avgPatientsPerMonth: 45,
      totalPatientsThisMonth: 20,
    },
    badgeCounters: {
      topRated: true,
      avgRating: 4.8,
      ratingsCount: 95,
      suspendedCount: 0,
      disciplinaryCount: 0,
      inactiveCount: 0,
    },
    punctualityBucketsClinician: [
      { label: 'On time (≤ grace)', sessions: 90, sharePct: 70 },
      { label: '0–5 min late', sessions: 24, sharePct: 19 },
      { label: '5–10 min late', sessions: 10, sharePct: 8 },
      { label: '>10 min late', sessions: 4, sharePct: 3 },
    ],
    punctualityBucketsPatient: [
      { label: 'On time (≤ grace)', sessions: 92, sharePct: 72 },
      { label: '0–5 min late', sessions: 20, sharePct: 16 },
      { label: '5–10 min late', sessions: 9, sharePct: 7 },
      { label: '>10 min late', sessions: 6, sharePct: 5 },
    ],
    overrunBuckets: [
      { label: 'On time / early', sessions: 70, sharePct: 50 },
      { label: '0–25% over', sessions: 40, sharePct: 29 },
      { label: '25–50% over', sessions: 20, sharePct: 14 },
      { label: '>50% over', sessions: 10, sharePct: 7 },
    ],
    timeSeries: [
      {
        bucket: 'Jan',
        sessions: 20,
        clinicianOnTimeJoinRatePct: 80,
        overrunRatePct: 30,
        revenueCents: 120_000,
      },
      {
        bucket: 'Feb',
        sessions: 24,
        clinicianOnTimeJoinRatePct: 82,
        overrunRatePct: 28,
        revenueCents: 150_000,
      },
      {
        bucket: 'Mar',
        sessions: 28,
        clinicianOnTimeJoinRatePct: 83,
        overrunRatePct: 26,
        revenueCents: 160_000,
      },
      {
        bucket: 'Apr',
        sessions: 30,
        clinicianOnTimeJoinRatePct: 85,
        overrunRatePct: 25,
        revenueCents: 180_000,
      },
    ],
  };
}

/* ---------- GET /api/analytics/practice/members/[id] ---------- */

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  const memberId = ctx.params?.id;
  const url = new URL(req.url);
  const rangeParam = (url.searchParams.get('range') as RangeKey | null) ?? '90d';
  const range: RangeKey = ['30d', '90d', '12m'].includes(rangeParam)
    ? rangeParam
    : '90d';

  if (!memberId) {
    return NextResponse.json(
      { error: 'Missing member id' },
      { status: 400 },
    );
  }

  try {
    const viewer = await getViewerPlanTier(req);

    // TODO:
    // - Check that memberId belongs to viewer.practiceId
    // - Authorise based on viewer.planTier (e.g. only host can see others)
    // - Replace demo builder with real aggregates per member+range.
    const payload = buildDemoMemberAnalytics(
      viewer.planTier,
      viewer.practiceName,
      memberId,
    );

    return NextResponse.json(
      {
        ...payload,
        _range: range,
      },
      { status: 200 },
    );
  } catch (e: any) {
    console.error('[analytics/practice/members/:id] GET error', e);
    const fallbackViewer = await getViewerPlanTier(req).catch(() => ({
      planTier: 'host' as PlanTier,
      practiceName: 'Demo Virtual Practice',
      practiceId: 'prac-demo-001',
      clinicianId: 'clin-demo-host',
      planId: 'team' as const,
    }));
    const payload = buildDemoMemberAnalytics(
      fallbackViewer.planTier,
      fallbackViewer.practiceName,
      memberId,
    );
    return NextResponse.json(
      {
        ...payload,
        _range: '90d' as RangeKey,
        _warning:
          'Using demo member analytics payload (real aggregation not wired yet).',
      },
      { status: 200 },
    );
  }
}
