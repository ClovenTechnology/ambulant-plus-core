// apps/patient-app/app/allergies/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileDown,
  Filter,
  Plus,
  Printer,
  Search,
  ShieldAlert,
  XCircle,
} from 'lucide-react';

import AllergiesClient from './allergies-client';

export const dynamic = 'force-dynamic';

type TabKey = 'profile' | 'reactions';

type Severity = 'mild' | 'moderate' | 'severe';

type ReactionLogItem = {
  id: string;
  occurredAtISO: string; // ISO datetime
  suspectedTrigger: string;
  symptoms: string[]; // small tags
  severity: Severity;
  medsTaken?: string;
  notes?: string;
  resolvedAtISO?: string;
};

const LS_TAB = 'ambulant.allergies.tab';
const LS_LOG = 'ambulant.allergies.reactionLog.v1';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function uid() {
  return `rx_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function safeParseJSON<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function formatWhen(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function severityMeta(s: Severity) {
  if (s === 'severe') {
    return { label: 'Severe', cls: 'border-rose-200 bg-rose-50 text-rose-800', Icon: XCircle };
  }
  if (s === 'moderate') {
    return { label: 'Moderate', cls: 'border-amber-200 bg-amber-50 text-amber-900', Icon: AlertTriangle };
  }
  return { label: 'Mild', cls: 'border-emerald-200 bg-emerald-50 text-emerald-800', Icon: CheckCircle2 };
}

function chipText(s: string) {
  return String(s || '').trim().slice(0, 40);
}

export default function AllergiesPage() {
  const [tab, setTab] = useState<TabKey>('profile');

  // Reaction log state (localStorage-first until APIs are ready)
  const [log, setLog] = useState<ReactionLogItem[]>([]);
  const [query, setQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
  const [windowFilter, setWindowFilter] = useState<'30d' | '90d' | 'all'>('30d');

  // New entry form
  const [occurredAtISO, setOccurredAtISO] = useState(() => {
    const now = new Date();
    // yyyy-MM-ddTHH:mm for input[type=datetime-local]
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(
      now.getMinutes()
    )}`;
  });
  const [suspectedTrigger, setSuspectedTrigger] = useState('');
  const [severity, setSeverity] = useState<Severity>('mild');
  const [symptomsText, setSymptomsText] = useState('');
  const [medsTaken, setMedsTaken] = useState('');
  const [notes, setNotes] = useState('');
  const [resolvedAtISO, setResolvedAtISO] = useState('');

  // Load saved tab + log
  useEffect(() => {
    try {
      const savedTab = (localStorage.getItem(LS_TAB) as TabKey | null) || 'profile';
      if (savedTab === 'profile' || savedTab === 'reactions') setTab(savedTab);
    } catch {}

    try {
      const saved = safeParseJSON<ReactionLogItem[]>(localStorage.getItem(LS_LOG), []);
      setLog(Array.isArray(saved) ? saved : []);
    } catch {}
  }, []);

  // Persist tab
  useEffect(() => {
    try {
      localStorage.setItem(LS_TAB, tab);
    } catch {}
  }, [tab]);

  // Persist log
  useEffect(() => {
    try {
      localStorage.setItem(LS_LOG, JSON.stringify(log));
    } catch {}
  }, [log]);

  const filteredLog = useMemo(() => {
    const q = query.trim().toLowerCase();

    const now = Date.now();
    const cutoff =
      windowFilter === 'all'
        ? -Infinity
        : now - (windowFilter === '30d' ? 30 : 90) * 24 * 60 * 60 * 1000;

    return [...log]
      .filter((it) => {
        const ms = new Date(it.occurredAtISO).getTime();
        return Number.isFinite(ms) && ms >= cutoff;
      })
      .filter((it) => (severityFilter === 'all' ? true : it.severity === severityFilter))
      .filter((it) => {
        if (!q) return true;
        const hay = [
          it.suspectedTrigger,
          it.severity,
          it.medsTaken || '',
          it.notes || '',
          ...(it.symptoms || []),
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => new Date(b.occurredAtISO).getTime() - new Date(a.occurredAtISO).getTime());
  }, [log, query, severityFilter, windowFilter]);

  const trends = useMemo(() => {
    const total = filteredLog.length;
    const bySeverity = { mild: 0, moderate: 0, severe: 0 } as Record<Severity, number>;
    const triggerCounts = new Map<string, number>();
    let lastAt: string | null = null;

    for (const it of filteredLog) {
      bySeverity[it.severity] = (bySeverity[it.severity] || 0) + 1;

      const t = chipText(it.suspectedTrigger || '').toLowerCase();
      if (t) triggerCounts.set(t, (triggerCounts.get(t) || 0) + 1);

      if (!lastAt) lastAt = it.occurredAtISO;
      else if (new Date(it.occurredAtISO).getTime() > new Date(lastAt).getTime()) lastAt = it.occurredAtISO;
    }

    const topTriggers = Array.from(triggerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, count]) => ({ name, count }));

    return { total, bySeverity, topTriggers, lastAt };
  }, [filteredLog]);

  function resetForm() {
    setSuspectedTrigger('');
    setSeverity('mild');
    setSymptomsText('');
    setMedsTaken('');
    setNotes('');
    setResolvedAtISO('');
  }

  function addEntry() {
    const trig = suspectedTrigger.trim();
    if (!trig) return;

    const symptoms = symptomsText
      .split(',')
      .map((s) => chipText(s))
      .filter(Boolean)
      .slice(0, 12);

    const occurredISO = new Date(occurredAtISO).toISOString();

    const item: ReactionLogItem = {
      id: uid(),
      occurredAtISO: occurredISO,
      suspectedTrigger: trig,
      symptoms,
      severity,
      medsTaken: medsTaken.trim() || undefined,
      notes: notes.trim() || undefined,
      resolvedAtISO: resolvedAtISO ? new Date(resolvedAtISO).toISOString() : undefined,
    };

    setLog((prev) => [item, ...prev]);
    resetForm();
  }

  function removeEntry(id: string) {
    setLog((prev) => prev.filter((x) => x.id !== id));
  }

  function exportLogJSON() {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        items: log,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `allergy_reaction_log_${Date.now()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 space-y-6">
        {/* Header */}
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-slate-400" />
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Allergies & Reactions</h1>
              </div>
              <p className="mt-1 text-sm text-slate-600 max-w-2xl">
                One place for your <span className="font-medium">allergy profile</span> (what to avoid) and your{' '}
                <span className="font-medium">reaction log</span> (what happened, when, and patterns over time).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/allergies/print"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Printer className="h-4 w-4" />
                Print
              </Link>

              <Link
                href="/reports"
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Reports
              </Link>
            </div>
          </div>

          {/* Safety strip */}
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4" />
              <div>
                <div className="font-medium">Safety note</div>
                <div className="mt-1 text-amber-800">
                  If you’ve had a severe reaction before, keep your emergency contacts up to date and follow your
                  clinician’s action plan. This page helps you track information; it doesn’t replace medical care.
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4">
            <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setTab('profile')}
                className={cx(
                  'rounded-xl px-4 py-2 text-sm font-medium transition',
                  tab === 'profile' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'
                )}
              >
                Allergy profile
              </button>
              <button
                type="button"
                onClick={() => setTab('reactions')}
                className={cx(
                  'rounded-xl px-4 py-2 text-sm font-medium transition',
                  tab === 'reactions' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'
                )}
              >
                Reaction log & trends
              </button>
            </div>
          </div>
        </header>

        {/* Profile tab */}
        {tab === 'profile' ? (
          <section className="space-y-4">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Your allergy profile</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Keep this list accurate so clinicians and care workflows can avoid triggers.
                  </p>
                </div>
                <Link
                  href="#reaction-log"
                  onClick={() => setTab('reactions')}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="h-4 w-4" />
                  Log a reaction
                </Link>
              </div>

              <div className="mt-4">
                <AllergiesClient />
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">How this should work (the intent)</h3>
              <ul className="mt-2 space-y-2 text-sm text-slate-600">
                <li>
                  <span className="font-medium text-slate-800">Profile</span>: known allergies, intolerance, and
                  sensitivities (used for safety checks).
                </li>
                <li>
                  <span className="font-medium text-slate-800">Reaction log</span>: incidents over time (used for trends,
                  suspect triggers, and clinician context).
                </li>
              </ul>
              <div className="mt-3 text-xs text-slate-500">
                Next step (when APIs are ready): sync reaction log entries to your medical record and power insight cards.
              </div>
            </section>
          </section>
        ) : null}

        {/* Reactions tab */}
        {tab === 'reactions' ? (
          <section id="reaction-log" className="space-y-4">
            {/* Trends */}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Reaction trends</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Built from your logged reactions (stored locally for now).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={exportLogJSON}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <FileDown className="h-4 w-4" />
                    Export JSON
                  </button>
                  <Link
                    href="/allergies/print"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </Link>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs text-slate-500">Entries</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">{trends.total}</div>
                  <div className="mt-2 text-[11px] text-slate-500">
                    Window: {windowFilter === 'all' ? 'All time' : windowFilter === '30d' ? 'Last 30 days' : 'Last 90 days'}
                  </div>
                </div>

                {(['mild', 'moderate', 'severe'] as Severity[]).map((s) => {
                  const meta = severityMeta(s);
                  const Icon = meta.Icon;
                  return (
                    <div key={s} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-2">
                        <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]', meta.cls)}>
                          <Icon className="h-3.5 w-3.5" />
                          {meta.label}
                        </span>
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">{trends.bySeverity[s]}</div>
                      <div className="mt-2 text-[11px] text-slate-500">
                        {trends.lastAt ? `Last: ${formatWhen(trends.lastAt)}` : 'No entries yet'}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Top suspected triggers</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {trends.topTriggers.length ? (
                    trends.topTriggers.map((t) => (
                      <span
                        key={t.name}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
                      >
                        {t.name}
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{t.count}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-600">No trigger patterns yet — add a few logs to see trends.</span>
                  )}
                </div>
              </div>
            </section>

            {/* Add reaction */}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Log a reaction</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Record what happened so you can spot patterns (and share with a clinician when needed).
                  </p>
                </div>
              </div>

              <div className="mt-4 grid sm:grid-cols-2 gap-4">
                <label className="block">
                  <div className="text-xs font-medium text-slate-600 mb-2 inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-slate-400" />
                    When did it happen?
                  </div>
                  <input
                    type="datetime-local"
                    value={occurredAtISO}
                    onChange={(e) => setOccurredAtISO(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  />
                </label>

                <label className="block">
                  <div className="text-xs font-medium text-slate-600 mb-2">Suspected trigger</div>
                  <input
                    value={suspectedTrigger}
                    onChange={(e) => setSuspectedTrigger(e.target.value)}
                    placeholder="e.g., peanuts, penicillin, pollen, cat dander"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  />
                  <div className="mt-1 text-[11px] text-slate-500">Be specific if you can (food, medicine, environment).</div>
                </label>

                <label className="block">
                  <div className="text-xs font-medium text-slate-600 mb-2">Severity</div>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as Severity)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  >
                    <option value="mild">Mild</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                  </select>
                </label>

                <label className="block">
                  <div className="text-xs font-medium text-slate-600 mb-2">Symptoms (comma-separated)</div>
                  <input
                    value={symptomsText}
                    onChange={(e) => setSymptomsText(e.target.value)}
                    placeholder="e.g., rash, itching, wheeze, swelling"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  />
                  <div className="mt-1 text-[11px] text-slate-500">Used for trend summaries later.</div>
                </label>

                <label className="block sm:col-span-2">
                  <div className="text-xs font-medium text-slate-600 mb-2">Medication taken (optional)</div>
                  <input
                    value={medsTaken}
                    onChange={(e) => setMedsTaken(e.target.value)}
                    placeholder="e.g., antihistamine, inhaler, prescribed medication"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  />
                </label>

                <label className="block sm:col-span-2">
                  <div className="text-xs font-medium text-slate-600 mb-2">Notes (optional)</div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anything useful: context, exposure amount, what helped, how long it lasted…"
                    className="min-h-[90px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  />
                </label>

                <label className="block sm:col-span-2">
                  <div className="text-xs font-medium text-slate-600 mb-2">Resolved (optional)</div>
                  <input
                    type="datetime-local"
                    value={resolvedAtISO}
                    onChange={(e) => setResolvedAtISO(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  Stored locally for now (until APIs are wired). You can export anytime.
                </div>
                <button
                  type="button"
                  onClick={addEntry}
                  disabled={!suspectedTrigger.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Add entry
                </button>
              </div>
            </section>

            {/* Log list */}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Your reaction log</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Search, filter, and review entries. This becomes the foundation for clinical-grade insights later.
                  </p>
                </div>
              </div>

              {/* Filters */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search trigger, symptoms, meds, notes…"
                    className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 py-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  />
                </div>

                <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                  <Filter className="h-4 w-4 text-slate-400" />
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value as any)}
                    className="bg-transparent text-sm text-slate-700 focus:outline-none"
                  >
                    <option value="all">All severities</option>
                    <option value="mild">Mild</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                  </select>
                </div>

                <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                  <CalendarDays className="h-4 w-4 text-slate-400" />
                  <select
                    value={windowFilter}
                    onChange={(e) => setWindowFilter(e.target.value as any)}
                    className="bg-transparent text-sm text-slate-700 focus:outline-none"
                  >
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="all">All time</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {filteredLog.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    No reactions logged for this filter window yet.
                  </div>
                ) : (
                  filteredLog.map((it) => {
                    const meta = severityMeta(it.severity);
                    const Icon = meta.Icon;
                    return (
                      <div key={it.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-[220px]">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]', meta.cls)}>
                                <Icon className="h-3.5 w-3.5" />
                                {meta.label}
                              </span>
                              <div className="text-sm font-semibold text-slate-900">{it.suspectedTrigger}</div>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              Occurred: {formatWhen(it.occurredAtISO)}
                              {it.resolvedAtISO ? ` • Resolved: ${formatWhen(it.resolvedAtISO)}` : ''}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeEntry(it.id)}
                            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            title="Remove entry"
                          >
                            Remove
                          </button>
                        </div>

                        {it.symptoms?.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {it.symptoms.map((s, idx) => (
                              <span
                                key={`${it.id}_sym_${idx}`}
                                className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        {it.medsTaken || it.notes ? (
                          <div className="mt-3 grid sm:grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <div className="text-xs font-medium text-slate-600">Medication taken</div>
                              <div className="mt-1 text-sm text-slate-800">{it.medsTaken || '—'}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <div className="text-xs font-medium text-slate-600">Notes</div>
                              <div className="mt-1 text-sm text-slate-800">{it.notes || '—'}</div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-4 text-xs text-slate-500">
                Next step: we’ll wire this to your backend so clinicians can view a clean, auditable timeline (with privacy controls).
              </div>
            </section>
          </section>
        ) : null}

        <footer className="text-xs text-slate-500 px-1">
          This page helps you organize your allergy profile and reaction history. For urgent concerns, seek medical help.
        </footer>
      </div>
    </main>
  );
}
