// apps/patient-app/components/CountdownBadge.tsx
'use client';

import { useEffect, useState } from 'react';

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(s / 3600).toString().padStart(2, '0');
  const mm = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  const ss = Math.floor(s % 60).toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export default function CountdownBadge({
  label,
  totalMs,
  untilMs,
  pulseWhenLtSec = 10,
}: {
  label: string;
  totalMs: number;
  untilMs: number;
  pulseWhenLtSec?: number;
}) {
  const [remaining, setRemaining] = useState(untilMs);

  useEffect(() => {
    setRemaining(untilMs);
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1000)), 1000);
    return () => clearInterval(id);
  }, [untilMs]);

  const used = Math.max(0, Math.min(1, (totalMs - remaining) / Math.max(1, totalMs)));
  const pctUsed = Math.round(used * 100);
  const pctRemain = 100 - pctUsed;

  const danger = remaining / 1000 <= pulseWhenLtSec;
  const pulse = danger ? 'animate-pulse' : '';

  return (
    <div className={`w-full rounded-xl border border-neutral-200 p-3 bg-white ${pulse}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-600">{label}</span>
        <span className="font-mono text-sm tabular-nums">{fmt(remaining)}</span>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-neutral-200 overflow-hidden">
        {/* Colour bands track: green ▶︎ yellow ▶︎ red */}
        <div
          className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
          style={{ width: `${pctUsed}%` }}
        />
      </div>
      <div className="mt-1 text-right text-[10px] text-neutral-500">{pctRemain}% left</div>
    </div>
  );
}
