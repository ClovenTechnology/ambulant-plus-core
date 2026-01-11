//apps/admin-dashboard/app/admin/calendar/training/TrainingCalendarClient.tsx
'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';

type Row = {
  clinicianId: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  specialty?: string | null;
  createdAt: string;
  onboarding: { id: string; stage: string; notes?: string | null };

  trainingSlot?: {
    id: string;
    startAt: string;
    endAt: string;
    mode: 'virtual' | 'in_person';
    status: 'scheduled' | 'completed' | 'canceled';
    joinUrl?: string | null;
  } | null;
};

type EventItem = {
  key: string;
  clinicianId: string;
  onboardingId: string;
  trainingSlotId?: string | null;
  title: string;
  startAt: string;
  endAt: string;
  mode: 'virtual' | 'in_person';
  status: 'scheduled' | 'completed' | 'canceled';
  joinUrl?: string | null;
};

function safeDate(s?: string | null) {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function ymd(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toLocalInputValue(iso?: string | null) {
  const d = safeDate(iso);
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(v: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/* ---------- Modal ---------- */
function Modal({
  title,
  open,
  onClose,
  children,
  footer,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-xl rounded-2xl border bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-gray-900">{title}</div>
            <div className="mt-0.5 text-[11px] text-gray-500">
              Inputs are local time. Saved as ISO (UTC).
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50"
          >
            Close
          </button>
        </div>
        <div className="px-4 py-3">{children}</div>
        {footer ? <div className="border-t px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <div className="text-[11px] font-semibold text-gray-700">{label}</div>
      {children}
      {hint ? <div className="text-[11px] text-gray-500">{hint}</div> : null}
    </label>
  );
}

async function post(url: string, body: any) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => `HTTP_${res.status}`));
  return res.json().catch(() => ({}));
}

export default function TrainingCalendarClient({
  rows,
  focusClinicianId,
}: {
  rows: Row[];
  focusClinicianId?: string;
}) {
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  // Month cursor
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Selected day in agenda
  const [selectedDay, setSelectedDay] = useState(() => ymd(new Date()));

  // schedule modal
  const [schedOpen, setSchedOpen] = useState(false);
  const [schedClinicianId, setSchedClinicianId] = useState('');
  const [schedOnboardingId, setSchedOnboardingId] = useState('');
  const [schedMode, setSchedMode] = useState<'virtual' | 'in_person'>('virtual');
  const [schedStartLocal, setSchedStartLocal] = useState('');
  const [schedEndLocal, setSchedEndLocal] = useState('');
  const [schedDurationMin, setSchedDurationMin] = useState(60);
  const [schedJoinUrl, setSchedJoinUrl] = useState('');

  // event detail modal
  const [evOpen, setEvOpen] = useState(false);
  const [activeEv, setActiveEv] = useState<EventItem | null>(null);

  // auto-focus from query param
  useEffect(() => {
    if (!focusClinicianId) return;
    const r = rows.find((x) => x.clinicianId === focusClinicianId);
    if (!r) return;

    // open their training day if it exists
    const t = r.trainingSlot;
    if (t?.startAt) {
      const d = safeDate(t.startAt);
      if (d) {
        setSelectedDay(ymd(d));
        setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
      }
    }

    // prefill schedule modal selection
    setSchedClinicianId(r.clinicianId);
    setSchedOnboardingId(r.onboarding.id);
  }, [focusClinicianId, rows]);

  const events = useMemo<EventItem[]>(() => {
    return rows
      .filter((r) => !!r.trainingSlot)
      .map((r) => {
        const t = r.trainingSlot!;
        return {
          key: `ts:${t.id}`,
          clinicianId: r.clinicianId,
          onboardingId: r.onboarding.id,
          trainingSlotId: t.id,
          title: `${r.displayName}${r.specialty ? ` — ${r.specialty}` : ''}`,
          startAt: t.startAt,
          endAt: t.endAt,
          mode: t.mode,
          status: t.status,
          joinUrl: t.joinUrl ?? null,
        };
      })
      .filter((e) => !!safeDate(e.startAt) && !!safeDate(e.endAt));
  }, [rows]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const ev of events) {
      const d = safeDate(ev.startAt);
      if (!d) continue;
      const k = ymd(d);
      const arr = map.get(k) ?? [];
      arr.push(ev);
      map.set(k, arr);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
      map.set(k, arr);
    }
    return map;
  }, [events]);

  const agenda = eventsByDay.get(selectedDay) ?? [];

  // month grid (6 weeks)
  const gridDays = useMemo(() => {
    const start = new Date(cursor);
    const firstDow = start.getDay(); // 0 Sun
    const gridStart = new Date(start);
    gridStart.setDate(start.getDate() - firstDow);

    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      days.push(d);
    }
    return days;
  }, [cursor]);

  const monthLabel = useMemo(() => {
    return cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  }, [cursor]);

  const cliniciansOptions = useMemo(() => {
    const opts = rows.map((r) => ({
      clinicianId: r.clinicianId,
      onboardingId: r.onboarding.id,
      label: `${r.displayName}${r.specialty ? ` — ${r.specialty}` : ''}`,
    }));
    opts.sort((a, b) => a.label.localeCompare(b.label));
    return opts;
  }, [rows]);

  const openSchedule = useCallback(
    (dayYmd?: string) => {
      setNotice(null);
      const d = dayYmd ? new Date(`${dayYmd}T09:00`) : new Date();
      setSchedStartLocal(toLocalInputValue(d.toISOString()));
      setSchedEndLocal('');
      setSchedDurationMin(60);
      setSchedMode('virtual');
      setSchedJoinUrl('');

      // If clinician not selected yet, pick first as default (safe)
      if (!schedClinicianId && cliniciansOptions[0]) {
        setSchedClinicianId(cliniciansOptions[0].clinicianId);
        setSchedOnboardingId(cliniciansOptions[0].onboardingId);
      }

      setSchedOpen(true);
    },
    [cliniciansOptions, schedClinicianId]
  );

  const saveSchedule = useCallback(async () => {
    setNotice(null);

    if (!schedClinicianId || !schedOnboardingId) {
      setNotice({ tone: 'err', text: 'Select a clinician.' });
      return;
    }

    const startIso = localInputToIso(schedStartLocal);
    if (!startIso) {
      setNotice({ tone: 'err', text: 'Start datetime is required.' });
      return;
    }

    let endIso: string | null = null;
    if (schedEndLocal?.trim()) {
      endIso = localInputToIso(schedEndLocal);
      if (!endIso) {
        setNotice({ tone: 'err', text: 'End datetime is invalid.' });
        return;
      }
    } else {
      const startD = new Date(schedStartLocal);
      const endD = new Date(startD.getTime() + Math.max(5, schedDurationMin) * 60_000);
      endIso = endD.toISOString();
    }

    if (schedMode === 'virtual' && !schedJoinUrl.trim()) {
      setNotice({ tone: 'err', text: 'Join URL is required for virtual training.' });
      return;
    }

    try {
      await post('/api/admin/clinicians/onboarding/schedule-training', {
        clinicianId: schedClinicianId,
        onboardingId: schedOnboardingId,
        startAt: startIso,
        endAt: endIso,
        mode: schedMode,
        joinUrl: schedJoinUrl.trim() ? schedJoinUrl.trim() : null,
      });

      // reflect immediately in UI by reloading (simple + reliable)
      window.location.reload();
    } catch (e: any) {
      setNotice({ tone: 'err', text: e?.message || 'Failed to schedule training.' });
    }
  }, [
    schedClinicianId,
    schedOnboardingId,
    schedDurationMin,
    schedEndLocal,
    schedJoinUrl,
    schedMode,
    schedStartLocal,
  ]);

  const openEvent = useCallback((ev: EventItem) => {
    setNotice(null);
    setActiveEv(ev);
    setEvOpen(true);
  }, []);

  const markComplete = useCallback(async () => {
    if (!activeEv?.trainingSlotId) return;
    if (!confirm(`Mark completed: ${activeEv.title}?`)) return;

    try {
      await post('/api/admin/clinicians/onboarding/mark-training-complete', {
        clinicianId: activeEv.clinicianId,
        onboardingId: activeEv.onboardingId,
        trainingSlotId: activeEv.trainingSlotId,
      });
      window.location.reload();
    } catch (e: any) {
      setNotice({ tone: 'err', text: e?.message || 'Failed to mark complete.' });
    }
  }, [activeEv]);

  const cancelTraining = useCallback(async () => {
    if (!activeEv?.trainingSlotId) return;
    if (!confirm(`Cancel training slot: ${activeEv.title}?`)) return;

    try {
      await post('/api/admin/clinicians/onboarding/cancel-training', {
        clinicianId: activeEv.clinicianId,
        onboardingId: activeEv.onboardingId,
        trainingSlotId: activeEv.trainingSlotId,
      });
      window.location.reload();
    } catch (e: any) {
      setNotice({ tone: 'err', text: e?.message || 'Failed to cancel training.' });
    }
  }, [activeEv]);

  const goPrevMonth = () => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const goNextMonth = () => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday = () => {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDay(ymd(now));
  };

  return (
    <section className="space-y-4">
      {notice && (
        <div
          className={[
            'rounded border p-3 text-xs',
            notice.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900',
          ].join(' ')}
        >
          {notice.text}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button onClick={goPrevMonth} className="rounded border bg-white px-3 py-1.5 text-xs hover:bg-gray-50">
            Prev
          </button>
          <button onClick={goToday} className="rounded border bg-white px-3 py-1.5 text-xs hover:bg-gray-50">
            Today
          </button>
          <button onClick={goNextMonth} className="rounded border bg-white px-3 py-1.5 text-xs hover:bg-gray-50">
            Next
          </button>
          <div className="ml-2 text-sm font-semibold text-gray-900">{monthLabel}</div>
        </div>

        <button
          onClick={() => openSchedule(selectedDay)}
          className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white hover:bg-black/90"
        >
          Schedule training
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Month grid */}
        <div className="rounded-2xl border bg-white p-3 lg:col-span-2">
          <div className="grid grid-cols-7 gap-1 text-[11px] text-gray-500">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="px-2 py-1 font-semibold">
                {d}
              </div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {gridDays.map((d) => {
              const inMonth = d.getMonth() === cursor.getMonth();
              const k = ymd(d);
              const count = (eventsByDay.get(k) ?? []).length;
              const isSelected = k === selectedDay;
              const isToday = k === ymd(new Date());

              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSelectedDay(k)}
                  className={[
                    'h-20 rounded-xl border px-2 py-2 text-left transition',
                    inMonth ? 'bg-white' : 'bg-gray-50 text-gray-400',
                    isSelected ? 'border-black ring-1 ring-black/10' : 'border-gray-200 hover:bg-gray-50',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between">
                    <div className={['text-xs font-semibold', isToday ? 'text-blue-700' : 'text-gray-800'].join(' ')}>
                      {d.getDate()}
                    </div>
                    {count > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        {count}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2 space-y-1">
                    {(eventsByDay.get(k) ?? []).slice(0, 2).map((ev) => (
                      <div
                        key={ev.key}
                        className={[
                          'truncate rounded-lg border px-2 py-0.5 text-[10px]',
                          ev.status === 'completed'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : ev.status === 'canceled'
                            ? 'border-rose-200 bg-rose-50 text-rose-800'
                            : 'border-amber-200 bg-amber-50 text-amber-800',
                        ].join(' ')}
                      >
                        {new Date(ev.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                        {ev.title}
                      </div>
                    ))}
                    {count > 2 ? <div className="text-[10px] text-gray-400">+{count - 2} more</div> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Day agenda */}
        <aside className="rounded-2xl border bg-white p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">
              Agenda — {selectedDay}
            </div>
            <button
              onClick={() => openSchedule(selectedDay)}
              className="rounded border bg-white px-2 py-1 text-[11px] hover:bg-gray-50"
            >
              + Add
            </button>
          </div>

          <div className="mt-2 text-[11px] text-gray-500">
            {agenda.length} training slot(s)
          </div>

          <div className="mt-3 space-y-2">
            {agenda.length === 0 ? (
              <div className="rounded-lg border bg-gray-50 p-3 text-xs text-gray-600">
                No trainings scheduled for this day.
              </div>
            ) : (
              agenda.map((ev) => (
                <button
                  key={ev.key}
                  onClick={() => openEvent(ev)}
                  className="w-full rounded-xl border bg-white p-3 text-left hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-gray-900">{ev.title}</div>
                      <div className="mt-1 text-[11px] text-gray-600">
                        {new Date(ev.startAt).toLocaleString()} →{' '}
                        {new Date(ev.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="mt-1 text-[11px] text-gray-500">
                        {ev.mode === 'virtual' ? 'Virtual' : 'In person'} • {ev.status}
                      </div>
                    </div>
                    <span
                      className={[
                        'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                        ev.status === 'completed'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : ev.status === 'canceled'
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : 'border-amber-200 bg-amber-50 text-amber-700',
                      ].join(' ')}
                    >
                      {ev.status}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>
      </div>

      {/* Schedule modal */}
      <Modal
        title="Schedule training"
        open={schedOpen}
        onClose={() => setSchedOpen(false)}
        footer={
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] text-gray-500">Leave End blank to auto-calc from Duration.</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSchedOpen(false)}
                className="rounded-lg border bg-white px-3 py-1.5 text-xs hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveSchedule}
                className="rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/90"
              >
                Save
              </button>
            </div>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Clinician">
            <select
              value={schedClinicianId}
              onChange={(e) => {
                const id = e.target.value;
                const opt = cliniciansOptions.find((x) => x.clinicianId === id);
                setSchedClinicianId(id);
                setSchedOnboardingId(opt?.onboardingId ?? '');
              }}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
            >
              <option value="" disabled>
                Select…
              </option>
              {cliniciansOptions.map((o) => (
                <option key={o.clinicianId} value={o.clinicianId}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Mode">
            <select
              value={schedMode}
              onChange={(e) => setSchedMode(e.target.value as any)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
            >
              <option value="virtual">Virtual</option>
              <option value="in_person">In person</option>
            </select>
          </Field>

          <Field label="Start (local time)">
            <input
              type="datetime-local"
              value={schedStartLocal}
              onChange={(e) => setSchedStartLocal(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
          </Field>

          <Field label="End (local time)" hint="Optional">
            <input
              type="datetime-local"
              value={schedEndLocal}
              onChange={(e) => setSchedEndLocal(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
          </Field>

          <Field label="Duration (minutes)" hint="Used only when End is blank">
            <input
              type="number"
              value={schedDurationMin}
              min={15}
              step={5}
              onChange={(e) => setSchedDurationMin(Number(e.target.value || 60))}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Join URL (required for virtual)">
              <input
                value={schedJoinUrl}
                onChange={(e) => setSchedJoinUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
              />
            </Field>
          </div>
        </div>
      </Modal>

      {/* Event detail modal */}
      <Modal
        title={activeEv ? activeEv.title : 'Training slot'}
        open={evOpen}
        onClose={() => setEvOpen(false)}
        footer={
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={cancelTraining}
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
            >
              Cancel slot
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEvOpen(false)}
                className="rounded-lg border bg-white px-3 py-1.5 text-xs hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={markComplete}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Mark completed
              </button>
            </div>
          </div>
        }
      >
        {activeEv ? (
          <div className="space-y-2 text-sm">
            <div className="rounded-lg border bg-slate-50 p-3">
              <div className="text-xs text-gray-600">Time</div>
              <div className="mt-1 font-semibold text-gray-900">
                {new Date(activeEv.startAt).toLocaleString()} →{' '}
                {new Date(activeEv.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="mt-1 text-xs text-gray-600">
                {activeEv.mode === 'virtual' ? 'Virtual' : 'In person'} • {activeEv.status}
              </div>
            </div>

            {activeEv.joinUrl ? (
              <div className="rounded-lg border bg-white p-3">
                <div className="text-xs text-gray-600">Join URL</div>
                <div className="mt-1 break-all text-sm text-blue-700">{activeEv.joinUrl}</div>
              </div>
            ) : null}

            <div className="rounded-lg border bg-white p-3 text-xs text-gray-600">
              Clinician ID: <span className="font-mono">{activeEv.clinicianId}</span>
              <br />
              Slot ID: <span className="font-mono">{activeEv.trainingSlotId}</span>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
