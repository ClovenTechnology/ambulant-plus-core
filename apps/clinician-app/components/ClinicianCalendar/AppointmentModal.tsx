// apps/clinician-app/components/ClinicianCalendar/AppointmentModal.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import type { EventApi } from '@fullcalendar/react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type Slot = { start: string; end: string; label?: string }; // ISO strings or HH:mm
type BookedAppt = { id: string; patient?: { name?: string }; startsAt: string; endsAt: string; status?: string };

type AppointmentModalProps = {
  event: EventApi; // current appointment (may be optimistic/new)
  clinicianId: string;
  onClose: () => void;
  onUpdate: (updated: any) => void;
};

/* ---------- Suggestion modal (rich) ---------- */
function SuggestionModal({
  open,
  onClose,
  suggestions,
  onApply,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  suggestions: string[];
  onApply: (iso: string) => void;
  loading?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-4">
        <h3 className="text-lg font-semibold mb-2">Alternative slots</h3>
        <p className="text-sm text-gray-600 mb-3">
          We found alternative free slots nearby. Pick one to reschedule (or close to keep current).
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {loading && <div className="text-sm text-gray-500">Searching…</div>}
          {!loading && suggestions.length === 0 && <div className="text-sm text-gray-500">No suggestions available.</div>}
          {!loading &&
            suggestions.map((s) => (
              <button
                key={s}
                onClick={() => onApply(s)}
                className="px-3 py-1 rounded bg-indigo-600 text-white text-sm shadow-sm hover:bg-indigo-700"
              >
                {dayjs(s).format('ddd DD MMM HH:mm')}
              </button>
            ))}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 border rounded">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- DroppableSlot wrapper to show animated highlight when item is over it ---------- */
function DroppableSlot({ id, children }: { id: string; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  // animated ring: scale + opacity + ring
  return (
    <div
      ref={setNodeRef}
      className={`w-full transition-all duration-150 ${isOver ? 'scale-105 opacity-95 ring-2 ring-indigo-300 rounded' : ''}`}
    >
      {children}
    </div>
  );
}

/* ---------- Sortable appointment card using useSortable ---------- */
function SortableAppt({
  appt,
  onDragStart,
}: {
  appt: BookedAppt;
  onDragStart: (id: string, label?: string) => void;
}) {
  // id should be 'appt:<id>' so DnD active.id is predictable
  const id = `appt:${appt.id}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: 'manipulation' as const,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  // calculate duration badge from appt times (fallback blank)
  let durationBadge: string | null = null;
  try {
    if (appt.startsAt && appt.endsAt) {
      const mins = dayjs(appt.endsAt).diff(dayjs(appt.startsAt), 'minute');
      if (!isNaN(mins) && mins > 0) durationBadge = `${mins}m`;
    }
  } catch {
    durationBadge = null;
  }

  return (
    <div
      ref={setNodeRef}
      id={id}
      style={style}
      className="flex justify-between items-center text-xs bg-slate-50 px-2 py-1 rounded border cursor-grab"
      title={`${dayjs(appt.startsAt).format('HH:mm')} ${appt.patient?.name ?? ''}`}
      {...attributes}
      {...listeners}
      onPointerDown={() => onDragStart(id, appt.patient?.name)}
    >
      <div>
        <div className="font-medium">{appt.patient?.name || 'Patient'}</div>
        <div className="text-[11px] text-gray-500">
          {appt.startsAt ? dayjs(appt.startsAt).format('HH:mm') : ''} - {appt.endsAt ? dayjs(appt.endsAt).format('HH:mm') : ''}
        </div>
      </div>
      {durationBadge ? (
        <div className="ml-3 text-[11px] bg-gray-100 px-2 py-0.5 rounded text-gray-700">{durationBadge}</div>
      ) : null}
    </div>
  );
}

/* ---------- Main component ---------- */
export function AppointmentModal({ event, clinicianId, onClose, onUpdate }: AppointmentModalProps) {
  const [loading, setLoading] = useState(true);
  const [slotsByDay, setSlotsByDay] = useState<Record<string, Slot[]>>({});
  const [bookedByDay, setBookedByDay] = useState<Record<string, BookedAppt[]>>({});
  const [scheduleConfig, setScheduleConfig] = useState<any>(null);
  const [selectedSlotIso, setSelectedSlotIso] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  // duration control (minutes) — compact control: 15 / 30 / 60
  const STORAGE_KEY = `clinician:${clinicianId}:duration`;
  const [selectedDuration, setSelectedDuration] = useState<number>(() => {
    // initialize lazily from localStorage (guard for window)
    try {
      if (typeof window !== 'undefined') {
        const v = localStorage.getItem(STORAGE_KEY);
        const n = v ? parseInt(v, 10) : NaN;
        if (!isNaN(n) && (n === 15 || n === 30 || n === 60)) return n;
      }
    } catch (e) {
      // ignore
    }
    return 30;
  });

  // write preference to localStorage whenever it changes
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, String(selectedDuration));
      }
    } catch (e) {
      // ignore localStorage errors
    }
  }, [selectedDuration, STORAGE_KEY]);

  // drag overlay state
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragPreviewLabel, setDragPreviewLabel] = useState<string>('');

  // sensors for pointer + touch + keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // week start (Sunday-based)
  const eventDate = event.start ? dayjs(event.start) : dayjs();
  const weekStart = eventDate.startOf('week');
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day')), [weekStart]);

  /* ---------- load week: schedule, slots, bookings ---------- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const cfgRes = await fetch(`/api/settings/schedule`, { cache: 'no-store' });
        const cfgJson = cfgRes.ok ? await cfgRes.json() : null;
        if (mounted) setScheduleConfig(cfgJson || { bufferMinutes: 0, minAdvanceMinutes: 0, maxAdvanceDays: 365, template: {}, exceptions: [] });

        const startStr = weekStart.format('YYYY-MM-DD');
        const slotsRes = await fetch(`/api/schedule/slots/batch?start=${encodeURIComponent(startStr)}&days=7&clinicianId=${encodeURIComponent(clinicianId)}`, { cache: 'no-store' });
        const slotsJson = slotsRes.ok ? await slotsRes.json() : { slots: {} };
        if (mounted) setSlotsByDay(slotsJson.slots || {});

        const endStr = weekStart.add(6, 'day').format('YYYY-MM-DD');
        const apptsRes = await fetch(`/api/_proxy/appointments?clinicianId=${encodeURIComponent(clinicianId)}&start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`, { cache: 'no-store' });
        const apptsJson = apptsRes.ok ? await apptsRes.json() : [];
        const grouped: Record<string, BookedAppt[]> = {};
        (apptsJson || []).forEach((a: any) => {
          const d = dayjs(a.startsAt).format('YYYY-MM-DD');
          grouped[d] = grouped[d] || [];
          grouped[d].push({ id: a.id, patient: a.patient, startsAt: a.startsAt, endsAt: a.endsAt, status: a.status });
        });
        if (mounted) setBookedByDay(grouped);
      } catch (err) {
        console.error('modal load', err);
        toast.error('Failed to load modal data');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [clinicianId, weekStart]);

  /* ---------- helpers ---------- */
  const slotToIso = (day: dayjs.Dayjs, s: Slot) => {
    const startPart = s.start.includes('T') ? dayjs(s.start).format('HH:mm') : s.start;
    const endPart = s.end.includes('T') ? dayjs(s.end).format('HH:mm') : s.end;
    return {
      startIso: day.hour(Number(startPart.split(':')[0])).minute(Number(startPart.split(':')[1])).second(0).millisecond(0).toISOString(),
      endIso: day.hour(Number(endPart.split(':')[0])).minute(Number(endPart.split(':')[1])).second(0).millisecond(0).toISOString(),
    };
  };

  const isSlotDisabled = (slotIsoStart: string, slotIsoEnd: string) => {
    if (!scheduleConfig) return false;
    const slotStart = dayjs(slotIsoStart);
    const slotEnd = dayjs(slotIsoEnd);
    const today = dayjs();
    const dateKey = slotStart.format('YYYY-MM-DD');

    // exception/full-day blocked
    if ((scheduleConfig.exceptions || []).some((ex: any) => ex.date === dateKey)) return true;
    // min/max advance
    if (scheduleConfig.minAdvanceMinutes && slotStart.diff(today, 'minute') < scheduleConfig.minAdvanceMinutes) return true;
    if (scheduleConfig.maxAdvanceDays && slotStart.diff(today, 'day') > scheduleConfig.maxAdvanceDays) return true;
    // buffer
    const buffer = scheduleConfig.bufferMinutes || 0;
    if (buffer > 0) {
      const bookings = bookedByDay[dateKey] || [];
      for (const b of bookings) {
        if (b.id === event.id) continue;
        const bStart = dayjs(b.startsAt);
        const bEnd = dayjs(b.endsAt);
        const slotStartBuffered = slotStart.subtract(buffer, 'minute');
        const slotEndBuffered = slotEnd.add(buffer, 'minute');
        if (slotStartBuffered.isBefore(bEnd) && slotEndBuffered.isAfter(bStart)) return true;
      }
    }
    return false;
  };

  // find duration in minutes for an appointment id (if present in bookedByDay), else fallback to selectedDuration
  const getDurationForAppt = (apptId: string | null) => {
    if (!apptId) return selectedDuration;
    for (const day of Object.keys(bookedByDay || {})) {
      const a = (bookedByDay[day] || []).find((x) => x.id === apptId);
      if (a) {
        const mins = dayjs(a.endsAt).diff(dayjs(a.startsAt), 'minute');
        if (mins > 0) return mins;
      }
    }
    return selectedDuration;
  };

  const refreshWeek = async () => {
    try {
      const startStr = weekStart.format('YYYY-MM-DD');
      const slotsRes = await fetch(`/api/schedule/slots/batch?start=${encodeURIComponent(startStr)}&days=7&clinicianId=${encodeURIComponent(clinicianId)}`, { cache: 'no-store' });
      const slotsJson = slotsRes.ok ? await slotsRes.json() : { slots: {} };
      setSlotsByDay(slotsJson.slots || {});

      const endStr = weekStart.add(6, 'day').format('YYYY-MM-DD');
      const apptsRes = await fetch(`/api/_proxy/appointments?clinicianId=${encodeURIComponent(clinicianId)}&start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`, { cache: 'no-store' });
      const apptsJson = apptsRes.ok ? await apptsRes.json() : [];
      const grouped: Record<string, BookedAppt[]> = {};
      (apptsJson || []).forEach((a: any) => {
        const d = dayjs(a.startsAt).format('YYYY-MM-DD');
        grouped[d] = grouped[d] || [];
        grouped[d].push({ id: a.id, patient: a.patient, startsAt: a.startsAt, endsAt: a.endsAt, status: a.status });
      });
      setBookedByDay(grouped);
    } catch (err) {
      console.error('refreshWeek error', err);
    }
  };

  const fetchSuggestions = async (attemptedIso: string, limit = 8) => {
    setSuggestionsLoading(true);
    try {
      const attemptDay = dayjs(attemptedIso);
      const startSearch = attemptDay.subtract(3, 'day').format('YYYY-MM-DD');
      const days = 7;
      const res = await fetch(`/api/schedule/slots/batch?start=${encodeURIComponent(startSearch)}&days=${days}&clinicianId=${encodeURIComponent(clinicianId)}`, { cache: 'no-store' });
      const json = res.ok ? await res.json() : { slots: {} };
      const free: string[] = [];
      for (let i = 0; i < days; i++) {
        const d = dayjs(startSearch).add(i, 'day');
        const dKey = d.format('YYYY-MM-DD');
        const daySlots: Slot[] = json.slots?.[dKey] || [];
        for (const s of daySlots) {
          const { startIso, endIso } = slotToIso(d, s);
          if (!isSlotDisabled(startIso, endIso)) free.push(startIso);
          if (free.length >= limit) break;
        }
        if (free.length >= limit) break;
      }
      return free;
    } catch (err) {
      console.error('fetchSuggestions error', err);
      return [];
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const applySuggestion = async (appointmentId: string | null, suggestionIso: string) => {
    if (!appointmentId) return toast.error('No appointment id');
    setSubmitting(true);
    try {
      const duration = getDurationForAppt(appointmentId);
      const res = await fetch(`/api/_proxy/appointments/${encodeURIComponent(appointmentId)}/reschedule`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ startsAt: suggestionIso, endsAt: dayjs(suggestionIso).add(duration, 'minute').toISOString() }),
      });
      if (!res.ok) throw res;
      const patched = await res.json();
      onUpdate(patched);
      toast.success('Rescheduled to suggested slot');
      await refreshWeek();
      setSuggestions([]);
      setSuggestionOpen(false);
    } catch (err) {
      console.error('applySuggestion err', err);
      toast.error('Failed to apply suggestion');
      await refreshWeek();
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------- DnD handlers ---------- */
  // handle end of drag: active.id = 'appt:<id>' and over.id = slotIsoStart
  const handleDragEnd = async (e: DragEndEvent) => {
    const activeId = e.active?.id as string | undefined;
    const overId = e.over?.id as string | undefined;
    setActiveDragId(null);
    setDragPreviewLabel('');

    if (!activeId || !overId) return;

    const apptId = activeId.startsWith('appt:') ? activeId.replace('appt:', '') : activeId;
    const targetStartIso = overId;
    const targetDay = dayjs(targetStartIso).format('YYYY-MM-DD');
    const slot = (slotsByDay[targetDay] || []).find((s) => slotToIso(dayjs(targetDay), s).startIso === targetStartIso);
    // compute duration: prefer original appointment duration if present, otherwise use selectedDuration
    const duration = getDurationForAppt(apptId);
    const targetEndIso = slot ? slotToIso(dayjs(targetDay), slot).endIso : dayjs(targetStartIso).add(duration, 'minute').toISOString();

    if (isSlotDisabled(targetStartIso, targetEndIso)) {
      toast.error('Target slot is not allowed (buffer/exceptions/min-advance).');
      return;
    }

    // optimistic UI move
    setBookedByDay((prev) => {
      const copy: Record<string, BookedAppt[]> = JSON.parse(JSON.stringify(prev || {}));
      for (const k of Object.keys(copy)) {
        const idx = copy[k].findIndex((a) => a.id === apptId);
        if (idx !== -1) {
          copy[k].splice(idx, 1);
          break;
        }
      }
      const tKey = dayjs(targetStartIso).format('YYYY-MM-DD');
      copy[tKey] = copy[tKey] || [];
      copy[tKey].push({ id: apptId, patient: { name: '...' }, startsAt: targetStartIso, endsAt: targetEndIso, status: 'booked' });
      return copy;
    });

    // server call (use computed duration)
    toast.promise(
      (async () => {
        const res = await fetch(`/api/_proxy/appointments/${encodeURIComponent(apptId)}/reschedule`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ startsAt: targetStartIso, endsAt: targetEndIso }),
        });
        if (res.status === 409) {
          // conflict -> fetch suggestions and show modal
          const alt = await fetchSuggestions(targetStartIso);
          setSuggestions(alt);
          setSuggestionOpen(true);
          await refreshWeek();
          throw new Error('Conflict');
        }
        if (!res.ok) {
          await refreshWeek();
          throw new Error(`Reschedule failed ${res.status}`);
        }
        const patched = await res.json();
        onUpdate(patched);
        return patched;
      })(),
      { loading: 'Rescheduling…', success: 'Rescheduled', error: 'Reschedule failed' }
    ).catch(() => {});
  };

  const handleDragOver = (e: DragOverEvent) => {
    // reserved for future drop highlight state if needed
  };

  const onDragStart = (id: string, label?: string) => {
    setActiveDragId(id);
    setDragPreviewLabel(label || 'Moving appointment');
  };

  /* ---------- Create / Block actions ---------- */
  const handleCreate = async () => {
    if (!selectedSlotIso) return toast.error('Select a slot first');
    const duration = selectedDuration;
    if (isSlotDisabled(selectedSlotIso, dayjs(selectedSlotIso).add(duration, 'minute').toISOString())) {
      return toast.error('Selected slot is not available');
    }
    setSubmitting(true);
    try {
      const startIso = selectedSlotIso;
      const endIso = dayjs(startIso).add(duration, 'minute').toISOString();
      const res = await fetch(`/api/_proxy/appointments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clinicianId,
          patientId: event.extendedProps?.patientId || null,
          startsAt: startIso,
          endsAt: endIso,
        }),
      });
      if (!res.ok) throw res;
      const created = await res.json();
      const dayKey = dayjs(startIso).format('YYYY-MM-DD');
      setBookedByDay((prev) => ({ ...(prev || {}), [dayKey]: [...(prev[dayKey] || []), { id: created.id, patient: created.patient, startsAt: created.startsAt, endsAt: created.endsAt, status: created.status }] }));
      onUpdate(created);
      toast.success('Appointment created');
      onClose();
    } catch (err) {
      console.error('create error', err);
      toast.error('Failed to create appointment — slot may have been taken');
      await refreshWeek();
    } finally {
      setSubmitting(false);
    }
  };

  const toggleBlockDay = async (dateStr: string, currentlyBlocked: boolean) => {
    try {
      if (currentlyBlocked) {
        const res = await fetch(`/api/schedule/block`, {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ clinicianId, date: dateStr }),
        });
        if (!res.ok) throw res;
      } else {
        const res = await fetch(`/api/schedule/block`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ clinicianId, date: dateStr, reason: 'Blocked by clinician' }),
        });
        if (!res.ok) throw res;
      }
      await refreshWeek();
      const cfgRes = await fetch(`/api/settings/schedule`, { cache: 'no-store' });
      const cfgJson = cfgRes.ok ? await cfgRes.json() : null;
      setScheduleConfig(cfgJson || scheduleConfig);
      toast.success(currentlyBlocked ? `Unblocked ${dateStr}` : `Blocked ${dateStr}`);
    } catch (err) {
      console.error('toggle block error', err);
      toast.error('Failed to update block');
    }
  };

  // Escape to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  /* ---------- Render ---------- */
  return (
    <>
      <SuggestionModal open={suggestionOpen} onClose={() => setSuggestionOpen(false)} suggestions={suggestions} onApply={(iso) => applySuggestion(null, iso)} loading={suggestionsLoading} />
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl p-4">
          <header className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-semibold">{event.title || 'Manage Week'}</h3>
              <div className="text-sm text-gray-500">Week of {weekStart.format('YYYY-MM-DD')}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="px-3 py-1 border rounded">Close</button>
            </div>
          </header>

          {loading ? (
            <div className="py-8 text-center">Loading…</div>
          ) : (
            <>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} onDragOver={handleDragOver}>
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {weekDays.map((d) => {
                    const dateKey = d.format('YYYY-MM-DD');
                    const slots = slotsByDay[dateKey] || [];
                    const booked = bookedByDay[dateKey] || [];
                    const isBlocked = (scheduleConfig?.exceptions || []).some((ex: any) => ex.date === dateKey);

                    return (
                      <div key={dateKey} className="border rounded p-2 flex flex-col gap-2 bg-white">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold">{d.format('ddd DD')}</div>
                          <div className="text-xs">
                            <button
                              onClick={() => toggleBlockDay(dateKey, isBlocked)}
                              className={`text-xs px-2 py-0.5 rounded ${isBlocked ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-100 text-gray-700'}`}
                              aria-pressed={isBlocked}
                            >
                              {isBlocked ? 'Unblock' : 'Block'}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          {slots.length === 0 && <div className="text-[11px] text-gray-400">No slots</div>}

                          {slots.map((s) => {
                            const { startIso, endIso } = slotToIso(d, s);
                            const taken = (booked || []).some((b) => dayjs(b.startsAt).format('HH:mm') === dayjs(startIso).format('HH:mm'));
                            const disabled = isSlotDisabled(startIso, endIso);
                            const selected = selectedSlotIso === startIso;

                            return (
                              <DroppableSlot key={s.start + s.end} id={startIso}>
                                <div
                                  className={`flex items-center justify-between gap-2 px-2 py-1 rounded border transition-colors
                                    ${taken ? 'bg-red-50 text-red-800' : disabled ? 'bg-gray-50 text-gray-400' : selected ? 'bg-indigo-600 text-white' : 'bg-green-50 text-green-800 hover:bg-green-100'}`}
                                >
                                  <div className="text-xs">{dayjs(startIso).format('HH:mm')}</div>
                                  <div className="flex items-center gap-2">
                                    {taken ? (
                                      <div className="text-[11px] px-2 py-0.5 rounded bg-red-100">Booked</div>
                                    ) : (
                                      <button onClick={() => setSelectedSlotIso(startIso)} disabled={disabled} className="text-[11px] px-2 py-0.5 rounded">
                                        {selected ? 'Selected' : 'Pick'}
                                      </button>
                                    )}
                                    <div className="text-[10px] text-gray-400">drop</div>
                                  </div>
                                </div>
                              </DroppableSlot>
                            );
                          })}
                        </div>

                        <div className="mt-2 border-t pt-2 space-y-2">
                          <SortableContext items={(booked || []).map((b) => `appt:${b.id}`)} strategy={verticalListSortingStrategy}>
                            {(booked || []).map((b) => (
                              <SortableAppt key={b.id} appt={b} onDragStart={onDragStart} />
                            ))}
                          </SortableContext>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <DragOverlay>
                  {activeDragId ? (
                    <div className="bg-white shadow-md rounded px-3 py-2 border">
                      <div className="font-medium">{dragPreviewLabel || 'Moving'}</div>
                      <div className="text-xs text-gray-500">Drop to reschedule</div>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>

              {suggestions.length > 0 && (
                <div className="mb-3 p-3 border rounded bg-yellow-50">
                  <div className="text-sm font-medium mb-2">Suggested alternative slots after conflict</div>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <button key={s} onClick={() => applySuggestion(null, s)} className="px-2 py-1 rounded bg-indigo-600 text-white text-sm">
                        {dayjs(s).format('ddd DD MMM HH:mm')}
                      </button>
                    ))}
                    <button onClick={() => setSuggestionOpen(true)} className="px-2 py-1 rounded border text-sm">
                      Open suggestions modal
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-gray-600">
                  <div>
                    Buffer: <strong>{scheduleConfig?.bufferMinutes ?? 0}m</strong>
                  </div>
                  <div>
                    Min advance: <strong>{scheduleConfig?.minAdvanceMinutes ?? 0}m</strong>
                  </div>
                  <div>
                    Max advance: <strong>{scheduleConfig?.maxAdvanceDays ?? 365}d</strong>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Duration selector (compact) */}
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-gray-600 mr-1">Duration</div>
                    {[15, 30, 60].map((m) => (
                      <button
                        key={m}
                        onClick={() => setSelectedDuration(m)}
                        className={`px-2 py-1 text-xs rounded ${selectedDuration === m ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                        aria-pressed={selectedDuration === m}
                        title={`${m} minutes`}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button onClick={onClose} className="px-3 py-1 border rounded">
                      Cancel
                    </button>
                    <button onClick={handleCreate} disabled={!selectedSlotIso || submitting} className="px-3 py-1 rounded bg-indigo-600 text-white disabled:opacity-50">
                      {submitting ? 'Booking…' : 'Create appointment'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
