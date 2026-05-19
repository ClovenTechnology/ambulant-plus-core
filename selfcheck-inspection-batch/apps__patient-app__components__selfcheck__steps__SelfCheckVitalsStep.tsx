'use client';

import React, { useMemo, useState } from 'react';

import VitalsCard from '@/components/VitalsCard';
import Sparkline from '@/components/selfcheck/Sparkline';
import InfoTooltip from '@/components/selfcheck/InfoTooltip';

import type { Vital } from '@/src/hooks/selfcheck/useSelfCheckState';

export default function SelfCheckVitalsStep(props: {
  vitals: Vital[];
  setVitals: (updater: (prev: Vital[]) => Vital[]) => void;
  abnormal: string[];
  riskColor: string;
  riskLabel: string;
  busy: boolean;
  onNext: () => void;
  onAnalyze: () => void;
}) {
  const { vitals, setVitals, abnormal, riskColor, riskLabel, busy, onNext, onAnalyze } = props;

  const [editOpen, setEditOpen] = useState(false);

  const editable = useMemo(() => {
    // Only show “quick edit” for demo-friendly vitals
    const keys = new Set(['hr', 'spo2', 'temp', 'bp']);
    return vitals.filter((v) => keys.has(v.key));
  }, [vitals]);

  function patchVital(key: string, value: any) {
    setVitals((prev) => prev.map((v) => (v.key === key ? { ...v, value } : v)));
  }

  return (
    <div className="bg-white/80 border border-slate-200 rounded-2xl shadow-sm p-4">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="text-xs text-slate-500">Step 1</div>
          <div className="text-lg font-semibold text-slate-900">Vitals</div>
          <div className="text-sm text-slate-600">
            {abnormal.length === 0 ? 'Within typical ranges.' : `Flagged: ${abnormal.join(', ')}`}
          </div>
        </div>

        <div className={`px-3 py-2 rounded-xl ${riskColor} shadow-sm`}>
          <div className="text-xs opacity-90">Status</div>
          <div className="font-bold">{riskLabel}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {vitals.map((v) => (
          <VitalsCard
            key={v.key}
            label={v.label}
            value={v.value}
            unit={v.unit}
            min={v.min}
            max={v.max}
            sparkline={<Sparkline points={Array.isArray(v.trend) ? v.trend : []} />}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 items-center">
        <button
          onClick={onNext}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold hover:opacity-95"
          type="button"
        >
          Next: Symptoms →
        </button>

        <button
          onClick={onAnalyze}
          disabled={busy}
          className="px-4 py-2 rounded-xl bg-cyan-600 text-white font-semibold hover:opacity-95 disabled:opacity-50"
          type="button"
        >
          {busy ? 'Checking…' : 'Check My Health'}
        </button>

        <button
          type="button"
          onClick={() => setEditOpen((s) => !s)}
          className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold hover:bg-slate-50"
        >
          {editOpen ? 'Close quick edit' : 'Quick edit vitals'}
        </button>

        <div className="ml-auto text-xs text-slate-500 flex items-center gap-2">
          <span>Why this matters</span>
          <InfoTooltip label="Self-check info">
            <div className="font-semibold text-slate-900">Non-diagnostic self-check</div>
            <div className="mt-1 text-slate-600">
              This summarizes trends and flags patterns. If symptoms feel severe or urgent, seek immediate medical help.
            </div>
          </InfoTooltip>
        </div>
      </div>

      {editOpen && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Quick edit (demo)</div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {editable.map((v) => (
              <label key={v.key} className="block">
                <div className="text-xs text-slate-600 mb-1">{v.label}</div>

                {v.key === 'bp' ? (
                  <input
                    value={String(v.value ?? '')}
                    onChange={(e) => patchVital(v.key, e.target.value)}
                    placeholder="120/80"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900"
                  />
                ) : (
                  <input
                    type="number"
                    value={Number.isFinite(Number(v.value)) ? Number(v.value) : ''}
                    onChange={(e) => patchVital(v.key, e.target.value === '' ? null : Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900"
                  />
                )}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
