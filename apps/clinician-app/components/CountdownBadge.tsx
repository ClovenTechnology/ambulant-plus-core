'use client';

import { useEffect, useMemo, useState } from 'react';

type CountdownBadgeProps = {
  label: string;
  totalMs: number;
  untilMs: number;
  pulseWhenLtSec?: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatDuration(ms: number) {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }

  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

export default function CountdownBadge({
  label,
  totalMs,
  untilMs,
  pulseWhenLtSec,
}: CountdownBadgeProps) {
  const [now, setNow] = useState(() => Date.now());
  const initialUntilMs = Math.max(0, Number(untilMs) || 0);
  const targetAt = useMemo(() => Date.now() + initialUntilMs, [initialUntilMs]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, targetAt - now);
  const safeTotalMs = Math.max(1, Number(totalMs) || 1);
  const pct = clamp((remainingMs / safeTotalMs) * 100, 0, 100);
  const urgent =
    typeof pulseWhenLtSec === 'number' &&
    pulseWhenLtSec > 0 &&
    remainingMs <= pulseWhenLtSec * 1000 &&
    remainingMs > 0;

  return (
    <div
      className={[
        'rounded-xl border p-3',
        urgent
          ? 'border-amber-300 bg-amber-50 animate-pulse'
          : 'border-neutral-200 bg-neutral-50',
      ].join(' ')}
      role="timer"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-neutral-600">{label}</div>
        <div className={urgent ? 'font-mono text-sm font-semibold text-amber-800' : 'font-mono text-sm font-semibold text-neutral-900'}>
          {formatDuration(remainingMs)}
        </div>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200">
        <div
          className={urgent ? 'h-full rounded-full bg-amber-500' : 'h-full rounded-full bg-emerald-600'}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
