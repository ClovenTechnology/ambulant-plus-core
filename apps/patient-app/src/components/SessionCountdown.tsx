'use client';

import React, { useEffect, useMemo, useState } from 'react';

type ISO = string; // ISO 8601

export type SessionCountdownProps = {
  /** Minimal appointment shape: start/end in ISO strings */
  appointment: {
    id?: string;
    start: ISO;
    end?: ISO; // optional: shows elapsed-only if missing
    patient?: { name?: string };
  };
  /** Show a subtle skeleton while upstream loads */
  loading?: boolean;
  /** Show the “Ends at” timestamp text */
  showEndTime?: boolean;
  /** Compact sizing */
  size?: 'sm' | 'md';
  /** Called once when we pass end time */
  onComplete?: () => void;
};

function fmtHMS(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`;
}

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}

export default function SessionCountdown({
  appointment,
  loading = false,
  showEndTime = true,
  size = 'md',
  onComplete,
}: SessionCountdownProps) {
  const startMs = useMemo(() => Date.parse(appointment.start), [appointment.start]);
  const endMs = useMemo(() => (appointment.end ? Date.parse(appointment.end) : undefined), [appointment.end]);

  const [now, setNow] = useState<number>(Date.now());

  // Tick every 1s
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Fire onComplete once (when we cross end)
  const [doneFired, setDoneFired] = useState(false);
  useEffect(() => {
    if (!endMs || !onComplete || doneFired) return;
    if (now >= endMs) {
      setDoneFired(true);
      try { onComplete(); } catch {}
    }
  }, [now, endMs, onComplete, doneFired]);

  const beforeStart = now < startMs;
  const elapsedMs = Math.max(0, now - startMs);
  const totalMs = endMs ? Math.max(0, endMs - startMs) : undefined;
  const remainingMs = endMs ? Math.max(0, endMs - now) : undefined;
  const pct = totalMs ? clamp((elapsedMs / totalMs) * 100, 0, 100) : undefined;

  const compact = size === 'sm';

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
        <div className="h-2 bg-gray-200 rounded w-full" />
      </div>
    );
  }

  return (
    <div
      className="w-full"
      role="timer"
      aria-live="polite"
      aria-atomic="true"
      aria-label="Session countdown"
    >
      {/* Line 1: status + main time */}
      <div className={`flex items-baseline justify-between ${compact ? 'text-sm' : 'text-base'}`}>
        <div className="text-gray-600">
          {beforeStart
            ? 'Starts in'
            : endMs
              ? now < endMs
                ? 'Time remaining'
                : 'Session ended'
              : 'Time elapsed'}
        </div>

        <div className={`font-semibold tabular-nums ${compact ? 'text-base' : 'text-lg'}`}>
          {beforeStart && endMs
            ? fmtHMS(Math.max(0, startMs - now))
            : endMs
              ? now < endMs
                ? fmtHMS(remainingMs!)
                : '00:00'
              : fmtHMS(elapsedMs)}
        </div>
      </div>

      {/* Progress bar (only when we know end) */}
      {typeof pct === 'number' && (
        <div className="mt-2 h-2 rounded bg-gray-200 overflow-hidden" aria-hidden="true">
          <div
            className="h-full bg-emerald-600 transition-[width] duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Line 2: meta (elapsed + ends at) */}
      <div className={`mt-2 grid ${compact ? 'text-[11px]' : 'text-xs'} text-gray-600`}>
        <div>
          <span className="text-gray-500">Elapsed: </span>
          <span className="font-medium tabular-nums">{fmtHMS(elapsedMs)}</span>
        </div>
        {endMs && showEndTime && (
          <div>
            <span className="text-gray-500">Ends: </span>
            <time
              className="font-medium"
              dateTime={new Date(endMs).toISOString()}
              suppressHydrationWarning
              title={new Date(endMs).toLocaleString()}
            >
              {new Date(endMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </time>
          </div>
        )}
      </div>
    </div>
  );
}
