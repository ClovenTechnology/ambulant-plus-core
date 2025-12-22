'use client';

import { useEffect, useMemo, useState } from 'react';

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function pad(n: number) {
  return n.toString().padStart(2, '0');
}

export default function Countdown({
  startsAt,
  endsAt,
  skewMs = 0,
}: {
  startsAt: string;
  endsAt: string;
  skewMs?: number;
}) {
  const s = useMemo(() => new Date(startsAt).getTime(), [startsAt]);
  const e = useMemo(() => new Date(endsAt).getTime(), [endsAt]);
  const total = Math.max(1, e - s);

  const [now, setNow] = useState<number>(Date.now() + skewMs);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now() + skewMs), 250);
    return () => window.clearInterval(id);
  }, [skewMs]);

  const pctRaw = ((now - s) / total) * 100;
  const pct = clamp(pctRaw, -100, 300); // allow negative/overrun ranges for labels
  const before = now < s;
  const inside = now >= s && now <= e;

  // colour band
  let band = 'bg-emerald-500';
  if (pct >= 50 && pct < 80) band = 'bg-amber-500';
  else if (pct >= 80 && pct <= 100) band = 'bg-rose-500';
  else if (pct > 100) band = 'bg-slate-600';

  const remainingMs = inside ? e - now : before ? s - now : now - e;
  const hh = Math.floor(remainingMs / 3600000);
  const mm = Math.floor((remainingMs % 3600000) / 60000);
  const ss = Math.floor((remainingMs % 60000) / 1000);

  const label = before
    ? `Starts in ${hh ? hh + ':' : ''}${pad(mm)}:${pad(ss)}`
    : inside
      ? `${pad(mm + hh * 60)}:${pad(ss)} remaining`
      : `Overtime +${hh ? hh + ':' : ''}${pad(mm)}:${pad(ss)}`;

  return (
    <div>
      <div className="h-3 w-full rounded bg-gray-200 overflow-hidden">
        <div
          className={`h-full ${band} transition-[width,background-color] duration-300`}
          style={{ width: `${clamp(pct, 0, 100)}%` }}
          title={`${Math.round(clamp(pct, 0, 100))}%`}
        />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-gray-600">
          {new Date(startsAt).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })}
          {' – '}
          {new Date(endsAt).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })}
        </div>
      </div>
    </div>
  );
}
