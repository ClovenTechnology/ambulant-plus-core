//apps/admin-dashboard/app/admin/calendar/training/TrainingCalendarClient.tsx
'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import TrainingParticipationPanel from './TrainingParticipationPanel';
import TrainingContentManager from '../../training/TrainingContentManager';

type Row = {
  clinicianId: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  specialty?: string | null;
  createdAt: string;
  trainingCompleted?: boolean | null;
  onboarding: { id: string; stage: string; notes?: string | null };

  trainingSlot?: {
    id: string;
    title?: string | null;
    summary?: string | null;
    timezone?: string | null;
    trainerName?: string | null;
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
  summary?: string | null;
  timezone?: string | null;
  trainerName?: string | null;
  startAt: string;
  endAt: string;
  mode: 'virtual' | 'in_person';
  status: 'scheduled' | 'completed' | 'canceled';
  joinUrl?: string | null;
  participantCount?: number;
  participantLabels?: string[];
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

function trainingRoomIdForSlot(slotId?: string | null) {
  const clean = String(slotId || '').trim();
  if (!clean) return '';
  return clean.startsWith('training-slot-') ? clean : `training-slot-${clean}`;
}

function adminTrainingRoomPath(slotId?: string | null, role: 'admin' | 'trainer' | 'observer' = 'admin') {
  const roomId = trainingRoomIdForSlot(slotId);
  if (!roomId || !slotId) return '#';
  return `/admin/clinicians/training/room/${encodeURIComponent(roomId)}?trainingSlotId=${encodeURIComponent(slotId)}&role=${encodeURIComponent(role)}`;
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
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border bg-white shadow-xl">
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
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
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

function isTrainingComplete(row: Row) {
  return (
    row.trainingCompleted === true ||
    String(row.onboarding?.stage || '').toLowerCase() === 'training_completed'
  );
}

function trainingSelectionMeta(row: Row) {
  const stage = String(row.onboarding?.stage || '').toLowerCase();

  if (isTrainingComplete(row)) {
    return {
      disabled: true,
      badge: 'Training complete - invite only',
      badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    };
  }

  if (stage === 'rejected') {
    return {
      disabled: true,
      badge: 'Rejected',
      badgeClass: 'border-rose-200 bg-rose-50 text-rose-800',
    };
  }

  if (stage === 'training_scheduled') {
    return {
      disabled: false,
      badge: 'Training scheduled - can reassign',
      badgeClass: 'border-amber-200 bg-amber-50 text-amber-800',
    };
  }

  return {
    disabled: false,
    badge: 'Training required',
    badgeClass: 'border-blue-200 bg-blue-50 text-blue-800',
  };
}

function friendlyTrainingError(value: unknown) {
  const raw = String(value || '').trim();
  const code = (() => {
    try {
      const parsed = JSON.parse(raw);
      return String(parsed?.error || raw).trim();
    } catch {
      return raw;
    }
  })();

  if (code === 'completed_clinician_requires_training_invitation') {
    return 'This clinician has already completed mandatory training. Use the session participant controls to send an optional additional-training invitation instead.';
  }

  if (code === 'cannot_schedule_training_for_rejected_onboarding') {
    return 'A rejected onboarding record cannot be scheduled for mandatory training.';
  }

  return code.replace(/_/g, ' ') || 'Unable to complete the training action.';
}

async function post(url: string, body: any) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text().catch(() => '');
  let payload: any = {};

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { ok: false, error: text };
    }
  }

  if (!res.ok || payload?.ok === false) {
    throw new Error(
      friendlyTrainingError(
        payload?.error || text || `HTTP_${res.status}`,
      ),
    );
  }

  return payload;
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
  const [schedTitle, setSchedTitle] = useState('');
  const [schedSummary, setSchedSummary] = useState('');
  const [schedTrainerName, setSchedTrainerName] = useState('');
  const [schedClinicianId, setSchedClinicianId] = useState('');
  const [schedOnboardingId, setSchedOnboardingId] = useState('');
  const [schedMode, setSchedMode] = useState<'virtual' | 'in_person'>('virtual');
  const [schedStartLocal, setSchedStartLocal] = useState('');
  const [schedEndLocal, setSchedEndLocal] = useState('');
  const [schedDurationMin, setSchedDurationMin] = useState(60);
  const [schedJoinUrl, setSchedJoinUrl] = useState('');
  const [schedSelectedClinicianIds, setSchedSelectedClinicianIds] = useState<string[]>([]);

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
    const bySlot = new Map<string, EventItem>();

    for (const r of rows) {
      if (!r.trainingSlot) continue;

      const t = r.trainingSlot;
      const key = `ts:${t.id}`;
      const programmeTitle =
        String(t.title || '').trim() ||
        'Mandatory Clinician Training';
      const label = `${r.displayName}${r.specialty ? ` — ${r.specialty}` : ''}`;

      const existing = bySlot.get(key);
      if (existing) {
        existing.participantCount = (existing.participantCount || 1) + 1;
        existing.participantLabels = [...(existing.participantLabels || []), label];
        existing.title = programmeTitle;
        if (!existing.summary && t.summary) existing.summary = t.summary;
        if (!existing.trainerName && t.trainerName) {
          existing.trainerName = t.trainerName;
        }
        if (!existing.timezone && t.timezone) existing.timezone = t.timezone;
        if (!existing.joinUrl && t.joinUrl) existing.joinUrl = t.joinUrl;
        continue;
      }

      bySlot.set(key, {
        key,
        clinicianId: r.clinicianId,
        onboardingId: r.onboarding.id,
        trainingSlotId: t.id,
        title: programmeTitle,
        summary: t.summary ?? null,
        timezone: t.timezone ?? null,
        trainerName: t.trainerName ?? null,
        startAt: t.startAt,
        endAt: t.endAt,
        mode: t.mode,
        status: t.status,
        joinUrl: t.joinUrl ?? null,
        participantCount: 1,
        participantLabels: [label],
      });
    }

    return Array.from(bySlot.values()).filter((e) => !!safeDate(e.startAt) && !!safeDate(e.endAt));
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
    Array.from(map.entries()).forEach(([k, arr]) => {
      arr.sort(
        (a, b) =>
          new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      );
      map.set(k, arr);
    });
    return map;
  }, [events]);

  const agenda = eventsByDay.get(selectedDay) ?? [];

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const slotId =
      String(
        window.sessionStorage.getItem(
          'ambulant-training-open-slot',
        ) || '',
      ).trim();

    if (!slotId) return;

    const event =
      events.find(
        (candidate) =>
          String(candidate.trainingSlotId || '') === slotId,
      );

    if (!event) return;

    window.sessionStorage.removeItem(
      'ambulant-training-open-slot',
    );

    const start = safeDate(event.startAt);
    if (start) {
      setSelectedDay(ymd(start));
      setCursor(
        new Date(
          start.getFullYear(),
          start.getMonth(),
          1,
        ),
      );
    }

    setActiveEv(event);
    setEvOpen(true);
  }, [events]);

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
    const opts = rows.map((r) => {
      const selection = trainingSelectionMeta(r);

      return {
        clinicianId: r.clinicianId,
        onboardingId: r.onboarding.id,
        label: `${r.displayName}${r.specialty ? ` — ${r.specialty}` : ''}`,
        disabled: selection.disabled,
        badge: selection.badge,
        badgeClass: selection.badgeClass,
      };
    });

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
      setSchedTitle('');
      setSchedSummary('');
      setSchedTrainerName('');

      const firstEligible =
        cliniciansOptions.find((option) => !option.disabled);

      if (!schedSelectedClinicianIds.length && firstEligible) {
        setSchedSelectedClinicianIds([firstEligible.clinicianId]);
        setSchedClinicianId(firstEligible.clinicianId);
        setSchedOnboardingId(firstEligible.onboardingId);
      }

      setSchedOpen(true);
    },
    [cliniciansOptions, schedSelectedClinicianIds.length]
  );

  const saveSchedule = useCallback(async () => {
    setNotice(null);

    const selectedClinicians = cliniciansOptions.filter(
      (x) =>
        !x.disabled &&
        schedSelectedClinicianIds.includes(x.clinicianId),
    );

    if (!schedTitle.trim()) {
      setNotice({
        tone: 'err',
        text: 'Training title / topic is required.',
      });
      return;
    }

    if (!selectedClinicians.length) {
      setNotice({ tone: 'err', text: 'Select at least one clinician.' });
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
try {
      const created = await post(
        '/api/admin/clinicians/onboarding/schedule-training',
        {
          clinicians: selectedClinicians.map((x) => ({
            clinicianId: x.clinicianId,
            onboardingId: x.onboardingId,
          })),
          clinicianId: selectedClinicians[0]?.clinicianId,
          onboardingId: selectedClinicians[0]?.onboardingId,
          title: schedTitle.trim(),
          summary: schedSummary.trim() || null,
          trainerName: schedTrainerName.trim() || null,
          startAt: startIso,
          endAt: endIso,
          mode: schedMode,
          joinUrl: null,
        },
      );

      const createdSlotId =
        String(created?.trainingSlot?.id || '').trim();

      if (createdSlotId) {
        window.sessionStorage.setItem(
          'ambulant-training-open-slot',
          createdSlotId,
        );
      }

      window.location.reload();
    } catch (e: any) {
      setNotice({ tone: 'err', text: e?.message || 'Failed to schedule training.' });
    }
  }, [
    cliniciansOptions,
    schedSelectedClinicianIds,
    schedDurationMin,
    schedEndLocal,
    schedJoinUrl,
    schedMode,
    schedStartLocal,
    schedTitle,
    schedSummary,
    schedTrainerName,
  ]);

  const openEvent = useCallback((ev: EventItem) => {
    setNotice(null);
    setActiveEv(ev);
    setEvOpen(true);
  }, []);

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
          <div className="sm:col-span-2">
            <div className="text-[11px] font-semibold text-gray-700">Clinicians</div>
            <div className="mt-1 max-h-56 space-y-1 overflow-auto rounded-xl border bg-white p-2">
              {cliniciansOptions.map((o) => {
                const checked = schedSelectedClinicianIds.includes(o.clinicianId);
                return (
                  <label
                    key={o.clinicianId}
                    className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={o.disabled}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? Array.from(new Set([...schedSelectedClinicianIds, o.clinicianId]))
                          : schedSelectedClinicianIds.filter((id) => id !== o.clinicianId);

                        setSchedSelectedClinicianIds(next);

                        const first = cliniciansOptions.find((x) => x.clinicianId === next[0]);
                        setSchedClinicianId(first?.clinicianId ?? '');
                        setSchedOnboardingId(first?.onboardingId ?? '');
                      }}
                      className="mt-0.5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{o.label}</span>
                      <span
                        className={[
                          'mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                          o.badgeClass,
                        ].join(' ')}
                      >
                        {o.badge}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="mt-1 space-y-1 text-[11px] text-gray-500">
              <div>
                Selected: {schedSelectedClinicianIds.length}. All selected mandatory trainees will share one training room.
              </div>
              <div>
                Clinicians marked "Training complete - invite only" remain visible for clarity but cannot be added through mandatory scheduling. Invite them from an existing session's participant controls.
              </div>
            </div>
          </div>

          <div className="sm:col-span-2">
            <Field label="Training title / topic">
              <input
                type="text"
                value={schedTitle}
                onChange={(e) => setSchedTitle(e.target.value)}
                placeholder="e.g. Contactless Medicine - Platform Orientation"
                maxLength={240}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field
              label="Summary / description"
              hint="Optional - shown to invited participants and observers."
            >
              <textarea
                value={schedSummary}
                onChange={(e) => setSchedSummary(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
              />
            </Field>
          </div>

          <Field label="Trainer / facilitator" hint="Optional">
            <input
              type="text"
              value={schedTrainerName}
              onChange={(e) => setSchedTrainerName(e.target.value)}
              maxLength={240}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
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
            <div className="space-y-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                Virtual training links are generated automatically when you save. No manual Join URL is required.
              </div>
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                Next step: after you create the session, this exact session reopens automatically so you can assign reusable modules and training materials. Materials remain optional for room admission.
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Event detail modal */}
      <Modal
        title={activeEv ? activeEv.title : 'Training slot'}
        open={evOpen}
        onClose={() => setEvOpen(false)}
        footer={
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setEvOpen(false)}
              className="rounded-lg border bg-white px-3 py-1.5 text-xs hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        }
      >
        {activeEv ? (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border bg-slate-50 p-3">
              <div className="text-xs text-gray-600">Time</div>
              <div className="mt-1 font-semibold text-gray-900">
                {new Date(activeEv.startAt).toLocaleString()} →{' '}
                {new Date(activeEv.endAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
              <div className="mt-1 text-xs text-gray-600">
                {activeEv.mode === 'virtual' ? 'Virtual' : 'In person'} •{' '}
                {activeEv.status}
              </div>
            </div>

            {(activeEv.summary || activeEv.trainerName) ? (
              <div className="rounded-lg border bg-white p-3">
                <div className="text-xs font-semibold text-gray-700">
                  Session details
                </div>
                {activeEv.summary ? (
                  <p className="mt-2 text-xs leading-5 text-gray-600">
                    {activeEv.summary}
                  </p>
                ) : null}
                {activeEv.trainerName ? (
                  <div className="mt-2 text-xs text-gray-600">
                    Trainer / facilitator:{' '}
                    <span className="font-semibold text-gray-900">
                      {activeEv.trainerName}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeEv.trainingSlotId ? (
              <div className="rounded-lg border bg-white p-3">
                <div className="text-xs font-semibold text-gray-700">
                  Admin room access
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a
                    href={adminTrainingRoomPath(
                      activeEv.trainingSlotId,
                      'admin',
                    )}
                    className="rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/90"
                  >
                    Open as admin/trainer
                  </a>
                  <a
                    href={adminTrainingRoomPath(
                      activeEv.trainingSlotId,
                      'observer',
                    )}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Open as observer
                  </a>
                </div>
                <div className="mt-2 text-[11px] text-gray-500">
                  This observer control is for the authenticated Admin/staff
                  member. External observers receive their own unique secure
                  invitation below.
                </div>
              </div>
            ) : null}

            {activeEv.trainingSlotId ? (
              <TrainingContentManager
                trainingSlotId={activeEv.trainingSlotId}
                sessions={[
                  {
                    id: 'session-1',
                    dayNumber: 1,
                    startLocal: toLocalInputValue(activeEv.startAt),
                    endLocal: toLocalInputValue(activeEv.endAt),
                    mode: activeEv.mode,
                    trainerName: activeEv.trainerName || '',
                  },
                ]}
              />
            ) : null}

            {activeEv.trainingSlotId ? (
              <TrainingParticipationPanel
                trainingSlotId={activeEv.trainingSlotId}
                commonRoomUrl={activeEv.joinUrl}
                qualifiedClinicians={rows
                  .filter(
                    (row) =>
                      isTrainingComplete(row),
                  )
                  .map((row) => ({
                    clinicianId: row.clinicianId,
                    onboardingId: row.onboarding.id,
                    label: `${row.displayName}${
                      row.specialty ? ` — ${row.specialty}` : ''
                    }`,
                  }))}
                onChanged={() => window.location.reload()}
              />
            ) : null}
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
