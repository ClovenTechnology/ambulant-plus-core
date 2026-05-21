// apps/patient-app/app/encounters/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  HeartPulse,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Stethoscope,
  Video,
} from 'lucide-react';
import {
  caseStatusClasses,
  formatDateTime,
  modeLabel,
  relativeLabel,
  statusLabel,
} from '@/lib/encounters/display';

type Encounter = {
  id: string;
  caseId?: string | null;
  status?: string | null;
  visitMode?: string | null;
  mode?: string | null;
  start?: string | null;
  stop?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  primaryTime?: string | null;
  clinician?: { id?: string | null; name?: string | null; displayName?: string | null; specialty?: string | null } | null;
  appointment?: any;
  payment?: any;
  documents?: any[];
  counts?: Record<string, number>;
  summaryPayload?: any;
};

type CaseItem = {
  id: string;
  title?: string | null;
  status?: string | null;
  updatedAt?: string | null;
  encountersCount?: number;
  latestEncounter?: Encounter | null;
  encounters?: Encounter[];
};

type ApiPayload = {
  ok?: boolean;
  cases?: CaseItem[];
  encounters?: Encounter[];
  summary?: any;
  error?: string;
  message?: string;
};

type FilterState = 'all' | 'active' | 'completed' | 'scheduled' | 'with-documents';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

async function fetchEncounters(): Promise<ApiPayload> {
  const res = await fetch('/api/encounters?limit=100', { cache: 'no-store' });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.message || data?.error || `Encounter service failed (${res.status})`);
  }
  return data || { cases: [], encounters: [] };
}

function latestTime(item: CaseItem) {
  return (
    item.updatedAt ||
    item.latestEncounter?.primaryTime ||
    item.latestEncounter?.endedAt ||
    item.latestEncounter?.stop ||
    item.latestEncounter?.startedAt ||
    item.latestEncounter?.start ||
    item.encounters?.[0]?.primaryTime ||
    null
  );
}

function latestEncounter(item: CaseItem) {
  return item.latestEncounter || item.encounters?.[0] || null;
}

function titleFor(item: CaseItem) {
  const latest = latestEncounter(item);
  const summary = latest?.summaryPayload && typeof latest.summaryPayload === 'object' ? latest.summaryPayload : null;
  return item.title || summary?.reason || summary?.diagnosisText || summary?.chiefComplaint || 'Clinical encounter';
}

function statusKey(value?: string | null) {
  return String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function isActiveStatus(value?: string | null) {
  const key = statusKey(value);
  return ['open', 'active', 'inprogress', 'scheduled', 'triage', 'consult', 'pending'].includes(key);
}

function isCompletedStatus(value?: string | null) {
  const key = statusKey(value);
  return ['completed', 'complete', 'closed', 'done', 'ended'].includes(key);
}

function deriveCases(payload: ApiPayload): CaseItem[] {
  const rawCases = Array.isArray(payload.cases) ? payload.cases : [];
  if (rawCases.length) return rawCases;

  const map = new Map<string, CaseItem>();
  const encounters = Array.isArray(payload.encounters) ? payload.encounters : [];

  for (const e of encounters) {
    if (!e?.id) continue;
    const caseId = String(e.caseId || `encounter-${e.id}`);
    const existing = map.get(caseId);
    const time = e.primaryTime || e.endedAt || e.stop || e.startedAt || e.start || null;

    if (!existing) {
      map.set(caseId, {
        id: caseId,
        title: titleFor({ id: caseId, latestEncounter: e }),
        status: e.status || 'open',
        updatedAt: time,
        encountersCount: 1,
        latestEncounter: e,
        encounters: [e],
      });
    } else {
      existing.encounters = [...(existing.encounters || []), e];
      existing.encountersCount = existing.encounters.length;
      const current = Date.parse(String(time || '')) || 0;
      const previous = Date.parse(String(existing.updatedAt || '')) || 0;
      if (current >= previous) {
        existing.latestEncounter = e;
        existing.updatedAt = time;
        existing.status = e.status || existing.status;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => (Date.parse(String(latestTime(b) || '')) || 0) - (Date.parse(String(latestTime(a) || '')) || 0));
}

function Metric({ label, value, note, icon: Icon }: { label: string; value: string | number; note: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
          <div className="mt-2 text-3xl font-black text-slate-950">{value}</div>
          <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-100 bg-cyan-50 text-cyan-700">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function EmptyState({ error, onRetry }: { error?: string | null; onRetry: () => void }) {
  return (
    <div className="rounded-[36px] border border-dashed border-slate-200 bg-white/82 p-10 text-center shadow-[0_20px_70px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-[28px] bg-cyan-50 text-cyan-700">
        <ClipboardList className="h-8 w-8" />
      </div>
      <h2 className="mt-5 text-2xl font-black tracking-tight text-slate-950">
        {error ? 'Encounter timeline unavailable' : 'Your encounter timeline is ready'}
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600">
        {error || 'Completed consultations, active encounters, prescriptions, documents, payments, vitals and follow-up actions will appear here as your care journey develops.'}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {error ? (
          <button type="button" onClick={onRetry} className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-black text-white">
            Try again
          </button>
        ) : (
          <Link href="/appointments/new" className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-black text-white">
            Book consultation
          </Link>
        )}
        <Link href="/myCare" className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700">
          Open myCare
        </Link>
      </div>
    </div>
  );
}

function CaseCard({ item }: { item: CaseItem }) {
  const latest = latestEncounter(item);
  const updated = latestTime(item);
  const status = item.status || latest?.status || 'open';
  const title = titleFor(item);
  const href = latest?.id ? `/encounters/${encodeURIComponent(latest.id)}` : `/encounters/${encodeURIComponent(item.id)}`;
  const count = item.encountersCount || item.encounters?.length || 1;
  const documents = Number(latest?.counts?.documents || latest?.documents?.length || 0);
  const erx = Number(latest?.counts?.erxOrders || 0);
  const labs = Number(latest?.counts?.labOrders || 0);

  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-[32px] border border-white/70 bg-white/86 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-[0_28px_80px_rgba(15,23,42,0.10)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full border px-3 py-1 text-xs font-black', caseStatusClasses(status))}>{statusLabel(status)}</span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-500">
              {count} session{count === 1 ? '' : 's'}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
              {modeLabel(latest?.visitMode || latest?.mode)}
            </span>
          </div>
          <h3 className="mt-4 truncate text-xl font-black text-slate-950">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {latest?.clinician?.displayName || latest?.clinician?.name || 'Care team'}{latest?.clinician?.specialty ? ` · ${latest.clinician.specialty}` : ''}
          </p>
        </div>

        <span className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-100 bg-slate-50 text-slate-500 transition group-hover:border-cyan-100 group-hover:bg-cyan-50 group-hover:text-cyan-700">
          <ArrowRight className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-3xl border border-slate-100 bg-slate-50/80 p-3">
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Last activity</div>
          <div className="mt-1 text-sm font-black text-slate-900">{relativeLabel(updated)}</div>
          <div className="mt-0.5 text-xs text-slate-500">{formatDateTime(updated)}</div>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-slate-50/80 p-3">
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Care outputs</div>
          <div className="mt-1 text-sm font-black text-slate-900">{documents} document{documents === 1 ? '' : 's'}</div>
          <div className="mt-0.5 text-xs text-slate-500">Prescriptions, notes, referrals</div>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-slate-50/80 p-3">
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Orders</div>
          <div className="mt-1 text-sm font-black text-slate-900">{erx} eRx · {labs} lab</div>
          <div className="mt-0.5 text-xs text-slate-500">Follow-up actions linked</div>
        </div>
      </div>
    </Link>
  );
}

export default function EncountersPage() {
  const [payload, setPayload] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterState>('all');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setPayload(await fetchEncounters());
    } catch (err: any) {
      setPayload(null);
      setError(err?.message || 'Could not load encounters.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const cases = useMemo(() => deriveCases(payload || {}), [payload]);
  const encounters = useMemo(() => (Array.isArray(payload?.encounters) ? payload.encounters : cases.flatMap((c) => c.encounters || [])), [payload, cases]);

  const metrics = useMemo(() => {
    const completed = encounters.filter((e) => isCompletedStatus(e.status)).length;
    const active = cases.filter((c) => isActiveStatus(c.status || c.latestEncounter?.status)).length;
    const docs = encounters.reduce((sum, e) => sum + Number(e.counts?.documents || e.documents?.length || 0), 0);
    return {
      totalCases: cases.length,
      active,
      completed,
      docs,
    };
  }, [cases, encounters]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cases.filter((item) => {
      const latest = latestEncounter(item);
      const haystack = [
        titleFor(item),
        item.status,
        latest?.status,
        latest?.clinician?.name,
        latest?.clinician?.displayName,
        latest?.clinician?.specialty,
        latest?.visitMode,
        latest?.mode,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (q && !haystack.includes(q)) return false;
      if (filter === 'active') return isActiveStatus(item.status || latest?.status);
      if (filter === 'completed') return isCompletedStatus(item.status || latest?.status);
      if (filter === 'scheduled') return statusKey(item.status || latest?.status).includes('scheduled');
      if (filter === 'with-documents') return Number(latest?.counts?.documents || latest?.documents?.length || 0) > 0;
      return true;
    });
  }, [cases, filter, query]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-cyan-50/30 to-indigo-50/40 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[36px] border border-white/70 bg-white/82 p-6 shadow-[0_24px_90px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(34,211,238,0.15),transparent_34%),radial-gradient(circle_at_90%_0%,rgba(99,102,241,0.12),transparent_30%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-800">
                <ShieldCheck className="h-3.5 w-3.5" /> Care intelligence
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Your encounters</h1>
              <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                Review active cases, completed consultations, prescriptions, documents, payments and follow-up actions from one clinically organised timeline.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/appointments/new" className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-900/15">
                Book consultation <ArrowRight className="h-4 w-4" />
              </Link>
              <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Cases" value={metrics.totalCases} note="Grouped care episodes" icon={ClipboardList} />
          <Metric label="Active" value={metrics.active} note="Open, scheduled or in-progress" icon={Activity} />
          <Metric label="Completed" value={metrics.completed} note="Closed clinical sessions" icon={CheckCircle2} />
          <Metric label="Documents" value={metrics.docs} note="Prescriptions, notes and files" icon={FileText} />
        </section>

        <section className="rounded-[32px] border border-white/70 bg-white/86 p-4 shadow-[0_20px_70px_rgba(15,23,42,0.06)] backdrop-blur-xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by clinician, case, mode, status…"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none ring-cyan-500/20 transition focus:border-cyan-300 focus:ring-4"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                ['all', 'All'],
                ['active', 'Active'],
                ['completed', 'Completed'],
                ['scheduled', 'Scheduled'],
                ['with-documents', 'With documents'],
              ] as Array<[FilterState, string]>).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={cn(
                    'rounded-full border px-4 py-2 text-xs font-black transition',
                    filter === id ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {loading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-56 animate-pulse rounded-[32px] border border-white/70 bg-white/70" />
            ))}
          </div>
        ) : error || filtered.length === 0 ? (
          <EmptyState error={error || null} onRetry={load} />
        ) : (
          <section className="grid gap-4 lg:grid-cols-2">
            {filtered.map((item) => <CaseCard key={item.id} item={item} />)}
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-3">
          <Link href="/vitals" className="rounded-[28px] border border-white/70 bg-white/82 p-5 shadow-sm backdrop-blur-xl">
            <HeartPulse className="h-5 w-5 text-rose-600" />
            <div className="mt-3 font-black text-slate-950">Vitals workspace</div>
            <p className="mt-1 text-sm text-slate-500">Review device readings connected to your care timeline.</p>
          </Link>
          <Link href="/medications" className="rounded-[28px] border border-white/70 bg-white/82 p-5 shadow-sm backdrop-blur-xl">
            <Stethoscope className="h-5 w-5 text-emerald-600" />
            <div className="mt-3 font-black text-slate-950">Medication plan</div>
            <p className="mt-1 text-sm text-slate-500">Track eRx, reminders and adherence after consultations.</p>
          </Link>
          <Link href="/appointments/new" className="rounded-[28px] border border-white/70 bg-white/82 p-5 shadow-sm backdrop-blur-xl">
            <CalendarClock className="h-5 w-5 text-cyan-700" />
            <div className="mt-3 font-black text-slate-950">Next consultation</div>
            <p className="mt-1 text-sm text-slate-500">Book follow-up care with the right clinician.</p>
          </Link>
        </section>
      </div>
    </main>
  );
}
