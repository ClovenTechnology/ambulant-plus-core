// apps/clinician-app/app/analytics/team/page.tsx
'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';

type RangeKey = '30d' | '90d' | '12m';
type PlanTier = 'free' | 'basic' | 'pro' | 'host';

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

type TeamAnalyticsPayload = {
  planTier: PlanTier; // viewer's plan tier for this practice
  practiceName: string;
  practiceId?: string | null;
  kpis: TeamKpis;
  roleBreakdown: RoleBreakdownRow[];
  punctualityBucketsClinician: BucketRow[];
  overrunBuckets: BucketRow[];
  members: TeamMemberRow[];
};

/* ----------- Local mock for fallback ----------- */

const MOCK_TEAM_ANALYTICS: TeamAnalyticsPayload = {
  planTier: 'host',
  practiceName: 'Demo Virtual Practice',
  practiceId: 'prac-demo-001',
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
    {
      role: 'clinician',
      label: 'Clinicians',
      headcount: 5,
      active: 4,
      sessions: 310,
      sharePct: 74,
    },
    {
      role: 'nurse',
      label: 'Nurses',
      headcount: 3,
      active: 3,
      sessions: 60,
      sharePct: 14,
    },
    {
      role: 'admin_medical',
      label: 'Medical admin',
      headcount: 2,
      active: 2,
      sessions: 30,
      sharePct: 7,
    },
    {
      role: 'admin_non_medical',
      label: 'Non-medical admin',
      headcount: 2,
      active: 2,
      sessions: 20,
      sharePct: 5,
    },
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

/* ----------- Page ----------- */

export default function TeamAnalyticsPage() {
  const [range, setRange] = useState<RangeKey>('90d');
  const [data, setData] = useState<TeamAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        // Gateway-aligned endpoint
        const res = await fetch(
          `/api/analytics/practice?range=${encodeURIComponent(range)}`,
          {
            cache: 'no-store',
            headers: {
              'x-role': 'clinician',
            },
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const js = (await res.json().catch(() => null)) as
          | TeamAnalyticsPayload
          | null;
        if (cancelled) return;
        setData(js || MOCK_TEAM_ANALYTICS);
      } catch (e: any) {
        console.error('[team analytics] failed', e);
        if (cancelled) return;
        setErr(
          e?.message || 'Failed to load team analytics; using demo snapshot.',
        );
        setData(MOCK_TEAM_ANALYTICS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [range]);

  if (!data) {
    return (
      <main className="max-w-5xl mx-auto p-6">
        <p className="text-sm text-gray-600">Loading team analytics…</p>
      </main>
    );
  }

  const payload = data;
  const { kpis } = payload;
  const totalHours = kpis.totalConsultationMinutesRange / 60;

  const upgradeToHostCta = (
    <Link
      href="/payout"
      className="inline-flex items-center rounded-full border border-indigo-600 px-3 py-1.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50"
    >
      Upgrade to Host / Practice →
    </Link>
  );

  // Gate: full team analytics only for host; pro sees explanation
  if (payload.planTier !== 'host') {
    return (
      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">
            Team &amp; practice analytics
          </h1>
          <p className="text-sm text-gray-500">
            View performance metrics for everyone on your team (clinicians,
            nurses and admin staff).
          </p>
        </header>

        {payload.planTier === 'pro' && (
          <section className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50 p-4 text-xs text-indigo-900 space-y-2">
            <div className="font-semibold text-[13px]">
              Team analytics are only available on Host / Practice plans.
            </div>
            <p>
              You&apos;re on a <span className="font-semibold">Pro</span> plan.
              You can see your own analytics under{' '}
              <span className="font-semibold">
                Analytics → My consult performance
              </span>
              . To unlock practice-wide dashboards for clinicians, nurses and
              admin staff, upgrade to a Host / Practice plan.
            </p>
            {upgradeToHostCta}
          </section>
        )}

        {(payload.planTier === 'basic' || payload.planTier === 'free') && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-2">
            <div className="font-semibold text-[13px]">
              Team analytics are not available on your current plan.
            </div>
            <p>
              Upgrade to <span className="font-semibold">Pro</span> or{' '}
              <span className="font-semibold">Host / Practice</span> to unlock
              personal and team performance dashboards.
            </p>
            {upgradeToHostCta}
          </section>
        )}

        {err && (
          <p className="text-xs text-amber-700">
            {err}
          </p>
        )}
      </main>
    );
  }

  // Host view
  const totalStaff = kpis.totalStaff;
  const totalSessions = kpis.totalSessionsRange;
  const avgSessionsPerClinician = kpis.clinicians
    ? kpis.totalSessionsRange / kpis.clinicians
    : 0;
  const totalByRole = payload.roleBreakdown.reduce(
    (sum, r) => sum + r.headcount,
    0,
  );

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-900 md:text-2xl">
              Team &amp; practice analytics — {payload.practiceName}
            </h1>
            <Pill>Host / Practice</Pill>
            <Pill>Total staff: {totalStaff}</Pill>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Practice-wide view of sessions, punctuality and workloads across
            clinicians, nurses and admin staff.
          </p>
          <div className="mt-1 text-[11px] text-gray-500">
            Metrics are scoped to this practice or host account and use the same
            rules as admin dashboards.
          </div>
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
          label="Sessions in range"
          value={totalSessions.toLocaleString()}
          helper={`${kpis.totalPatientsRange.toLocaleString()} patients touched`}
        />
        <StatCard
          label="Total consult hours"
          value={`${totalHours.toFixed(1)} h`}
          helper={`${kpis.totalConsultationMinutesRange.toLocaleString()} minutes`}
        />
        <StatCard
          label="Active clinicians"
          value={`${kpis.activeClinicians}/${kpis.clinicians}`}
          helper={`Avg sessions per clinician: ${avgSessionsPerClinician.toFixed(
            1,
          )}`}
        />
        <StatCard
          label="On-time joins (clinicians)"
          value={`${kpis.avgClinicianOnTimeJoinRatePct.toFixed(1)}%`}
          helper={`Overrun rate: ${kpis.avgOverrunRatePct.toFixed(1)}%`}
        />
      </section>

      {/* Role breakdown + punctuality */}
      <section className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-2 rounded-2xl border bg-white p-4 text-xs shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Team composition
              </div>
              <div className="text-[11px] text-gray-500">
                Headcount, activity and share of sessions by role.
              </div>
            </div>
            <Pill>{totalByRole} staff</Pill>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr className="text-left">
                  <th className="px-2 py-1">Role</th>
                  <th className="px-2 py-1 text-right">Headcount</th>
                  <th className="px-2 py-1 text-right">Active</th>
                  <th className="px-2 py-1 text-right">Sessions</th>
                  <th className="px-2 py-1 text-right">Mix</th>
                </tr>
              </thead>
              <tbody>
                {payload.roleBreakdown.map((r) => (
                  <tr key={r.role} className="border-t">
                    <td className="px-2 py-1">{r.label}</td>
                    <td className="px-2 py-1 text-right">
                      {r.headcount.toLocaleString()}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {r.active.toLocaleString()}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {r.sessions.toLocaleString()}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {r.sharePct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
                {!payload.roleBreakdown.length && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-2 py-3 text-center text-gray-500"
                    >
                      No team members attached to this practice.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border bg-white p-4 text-xs shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Punctuality &amp; overruns (clinicians)
              </div>
              <div className="text-[11px] text-gray-500">
                Aggregated across all clinicians linked to this practice.
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-[11px] font-medium text-gray-700">
                Join punctuality
              </div>
              <BucketStrip rows={payload.punctualityBucketsClinician} />
            </div>
            <div>
              <div className="mb-1 text-[11px] font-medium text-gray-700">
                Slot overruns
              </div>
              <BucketStrip rows={payload.overrunBuckets} />
            </div>
          </div>
        </section>
      </section>

      {/* Member table */}
      <section className="space-y-2 rounded-2xl border bg-white p-4 text-xs shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-gray-900">
              Team members
            </div>
            <div className="text-[11px] text-gray-500">
              Click a member to see their individual performance dashboard.
            </div>
          </div>
          <Pill>{payload.members.length} members</Pill>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr className="text-left">
                <th className="px-2 py-1">Member</th>
                <th className="px-2 py-1">Role</th>
                <th className="px-2 py-1">Class</th>
                <th className="px-2 py-1 text-right">Sessions</th>
                <th className="px-2 py-1 text-right">Consult hours</th>
                <th className="px-2 py-1 text-right">On-time joins</th>
                <th className="px-2 py-1 text-right">Overruns</th>
                <th className="px-2 py-1 text-right">Rating</th>
                <th className="px-2 py-1 text-right">Last active</th>
                <th className="px-2 py-1 text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {payload.members.map((m) => (
                <tr key={m.memberId} className="border-t">
                  <td className="px-2 py-1 align-middle">
                    <div className="font-medium text-gray-900">
                      {m.name || m.memberId}
                    </div>
                    <div className="font-mono text-[10px] text-gray-500">
                      {m.memberId}
                    </div>
                  </td>
                  <td className="px-2 py-1 align-middle text-gray-700">
                    {m.roleLabel}
                  </td>
                  <td className="px-2 py-1 align-middle text-gray-500">
                    {m.classLabel || (m.isClinician ? 'Clinician' : '—')}
                  </td>
                  <td className="px-2 py-1 align-middle text-right">
                    {m.sessions.toLocaleString()}
                  </td>
                  <td className="px-2 py-1 align-middle text-right">
                    {(m.consultationMinutes / 60).toFixed(1)} h
                  </td>
                  <td className="px-2 py-1 align-middle text-right">
                    {m.isClinician
                      ? `${m.onTimeJoinRatePct.toFixed(1)}%`
                      : '—'}
                  </td>
                  <td className="px-2 py-1 align-middle text-right">
                    {m.isClinician
                      ? `${m.overrunRatePct.toFixed(1)}%`
                      : '—'}
                  </td>
                  <td className="px-2 py-1 align-middle text-right">
                    {m.avgRating != null ? m.avgRating.toFixed(2) : '—'}
                  </td>
                  <td className="px-2 py-1 align-middle text-right">
                    {m.lastActiveAt
                      ? new Date(m.lastActiveAt).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-2 py-1 align-middle text-right">
                    <Link
                      href={`/analytics/team/${encodeURIComponent(
                        m.memberId,
                      )}`}
                      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] hover:bg-gray-50"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {!payload.members.length && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-2 py-3 text-center text-gray-500"
                  >
                    No team members found for this practice.
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
