'use client';

import React from 'react';
import type { BodyAreaKey } from '@/components/selfcheck/BodyMap2D';
import { labelBodyAreaKey } from '@/components/selfcheck/BodyMap2D';

export default function SelfCheckRightRail(props: {
  areas: BodyAreaKey[];
  busy: boolean;
  hasAnalyzed: boolean;
  onAnalyze: () => void;
  onCopy: () => void;
}) {
  const { areas, busy, hasAnalyzed, onAnalyze, onCopy } = props;

  return (
    <aside className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Assessment status</div>
        <div className="mt-2 text-sm text-slate-600">
          {hasAnalyzed
            ? 'InsightCore analysis completed.'
            : 'Complete Steps 1 and 2, then run analysis to unlock results.'}
        </div>

        <div className="mt-3 text-xs text-slate-500">
          Selected body areas:{' '}
          {areas.length ? areas.map(labelBodyAreaKey).join(', ') : 'None selected'}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onAnalyze}
            disabled={busy}
            className="flex-1 rounded-xl bg-cyan-600 px-3 py-2 font-semibold text-white disabled:opacity-50"
            type="button"
          >
            {busy ? 'Checking…' : hasAnalyzed ? 'Re-check' : 'Analyze'}
          </button>
          <button
            onClick={onCopy}
            disabled={!hasAnalyzed}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            type="button"
          >
            Copy summary
          </button>
        </div>

        <div className="mt-3 text-xs leading-5 text-slate-500">
          Results are generated only after a successful InsightCore response. No local
          fallback score is used.
        </div>
      </div>
    </aside>
  );
}
