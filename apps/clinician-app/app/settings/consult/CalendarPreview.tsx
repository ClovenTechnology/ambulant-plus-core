// apps/clinician-app/app/settings/consult/CalendarPreview.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

type DaySlots = { start: string; end?: string; label?: string }[];
type BatchResp = { slots: Record<string, DaySlots> };

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun
  const diff = (day + 6) % 7; // make Monday=0
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * CalendarPreview
 * - Accepts slotMin/slotMax (HH:mm) and defaultDuration (minutes)
 * - Filters visible slots to the configured window (supports overnight windows)
 * - Shades non-working hours visually
 * - Avoids truncation by using sensible min-height and overflow
 */
export default function CalendarPreview({
  clinicianId,
  days = 14,
  apiBase = '/api/schedule/slots/batch',
  mode = 'week', // 'week'|'month'
  initialView = 'week',
  onSelectSlot, // optional callback when user clicks available slot
  slotMin = '00:00',
  slotMax = '23:59',
  defaultDuration,
}: {
  clinicianId: string;
  days?: number;
  apiBase?: string;
  mode?: 'week' | 'month';
  initialView?: 'week' | 'month';
  onSelectSlot?: (startIso: string, endIso?: string) => void;
  slotMin?: string; // "HH:mm" local
  slotMax?: string; // "HH:mm" local
  defaultDuration?: number; // minutes
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [slots, setSlots] = useState<Record<string, DaySlots>>({});
  const anchor = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const range = useMemo(() => {
    if (mode === 'month' || initialView === 'month') {
      const first = new Date(anchor);
      first.setDate(1);
      const gridStart = startOfWeek(first);
      return { start: gridStart, days: 42, mode: 'month' as const };
    }
    const w = startOfWeek(anchor);
    return { start: w, days, mode: 'week' as const };
  }, [anchor, mode, days, initialView]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const startStr = range.start.toISOString().slice(0, 10);
        const url = `${apiBase}?start=${encodeURIComponent(
          startStr,
        )}&days=${range.days}&clinicianId=${encodeURIComponent(clinicianId)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as BatchResp;
        if (!mounted) return;
        setSlots(json.slots || {});
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || 'Failed to load preview');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [apiBase, clinicianId, range]);

  const daysArr = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < range.days; i++) {
      const d = new Date(range.start);
      d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [range]);

  // parse "HH:mm" -> minutes since midnight
  const hhmmToMinutes = (hhmm: string) => {
    const [hRaw, mRaw] = (hhmm || '00:00').split(':');
    const h = Number(hRaw ?? 0);
    const m = Number(mRaw ?? 0);
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
  };

  // Determine whether a local Date falls inside the configured window.
  // Supports overnight windows (slotMax <= slotMin means window crosses midnight).
  const isInWindow = (d: Date) => {
    const mins = d.getHours() * 60 + d.getMinutes();
    const minWindow = hhmmToMinutes(slotMin);
    const maxWindow = hhmmToMinutes(slotMax);
    if (maxWindow <= minWindow) {
      // overnight: valid if mins >= minWindow OR mins < maxWindow
      return mins >= minWindow || mins < maxWindow;
    }
    return mins >= minWindow && mins < maxWindow;
  };

  // helper: when user clicks a slot badge call onSelectSlot if provided
  const handleSlotClick = (s: { start: string; end?: string }) => {
    if (!onSelectSlot) return;
    const startIso = new Date(s.start).toISOString();
    const endIso = s.end ? new Date(s.end).toISOString() : undefined;
    try {
      onSelectSlot(startIso, endIso);
    } catch (e) {
      console.warn('onSelectSlot threw', e);
    }
  };

  // compute overlay metrics for shading non-working hours (percentage from top)
  const overlayMetrics = useMemo(() => {
    const minM = hhmmToMinutes(slotMin);
    let maxM = hhmmToMinutes(slotMax);
    if (maxM <= minM) maxM = maxM + 24 * 60;
    const full = 24 * 60;
    const topPct = (minM / full) * 100;
    const bottomPct = (maxM / full) * 100;
    return { topPct, bottomPct };
  }, [slotMin, slotMax]);

  const renderDay = (d: Date) => {
    const key = d.toISOString().slice(0, 10);
    const ds = slots[key] || [];

    // filter slots to configured window
    const filtered = ds.filter((s) => {
      if (!s.start) return false;
      const maybeIso = new Date(s.start);
      if (!isNaN(maybeIso.getTime())) {
        return isInWindow(maybeIso);
      }
      const parts = s.start.split(':');
      if (parts.length >= 2) {
        const copy = new Date(d);
        copy.setHours(Number(parts[0]), Number(parts[1]), 0, 0);
        return isInWindow(copy);
      }
      return false;
    });

    const SHOW = 10;
    return (
      <div
        key={key}
        className="relative border rounded p-2 min-h-[120px] bg-white flex flex-col gap-2 overflow-hidden"
        aria-label={`Slots for ${d.toDateString()}`}
      >
        {/* shading overlays for non-working hours */}
        <div
          className="absolute inset-x-0 top-0 bg-slate-50 pointer-events-none"
          style={{ height: `${overlayMetrics.topPct}%`, opacity: 0.9 }}
          aria-hidden
        />
        <div
          className="absolute inset-x-0"
          style={{
            top: `${overlayMetrics.bottomPct}%`,
            height: `${100 - overlayMetrics.bottomPct}%`,
            background: 'rgba(241,245,249,0.9)',
          }}
          aria-hidden
        />

        <div className="relative z-10">
          <div className="text-[11px] text-gray-600">
            {d.toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {filtered.length === 0 && (
              <div className="text-[11px] text-gray-400">No slots</div>
            )}
            {filtered.slice(0, SHOW).map((s, i) => {
              let labelTime = s.start;
              try {
                const dt = new Date(s.start);
                if (!isNaN(dt.getTime())) {
                  labelTime = dt.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                } else if (s.start.length === 5 && s.start.includes(':')) {
                  labelTime = s.start;
                }
              } catch {
                // ignore
              }

              return (
                <button
                  key={i}
                  onClick={() => handleSlotClick(s)}
                  title={s.label ?? `${labelTime}`}
                  className="flex items-center gap-2 text-[11px] px-2 py-0.5 rounded border bg-emerald-50 border-emerald-200 text-emerald-700 hover:scale-105 transform transition focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <span className="font-medium">{labelTime}</span>
                  {defaultDuration ? (
                    <span className="text-[10px] px-1 rounded-full bg-gray-100 text-gray-700">
                      {defaultDuration}m
                    </span>
                  ) : null}
                </button>
              );
            })}
            {filtered.length > SHOW && (
              <span className="text-[11px] text-gray-500">
                +{filtered.length - SHOW} more
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">
          Calendar Preview{' '}
          {range.mode === 'month' ? '(Month grid)' : `(${range.days} days)`}
        </div>
        <div className="text-xs text-gray-500">
          Showing slots between <strong>{slotMin}</strong> and{' '}
          <strong>{slotMax}</strong>
          {hhmmToMinutes(slotMax) <= hhmmToMinutes(slotMin) ? ' (overnight)' : ''}.
        </div>
      </div>

      {loading && <div className="text-sm text-gray-600">Loading…</div>}
      {err && <div className="text-sm text-rose-600">Error: {err}</div>}

      {!loading && !err && (
        <div className="grid grid-cols-7 gap-2">{daysArr.map(renderDay)}</div>
      )}
    </section>
  );
}
