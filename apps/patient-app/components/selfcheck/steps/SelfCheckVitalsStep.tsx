'use client';

import React, { useMemo, useState } from 'react';

import VitalsCard from '@/components/VitalsCard';
import Sparkline from '@/components/selfcheck/Sparkline';
import InfoTooltip from '@/components/selfcheck/InfoTooltip';

import type { Vital } from '@/src/hooks/selfcheck/useSelfCheckState';

export default function SelfCheckVitalsStep(props: {
  vitals: Vital[];
  setVitals: (updater: (prev: Vital[]) => Vital[]) => void;
  busy: boolean;
  onNext: () => void;
}) {
  const { vitals, setVitals, busy, onNext } = props;
  const [editOpen, setEditOpen] = useState(false);

  const editable = useMemo(() => {
    const keys = new Set([
      'temperature',
      'heartRate',
      'spo2',
      'systolic',
      'diastolic',
      'glucose',
    ]);
    return vitals.filter((vital) => keys.has(vital.key));
  }, [vitals]);

  function patchVital(key: string, value: number | null) {
    setVitals((prev) =>
      prev.map((vital) => (vital.key === key ? { ...vital, value } : vital)),
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
      <div className="mb-3">
        <div className="text-xs text-slate-500">Step 1</div>
        <div className="text-lg font-semibold text-slate-900">Vitals</div>
        <div className="mt-1 text-sm text-slate-600">
          Review or enter the readings you want included in this self-check.
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {vitals.map((vital) => (
          <VitalsCard
            key={vital.key}
            label={vital.label}
            value={vital.value}
            unit={vital.unit}
            sparkline={<Sparkline points={Array.isArray(vital.trend) ? vital.trend : []} />}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={onNext}
          disabled={busy}
          className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:opacity-95 disabled:opacity-50"
          type="button"
        >
          Next: Symptoms →
        </button>

        <button
          type="button"
          onClick={() => setEditOpen((open) => !open)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50"
        >
          {editOpen ? 'Close vital entry' : 'Enter / edit vitals'}
        </button>

        <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
          <span>About self-check</span>
          <InfoTooltip label="Self-check info">
            <div className="font-semibold text-slate-900">Decision support, not diagnosis</div>
            <div className="mt-1 text-slate-600">
              Results are generated only after the next step is submitted to InsightCore.
              If symptoms are severe or urgent, seek immediate medical help.
            </div>
          </InfoTooltip>
        </div>
      </div>

      {editOpen && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Vital entry</div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {editable.map((vital) => (
              <label key={vital.key} className="block">
                <div className="mb-1 text-xs text-slate-600">
                  {vital.label}{vital.unit ? ` (${vital.unit})` : ''}
                </div>
                <input
                  type="number"
                  step="any"
                  value={
                    vital.value === null || vital.value === undefined || vital.value === ''
                      ? ''
                      : String(vital.value)
                  }
                  onChange={(event) =>
                    patchVital(
                      vital.key,
                      event.target.value === '' ? null : Number(event.target.value),
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900"
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
