// apps/patient-app/app/charts/page.tsx
'use client';

/**
 * /charts/page.tsx — World-class Charts dashboard (Apple-clean, consistent with /vitals)
 * -----------------------------------------------------------------------------------
 * Big 4 (same contract as /vitals):
 * 1) Canonical range (URL source of truth): ?range=20|7d|30d|90d|1y|custom&start=YYYY-MM-DD&end=YYYY-MM-DD
 * 2) Safe tooltips: React tooltip (no innerHTML) + viewport clamping
 * 3) Null-gap rendering: null/undefined/non-finite => GAP (no fake zeros)
 * 4) Consistent privacy (same localStorage keys as /vitals):
 *    - vitals:discreet
 *    - vitals:hideSensitive
 *    Applies across: tiles, charts, tooltips, and exports.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { toast } from '@/components/ToastMount';
import { usePlan } from '@/components/context/PlanContext';

// Keep your Chart.js registry side-effect (old file relied on it)
import '../../lib/chartRegistry';

// Old dashboard hooks/components we can safely reuse at the page level
import useLiveVitals from '../../components/charts/useLiveVitals';
import MeterDonut from '../../components/charts/MeterDonut';
import Sparkline from '../../components/charts/Sparkline';
import SleepCard from '../../components/charts/SleepCard';
import { getSleepSeed } from '../../components/charts/sleepSeed';

import { exportElementAsPdf, shareFile } from '@/components/charts/export';

import { CollapseBtn } from '../../components/CollapseBtn';
import { Collapse } from '../../components/Collapse';

/* =========================================================
   Types
========================================================= */

type RangeKey = '20' | '7d' | '30d' | '90d' | '1y' | 'custom';
type OverlayKey = 'sleep' | 'activity' | 'meds' | 'symptoms' | 'cycle';

type Point = { t: string; v: number | null }; // v=null => GAP (no fake zeros)
type Series = {
  key: string;
  label: string;
  unit: string;
  kind: 'line';
  sensitive?: boolean;
  points: Point[];
  comparePoints?: Point[];
};

type ChartsApiResponse = {
  ok: boolean;
  range: RangeKey;
  startISO?: string;
  endISO?: string;
  series: Record<string, Series>;
  coverage?: Record<string, number>; // 0..1
  anomalies?: Array<{ seriesKey: string; at: string; note?: string }>;
};

type ChartsQueryState = {
  range: RangeKey;
  startISO?: string; // only for custom
  endISO?: string;
  compare: boolean;
  overlay: OverlayKey[];
};

type PrivacyState = {
  discreet: boolean;
  hideSensitive: boolean;
};

type PaneKey = 'overview' | 'trends' | 'live' | 'activity' | 'sleep';
const PANES_LS = 'charts.panes.v3';

/* =========================================================
   Small utils
========================================================= */

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysISO(iso: string, deltaDays: number) {
  const [y, m, d] = iso.split('-').map((n) => Number(n));
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + deltaDays);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function defaultCustomWindow() {
  const endISO = todayISO();
  const startISO = addDaysISO(endISO, -30);
  return { startISO, endISO };
}

function safeNum(v: any): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function fmt(n: number) {
  const x = Math.round(n * 10) / 10;
  return String(x);
}

function fmtInt(n: number) {
  return String(Math.round(n));
}

function prettyTs(t?: string) {
  if (!t) return '—';
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return t;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* =========================================================
   Privacy prefs (CONSISTENT with /vitals)
========================================================= */

const LS_DISCREET = 'vitals:discreet';
const LS_HIDE_SENSITIVE = 'vitals:hideSensitive';

function usePrivacyPrefs(): PrivacyState & {
  setDiscreet: (v: boolean) => void;
  setHideSensitive: (v: boolean) => void;
  ready: boolean;
} {
  const [ready, setReady] = useState(false);
  const [discreet, setDiscreetState] = useState(false);
  const [hideSensitive, setHideSensitiveState] = useState(false);

  useEffect(() => {
    try {
      const d = localStorage.getItem(LS_DISCREET);
      const h = localStorage.getItem(LS_HIDE_SENSITIVE);
      if (d === 'true' || d === 'false') setDiscreetState(d === 'true');
      if (h === 'true' || h === 'false') setHideSensitiveState(h === 'true');
    } catch {
      // ignore
    } finally {
      setReady(true);
    }
  }, []);

  const setDiscreet = useCallback((v: boolean) => {
    setDiscreetState(v);
    try {
      localStorage.setItem(LS_DISCREET, String(v));
    } catch {
      // ignore
    }
  }, []);

  const setHideSensitive = useCallback((v: boolean) => {
    setHideSensitiveState(v);
    try {
      localStorage.setItem(LS_HIDE_SENSITIVE, String(v));
    } catch {
      // ignore
    }
  }, []);

  return { discreet, hideSensitive, setDiscreet, setHideSensitive, ready };
}

function isSensitiveSeriesKey(key: string) {
  // Keep consistent with /vitals: BP + Glucose are "sensitive"
  const k = String(key || '').toLowerCase();
  return k.includes('blood') || k.includes('bp') || k.includes('sys') || k.includes('dia') || k.includes('glucose');
}

/* =========================================================
   Canonical query (BIG #1)
========================================================= */

const RANGE_ORDER: RangeKey[] = ['20', '7d', '30d', '90d', '1y', 'custom'];
const DEFAULT_RANGE: RangeKey = '30d';

function isRangeKey(x: string | null | undefined): x is RangeKey {
  return !!x && (RANGE_ORDER as string[]).includes(x);
}

function parseCSV(x: string | null) {
  return (x || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function deriveStateFromSearchParams(sp: URLSearchParams): ChartsQueryState {
  const rawRange = sp.get('range');
  const range: RangeKey = isRangeKey(rawRange) ? rawRange : DEFAULT_RANGE;

  const compare = sp.get('compare') === '1';

  const overlay = parseCSV(sp.get('overlay')).filter((k): k is OverlayKey =>
    (['sleep', 'activity', 'meds', 'symptoms', 'cycle'] as string[]).includes(k),
  );

  let startISO = sp.get('start') || undefined;
  let endISO = sp.get('end') || undefined;

  if (range === 'custom') {
    if (!startISO || !isISODate(startISO) || !endISO || !isISODate(endISO)) {
      const def = defaultCustomWindow();
      startISO = def.startISO;
      endISO = def.endISO;
    }
  } else {
    startISO = undefined;
    endISO = undefined;
  }

  return { range, startISO, endISO, compare, overlay };
}

function toCanonicalSearchParams(state: ChartsQueryState) {
  const sp = new URLSearchParams();
  sp.set('range', state.range);

  if (state.range === 'custom') {
    const def = defaultCustomWindow();
    sp.set('start', state.startISO && isISODate(state.startISO) ? state.startISO : def.startISO);
    sp.set('end', state.endISO && isISODate(state.endISO) ? state.endISO : def.endISO);
  }

  if (state.compare) sp.set('compare', '1');
  if (state.overlay.length) sp.set('overlay', state.overlay.join(','));

  return sp;
}

function useCanonicalChartsQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const spRO = useSearchParams();
  const spStr = spRO.toString();

  const state = useMemo(() => deriveStateFromSearchParams(new URLSearchParams(spStr)), [spStr]);

  useEffect(() => {
    const canon = toCanonicalSearchParams(state).toString();
    const current = new URLSearchParams(spStr).toString();
    if (canon !== current) {
      router.replace(canon ? `${pathname}?${canon}` : pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, router, spStr]);

  const setState = useCallback(
    (patch: Partial<ChartsQueryState>) => {
      const next: ChartsQueryState = { ...state, ...patch };

      if (next.range === 'custom') {
        const def = defaultCustomWindow();
        next.startISO = next.startISO && isISODate(next.startISO) ? next.startISO : def.startISO;
        next.endISO = next.endISO && isISODate(next.endISO) ? next.endISO : def.endISO;
      } else {
        next.startISO = undefined;
        next.endISO = undefined;
      }

      const canon = toCanonicalSearchParams(next).toString();
      router.replace(canon ? `${pathname}?${canon}` : pathname, { scroll: false });
    },
    [pathname, router, state],
  );

  return { state, setState };
}

/* =========================================================
   Persistent panes
========================================================= */

function usePersistentPanes(defaults: Record<PaneKey, boolean>) {
  const [state, setState] = useState<Record<PaneKey, boolean>>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(PANES_LS) : null;
      if (raw) return { ...defaults, ...JSON.parse(raw) };
    } catch {
      // ignore
    }
    return defaults;
  });

  useEffect(() => {
    try {
      localStorage.setItem(PANES_LS, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  return [state, setState] as const;
}

/* =========================================================
   Data fetching (range is canonical, API supports range)
========================================================= */

async function fetcherJSON(url: string) {
  const r = await fetch(url, { cache: 'no-store' });
  const data = (await r.json().catch(() => null)) as any;
  if (!r.ok || !data || data.ok === false) {
    const msg = data?.error || `Request failed (${r.status})`;
    throw new Error(msg);
  }
  return data;
}

function buildChartsApiUrl(q: ChartsQueryState) {
  const sp = new URLSearchParams();
  sp.set('range', q.range);
  if (q.range === 'custom') {
    if (q.startISO) sp.set('start', q.startISO);
    if (q.endISO) sp.set('end', q.endISO);
  }
  if (q.compare) sp.set('compare', '1');
  if (q.overlay.length) sp.set('overlay', q.overlay.join(','));
  return `/api/charts?${sp.toString()}`;
}

/* =========================================================
   Chart catalog (keys map to API series)
========================================================= */

type ChartDef = {
  seriesKey: string;
  title: string;
  subtitle?: string;
  unitHint?: string;
  sensitive?: boolean;
  premium?: boolean;
};

const CHART_DEFS: ChartDef[] = [
  { seriesKey: 'hr', title: 'Heart Rate', subtitle: 'Trend', unitHint: 'bpm' },
  { seriesKey: 'spo2', title: 'SpO₂', subtitle: 'Trend', unitHint: '%' },
  { seriesKey: 'rr', title: 'Respiratory Rate', subtitle: 'Trend', unitHint: 'rpm' },
  { seriesKey: 'temp', title: 'Temperature', subtitle: 'Trend', unitHint: '°C' },
  { seriesKey: 'sys', title: 'Blood Pressure (SYS)', subtitle: 'Trend', unitHint: 'mmHg', sensitive: true },
  { seriesKey: 'dia', title: 'Blood Pressure (DIA)', subtitle: 'Trend', unitHint: 'mmHg', sensitive: true },
  { seriesKey: 'glucose', title: 'Glucose', subtitle: 'Trend', unitHint: 'mg/dL', sensitive: true },
  { seriesKey: 'steps', title: 'Steps', subtitle: 'Trend', unitHint: 'steps', premium: true },
  { seriesKey: 'sleep.total', title: 'Sleep', subtitle: 'Duration (trend)', unitHint: 'h', premium: true },
];

/* =========================================================
   Page
========================================================= */

export default function ChartsPage() {
  const { isPremium } = usePlan();
  const { state: q, setState: setQ } = useCanonicalChartsQuery();
  const privacy = usePrivacyPrefs();

  const exportRef = useRef<HTMLElement | null>(null);

  const [panes, setPanes] = usePersistentPanes({
    overview: true,
    trends: true,
    live: true,
    activity: true,
    sleep: true,
  });

  const setPane = useCallback(
    (k: PaneKey, v: boolean) => setPanes((s) => ({ ...s, [k]: v })),
    [setPanes],
  );

  const expandAll = useCallback(() => {
    setPanes({ overview: true, trends: true, live: true, activity: true, sleep: true });
  }, [setPanes]);

  const collapseAll = useCallback(() => {
    setPanes({ overview: false, trends: false, live: false, activity: false, sleep: false });
  }, [setPanes]);

  // Premium gating modal (same behavior you’ve used elsewhere)
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const requirePremium = useCallback(() => setUpgradeOpen(true), []);

  const apiUrl = useMemo(() => buildChartsApiUrl(q), [q]);

  const { data, error, isLoading, mutate } = useSWR<ChartsApiResponse>(apiUrl, fetcherJSON, {
    revalidateOnFocus: false,
  });

  // Live stream — used for LIVE + ACTIVITY panes
  const { data: liveData, live: liveOnline, flags } = useLiveVitals(120, 1);

  // Sleep fallback seed
  const sleepFallback = useMemo(() => getSleepSeed(new Date()), []);
  const sleepPayload =
    (liveData as any)?.sleep?.sessions?.length || Array.isArray((liveData as any)?.sleep?.stages)
      ? (liveData as any).sleep
      : sleepFallback;

  // Apply hideSensitive at the series level (BIG #4)
  const effectiveSeries = useMemo(() => {
    const src = data?.series || {};
    if (!privacy.hideSensitive) return src;

    const out: Record<string, Series> = {};
    for (const [k, s] of Object.entries(src)) {
      const sensitive = !!s.sensitive || isSensitiveSeriesKey(k);
      if (sensitive) continue;
      out[k] = s;
    }
    return out;
  }, [data?.series, privacy.hideSensitive]);

  const coverageAvg = useMemo(() => {
    const cov = data?.coverage;
    if (!cov) return null;
    const vals = Object.values(cov).filter((n) => Number.isFinite(n));
    if (!vals.length) return null;
    const sum = vals.reduce((a, b) => a + b, 0);
    return sum / vals.length;
  }, [data?.coverage]);

  const anomaliesCount = data?.anomalies?.length ?? 0;

  const rangeLabel = useMemo(() => {
    if (q.range === 'custom') return `${q.startISO || '—'} → ${q.endISO || '—'}`;
    if (q.range === '20') return 'Last 20 readings';
    return q.range.toUpperCase();
  }, [q.endISO, q.range, q.startISO]);

  const lastTimelineTs = useMemo(() => {
    // pick latest non-null timestamp across visible series
    const ss = Object.values(effectiveSeries);
    let best: string | null = null;
    for (const s of ss) {
      for (let i = s.points.length - 1; i >= 0; i--) {
        const t = s.points[i]?.t;
        if (!t) continue;
        if (!best) best = t;
        else if (new Date(t).getTime() > new Date(best).getTime()) best = t;
        break;
      }
    }
    return best;
  }, [effectiveSeries]);

  const quickMetrics = useMemo(() => {
    const pick = (key: string) => {
      const s = effectiveSeries[key];
      if (!s) return null;
      for (let i = s.points.length - 1; i >= 0; i--) {
        const v = s.points[i]?.v;
        if (typeof v === 'number' && Number.isFinite(v)) return { v, t: s.points[i]?.t };
      }
      return null;
    };

    const hr = pick('hr');
    const spo2 = pick('spo2');
    const temp = pick('temp');
    const sys = pick('sys');
    const dia = pick('dia');
    const gl = pick('glucose');

    const bp =
      !privacy.hideSensitive && sys?.v != null && dia?.v != null
        ? { v: `${fmtInt(sys.v)}/${fmtInt(dia.v)}`, t: sys.t || dia.t }
        : null;

    const items: Array<{
      k: string;
      label: string;
      value: string | null;
      unit?: string;
      sensitive?: boolean;
      t?: string | null;
    }> = [
      { k: 'hr', label: 'HR', value: hr?.v != null ? fmtInt(hr.v) : null, unit: 'bpm', t: hr?.t },
      { k: 'spo2', label: 'SpO₂', value: spo2?.v != null ? fmtInt(spo2.v) : null, unit: '%', t: spo2?.t },
      { k: 'temp', label: 'Temp', value: temp?.v != null ? fmt(temp.v) : null, unit: '°C', t: temp?.t },
      { k: 'bp', label: 'BP', value: bp?.v ?? null, unit: 'mmHg', sensitive: true, t: bp?.t },
      { k: 'glucose', label: 'Glucose', value: gl?.v != null ? fmtInt(gl.v) : null, unit: 'mg/dL', sensitive: true, t: gl?.t },
    ];

    return items.filter((x) => !(privacy.hideSensitive && x.sensitive));
  }, [effectiveSeries, privacy.hideSensitive]);

  const exportAllCsv = useCallback(() => {
    try {
      const csv = buildCsvExport({
        q,
        privacy: { discreet: privacy.discreet, hideSensitive: privacy.hideSensitive },
        series: effectiveSeries,
      });
      downloadTextFile(`ambulant_charts_${q.range}_${todayISO()}.csv`, csv);
      toast('Exported CSV.', { type: 'success' });
    } catch (e: any) {
      console.error(e);
      toast('Could not export right now.', { type: 'error' });
    }
  }, [effectiveSeries, privacy.discreet, privacy.hideSensitive, q]);

  const exportPdf = useCallback(async () => {
    const el = exportRef.current;
    if (!el) return;
    const base = privacy.discreet || privacy.hideSensitive ? 'charts-redacted' : 'charts';
    await exportElementAsPdf(el, `${base}-${q.range}-${todayISO()}.pdf`);
  }, [privacy.discreet, privacy.hideSensitive, q.range]);

  const shareSnapshot = useCallback(async () => {
    const el = exportRef.current;
    if (!el) return;
    const canvas = await import('html2canvas').then((m) => m.default(el));
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      await shareFile({
        blob,
        filename: `${privacy.discreet || privacy.hideSensitive ? 'charts-redacted' : 'charts'}-${Date.now()}.png`,
        text: 'Ambulant+ Charts snapshot',
      });
    });
  }, [privacy.discreet, privacy.hideSensitive]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <main ref={exportRef as any} className="mx-auto max-w-6xl px-4 py-6">
        {/* Top header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <Link
              href="/vitals"
              className="mt-0.5 hidden sm:inline-flex rounded-xl border bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-50"
            >
              ← Vitals
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-slate-900">Charts</h1>
                <span
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium',
                    liveOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
                  )}
                  aria-live="polite"
                >
                  <span className={cn('h-2 w-2 rounded-full', liveOnline ? 'bg-emerald-500' : 'bg-rose-500')} />
                  {liveOnline ? 'Live' : 'Offline'}
                </span>
              </div>

              <p className="mt-1 text-sm text-slate-600">
                Missing readings stay missing — no fake zeros, no broken trust.
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
                  <span className="text-slate-600">Range</span>
                  <span className="font-medium text-slate-900">{rangeLabel}</span>
                </span>

                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
                  <span className="text-slate-600">Compare</span>
                  <span className="font-medium text-slate-900">{q.compare ? 'On' : 'Off'}</span>
                </span>

                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
                  <span className="text-slate-600">Last point</span>
                  <span className="font-medium text-slate-900">{privacy.discreet ? 'Hidden' : prettyTs(lastTimelineTs || undefined)}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              onClick={expandAll}
              className="rounded-xl border bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-50"
              type="button"
            >
              Expand all
            </button>
            <button
              onClick={collapseAll}
              className="rounded-xl border bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-50"
              type="button"
            >
              Collapse all
            </button>

            <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

            <button
              onClick={exportAllCsv}
              className={cn('rounded-xl border bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-50')}
              type="button"
              title={privacy.discreet ? 'Export is redacted in Discreet mode' : 'Export visible data'}
            >
              CSV
            </button>
            <button
              onClick={exportPdf}
              className="rounded-xl border bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-50"
              type="button"
              title={privacy.discreet || privacy.hideSensitive ? 'PDF export will be redacted' : 'Export PDF'}
            >
              PDF
            </button>
            <button
              onClick={shareSnapshot}
              className="rounded-xl border bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-50"
              type="button"
            >
              Share
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-4">
          <ChartsControlBar
            q={q}
            onChange={setQ}
            isPremium={!!isPremium}
            onRequirePremium={requirePremium}
            privacy={privacy}
          />
        </div>

        {/* Overview pane */}
        <section className="mt-6 space-y-3" aria-label="Overview">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Overview</h2>
              <p className="text-xs text-slate-500">A quick snapshot — respects Discreet + Sensitive hidden.</p>
            </div>
            <CollapseBtn
              open={panes.overview}
              onClick={() => setPane('overview', !panes.overview)}
              titleOpen="Collapse"
              titleClosed="Expand"
            />
          </div>

          <Collapse open={panes.overview}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Coverage / health of data */}
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Timeline quality</div>
                    <div className="mt-0.5 text-xs text-slate-600">How complete your readings are in this range.</div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-600">
                    {privacy.discreet ? 'Hidden' : `Anomalies: ${anomaliesCount}`}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-4">
                  <div className="h-20 w-20">
                    {privacy.discreet ? (
                      <div className="h-20 w-20 rounded-full border bg-slate-50" />
                    ) : (
                      <MeterDonut value={Math.round((coverageAvg ?? 0) * 100)} max={100} label="Coverage" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="text-xs text-slate-500">Coverage</div>
                    <div className="text-2xl font-semibold text-slate-900">
                      {privacy.discreet ? <span className="text-slate-400">Hidden</span> : coverageAvg == null ? '—' : `${Math.round(coverageAvg * 100)}%`}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      {coverageAvg == null
                        ? 'No coverage data yet.'
                        : coverageAvg >= 0.7
                        ? 'Good density. Trends are reliable.'
                        : 'Sparse readings. Expect gaps.'}
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    Couldn’t load timeline charts: {String((error as any)?.message || 'Error')}
                    <button
                      className="ml-2 underline"
                      type="button"
                      onClick={() => mutate()}
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>

              {/* Quick metrics */}
              <div className="rounded-2xl border bg-white p-4 shadow-sm lg:col-span-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Latest readings</div>
                    <div className="mt-0.5 text-xs text-slate-600">Most recent points from your timeline.</div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-600">
                    {privacy.discreet ? 'Discreet on' : q.range === '20' ? 'Last 20' : q.range.toUpperCase()}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {quickMetrics.map((m) => (
                    <div key={m.k} className="rounded-2xl border bg-slate-50/70 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-medium text-slate-600">{m.label}</div>
                        <div className="text-[10px] text-slate-400">{privacy.discreet ? '—' : m.t ? prettyTs(m.t) : '—'}</div>
                      </div>
                      <div className="mt-2 text-lg font-semibold text-slate-900">
                        {privacy.discreet ? <span className="text-slate-400">Hidden</span> : m.value ?? <span className="text-slate-400">—</span>}
                        {!privacy.discreet && m.value != null && m.unit ? (
                          <span className="ml-1 text-xs font-medium text-slate-500">{m.unit}</span>
                        ) : null}
                      </div>
                      <div className="mt-2 h-8">
                        {/* tiny sparkline from series if available */}
                        {privacy.discreet ? (
                          <div className="h-8 rounded-lg border border-dashed bg-white" />
                        ) : (
                          <MiniSpark series={effectiveSeries[m.k === 'bp' ? 'sys' : m.k]} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span className="rounded-full bg-slate-100 px-3 py-1">Tooltips: {privacy.discreet ? 'Off' : 'On'}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">
                    Sensitive metrics: {privacy.hideSensitive ? 'Hidden' : 'Visible'}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">
                    Overlays: {q.overlay.length ? q.overlay.join(', ') : 'None'}
                  </span>
                </div>
              </div>
            </div>
          </Collapse>
        </section>

        {/* Trends pane */}
        <section className="mt-8 space-y-3" aria-label="Trends">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Trends</h2>
              <p className="text-xs text-slate-500">Range-based charts from your timeline API.</p>
            </div>
            <CollapseBtn
              open={panes.trends}
              onClick={() => setPane('trends', !panes.trends)}
              titleOpen="Collapse"
              titleClosed="Expand"
            />
          </div>

          <Collapse open={panes.trends}>
            <ChartGrid
              defs={CHART_DEFS}
              series={effectiveSeries}
              q={q}
              isLoading={isLoading || !privacy.ready}
              discreet={privacy.discreet}
              hideSensitive={privacy.hideSensitive}
              isPremium={!!isPremium}
              onRequirePremium={requirePremium}
              onRetry={() => mutate()}
              error={error ? String((error as any)?.message || 'Failed') : null}
            />
          </Collapse>
        </section>

        {/* Live pane */}
        <section className="mt-8 space-y-3" aria-label="Live">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Live</h2>
              <p className="text-xs text-slate-500">Streaming snapshot from connected IoMT devices.</p>
            </div>
            <CollapseBtn
              open={panes.live}
              onClick={() => setPane('live', !panes.live)}
              titleOpen="Collapse"
              titleClosed="Expand"
            />
          </div>

          <Collapse open={panes.live}>
            <LivePane
              liveOnline={!!liveOnline}
              flags={flags}
              liveData={liveData}
              discreet={privacy.discreet}
              hideSensitive={privacy.hideSensitive}
            />
          </Collapse>
        </section>

        {/* Activity pane */}
        <section className="mt-8 space-y-3" aria-label="Activity">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Activity</h2>
              <p className="text-xs text-slate-500">Steps, calories, and distance (from wearables).</p>
            </div>
            <CollapseBtn
              open={panes.activity}
              onClick={() => setPane('activity', !panes.activity)}
              titleOpen="Collapse"
              titleClosed="Expand"
            />
          </div>

          <Collapse open={panes.activity}>
            <ActivityPane
              liveData={liveData}
              discreet={privacy.discreet}
              isPremium={!!isPremium}
              onRequirePremium={requirePremium}
            />
          </Collapse>
        </section>

        {/* Sleep pane */}
        <section className="mt-8 space-y-3" aria-label="Sleep">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Sleep</h2>
              <p className="text-xs text-slate-500">Sleep sessions and stages (fallback seed if none yet).</p>
            </div>
            <CollapseBtn
              open={panes.sleep}
              onClick={() => setPane('sleep', !panes.sleep)}
              titleOpen="Collapse"
              titleClosed="Expand"
            />
          </div>

          <Collapse open={panes.sleep}>
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              {privacy.discreet ? (
                <div className="rounded-xl border border-dashed bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="font-medium">Discreet mode</div>
                  <p className="mt-1 text-xs text-slate-500">Sleep details are hidden while Discreet is enabled.</p>
                </div>
              ) : (
                <SleepCard sleep={sleepPayload} />
              )}
            </div>
          </Collapse>
        </section>

        {upgradeOpen && (
          <UpgradeModal
            onClose={() => setUpgradeOpen(false)}
            title="Upgrade to Premium"
            body="Premium unlocks longer ranges (90d/1y/custom), comparisons, overlays, and advanced insights."
          />
        )}

        <div className="mt-10 pb-2 text-center text-[11px] text-slate-400">
          Ambulatory analytics by Ambulant+ · Privacy toggles apply everywhere
        </div>
      </main>
    </div>
  );
}

/* =========================================================
   Controls Bar
========================================================= */

function ChartsControlBar(props: {
  q: ChartsQueryState;
  onChange: (patch: Partial<ChartsQueryState>) => void;
  isPremium: boolean;
  onRequirePremium: () => void;
  privacy: PrivacyState & {
    setDiscreet: (v: boolean) => void;
    setHideSensitive: (v: boolean) => void;
    ready: boolean;
  };
}) {
  const { q, onChange, isPremium, onRequirePremium, privacy } = props;

  const setRange = useCallback((r: RangeKey) => onChange({ range: r }), [onChange]);

  const toggleCompare = useCallback(() => {
    if (!isPremium) return onRequirePremium();
    onChange({ compare: !q.compare });
  }, [isPremium, onChange, onRequirePremium, q.compare]);

  const toggleOverlay = useCallback(
    (k: OverlayKey) => {
      if (!isPremium) return onRequirePremium();
      const has = q.overlay.includes(k);
      onChange({ overlay: has ? q.overlay.filter((x) => x !== k) : [...q.overlay, k] });
    },
    [isPremium, onChange, onRequirePremium, q.overlay],
  );

  const setCustomStart = useCallback((v: string) => onChange({ range: 'custom', startISO: v }), [onChange]);
  const setCustomEnd = useCallback((v: string) => onChange({ range: 'custom', endISO: v }), [onChange]);

  return (
    <div className="sticky top-2 z-20 rounded-2xl border bg-white/90 p-3 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Range */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-600">Range</span>

          <div className="inline-flex flex-wrap gap-2">
            {(['20', '7d', '30d', '90d', '1y', 'custom'] as RangeKey[]).map((r) => {
              const premiumRange = r === '90d' || r === '1y' || r === 'custom';
              const locked = premiumRange && !isPremium;

              return (
                <button
                  key={r}
                  onClick={() => {
                    if (locked) return onRequirePremium();
                    setRange(r);
                  }}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-sm transition',
                    q.range === r ? 'bg-slate-900 text-white border-slate-900' : 'bg-white hover:bg-slate-50',
                    locked && 'opacity-80',
                  )}
                  type="button"
                  title={locked ? 'Premium range' : undefined}
                >
                  {r === '20' ? 'Last 20' : r === 'custom' ? 'Custom' : r.toUpperCase()}
                  {locked ? <span className="ml-1 text-[10px] opacity-90">✦</span> : null}
                </button>
              );
            })}
          </div>

          {q.range === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 pl-1">
              <input
                type="date"
                value={q.startISO || ''}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-xl border px-3 py-2 text-sm"
              />
              <span className="text-sm text-slate-500">→</span>
              <input
                type="date"
                value={q.endISO || ''}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-xl border px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>

        {/* Compare + Overlay + Privacy */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={toggleCompare}
            className={cn(
              'rounded-xl border px-3 py-2 text-sm transition',
              q.compare ? 'bg-slate-900 text-white border-slate-900' : 'bg-white hover:bg-slate-50',
            )}
            title={!isPremium ? 'Premium feature' : 'Compare previous period'}
            type="button"
          >
            Compare {!isPremium ? <span className="ml-1 text-[10px]">✦</span> : null}
          </button>

          <div className="hidden md:block h-7 w-px bg-slate-200 mx-1" />

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Overlay</span>
            {(['sleep', 'activity', 'meds', 'symptoms', 'cycle'] as OverlayKey[]).map((k) => (
              <button
                key={k}
                onClick={() => toggleOverlay(k)}
                className={cn(
                  'rounded-xl border px-3 py-2 text-sm transition',
                  q.overlay.includes(k) ? 'bg-slate-900 text-white border-slate-900' : 'bg-white hover:bg-slate-50',
                )}
                title={!isPremium ? 'Premium feature' : `Toggle ${k}`}
                type="button"
              >
                {k}
                {!isPremium ? <span className="ml-1 text-[10px]">✦</span> : null}
              </button>
            ))}
          </div>

          <div className="hidden md:block h-7 w-px bg-slate-200 mx-1" />

          <button
            onClick={() => privacy.setDiscreet(!privacy.discreet)}
            className={cn(
              'rounded-xl border px-3 py-2 text-sm transition',
              privacy.discreet ? 'bg-slate-900 text-white border-slate-900' : 'bg-white hover:bg-slate-50',
            )}
            type="button"
            aria-pressed={privacy.discreet}
            title="Mask values + tooltips + exports"
          >
            {privacy.discreet ? '🙈 Discreet' : 'Discreet'}
          </button>

          <button
            onClick={() => privacy.setHideSensitive(!privacy.hideSensitive)}
            className={cn(
              'rounded-xl border px-3 py-2 text-sm transition',
              privacy.hideSensitive ? 'bg-slate-900 text-white border-slate-900' : 'bg-white hover:bg-slate-50',
            )}
            type="button"
            aria-pressed={privacy.hideSensitive}
            title="Hide sensitive metrics (BP + Glucose)"
          >
            {privacy.hideSensitive ? '🔒 Sensitive hidden' : 'Hide sensitive'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Mini spark for Overview (quiet, world-class)
========================================================= */

function MiniSpark(props: { series?: Series | null }) {
  const s = props.series;
  if (!s || !Array.isArray(s.points) || s.points.length < 2) {
    return <div className="h-8 rounded-lg border border-dashed bg-white" />;
  }
  const vals = s.points.map((p) => (typeof p?.v === 'number' && Number.isFinite(p.v) ? p.v : null));
  const labels = s.points.map((p) => p?.t ?? '');
  // Sparkline component wants numbers; we’ll pass only finite values to keep it stable,
  // but since it can’t render gaps, we keep it as a “preview” only.
  const compact = vals.filter((v): v is number => typeof v === 'number');

  if (compact.length < 2) return <div className="h-8 rounded-lg border border-dashed bg-white" />;

  return (
    <div className="h-8 overflow-hidden rounded-lg border bg-white">
      <Sparkline labels={labels} values={compact as any} color="#0f172a" />
    </div>
  );
}

/* =========================================================
   Trend grid (API series)
========================================================= */

function ChartGrid(props: {
  defs: ChartDef[];
  series: Record<string, Series>;
  q: ChartsQueryState;
  isLoading: boolean;
  discreet: boolean;
  hideSensitive: boolean;
  isPremium: boolean;
  onRequirePremium: () => void;
  onRetry: () => void;
  error: string | null;
}) {
  const { defs, series, q, isLoading, discreet, hideSensitive, isPremium, onRequirePremium, onRetry, error } = props;

  const visibleDefs = useMemo(() => {
    return defs.filter((d) => !(hideSensitive && d.sensitive));
  }, [defs, hideSensitive]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {visibleDefs.map((def) => {
        const s = series[def.seriesKey];

        const locked = !!def.premium && !isPremium;
        const noData = !s || !hasAnyData(s);

        return (
          <ChartCard
            key={def.seriesKey}
            title={def.title}
            subtitle={def.subtitle || rangeSubtitle(q)}
            locked={locked}
            onUnlock={onRequirePremium}
            badgeRight={
              s ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-600">
                  {discreet ? 'Hidden' : `${countNonNull(s.points)}/${s.points.length} pts`}
                </span>
              ) : null
            }
            actions={
              <div className="flex items-center gap-2">
                <button
                  className="rounded-xl border bg-white px-3 py-2 text-xs hover:bg-slate-50 disabled:opacity-60"
                  onClick={() => {
                    try {
                      const csv = buildCsvExport({
                        q,
                        privacy: { discreet, hideSensitive },
                        series: s ? { [s.key]: s } : {},
                      });
                      downloadTextFile(`ambulant_${def.seriesKey}_${q.range}_${todayISO()}.csv`, csv);
                      toast('Exported CSV.', { type: 'success' });
                    } catch (e) {
                      console.error(e);
                      toast('Could not export right now.', { type: 'error' });
                    }
                  }}
                  title={discreet ? 'Export is redacted in Discreet mode' : 'Export this chart'}
                  type="button"
                  disabled={noData}
                >
                  Export
                </button>
              </div>
            }
            footer={<ChartFooter series={s} discreet={discreet} compare={q.compare} unitHint={def.unitHint} />}
          >
            {isLoading ? (
              <SkeletonChart />
            ) : error && !s ? (
              <EmptyChart title="Couldn’t load charts" subtitle="Retry to fetch your timeline." onRetry={onRetry} />
            ) : noData ? (
              <EmptyChart title="No readings in this range" subtitle="Connect a device or add a manual reading." onRetry={onRetry} />
            ) : (
              <div className={cn('relative', locked && 'pointer-events-none select-none opacity-70')}>
                <TrendChart series={s} discreet={discreet} compare={q.compare} />
                {locked && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button
                      onClick={onRequirePremium}
                      className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg"
                      type="button"
                    >
                      Unlock Premium
                    </button>
                  </div>
                )}
              </div>
            )}
          </ChartCard>
        );
      })}
    </div>
  );
}

function ChartCard(props: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  locked?: boolean;
  onUnlock?: () => void;
  badgeRight?: React.ReactNode;
}) {
  const { title, subtitle, children, actions, footer, locked, onUnlock, badgeRight } = props;

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-slate-900 truncate">{title}</div>
            {badgeRight}
          </div>
          {subtitle && <div className="mt-0.5 text-xs text-slate-600">{subtitle}</div>}
        </div>

        <div className="flex items-center gap-2">
          {locked && (
            <button
              onClick={onUnlock}
              className="rounded-xl border bg-white px-3 py-2 text-xs hover:bg-slate-50"
              title="Premium feature"
              type="button"
            >
              Premium ✦
            </button>
          )}
          {actions}
        </div>
      </div>

      <div className="mt-3">{children}</div>

      {footer && <div className="mt-3 border-t pt-3">{footer}</div>}
    </div>
  );
}

function SkeletonChart() {
  return <div className="h-[240px] w-full animate-pulse rounded-2xl bg-slate-100" />;
}

function EmptyChart(props: { title: string; subtitle?: string; onRetry: () => void }) {
  return (
    <div className="flex h-[240px] flex-col items-center justify-center rounded-2xl border bg-slate-50 text-center">
      <div className="text-sm font-semibold text-slate-800">{props.title}</div>
      {props.subtitle && <div className="mt-1 text-xs text-slate-600">{props.subtitle}</div>}
      <button onClick={props.onRetry} className="mt-3 rounded-xl border bg-white px-4 py-2 text-sm hover:bg-slate-50" type="button">
        Retry
      </button>
    </div>
  );
}

function rangeSubtitle(q: ChartsQueryState) {
  if (q.range === 'custom') return `Custom · ${q.startISO || '—'} → ${q.endISO || '—'}`;
  return q.range === '20' ? 'Last 20 readings' : `${q.range.toUpperCase()} window`;
}

function hasAnyData(s: Series) {
  return s.points.some((p) => p.v != null) || (s.comparePoints?.some((p) => p.v != null) ?? false);
}

function countNonNull(points: Point[]) {
  return points.reduce((acc, p) => (p?.v == null ? acc : acc + 1), 0);
}

function ChartFooter(props: { series?: Series; discreet: boolean; compare: boolean; unitHint?: string }) {
  const { series, discreet, compare, unitHint } = props;

  const stats = useMemo(() => {
    if (!series) return null;
    const vals = series.points.map((p) => p.v).filter((v): v is number => typeof v === 'number');
    if (!vals.length) return null;
    vals.sort((a, b) => a - b);
    const min = vals[0];
    const max = vals[vals.length - 1];
    const mid = vals[Math.floor(vals.length / 2)];
    const gaps = series.points.length - vals.length;
    return { min, max, median: mid, gaps, samples: vals.length };
  }, [series]);

  const unit = series?.unit || unitHint || '—';

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
      <div className="flex flex-wrap gap-3">
        <span>
          Unit: <span className="font-medium text-slate-800">{unit}</span>
        </span>
        <span>
          Compare: <span className="font-medium text-slate-800">{compare ? 'On' : 'Off'}</span>
        </span>
        <span>
          Gaps:{' '}
          <span className="font-medium text-slate-800">
            {discreet ? 'Hidden' : stats ? String(stats.gaps) : '—'}
          </span>
        </span>
      </div>

      <div className="flex flex-wrap gap-3">
        <span>
          Median:{' '}
          <span className="font-medium text-slate-800">
            {discreet ? 'Hidden' : stats ? fmt(stats.median) : '—'}
          </span>
        </span>
        <span>
          Min/Max:{' '}
          <span className="font-medium text-slate-800">
            {discreet ? 'Hidden' : stats ? `${fmt(stats.min)} / ${fmt(stats.max)}` : '—'}
          </span>
        </span>
      </div>
    </div>
  );
}

/* =========================================================
   Live pane (safe + privacy-consistent)
========================================================= */

function getSourceFor(data: any, metric: string) {
  if (!data) return undefined;
  if (data.sources && data.sources[metric]) return data.sources[metric];
  if (data.latestSources && data.latestSources[metric]) return data.latestSources[metric];
  if (data.latest && data.latest.source) return data.latest.source;
  if (data.source) return data.source;
  return undefined;
}

function delta(arr: Array<number | null>) {
  if (!arr || arr.length < 2) return null;
  const last = arr[arr.length - 1];
  const prev = arr[arr.length - 2];
  if (last == null || prev == null) return null;
  return Math.round(last - prev);
}

/** batched updates hook */
function useBatchedState<T>(value: T, delay = 250) {
  const [batched, setBatched] = useState(value);
  const ref = useRef<number | null>(null);
  useEffect(() => {
    if (ref.current) window.clearTimeout(ref.current);
    ref.current = window.setTimeout(() => setBatched(value), delay);
    return () => {
      if (ref.current) window.clearTimeout(ref.current);
    };
  }, [value, delay]);
  return batched;
}

function StatTile(props: {
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
  source?: string;
  discreet: boolean;
}) {
  const { label, value, sub, delta: d, source, discreet } = props;
  const deltaStr = typeof d === 'number' ? `${Math.abs(d).toFixed(0)}` : null;

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
            {source ? (
              <div className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {discreet ? '—' : source}
              </div>
            ) : null}
          </div>
          <div className="mt-1 text-2xl font-semibold truncate text-slate-900">
            {discreet ? <span className="text-slate-400">Hidden</span> : value}
          </div>
          {sub ? <div className="text-xs text-slate-500 mt-1">{sub}</div> : null}
        </div>

        <div aria-hidden className="ml-3 text-sm flex-shrink-0">
          {deltaStr && !discreet ? (
            <div
              className={cn(
                'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
                d != null && d > 0 ? 'text-rose-700 bg-rose-50' : 'text-emerald-700 bg-emerald-50',
              )}
            >
              {d != null && d > 0 ? '▲' : '▼'} {deltaStr}
            </div>
          ) : null}
          {deltaStr && discreet ? (
            <div className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-slate-400 bg-slate-50">
              —
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LivePane(props: {
  liveOnline: boolean;
  flags: any;
  liveData: any;
  discreet: boolean;
  hideSensitive: boolean;
}) {
  const { liveOnline, flags, liveData, discreet, hideSensitive } = props;

  // Defensive reads + NULL-GAP series (BIG #3)
  const safeArr = (arr: any) => (Array.isArray(arr) ? arr : []);
  const labelsRaw = safeArr(liveData?.labels ?? []);
  const labels = useBatchedState(labelsRaw, 300);

  const hr = useBatchedState(safeArr(liveData?.hr?.map((p: any) => safeNum(p?.v))), 300);
  const spo2 = useBatchedState(safeArr(liveData?.spo2?.map((p: any) => safeNum(p?.v))), 300);
  const sys = useBatchedState(safeArr(liveData?.sys?.map((p: any) => safeNum(p?.v))), 300);
  const dia = useBatchedState(safeArr(liveData?.dia?.map((p: any) => safeNum(p?.v))), 300);
  const rr = useBatchedState(safeArr(liveData?.rr?.map((p: any) => safeNum(p?.v))), 300);
  const temp = useBatchedState(safeArr(liveData?.temp?.map((p: any) => safeNum(p?.v))), 300);
  const glucose = useBatchedState(safeArr(liveData?.glucose?.map((p: any) => safeNum(p?.v))), 300);

  const latest = liveData?.latest || {};
  const src = (metric: string) => getSourceFor(liveData, metric) ?? undefined;

  const cards = [
    { label: 'HR', value: latest?.hr != null ? `${latest.hr} bpm` : '—', delta: delta(hr), source: src('hr'), sensitive: false },
    { label: 'SpO₂', value: latest?.spo2 != null ? `${latest.spo2}%` : '—', delta: delta(spo2), source: src('spo2'), sensitive: false },
    { label: 'SYS', value: latest?.sys != null ? `${latest.sys}` : '—', sub: 'mmHg', delta: delta(sys), source: src('sys'), sensitive: true },
    { label: 'DIA', value: latest?.dia != null ? `${latest.dia}` : '—', sub: 'mmHg', delta: delta(dia), source: src('dia'), sensitive: true },
    { label: 'RR', value: latest?.rr != null ? `${latest.rr} rpm` : '—', delta: delta(rr), source: src('rr'), sensitive: false },
    { label: 'Temp', value: latest?.temp != null ? `${latest.temp} °C` : '—', delta: delta(temp), source: src('temp'), sensitive: false },
    { label: 'Glucose', value: latest?.glucose != null ? `${latest.glucose} mg/dL` : '—', delta: delta(glucose), source: src('glucose'), sensitive: true },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium',
              liveOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
            )}
            aria-live="polite"
          >
            <span className={cn('h-2 w-2 rounded-full', liveOnline ? 'bg-emerald-500' : 'bg-rose-500')} />
            {liveOnline ? 'Online' : 'Offline'}
          </span>

          {flags?.BP_HIGH && !discreet && !hideSensitive && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">BP Alert</span>
          )}
          {flags?.HR_HIGH && !discreet && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">HR Alert</span>
          )}
        </div>

        <div className="text-xs text-slate-500">{labels?.length ? `${labels.length} samples (last ~2 minutes)` : 'Awaiting samples…'}</div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards
          .filter((c) => !(hideSensitive && c.sensitive))
          .map((c) => (
            <StatTile
              key={c.label}
              label={c.label}
              value={c.value}
              sub={(c as any).sub}
              delta={c.delta as any}
              source={c.source}
              discreet={discreet}
            />
          ))}
      </div>

      {/* Safe multi-channel live view */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MiniLiveChart
          title="HR"
          subtitle="Live"
          discreet={discreet}
          series={{
            key: 'hr.live',
            label: 'Heart Rate',
            unit: 'bpm',
            kind: 'line',
            points: labels.map((t: any, i: number) => ({ t: String(t), v: hr[i] ?? null })),
          }}
        />

        <MiniLiveChart
          title="SpO₂"
          subtitle="Live"
          discreet={discreet}
          series={{
            key: 'spo2.live',
            label: 'SpO₂',
            unit: '%',
            kind: 'line',
            points: labels.map((t: any, i: number) => ({ t: String(t), v: spo2[i] ?? null })),
          }}
        />

        <div className="rounded-2xl border bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">SYS</div>
            <div className="text-xs text-slate-500">Live</div>
          </div>
          <div className="mt-2">
            {hideSensitive ? (
              <div className="rounded-xl border border-dashed bg-slate-50 p-4 text-sm text-slate-700">
                <div className="font-medium">Sensitive metric hidden</div>
                <p className="mt-1 text-xs text-slate-500">Turn off Hide sensitive to view.</p>
              </div>
            ) : (
              <TrendChart
                discreet={discreet}
                compare={false}
                series={{
                  key: 'sys.live',
                  label: 'SYS',
                  unit: 'mmHg',
                  kind: 'line',
                  sensitive: true,
                  points: labels.map((t: any, i: number) => ({ t: String(t), v: sys[i] ?? null })),
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniLiveChart(props: { title: string; subtitle: string; series: Series; discreet: boolean }) {
  return (
    <div className="rounded-2xl border bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">{props.title}</div>
        <div className="text-xs text-slate-500">{props.subtitle}</div>
      </div>
      <div className="mt-2">
        <TrendChart discreet={props.discreet} compare={false} series={props.series} />
      </div>
    </div>
  );
}

/* =========================================================
   Activity pane (privacy-safe)
========================================================= */

function ActivityPane(props: {
  liveData: any;
  discreet: boolean;
  isPremium: boolean;
  onRequirePremium: () => void;
}) {
  const { liveData, discreet, isPremium, onRequirePremium } = props;

  const latest = liveData?.latest || {};
  const labels = Array.isArray(liveData?.labels) ? liveData.labels : [];

  const locked = !isPremium;

  const tiles = [
    {
      label: 'Steps',
      value: latest?.steps?.toLocaleString?.() ?? '—',
      series: Array.isArray(liveData?.steps) ? liveData.steps.map((p: any) => safeNum(p?.v)) : [],
    },
    {
      label: 'Calories',
      value: latest?.calories != null ? `${latest.calories} kcal` : '—',
      series: Array.isArray(liveData?.calories) ? liveData.calories.map((p: any) => safeNum(p?.v)) : [],
    },
    {
      label: 'Distance',
      value: latest?.distance != null ? `${latest.distance} km` : '—',
      series: Array.isArray(liveData?.distance) ? liveData.distance.map((p: any) => safeNum(p?.v)) : [],
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs text-slate-500">{t.label}</div>
              <div className="mt-1 text-xl font-semibold text-slate-900">
                {discreet ? <span className="text-slate-400">Hidden</span> : t.value}
              </div>
            </div>

            {locked && (
              <button
                onClick={onRequirePremium}
                className="rounded-xl border bg-white px-3 py-2 text-xs hover:bg-slate-50"
                type="button"
                title="Premium feature"
              >
                Premium ✦
              </button>
            )}
          </div>

          <div className={cn('mt-3', locked && 'opacity-70 pointer-events-none select-none')}>
            <Sparkline labels={labels} values={t.series.filter((v: any) => typeof v === 'number') as any} color="#0f172a" />
          </div>

          {locked && (
            <div className="mt-2">
              <button
                onClick={onRequirePremium}
                className="w-full rounded-2xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                type="button"
              >
                Unlock Premium
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   Safe TrendChart (BIG #2 + BIG #3)
   - no innerHTML tooltips
   - nulls break segments (no fake zeros)
========================================================= */

function TrendChart(props: { series: Series; discreet: boolean; compare: boolean }) {
  const { series, discreet, compare } = props;
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [tip, setTip] = useState<{
    open: boolean;
    x: number;
    y: number;
    idx: number;
    t?: string;
    v?: number | null;
    cv?: number | null;
    xSvg?: number;
    ySvg?: number;
  }>({ open: false, x: 0, y: 0, idx: 0 });

  const points = series.points || [];
  const comparePoints = compare ? (series.comparePoints || []) : [];

  const allVals = useMemo(() => {
    const a = points.map((p) => p.v).filter((v): v is number => typeof v === 'number');
    const b = comparePoints.map((p) => p.v).filter((v): v is number => typeof v === 'number');
    const vals = [...a, ...b];
    if (!vals.length) return { min: 0, max: 1 };
    let min = vals[0];
    let max = vals[0];
    for (const v of vals) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (min === max) {
      min -= 1;
      max += 1;
    } else {
      const pad = (max - min) * 0.08;
      min -= pad;
      max += pad;
    }
    return { min, max };
  }, [points, comparePoints]);

  const width = 720;
  const height = 240;
  const padX = 18;
  const padY = 16;

  const toX = useCallback(
    (i: number, n: number) => {
      if (n <= 1) return padX;
      const t = i / (n - 1);
      return padX + t * (width - padX * 2);
    },
    [padX, width],
  );

  const toY = useCallback(
    (v: number) => {
      const t = (v - allVals.min) / (allVals.max - allVals.min);
      return height - padY - t * (height - padY * 2);
    },
    [allVals.max, allVals.min, height, padY],
  );

  const mainSegments = useMemo(() => buildLineSegments(points, toX, toY), [points, toX, toY]);
  const compareSegments = useMemo(() => (compare ? buildLineSegments(comparePoints, toX, toY) : []), [compare, comparePoints, toX, toY]);

  const areaSegments = useMemo(() => buildAreaSegments(points, toX, toY, height - padY), [points, toX, toY, height, padY]);

  const nearestNonNullIndex = useCallback(
    (idx: number) => {
      const n = points.length;
      if (!n) return 0;
      if (points[idx]?.v != null) return idx;

      for (let r = 1; r < n; r++) {
        const a = idx - r;
        const b = idx + r;
        if (a >= 0 && points[a]?.v != null) return a;
        if (b < n && points[b]?.v != null) return b;
      }
      return idx;
    },
    [points],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (discreet) return; // Discreet disables tooltips everywhere (BIG #4)

      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;

      const n = points.length;
      if (!n) return;
      const t = clamp(px / rect.width, 0, 1);
      const rawIdx = Math.round(t * (n - 1));
      const idx = nearestNonNullIndex(rawIdx);

      const p = points[idx];
      const cp = comparePoints[idx];

      const v = p?.v ?? null;
      const xSvg = toX(idx, n);
      const ySvg = v == null ? undefined : toY(v);

      setTip({
        open: true,
        x: e.clientX,
        y: e.clientY,
        idx,
        t: p?.t,
        v,
        cv: compare && cp ? (cp.v ?? null) : null,
        xSvg,
        ySvg,
      });
    },
    [compare, comparePoints, discreet, nearestNonNullIndex, points, toX, toY],
  );

  const onPointerLeave = useCallback(() => {
    setTip((t) => ({ ...t, open: false }));
  }, []);

  const axisTop = discreet ? `— ${series.unit}` : `${fmt(allVals.max)} ${series.unit}`;
  const axisBottom = discreet ? `— ${series.unit}` : `${fmt(allVals.min)} ${series.unit}`;

  return (
    <div ref={wrapRef} className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[240px] w-full rounded-2xl border bg-gradient-to-b from-white to-slate-50"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        <GridLines width={width} height={height} />

        {/* Area fill (main) */}
        {areaSegments.map((d, i) => (
          <path key={`a-${i}`} d={d} fill="rgba(15, 23, 42, 0.06)" stroke="none" />
        ))}

        {/* Compare (dashed) */}
        {compareSegments.map((d, i) => (
          <path key={`c-${i}`} d={d} fill="none" stroke="rgba(15, 23, 42, 0.28)" strokeWidth="2" strokeDasharray="6 6" />
        ))}

        {/* Main (solid) */}
        {mainSegments.map((d, i) => (
          <path key={`m-${i}`} d={d} fill="none" stroke="rgba(15, 23, 42, 0.92)" strokeWidth="2.5" />
        ))}

        {/* Hover crosshair + dot */}
        {tip.open && tip.xSvg != null ? (
          <g>
            <line x1={tip.xSvg} y1={0} x2={tip.xSvg} y2={height} stroke="rgba(148,163,184,0.35)" strokeWidth="1" />
            {tip.ySvg != null ? (
              <circle cx={tip.xSvg} cy={tip.ySvg} r={4} fill="white" stroke="rgba(15,23,42,0.9)" strokeWidth="2" />
            ) : null}
          </g>
        ) : null}

        <text x={padX} y={12} fontSize="10" fill="rgba(100,116,139,0.9)">
          {axisTop}
        </text>
        <text x={padX} y={height - 6} fontSize="10" fill="rgba(100,116,139,0.9)">
          {axisBottom}
        </text>
      </svg>

      <SafeTooltip
        open={tip.open}
        x={tip.x}
        y={tip.y}
        content={
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-slate-700">{prettyTs(tip.t)}</div>
            <div className="text-[12px] font-semibold text-slate-900">
              {tip.v == null ? '—' : `${fmt(tip.v)} ${series.unit}`}
            </div>
            {compare && (
              <div className="text-[11px] text-slate-600">
                Prev:{' '}
                <span className="font-medium text-slate-800">
                  {tip.cv == null ? '—' : `${fmt(tip.cv)} ${series.unit}`}
                </span>
              </div>
            )}
            <div className="text-[10px] text-slate-400">Nulls are gaps (not zeros).</div>
          </div>
        }
      />
    </div>
  );
}

function buildLineSegments(points: Point[], toX: (i: number, n: number) => number, toY: (v: number) => number) {
  const n = points.length;
  const segs: string[] = [];
  let cur: Array<{ x: number; y: number }> = [];

  const flush = () => {
    if (cur.length >= 2) {
      const d = cur
        .map((p, i) => (i === 0 ? `M ${p.x.toFixed(2)} ${p.y.toFixed(2)}` : `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`))
        .join(' ');
      segs.push(d);
    }
    cur = [];
  };

  for (let i = 0; i < n; i++) {
    const v = points[i]?.v ?? null;
    if (v == null) {
      flush();
      continue;
    }
    cur.push({ x: toX(i, n), y: toY(v) });
  }
  flush();

  return segs;
}

function buildAreaSegments(points: Point[], toX: (i: number, n: number) => number, toY: (v: number) => number, baseY: number) {
  const n = points.length;
  const segs: string[] = [];
  let cur: Array<{ x: number; y: number }> = [];

  const flush = () => {
    if (cur.length >= 2) {
      const first = cur[0];
      const last = cur[cur.length - 1];
      const d =
        `M ${first.x.toFixed(2)} ${baseY.toFixed(2)} ` +
        cur.map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') +
        ` L ${last.x.toFixed(2)} ${baseY.toFixed(2)} Z`;
      segs.push(d);
    }
    cur = [];
  };

  for (let i = 0; i < n; i++) {
    const v = points[i]?.v ?? null;
    if (v == null) {
      flush();
      continue;
    }
    cur.push({ x: toX(i, n), y: toY(v) });
  }
  flush();

  return segs;
}

function GridLines(props: { width: number; height: number }) {
  const { width, height } = props;
  const rows = 4;
  const cols = 6;

  const h = [];
  for (let i = 1; i <= rows; i++) {
    const y = (i / (rows + 1)) * height;
    h.push(<line key={`h-${i}`} x1={0} y1={y} x2={width} y2={y} stroke="rgba(148,163,184,0.22)" strokeWidth="1" />);
  }

  const v = [];
  for (let i = 1; i <= cols; i++) {
    const x = (i / (cols + 1)) * width;
    v.push(<line key={`v-${i}`} x1={x} y1={0} x2={x} y2={height} stroke="rgba(148,163,184,0.18)" strokeWidth="1" />);
  }

  return <g>{h}{v}</g>;
}

/* =========================================================
   Safe tooltip (BIG #2)
========================================================= */

function SafeTooltip(props: { open: boolean; x: number; y: number; content: React.ReactNode }) {
  const { open, x, y, content } = props;
  if (!open) return null;

  const w = 240;
  const h = 110;
  const pad = 12;

  const vx = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vy = typeof window !== 'undefined' ? window.innerHeight : 720;

  const left = clamp(x + 14, pad, vx - w - pad);
  const top = clamp(y + 14, pad, vy - h - pad);

  return (
    <div className="pointer-events-none fixed z-50" style={{ left, top, width: w }} role="presentation" aria-hidden="true">
      <div className="rounded-2xl border bg-white px-3 py-2 shadow-lg">{content}</div>
    </div>
  );
}

/* =========================================================
   Export helpers (privacy-consistent)
========================================================= */

function buildCsvExport(args: { q: ChartsQueryState; privacy: PrivacyState; series: Record<string, Series> }) {
  const { q, privacy, series } = args;

  const lines: string[] = [];
  lines.push(`# Ambulant+ Charts Export`);
  lines.push(`# Range: ${q.range}${q.range === 'custom' ? ` (${q.startISO} → ${q.endISO})` : ''}`);
  lines.push(`# Compare: ${q.compare ? '1' : '0'}`);
  lines.push(`# Discreet: ${privacy.discreet ? '1' : '0'}`);
  lines.push(`# HideSensitive: ${privacy.hideSensitive ? '1' : '0'}`);
  lines.push('');

  for (const s of Object.values(series)) {
    const sensitive = !!s.sensitive || isSensitiveSeriesKey(s.key);
    if (privacy.hideSensitive && sensitive) continue;

    lines.push(`## ${s.label} (${s.key})`);
    lines.push(`t,value,unit${q.compare ? ',compare_value' : ''}`);

    const n = s.points.length;
    for (let i = 0; i < n; i++) {
      const t = s.points[i]?.t ?? '';
      const v = s.points[i]?.v ?? null;
      const cv = q.compare ? (s.comparePoints?.[i]?.v ?? null) : null;

      const outV = privacy.discreet ? '' : v == null ? '' : String(v);
      const outCV = q.compare ? (privacy.discreet ? '' : cv == null ? '' : String(cv)) : undefined;

      lines.push([t, outV, s.unit, ...(q.compare ? [outCV || ''] : [])].join(','));
    }

    lines.push('');
  }

  return lines.join('\n');
}

/* =========================================================
   Upgrade modal
========================================================= */

function UpgradeModal(props: { title: string; body: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-5 shadow-xl">
        <div className="text-base font-semibold text-slate-900">{props.title}</div>
        <div className="mt-2 text-sm text-slate-700">{props.body}</div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={props.onClose} className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-slate-50" type="button">
            Not now
          </button>
          <button
            onClick={() => {
              props.onClose();
              toast('Upgrade flow placeholder (wire to your billing page).', { type: 'info' });
            }}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            type="button"
          >
            Upgrade
          </button>
        </div>
      </div>
    </div>
  );
}
