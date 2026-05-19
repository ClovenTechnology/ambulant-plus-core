'use client';

import React, { useMemo } from 'react';

import { toast } from '@/components/ToastMount';
import {
  buildCsvExport,
  countNonNull,
  cn,
  hasAnyData,
  rangeSubtitle,
  todayISO,
  type ChartDef,
  type ChartsQueryState,
  type Series,
} from '../_lib/charts-ui';

type ChartGridProps = {
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
  downloadTextFile: (filename: string, content: string) => void;
  renderTrendChart: (args: { series: Series; discreet: boolean; compare: boolean }) => React.ReactNode;
};

export default function ChartGrid(props: ChartGridProps) {
  const {
    defs,
    series,
    q,
    isLoading,
    discreet,
    hideSensitive,
    isPremium,
    onRequirePremium,
    onRetry,
    error,
    downloadTextFile,
    renderTrendChart,
  } = props;

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
                      downloadTextFile(
                        `ambulant_${def.seriesKey}_${q.range}_${todayISO()}.csv`,
                        csv,
                      );
                      toast('Exported CSV.', 'success');
                    } catch (e) {
                      console.error(e);
                      toast('Could not export right now.', 'error');
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
            footer={
              <ChartFooter
                series={s}
                discreet={discreet}
                compare={q.compare}
                unitHint={def.unitHint}
              />
            }
          >
            {isLoading ? (
              <SkeletonChart />
            ) : error && !s ? (
              <EmptyChart
                title="Couldn’t load charts"
                subtitle="Retry to fetch your timeline."
                onRetry={onRetry}
              />
            ) : noData ? (
              <EmptyChart
                title="No readings in this range"
                subtitle="Connect a device or add a manual reading."
                onRetry={onRetry}
              />
            ) : (
              <div className={cn('relative', locked && 'pointer-events-none select-none opacity-70')}>
                {renderTrendChart({ series: s, discreet, compare: q.compare })}
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
            <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
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
      <button
        onClick={props.onRetry}
        className="mt-3 rounded-xl border bg-white px-4 py-2 text-sm hover:bg-slate-50"
        type="button"
      >
        Retry
      </button>
    </div>
  );
}

function ChartFooter(props: {
  series?: Series;
  discreet: boolean;
  compare: boolean;
  unitHint?: string;
}) {
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
            {discreet ? 'Hidden' : stats ? String(Math.round(stats.median * 10) / 10) : '—'}
          </span>
        </span>
        <span>
          Min/Max:{' '}
          <span className="font-medium text-slate-800">
            {discreet
              ? 'Hidden'
              : stats
              ? `${Math.round(stats.min * 10) / 10} / ${Math.round(stats.max * 10) / 10}`
              : '—'}
          </span>
        </span>
      </div>
    </div>
  );
}