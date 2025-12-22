'use client';

import React, { useMemo } from 'react';

import BodyMap2D, { BODY_AREA_LABEL, type BodyAreaKey, type BodyHint } from '@/components/selfcheck/BodyMap2D';

type SymptomsUpdater = (prev: Record<string, boolean>) => Record<string, boolean>;

function toneChip(tone: BodyHint['tone']) {
  const cls =
    tone === 'danger'
      ? 'bg-rose-600 text-white'
      : tone === 'warn'
      ? 'bg-amber-300 text-slate-900'
      : 'bg-slate-900 text-white';
  const label = tone === 'danger' ? 'Urgent' : tone === 'warn' ? 'Watch' : 'Info';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-extrabold ${cls}`}>{label}</span>;
}

function labelForKey(k: string) {
  const parts = String(k).split(':');
  const side = parts[0] === 'back' ? 'BACK' : 'FRONT';
  const area = parts.slice(1).join(':');
  const nice = (BODY_AREA_LABEL as any)[area] ?? String(area).replaceAll('_', ' ').toUpperCase();
  return `${nice} (${side})`;
}

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
  areas: string[]; // expects front/back keys like "front:shoulders"
  onChangeGender: (g: 'male' | 'female') => void;
  onChangeView: (v: 'front' | 'back') => void;
  onToggleArea: (k: string) => void;

  symptoms: Record<string, boolean>;
  setSymptoms: (updater: SymptomsUpdater) => void;

  busy: boolean;
  onBack: () => void;
  onAnalyze: () => void;

  // ✅ new: smart hints
  getHintForKey?: (k: string) => BodyHint | null;
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
    getHintForKey,
  } = props;

  const hintCards = useMemo(() => {
    if (!getHintForKey) return [];
    const severity = (t: BodyHint['tone']) => (t === 'danger' ? 3 : t === 'warn' ? 2 : 1);

    const items = areas
      .map((k) => {
        const hint = getHintForKey(k);
        if (!hint) return null;
        return { key: k, hint };
      })
      .filter(Boolean) as Array<{ key: string; hint: BodyHint }>;

    items.sort((a, b) => severity(b.hint.tone) - severity(a.hint.tone));

    // keep it premium: show top 4 (most important)
    return items.slice(0, 4);
  }, [areas, getHintForKey]);

  const hasHints = hintCards.length > 0;

  return (
    <div className="space-y-4">
      <BodyMap2D
        gender={gender}
        view={view}
        selected={areas as BodyAreaKey[]}
        onChangeGender={onChangeGender}
        onChangeView={onChangeView}
        onToggleKey={onToggleArea as any}
        getHintForKey={getHintForKey}
      />

      {/* ✅ Smart hint-strip (the “next 2”) */}
      <div className="bg-white/80 border border-slate-200 rounded-2xl shadow-sm p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-slate-500">Smart hints</div>
            <div className="text-sm font-semibold text-slate-900">What your selections might indicate</div>
            <div className="text-xs text-slate-600 mt-1">
              This is guidance only — not a diagnosis. Hints update as you add/remove areas.
            </div>
          </div>

          {areas.length > 0 && (
            <button
              type="button"
              onClick={() => areas.forEach((k) => onToggleArea(k))}
              className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 text-sm"
              title="Clear selected areas"
            >
              Clear areas
            </button>
          )}
        </div>

        {!hasHints ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-sm text-slate-700">
              Select one or more areas above to see tailored hints.
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Pro tip: hover markers to preview; click to select.
            </div>
          </div>
        ) : (
          <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
            {hintCards.map((it) => (
              <div
                key={it.key}
                className="min-w-[260px] max-w-[320px] rounded-2xl border border-slate-200 bg-white shadow-sm p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-extrabold text-slate-900">{labelForKey(it.key)}</div>
                  {toneChip(it.hint.tone)}
                </div>

                <div className="mt-2 text-sm font-semibold text-slate-900">{it.hint.title}</div>
                <div className="mt-1 text-xs text-slate-700 leading-snug">
                  {it.hint.body}
                </div>

                {it.hint.basedOn ? (
                  <div className="mt-2 text-[11px] text-slate-500">{it.hint.basedOn}</div>
                ) : null}

                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => onToggleArea(it.key)}
                    className="text-xs font-bold text-slate-700 hover:text-slate-900 underline underline-offset-2"
                  >
                    Remove this area
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Symptoms selector */}
      <div className="bg-white/80 border border-slate-200 rounded-2xl shadow-sm p-4">
        <div className="text-xs text-slate-500">Step 2</div>
        <div className="text-lg font-semibold mb-3">Symptoms</div>

        <div className="grid grid-cols-2 gap-3">
          {symptomList.map((s) => (
            <button
              key={s.key}
              onClick={() => setSymptoms((prev) => ({ ...prev, [s.key]: !prev[s.key] }))}
              className={[
                'py-2 px-3 rounded-xl text-sm font-semibold border transition',
                symptoms[s.key]
                  ? 'bg-amber-100 border-amber-200 text-amber-900'
                  : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50',
              ].join(' ')}
              type="button"
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold hover:bg-slate-50"
            type="button"
          >
            ← Back
          </button>

          <button
            onClick={onAnalyze}
            disabled={busy}
            className="px-4 py-2 rounded-xl bg-cyan-600 text-white font-semibold hover:opacity-95 disabled:opacity-50"
            type="button"
          >
            {busy ? 'Checking…' : 'Analyze → Results'}
          </button>
        </div>
      </div>
    </div>
  );
}
