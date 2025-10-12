// apps/clinician-app/app/settings/consult/CalendarPreview.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

type DaySlots = { start: string; end: string; label?: string }[];
type BatchResp = { slots: Record<string, DaySlots> };

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun
  const diff = (day + 6) % 7; // make Monday=0
  x.setDate(x.getDate() - diff);
  x.setHours(0,0,0,0);
  return x;
}

export default function CalendarPreview({
  clinicianId,
  days = 14,
  apiBase = '/api/schedule/slots/batch',
  mode = 'week', // 'week'|'month'
}: {
  clinicianId: string;
  days?: number;
  apiBase?: string;
  mode?: 'week'|'month';
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string|null>(null);
  const [slots, setSlots] = useState<Record<string, DaySlots>>({});

  const anchor = useMemo(() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d;
  }, []);

  const range = useMemo(() => {
    if (mode === 'month') {
      // 6 weeks grid (~42 days) starting Monday of week containing day 1 of month
      const first = new Date(anchor);
      first.setDate(1);
      const gridStart = startOfWeek(first);
      return { start: gridStart, days: 42 };
    }
    const w = startOfWeek(anchor);
    return { start: w, days: days };
  }, [anchor, mode, days]);

  useEffect(() => {
    (async () => {
      setLoading(true); setErr(null);
      try {
        const startStr = range.start.toISOString().slice(0,10);
        const url = `${apiBase}?start=${encodeURIComponent(startStr)}&days=${range.days}&clinicianId=${encodeURIComponent(clinicianId)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as BatchResp;
        setSlots(json.slots || {});
      } catch (e:any) {
        setErr(e?.message || 'Failed to load preview');
      } finally {
        setLoading(false);
      }
    })();
  }, [apiBase, clinicianId, range]);

  const daysArr = useMemo(() => {
    const arr: Date[] = [];
    for (let i=0;i<range.days;i++) {
      const d = new Date(range.start);
      d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [range]);

  const renderDay = (d: Date) => {
    const key = d.toISOString().slice(0,10);
    const ds = slots[key] || [];
    return (
      <div key={key} className="border rounded p-2 min-h-24 bg-white flex flex-col gap-1">
        <div className="text-[11px] text-gray-500">{d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
        <div className="flex flex-wrap gap-1">
          {ds.slice(0,6).map((s, i) => {
            const t = new Date(s.start).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' });
            return <span key={i} className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700">{t}</span>;
          })}
          {ds.length > 6 && <span className="text-[11px] text-gray-500">+{ds.length - 6} more</span>}
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-2">
      <div className="text-sm font-medium">Calendar Preview ({mode === 'month' ? 'Month grid' : `${days} days`})</div>
      {loading && <div className="text-sm text-gray-600">Loading…</div>}
      {err && <div className="text-sm text-rose-600">Error: {err}</div>}
      {!loading && !err && (
        <div className={mode === 'month' ? 'grid grid-cols-7 gap-2' : 'grid grid-cols-7 gap-2'}>
          {daysArr.map(renderDay)}
        </div>
      )}
    </section>
  );
}
