'use client';

import React from 'react';
import MeterDonut from '@/components/charts/AnimatedMeterDonut';
import Sparkline from '@/components/charts/Sparkline';
import { prettyTs, type Series } from '../_lib/charts-ui';

type QuickMetric = {
  k: string;
  label: string;
  value: string | null;
  unit?: string;
  sensitive?: boolean;
  t?: string | null;
};

type OverviewPaneProps = {
  discreet: boolean;
  qRange: string;
  coverageAvg: number | null;
  anomaliesCount: number;
  quickMetrics: QuickMetric[];
  effectiveSeries: Record<string, Series>;
  error: string | null;
  onRetry: () => void;
};

export default function OverviewPane(props: OverviewPaneProps) {
  const {
    discreet,
    qRange,
    coverageAvg,
    anomaliesCount,
    quickMetrics,
    effectiveSeries,
    error,
    onRetry,
  } = props;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Timeline quality</div>
            <div className="mt-0.5 text-xs text-slate-600">
              How complete your readings are in this range.
            </div>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-600">
            {discreet ? 'Hidden' : `Anomalies: ${anomaliesCount}`}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <div className="h-20 w-20">
            {discreet ? (
              <div className="h-20 w-20 rounded-full border bg-slate-50" />
            ) : (
              <MeterDonut
                value={Math.round((coverageAvg ?? 0) * 100)}
                max={100}
              />
            )}
          </div>

          <div className="flex-1">
            <div className="text-xs text-slate-500">Coverage</div>
            <div className="text-2xl font-semibold text-slate-900">
              {discreet ? (
                <span className="text-slate-400">Hidden</span>
              ) : coverageAvg == null ? (
                '—'
              ) : (
                `${Math.round(coverageAvg * 100)}%`
              )}
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
            Couldn’t load timeline charts: {error}
            <button className="ml-2 underline" type="button" onClick={onRetry}>
              Retry
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm lg:col-span-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Latest readings</div>
            <div className="mt-0.5 text-xs text-slate-600">
              Most recent points from your timeline.
            </div>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-600">
            {discreet ? 'Discreet on' : qRange === '20' ? 'Last 20' : qRange.toUpperCase()}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {quickMetrics.map((m) => (
            <div key={m.k} className="rounded-2xl border bg-slate-50/70 p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-slate-600">{m.label}</div>
                <div className="text-[10px] text-slate-400">
                  {discreet ? '—' : m.t ? prettyTs(m.t) : '—'}
                </div>
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-900">
                {discreet ? (
                  <span className="text-slate-400">Hidden</span>
                ) : m.value ?? (
                  <span className="text-slate-400">—</span>
                )}
                {!discreet && m.value != null && m.unit ? (
                  <span className="ml-1 text-xs font-medium text-slate-500">{m.unit}</span>
                ) : null}
              </div>
              <div className="mt-2 h-8">
                {discreet ? (
                  <div className="h-8 rounded-lg border border-dashed bg-white" />
                ) : (
                  <MiniSpark series={effectiveSeries[m.k === 'bp' ? 'sys' : m.k]} />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <span className="rounded-full bg-slate-100 px-3 py-1">
            Tooltips: {discreet ? 'Off' : 'On'}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1">
            Overview summary
          </span>
        </div>
      </div>
    </div>
  );
}

function MiniSpark(props: { series?: Series | null }) {
  const s = props.series;
  if (!s || !Array.isArray(s.points) || s.points.length < 2) {
    return <div className="h-8 rounded-lg border border-dashed bg-white" />;
  }

  const labels = s.points.map((p) => p?.t ?? '');
  const values = s.points.map((p) =>
    typeof p?.v === 'number' && Number.isFinite(p.v) ? p.v : null,
  );

  const hasAny = values.some((v) => typeof v === 'number');
  if (!hasAny) return <div className="h-8 rounded-lg border border-dashed bg-white" />;

  return (
    <div className="h-8 overflow-hidden rounded-lg border bg-white">
      <Sparkline
        labels={labels}
        values={values}
        color="#0f172a"
        showArea
        live={false}
        showLastValueBadge={false}
      />
    </div>
  );
}