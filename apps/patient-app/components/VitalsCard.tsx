// components/VitalsCard.tsx
'use client';

import React from 'react';
import clsx from 'clsx';

type VitalsCardProps = {
  label?: string;
  value?: number | string | null;
  unit?: string;
  min?: number;
  max?: number;
  sparkline?: React.ReactNode;
};

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
    ? Math.min(100, Math.max(0, ((numericValue - min!) / (max! - min!)) * 100))
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
    <div className="flex flex-col items-center p-3 bg-white border border-slate-200 rounded-2xl w-32 shadow-sm">
      <div className="relative w-16 h-16 flex items-center justify-center">
        <div
          className={clsx(
            'absolute inset-0 rounded-full border-4',
            ringTone,
            'animate-ringPulse',
            'shadow-[0_0_18px_0_rgba(0,0,0,0.06)]',
            glowTone
          )}
          style={{ animationDuration, opacity: 0.9 }}
        />
        <div className="relative w-12 h-12 flex items-center justify-center rounded-full bg-slate-50 border border-slate-200">
          <span className="text-slate-900 font-bold text-base">
            {value ?? '—'}
            <span className="text-slate-500 font-semibold text-xs ml-1">
              {unit}
            </span>
          </span>
        </div>
      </div>

      <div className="mt-2 w-full text-center">
        <div className="text-xs font-semibold text-slate-700 leading-tight">
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
