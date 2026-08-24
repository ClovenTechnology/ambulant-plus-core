'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Banknote,
  Boxes,
  Building2,
  CircleDollarSign,
  Clock3,
  FlaskConical,
  HeartPulse,
  MonitorSmartphone,
  PackageCheck,
  Pill,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Truck,
  UserRoundCheck,
  Users,
  Wifi,
} from 'lucide-react';

type Section<T> = {
  available: boolean;
  data: T | null;
  reason?: string;
};

type DashboardData = {
  ok: boolean;
  generatedAt: string;
  liveWindowSeconds: number;
  sections: {
    patients: Section<any>;
    clinicians: Section<any>;
    consultations: Section<any>;
    network: Section<any>;
    staff: Section<any>;
    commerce: Section<any>;
    finance: Section<any>;
  };
};

type Props = {
  userName?: string | null;
  userEmail?: string | null;
  tenant?: string | null;
  scopes: string[];
};

const SUPER_SCOPES = ['superadmin', 'admin:all', '*'] as const;

function hasAny(scopes: string[], need?: string | string[]) {
  const set = new Set(scopes);
  if (SUPER_SCOPES.some((scope) => set.has(scope))) return true;
  if (!need) return true;
  const required = Array.isArray(need) ? need : [need];
  return required.some((scope) => set.has(scope));
}

function fmtNumber(value: unknown) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('en-ZA').format(Number(value));
}

function fmtMoney(cents: unknown) {
  if (cents == null || Number.isNaN(Number(cents))) return '—';
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(Number(cents) / 100);
}

function since(iso?: string) {
  if (!iso) return 'Not refreshed';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function Metric({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-1.5 text-2xl font-black tracking-tight text-slate-950">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-1 text-base font-bold text-slate-900">{value}</div>
    </div>
  );
}

function SectionCard({
  title,
  eyebrow,
  icon: Icon,
  href,
  children,
}: {
  title: string;
  eyebrow: string;
  icon: any;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</div>
            <h2 className="truncate text-lg font-extrabold text-slate-950">{title}</h2>
          </div>
        </div>
        {href ? (
          <Link href={href} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950">
            Open <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Unavailable({ reason }: { reason?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
      This summary is unavailable for the current authority context{reason === 'finance_scope_required' ? ' because Enterprise Finance access is required.' : '.'}
    </div>
  );
}

export default function AdminCommandCentre({ userName, userEmail, tenant, scopes }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch('/api/admin/command-centre', {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || `Dashboard request failed (${response.status})`);
      setData(payload);
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Command Centre data is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
    const timer = window.setInterval(() => {
      void load(true);
      setRefreshTick((value) => value + 1);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const canFinance = useMemo(
    () => hasAny(scopes, ['finance', 'finance:read', 'finance:manage', 'finance.manage']),
    [scopes],
  );

  const patients = data?.sections?.patients;
  const clinicians = data?.sections?.clinicians;
  const consultations = data?.sections?.consultations;
  const network = data?.sections?.network;
  const staff = data?.sections?.staff;
  const commerce = data?.sections?.commerce;
  const finance = data?.sections?.finance;

  const liveWindow = data?.liveWindowSeconds ? `${Math.round(data.liveWindowSeconds / 60)} min heartbeat window` : 'live heartbeat';

  return (
    <main className="space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-[28px] border border-slate-800 bg-slate-950 px-6 py-6 text-white shadow-[0_24px_70px_rgba(15,23,42,0.18)] lg:px-8 lg:py-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-3 -top-4 h-36 w-36 rounded-full bg-white/[0.035]" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
              <span>Ambulant+ Operations</span>
              <span className="h-1 w-1 rounded-full bg-emerald-400" />
              <span>Command Centre</span>
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">One operating picture across care, people, network and finance.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              {userName ? `${userName}, ` : ''}this view uses authoritative platform records and live presence signals. Missing authority is shown as unavailable rather than converted into a zero.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
              {userEmail ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{userEmail}</span> : null}
              {tenant ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Tenant · {tenant}</span> : null}
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-emerald-200">Live presence · {liveWindow}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-xs text-slate-400">
              <div>Last refresh</div>
              <div className="mt-0.5 font-semibold text-slate-200">{since(data?.generatedAt)}</div>
            </div>
            <button
              type="button"
              onClick={() => void load(false)}
              disabled={loading}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-50"
              title={`Refresh dashboard ${refreshTick}`}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Command Centre data unavailable.</strong> {error}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Patients" value={patients?.available ? fmtNumber(patients.data?.total) : '—'} hint={patients?.available ? `${fmtNumber(patients.data?.onlineNow)} online now` : 'Unavailable'} />
        <Metric label="Clinicians" value={clinicians?.available ? fmtNumber(clinicians.data?.total) : '—'} hint={clinicians?.available ? `${fmtNumber(clinicians.data?.onlineNow)} online now` : 'Unavailable'} />
        <Metric label="Consultations" value={consultations?.available ? fmtNumber(consultations.data?.total) : '—'} hint={consultations?.available ? `${fmtNumber(consultations.data?.inSession)} in session` : 'Unavailable'} />
        <Metric label="Network partners" value={network?.available ? fmtNumber((network.data?.labs?.total || 0) + (network.data?.phlebs?.total || 0) + (network.data?.pharmacies?.total || 0) + (network.data?.riders?.total || 0)) : '—'} hint="Labs · phlebs · pharmacies · riders" />
        <Metric label="Payroll liability" value={finance?.available ? fmtMoney(finance.data?.payrollLiabilityCents) : '—'} hint={finance?.available ? 'Outstanding payroll entitlement' : canFinance ? 'Unavailable' : 'Finance authority required'} />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard title="Patients" eyebrow="Care population" icon={Users} href="/patients">
          {patients?.available ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniMetric label="Total" value={fmtNumber(patients.data?.total)} />
              <MiniMetric label="Online now" value={fmtNumber(patients.data?.onlineNow)} />
              <MiniMetric label="Consulted" value={fmtNumber(patients.data?.consulted)} />
              <MiniMetric label="Own devices" value={fmtNumber(patients.data?.ownDevices)} />
            </div>
          ) : <Unavailable reason={patients?.reason} />}
        </SectionCard>

        <SectionCard title="Clinicians" eyebrow="Clinical workforce" icon={Stethoscope} href="/clinicians">
          {clinicians?.available ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniMetric label="Total" value={fmtNumber(clinicians.data?.total)} />
                <MiniMetric label="Online now" value={fmtNumber(clinicians.data?.onlineNow)} />
                <MiniMetric label="Consulted" value={fmtNumber(clinicians.data?.consulted)} />
                <MiniMetric label="Training done" value={fmtNumber(clinicians.data?.training?.completed)} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-3">
                  <div className="mb-2 text-xs font-bold text-slate-700">Onboarding pathway</div>
                  <div className="grid grid-cols-3 gap-2">
                    <MiniMetric label="Pay later" value={fmtNumber(clinicians.data?.paymentPath?.payLater)} />
                    <MiniMetric label="Deposit" value={fmtNumber(clinicians.data?.paymentPath?.deposit)} />
                    <MiniMetric label="Full" value={fmtNumber(clinicians.data?.paymentPath?.full)} />
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 p-3">
                  <div className="mb-2 text-xs font-bold text-slate-700">Account state</div>
                  <div className="grid grid-cols-2 gap-2">
                    <MiniMetric label="Active" value={fmtNumber(clinicians.data?.account?.active)} />
                    <MiniMetric label="Pending" value={fmtNumber(clinicians.data?.account?.pending)} />
                    <MiniMetric label="Suspended" value={fmtNumber(clinicians.data?.account?.suspended)} />
                    <MiniMetric label="Archived" value={fmtNumber(clinicians.data?.account?.archived)} />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-950 px-4 py-3 text-white">
                <div><div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Training pipeline</div><div className="mt-1 text-sm font-semibold">{fmtNumber(clinicians.data?.training?.scheduled)} scheduled · {fmtNumber(clinicians.data?.training?.completed)} completed</div></div>
                <Link href="/admin/training" className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/15">Open training</Link>
              </div>
            </div>
          ) : <Unavailable reason={clinicians?.reason} />}
        </SectionCard>

        <SectionCard title="Consultations" eyebrow="Live care delivery" icon={HeartPulse} href="/cases">
          {consultations?.available ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <MiniMetric label="Total" value={fmtNumber(consultations.data?.total)} />
              <MiniMetric label="In session" value={fmtNumber(consultations.data?.inSession)} />
              <MiniMetric label="With IoMTs" value={fmtNumber(consultations.data?.withIoMTs)} />
              <MiniMetric label="Card" value={fmtNumber(consultations.data?.card)} />
              <MiniMetric label="Medical aid" value={fmtNumber(consultations.data?.medicalAid)} />
            </div>
          ) : <Unavailable reason={consultations?.reason} />}
        </SectionCard>

        <SectionCard title="Care network" eyebrow="Distributed operations" icon={Building2} href="/medreach">
          {network?.available ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: FlaskConical, title: 'Labs', total: network.data?.labs?.total, detail: `${fmtNumber(network.data?.labs?.active)} active · ${fmtNumber(network.data?.labs?.pending)} pending` },
                { icon: Syringe, title: 'Phlebotomists', total: network.data?.phlebs?.total, detail: `${fmtNumber(network.data?.phlebs?.active)} active · ${fmtNumber(network.data?.phlebs?.completedJobs)} completed jobs` },
                { icon: Pill, title: 'Pharmacies', total: network.data?.pharmacies?.total, detail: `${fmtNumber(network.data?.pharmacies?.active)} active` },
                { icon: Truck, title: 'Riders', total: network.data?.riders?.total, detail: `${fmtNumber(network.data?.riders?.onlineNow)} online · ${fmtNumber(network.data?.riders?.onJob)} on job` },
              ].map((item) => (
                <div key={item.title} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-white shadow-sm"><item.icon className="h-4 w-4 text-slate-700" /></div>
                  <div><div className="text-sm font-bold text-slate-950">{item.title} · {fmtNumber(item.total)}</div><div className="text-xs text-slate-500">{item.detail}</div></div>
                </div>
              ))}
            </div>
          ) : <Unavailable reason={network?.reason} />}
        </SectionCard>

        <SectionCard title="People & staff" eyebrow="Internal operations" icon={UserRoundCheck} href="/admin/staff">
          {staff?.available ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniMetric label="Staff" value={fmtNumber(staff.data?.total)} />
              <MiniMetric label="Online now" value={fmtNumber(staff.data?.onlineNow)} />
              <MiniMetric label="Workforce payees" value={fmtNumber(staff.data?.workforcePayees)} />
              <MiniMetric label="Active" value={fmtNumber(staff.data?.lifecycle?.active)} />
              <MiniMetric label="On leave" value={fmtNumber(staff.data?.lifecycle?.leave)} />
              <MiniMetric label="Suspended" value={fmtNumber(staff.data?.lifecycle?.suspended)} />
              <MiniMetric label="Archived" value={fmtNumber(staff.data?.lifecycle?.archived)} />
              <MiniMetric label="Presence" value={<span className="inline-flex items-center gap-1"><Wifi className="h-4 w-4" /> Live</span>} />
            </div>
          ) : <Unavailable reason={staff?.reason} />}
        </SectionCard>

        <SectionCard title="Commerce & fulfilment" eyebrow="Platform-owned commerce" icon={Boxes} href="/settings/shop">
          {commerce?.available ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniMetric label="Products" value={fmtNumber(commerce.data?.products?.total)} />
              <MiniMetric label="Published" value={fmtNumber(commerce.data?.products?.published)} />
              <MiniMetric label="Orders" value={fmtNumber(commerce.data?.orders?.total)} />
              <MiniMetric label="Pending" value={fmtNumber(commerce.data?.orders?.pending)} />
              <MiniMetric label="Paid" value={fmtNumber(commerce.data?.orders?.paid)} />
              <MiniMetric label="Fulfilled" value={fmtNumber(commerce.data?.orders?.fulfilled)} />
              <MiniMetric label="Active products" value={fmtNumber(commerce.data?.products?.active)} />
              <MiniMetric label="Authority" value={<span className="inline-flex items-center gap-1"><ShieldCheck className="h-4 w-4" /> Canonical</span>} />
            </div>
          ) : <Unavailable reason={commerce?.reason} />}
        </SectionCard>
      </div>

      <SectionCard title="Enterprise finance" eyebrow="Financial command layer" icon={CircleDollarSign} href="/admin/enterprise-finance">
        {finance?.available ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric label="Gross revenue" value={fmtMoney(finance.data?.grossRevenueCents)} />
            <Metric label="Net platform revenue" value={fmtMoney(finance.data?.netPlatformRevenueCents)} />
            <Metric label="Manual inflows" value={fmtMoney(finance.data?.manualInflowsCents)} />
            <Metric label="Payroll liability" value={fmtMoney(finance.data?.payrollLiabilityCents)} />
            <Metric label="Commission payable" value={fmtMoney(finance.data?.commissionPayableCents)} />
          </div>
        ) : <Unavailable reason={finance?.reason} />}
      </SectionCard>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          { href: '/admin/clinicians/onboarding', icon: Stethoscope, title: 'Clinician onboarding', note: 'Payment pathway, training and activation' },
          { href: '/admin/training', icon: Clock3, title: 'Training control', note: 'Schedules, participation and completion' },
          { href: '/admin/enterprise-finance/payroll', icon: Banknote, title: 'Payroll & arrears', note: 'Entitlements, payslips and settlement' },
          { href: '/settings/shop', icon: PackageCheck, title: 'Commerce Studio', note: 'Products, publication and buyer eligibility' },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100"><item.icon className="h-5 w-5 text-slate-800" /></div>
            <div className="min-w-0"><div className="font-bold text-slate-950">{item.title}</div><div className="truncate text-xs text-slate-500">{item.note}</div></div>
            <ArrowRight className="ml-auto h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" />
          </Link>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> Live values use canonical platform state.</span>
        <span className="inline-flex items-center gap-1"><MonitorSmartphone className="h-3.5 w-3.5" /> IoMT consultation counts require actual vital activity.</span>
      </div>
    </main>
  );
}
