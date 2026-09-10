'use client';

import React from 'react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export type SelfCheckStep = 'data' | 'symptoms' | 'results';

const STEPS: Array<{ key: SelfCheckStep; title: string; sub: string }> = [
  { key: 'data', title: 'Vitals', sub: 'Step 1' },
  { key: 'symptoms', title: 'Symptoms', sub: 'Step 2' },
  { key: 'results', title: 'Results', sub: 'Step 3' },
];

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

export default function SelfCheckStepper(props: {
  step: SelfCheckStep;
  onStep: (step: SelfCheckStep) => void;
  completed?: Partial<Record<SelfCheckStep, boolean>>;
  canGoSymptoms?: boolean;
  canGoResults?: boolean;
  symptomsLockedHint?: string;
  resultsLockedHint?: string;
}) {
  const {
    step,
    onStep,
    completed,
    canGoSymptoms = true,
    canGoResults = false,
    symptomsLockedHint = 'Complete Step 1 first.',
    resultsLockedHint = 'Complete Step 2 first.',
  } = props;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm">
      <div className="flex min-w-max items-center gap-2">
        {STEPS.map((item, index) => {
          const active = item.key === step;
          const done = Boolean(completed?.[item.key]);
          const locked =
            (item.key === 'symptoms' && !canGoSymptoms) ||
            (item.key === 'results' && !canGoResults);
          const hint =
            item.key === 'symptoms'
              ? symptomsLockedHint
              : item.key === 'results'
                ? resultsLockedHint
                : undefined;

          return (
            <React.Fragment key={item.key}>
              <button
                type="button"
                disabled={locked}
                onClick={() => onStep(item.key)}
                title={locked ? hint : undefined}
                className={cx(
                  'flex items-center gap-3 rounded-xl border px-3 py-2 transition whitespace-nowrap',
                  active
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : locked
                      ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                )}
              >
                <span
                  className={cx(
                    'grid h-8 w-8 place-items-center rounded-lg border',
                    active
                      ? 'border-white/20 bg-white/10'
                      : 'border-slate-200 bg-slate-50',
                  )}
                >
                  {locked ? (
                    <IconLock className="h-4 w-4" />
                  ) : done ? (
                    <IconCheck className={cx('h-5 w-5', active ? 'text-white' : 'text-emerald-600')} />
                  ) : (
                    <span className="text-sm font-extrabold">{index + 1}</span>
                  )}
                </span>

                <span className="text-left leading-tight">
                  <span className={cx('block text-[11px] uppercase tracking-wider', active ? 'text-white/80' : 'text-slate-400')}>
                    {item.sub}
                  </span>
                  <span className={cx('block text-sm font-semibold', active ? 'text-white' : 'text-slate-900')}>
                    {item.title}
                  </span>
                </span>
              </button>

              {index < STEPS.length - 1 ? (
                <div className="h-px w-6 shrink-0 bg-slate-200" />
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
