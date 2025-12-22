// apps/clinician-app/app/analytics/team/[id]/page.tsx
'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type RangeKey = '30d' | '90d' | '12m';
type PlanTier = 'free' | 'basic' | 'pro' | 'host';

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
  bucket: string; // e.g. month
  sessions: number;
  clinicianOnTimeJoinRatePct: number;
  overrunRatePct: number;
  revenueCents?: number | null;
};

type TeamMemberAnalyticsPayload = {
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

/* ----------- Local mock for fallback ----------- */

const MOCK_MEMBER_ANALYTICS: TeamMemberAnalyticsPayload = {
  viewerPlanTier: 'host',
  practiceName: 'Demo Virtual Practice',
  memberId: 'cln-001',
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
    totalEarningsCents: 910000,
    avgMonthlyEarningsCents: 455000,
    totalPayThisMonthCents: 230000,
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
      revenueCents: 120000,
    },
    {
      bucket: 'Feb',
      sessions: 24,
      clinicianOnTimeJoinRatePct: 82,
      overrunRatePct: 28,
      revenueCents: 150000,
    },
    {
      bucket: 'Mar',
      sessions: 28,
      clinicianOnTimeJoinRatePct: 83,
      overrunRatePct: 26,
      revenueCents: 160000,
    },
    {
      bucket: 'Apr',
      sessions: 30,
      clinicianOnTimeJoinRatePct: 85,
      overrunRatePct: 25,
      revenueCents: 180000,
    },
  ],
};

/* ----------- Small UI bits ----------- */

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-white p-3 shadow-sm space-y-1">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="text-lg font-semibold text-gray-900">{value}</div>
      {helper && <div className="text-[11px] text-gray-500">{helper}</div>}
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
      {children}
    </span>
  );
}

function BucketStrip({ rows }: { rows: BucketRow[] }) {
  const total = rows.reduce((sum, r) => sum + r.sessions, 0);
  return (
    <div className="space-y-1 text-[11px]">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-gray-100">
        {rows.map((r) => (
          <div
            key={r.label}
            className="h-2"
            style={{
              width: `${total ? (r.sessions / total) * 100 : 0}%`,
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-1 text-gray-600">
            <span className="inline-block h-2 w-2 rounded-full bg-gray-800" />
            <span>{r.label}</span>
            <span className="text-gray-400">({r.sharePct.toFixed(1)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RangeToggle({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (v: RangeKey) => void;
}) {
  const options: { key: RangeKey; label: string }[] = [
    { key: '30d', label: 'Last 30 days' },
    { key: '90d', label: 'Last 90 days' },
    { key: '12m', label: 'Last 12 months' },
  ];
  return (
    <div className="inline-flex rounded-full border bg-white p-0.5 text-[11px] shadow-sm">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={
              'rounded-full px-3 py-1 ' +
              (active
                ? 'bg-gray-900 text-white'
                : 'text-gray-700 hover:bg-gray-100')
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Simple inline sparkline.
 * If you want to use your shared <Sparkline> instead, you can:
 *   - import Sparkline from '@/components/charts/Sparkline'
 *   - replace <SparklineMini ... /> with <Sparkline values={values} ... />
 */
function SparklineMini({
  values,
  className,
}: {
  values: number[];
  className?: string;
}) {
  if (!values.length) {
    return (
      <div className={className ?? ''}>
        <div className="h-10 w-full rounded-md bg-gray-50 text-[11px] text-gray-400 flex items-center justify-center">
          No data for range
        </div>
      </div>
    );
  }

  const width = 120;
  const height = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = values.map((v, i) => {
    const x =
      values.length === 1
        ? width / 2
        : (i / (values.length - 1)) * (width - 4) + 2;
    const y = height - 4 - ((v - min) / span) * (height - 8);
    return `${x},${y}`;
  });

  return (
    <div className={className ?? ''}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          points={points.join(' ')}
        />
      </svg>
    </div>
  );
}

/* ----------- Page ----------- */

export default function TeamMemberAnalyticsPage() {
  const params = useParams();
  const memberId = Array.isArray(params?.id)
    ? params.id[0]
    : (params?.id as string | undefined);

  const [range, setRange] = useState<RangeKey>('90d');
  const [data, setData] = useState<TeamMemberAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!memberId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        // Gateway-aligned endpoint
        const res = await fetch(
          `/api/analytics/practice/members/${encodeURIComponent(
            memberId,
          )}?range=${encodeURIComponent(range)}`,
          {
            cache: 'no-store',
            headers: {
              'x-role': 'clinician',
            },
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const js = (await res.json().catch(() => null)) as
          | TeamMemberAnalyticsPayload
          | null;
        if (cancelled) return;
        setData(js || MOCK_MEMBER_ANALYTICS);
      } catch (e: any) {
        console.error('[team member analytics] failed', e);
        if (cancelled) return;
        setErr(
          e?.message || 'Failed to load member analytics; using demo snapshot.',
        );
        setData(MOCK_MEMBER_ANALYTICS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [memberId, range]);

  if (!memberId) {
    return (
      <main className="max-w-5xl mx-auto p-6">
        <p className="text-sm text-gray-600">
          Invalid member ID in URL. Go back to{' '}
          <Link href="/analytics/team" className="underline">
            team analytics
          </Link>
          .
        </p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="max-w-5xl mx-auto p-6">
        <p className="text-sm text-gray-600">Loading member analytics…</p>
      </main>
    );
  }

  const payload = data;
  const { kpis, lifecycleSummary: ls, badgeCounters } = payload;

  const totalSessions = kpis.totalTelevisits + (kpis.totalInPerson || 0);
  const totalHours = ls.totalConsultationMinutes / 60;

  const currencyFormatter = new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  });

  // Enforce: viewer must be host to see details
  if (payload.viewerPlanTier !== 'host') {
    return (
      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">
            Team member analytics
          </h1>
          <p className="text-sm text-gray-500">
            Only Host / Practice accounts can see detailed performance for team
            members.
          </p>
        </header>
        <section className="space-y-2 rounded-xl border border-dashed border-indigo-200 bg-indigo-50 p-4 text-xs text-indigo-900">
          <p>
            You can still view your own performance under{' '}
            <Link href="/analytics/me" className="underline">
              Analytics → My consult performance
            </Link>
            . To unlock team-wide dashboards, upgrade to a Host / Practice plan.
          </p>
          <Link
            href="/payout"
            className="inline-flex items-center rounded-full border border-indigo-600 px-3 py-1.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50"
          >
            Upgrade to Host / Practice →
          </Link>
        </section>
      </main>
    );
  }

  const sessionsSeries = payload.timeSeries.map((p) => p.sessions);
  const revenueSeries = payload.timeSeries
    .map((p) => p.revenueCents ?? 0)
    .filter((v) => v > 0);

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-900 md:text-2xl">
              {payload.name || payload.memberId}
            </h1>
            <Pill>{payload.roleLabel}</Pill>
            {payload.classLabel && <Pill>{payload.classLabel}</Pill>}
            {badgeCounters.topRated && payload.isClinician && (
              <Pill>Top rated (≥ 4★)</Pill>
            )}
            {payload.status && <Pill>{payload.status}</Pill>}
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
            <Pill>
              ID:{' '}
              <span className="font-mono text-[10px]">
                {payload.memberId}
              </span>
            </Pill>
            <Pill>Practice: {payload.practiceName}</Pill>
            <Pill>
              Total sessions in range: {totalSessions.toLocaleString()}
            </Pill>
          </div>
          <p className="text-[11px] text-gray-500">
            This view mirrors admin analytics but is scoped to your own
            practice. Use it for coaching and performance reviews.
          </p>
          <p className="text-[11px] text-gray-500">
            <Link href="/analytics/team" className="underline">
              ← Back to team overview
            </Link>
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <RangeToggle value={range} onChange={setRange} />
          {loading && (
            <span className="text-[11px] text-gray-500">Refreshing…</span>
          )}
          {err && (
            <span className="max-w-xs text-right text-[11px] text-amber-700">
              {err}
            </span>
          )}
        </div>
      </header>

      {/* KPI grid */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total sessions (range)"
          value={totalSessions.toLocaleString()}
          helper={
            payload.isClinician
              ? `${kpis.totalPatients.toLocaleString()} patients (${kpis.newPatients.toLocaleString()} new)`
              : 'Includes tasks / bookings handled in this period.'
          }
        />
        {payload.isClinician && (
          <StatCard
            label="On-time joins (clinician)"
            value={`${kpis.clinicianOnTimeJoinRatePct.toFixed(1)}%`}
            helper={`Avg join delay: ${kpis.avgClinicianJoinDelayMin.toFixed(
              1,
            )} min`}
          />
        )}
        <StatCard
          label="Overrun rate"
          value={
            payload.isClinician
              ? `${kpis.overrunRatePct.toFixed(1)}%`
              : '—'
          }
          helper={
            payload.isClinician
              ? `Avg overrun: ${kpis.avgOverrunMin.toFixed(1)} min`
              : 'Overruns not tracked for this role.'
          }
        />
        <StatCard
          label="Cancellations & no-shows"
          value={`${kpis.cancellations}/${kpis.noShows}`}
          helper="Cancellations / patient no-shows on their booked sessions"
        />
      </section>

      {/* Sparkline section */}
      <section className="grid gap-4 md:grid-cols-2 text-xs">
        <div className="space-y-2 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Session trend
              </div>
              <div className="text-[11px] text-gray-500">
                Completed sessions per bucket in this range.
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-4">
            <SparklineMini
              values={sessionsSeries}
              className="text-gray-800"
            />
            <div className="text-right text-[11px] text-gray-600">
              {payload.timeSeries.map((p) => (
                <div key={p.bucket}>
                  <span className="font-medium">{p.bucket}</span>:&nbsp;
                  {p.sessions.toLocaleString()} sessions
                </div>
              ))}
              {!payload.timeSeries.length && (
                <div>No bucketed data in this range yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Revenue trend
              </div>
              <div className="text-[11px] text-gray-500">
                Pay per bucket (if this role has billable sessions).
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-4">
            <SparklineMini
              values={revenueSeries.length ? revenueSeries : [0]}
              className="text-gray-800"
            />
            <div className="text-right text-[11px] text-gray-600">
              {payload.timeSeries.map((p) =>
                p.revenueCents != null ? (
                  <div key={p.bucket}>
                    <span className="font-medium">{p.bucket}</span>:&nbsp;
                    {currencyFormatter.format((p.revenueCents || 0) / 100)}
                  </div>
                ) : null,
              )}
              {!revenueSeries.length && (
                <div>No billable revenue recorded for this range.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Punctuality & overruns */}
      <section className="grid gap-4 md:grid-cols-2">
        {payload.isClinician && (
          <section className="space-y-2 rounded-2xl border bg-white p-4 text-xs shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Join punctuality
                </div>
                <div className="text-[11px] text-gray-500">
                  When this clinician joins relative to booked time.
                </div>
              </div>
            </div>
            <BucketStrip rows={payload.punctualityBucketsClinician} />
          </section>
        )}

        <section className="space-y-2 rounded-2xl border bg-white p-4 text-xs shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Patient punctuality
              </div>
              <div className="text-[11px] text-gray-500">
                When patients join sessions attached to this staff member.
              </div>
            </div>
          </div>
          <BucketStrip rows={payload.punctualityBucketsPatient} />
        </section>

        <section className="space-y-2 rounded-2xl border bg-white p-4 text-xs shadow-sm md:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Slot overruns
              </div>
              <div className="text-[11px] text-gray-500">
                Actual vs booked time for consult slots this member is attached
                to.
              </div>
            </div>
          </div>
          <BucketStrip rows={payload.overrunBuckets} />
        </section>
      </section>

      {/* Lifecycle + earnings */}
      <section className="grid gap-4 text-xs lg:grid-cols-2">
        <section className="space-y-2 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Lifecycle &amp; workload
              </div>
              <div className="text-[11px] text-gray-500">
                Onboarding milestones and typical working patterns.
              </div>
            </div>
          </div>

          <div className="mt-2 grid gap-2 text-[11px] text-gray-700 md:grid-cols-2">
            <div className="space-y-1">
              <div>
                <span className="font-medium">
                  Starter kit / device issued:{' '}
                </span>
                <span className="text-gray-600">
                  {ls.starterKitShippedAt
                    ? new Date(ls.starterKitShippedAt).toLocaleString()
                    : 'Not recorded'}
                </span>
              </div>
              <div>
                <span className="font-medium">First shift: </span>
                <span className="text-gray-600">
                  {ls.firstShiftAt
                    ? new Date(ls.firstShiftAt).toLocaleString()
                    : 'Not recorded'}
                </span>
              </div>
              {payload.isClinician && (
                <div>
                  <span className="font-medium">First consult: </span>
                  <span className="text-gray-600">
                    {ls.firstConsultAt
                      ? new Date(ls.firstConsultAt).toLocaleString()
                      : 'Not recorded'}
                  </span>
                </div>
              )}
              <div>
                <span className="font-medium">Completed sessions: </span>
                <span className="text-gray-600">
                  {ls.totalCompletedSessions.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div>
                <span className="font-medium">
                  Consultation hours (range):{' '}
                </span>
                <span className="text-gray-600">
                  {totalHours.toFixed(1)} h
                </span>
              </div>
              <div>
                <span className="font-medium">Work days in range: </span>
                <span className="text-gray-600">
                  {ls.totalWorkDaysInRange.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="font-medium">Avg work days / month: </span>
                <span className="text-gray-600">
                  {ls.avgWorkDaysPerMonth.toFixed(1)}
                </span>
              </div>
              <div>
                <span className="font-medium">Avg hours / work day: </span>
                <span className="text-gray-600">
                  {ls.avgWorkHoursPerDay.toFixed(1)} h
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-2 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Earnings &amp; ratings
              </div>
              <div className="text-[11px] text-gray-500">
                Pay and patient feedback (when applicable).
              </div>
            </div>
          </div>

          <div className="mt-2 grid gap-2 text-[11px] text-gray-700 md:grid-cols-2">
            <div className="space-y-1">
              {payload.isClinician && ls.totalEarningsCents != null ? (
                <>
                  <div>
                    <span className="font-medium">Total earnings: </span>
                    <span className="text-gray-600">
                      {currencyFormatter.format(
                        (ls.totalEarningsCents ?? 0) / 100,
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">
                      Avg monthly earnings:{' '}
                    </span>
                    <span className="text-gray-600">
                      {currencyFormatter.format(
                        (ls.avgMonthlyEarningsCents ?? 0) / 100,
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Pay this month: </span>
                    <span className="text-gray-600">
                      {currencyFormatter.format(
                        (ls.totalPayThisMonthCents ?? 0) / 100,
                      )}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-gray-600">
                  Earnings are not tracked for this role (e.g. salaried admin /
                  nurse). Check HR / payroll system for pay details.
                </div>
              )}
            </div>

            <div className="space-y-1">
              {payload.isClinician && (
                <>
                  <div>
                    <span className="font-medium">Average rating: </span>
                    <span className="text-gray-600">
                      {badgeCounters.avgRating != null
                        ? badgeCounters.avgRating.toFixed(2)
                        : '—'}{' '}
                      {badgeCounters.ratingsCount != null &&
                        `(${badgeCounters.ratingsCount.toLocaleString()} ratings)`}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Suspensions: </span>
                    <span className="text-gray-600">
                      {badgeCounters.suspendedCount}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">
                      Disciplinary actions:{' '}
                    </span>
                    <span className="text-gray-600">
                      {badgeCounters.disciplinaryCount}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Inactive periods: </span>
                    <span className="text-gray-600">
                      {badgeCounters.inactiveCount}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-2 border-t pt-2 text-[11px] text-gray-500">
            Use these metrics as input into coaching and performance reviews, not
            as the only signal. Context (patient mix, case complexity) matters.
          </div>
        </section>
      </section>
    </main>
  );
}
