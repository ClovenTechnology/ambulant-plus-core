'use client';

import React from 'react';

import WellnessInsightsCard from '@/components/selfcheck/WellnessInsightsCard';
import type { BodyAreaKey } from '@/components/selfcheck/BodyMap2D';
import { labelBodyAreaKey } from '@/components/selfcheck/BodyMap2D';

export default function SelfCheckRightRail(props: {
  cardio: any;
  hypeIndex: any;
  stress: any;
  trendSummary: string[];

  areas: BodyAreaKey[];
  gender: 'male' | 'female';
  view: 'front' | 'back';

  busy: boolean;
  onAnalyze: () => void;
  onCopy: () => void;
}) {
  const { cardio, hypeIndex, stress, trendSummary, areas, gender, view, busy, onAnalyze, onCopy } = props;

  return (
    <aside className="space-y-4">
      <WellnessInsightsCard cardio={cardio} hypeIndex={hypeIndex} stress={stress} trendSummary={trendSummary} />

      <div className="bg-white/80 border border-slate-200 rounded-2xl shadow-sm p-4">
        <div className="text-sm font-semibold mb-2 text-slate-900">Quick actions</div>
        <div className="flex gap-2">
          <button
            onClick={onAnalyze}
            disabled={busy}
            className="flex-1 py-2 rounded-xl bg-cyan-600 text-white font-semibold disabled:opacity-50"
            type="button"
          >
            {busy ? 'Checking…' : 'Re-check'}
          </button>
          <button
            onClick={onCopy}
            className="flex-1 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold hover:bg-slate-50"
            type="button"
          >
            Copy summary
          </button>
        </div>

        <div className="mt-3 text-xs text-slate-500">
          Areas: {areas.length ? areas.map(labelBodyAreaKey).join(', ') : '—'} · Gender: {gender} · Emphasis: {view}
        </div>
      </div>
    </aside>
  );
}
