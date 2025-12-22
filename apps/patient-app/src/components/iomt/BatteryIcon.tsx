// apps/patient-app/src/components/iomt/BatteryIcon.tsx
'use client';

import React from 'react';

export default function BatteryIcon({ level = 0 }: { level?: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(level)));
  const bars = Math.round((pct / 100) * 4);
  return (
    <div className="flex items-center gap-1 text-xs text-slate-700">
      <div
        className="relative w-6 h-3 rounded-sm border border-slate-400"
        role="img"
        aria-label={`Battery ${pct}%`}
        title={`${pct}%`}
      >
        <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-0.5 h-1.5 bg-slate-400 rounded-sm" />
        <div className="flex h-full">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 m-[1px] rounded-[1px]"
              style={{ background: i < bars ? '#16a34a' : 'transparent' }}
            />
          ))}
        </div>
      </div>
      <span className="tabular-nums">{pct}%</span>
    </div>
  );
}
