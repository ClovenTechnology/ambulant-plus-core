// apps/admin-dashboard/app/analytics/clinicians/page.tsx
'use client';

import { useEffect, useState, useMemo, type ReactNode } from 'react';
import Link from 'next/link';

type RangeKey = '7d' | '30d' | '90d' | '12m';

type ClinicianKpis = {
  totalClinicians: number;
  activeClinicians: number;
  newClinicians: number;
  onboardingInProgress: number;
  avgTimeToFirstConsultDays: number;
  avgClinicianOnTimeJoinRatePct: number;
  avgPatientOnTimeJoinRatePct: number;
  avgOverrunRatePct: number;
  churnRatePct: number;

  // NEW: platform-wide session metrics
  totalAppointmentsBooked: number;
  totalConsultsCompleted: number;
  totalConsultationMinutes: number;
};

type BucketRow = {
  label: string;
  sessions: number;
  sharePct: number;
};

type OnboardingStageRow = {
  stage:
    | 'applied'
    | 'screened'
    | 'approved'
    | 'training_scheduled'
    | 'training_completed'
    | 'live';
  label: string;
  clinicians: number;
  sharePct: number;
  medianHoursToStage?: number | null;
};

type PlanRow = {
  planId: string;
  label: string;
  clinicians: number;
  activeClinicians: number;
  sharePct: number;
  monthlyChangePct: number;
};

type DeactivationReasonRow = {
  reasonKey: 'death' | 'disciplinary' | 'suspended' | 'unsubscribed' | 'dormant' | 'other';
  label: string;
  accounts: number;
  sharePct: number;
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
  kpis: ClinicianKpis;
  punctualityBucketsClinician: BucketRow[];
  punctualityBucketsPatient: BucketRow[];
  overrunBuckets: BucketRow[];
  onboardingStages: OnboardingStageRow[];
  plans: PlanRow[];
  deactivations: DeactivationReasonRow[];
  lateClinicians: LateClinicianRow[];
};

/* ---------- Local mock for dev / fallback ---------- */

const MOCK_CLINICIANS_ANALYTICS: ClinicianAnalyticsPayload = {
  kpis: {
    totalClinicians: 120,
    activeClinicians: 98,
    newClinicians: 8,
    onboardingInProgress: 14,
    avgTimeToFirstConsultDays: 5.6,
    avgClinicianOnTimeJoinRatePct: 84,
    avgPatientOnTimeJoinRatePct: 79,
    avgOverrunRatePct: 21,
    churnRatePct: 3.5,

    totalAppointmentsBooked: 1820,
    totalConsultsCompleted: 1530,
    totalConsultationMinutes: 29840,
  },
  punctualityBucketsClinician: [
    { label: 'On time (≤ grace)', sessions: 1420, sharePct: 78 },
    { label: '0–5 min late', sessions: 260, sharePct: 14 },
    { label: '5–10 min late', sessions: 90, sharePct: 5 },
    { label: '>10 min late', sessions: 50, sharePct: 3 },
  ],
  punctualityBucketsPatient: [
    { label: 'On time (≤ grace)', sessions: 1350, sharePct: 74 },
    { label: '0–5 min late', sessions: 290, sharePct: 16 },
    { label: '5–10 min late', sessions: 120, sharePct: 7 },
    { label: '>10 min late', sessions: 60, sharePct: 3 },
  ],
  overrunBuckets: [
    { label: 'On time / early', sessions: 980, sharePct: 54 },
    { label: '0–25% over', sessions: 520, sharePct: 29 },
    { label: '25–50% over', sessions: 210, sharePct: 12 },
    { label: '>50% over', sessions: 110, sharePct: 6 },
  ],
  onboardingStages: [
    { stage: 'applied', label: 'Applied', clinicians: 40, sharePct: 100, medianHoursToStage: null },
    { stage: 'screened', label: 'Screened', clinicians: 32, sharePct: 80, medianHoursToStage: 24 },
    { stage: 'approved', label: 'Approved', clinicians: 24, sharePct: 60, medianHoursToStage: 52 },
    {
      stage: 'training_scheduled',
      label: 'Training scheduled',
      clinicians: 20,
      sharePct: 50,
      medianHoursToStage: 72,
    },
    {
      stage: 'training_completed',
      label: 'Training completed',
      clinicians: 18,
      sharePct: 45,
      medianHoursToStage: 96,
    },
    { stage: 'live', label: 'Live on platform', clinicians: 16, sharePct: 40, medianHoursToStage: 130 },
  ],
  plans: [
    {
      planId: 'starter',
      label: 'Starter',
      clinicians: 40,
      activeClinicians: 36,
      sharePct: 36,
      monthlyChangePct: 4.5,
    },
    {
      planId: 'pro',
      label: 'Pro',
      clinicians: 50,
      activeClinicians: 44,
      sharePct: 42,
      monthlyChangePct: 7.3,
    },
    {
      planId: 'enterprise',
      label: 'Enterprise',
      clinicians: 30,
      activeClinicians: 18,
      sharePct: 22,
      monthlyChangePct: -2.1,
    },
  ],
  deactivations: [
    { reasonKey: 'unsubscribed', label: 'Unsubscribed / left', accounts: 6, sharePct: 46 },
    { reasonKey: 'dormant', label: 'Dormant', accounts: 4, sharePct: 31 },
    { reasonKey: 'disciplinary', label: 'Disciplinary', accounts: 2, sharePct: 15 },
    { reasonKey: 'suspended', label: 'Suspended', accounts: 1, sharePct: 8 },
  ],
  lateClinicians: [
    {
      clinicianId: 'cln-001',
      name: 'Dr. Naidoo',
      classLabel: 'Class A — Doctors',
      status: 'active',
      sessionsAnalysed: 62,
      clinicianOnTimeJoinRatePct: 61,
      avgClinicianJoinDelayMin: 4.8,
      overrunRatePct: 38,
    },
    {
      clinicianId: 'cln-017',
      name: 'Physio Mbele',
      classLabel: 'Class B — Allied',
      status: 'active',
      sessionsAnalysed: 34,
      clinicianOnTimeJoinRatePct: 64,
      avgClinicianJoinDelayMin: 4.2,
      overrunRatePct: 32,
    },
    {
      clinicianId: 'cln-023',
      name: 'Coach Smith',
      classLabel: 'Class C — Wellness',
      status: 'suspended',
      sessionsAnalysed: 20,
      clinicianOnTimeJoinRatePct: 40,
      avgClinicianJoinDelayMin: 7.1,
      overrunRatePct: 55,
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

function BucketTable({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle?: string;
  rows: BucketRow[];
}) {
  const total = rows.reduce((sum, r) => sum + r.sessions, 0);
  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-gray-900">{title}</div>
          {subtitle && <div className="text-[11px] text-gray-500">{subtitle}</div>}
        </div>
        <Pill>{total.toLocaleString()} sessions</Pill>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-gray-600">
            <tr className="text-left">
              <th className="px-2 py-1">Bucket</th>
              <th className="px-2 py-1 text-right">Sessions</th>
              <th className="px-2 py-1 text-right">Share</th>
              <th className="px-2 py-1">Bar</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t">
                <td className="px-2 py-1 align-middle">{r.label}</td>
                <td className="px-2 py-1 align-middle text-right">
                  {r.sessions.toLocaleString()}
                </td>
                <td className="px-2 py-1 align-middle text-right">
                  {r.sharePct.toFixed(1)}%
                </td>
                <td className="px-2 py-1 align-middle">
                  <div className="h-1.5 w-full rounded-full bg-gray-100">
                    <div
                      className="h-1.5 rounded-full bg-gray-900"
                      style={{ width: `${Math.min(r.sharePct, 100)}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="px-2 py-3 text-center text-gray-500">
                  No data in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------- Page ---------- */

export default function ClinicianAnalyticsPage() {
  const [range, setRange] = useState<RangeKey>('30d');
  const [data, setData] = useState<ClinicianAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/analytics/clinicians?range=${range}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const js = (await res.json().catch(() => null)) as ClinicianAnalyticsPayload | null;
        if (cancelled) return;
        setData(js || MOCK_CLINICIANS_ANALYTICS);
      } catch (e: any) {
        console.error('Clinician analytics fetch error', e);
        if (cancelled) return;
        setErr(e?.message || 'Failed to load clinician analytics; showing local snapshot.');
        setData(MOCK_CLINICIANS_ANALYTICS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const payload = data || MOCK_CLINICIANS_ANALYTICS;
  const { kpis } = payload;

  const totalDeactivations = useMemo(
    () => payload.deactivations.reduce((sum, r) => sum + r.accounts, 0),
    [payload.deactivations],
  );

  const totalConsultHours = kpis.totalConsultationMinutes / 60;

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg md:text-2xl font-semibold text-gray-900">
            Clinician performance &amp; onboarding
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Join punctuality, slot overruns, onboarding funnel and churn — sliced by plans and classes.
          </p>
          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-gray-500">
            <Pill>Total clinicians: {kpis.totalClinicians.toLocaleString()}</Pill>
            <Pill>Active: {kpis.activeClinicians.toLocaleString()}</Pill>
            <Pill>Onboarding now: {kpis.onboardingInProgress.toLocaleString()}</Pill>
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

      {/* KPI grid */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Appointments booked (range)"
          value={kpis.totalAppointmentsBooked.toLocaleString()}
          helper="All booked time slots in this window."
        />
        <StatCard
          label="Consults completed (range)"
          value={kpis.totalConsultsCompleted.toLocaleString()}
          helper="Completed virtual & in-person encounters."
        />
        <StatCard
          label="Recorded consult hours"
          value={totalConsultHours.toFixed(1) + ' h'}
          helper={`${kpis.totalConsultationMinutes.toLocaleString()} minutes in range.`}
        />
        <StatCard
          label="New clinicians in range"
          value={kpis.newClinicians.toLocaleString()}
          helper="Signed up & approved within this window."
        />
        <StatCard
          label="Avg time to first consult"
          value={`${kpis.avgTimeToFirstConsultDays.toFixed(1)} days`}
          helper="From approval to first completed encounter."
        />
        <StatCard
          label="On-time join rate (clinicians)"
          value={`${kpis.avgClinicianOnTimeJoinRatePct.toFixed(1)}%`}
          helper="Televisits where clinician joined within grace window."
        />
        <StatCard
          label="On-time join rate (patients)"
          value={`${kpis.avgPatientOnTimeJoinRatePct.toFixed(1)}%`}
          helper="Patient arrivals within grace window."
        />
        <StatCard
          label="Churn in range"
          value={`${kpis.churnRatePct.toFixed(1)}%`}
          helper="Accounts deactivated vs active at start."
        />
      </section>

      {/* Punctuality & overruns */}
      <section className="grid gap-4 md:grid-cols-2">
        <BucketTable
          title="Clinician join punctuality"
          subtitle="Share of televisits by clinician arrival bucket vs scheduled start."
          rows={payload.punctualityBucketsClinician}
        />
        <BucketTable
          title="Patient join punctuality"
          subtitle="Share of televisits by patient arrival bucket vs scheduled start."
          rows={payload.punctualityBucketsPatient}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <BucketTable
          title="Slot overruns"
          subtitle="How often actual consult length exceeded booked minutes."
          rows={payload.overrunBuckets}
        />
        {/* Onboarding funnel */}
        <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Onboarding funnel
              </div>
              <div className="text-[11px] text-gray-500">
                From application to live consults for clinicians in scope.
              </div>
            </div>
            <Pill>Stages: {payload.onboardingStages.length}</Pill>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr className="text-left">
                  <th className="px-2 py-1">Stage</th>
                  <th className="px-2 py-1 text-right">Clinicians</th>
                  <th className="px-2 py-1 text-right">Funnel share</th>
                  <th className="px-2 py-1 text-right">Median hours</th>
                </tr>
              </thead>
              <tbody>
                {payload.onboardingStages.map((s) => (
                  <tr key={s.stage} className="border-t">
                    <td className="px-2 py-1">{s.label}</td>
                    <td className="px-2 py-1 text-right">
                      {s.clinicians.toLocaleString()}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {s.sharePct.toFixed(1)}%
                    </td>
                    <td className="px-2 py-1 text-right">
                      {s.medianHoursToStage != null
                        ? `${s.medianHoursToStage.toFixed(1)} h`
                        : '—'}
                    </td>
                  </tr>
                ))}
                {!payload.onboardingStages.length && (
                  <tr>
                    <td colSpan={4} className="px-2 py-3 text-center text-gray-500">
                      No onboarding activity in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      {/* Plans + deactivations */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* Plan mix */}
        <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-gray-900">Plan mix</div>
              <div className="text-[11px] text-gray-500">
                Clinician distribution by subscription / practice plan.
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr className="text-left">
                  <th className="px-2 py-1">Plan</th>
                  <th className="px-2 py-1 text-right">Clinicians</th>
                  <th className="px-2 py-1 text-right">Active</th>
                  <th className="px-2 py-1 text-right">Mix</th>
                  <th className="px-2 py-1 text-right">MoM</th>
                </tr>
              </thead>
              <tbody>
                {payload.plans.map((p) => (
                  <tr key={p.planId} className="border-t">
                    <td className="px-2 py-1">{p.label}</td>
                    <td className="px-2 py-1 text-right">
                      {p.clinicians.toLocaleString()}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {p.activeClinicians.toLocaleString()}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {p.sharePct.toFixed(1)}%
                    </td>
                    <td
                      className={`px-2 py-1 text-right ${
                        p.monthlyChangePct > 0
                          ? 'text-emerald-700'
                          : p.monthlyChangePct < 0
                          ? 'text-rose-700'
                          : 'text-gray-600'
                      }`}
                    >
                      {p.monthlyChangePct >= 0 ? '+' : ''}
                      {p.monthlyChangePct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
                {!payload.plans.length && (
                  <tr>
                    <td colSpan={5} className="px-2 py-3 text-center text-gray-500">
                      No plan data for this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Deactivations */}
        <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Account deactivations &amp; churn reasons
              </div>
              <div className="text-[11px] text-gray-500">
                Reasons for clinicians leaving or being suspended in this window.
              </div>
            </div>
            <Pill>{totalDeactivations} accounts</Pill>
          </div>
          <div className="space-y-1">
            {payload.deactivations.map((d) => (
              <div
                key={d.reasonKey}
                className="flex items-center justify-between rounded-lg border bg-slate-50 px-2 py-1.5 text-xs"
              >
                <div className="flex items-center gap-2">
                  <ReasonBadge reasonKey={d.reasonKey} label={d.label} />
                  <span className="text-gray-600">{d.label}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-gray-600">
                  <span>{d.accounts.toLocaleString()} accounts</span>
                  <span>{d.sharePct.toFixed(1)}%</span>
                </div>
              </div>
            ))}
            {!payload.deactivations.length && (
              <div className="rounded border border-dashed bg-slate-50 px-2 py-2 text-[11px] text-gray-500">
                No deactivations recorded in this range.
              </div>
            )}
          </div>
        </section>
      </section>

      {/* Top late clinicians */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-gray-900">
              Clinicians with chronic lateness or overruns
            </div>
            <div className="text-[11px] text-gray-500">
              Sorted by lowest on-time join rate; click through for full timeline &amp; context.
            </div>
          </div>
          <Pill>{payload.lateClinicians.length} flagged clinicians</Pill>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr className="text-left">
                <th className="px-2 py-1">Clinician</th>
                <th className="px-2 py-1">Class</th>
                <th className="px-2 py-1">Status</th>
                <th className="px-2 py-1 text-right">Sessions</th>
                <th className="px-2 py-1 text-right">On-time joins</th>
                <th className="px-2 py-1 text-right">Avg join delay</th>
                <th className="px-2 py-1 text-right">Overrun rate</th>
                <th className="px-2 py-1 text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {payload.lateClinicians.map((c) => (
                <tr key={c.clinicianId} className="border-t">
                  <td className="px-2 py-1">
                    <div className="font-medium text-gray-900">
                      {c.name || c.clinicianId}
                    </div>
                    <div className="font-mono text-[10px] text-gray-500">
                      {c.clinicianId}
                    </div>
                  </td>
                  <td className="px-2 py-1 text-gray-600">
                    {c.classLabel || '—'}
                  </td>
                  <td className="px-2 py-1">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-2 py-1 text-right">
                    {c.sessionsAnalysed.toLocaleString()}
                  </td>
                  <td className="px-2 py-1 text-right">
                    {c.clinicianOnTimeJoinRatePct.toFixed(1)}%
                  </td>
                  <td className="px-2 py-1 text-right">
                    {c.avgClinicianJoinDelayMin.toFixed(1)} min
                  </td>
                  <td className="px-2 py-1 text-right">
                    {c.overrunRatePct.toFixed(1)}%
                  </td>
                  <td className="px-2 py-1 text-right">
                    <Link
                      href={`/analytics/clinicians/${encodeURIComponent(
                        c.clinicianId,
                      )}`}
                      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] hover:bg-gray-50"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {!payload.lateClinicians.length && (
                <tr>
                  <td colSpan={8} className="px-2 py-3 text-center text-gray-500">
                    No clinicians flagged as chronically late in this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
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

function ReasonBadge({
  reasonKey,
  label,
}: {
  reasonKey: DeactivationReasonRow['reasonKey'];
  label: string;
}) {
  let classes =
    'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]';
  switch (reasonKey) {
    case 'death':
      classes += ' border-rose-300 bg-rose-50 text-rose-700';
      break;
    case 'disciplinary':
      classes += ' border-amber-300 bg-amber-50 text-amber-800';
      break;
    case 'suspended':
      classes += ' border-amber-300 bg-amber-50 text-amber-800';
      break;
    case 'unsubscribed':
      classes += ' border-slate-300 bg-slate-50 text-slate-700';
      break;
    case 'dormant':
      classes += ' border-slate-200 bg-slate-50 text-slate-600';
      break;
    default:
      classes += ' border-slate-200 bg-slate-50 text-slate-700';
  }
  return <span className={classes}>{label}</span>;
}

function StatusBadge({ status }: { status: LateClinicianRow['status'] }) {
  let classes =
    'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] capitalize ';
  if (status === 'active') {
    classes += 'border-emerald-200 bg-emerald-50 text-emerald-700';
  } else if (status === 'suspended') {
    classes += 'border-amber-200 bg-amber-50 text-amber-800';
  } else {
    classes += 'border-rose-200 bg-rose-50 text-rose-700';
  }
  return <span className={classes}>{status}</span>;
}
