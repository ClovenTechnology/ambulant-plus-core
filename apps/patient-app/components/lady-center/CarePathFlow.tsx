// apps/patient-app/components/lady-center/CarePathFlow.tsx
'use client';

import React, { useMemo, useState } from 'react';

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function Pill({
  children,
  tone = 'slate',
}: {
  children: React.ReactNode;
  tone?: 'slate' | 'blue' | 'emerald' | 'amber' | 'rose' | 'violet';
}) {
  const toneCls =
    tone === 'blue'
      ? 'bg-blue-50 text-blue-700 ring-blue-200'
      : tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : tone === 'amber'
      ? 'bg-amber-50 text-amber-800 ring-amber-200'
      : tone === 'rose'
      ? 'bg-rose-50 text-rose-700 ring-rose-200'
      : tone === 'violet'
      ? 'bg-violet-50 text-violet-700 ring-violet-200'
      : 'bg-slate-50 text-slate-700 ring-slate-200';

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ring-1', toneCls)}>
      {children}
    </span>
  );
}

function neutralize(label: string, discreet: boolean) {
  if (!discreet) return label;
  if (/period|bleeding/i.test(label)) return 'Tracking window';
  if (/fertile|ovulation/i.test(label)) return 'Timing window';
  if (/pregnan/i.test(label)) return 'Health mode';
  if (/menopause/i.test(label)) return 'Health mode';
  return label;
}

function buildCarePathSteps(pathKey: string, discreet: boolean) {
  const neutral = (s: string) => (discreet ? neutralize(s, true) : s);

  const common = [
    {
      key: 'severity',
      title: 'How intense is it?',
      desc: 'Pick what matches your experience.',
      options: ['Mild', 'Moderate', 'Severe'],
    },
    {
      key: 'duration',
      title: 'How long has it been happening?',
      desc: 'This helps decide the next step.',
      options: ['A few days', 'A few weeks', 'Months+', 'Not sure'],
    },
    {
      key: 'next_step',
      title: 'What do you want right now?',
      desc: 'Choose a path that fits your goal.',
      options: ['Self-care guidance', 'Book a consult', 'Order tests', 'Track for a while'],
    },
  ];

  switch (pathKey) {
    case 'period_pain':
      return [
        {
          key: 'when',
          title: neutral('When does it happen?'),
          desc: 'Timing matters for patterns.',
          options: [neutral('Before period'), neutral('During period'), 'Anytime', 'Not sure'],
        },
        ...common,
      ];
    case 'irregular':
      return [
        {
          key: 'pattern',
          title: 'What feels irregular?',
          desc: 'Choose the closest match.',
          options: ['Timing changes often', 'Very long gaps', 'Spotting', 'Unpredictable', 'Not sure'],
        },
        ...common,
      ];
    case 'fertility':
      return [
        {
          key: 'goal',
          title: 'What is your goal?',
          desc: 'This shapes the suggestions.',
          options: ['Trying to conceive', 'Planning soon', 'Just tracking', 'Not sure'],
        },
        ...common,
      ];
    case 'pregnancy':
      return [
        {
          key: 'focus',
          title: 'What do you want support with?',
          desc: 'Choose one focus area.',
          options: ['Nausea', 'Energy & sleep', 'Pain/discomfort', 'General check-in'],
        },
        ...common,
      ];
    case 'menopause':
      return [
        {
          key: 'symptom',
          title: 'Main symptom',
          desc: 'Choose one to start.',
          options: ['Hot flashes', 'Sleep changes', 'Mood changes', 'Joint aches', 'Not sure'],
        },
        ...common,
      ];
    case 'sexual_health':
      return [
        {
          key: 'privacy',
          title: 'How discreet do you want this?',
          desc: 'You can keep labels neutral on the home screen.',
          options: ['Very discreet', 'Standard', 'Not sure'],
        },
        ...common,
      ];
    default:
      return common;
  }
}

function carePathSummary(pathKey: string, answers: Record<string, string>, discreet: boolean) {
  const label = (k: string) => {
    const base =
      k === 'severity'
        ? 'Severity'
        : k === 'duration'
        ? 'Duration'
        : k === 'next_step'
        ? 'Preferred next step'
        : k[0]?.toUpperCase() + k.slice(1);
    return discreet ? neutralize(base, true) : base;
  };

  const parts = Object.entries(answers).map(([k, v]) => `${label(k)}: ${v}`);
  const head = `Care path: ${pathKey.replace(/_/g, ' ')}`;
  return `${head}\n${parts.join(' • ')}`;
}

export default function CarePathFlow(props: {
  pathKey: string;
  discreet: boolean;
  onDone: (summary: string) => void;
}) {
  const { pathKey, discreet, onDone } = props;

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const steps = useMemo(() => buildCarePathSteps(pathKey, discreet), [pathKey, discreet]);
  const current = steps[step];

  function setA(k: string, v: string) {
    setAnswers((a) => ({ ...a, [k]: v }));
  }

  const progress = Math.round(((step + 1) / steps.length) * 100);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">Guided flow</div>
          <Pill tone="slate">{progress}%</Pill>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full bg-slate-900" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-semibold text-slate-900">{current.title}</div>
        <div className="mt-1 text-sm text-slate-600">{current.desc}</div>

        <div className="mt-4 space-y-2">
          {current.options.map((opt) => (
            <button
              key={opt}
              className={cn(
                'w-full rounded-2xl border px-3 py-3 text-left text-sm',
                answers[current.key] === opt
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
              )}
              onClick={() => setA(current.key, opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          Back
        </button>

        {step < steps.length - 1 ? (
          <button
            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            disabled={!answers[current.key]}
            onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
          >
            Continue
          </button>
        ) : (
          <button
            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            disabled={!answers[current.key]}
            onClick={() => {
              const summary = carePathSummary(pathKey, answers, discreet);
              onDone(summary);
            }}
          >
            Finish
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        This guide helps you choose next steps. It’s not a diagnosis.
      </div>
    </div>
  );
}
