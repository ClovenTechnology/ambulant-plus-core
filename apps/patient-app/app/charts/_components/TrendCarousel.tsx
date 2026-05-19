'use client';

import React, { useMemo, useState } from 'react';
import { toast } from '@/components/ToastMount';
import {
  buildCsvExport,
  countNonNull,
  hasAnyData,
  rangeSubtitle,
  todayISO,
  type ChartDef,
  type ChartsQueryState,
  type Series,
} from '../_lib/charts-ui';

type TrendCarouselProps = {
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

export default function TrendCarousel(props: TrendCarouselProps) {
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

  const visibleDefs = useMemo(
    () => defs.filter((d) => !(hideSensitive && d.sensitive)),
    [defs, hideSensitive],
  );

  const [page, setPage] = useState(0);
  const perPage = 2;
  const totalPages = Math.max(1, Math.ceil(visibleDefs.length / perPage));
  const safePage = Math.min(page, totalPages - 1);
  const pageDefs = visibleDefs.slice(safePage * perPage, safePage * perPage + perPage);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Trend deck</div>
          <div className="mt-1 text-xs text-slate-600">
            Browse focused chart pairs instead of a long chart wall.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            type="button"
          >
            ← Previous
          </button>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
            {safePage + 1} / {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            type="button"
          >
            Next →
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {visibleDefs.map((def, idx) => (
          <button
            key={def.seriesKey}
            onClick={() => setPage(Math.floor(idx / perPage))}
            className={
              Math.floor(idx / perPage) === safePage
                ? 'rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white'
                : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600'
            }
            type="button"
          >
            {def.title}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {pageDefs.map((def) => {
          const s = series[def.seriesKey];
          const locked = !!def.premium && !isPremium;
          const noData = !s || !hasAnyData(s);

          return (
            <TrendCard
              key={def.seriesKey}
              title={def.title}
              subtitle={def.subtitle || rangeSubtitle(q)}
              badgeRight={
                s ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-600">
                    {discreet ? 'Hidden' : `${countNonNull(s.points)}/${s.points.length} pts`}
                  </span>
                ) : null
              }
              actions={
                <div className="flex items-center gap-2">
                  {locked && (
                    <button
                      onClick={onRequirePremium}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50"
                      type="button"
                    >
                      Premium ✦
                    </button>
                  )}

                  <button
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50 disabled:opacity-60"
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
                    type="button"
                    disabled={noData}
                  >
                    Export
                  </button>
                </div>
              }
            >
              {isLoading ? (
                <SkeletonCard />
              ) : error && !s ? (
                <EmptyCard title="Couldn’t load charts" subtitle="Retry to fetch your timeline." onRetry={onRetry} />
              ) : noData ? (
                <EmptyCard title="No readings in this range" subtitle="Connect a device or add a manual reading." onRetry={onRetry} />
              ) : (
                <div className={locked ? 'pointer-events-none select-none opacity-70' : ''}>
                  {renderTrendChart({ series: s, discreet, compare: q.compare })}
                  {locked ? (
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={onRequirePremium}
                        className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                        type="button"
                      >
                        Unlock Premium
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </TrendCard>
          );
        })}
      </div>
    </div>
  );
}

function TrendCard(props: {
  title: string;
  subtitle?: string;
  badgeRight?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { title, subtitle, badgeRight, actions, children } = props;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
            {badgeRight}
          </div>
          {subtitle ? <div className="mt-0.5 text-xs text-slate-600">{subtitle}</div> : null}
        </div>
        {actions}
      </div>

      <div className="mt-3">{children}</div>
    </div>
  );
}

function SkeletonCard() {
  return <div className="h-[240px] w-full animate-pulse rounded-2xl bg-slate-100" />;
}

function EmptyCard(props: { title: string; subtitle?: string; onRetry: () => void }) {
  return (
    <div className="flex h-[240px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-center">
      <div className="text-sm font-semibold text-slate-800">{props.title}</div>
      {props.subtitle ? <div className="mt-1 text-xs text-slate-600">{props.subtitle}</div> : null}
      <button
        onClick={props.onRetry}
        className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
        type="button"
      >
        Retry
      </button>
    </div>
  );
}