'use client';

import React from 'react';
import clsx from 'clsx';

export type SelfCheckStep = 'data' | 'symptoms' | 'results';

function IconCheck(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={props.className} fill="none" aria-hidden="true">
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLock(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={props.className} fill="none" aria-hidden="true">
      <path
        d="M7 11V8a5 5 0 0110 0v3"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M6.5 11h11A1.5 1.5 0 0119 12.5v7A2.5 2.5 0 0116.5 22h-9A2.5 2.5 0 015 19.5v-7A1.5 1.5 0 016.5 11z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type StepMeta = {
  key: SelfCheckStep;
  title: string;
  sub: string;
};

const STEPS: StepMeta[] = [
  { key: 'data', title: 'Vitals', sub: 'Step 1' },
  { key: 'symptoms', title: 'Symptoms', sub: 'Step 2' },
  { key: 'results', title: 'Results', sub: 'Step 3' },
];

export default function SelfCheckStepper(props: {
  step: SelfCheckStep;
  onStep: (s: SelfCheckStep) => void;

  // NEW: completion + gating
  completed?: Partial<Record<SelfCheckStep, boolean>>;
  canGoResults?: boolean;
  lockedHint?: string;
}) {
  const { step, onStep, completed, canGoResults = true, lockedHint = 'Run analysis to unlock results.' } = props;

  return (
    <div className="bg-white/80 border border-slate-200 rounded-2xl shadow-sm p-3">
      <div className="flex items-center gap-2 overflow-x-auto">
        {STEPS.map((s, idx) => {
          const isActive = s.key === step;
          const isCompleted = !!completed?.[s.key];

          const locked = s.key === 'results' && !canGoResults;

          return (
            <React.Fragment key={s.key}>
              <button
                type="button"
                onClick={() => {
                  if (locked) return;
                  onStep(s.key);
                }}
                title={locked ? lockedHint : undefined}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-xl border transition whitespace-nowrap',
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900'
                    : locked
                    ? 'bg-white text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                )}
              >
                <div
                  className={clsx(
                    'w-8 h-8 rounded-lg grid place-items-center border',
                    isActive
                      ? 'border-white/20 bg-white/10'
                      : locked
                      ? 'border-slate-200 bg-slate-50'
                      : 'border-slate-200 bg-slate-50'
                  )}
                >
                  {locked ? (
                    <IconLock className={clsx('w-4 h-4', isActive ? 'text-white' : 'text-slate-400')} />
                  ) : isCompleted ? (
                    <IconCheck className={clsx('w-5 h-5', isActive ? 'text-white' : 'text-emerald-600')} />
                  ) : (
                    <span className={clsx('text-sm font-extrabold', isActive ? 'text-white' : 'text-slate-700')}>
                      {idx + 1}
                    </span>
                  )}
                </div>

                <div className="text-left leading-tight">
                  <div className={clsx('text-[11px] uppercase tracking-wider', isActive ? 'text-white/80' : 'text-slate-400')}>
                    {s.sub}
                  </div>
                  <div className={clsx('text-sm font-semibold', isActive ? 'text-white' : locked ? 'text-slate-400' : 'text-slate-900')}>
                    {s.title}
                  </div>
                </div>
              </button>

              {idx < STEPS.length - 1 && (
                <div className="h-px w-6 bg-slate-200 shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {!canGoResults && (
        <div className="mt-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">Results locked:</span> {lockedHint}
        </div>
      )}
    </div>
  );
}
