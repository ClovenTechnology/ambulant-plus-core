// apps/clinician-app/app/analytics/me/page.tsx
'use client';

import { useEffect, useState, useMemo, type ReactNode } from 'react';

const API = process.env.NEXT_PUBLIC_APIGW_BASE ?? 'http://localhost:3010';

type RangeKey = '30d' | '90d' | '12m';
type PlanTier = 'free' | 'basic' | 'pro' | 'host';

type BucketRow = {
  label: string;
  sessions: number;
  sharePct: number;
};

type ClinicianDetailKpis = {
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

type ClinicianSessionPoint = {
  bucket: string;
  sessions: number;
  clinicianOnTimeJoinRatePct: number;
  overrunRatePct: number;
  revenueCents: number;
};

type ClinicianLifecycleSummary = {
  starterKitShippedBeforeTrainingAt?: string | null;
  starterKitShippedAfterApprovedAt?: string | null;
  firstConsultAt?: string | null;

  totalCompletedSessions: number;
  totalEarningsCents: number;
  avgMonthlyEarningsCents: number;
  totalConsultationMinutes: number;

  avgWorkDaysPerMonth: number;
  avgWorkHoursPerMonth: number;
  avgWorkHoursPerDay: number;
  totalWorkDaysInRange: number;
  totalWorkDaysThisMonth: number;
  totalConsultationMinutesThisMonth: number;

  avgMonthlyPayCents: number;
  totalPayThisMonthCents: number;

  avgPatientsPerMonth: number;
  totalPatientsThisMonth: number;
  patientsThisMonthByAgeGender: {
    male: number;
    female: number;
    other: number;
    paed: number;
    middleAge: number;
    elderly: number;
  };
};

type ClinicianBadgeCounters = {
  topRated: boolean;
  avgRating?: number | null;
  ratingsCount?: number | null;

  suspendedCount: number;
  disciplinaryCount: number;
  inactiveCount: number;
};

type ClinicianAnalyticsMePayload = {
  clinicianId: string;
  name: string;
  classLabel?: string | null;
  planTier: PlanTier;
  kpis: ClinicianDetailKpis;
  lifecycleSummary: ClinicianLifecycleSummary;
  badgeCounters: ClinicianBadgeCounters;
  punctualityBucketsClinician: BucketRow[];
  punctualityBucketsPatient: BucketRow[];
  overrunBuckets: BucketRow[];
  timeSeries: ClinicianSessionPoint[];
};

/* Small UI bits */

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

/* Page */

export default function ClinicianAnalyticsMePage() {
  const [range, setRange] = useState<RangeKey>('90d');
  const [data, setData] = useState<ClinicianAnalyticsMePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`${API}/analytics/clinicians/me?range=${range}`, {
          cache: 'no-store',
          headers: {
            'x-role': 'clinician',
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const js = (await res.json().catch(() => null)) as ClinicianAnalyticsMePayload | null;
        if (cancelled) return;

        if (!js) {
          // Fallback demo
          setData({
            clinicianId: 'cln-demo',
            name: 'Demo Clinician',
            classLabel: 'Class A — Doctors',
            planTier: 'basic',
            kpis: {
              totalTelevisits: 82,
              totalInPerson: 14,
              totalPatients: 96,
              newPatients: 23,
              repeatRatePct: 76,
              clinicianOnTimeJoinRatePct: 62,
              patientOnTimeJoinRatePct: 71,
              avgClinicianJoinDelayMin: 4.3,
              overrunRatePct: 36,
              avgOverrunMin: 6.7,
              cancellations: 5,
              noShows: 3,
            },
            lifecycleSummary: {
              starterKitShippedBeforeTrainingAt: null,
              starterKitShippedAfterApprovedAt: null,
              firstConsultAt: new Date().toISOString(),
              totalCompletedSessions: 96,
              totalEarningsCents: 860000,
              avgMonthlyEarningsCents: 430000,
              totalConsultationMinutes: 2300,
              avgWorkDaysPerMonth: 12.5,
              avgWorkHoursPerMonth: 54,
              avgWorkHoursPerDay: 4.3,
              totalWorkDaysInRange: 22,
              totalWorkDaysThisMonth: 8,
              totalConsultationMinutesThisMonth: 680,
              avgMonthlyPayCents: 410000,
              totalPayThisMonthCents: 215000,
              avgPatientsPerMonth: 40,
              totalPatientsThisMonth: 18,
              patientsThisMonthByAgeGender: {
                male: 9,
                female: 9,
                other: 0,
                paed: 4,
                middleAge: 8,
                elderly: 6,
              },
            },
            badgeCounters: {
              topRated: true,
              avgRating: 4.6,
              ratingsCount: 84,
              suspendedCount: 0,
              disciplinaryCount: 0,
              inactiveCount: 0,
            },
            punctualityBucketsClinician: [
              { label: 'On time (≤ grace)', sessions: 51, sharePct: 62 },
              { label: '0–5 min late', sessions: 18, sharePct: 22 },
              { label: '5–10 min late', sessions: 9, sharePct: 11 },
              { label: '>10 min late', sessions: 4, sharePct: 5 },
            ],
            punctualityBucketsPatient: [
              { label: 'On time (≤ grace)', sessions: 56, sharePct: 68 },
              { label: '0–5 min late', sessions: 15, sharePct: 18 },
              { label: '5–10 min late', sessions: 7, sharePct: 9 },
              { label: '>10 min late', sessions: 4, sharePct: 5 },
            ],
            overrunBuckets: [
              { label: 'On time / early', sessions: 40, sharePct: 49 },
              { label: '0–25% over', sessions: 24, sharePct: 29 },
              { label: '25–50% over', sessions: 11, sharePct: 13 },
              { label: '>50% over', sessions: 7, sharePct: 9 },
            ],
            timeSeries: [],
          });
        } else {
          setData(js);
        }
      } catch (e: any) {
        console.error('[analytics/me] failed', e);
        if (cancelled) return;
        setErr(e?.message || 'Failed to load analytics; using demo.');
        // demo fallback already handled above if js === null
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const payload = data;
  if (!payload) {
    return (
      <main className="max-w-5xl mx-auto p-6">
        <p className="text-sm text-gray-600">Loading analytics…</p>
      </main>
    );
  }

  const { kpis, lifecycleSummary: ls, badgeCounters, planTier } = payload;

  const totalSessions = useMemo(
    () => kpis.totalTelevisits + kpis.totalInPerson,
    [kpis.totalTelevisits, kpis.totalInPerson],
  );

  const currencyFormatter = new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  });

  const upgradeCta = (
    <a
      href="/payout"
      className="inline-flex items-center rounded-full border border-indigo-600 px-3 py-1.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50"
    >
      Upgrade plan →
    </a>
  );

  const showFull = planTier === 'pro' || planTier === 'host';

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-lg md:text-2xl font-semibold text-gray-900">
              My consult performance — {payload.name}
            </h1>
            {payload.classLabel && <Pill>{payload.classLabel}</Pill>}
            {badgeCounters.topRated && <Pill>Top rated (≥ 4★)</Pill>}
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
            <Pill>
              ID:{' '}
              <span className="font-mono text-[10px]">
                {payload.clinicianId}
              </span>
            </Pill>
            <Pill>Plan: {planTier.toUpperCase()}</Pill>
            <Pill>
              Total sessions in range: {totalSessions.toLocaleString()}
            </Pill>
          </div>
          <div className="text-[11px] text-gray-500">
            Metrics are based on completed bookings and current grace &amp; payout rules.
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <RangeToggle value={range} onChange={setRange} />
          {loading && (
            <span className="text-[11px] text-gray-500">
              Refreshing…
            </span>
          )}
          {err && (
            <span className="max-w-xs text-right text-[11px] text-amber-700">
              {err}
            </span>
          )}
        </div>
      </header>

      {/* KPI grid — always visible */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total televisits"
          value={kpis.totalTelevisits.toLocaleString()}
          helper={`${kpis.totalPatients.toLocaleString()} patients (${kpis.newPatients.toLocaleString()} new)`}
        />
        <StatCard
          label="On-time joins (you)"
          value={`${kpis.clinicianOnTimeJoinRatePct.toFixed(1)}%`}
          helper={`Avg delay: ${kpis.avgClinicianJoinDelayMin.toFixed(1)} min`}
        />
        <StatCard
          label="Overrun rate"
          value={`${kpis.overrunRatePct.toFixed(1)}%`}
          helper={`Avg overrun: ${kpis.avgOverrunMin.toFixed(1)} min`}
        />
        <StatCard
          label="Cancellations & no-shows"
          value={`${kpis.cancellations}/${kpis.noShows}`}
          helper="Cancellations / patient no-shows"
        />
      </section>

      {/* Basic plan upsell wrapper */}
      {planTier === 'basic' && (
        <section className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50 p-4 text-xs text-indigo-900 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-[13px]">Deeper analytics are available on Pro / Host plans.</div>
              <p className="mt-1">
                You&apos;re seeing a basic snapshot of your performance. Upgrade to unlock full lifecycle, earnings and
                patient mix analytics.
              </p>
            </div>
            {upgradeCta}
          </div>
        </section>
      )}

      {/* Punctuality & overruns (visible to all non-free plans) */}
      <section className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Your join punctuality
              </div>
              <div className="text-[11px] text-gray-500">
                Distribution of televisits by your arrival time.
              </div>
            </div>
          </div>
          <BucketStrip rows={payload.punctualityBucketsClinician} />
        </section>
        <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Patient join punctuality
              </div>
              <div className="text-[11px] text-gray-500">
                When patients join relative to your booked time.
              </div>
            </div>
          </div>
          <BucketStrip rows={payload.punctualityBucketsPatient} />
        </section>
      </section>

      {/* Lifecycle + earnings — full detail only on Pro/Host */}
      {showFull && (
        <section className="grid gap-4 lg:grid-cols-2 text-xs">
          <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Onboarding &amp; lifecycle
                </div>
                <div className="text-[11px] text-gray-500">
                  From first kit shipment to first consult and current workload.
                </div>
              </div>
            </div>

            <div className="mt-2 space-y-2 text-[11px] text-gray-700">
              <div className="grid gap-2 md:grid-cols-2">
                <div className="space-y-1">
                  <div>
                    <span className="font-medium">Starter kit (pre-training): </span>
                    <span className="text-gray-600">
                      {ls.starterKitShippedBeforeTrainingAt
                        ? new Date(ls.starterKitShippedBeforeTrainingAt).toLocaleString()
                        : 'Not recorded'}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Starter kit (post-approval): </span>
                    <span className="text-gray-600">
                      {ls.starterKitShippedAfterApprovedAt
                        ? new Date(ls.starterKitShippedAfterApprovedAt).toLocaleString()
                        : 'Not recorded'}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">First consult: </span>
                    <span className="text-gray-600">
                      {ls.firstConsultAt
                        ? new Date(ls.firstConsultAt).toLocaleString()
                        : 'Not recorded'}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Completed sessions: </span>
                    <span className="text-gray-600">
                      {ls.totalCompletedSessions.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div>
                    <span className="font-medium">Consultation hours (range): </span>
                    <span className="text-gray-600">
                      {(ls.totalConsultationMinutes / 60).toFixed(1)} h
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
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Earnings &amp; patient mix
                </div>
                <div className="text-[11px] text-gray-500">
                  High-level view of pay trends and who you care for.
                </div>
              </div>
            </div>

            <div className="mt-2 grid gap-2 md:grid-cols-2 text-[11px] text-gray-700">
              <div className="space-y-1">
                <div>
                  <span className="font-medium">Total earnings: </span>
                  <span className="text-gray-600">
                    {currencyFormatter.format(ls.totalEarningsCents / 100)}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Avg monthly earnings: </span>
                  <span className="text-gray-600">
                    {currencyFormatter.format(ls.avgMonthlyEarningsCents / 100)}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Total pay this month: </span>
                  <span className="text-gray-600">
                    {currencyFormatter.format(ls.totalPayThisMonthCents / 100)}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <div>
                  <span className="font-medium">Patients this month: </span>
                  <span className="text-gray-600">
                    {ls.totalPatientsThisMonth.toLocaleString()}
                  </span>
                </div>
                <div className="text-gray-600">
                  {ls.patientsThisMonthByAgeGender.paed} paed ·{' '}
                  {ls.patientsThisMonthByAgeGender.middleAge} middle age ·{' '}
                  {ls.patientsThisMonthByAgeGender.elderly} elderly
                </div>
                <div className="text-gray-600">
                  {ls.patientsThisMonthByAgeGender.male} male ·{' '}
                  {ls.patientsThisMonthByAgeGender.female} female ·{' '}
                  {ls.patientsThisMonthByAgeGender.other} other / undisclosed
                </div>
              </div>
            </div>

            <div className="mt-2 border-t pt-2 text-[11px] text-gray-500">
              Payout metrics are calculated after platform fees and may differ slightly from raw consult totals.
            </div>
          </section>
        </section>
      )}

      {/* For Basic plan, we still tease deeper insights */}
      {planTier === 'basic' && (
        <section className="rounded-xl border border-dashed bg-slate-50 p-4 text-xs text-gray-700 space-y-2">
          <div className="font-semibold text-[13px]">Want full lifecycle & earnings analytics?</div>
          <p>
            Upgrade to <span className="font-semibold">Pro</span> or{' '}
            <span className="font-semibold">Host / Practice</span> to see detailed lifecycle, earnings and patient mix
            panels like admins do.
          </p>
          {upgradeCta}
        </section>
      )}
    </main>
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
            className={`rounded-full px-3 py-1 ${
              active
                ? 'bg-gray-900 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
