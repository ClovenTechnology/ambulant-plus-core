'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  clamp,
  cn,
  fmt,
  prettyTs,
  safeNum,
  type Series,
} from '../_lib/charts-ui';

type LivePaneProps = {
  liveOnline: boolean;
  flags: any;
  liveData: any;
  discreet: boolean;
  hideSensitive: boolean;
  renderTrendChart: (args: {
    series: Series;
    discreet: boolean;
    compare: boolean;
  }) => React.ReactNode;
};

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
    <div className="rounded-2xl border bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
            {source ? (
              <div className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] text-slate-600">
                {discreet ? '—' : source}
              </div>
            ) : null}
          </div>
          <div className="mt-1 truncate text-lg font-semibold text-slate-900 xl:text-[20px]">
            {discreet ? <span className="text-slate-400">Hidden</span> : value}
          </div>
          {sub ? <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div> : null}
        </div>

        <div aria-hidden className="ml-3 flex-shrink-0 text-sm">
          {deltaStr && !discreet ? (
            <div
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                d != null && d > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700',
              )}
            >
              {d != null && d > 0 ? '▲' : '▼'} {deltaStr}
            </div>
          ) : null}
          {deltaStr && discreet ? (
            <div className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-400">
              —
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MiniLiveChart(props: {
  title: string;
  subtitle: string;
  series: Series;
  discreet: boolean;
  renderTrendChart: LivePaneProps['renderTrendChart'];
}) {
  return (
    <div className="rounded-2xl border bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">{props.title}</div>
        <div className="text-xs text-slate-500">{props.subtitle}</div>
      </div>
      <div className="mt-2">
        {props.renderTrendChart({
          series: props.series,
          discreet: props.discreet,
          compare: false,
        })}
      </div>
    </div>
  );
}

export default function LivePane(props: LivePaneProps) {
  const { liveOnline, flags, liveData, discreet, hideSensitive, renderTrendChart } = props;

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
  const src = useCallback((metric: string) => getSourceFor(liveData, metric) ?? undefined, [liveData]);

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
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              BP Alert
            </span>
          )}
          {flags?.HR_HIGH && !discreet && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              HR Alert
            </span>
          )}
        </div>

        <div className="text-xs text-slate-500">
          {labels?.length ? `${labels.length} samples (last ~2 minutes)` : 'Awaiting samples…'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-7">
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MiniLiveChart
          title="HR"
          subtitle="Live"
          discreet={discreet}
          renderTrendChart={renderTrendChart}
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
          renderTrendChart={renderTrendChart}
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
              renderTrendChart({
                discreet,
                compare: false,
                series: {
                  key: 'sys.live',
                  label: 'SYS',
                  unit: 'mmHg',
                  kind: 'line',
                  sensitive: true,
                  points: labels.map((t: any, i: number) => ({ t: String(t), v: sys[i] ?? null })),
                },
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}