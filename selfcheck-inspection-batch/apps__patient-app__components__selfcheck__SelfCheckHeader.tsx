'use client';

import React from 'react';

export default function SelfCheckHeader(props: {
  title?: string;
  now: number;
  bmi: number | null;
}) {
  const { title = 'Self-Check', now, bmi } = props;

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{title}</h1>
        <div className="text-sm text-slate-500">Local time: {new Date(now).toLocaleTimeString()}</div>
      </div>
      <div className="text-sm text-slate-600">
        BMI: <span className="font-semibold text-slate-900">{typeof bmi === 'number' ? bmi.toFixed(1) : '—'}</span>
      </div>
    </div>
  );
}
