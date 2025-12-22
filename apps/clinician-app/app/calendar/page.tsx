// apps/clinician-app/app/calendar/page.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import FullCalendar, {
  DateSelectArg,
  EventApi,
  EventClickArg,
  EventDropArg,
  EventInput,
  DatesSetArg,
} from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { toast } from 'react-hot-toast';
import { AppointmentModal } from '@/components/ClinicianCalendar/AppointmentModal';
import { useLiveAppointments } from '@/components/ClinicianCalendar/useLiveAppointments';
import { createOptimisticAppointment, rollbackOptimisticAppointment, applyServerPatch } from '@/components/ClinicianCalendar/lib/appointments';
import dayjs from 'dayjs';

type ClinicianCalendarProps = { clinicianId: string };

async function fetchAppointments(clinicianId: string) {
  const res = await fetch(`/api/_proxy/appointments?clinicianId=${encodeURIComponent(clinicianId)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch appointments`);
  return res.json();
}

async function fetchSlotsBatch(clinicianId: string, startISO: string, days: number) {
  const res = await fetch(`/api/schedule/slots/batch?start=${encodeURIComponent(startISO)}&days=${days}&clinicianId=${encodeURIComponent(clinicianId)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch slots');
  const json = await res.json();
  return json.slots || {};
}

async function rescheduleAppointment(appointmentId: string, start: Date, end: Date) {
  const res = await fetch(`/api/_proxy/appointments/${encodeURIComponent(appointmentId)}/reschedule`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ startsAt: start.toISOString(), endsAt: end.toISOString() }),
  });
  if (!res.ok) throw res;
  return res.json();
}

async function deleteAppointment(appointmentId: string) {
  const res = await fetch(`/api/_proxy/appointments/${encodeURIComponent(appointmentId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw res;
  return res;
}

async function fetchAlternativeStarts(clinicianId: string, centerIso: string, limit = 8) {
  try {
    const d = new Date(centerIso);
    const start = new Date(d);
    start.setDate(start.getDate() - 3);
    const startStr = start.toISOString().slice(0, 10);
    const slots = await fetchSlotsBatch(clinicianId, startStr, 7);
    const arr: string[] = [];
    Object.keys(slots || {}).forEach(dayKey => {
      (slots[dayKey] || []).forEach((s: any) => {
        const hhmm = s.start.includes('T') ? new Date(s.start).toISOString().slice(11,16) : s.start;
        const iso = `${dayKey}T${hhmm}:00.000Z`;
        arr.push(iso);
      });
    });
    return arr.slice(0, limit);
  } catch (e) {
    console.warn('fetchAlternativeStarts failed', e);
    return [];
  }
}

type UndoAction =
  | { id: string; type: 'move'; fromStart: string; fromEnd: string; toStart: string; toEnd: string }
  | { id: string; type: 'create'; createdAt?: string };

export default function CalendarPage({ clinicianId }: ClinicianCalendarProps) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [appointments, setAppointments] = useState<EventInput[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventApi | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [slotsCache, setSlotsCache] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [currentRange, setCurrentRange] = useState<{ start: string; end: string } | null>(null);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [bgEvents, setBgEvents] = useState<EventInput[]>([]);
  const liveAppointments = useLiveAppointments(clinicianId);

  // preferences persisted in localStorage
  const durationStorageKey = `clinician:${clinicianId}:duration`;
  const timeWindowStorageKey = `clinician:${clinicianId}:timewindow`;

  // clinician preferred duration (15/30/60)
  const [preferredDuration, setPreferredDuration] = useState<number>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(durationStorageKey) : null;
      const v = raw ? Number(raw) : 30;
      return [15,30,60].includes(v) ? v : 30;
    } catch { return 30; }
  });
  useEffect(() => {
    try { localStorage.setItem(durationStorageKey, String(preferredDuration)); } catch {}
  }, [preferredDuration]);

  // slot window: min/max strings like "08:00" and "23:00" (min inclusive, max can be >24.00 if overnight)
  const [slotMin, setSlotMin] = useState<string>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(timeWindowStorageKey) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.min || '00:00';
      }
    } catch {}
    return '00:00';
  });
  const [slotMaxInput, setSlotMaxInput] = useState<string>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(timeWindowStorageKey) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.max || '23:00';
      }
    } catch {}
    return '23:00';
  });

  useEffect(() => {
    try { localStorage.setItem(timeWindowStorageKey, JSON.stringify({ min: slotMin, max: slotMaxInput })); } catch {}
  }, [slotMin, slotMaxInput]);

  // normalize and clamp hh:mm
  useEffect(() => {
    const normalize = (t: string) => {
      if (!t) return '00:00';
      const parts = t.split(':');
      const h = parseInt(parts[0] || '0', 10);
      const m = parseInt(parts[1] || '0', 10);
      const hh = Math.max(0, Math.min(23, isNaN(h) ? 0 : h));
      const mm = Math.max(0, Math.min(59, isNaN(m) ? 0 : m));
      return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
    };
    setSlotMin((s) => normalize(s));
    setSlotMaxInput((s) => normalize(s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // convert to FullCalendar slotMinTime/slotMaxTime
  const toFullCalendarTimes = (minHHmm: string, maxHHmm: string) => {
    const [minH, minM] = minHHmm.split(':').map(Number);
    const [maxH, maxM] = maxHHmm.split(':').map(Number);
    const minSec = `${String(minH).padStart(2,'0')}:${String(minM).padStart(2,'0')}:00`;
    const numericMin = minH + minM/60;
    const numericMax = maxH + maxM/60;
    let maxStr: string;
    if (numericMax <= numericMin) {
      // overnight: push max into next day by adding 24 hours
      const overflow = maxH + 24;
      maxStr = `${String(overflow).padStart(2,'0')}:${String(maxM).padStart(2,'0')}:00`;
    } else {
      maxStr = `${String(maxH).padStart(2,'0')}:${String(maxM).padStart(2,'0')}:00`;
    }
    return { slotMinTime: minSec, slotMaxTime: maxStr };
  };

  // responsive calendar height so the grid is scrollable and displays full range
  const [calendarHeight, setCalendarHeight] = useState<number | 'auto'>('auto');
  useEffect(() => {
    function computeHeight() {
      try {
        const headerH = headerRef.current ? headerRef.current.getBoundingClientRect().height : 120;
        const padding = 32; // some breathing room
        const h = Math.max(300, window.innerHeight - headerH - padding);
        setCalendarHeight(h);
      } catch {
        setCalendarHeight('auto');
      }
    }
    computeHeight();
    window.addEventListener('resize', computeHeight);
    return () => window.removeEventListener('resize', computeHeight);
  }, []);

  // initial load
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const appts = await fetchAppointments(clinicianId);
        if (!mounted) return;
        setAppointments(appts.map(mapAppointmentToEvent));
      } catch (err) {
        console.error('load appointments', err);
        toast.error('Failed to load appointments');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [clinicianId]);

  useEffect(() => {
    if (!liveAppointments) return;
    const unsub = liveAppointments((update) => {
      setAppointments(prev => {
        const exists = prev.find(e => e.id === update.id);
        if (!exists) return [...prev, mapAppointmentToEvent(update)];
        return prev.map(e => e.id === update.id ? applyServerPatch(e, update) : e);
      });
    });
    return unsub;
  }, [liveAppointments]);

  const handleDatesSet = async (dates: DatesSetArg) => {
    const start = dates.start;
    const end = dates.end;
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    const startStr = start.toISOString().slice(0,10);
    setCurrentRange({ start: startStr, end: end.toISOString().slice(0,10) });
    try {
      const slots = await fetchSlotsBatch(clinicianId, startStr, days);
      setSlotsCache(slots);
    } catch (e) {
      console.warn('prefetch slots failed', e);
    }
    // compute background events for non-working hours for the visible range
    computeBackgroundEvents(start, end, slotMin, slotMaxInput);
  };

  function attachSlotsToEvent(evt: any) {
    try {
      const key = (evt.startsAt || evt.start || '').slice(0,10);
      if (key && slotsCache[key]) {
        return { ...evt, extendedProps: { ...(evt.extendedProps || {}), availableSlots: slotsCache[key] } };
      }
    } catch {}
    return evt;
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) return;

      if (e.key === 'n' || e.key === 'N') {
        const api = calendarRef.current?.getApi?.();
        if (!api) return;
        const start = new Date();
        const end = new Date(start.getTime() + preferredDuration * 60000);
        api.select(start, end);
      } else if (e.key === 'ArrowLeft') {
        calendarRef.current?.getApi?.().prev();
      } else if (e.key === 'ArrowRight') {
        calendarRef.current?.getApi?.().next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preferredDuration]);

  const handleEventClick = (clickInfo: EventClickArg) => {
    setSelectedEvent(clickInfo.event);
    setModalOpen(true);
  };

  const handleDateSelect = async (selectInfo: DateSelectArg) => {
    const { start, end } = selectInfo;
    const days = Math.max(1, Math.ceil((end!.getTime() - start!.getTime()) / 86400000));
    const cached: Record<string, any> = {};
    for (let i=0;i<days;i++){
      const d = new Date(start!.getTime()); d.setDate(d.getDate()+i);
      const key = d.toISOString().slice(0,10);
      if (slotsCache[key]) cached[key] = slotsCache[key];
    }

    setSelectedEvent({
      id: 'tmp-' + Date.now(),
      start,
      end,
      title: 'New Appointment',
      extendedProps: { availableSlots: cached, defaultDuration: preferredDuration },
    } as EventApi);
    setModalOpen(true);
  };

  const badgeClassForStatus = (status: string | undefined) => {
    switch (status) {
      case 'booked': return 'bg-indigo-700 text-white';
      case 'ongoing': return 'bg-emerald-600 text-white';
      case 'completed': return 'bg-gray-300 text-gray-800';
      case 'canceled': return 'bg-rose-100 text-rose-700';
      case 'blocked': return 'bg-amber-500 text-white';
      default: return 'bg-slate-200 text-slate-800';
    }
  };

  const eventContent = (arg: any) => {
    const start = arg.event.start;
    const end = arg.event.end;
    const mins = start && end ? Math.round(((end as Date).getTime() - (start as Date).getTime()) / 60000) : null;
    const status = arg.event.extendedProps?.status;
    const badgeClass = badgeClassForStatus(status);
    return (
      <div className="flex items-center gap-2" role="article" aria-label={`${arg.event.title} appointment`}>
        <div className="flex-1 text-sm truncate">{arg.event.title}</div>
        {mins !== null && (
          <div className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${badgeClass}`} aria-hidden>
            {mins}m
          </div>
        )}
      </div>
    );
  };

  const handleEventDrop = async (dropInfo: EventDropArg) => {
    const event = dropInfo.event;
    const oldStart = (dropInfo as any).oldEvent?.start ?? null;
    const oldEnd = (dropInfo as any).oldEvent?.end ?? null;
    const prevStart = oldStart ? new Date(oldStart) : null;
    const prevEnd = oldEnd ? new Date(oldEnd) : null;

    const newStart = event.start!;
    const newEnd = event.end!;

    if (prevStart && prevEnd) {
      const undo: UndoAction = {
        id: event.id,
        type: 'move',
        fromStart: prevStart.toISOString(),
        fromEnd: prevEnd.toISOString(),
        toStart: newStart.toISOString(),
        toEnd: newEnd.toISOString(),
      };
      pushUndo(undo);
    }

    try {
      await rescheduleAppointment(event.id, newStart, newEnd);
      toast.success('Appointment rescheduled');
    } catch (err: any) {
      try { dropInfo.revert(); } catch (e) { console.warn('revert failed', e); }
      if (prevStart && prevEnd) {
        setUndoStack((u) => u.filter(x => !(x.type === 'move' && x.id === event.id && (x as any).toStart === newStart.toISOString())));
      }

      if (err?.status === 409) {
        const alt = await fetchAlternativeStarts(clinicianId, event.start!.toISOString(), 6);
        toast.error('Conflict: Could not reschedule — alternatives suggested');
        toast((t) => (
          <div className="flex items-center gap-3">
            <div className="text-sm">Conflict when rescheduling.</div>
            <div className="ml-auto flex gap-2">
              {alt.slice(0,3).map(a => (
                <button key={a} onClick={async () => {
                  try {
                    const altStart = new Date(a);
                    const altEnd = new Date(altStart.getTime() + ((newEnd as Date).getTime() - (newStart as Date).getTime()));
                    const patched = await rescheduleAppointment(event.id, altStart, altEnd);
                    setAppointments(prev => prev.map(ev => ev.id === patched.id ? mapAppointmentToEvent(patched) : ev));
                    toast.success('Rescheduled to alternative');
                    toast.dismiss(t.id);
                  } catch (e) {
                    toast.error('Alternative reschedule failed');
                  }
                }} className="px-2 py-1 text-xs rounded bg-indigo-600 text-white">Try {new Date(a).toLocaleString()}</button>
              ))}
            </div>
          </div>
        ));
      } else {
        toast.error('Failed to reschedule');
      }
    }
  };

  function pushUndo(action: UndoAction) {
    setUndoStack(prev => [...prev, action]);
    toast((t) => (
      <div className="flex items-center gap-4">
        <div className="text-sm">
          {action.type === 'move' ? 'Moved appointment' : 'Created appointment'}
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={async () => {
              await performUndo(action);
              toast.dismiss(t.id);
            }}
            className="px-2 py-1 rounded bg-gray-800 text-white text-xs"
          >
            Undo
          </button>
        </div>
      </div>
    ), { duration: 6000 });
    setTimeout(() => {
      setUndoStack(prev => prev.filter(u => u !== action));
    }, 10000);
  }

  async function performUndo(action: UndoAction) {
    try {
      if (action.type === 'move') {
        await rescheduleAppointment(action.id, new Date(action.fromStart), new Date(action.fromEnd));
        const refreshed = await fetchAppointments(clinicianId);
        setAppointments(refreshed.map(mapAppointmentToEvent));
        // animated success toast (tiny pulse)
        toast.custom(() => (
          <div className="flex items-center gap-2 px-3 py-2 rounded bg-emerald-600 text-white animate-pulse">
            <div className="font-medium">Undo successful</div>
          </div>
        ), { duration: 2500 });
      } else if (action.type === 'create') {
        try {
          await deleteAppointment(action.id);
          setAppointments(prev => prev.filter(e => e.id !== action.id));
          toast.custom(() => (
            <div className="flex items-center gap-2 px-3 py-2 rounded bg-emerald-600 text-white animate-pulse">
              <div className="font-medium">Undo successful — removed</div>
            </div>
          ), { duration: 2500 });
        } catch (e) {
          toast.error('Failed to undo creation');
        }
      }
    } catch (e) {
      console.error('performUndo failed', e);
      toast.error('Undo failed');
    } finally {
      setUndoStack(prev => prev.filter(u => u !== action));
    }
  }

  const handleModalUpdate = (updated: any) => {
    try {
      if (updated.createdAt) {
        const createdAt = new Date(updated.createdAt);
        if ((Date.now() - createdAt.getTime()) < 15000) {
          const ua: UndoAction = { id: updated.id, type: 'create', createdAt: updated.createdAt };
          pushUndo(ua);
        }
      }
    } catch {}
    setAppointments(prev => {
      const exists = prev.some(e => e.id === updated.id);
      if (!exists) return [...prev, mapAppointmentToEvent(updated)];
      return prev.map(e => e.id === updated.id ? mapAppointmentToEvent(updated) : e);
    });
  };

  const reload = async () => {
    setLoading(true);
    try {
      const appts = await fetchAppointments(clinicianId);
      setAppointments(appts.map(mapAppointmentToEvent));
      if (currentRange) {
        const days = Math.max(1, Math.ceil((new Date(currentRange.end).getTime() - new Date(currentRange.start).getTime())/86400000));
        const slots = await fetchSlotsBatch(clinicianId, currentRange.start, days || 7);
        setSlotsCache(slots);
      }
      toast.success('Refreshed');
    } catch (err) {
      console.error('refresh', err);
      toast.error('Refresh failed');
    } finally { setLoading(false); }
  };

  // compute background events representing non-working hours for visible range
  function computeBackgroundEvents(rangeStart: Date, rangeEnd: Date, minHHmm: string, maxHHmm: string) {
    try {
      const [minH, minM] = minHHmm.split(':').map(Number);
      const [maxH, maxM] = maxHHmm.split(':').map(Number);
      const numericMin = minH + minM/60;
      const numericMax = maxH + maxM/60;

      const days: Date[] = [];
      const start = new Date(rangeStart);
      start.setHours(0,0,0,0);
      const end = new Date(rangeEnd);
      end.setHours(0,0,0,0);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
        days.push(new Date(d));
      }

      const bg: EventInput[] = [];
      days.forEach((d, idx) => {
        const dayKey = d.toISOString().slice(0,10);

        // working start = d + minHHmm
        const workingStart = new Date(d);
        workingStart.setHours(minH, minM, 0, 0);

        // working end: if numericMax <= numericMin -> next day
        const workingEnd = new Date(d);
        if (numericMax <= numericMin) {
          // ends next day
          workingEnd.setDate(workingEnd.getDate() + 1);
          workingEnd.setHours(maxH, maxM, 0, 0);
        } else {
          workingEnd.setHours(maxH, maxM, 0, 0);
        }

        const dayStart = new Date(d);
        dayStart.setHours(0,0,0,0);
        const nextDayStart = new Date(d);
        nextDayStart.setDate(nextDayStart.getDate() + 1);
        nextDayStart.setHours(0,0,0,0);

        // before working start (if any)
        if (workingStart.getTime() > dayStart.getTime()) {
          bg.push({
            id: `bg-before-${dayKey}`,
            start: dayStart.toISOString(),
            end: workingStart.toISOString(),
            display: 'background',
            className: 'fc-nonworking',
          });
        }

        // after working end (wrap to next day's midnight)
        if (workingEnd.getTime() < nextDayStart.getTime()) {
          bg.push({
            id: `bg-after-${dayKey}`,
            start: workingEnd.toISOString(),
            end: nextDayStart.toISOString(),
            display: 'background',
            className: 'fc-nonworking',
          });
        }
      });

      setBgEvents(bg);
    } catch (e) {
      console.warn('computeBackgroundEvents error', e);
      setBgEvents([]);
    }
  }

  // whenever slot window changes, recompute background events for current range
  useEffect(() => {
    if (!currentRange) return;
    const s = new Date(currentRange.start);
    const e = new Date(currentRange.end);
    computeBackgroundEvents(s, e, slotMin, slotMaxInput);
  }, [slotMin, slotMaxInput, currentRange]);

  function MiniMonth({ onJump, slots, collapsed, setCollapsed }: { onJump: (d: Date) => void; slots: Record<string, any>; collapsed: boolean; setCollapsed: (v:boolean) => void; }) {
    const [viewMonth, setViewMonth] = useState(dayjs());
    const startOfMonth = viewMonth.startOf('month');
    const daysInMonth = viewMonth.daysInMonth();
    const startWeekday = startOfMonth.day();
    const rows: (number | null)[] = [];
    for (let i = 0; i < startWeekday; i++) rows.push(null);
    for (let d = 1; d <= daysInMonth; d++) rows.push(d);

    const pickDate = (d: number | null) => {
      if (!d) return;
      const dt = new Date(viewMonth.year(), viewMonth.month(), d);
      onJump(dt);
    };

    return (
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-2">
          <button aria-label="Toggle mini calendar" onClick={() => setCollapsed(!collapsed)} className="px-2 py-1 border rounded text-xs">{collapsed ? 'Open mini' : 'Hide mini'}</button>
        </div>

        {!collapsed && (
          <div className="w-48 bg-white border rounded p-2 text-sm shadow-sm mt-2" role="region" aria-label="Mini month navigator">
            <div className="flex items-center justify-between mb-2">
              <button aria-label="Prev month" onClick={() => setViewMonth(m => m.subtract(1, 'month'))} className="px-2 py-1 rounded border text-xs">‹</button>
              <div className="font-medium text-xs">{viewMonth.format('MMMM YYYY')}</div>
              <button aria-label="Next month" onClick={() => setViewMonth(m => m.add(1, 'month'))} className="px-2 py-1 rounded border text-xs">›</button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-gray-500 mb-1">
              {['S','M','T','W','T','F','S'].map(x => <div key={x} className="font-semibold">{x}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {rows.map((d, idx) => {
                const dayKey = d ? `${viewMonth.format('YYYY-MM')}-${String(d).padStart(2,'0')}` : null;
                const hasSlots = dayKey ? Boolean(slots?.[dayKey]?.length) : false;
                const isToday = d !== null && dayjs().isSame(dayjs(`${viewMonth.format('YYYY-MM')}-${String(d).padStart(2,'0')}`), 'day');
                return (
                  <button
                    key={idx}
                    onClick={() => pickDate(d)}
                    disabled={d === null}
                    className={`w-full h-8 rounded text-xs ${d === null ? 'bg-transparent' : 'hover:bg-gray-100'} ${isToday ? 'ring-1 ring-indigo-200' : ''} flex items-center justify-center relative`}
                    aria-label={d ? `Jump to ${viewMonth.format('MMMM')} ${d}` : 'empty'}
                  >
                    <span>{d ?? ''}</span>
                    {hasSlots && <span className="absolute right-1 bottom-1 w-2 h-2 rounded-full bg-emerald-500" aria-hidden />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  const safeGotoDate = (d: Date) => {
    const api = calendarRef.current?.getApi?.();
    if (!api || !(d instanceof Date) || Number.isNaN(d.getTime())) return;
    api.gotoDate(d);
  };

  const Legend = () => (
    <div className="flex items-center gap-3 text-xs text-gray-600">
      <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-600" /> Booked</div>
      <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-600" /> In progress</div>
      <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-300" /> Completed</div>
      <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500" /> Blocked</div>
      <div className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-emerald-200 bg-emerald-50" /> Available</div>
    </div>
  );

  const [miniCollapsed, setMiniCollapsed] = useState(false);

  // compute final slot props for calendar
  const { slotMinTime, slotMaxTime } = toFullCalendarTimes(slotMin, slotMaxInput);

  // save window server-side (PUT /api/settings/schedule with { clinicianId, window: { min, max } })
  async function saveWindow() {
    try {
      const res = await fetch('/api/settings/schedule', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clinicianId, window: { min: slotMin, max: slotMaxInput } }),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      toast.success('Window saved');
    } catch (e) {
      console.error('saveWindow failed', e);
      toast.error('Failed to save window');
    }
  }

  return (
    <div className="h-screen w-full p-4 bg-gray-50 flex flex-col gap-3">
      {/* small global style for background events */}
      <style>{`
        /* tint non-working hours */
        .fc-nonworking {
          background: rgba(2,6,23,0.04) !important;
        }
      `}</style>

      <header ref={headerRef} className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div>
            <div className="text-lg font-semibold">Clinician Calendar</div>
            <div className="text-sm text-gray-600">Clinician: <strong>{clinicianId}</strong></div>
          </div>
          <div className="pt-1"><Legend /></div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button aria-label="Go to today" onClick={() => calendarRef.current?.getApi?.().today()} className="px-3 py-1 border rounded">Today</button>
            <button aria-label="Previous range" onClick={() => calendarRef.current?.getApi?.().prev()} className="px-2 py-1 border rounded">Prev</button>
            <button aria-label="Next range" onClick={() => calendarRef.current?.getApi?.().next()} className="px-2 py-1 border rounded">Next</button>
            <button aria-label="Reload calendar" onClick={reload} className="px-3 py-1 border rounded">{loading ? 'Loading…' : 'Reload'}</button>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-600 mr-1">Default duration</div>
            {[15,30,60].map((m) => (
              <button
                key={m}
                onClick={() => setPreferredDuration(m)}
                className={`px-2 py-1 text-xs rounded ${preferredDuration === m ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                aria-pressed={preferredDuration === m}
                title={`${m} minutes`}
              >
                {m}m
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 border rounded px-2 py-1 text-sm">
            <label className="text-xs text-gray-600 mr-1">Window</label>
            <select
              aria-label="Presets"
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'clinic') { setSlotMin('08:00'); setSlotMaxInput('17:00'); }
                else if (v === 'full') { setSlotMin('00:00'); setSlotMaxInput('23:00'); }
                else if (v === 'late') { setSlotMin('18:00'); setSlotMaxInput('03:00'); }
                else if (v === 'custom') { /* no-op */ }
              }}
              className="text-xs"
              defaultValue="custom"
            >
              <option value="custom">Custom</option>
              <option value="clinic">Clinic (08:00–17:00)</option>
              <option value="full">All day (00:00–23:00)</option>
              <option value="late">Late night (18:00–03:00)</option>
            </select>

            <input aria-label="Start time" type="time" value={slotMin} onChange={(e) => setSlotMin(e.target.value)} className="text-xs" />
            <span className="text-xs">—</span>
            <input aria-label="End time" type="time" value={slotMaxInput} onChange={(e) => setSlotMaxInput(e.target.value)} className="text-xs" />

            <button onClick={saveWindow} className="ml-2 px-2 py-1 rounded bg-indigo-600 text-white text-xs">Save window</button>
          </div>

          <MiniMonth onJump={(d) => safeGotoDate(d)} slots={slotsCache} collapsed={miniCollapsed} setCollapsed={setMiniCollapsed} />
        </div>
      </header>

      <main className="flex-1 overflow-hidden rounded">
        <FullCalendar
          ref={(node) => { calendarRef.current = node as any; }}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: '',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
          }}
          editable
          selectable
          selectMirror
          dayMaxEvents
          events={[...appointments, ...bgEvents]}
          select={handleDateSelect}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          datesSet={handleDatesSet}
          eventClassNames={(arg) => getEventClassName(arg.event.extendedProps?.status)}
          eventContent={eventContent as any}
          height={calendarHeight}
          nowIndicator
          slotMinTime={slotMinTime}
          slotMaxTime={slotMaxTime}
          scrollTime={slotMinTime || '08:00:00'}
          slotDuration="00:15:00"
        />
      </main>

      {modalOpen && selectedEvent && (
        <AppointmentModal
          event={selectedEvent}
          clinicianId={clinicianId}
          onClose={() => { setModalOpen(false); setSelectedEvent(null); }}
          onUpdate={handleModalUpdate}
        />
      )}
    </div>
  );
}

function mapAppointmentToEvent(appt: any): EventInput {
  const statusClassMap: Record<string, string> = {
    booked: 'bg-indigo-600 text-white',
    ongoing: 'bg-emerald-600 text-white',
    completed: 'bg-gray-300 text-gray-800',
    canceled: 'bg-rose-50 text-rose-700 border-rose-200',
    blocked: 'bg-amber-600 text-white',
  };
  return {
    id: appt.id,
    title: appt.patient?.name || 'Appointment',
    start: appt.startsAt,
    end: appt.endsAt,
    extendedProps: { status: appt.status, ...appt.meta },
    className: statusClassMap[appt.status] || '',
  };
}

function getEventClassName(status: string) {
  switch (status) {
    case 'booked': return 'bg-indigo-600 text-white';
    case 'ongoing': return 'bg-emerald-600 text-white';
    case 'completed': return 'bg-gray-300 text-gray-800';
    case 'canceled': return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'blocked': return 'bg-amber-600 text-white';
    default: return 'bg-emerald-50 border-emerald-200 text-emerald-700';
  }
}
