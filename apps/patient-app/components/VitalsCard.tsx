// components/VitalsCard.tsx
'use client';

import React from 'react';

type VitalsCardProps = {
  label?: string;
  value?: number | string | null;
  unit?: string;
  min?: number;
  max?: number;
  sparkline?: React.ReactNode;
};

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export default function VitalsCard({
  label = '',
  value = '—',
  unit = '',
  min,
  max,
  sparkline,
}: VitalsCardProps) {
  const numericValue = typeof value === 'number' ? value : undefined;

  const hasRange =
    typeof min === 'number' &&
    typeof max === 'number' &&
    max > min &&
    typeof numericValue === 'number';

  const percent = hasRange
    ? Math.min(100, Math.max(0, ((numericValue - min) / (max - min)) * 100))
    : 50;

  const ringTone =
    percent < 70
      ? 'border-emerald-400/60'
      : percent < 90
        ? 'border-amber-400/70'
        : 'border-rose-500/70';

  const glowTone =
    percent < 70
      ? 'shadow-emerald-200/40'
      : percent < 90
        ? 'shadow-amber-200/40'
        : 'shadow-rose-200/40';

  const lowerLabel = String(label).toLowerCase();

  const isHeartRate =
    lowerLabel.includes('heart') ||
    lowerLabel.includes('hr') ||
    lowerLabel.includes('bpm');

  const bpm =
    isHeartRate && typeof numericValue === 'number' && numericValue > 0
      ? numericValue
      : 60;

  const animationDuration = `${Math.max(0.5, 60 / bpm)}s`;

  return (
    <div className="flex w-32 flex-col items-center rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div
          className={cx(
            'absolute inset-0 rounded-full border-4',
            ringTone,
            'animate-ringPulse',
            'shadow-[0_0_18px_0_rgba(0,0,0,0.06)]',
            glowTone
          )}
          style={{ animationDuration, opacity: 0.9 }}
        />

        <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
          <span className="text-base font-bold text-slate-900">
            {value ?? '—'}
            {unit ? (
              <span className="ml-1 text-xs font-semibold text-slate-500">
                {unit}
              </span>
            ) : null}
          </span>
        </div>
      </div>

      <div className="mt-2 w-full text-center">
        <div className="text-xs font-semibold leading-tight text-slate-700">
          {label || '—'}
        </div>

        {sparkline ? (
          <div className="mt-1 flex items-center justify-center opacity-90">
            {sparkline}
          </div>
        ) : null}
      </div>
    </div>
  );
}