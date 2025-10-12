'use client';

import { useEffect, useMemo, useState } from 'react';

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ?? '';

type View = 'week' | 'month';

function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfWeek(d: Date) {
  const x = new Date(d);
  const dow = x.getDay();
  const diff = (dow + 6) % 7; // Monday=0
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function fetchSlotsDay(clinicianId: string, dateISO: string) {
  const qs = new URLSearchParams({ clinician_id: clinicianId, date: dateISO });
  const r = await fetch(`${GATEWAY}/api/schedule/slots?${qs}`, { cache: 'no-store' });
  if (!r.ok) return { date: dateISO, slots: [] as string[] };
  const j = await r.json();
  return { date: dateISO, slots: (j.slots || []) as string[] };
}

async function fetchSlotsBatch(clinicianId: string, startISO: string, days: number) {
  const qs = new URLSearchParams({ clinician_id: clinicianId, start: startISO, days: String(days) });
  const r = await fetch(`${GATEWAY}/api/schedule/slots/batch?${qs}`, { cache: 'no-store' });
  if (!r.ok) return { start: startISO, items: [] as Array<{ date: string; slots: string[] }> };
  const j = await r.json();
  return { start: startISO, items: (j.items || []) as Array<{ date: string; slots: string[] }> };
}

export default function CalendarPreview({
  clinicianId = 'clinician-local-001',
  initialView = 'week' as View,
  useBatchForWeek = false,
}: {
  clinicianId?: string;
  initialView?: View;
  useBatchForWeek?: boolean;
}) {
  const [view, setView] = useState<View>(initialView);
  const [cursor, setCursor] = useState<Date>(new Date());
  const [grid, setGrid] = useState<Array<{ date: string; slots: string[] }>>([]);
  const [loading, setLoading] = useState(false);

  const title = useMemo(() => {
    const opts: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
    return new Intl.DateTimeFormat(undefined, opts).format(cursor);
  }, [cursor]);

  const days = useMemo(() => {
    if (view === 'week') {
      const start = startOfWeek(cursor);
      return Array.from({ length: 7 }, (_, i) => fmtDate(addDays(start, i)));
    } else {
      const s = startOfMonth(cursor);
      const firstGrid = startOfWeek(s);
      return Array.from({ length: 42 }, (_, i) => fmtDate(addDays(firstGrid, i)));
    }
  }, [view, cursor]);

  useEffect(() => {
    (async () => {
      setLoading(true);

      if (view === 'week') {
        if (useBatchForWeek) {
          const startISO = days[0];
          const res = await fetchSlotsBatch(clinicianId, startISO, 7);
          const byDate: Record<string, string[]> = Object.fromEntries(
            (res.items || []).map(it => [it.date, it.slots]),
          );
          setGrid(days.map(d => ({ date: d, slots: byDate[d] || [] })));
        } else {
          const res = await Promise.all(days.map(d => fetchSlotsDay(clinicianId, d)));
          setGrid(res);
        }
        setLoading(false);
        return;
      }

      // month
      const startISO = days[0];
      const res = await fetchSlotsBatch(clinicianId, startISO, days.length);
      const byDate: Record<string, string[]> = Object.fromEntries(
        (res.items || []).map(it => [it.date, it.slots]),
      );
      setGrid(days.map(d => ({ date: d, slots: byDate[d] || [] })));
      setLoading(false);
    })();
  }, [days, view, clinicianId, useBatchForWeek]);

  function shift(n: number) {
    if (view === 'week') setCursor(addDays(cursor, n * 7));
    else { const x = new Date(cursor); x.setMonth(x.getMonth() + n); setCursor(x); }
  }

  const byDate = useMemo(() => Object.fromEntries(grid.map(g => [g.date, g.slots])), [grid]);
  const todayISO = fmtDate(new Date());

  return (
    <section className="border rounded bg-white">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50 rounded-t">
        <div className="text-sm font-medium">Preview — {view === 'week' ? 'Week' : 'Month'} ({title})</div>
        <div className="flex items-center gap-2 text-xs">
          <button onClick={() => shift(-1)} className="px-2 py-1 border rounded">◀</button>
          <button onClick={() => setCursor(new Date())} className="px-2 py-1 border rounded">Today</button>
          <button onClick={() => shift(+1)} className="px-2 py-1 border rounded">▶</button>
          <div className="ml-2">
            <select value={view} onChange={e => setView(e.target.value as View)} className="border rounded px-2 py-1">
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </div>
        </div>
      </div>

      {loading && <div className="p-3 text-sm">Loading…</div>}

      {!loading && (
        <div className="grid grid-cols-7 gap-2 p-2">
          {days.map(d => {
            const slots = byDate[d] || [];
            const isToday = d === todayISO;
            const dateObj = new Date(d);
            const dayLabel = dateObj.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
            return (
              <div key={d} className={`border rounded p-2 ${isToday ? 'ring-2 ring-indigo-400' : ''}`}>
                <div className="text-xs text-gray-500 mb-1">{dayLabel}</div>
                {slots.length === 0
                  ? <div className="text-xs text-gray-400">no slots</div>
                  : (
                    <div className="flex flex-wrap gap-1">
                      {slots.map(s => (
                        <span key={s} className="px-1.5 py-0.5 border rounded text-xs">{s}</span>
                      ))}
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
