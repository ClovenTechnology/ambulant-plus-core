'use client';

import { useEffect, useMemo, useState } from 'react';

type Slot = { start: string; end: string };
type Day = { date: string; slots: Slot[] };

export default function SchedulePreview({ days = 42 }: { days?: number }) {
  const [data, setData] = useState<Day[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setErr(null);
      try {
        const start = new Date();
        start.setDate(start.getDate() - (start.getDay() || 7) + 1); // Monday this week
        const s = start.toISOString().slice(0,10);
        const res = await fetch(`/api/schedule/slots/batch?start=${encodeURIComponent(s)}&days=${days}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(await res.text());
        const j = await res.json();
        if (alive) setData(j?.days ?? []);
      } catch (e:any) {
        if (alive) setErr(e?.message || 'Failed to load preview');
      }
    })();
    return () => { alive = false; };
  }, [days]);

  const weeks = useMemo(() => {
    const out: Day[][] = [];
    for (let i = 0; i < data.length; i += 7) out.push(data.slice(i, i + 7));
    return out;
  }, [data]);

  if (err) return <div className="text-sm text-rose-700">{err}</div>;
  if (!data.length) return <div className="text-sm text-gray-500">No slots to preview.</div>;

  return (
    <div className="space-y-4">
      {weeks.map((w, idx) => (
        <div key={idx} className="grid grid-cols-7 gap-2">
          {w.map(d => (
            <div key={d.date} className="border rounded p-2 min-h-[92px]">
              <div className="text-xs text-gray-600 mb-1">{d.date}</div>
              <div className="flex flex-wrap gap-1">
                {d.slots.slice(0, 8).map((s, i) => (
                  <span key={i} className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700">
                    {new Date(s.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ))}
                {d.slots.length > 8 && <span className="text-[11px] text-gray-500">+{d.slots.length - 8} more</span>}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
