'use client';

import { useEffect, useMemo, useState } from 'react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}


type Props = {
  scheduledStartAt?: string | null;
  actualStartAt?: string | null;
  durationMin?: number | null;
  className?: string;
};

function ms(n: number) {
  return Math.max(0, n);
}

function fmtDuration(msValue: number) {
  const s = Math.floor(ms(msValue) / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (hh > 0) return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export default function SessionProgress({
  scheduledStartAt,
  actualStartAt,
  durationMin,
  className,
}: Props) {
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const data = useMemo(() => {
    const scheduled = scheduledStartAt ? Date.parse(scheduledStartAt) : NaN;
    const actual = actualStartAt ? Date.parse(actualStartAt) : NaN;
    const startAt = Number.isFinite(actual) ? actual : Number.isFinite(scheduled) ? scheduled : NaN;

    if (!Number.isFinite(startAt) || !durationMin || durationMin <= 0) {
      return {
        ready: false,
        elapsedMs: 0,
        remainingMs: 0,
        pct: 0,
        state: 'idle' as 'idle' | 'active' | 'warning' | 'overtime',
        label: 'Session timing unavailable',
      };
    }

    const durationMs = durationMin * 60_000;
    const elapsedMs = Math.max(0, now - startAt);
    const remainingMs = Math.max(0, durationMs - elapsedMs);
    const rawPct = Math.min(100, Math.max(0, (elapsedMs / durationMs) * 100));

    let state: 'active' | 'warning' | 'overtime' = 'active';
    if (elapsedMs > durationMs) state = 'overtime';
    else if (rawPct >= 85) state = 'warning';

    return {
      ready: true,
      elapsedMs,
      remainingMs,
      pct: rawPct,
      state,
      label:
        state === 'overtime'
          ? `Running over by ${fmtDuration(elapsedMs - durationMs)}`
          : `${fmtDuration(remainingMs)} remaining`,
    };
  }, [actualStartAt, durationMin, now, scheduledStartAt]);

  const tone =
    data.state === 'overtime'
      ? 'bg-rose-500'
      : data.state === 'warning'
      ? 'bg-amber-500'
      : 'bg-emerald-500';

  return (
    <div className={cx('rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm', className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Session progress
          </div>
          <div className="mt-1 text-sm font-medium text-slate-900">
            {data.label}
          </div>
        </div>

        {data.ready ? (
          <div className="text-right">
            <div className="text-xs text-slate-500">Elapsed</div>
            <div className="text-sm font-semibold text-slate-900">{fmtDuration(data.elapsedMs)}</div>
          </div>
        ) : null}
      </div>

      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cx('h-full rounded-full transition-all duration-500', tone)}
          style={{ width: `${data.ready ? data.pct : 0}%` }}
        />
      </div>

      {data.ready && durationMin ? (
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
          <span>Booked duration: {durationMin} min</span>
          <span>{Math.round(data.pct)}%</span>
        </div>
      ) : null}
    </div>
  );
}