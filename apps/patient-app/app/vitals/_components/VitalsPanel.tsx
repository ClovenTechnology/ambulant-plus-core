// apps/patient-app/app/vitals/_components/VitalsPanel.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import useVitalsSSE from '@/components/useVitalsSSE';
import { usePlan } from '@/components/context/PlanContext';

import VitalsToolbar from './VitalsToolbar';
import VitalsTimeline from './VitalsTimeline';
import VitalsGraphs from './VitalsGraphs';
import VitalsAnnotationModal from './VitalsAnnotationModal';
import {
  badgeProps,
  formatTimeAgo,
  includesToday,
  prettyDevice,
  redactRows,
  safeNum,
  vitalsRangeQuery,
  type Vital,
  type VitalsRange,
} from '../_lib/vitals-ui';

type VitalsPanelProps = {
  range: VitalsRange;
  setRange: (r: VitalsRange) => void;
  customStart: string;
  setCustomStart: (v: string) => void;
  customEnd: string;
  setCustomEnd: (v: string) => void;
  discreet: boolean;
  setDiscreet: (v: boolean) => void;
  hideSensitive: boolean;
  setHideSensitive: (v: boolean) => void;
};

type GraphTab = 'bp' | 'hr' | 'spo2' | 'temp' | 'glucose' | 'steps';

function readNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function readSteps(vital: Vital): number | null {
  const row = vital as Vital & {
    steps?: unknown;
    step_count?: unknown;
    stepCount?: unknown;
    activity_steps?: unknown;
  };

  return (
    readNumber(row.steps) ??
    readNumber(row.step_count) ??
    readNumber(row.stepCount) ??
    readNumber(row.activity_steps)
  );
}

function normaliseVitalIso(value: unknown): string {
  const raw = typeof value === 'string' || value instanceof Date ? value : '';
  const time = raw ? new Date(raw).getTime() : NaN;
  if (!Number.isFinite(time)) return '';

  // Round to nearest second so API and live SSE copies of the same reading collapse.
  return new Date(Math.round(time / 1000) * 1000).toISOString();
}

function normaliseDeviceName(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\/live$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function vitalValueFingerprint(vital: Vital): string {
  const row = vital as Vital & Record<string, unknown>;

  const values = [
    readNumber(row.sys),
    readNumber(row.dia),
    readNumber(row.hr),
    readNumber(row.spo2),
    readNumber(row.temp_c),
    readNumber(row.temperature),
    readNumber(row.glucose_mg_dl),
    readNumber(row.glucose_mmol_l),
    readNumber(row.glucose),
    readSteps(vital),
    // NexRing reports temperature variation/deviation, not actual body temperature.
    readNumber(row.temperatureVariation),
    readNumber(row.temperature_variation),
    readNumber(row.tempDeviation),
    readNumber(row.temp_deviation),
    readNumber(row.temp_delta_c),
  ];

  return values.map((value) => (value == null ? '' : Number(value).toFixed(3))).join('|');
}

function vitalDedupeKey(vital: Vital): string {
  const row = vital as Vital & Record<string, unknown>;
  const id = String(row.id || '').trim();

  // Backend IDs are authoritative when repeated exactly.
  if (id && !id.startsWith('live-')) return `id:${id}`;

  const ts = normaliseVitalIso(row.ts ?? row.recordedAt ?? row.timestamp);
  const device = normaliseDeviceName(row.device ?? row.deviceId ?? row.source);
  const valueKey = vitalValueFingerprint(vital);

  return `reading:${ts}:${device}:${valueKey}`;
}

function dedupeVitals(rows: Vital[]): Vital[] {
  const seen = new Set<string>();
  const out: Vital[] = [];

  for (const row of rows) {
    const key = vitalDedupeKey(row);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    out.push(row);
  }

  return out;
}

function normaliseVitalsPayload(json: unknown): Vital[] {
  if (Array.isArray(json)) return json as Vital[];

  if (json && typeof json === 'object') {
    const row = json as {
      items?: unknown;
      vitals?: unknown;
      data?: unknown;
      rows?: unknown;
    };

    if (Array.isArray(row.items)) return row.items as Vital[];
    if (Array.isArray(row.vitals)) return row.vitals as Vital[];
    if (Array.isArray(row.data)) return row.data as Vital[];
    if (Array.isArray(row.rows)) return row.rows as Vital[];
  }

  return [];
}

export default function VitalsPanel(props: VitalsPanelProps) {
  const {
    range,
    setRange,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    discreet,
    setDiscreet,
    hideSensitive,
    setHideSensitive,
  } = props;

  const qc = useQueryClient();
  const { isPremium } = usePlan();

  const [unitC, setUnitC] = useState(true);
  const [glucoseMgDl, setGlucoseMgDl] = useState(true);
  const [view, setView] = useState<'list' | 'graph'>('list');
  const [graphTab, setGraphTab] = useState<GraphTab>('bp');

  const exportRef = useRef<HTMLDivElement | null>(null);

  const [annotateTarget, setAnnotateTarget] = useState<Vital | null>(null);
  const [annotateText, setAnnotateText] = useState('');
  const [annotateSaving, setAnnotateSaving] = useState(false);
  const [annotateError, setAnnotateError] = useState<string | null>(null);

  const [lastUpdateLabel, setLastUpdateLabel] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const v = window.localStorage.getItem('vitals:view');
      const g = window.localStorage.getItem('vitals:graphTab');
      const c = window.localStorage.getItem('vitals:unitC');
      const gl = window.localStorage.getItem('vitals:glucoseMgDl');

      if (v === 'list' || v === 'graph') setView(v);

      if (
        g === 'bp' ||
        g === 'hr' ||
        g === 'spo2' ||
        g === 'temp' ||
        g === 'glucose' ||
        g === 'steps'
      ) {
        setGraphTab(g);
      }

      if (c === 'true' || c === 'false') setUnitC(c === 'true');
      if (gl === 'true' || gl === 'false') setGlucoseMgDl(gl === 'true');
    } catch {
      // Local preferences are optional.
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem('vitals:view', view);
    } catch {}
  }, [view]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem('vitals:graphTab', graphTab);
    } catch {}
  }, [graphTab]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem('vitals:unitC', String(unitC));
    } catch {}
  }, [unitC]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem('vitals:glucoseMgDl', String(glucoseMgDl));
    } catch {}
  }, [glucoseMgDl]);

  useEffect(() => {
    if (range !== 'custom') return;
    if (!customStart || !customEnd) return;

    if (customEnd < customStart) {
      setCustomStart(customEnd);
      setCustomEnd(customStart);
    }
  }, [range, customStart, customEnd, setCustomStart, setCustomEnd]);

  const rangeKey = useMemo(() => {
    if (range !== 'custom') return range;
    return `custom:${customStart || ''}:${customEnd || ''}`;
  }, [range, customStart, customEnd]);

  const {
    data: rows = [],
    isLoading,
    isFetching,
    error,
  } = useQuery<Vital[], Error>({
    queryKey: ['vitals', rangeKey],
    queryFn: async () => {
      const url = new URL('/api/vitals', window.location.origin);
      url.searchParams.set('range', range);

      if (range === 'custom') {
        if (customStart?.trim()) {
          url.searchParams.set('start', customStart.trim());
        }

        if (customEnd?.trim()) {
          url.searchParams.set('end', customEnd.trim());
        }
      }

      const response = await fetch(url.toString(), { cache: 'no-store' });

      if (!response.ok) {
        throw new Error(`vitals_http_${response.status}`);
      }

      const json = await response.json().catch(() => []);
      return dedupeVitals(normaliseVitalsPayload(json));
    },
    refetchOnWindowFocus: false,
  });

  const { latest } = useVitalsSSE('default-room');

  useEffect(() => {
    if (!latest) return;
    if (!includesToday(range, customEnd)) return;

    const v: Vital = {
      id: `live-${latest.ts}`,
      ts: new Date(latest.ts).toISOString(),
      hr: latest.hr,
      spo2: latest.spo2,
      temp_c: latest.tempC,
      sys: latest.bp?.sys,
      dia: latest.bp?.dia,
      glucose_mg_dl: latest.glucose,
      device: 'NexRing/Live',
    };

    qc.setQueryData(['vitals', rangeKey], (old: unknown) => {
      const prev = Array.isArray(old) ? (old as Vital[]) : [];
      return dedupeVitals([v, ...prev]).slice(0, 4000);
    });
  }, [latest, qc, range, rangeKey, customEnd]);

  const sorted = useMemo(() => {
    return dedupeVitals(rows).sort(
      (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime(),
    );
  }, [rows]);

  useEffect(() => {
    const preferLive = includesToday(range, customEnd);
    const ts = (preferLive ? latest?.ts : undefined) ?? sorted[0]?.ts;

    if (!ts) {
      setLastUpdateLabel('');
      return;
    }

    const iso = typeof ts === 'string' ? ts : new Date(ts).toISOString();

    setLastUpdateLabel(formatTimeAgo(iso));

    const id = window.setInterval(() => {
      setLastUpdateLabel(formatTimeAgo(iso));
    }, 15_000);

    return () => window.clearInterval(id);
  }, [latest, sorted, range, customEnd]);

  const groupedByDay = useMemo(() => {
    const map = new Map<string, Vital[]>();

    for (const v of sorted.slice(0, 300)) {
      const dayDate = new Date(v.ts);
      const today = new Date();
      const yesterday = new Date();

      yesterday.setDate(yesterday.getDate() - 1);

      let key = dayDate.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });

      if (dayDate.toDateString() === today.toDateString()) {
        key = 'Today';
      } else if (dayDate.toDateString() === yesterday.toDateString()) {
        key = 'Yesterday';
      }

      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    }

    return Array.from(map.entries());
  }, [sorted]);

  async function handleAnnotateSave() {
    if (!annotateTarget || !annotateText.trim()) {
      setAnnotateTarget(null);
      setAnnotateText('');
      setAnnotateError(null);
      return;
    }

    try {
      setAnnotateSaving(true);
      setAnnotateError(null);

      const response = await fetch(`/api/vitals/${annotateTarget.id}/annotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: annotateText.trim() }),
      });

      if (!response.ok) {
        setAnnotateError('Failed to save note. Please try again.');
        return;
      }

      await qc.invalidateQueries({ queryKey: ['vitals'] });

      setAnnotateTarget(null);
      setAnnotateText('');
    } catch {
      setAnnotateError('Failed to save note. Please try again.');
    } finally {
      setAnnotateSaving(false);
    }
  }

  function downloadCSV() {
    const redacted = redactRows(sorted, discreet, hideSensitive);
    const fnameBase = discreet || hideSensitive ? 'vitals-redacted' : 'vitals';

    const headers = [
      'id',
      'ts',
      'device',
      'hr',
      'sys',
      'dia',
      'spo2',
      'temp_c',
      'bmi',
      'glucose_mg_dl',
    ];

    const escapeCsv = (value: unknown) => {
      const s = String(value ?? '');
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const rowsCsv = [
      headers.join(','),
      ...redacted.map((row) =>
        headers
          .map((key) => escapeCsv((row as Record<string, unknown>)[key]))
          .join(','),
      ),
    ].join('\n');

    const blob = new Blob([rowsCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `${fnameBase}-${new Date().toISOString()}.csv`;
    anchor.click();

    URL.revokeObjectURL(url);
  }

  const deviceSetForWindow = useMemo(() => {
    const set = new Set<string>();

    for (const vital of sorted) {
      if (vital.device) set.add(prettyDevice(vital.device));
    }

    if (!set.size) return 'Unknown';
    return Array.from(set).join(', ');
  }, [sorted]);

  const sensitiveTabHidden =
    hideSensitive && (graphTab === 'bp' || graphTab === 'glucose');

  const currentTabBadge = useMemo(() => {
    if (discreet || sensitiveTabHidden) return badgeProps('unknown');
    return badgeProps('normal');
  }, [discreet, sensitiveTabHidden]);

  const isEmpty = !isLoading && !sorted.length;

  const sparklineData = useMemo(() => {
    const src = sorted.slice(0, 120);

    const hr = src.map((s) => safeNum(s.hr));
    const hr_ts = src.map((s) => s.ts);

    const spo2 = src.map((s) => safeNum(s.spo2));
    const spo2_ts = src.map((s) => s.ts);

    const temp = src.map((s) => {
      const c = safeNum(s.temp_c);
      if (c == null) return null;
      return unitC ? c : (c * 9) / 5 + 32;
    });
    const temp_ts = src.map((s) => s.ts);

    const glucose = src.map((s) => {
      const g = safeNum(s.glucose_mg_dl);
      if (g == null) return null;
      return glucoseMgDl ? g : g / 18;
    });
    const glucose_ts = src.map((s) => s.ts);

    const bpPoints = src
      .map((s) => ({
        ts: s.ts,
        sys: safeNum(s.sys),
        dia: safeNum(s.dia),
      }))
      .filter(
        (p): p is { ts: string; sys: number; dia: number } =>
          typeof p.sys === 'number' && typeof p.dia === 'number',
      );

    const bpSys = src.map((s) => safeNum(s.sys));
    const bpDia = src.map((s) => safeNum(s.dia));
    const bp_ts = src.map((s) => s.ts);

    const steps = src.map((s) => readSteps(s));

    return {
      bpPoints,
      bpSys,
      bpDia,
      bp_ts,
      hr,
      hr_ts,
      spo2,
      spo2_ts,
      temp,
      temp_ts,
      glucose,
      glucose_ts,
      steps,
    };
  }, [sorted, unitC, glucoseMgDl]);

  function displayValue(opts: { value: string; sensitive?: boolean }) {
    if (discreet) return '•••';
    if (opts.sensitive && hideSensitive) return 'Hidden';
    return opts.value;
  }

  const exportDisabledReason = useMemo(() => {
    void isPremium;
    return null as string | null;
  }, [isPremium]);

  const chartsRangeParams = useMemo(
    () => vitalsRangeQuery(range, customStart, customEnd),
    [range, customStart, customEnd],
  );

  return (
    <div className="space-y-4">
      <section aria-label="Vitals history">
        <div className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm backdrop-blur">
          <VitalsToolbar
            range={range}
            setRange={setRange}
            customStart={customStart}
            setCustomStart={setCustomStart}
            customEnd={customEnd}
            setCustomEnd={setCustomEnd}
            discreet={discreet}
            setDiscreet={setDiscreet}
            hideSensitive={hideSensitive}
            setHideSensitive={setHideSensitive}
            unitC={unitC}
            setUnitC={setUnitC}
            glucoseMgDl={glucoseMgDl}
            setGlucoseMgDl={setGlucoseMgDl}
            view={view}
            setView={setView}
            exportRef={exportRef}
            downloadCSV={downloadCSV}
            exportDisabledReason={exportDisabledReason}
            lastUpdateLabel={lastUpdateLabel}
          />

          <div ref={exportRef} className="p-4">
            {isLoading && !rows.length && (
              <div className="space-y-3">
                <div className="h-4 w-40 animate-pulse rounded bg-gray-100" />

                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-10 animate-pulse rounded-2xl border bg-slate-50"
                    />
                  ))}
                </div>
              </div>
            )}

            {error && !isLoading && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                Unable to load vitals right now. Please check your connection and
                try again.
              </div>
            )}

            {isEmpty && !isLoading && !error && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-gray-600">
                <div className="mb-1 font-medium">No vitals yet</div>

                <p className="text-xs text-gray-500">
                  Take a reading with your Health Monitor or wear your NexRing
                  for 24 hours to start building your vitals timeline.
                </p>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                    Start Health Monitor check
                  </span>

                  <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-sky-700">
                    Sync NexRing data
                  </span>
                </div>
              </div>
            )}

            {!isEmpty && !isLoading && !error && (
              <>
                {view === 'list' ? (
                  <VitalsTimeline
                    groupedByDay={groupedByDay}
                    chartsRangeParams={chartsRangeParams}
                    discreet={discreet}
                    hideSensitive={hideSensitive}
                    unitC={unitC}
                    glucoseMgDl={glucoseMgDl}
                    displayValue={displayValue}
                    displayBadge={(status, sensitive) => {
                      if (discreet) return badgeProps('unknown');
                      if (sensitive && hideSensitive) return badgeProps('unknown');
                      return badgeProps(status);
                    }}
                    onAddNote={(v) => {
                      setAnnotateTarget(v);
                      setAnnotateText('');
                      setAnnotateError(null);
                    }}
                  />
                ) : (
                  <VitalsGraphs
                    graphTab={graphTab}
                    setGraphTab={setGraphTab}
                    discreet={discreet}
                    hideSensitive={hideSensitive}
                    unitC={unitC}
                    glucoseMgDl={glucoseMgDl}
                    sparklineData={sparklineData}
                    currentTabBadge={currentTabBadge}
                    deviceSetForWindow={deviceSetForWindow}
                    sensitiveTabHidden={sensitiveTabHidden}
                  />
                )}
              </>
            )}
          </div>

          {isFetching && !isLoading && !error && (
            <div className="px-4 pb-3 text-[11px] text-gray-400">
              Updating in the background…
            </div>
          )}
        </div>
      </section>

      <VitalsAnnotationModal
        target={annotateTarget}
        discreet={discreet}
        annotateText={annotateText}
        setAnnotateText={setAnnotateText}
        annotateError={annotateError}
        annotateSaving={annotateSaving}
        onClose={() => {
          setAnnotateTarget(null);
          setAnnotateText('');
          setAnnotateError(null);
        }}
        onSave={handleAnnotateSave}
      />
    </div>
  );
}