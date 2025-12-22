// apps/admin-dashboard/app/analytics/clinicians/[id]/page.tsx
'use client';

import {
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type RangeKey = '7d' | '30d' | '90d' | '12m';

type BucketRow = {
  label: string;
  sessions: number;
  sharePct: number;
};

type MonthlyPatientBreakdown = {
  male: number;
  female: number;
  paed: number;
  middleAge: number;
  elderly: number;
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
  daysSinceLastConsult: number;

  // New lifecycle / earnings / workload metrics (all optional)
  totalAppointmentsBooked?: number;
  totalCompletedSessions?: number;
  totalConsultMinutes?: number;

  totalEarningsCents?: number;
  avgMonthlyEarningsCents?: number;
  avgMonthlyPayCents?: number;
  totalEarningsThisMonthCents?: number;

  avgWorkDaysPerMonth?: number;
  avgWorkHoursPerMonth?: number;
  avgWorkHoursPerDay?: number;
  workDaysInRange?: number;
  workHoursInRange?: number;

  avgPatientsPerMonth?: number;
  totalPatientsThisMonth?: number;
  patientsThisMonthByCohort?: MonthlyPatientBreakdown;
};

type ClinicianSessionPoint = {
  bucket: string;
  sessions: number;
  clinicianOnTimeJoinRatePct: number;
  overrunRatePct: number;
  revenueCents: number;
};

type RecentSessionRow = {
  id: string;
  startedAt: string;
  kind: 'virtual' | 'in_person';
  isFollowup: boolean;
  patientType: 'new' | 'existing';
  scheduledMinutes: number;
  clinicianJoinDelayMin: number;
  patientJoinDelayMin: number;
  overrunMin: number;
  withinClinicianGrace: boolean;
  withinPatientGrace: boolean;
};

type OnboardingEvent = {
  ts: string;
  stage: string;
  note?: string | null;
};

type PlanHistoryRow = {
  from: string;
  to: string | null;
  planId: string;
  label: string;
};

type DeactivationEvent = {
  ts: string;
  status: 'suspended' | 'deactivated';
  reasonKey?: string;
  reasonLabel?: string;
};

type ClinicianDetailPayload = {
  clinicianId: string;
  name: string;
  classLabel?: string | null;
  status: string;
  currentPlan?: string | null;
  kpis: ClinicianDetailKpis;
  punctualityBucketsClinician: BucketRow[];
  punctualityBucketsPatient: BucketRow[];
  overrunBuckets: BucketRow[];
  timeSeries: ClinicianSessionPoint[];
  recentSessions: RecentSessionRow[];
  onboardingTimeline: OnboardingEvent[];
  planHistory: PlanHistoryRow[];
  deactivations: DeactivationEvent[];

  // New rating info for badges
  avgRating?: number | null;
  ratingCount?: number | null;
};

/* ---------- Local mock for offline dev ---------- */

const MOCK_DETAIL: ClinicianDetailPayload = {
  clinicianId: 'cln-demo',
  name: 'Demo Clinician',
  classLabel: 'Class A — Doctors',
  status: 'active',
  currentPlan: 'Pro',
  avgRating: 4.3,
  ratingCount: 87,
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
    daysSinceLastConsult: 1,

    totalAppointmentsBooked: 120,
    totalCompletedSessions: 96,
    totalConsultMinutes: 96 * 22, // demo: avg 22 min

    totalEarningsCents: 96 * 8500, // ~R85 consult
    avgMonthlyEarningsCents: 320000, // ~R3.2k/mo demo
    avgMonthlyPayCents: 320000,
    totalEarningsThisMonthCents: 145000, // current window

    avgWorkDaysPerMonth: 12,
    avgWorkHoursPerMonth: 12 * 4.5,
    avgWorkHoursPerDay: 4.5,
    workDaysInRange: 9,
    workHoursInRange: 42,

    avgPatientsPerMonth: 40,
    totalPatientsThisMonth: 28,
    patientsThisMonthByCohort: {
      male: 12,
      female: 14,
      paed: 5,
      middleAge: 15,
      elderly: 8,
    },
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
  timeSeries: Array.from({ length: 10 }).map((_, i) => {
    const base = 6 + i;
    return {
      bucket: new Date(Date.now() - (9 - i) * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
      sessions: base,
      clinicianOnTimeJoinRatePct: 60 + (i % 4) * 3,
      overrunRatePct: 30 + (i % 3) * 5,
      revenueCents: base * 8000,
    };
  }),
  recentSessions: Array.from({ length: 8 }).map((_, i) => ({
    id: `sess-${i + 1}`,
    startedAt: new Date(Date.now() - i * 60 * 60 * 1000 * 8).toISOString(),
    kind: i % 4 === 0 ? 'in_person' : 'virtual',
    isFollowup: i % 3 === 0,
    patientType: i % 2 === 0 ? 'new' : 'existing',
    scheduledMinutes: i % 3 === 0 ? 30 : 20,
    clinicianJoinDelayMin: i % 4 === 0 ? 0 : 2 + (i % 3),
    patientJoinDelayMin: i % 5 === 0 ? 0 : 1 + (i % 4),
    overrunMin: i % 3 === 0 ? 8 : i % 4 === 0 ? 0 : 3,
    withinClinicianGrace: i % 4 !== 3,
    withinPatientGrace: i % 5 !== 4,
  })),
  onboardingTimeline: [
    { ts: '2025-10-01T10:00:00Z', stage: 'Applied', note: 'Website form' },
    { ts: '2025-10-02T14:30:00Z', stage: 'Screened', note: 'Docs verified' },
    { ts: '2025-10-03T11:00:00Z', stage: 'Approved' },
    {
      ts: '2025-10-03T16:30:00Z',
      stage: 'Starter kit shipped',
      note: 'Health monitor + NexRing dispatched',
    },
    { ts: '2025-10-06T15:00:00Z', stage: 'Training completed' },
    {
      ts: '2025-10-08T11:15:00Z',
      stage: 'First consult live',
      note: 'Televisit with remote mining patient',
    },
  ],
  planHistory: [
    {
      from: '2025-10-01',
      to: '2025-11-15',
      planId: 'starter',
      label: 'Starter',
    },
    {
      from: '2025-11-16',
      to: null,
      planId: 'pro',
      label: 'Pro',
    },
  ],
  deactivations: [
    // Demo events so badge counters light up
    {
      ts: '2025-11-01T09:00:00Z',
      status: 'suspended',
      reasonKey: 'disciplinary',
      reasonLabel: 'Disciplinary warning – late notes',
    },
    {
      ts: '2025-11-08T09:00:00Z',
      status: 'suspended',
      reasonKey: 'disciplinary',
      reasonLabel: 'Disciplinary warning – no-shows',
    },
  ],
};

/* ---------- Small UI bits ---------- */

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
    { key: '7d', label: 'Last 7 days' },
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

function formatMinutesToHours(min?: number): string {
  if (!min || min <= 0) return '—';
  const hours = Math.floor(min / 60);
  const mins = Math.round(min % 60);
  if (!hours) return `${mins} min`;
  if (!mins) return `${hours} h`;
  return `${hours} h ${mins} min`;
}

function formatZarFromCents(cents?: number): string {
  if (cents == null) return '—';
  return (cents / 100).toLocaleString('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  });
}

/* ---------- Page ---------- */

export default function ClinicianAnalyticsDetailPage() {
  const params = useParams<{ id: string }>();
  const clinicianId = (params?.id || '').toString();
  const [range, setRange] = useState<RangeKey>('90d');
  const [data, setData] = useState<ClinicianDetailPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!clinicianId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(
          `/api/analytics/clinicians/${encodeURIComponent(
            clinicianId,
          )}?range=${range}`,
          { cache: 'no-store' },
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const js = (await res.json().catch(() => null)) as ClinicianDetailPayload | null;
        if (cancelled) return;
        setData(js || { ...MOCK_DETAIL, clinicianId });
      } catch (e: any) {
        console.error('Clinician detail analytics fetch error', e);
        if (cancelled) return;
        setErr(e?.message || 'Failed to load clinician analytics; showing local snapshot.');
        setData({ ...MOCK_DETAIL, clinicianId });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [clinicianId, range]);

  const payload = data || { ...MOCK_DETAIL, clinicianId: clinicianId || 'unknown' };
  const { kpis } = payload;

  const totalSessions = useMemo(
    () => kpis.totalTelevisits + kpis.totalInPerson,
    [kpis.totalTelevisits, kpis.totalInPerson],
  );

  const suspensionCount = useMemo(
    () => payload.deactivations.filter((d) => d.status === 'suspended').length,
    [payload.deactivations],
  );
  const disciplinaryCount = useMemo(
    () => payload.deactivations.filter((d) => d.reasonKey === 'disciplinary').length,
    [payload.deactivations],
  );
  const deactivationCount = useMemo(
    () => payload.deactivations.filter((d) => d.status === 'deactivated').length,
    [payload.deactivations],
  );

  const hasRating = payload.avgRating != null && payload.ratingCount != null;
  const isTopRated =
    hasRating && (payload.avgRating ?? 0) >= 4 && (payload.ratingCount ?? 0) >= 5;

  const patientsCohort = kpis.patientsThisMonthByCohort;

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-lg md:text-2xl font-semibold text-gray-900">
              Clinician performance — {payload.name}
            </h1>
            {payload.classLabel && <Pill>{payload.classLabel}</Pill>}
            {isTopRated && (
              <Pill>
                ⭐ Top rated{' '}
                {payload.avgRating != null &&
                  `(${payload.avgRating.toFixed(1)} / 5 from ${payload.ratingCount} ratings)`}
              </Pill>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
            <Pill>
              ID:{' '}
              <span className="font-mono text-[10px]">
                {payload.clinicianId}
              </span>
            </Pill>
            <Pill>Status: {payload.status}</Pill>
            {payload.currentPlan && <Pill>Plan: {payload.currentPlan}</Pill>}
            <Pill>
              Total sessions in range: {totalSessions.toLocaleString()}
            </Pill>
          </div>
          <div className="text-[11px] text-gray-500">
            Join punctuality and slot overruns are calculated against booked
            appointments and current platform grace windows.
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
          <Link
            href="/analytics/clinicians"
            className="text-[11px] text-gray-600 underline-offset-2 hover:underline"
          >
            ← Back to clinician analytics
          </Link>
        </div>
      </header>

      {/* KPI grid (behavioural) */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total televisits"
          value={kpis.totalTelevisits.toLocaleString()}
          helper={`${kpis.totalPatients.toLocaleString()} patients (${kpis.newPatients.toLocaleString()} new)`}
        />
        <StatCard
          label="On-time joins (clinician)"
          value={`${kpis.clinicianOnTimeJoinRatePct.toFixed(1)}%`}
          helper={`Avg delay: ${kpis.avgClinicianJoinDelayMin.toFixed(
            1,
          )} min`}
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

      {/* Punctuality & overruns */}
      <section className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Clinician join punctuality
              </div>
              <div className="text-[11px] text-gray-500">
                Distribution of televisits by clinician arrival bucket.
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
                Distribution of televisits by patient arrival bucket.
              </div>
            </div>
          </div>
          <BucketStrip rows={payload.punctualityBucketsPatient} />
        </section>
      </section>

      {/* Mini timeseries + overruns */}
      <section className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Session trend &amp; behaviour
              </div>
              <div className="text-[11px] text-gray-500">
                Aggregate sessions, punctuality and overruns over time.
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px]">
              <thead className="bg-gray-50 text-gray-600">
                <tr className="text-left">
                  <th className="px-2 py-1">Period</th>
                  <th className="px-2 py-1 text-right">Sessions</th>
                  <th className="px-2 py-1 text-right">On-time joins</th>
                  <th className="px-2 py-1 text-right">Overruns</th>
                  <th className="px-2 py-1 text-right">Revenue (approx)</th>
                </tr>
              </thead>
              <tbody>
                {payload.timeSeries.map((p) => (
                  <tr key={p.bucket} className="border-t">
                    <td className="px-2 py-1 align-top">
                      {p.bucket}
                    </td>
                    <td className="px-2 py-1 align-top text-right">
                      {p.sessions.toLocaleString()}
                    </td>
                    <td className="px-2 py-1 align-top text-right">
                      {p.clinicianOnTimeJoinRatePct.toFixed(1)}%
                    </td>
                    <td className="px-2 py-1 align-top text-right">
                      {p.overrunRatePct.toFixed(1)}%
                    </td>
                    <td className="px-2 py-1 align-top text-right">
                      {(p.revenueCents / 100).toLocaleString('en-ZA', {
                        style: 'currency',
                        currency: 'ZAR',
                      })}
                    </td>
                  </tr>
                ))}
                {!payload.timeSeries.length && (
                  <tr>
                    <td colSpan={5} className="px-2 py-3 text-center text-gray-500">
                      No encounters recorded in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Slot overruns
              </div>
              <div className="text-[11px] text-gray-500">
                How often this clinician exceeded booked minutes.
              </div>
            </div>
          </div>
          <BucketStrip rows={payload.overrunBuckets} />
          <div className="mt-2 text-[11px] text-gray-500">
            Overruns are computed against the booked slot length for each
            appointment and current admin buffer rules.
          </div>
        </section>
      </section>

      {/* Recent sessions table */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-gray-900">
              Recent encounters (sample)
            </div>
            <div className="text-[11px] text-gray-500">
              Per-encounter view of join times and overruns for quick QA.
            </div>
          </div>
          <Pill>{payload.recentSessions.length} encounters</Pill>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[11px]">
            <thead className="bg-gray-50 text-gray-600">
              <tr className="text-left">
                <th className="px-2 py-1">Start</th>
                <th className="px-2 py-1">Type</th>
                <th className="px-2 py-1">Patient</th>
                <th className="px-2 py-1 text-right">Booked</th>
                <th className="px-2 py-1 text-right">Clinician delay</th>
                <th className="px-2 py-1 text-right">Patient delay</th>
                <th className="px-2 py-1 text-right">Overrun</th>
                <th className="px-2 py-1 text-right">Flags</th>
              </tr>
            </thead>
            <tbody>
              {payload.recentSessions.map((s) => {
                const d = new Date(s.startedAt);
                const dateLabel = d.toLocaleDateString();
                const timeLabel = d.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const flags: string[] = [];
                if (!s.withinClinicianGrace) flags.push('Clinician late');
                if (!s.withinPatientGrace) flags.push('Patient late');
                if (s.overrunMin > 0) flags.push('Overrun');
                return (
                  <tr key={s.id} className="border-t">
                    <td className="px-2 py-1 align-top">
                      <div>{dateLabel}</div>
                      <div className="text-[10px] text-gray-500">
                        {timeLabel}
                      </div>
                    </td>
                    <td className="px-2 py-1 align-top">
                      <div className="capitalize">{s.kind.replace('_', ' ')}</div>
                      <div className="text-[10px] text-gray-500">
                        {s.isFollowup ? 'Follow-up' : 'Base consult'}
                      </div>
                    </td>
                    <td className="px-2 py-1 align-top">
                      <div className="capitalize">{s.patientType} patient</div>
                    </td>
                    <td className="px-2 py-1 align-top text-right">
                      {s.scheduledMinutes} min
                    </td>
                    <td className="px-2 py-1 align-top text-right">
                      {s.clinicianJoinDelayMin.toFixed(1)} min
                    </td>
                    <td className="px-2 py-1 align-top text-right">
                      {s.patientJoinDelayMin.toFixed(1)} min
                    </td>
                    <td className="px-2 py-1 align-top text-right">
                      {s.overrunMin.toFixed(1)} min
                    </td>
                    <td className="px-2 py-1 align-top text-right">
                      {flags.length ? (
                        <div className="flex flex-wrap justify-end gap-1">
                          {flags.map((f) => (
                            <span
                              key={f}
                              className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-emerald-700">
                          On time &amp; within slot
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!payload.recentSessions.length && (
                <tr>
                  <td colSpan={8} className="px-2 py-3 text-center text-gray-500">
                    No sample encounters available for this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Onboarding + lifecycle */}
      <section className="grid gap-4 lg:grid-cols-2 text-xs">
        <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Onboarding &amp; lifecycle
              </div>
              <div className="text-[11px] text-gray-500">
                Key milestones from application to current state, plus work &amp; earnings footprint.
              </div>
            </div>
          </div>
          <ol className="space-y-1 text-[11px] text-gray-700">
            {payload.onboardingTimeline.map((e, idx) => {
              const d = new Date(e.ts);
              return (
                <li key={`${e.ts}-${idx}`} className="flex gap-2">
                  <span className="mt-[3px] h-2 w-2 flex-shrink-0 rounded-full bg-gray-900" />
                  <div>
                    <div className="font-medium">{e.stage}</div>
                    <div className="text-gray-500">
                      {d.toLocaleString()} {e.note ? `— ${e.note}` : ''}
                    </div>
                  </div>
                </li>
              );
            })}
            {!payload.onboardingTimeline.length && (
              <li className="text-gray-500">
                No onboarding events recorded for this clinician.
              </li>
            )}
          </ol>

          {/* Lifecycle stats block */}
          <div className="mt-3 border-t pt-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Lifecycle stats (range &amp; typical month)
            </div>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <div className="font-semibold text-[11px] text-gray-700">
                  Sessions &amp; time
                </div>
                <ul className="space-y-0.5 text-[11px] text-gray-700">
                  <li>
                    Total appointments booked:{' '}
                    <span className="font-semibold">
                      {kpis.totalAppointmentsBooked != null
                        ? kpis.totalAppointmentsBooked.toLocaleString()
                        : '—'}
                    </span>
                  </li>
                  <li>
                    Total completed sessions:{' '}
                    <span className="font-semibold">
                      {/* Explicit duplicate as requested */}
                      {kpis.totalCompletedSessions != null
                        ? kpis.totalCompletedSessions.toLocaleString()
                        : totalSessions.toLocaleString()}
                    </span>
                  </li>
                  <li>
                    Total consult hours:{' '}
                    <span className="font-semibold">
                      {formatMinutesToHours(kpis.totalConsultMinutes)}
                    </span>
                  </li>
                  <li>
                    Work days in this range:{' '}
                    <span className="font-semibold">
                      {kpis.workDaysInRange != null
                        ? kpis.workDaysInRange.toLocaleString()
                        : '—'}
                    </span>
                  </li>
                  <li>
                    Work hours in this range:{' '}
                    <span className="font-semibold">
                      {kpis.workHoursInRange != null
                        ? `${kpis.workHoursInRange.toFixed(1)} h`
                        : '—'}
                    </span>
                  </li>
                </ul>
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-[11px] text-gray-700">
                  Earnings &amp; patient mix
                </div>
                <ul className="space-y-0.5 text-[11px] text-gray-700">
                  <li>
                    Total earnings (lifetime / scope):{' '}
                    <span className="font-semibold">
                      {formatZarFromCents(kpis.totalEarningsCents)}
                    </span>
                  </li>
                  <li>
                    Average monthly earning:{' '}
                    <span className="font-semibold">
                      {formatZarFromCents(
                        kpis.avgMonthlyEarningsCents ?? kpis.avgMonthlyPayCents,
                      )}
                    </span>
                  </li>
                  <li>
                    Total pay this month/window:{' '}
                    <span className="font-semibold">
                      {formatZarFromCents(kpis.totalEarningsThisMonthCents)}
                    </span>
                  </li>
                  <li>
                    Avg work days per month:{' '}
                    <span className="font-semibold">
                      {kpis.avgWorkDaysPerMonth != null
                        ? kpis.avgWorkDaysPerMonth.toFixed(1)
                        : '—'}
                    </span>
                  </li>
                  <li>
                    Avg work hours per month:{' '}
                    <span className="font-semibold">
                      {kpis.avgWorkHoursPerMonth != null
                        ? `${kpis.avgWorkHoursPerMonth.toFixed(1)} h`
                        : '—'}
                    </span>
                  </li>
                  <li>
                    Avg work hours per day:{' '}
                    <span className="font-semibold">
                      {kpis.avgWorkHoursPerDay != null
                        ? `${kpis.avgWorkHoursPerDay.toFixed(1)} h`
                        : '—'}
                    </span>
                  </li>
                  <li>
                    Avg patients per month:{' '}
                    <span className="font-semibold">
                      {kpis.avgPatientsPerMonth != null
                        ? kpis.avgPatientsPerMonth.toFixed(1)
                        : '—'}
                    </span>
                  </li>
                  <li>
                    Patients this month:{' '}
                    <span className="font-semibold">
                      {kpis.totalPatientsThisMonth != null
                        ? kpis.totalPatientsThisMonth.toLocaleString()
                        : '—'}
                    </span>
                    {patientsCohort && (
                      <span className="ml-1 inline-flex flex-wrap gap-1">
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px]">
                          ♂ {patientsCohort.male}
                        </span>
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px]">
                          ♀ {patientsCohort.female}
                        </span>
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px]">
                          Paed {patientsCohort.paed}
                        </span>
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px]">
                          Middle age {patientsCohort.middleAge}
                        </span>
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px]">
                          Elderly {patientsCohort.elderly}
                        </span>
                      </span>
                    )}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Plan &amp; status history
              </div>
              <div className="text-[11px] text-gray-500">
                How this clinician&apos;s plan and account status evolved.
              </div>
            </div>
          </div>
          <div className="space-y-3 text-[11px] text-gray-700">
            <div>
              <div className="font-semibold">Plan history</div>
              {payload.planHistory.length ? (
                <ul className="mt-1 space-y-1">
                  {payload.planHistory.map((p, idx) => (
                    <li key={`${p.planId}-${idx}`}>
                      <span className="font-medium">{p.label}</span>{' '}
                      <span className="text-gray-500">
                        ({p.from} → {p.to ?? 'present'})
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-1 text-gray-500">
                  No explicit plan history recorded.
                </div>
              )}
            </div>
            <div>
              <div className="font-semibold">Deactivation / suspension</div>
              {payload.deactivations.length ? (
                <ul className="mt-1 space-y-1">
                  {payload.deactivations.map((d, idx) => (
                    <li key={`${d.ts}-${idx}`}>
                      <span className="font-medium">{d.status}</span>{' '}
                      <span className="text-gray-500">
                        at {new Date(d.ts).toLocaleString()}
                      </span>
                      {d.reasonLabel && (
                        <span className="ml-1 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800">
                          {d.reasonLabel}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-1 text-gray-500">
                  No suspensions or deactivation events recorded.
                </div>
              )}
            </div>

            {/* Badges with counters */}
            <div className="border-t pt-2 mt-2">
              <div className="font-semibold">Badges</div>
              <div className="mt-1 flex flex-wrap gap-2">
                {isTopRated && (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-800">
                    ⭐ Top rated ({payload.avgRating?.toFixed(1)} / 5 &middot;{' '}
                    {payload.ratingCount} ratings)
                  </span>
                )}
                {suspensionCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800">
                    Suspended ×{suspensionCount}
                  </span>
                )}
                {disciplinaryCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800">
                    Disciplinary ×{disciplinaryCount}
                  </span>
                )}
                {deactivationCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] text-rose-800">
                    Deactivated ×{deactivationCount}
                  </span>
                )}
                {!isTopRated &&
                  suspensionCount === 0 &&
                  disciplinaryCount === 0 &&
                  deactivationCount === 0 && (
                    <span className="text-[11px] text-gray-500">
                      No notable status events yet.
                    </span>
                  )}
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
