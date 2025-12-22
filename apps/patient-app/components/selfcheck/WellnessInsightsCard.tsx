'use client';

import React from 'react';

export default function WellnessInsightsCard({
  cardio,
  hypeIndex,
  stress,
  trendSummary,
}: {
  cardio: { risk: 'low' | 'moderate' | 'high'; notes: string } | null;
  hypeIndex: number | null;
  stress: { index: number; label: string } | null;
  trendSummary: string[];
}) {
  const ts = Array.isArray(trendSummary) ? trendSummary : [];
  const notes = cardio?.notes ?? 'No data';
  const risk = cardio?.risk ?? 'low';

  const riskPill =
    risk === 'low'
      ? 'bg-emerald-100 text-emerald-800'
      : risk === 'moderate'
      ? 'bg-amber-100 text-amber-900'
      : 'bg-rose-100 text-rose-900';

  return (
    <div className="bg-white/80 p-4 rounded-2xl border border-slate-200 shadow-sm">
      <div className="text-xs text-slate-500 mb-2">Insights</div>

      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-slate-800 font-semibold">Cardiovascular</div>
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${riskPill}`}>{risk}</span>
      </div>

      <div className="text-xs text-slate-600 mb-3">{notes}</div>

      <div className="text-sm text-slate-800 font-semibold mb-1">Hypertension Index</div>
      <div className="text-xs text-slate-600 mb-3">
        <span className="font-semibold text-slate-900">{hypeIndex ?? '—'}</span>/100
      </div>

      {stress && (
        <>
          <div className="text-sm text-slate-800 font-semibold mb-1">Stress</div>
          <div className="text-xs text-slate-600 mb-3">
            {stress.label} · index <span className="font-semibold text-slate-900">{stress.index}</span>
          </div>
        </>
      )}

      <div className="text-sm text-slate-800 font-semibold mb-1">Trend summary</div>
      {ts.length === 0 ? (
        <div className="text-xs text-slate-500">Run analysis to see trend notes.</div>
      ) : (
        <ul className="list-disc ml-4 text-xs text-slate-600">
          {ts.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
