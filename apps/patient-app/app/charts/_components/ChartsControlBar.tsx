'use client';

import React, { useCallback } from 'react';
import {
  cn,
  type ChartsQueryState,
  type OverlayKey,
  type PrivacyState,
  type RangeKey,
} from '../_lib/charts-ui';

export default function ChartsControlBar(props: {
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

  const setCustomStart = useCallback(
    (v: string) => onChange({ range: 'custom', startISO: v }),
    [onChange],
  );

  const setCustomEnd = useCallback(
    (v: string) => onChange({ range: 'custom', endISO: v }),
    [onChange],
  );

  return (
    <div className="sticky top-2 z-20 rounded-2xl border bg-white/90 p-3 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
                    q.range === r
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'bg-white hover:bg-slate-50',
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={toggleCompare}
            className={cn(
              'rounded-xl border px-3 py-2 text-sm transition',
              q.compare
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'bg-white hover:bg-slate-50',
            )}
            title={!isPremium ? 'Premium feature' : 'Compare previous period'}
            type="button"
          >
            Compare {!isPremium ? <span className="ml-1 text-[10px]">✦</span> : null}
          </button>

          <div className="mx-1 hidden h-7 w-px bg-slate-200 md:block" />

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Overlay</span>
            {(['sleep', 'activity', 'meds', 'symptoms', 'cycle'] as OverlayKey[]).map((k) => (
              <button
                key={k}
                onClick={() => toggleOverlay(k)}
                className={cn(
                  'rounded-xl border px-3 py-2 text-sm transition',
                  q.overlay.includes(k)
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'bg-white hover:bg-slate-50',
                )}
                title={!isPremium ? 'Premium feature' : `Toggle ${k}`}
                type="button"
              >
                {k}
                {!isPremium ? <span className="ml-1 text-[10px]">✦</span> : null}
              </button>
            ))}
          </div>

          <div className="mx-1 hidden h-7 w-px bg-slate-200 md:block" />

          <button
            onClick={() => privacy.setDiscreet(!privacy.discreet)}
            className={cn(
              'rounded-xl border px-3 py-2 text-sm transition',
              privacy.discreet
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'bg-white hover:bg-slate-50',
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
              privacy.hideSensitive
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'bg-white hover:bg-slate-50',
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