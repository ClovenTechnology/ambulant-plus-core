// apps/api-gateway/app/api/analytics/practice/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { type PlanTier, getViewerPlanTier } from '@/lib/planTier';

type RangeKey = '30d' | '90d' | '12m';

type TeamRoleKey =
  | 'clinician'
  | 'admin_medical'
  | 'admin_non_medical'
  | 'nurse'
  | 'assistant'
  | 'other';

type TeamKpis = {
  totalStaff: number;
  clinicians: number;
  activeClinicians: number;
  adminStaff: number;
  nurses: number;

  totalSessionsRange: number;
  totalConsultationMinutesRange: number;
  totalPatientsRange: number;

  avgClinicianOnTimeJoinRatePct: number;
  avgOverrunRatePct: number;
};

type RoleBreakdownRow = {
  role: TeamRoleKey;
  label: string;
  headcount: number;
  active: number;
  sessions: number;
  sharePct: number;
};

type BucketRow = {
  label: string;
  sessions: number;
  sharePct: number;
};

type TeamMemberRow = {
  memberId: string;
  name: string;
  roleLabel: string;
  classLabel?: string | null;
  planTier: PlanTier;
  sessions: number;
  consultationMinutes: number;
  onTimeJoinRatePct: number;
  overrunRatePct: number;
  avgRating?: number | null;
  lastActiveAt?: string | null;
  isClinician: boolean;
};

export type TeamAnalyticsPayload = {
  planTier: PlanTier; // viewer tier
  practiceName: string;
  practiceId?: string | null;

  kpis: TeamKpis;
  roleBreakdown: RoleBreakdownRow[];
  punctualityBucketsClinician: BucketRow[];
  overrunBuckets: BucketRow[];
  members: TeamMemberRow[];
};

function buildDemoTeamAnalytics(
  planTier: PlanTier,
  practiceName: string,
  practiceId: string | null,
): TeamAnalyticsPayload {
  return {
    planTier,
    practiceName,
    practiceId,
    kpis: {
      totalStaff: 12,
      clinicians: 5,
      activeClinicians: 4,
      adminStaff: 4,
      nurses: 3,
      totalSessionsRange: 420,
      totalConsultationMinutesRange: 9800,
      totalPatientsRange: 320,
      avgClinicianOnTimeJoinRatePct: 81,
      avgOverrunRatePct: 23,
    },
    roleBreakdown: [
      { role: 'clinician', label: 'Clinicians', headcount: 5, active: 4, sessions: 310, sharePct: 74 },
      { role: 'nurse', label: 'Nurses', headcount: 3, active: 3, sessions: 60, sharePct: 14 },
      { role: 'admin_medical', label: 'Medical admin', headcount: 2, active: 2, sessions: 30, sharePct: 7 },
      { role: 'admin_non_medical', label: 'Non-medical admin', headcount: 2, active: 2, sessions: 20, sharePct: 5 },
    ],
    punctualityBucketsClinician: [
      { label: 'On time (≤ grace)', sessions: 280, sharePct: 67 },
      { label: '0–5 min late', sessions: 90, sharePct: 21 },
      { label: '5–10 min late', sessions: 35, sharePct: 8 },
      { label: '>10 min late', sessions: 15, sharePct: 4 },
    ],
    overrunBuckets: [
      { label: 'On time / early', sessions: 220, sharePct: 52 },
      { label: '0–25% over', sessions: 120, sharePct: 29 },
      { label: '25–50% over', sessions: 50, sharePct: 12 },
      { label: '>50% over', sessions: 30, sharePct: 7 },
    ],
    members: [
      {
        memberId: 'cln-001',
        name: 'Dr N. Naidoo',
        roleLabel: 'Clinician',
        classLabel: 'Class A — Doctors',
        planTier: 'host',
        sessions: 160,
        consultationMinutes: 4200,
        onTimeJoinRatePct: 82,
        overrunRatePct: 28,
        avgRating: 4.7,
        lastActiveAt: new Date().toISOString(),
        isClinician: true,
      },
      {
        memberId: 'cln-002',
        name: 'Dr P. Mbele',
        roleLabel: 'Clinician',
        classLabel: 'Class B — Allied',
        planTier: 'host',
        sessions: 95,
        consultationMinutes: 2400,
        onTimeJoinRatePct: 78,
        overrunRatePct: 21,
        avgRating: 4.4,
        lastActiveAt: new Date().toISOString(),
        isClinician: true,
      },
      {
        memberId: 'nurse-01',
        name: 'Nurse Khumalo',
        roleLabel: 'Nurse',
        classLabel: null,
        planTier: 'host',
        sessions: 60,
        consultationMinutes: 1200,
        onTimeJoinRatePct: 84,
        overrunRatePct: 15,
        avgRating: null,
        lastActiveAt: new Date().toISOString(),
        isClinician: false,
      },
      {
        memberId: 'admin-01',
        name: 'Thandi (Medical admin)',
        roleLabel: 'Medical admin',
        classLabel: null,
        planTier: 'host',
        sessions: 30,
        consultationMinutes: 0,
        onTimeJoinRatePct: 0,
        overrunRatePct: 0,
        avgRating: null,
        lastActiveAt: new Date().toISOString(),
        isClinician: false,
      },
    ],
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const rangeParam = (url.searchParams.get('range') as RangeKey | null) ?? '90d';
  const range: RangeKey = ['30d', '90d', '12m'].includes(rangeParam) ? rangeParam : '90d';

  try {
    const viewer = await getViewerPlanTier(req);
    const payload = buildDemoTeamAnalytics(viewer.planTier, viewer.practiceName, viewer.practiceId);

    return NextResponse.json({ ...payload, _range: range }, { status: 200 });
  } catch (e: any) {
    console.error('[analytics/practice] GET error', e);

    const fallbackViewer = await getViewerPlanTier(req).catch(() => ({
      planTier: 'host' as PlanTier,
      practiceName: 'Demo Virtual Practice',
      practiceId: 'prac-demo-001',
      clinicianId: 'clin-demo-host',
      planId: 'team' as const,
    }));

    const payload = buildDemoTeamAnalytics(
      fallbackViewer.planTier,
      fallbackViewer.practiceName,
      fallbackViewer.practiceId,
    );

    return NextResponse.json(
      {
        ...payload,
        _range: '90d' as RangeKey,
        _warning: 'Using demo practice analytics payload (real aggregation not wired yet).',
      },
      { status: 200 },
    );
  }
}
