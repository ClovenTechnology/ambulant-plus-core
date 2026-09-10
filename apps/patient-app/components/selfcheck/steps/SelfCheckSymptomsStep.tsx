'use client';

import React from 'react';

import BodyMap2D, {
  type BodyAreaKey,
} from '@/components/selfcheck/BodyMap2D';

type SymptomsUpdater = (prev: Record<string, boolean>) => Record<string, boolean>;

const symptomList = [
  { key: 'fever', label: 'Fever' },
  { key: 'cough', label: 'Cough' },
  { key: 'sob', label: 'Shortness of breath' },
  { key: 'dizzy', label: 'Dizziness' },
  { key: 'fatigue', label: 'Fatigue' },
] as const;

export default function SelfCheckSymptomsStep(props: {
  gender: 'male' | 'female';
  view: 'front' | 'back';
  areas: string[];
  onChangeGender: (gender: 'male' | 'female') => void;
  onChangeView: (view: 'front' | 'back') => void;
  onToggleArea: (key: string) => void;
  symptoms: Record<string, boolean>;
  setSymptoms: (updater: SymptomsUpdater) => void;
  busy: boolean;
  onBack: () => void;
  onAnalyze: () => void;
}) {
  const {
    gender,
    view,
    areas,
    onChangeGender,
    onChangeView,
    onToggleArea,
    symptoms,
    setSymptoms,
    busy,
    onBack,
    onAnalyze,
  } = props;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
        <div className="text-xs text-slate-500">Step 2</div>
        <div className="text-lg font-semibold text-slate-900">Symptoms and body areas</div>
        <div className="mt-1 text-sm text-slate-600">
          Select what you are experiencing. Body-area selections are context for the
          assessment; the page does not locally infer a diagnosis from them.
        </div>
      </div>

      <BodyMap2D
        gender={gender}
        view={view}
        selected={areas as BodyAreaKey[]}
        onChangeGender={onChangeGender}
        onChangeView={onChangeView}
        onToggleKey={(key) => onToggleArea(key)}
      />

      <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {symptomList.map((symptom) => (
            <button
              key={symptom.key}
              onClick={() =>
                setSymptoms((prev) => ({
                  ...prev,
                  [symptom.key]: !prev[symptom.key],
                }))
              }
              className={[
                'rounded-xl border px-3 py-2 text-sm font-semibold transition',
                symptoms[symptom.key]
                  ? 'border-amber-200 bg-amber-100 text-amber-900'
                  : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50',
              ].join(' ')}
              type="button"
            >
              {symptom.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={onBack}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50"
            type="button"
          >
            ← Back to vitals
          </button>

          <button
            onClick={onAnalyze}
            disabled={busy}
            className="rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white hover:opacity-95 disabled:opacity-50"
            type="button"
          >
            {busy ? 'Analyzing…' : 'Analyze → Results'}
          </button>
        </div>
      </div>
    </div>
  );
}
