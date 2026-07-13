// apps/patient-app/app/charts/page.tsx
/**
 * /charts/page.tsx — World-class Charts dashboard (Apple-clean, consistent with /vitals)
 * -----------------------------------------------------------------------------------
 * Big 4 (same contract as /vitals):
 * 1) Canonical range (URL source of truth): ?range=20|7d|30d|90d|1y|custom&start=YYYY-MM-DD&end=YYYY-MM-DD
 * 2) Safe tooltips: React tooltip (no innerHTML) + viewport clamping
 * 3) Null-gap rendering: null/undefined/non-finite => GAP (no synthetic zeros)
 * 4) Consistent privacy (same localStorage keys as /vitals):
 *    - vitals:discreet
 *    - vitals:hideSensitive
 *    Applies across: tiles, charts, tooltips, and exports.
 */

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { toast } from '@/components/ToastMount';
import { usePlan } from '@/components/context/PlanContext';

import '../../lib/chartRegistry';

import useLiveVitals from '../../components/charts/useLiveVitals';
import { exportElementAsPdf, shareFile } from '@/components/charts/export';

import { CollapseBtn } from '../../components/CollapseBtn';
import { Collapse } from '../../components/Collapse';

import ChartsControlBar from './_components/ChartsControlBar';
import LivePane from './_components/LivePane';
import ActivityPane from './_components/ActivityPane';
import TrendChart, { type TrendOverlay } from './_components/TrendChart';
import OverviewPane from './_components/OverviewPane';
import UpgradeModal from './_components/UpgradeModal';
import TrendCarousel from './_components/TrendCarousel';
import SleepPane from './_components/SleepPane';

import {
  buildChartsApiUrl,
  buildCsvExport,
  CHART_DEFS,
  defaultCustomWindow,
  deriveStateFromSearchParams,
  downloadTextFile,
  fmt,
  fmtInt,
  isISODate,
  isSensitiveSeriesKey,
  LS_DISCREET,
  LS_HIDE_SENSITIVE,
  normalizeSearchParams,
  PANES_LS,
  prettyTs,
  toCanonicalSearchParams,
  todayISO,
  type ChartsApiResponse,
  type ChartsQueryState,
  type PaneKey,
  type PrivacyState,
  type Series,
} from './_lib/charts-ui';

/* =========================================================
   Privacy prefs (CONSISTENT with /vitals)
========================================================= */

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

/* =========================================================
   Canonical query
========================================================= */

function useCanonicalChartsQuery() {
  const router = useRouter();
  const pathname = usePathname() ?? '/charts';
  const spRO = useSearchParams();
  const spStr = useMemo(() => spRO?.toString() ?? '', [spRO]);

  const state = useMemo(() => deriveStateFromSearchParams(new URLSearchParams(spStr)), [spStr]);

  useEffect(() => {
    const canon = normalizeSearchParams(toCanonicalSearchParams(state).toString());
    const current = normalizeSearchParams(spStr);
    if (canon !== current) {
      const href = canon ? `${pathname}?${canon}` : pathname;
      router.replace(href, { scroll: false });
    }
  }, [pathname, router, spStr, state]);

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

      const canon = normalizeSearchParams(toCanonicalSearchParams(next).toString());
      const href = canon ? `${pathname}?${canon}` : pathname;
      router.replace(href, { scroll: false });
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
   Data fetching
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

function toIsoStringSafe(v: unknown): string | null {
  if (typeof v === 'string') {
    const n = Date.parse(v);
    return Number.isFinite(n) ? new Date(n).toISOString() : null;
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    return new Date(v).toISOString();
  }
  return null;
}

function normalizeSleepOverlays(sleep: any): TrendOverlay[] {
  const sessions = Array.isArray(sleep?.sessions)
    ? sleep.sessions
    : Array.isArray(sleep?.data?.sessions)
      ? sleep.data.sessions
      : [];

  return sessions
    .map((s: any) => {
      const startTs = toIsoStringSafe(s?.startTs ?? s?.startTime ?? s?.start ?? s?.bedTime);
      const endTs = toIsoStringSafe(s?.endTs ?? s?.endTime ?? s?.end ?? s?.wakeTimeTs);

      if (!startTs || !endTs) return null;

      return {
        kind: 'sleep' as const,
        startTs,
        endTs,
        label: 'Sleep',
      };
    })
    .filter(Boolean) as TrendOverlay[];
}

function normalizeMedicationOverlays(payload: any): TrendOverlay[] {
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

  return items
    .map((m: any) => {
      const atTs = toIsoStringSafe(
        m?.takenAt ??
          m?.scheduledAt ??
          m?.time ??
          m?.nextDoseAt ??
          m?.lastTakenAt,
      );
      if (!atTs) return null;

      const label =
        String(
          m?.name ??
            m?.medicationName ??
            m?.title ??
            m?.drugName ??
            'Medication',
        ).trim() || 'Medication';

      return {
        kind: 'med' as const,
        atTs,
        label,
        note: m?.dose ? String(m.dose) : undefined,
      };
    })
    .filter(Boolean) as TrendOverlay[];
}

/* =========================================================
   Page
========================================================= */

function ChartsPageContent() {
  const { isPremium } = usePlan();
  const { state: q, setState: setQ } = useCanonicalChartsQuery();
  const privacy = usePrivacyPrefs();

  const exportRef = useRef<HTMLDivElement | null>(null);

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

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const requirePremium = useCallback(() => setUpgradeOpen(true), []);

  const apiUrl = useMemo(() => buildChartsApiUrl(q), [q]);

  const { data, error, isLoading, mutate } = useSWR<ChartsApiResponse>(apiUrl, fetcherJSON, {
    revalidateOnFocus: false,
  });

  const medsOverlayEnabled = q.overlay.includes('meds');
  const sleepOverlayEnabled = q.overlay.includes('sleep');

  const { data: medsData } = useSWR(
    medsOverlayEnabled ? '/api/medications' : null,
    fetcherJSON,
    { revalidateOnFocus: false },
  );

  const { data: liveData, live: liveOnline, flags } = useLiveVitals(120, 15);

  const sleepPayload = (liveData as any)?.sleep ?? {
    totalHours: 0,
    stages: { light: 0, deep: 0, rem: 0 },
    sessions: [],
    updatedAt: null,
  };

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

  const chartOverlays = useMemo(() => {
    const overlaysBySeries: Record<string, TrendOverlay[]> = {};

    const attach = (seriesKeys: string[], overlay: TrendOverlay) => {
      for (const key of seriesKeys) {
        if (!overlaysBySeries[key]) overlaysBySeries[key] = [];
        overlaysBySeries[key].push(overlay);
      }
    };

    if (sleepOverlayEnabled) {
      for (const ov of normalizeSleepOverlays(sleepPayload)) {
        attach(['hr', 'spo2', 'rr', 'temp', 'sleep.total'], ov);
      }
    }

    if (medsOverlayEnabled) {
      for (const ov of normalizeMedicationOverlays(medsData)) {
        attach(['hr', 'spo2', 'rr', 'temp', 'sys', 'dia', 'glucose'], ov);
      }
    }

    return overlaysBySeries;
  }, [sleepOverlayEnabled, medsOverlayEnabled, sleepPayload, medsData]);

  const exportAllCsv = useCallback(() => {
    try {
      const csv = buildCsvExport({
        q,
        privacy: { discreet: privacy.discreet, hideSensitive: privacy.hideSensitive },
        series: effectiveSeries,
      });
      downloadTextFile(`ambulant_charts_${q.range}_${todayISO()}.csv`, csv);
      toast('Exported CSV.', 'success');
    } catch (e: any) {
      console.error(e);
      toast('Could not export right now.', 'error');
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
    <div data-p-ui="patient-charts-page" className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <main ref={exportRef} className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        <header data-p-ui="patient-charts-hero" className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:rounded-3xl sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <Link
                href="/vitals"
                className="mt-0.5 hidden sm:inline-flex rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                ← Vitals
              </Link>

              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                  Trend intelligence
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">Charts</h1>
                  <span
                    className={
                      liveOnline
                        ? 'inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700'
                        : 'inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700'
                    }
                    aria-live="polite"
                  >
                    <span className={liveOnline ? 'h-2 w-2 rounded-full bg-emerald-500' : 'h-2 w-2 rounded-full bg-rose-500'} />
                    {liveOnline ? 'Live data available' : 'No live feed'}
                  </span>
                </div>

                <p className="mt-2 text-sm text-slate-600">
                  Derived trends from persisted vitals with privacy-safe charts and honest gaps.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
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
                    <span className="font-medium text-slate-900">
                      {privacy.discreet ? 'Hidden' : prettyTs(lastTimelineTs || undefined)}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div data-p-ui="patient-charts-actions" className="flex w-full flex-col gap-2 self-stretch sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:self-start">
              <button
                onClick={expandAll}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                type="button"
              >
                Expand all
              </button>
              <button
                onClick={collapseAll}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                type="button"
              >
                Collapse all
              </button>

              <div className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />

              <button
                onClick={exportAllCsv}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                type="button"
                title={privacy.discreet ? 'Export is redacted in Discreet mode' : 'Export visible data'}
              >
                CSV
              </button>
              <button
                onClick={exportPdf}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                type="button"
                title={privacy.discreet || privacy.hideSensitive ? 'PDF export will be redacted' : 'Export PDF'}
              >
                PDF
              </button>
              <button
                onClick={shareSnapshot}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                type="button"
              >
                Share
              </button>
            </div>
          </div>
        </header>

        <div data-p-ui="patient-charts-controlbar" className="mt-4 min-w-0">
          <ChartsControlBar
            q={q}
            onChange={setQ}
            isPremium={!!isPremium}
            onRequirePremium={requirePremium}
            privacy={privacy}
          />
        </div>

        <section className="mt-6 space-y-3" aria-label="Overview">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
            <OverviewPane
              discreet={privacy.discreet}
              qRange={q.range}
              coverageAvg={coverageAvg}
              anomaliesCount={anomaliesCount}
              quickMetrics={quickMetrics}
              effectiveSeries={effectiveSeries}
              error={error ? String((error as any)?.message || 'Error') : null}
              onRetry={() => mutate()}
            />
          </Collapse>
        </section>

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
            <TrendCarousel
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
              downloadTextFile={downloadTextFile}
              renderTrendChart={({ series, discreet, compare }) => (
                <TrendChart
                  series={series}
                  discreet={discreet}
                  compare={compare}
                  overlays={chartOverlays[series.key] || []}
                />
              )}
            />
          </Collapse>
        </section>

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
              renderTrendChart={({ series, discreet, compare }) => (
                <TrendChart series={series} discreet={discreet} compare={compare} />
              )}
            />
          </Collapse>
        </section>

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

        <section className="mt-8 space-y-3" aria-label="Sleep">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Sleep</h2>
              <p className="text-xs text-slate-500">Sleep sessions and stages from connected sleep-capable devices.</p>
            </div>
            <CollapseBtn
              open={panes.sleep}
              onClick={() => setPane('sleep', !panes.sleep)}
              titleOpen="Collapse"
              titleClosed="Expand"
            />
          </div>

          <Collapse open={panes.sleep}>
            <SleepPane sleep={sleepPayload} discreet={privacy.discreet} />
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
          Ambulatory analytics on Ambulant+ is powered by InsightCore · Privacy toggles apply everywhere
        </div>
      </main>
    </div>
  );
}

export default function ChartsPage() {
  return (
    <Suspense fallback={null}>
      <ChartsPageContent />
    </Suspense>
  );
}

