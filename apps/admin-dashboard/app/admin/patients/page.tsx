
// apps/admin-dashboard/app/admin/patients/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CreditCard,
  HeartPulse,
  Laptop,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  WalletCards,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

type PatientRow = {
  id: string;
  patientId: string;
  userId?: string | null;
  mrn?: string | null;
  name: string;
  displayName: string;
  initials: string;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  dob?: string | null;
  city?: string | null;
  avatarUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;

  totalAppointments: number;
  upcomingAppointments: number;
  pastAppointments: number;
  paymentPendingAppointments: number;
  simulationAppointments: number;
  totalSpendMinor: number;
  currency: string;

  hasDevices: boolean;
  deviceCount: number;
  deviceTypes: string[];
  lastDeviceSeenAt?: string | null;

  hasMedicalAid: boolean;
  medicalAidCount: number;
  defaultMedicalAid?: any;

  hasSponsorLinks: boolean;
  sponsorLinkCount: number;
  sponsorNames: string[];

  insightAlertCount: number;
  riskLevel: 'low' | 'medium' | 'high';

  recentlyOnboarded: boolean;
  profileIncomplete: boolean;
  missingFields: string[];
  stale: boolean;
  lastSeenAt?: string | null;
  latestAppointmentId?: string | null;
  latestRoomId?: string | null;
};

type ApiPayload = {
  ok: boolean;
  items: PatientRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: Record<string, number>;
  filterOptions: { key: string; label: string; count: number }[];
  applied: { q: string; filter: string; sort: string; dir: string };
  error?: string;
};

const FILTERS = [
  { key: 'all', label: 'All patients', icon: Users },
  { key: 'recent', label: 'Recently onboarded', icon: Sparkles },
  { key: 'booked', label: 'Booked', icon: CalendarClock },
  { key: 'simulation', label: 'Simulation', icon: Activity },
  { key: 'payment_pending', label: 'Payment pending', icon: CreditCard },
  { key: 'high_risk', label: 'High risk / InsightCore', icon: AlertTriangle },
  { key: 'devices', label: 'With devices', icon: Laptop },
  { key: 'medical_aid', label: 'Medical aid', icon: ShieldCheck },
  { key: 'sponsor_links', label: 'Sponsor-linked', icon: WalletCards },
  { key: 'no_booking', label: 'No bookings', icon: UserRound },
  { key: 'no_devices', label: 'No devices', icon: Laptop },
  { key: 'incomplete', label: 'Incomplete profile', icon: AlertTriangle },
  { key: 'stale', label: 'Stale', icon: HeartPulse },
];

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(minor: number, currency = 'ZAR') {
  const value = Math.max(0, Number(minor || 0)) / 100;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'ZAR',
    maximumFractionDigits: 2,
  }).format(value);
}

function riskClass(risk: string) {
  if (risk === 'high') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (risk === 'medium') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

function statusPillClass(tone: 'green' | 'amber' | 'rose' | 'slate' | 'blue' | 'violet') {
  const map = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
  };
  return map[tone];
}

function Pill({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'green' | 'amber' | 'rose' | 'slate' | 'blue' | 'violet' }) {
  return (
    <span className={cls('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium', statusPillClass(tone))}>
      {children}
    </span>
  );
}

function Avatar({ row }: { row: PatientRow }) {
  if (row.avatarUrl) {
    return (
      <img
        src={row.avatarUrl}
        alt=""
        className="h-11 w-11 rounded-2xl object-cover ring-1 ring-slate-200"
      />
    );
  }

  return (
    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
      {row.initials}
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
}: {
  title: string;
  value: number | string;
  sub: string;
  icon: any;
}) {
  return (
    <div className="rounded-3xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</div>
          <div className="mt-2 text-3xl font-semibold text-slate-950">{value}</div>
          <div className="mt-1 text-xs text-slate-500">{sub}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-2">
          <Icon className="h-5 w-5 text-slate-600" />
        </div>
      </div>
    </div>
  );
}

export default function AdminPatientsPage() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('created');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ApiPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const pageSize = 50;

  async function load() {
    setBusy(true);
    setErr('');

    try {
      const sp = new URLSearchParams();
      sp.set('filter', filter);
      sp.set('sort', sort);
      sp.set('dir', dir);
      sp.set('page', String(page));
      sp.set('pageSize', String(pageSize));
      if (q.trim()) sp.set('q', q.trim());

      const res = await fetch('/api/admin/patients?' + sp.toString(), {
        cache: 'no-store',
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'Unable to load admin patients');
      }

      setData(json);
    } catch (e: any) {
      setErr(e?.message || 'Unable to load admin patients');
      setData(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, sort, dir, page]);

  const summary = data?.summary || {};
  const rows = data?.items || [];
  const total = data?.total || 0;
  const maxPage = Math.max(1, Math.ceil(total / pageSize));

  const activeFilterLabel = useMemo(() => {
    return FILTERS.find((f) => f.key === filter)?.label || 'All patients';
  }, [filter]);

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
            Ambulant+ Patient Intelligence
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Admin Patients
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Global patient command centre for onboarding, bookings, payment risk, devices,
            sponsor links, medical aid readiness and InsightCore triage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/"
            className="rounded-xl border bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Admin home
          </Link>
          <button
            type="button"
            onClick={load}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            <RefreshCw className={cls('h-4 w-4', busy && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="All patients" value={summary.all ?? 0} sub="Registered patient profiles" icon={Users} />
        <StatCard title="Booked" value={summary.booked ?? 0} sub="At least one appointment" icon={CalendarClock} />
        <StatCard title="Payment pending" value={summary.payment_pending ?? 0} sub="Requires payment follow-up" icon={CreditCard} />
        <StatCard title="High risk" value={summary.high_risk ?? 0} sub="InsightCore or risk metadata" icon={AlertTriangle} />
      </section>

      <section className="rounded-3xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <form
            className="flex min-w-0 flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              load();
            }}
          >
            <div className="relative min-w-[260px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, email, phone, MRN, patient ID, user ID or city..."
                className="w-full rounded-2xl border bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              />
            </div>
            <button
              type="submit"
              className="rounded-2xl border bg-slate-950 px-4 py-2 text-sm font-medium text-white"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="rounded-2xl border bg-white px-3 py-2 text-sm"
            >
              <option value="created">Sort: onboarded</option>
              <option value="lastSeen">Sort: last seen</option>
              <option value="appointments">Sort: appointments</option>
              <option value="risk">Sort: risk</option>
              <option value="payment">Sort: payment pending</option>
              <option value="name">Sort: name</option>
            </select>

            <button
              type="button"
              onClick={() => {
                setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                setPage(1);
              }}
              className="rounded-2xl border bg-white px-3 py-2 text-sm"
            >
              {dir === 'asc' ? 'Ascending' : 'Descending'}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((item) => {
            const Icon = item.icon;
            const active = filter === item.key;
            const count = summary[item.key] ?? 0;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setFilter(item.key);
                  setPage(1);
                }}
                className={cls(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition',
                  active
                    ? 'border-slate-950 bg-slate-950 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
                <span className={cls('rounded-full px-1.5 py-0.5 text-[10px]', active ? 'bg-white/15' : 'bg-white')}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {err && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {err}
        </div>
      )}

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="flex flex-col gap-1 border-b px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">{activeFilterLabel}</h2>
            <p className="text-xs text-slate-500">
              {busy ? 'Loading...' : `${total} matching patient${total === 1 ? '' : 's'}`}
            </p>
          </div>

          <div className="text-xs text-slate-500">
            Page {page} of {maxPage}
          </div>
        </div>

        <div className="divide-y">
          {rows.map((row) => (
            <article key={row.id} className="grid gap-4 px-4 py-4 xl:grid-cols-[minmax(320px,1.5fr)_1fr_1fr_1fr_auto] xl:items-center">
              <div className="flex min-w-0 items-start gap-3">
                <Avatar row={row} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-slate-950">{row.name}</h3>
                    <span className={cls('rounded-full border px-2 py-0.5 text-[11px] font-medium', riskClass(row.riskLevel))}>
                      {row.riskLevel} risk
                    </span>
                    {row.recentlyOnboarded && <Pill tone="blue">new</Pill>}
                    {row.profileIncomplete && <Pill tone="amber">incomplete</Pill>}
                    {row.simulationAppointments > 0 && <Pill tone="violet">simulation</Pill>}
                  </div>

                  <div className="mt-1 truncate text-xs text-slate-500">
                    {row.email || 'No email'} · {row.phone || 'No phone'} · {row.city || 'No city'}
                  </div>

                  <div className="mt-1 truncate font-mono text-[11px] text-slate-400">
                    {row.id}
                    {row.userId ? ` · user: ${row.userId}` : ''}
                  </div>
                </div>
              </div>

              <div className="text-xs">
                <div className="font-semibold text-slate-900">{row.totalAppointments} appointments</div>
                <div className="mt-1 text-slate-500">
                  {row.upcomingAppointments} upcoming · {row.pastAppointments} past
                </div>
                <div className="mt-1 text-slate-500">
                  Last seen: {formatDate(row.lastSeenAt)}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {row.paymentPendingAppointments > 0 && (
                  <Pill tone="rose">{row.paymentPendingAppointments} payment pending</Pill>
                )}
                {row.totalSpendMinor > 0 && (
                  <Pill tone="green">{formatMoney(row.totalSpendMinor, row.currency)}</Pill>
                )}
                {row.stale && <Pill tone="amber">stale</Pill>}
                {row.insightAlertCount > 0 && <Pill tone="rose">{row.insightAlertCount} alert(s)</Pill>}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {row.hasDevices ? <Pill tone="green">{row.deviceCount} device(s)</Pill> : <Pill>No device</Pill>}
                {row.hasMedicalAid ? <Pill tone="blue">{row.medicalAidCount} medical aid</Pill> : <Pill>No medical aid</Pill>}
                {row.hasSponsorLinks ? <Pill tone="violet">{row.sponsorLinkCount} sponsor link(s)</Pill> : null}
              </div>

              <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                {row.latestRoomId ? (
                  <Link
                    href={`/consult?patientId=${encodeURIComponent(row.id)}&roomId=${encodeURIComponent(row.latestRoomId)}`}
                    className="rounded-xl border bg-slate-950 px-3 py-2 text-xs font-medium text-white"
                  >
                    Open care context
                  </Link>
                ) : (
                  <Link
                    href={`/consult?patientId=${encodeURIComponent(row.id)}`}
                    className="rounded-xl border bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Open profile
                  </Link>
                )}
              </div>
            </article>
          ))}

          {!busy && rows.length === 0 && (
            <div className="px-4 py-12 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-50">
                <Users className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-950">No patients found</h3>
              <p className="mt-1 text-sm text-slate-500">
                Try a different filter or clear the search query.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t px-4 py-3">
          <button
            type="button"
            disabled={page <= 1 || busy}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-xl border bg-white px-3 py-2 text-sm disabled:opacity-40"
          >
            Previous
          </button>

          <div className="text-xs text-slate-500">
            Showing {rows.length} of {total}
          </div>

          <button
            type="button"
            disabled={page >= maxPage || busy}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-xl border bg-white px-3 py-2 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </section>
    </main>
  );
}
