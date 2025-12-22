// apps/clinician-app/components/forms/AppointmentForm.tsx
'use client';

import React, { useEffect, useState } from 'react';

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ?? 'http://localhost:3010';

type Slot = { start: string; end: string; booked: boolean; patientId?: string };

const MOCK_PATIENTS = ['patient-001', 'patient-002', 'patient-003', 'patient-004', 'patient-005'];

type AppointmentFormProps = {
  clinicianId?: string;
  onSaved?: (payload: any) => void | Promise<void>;
  /** Optional: ISO timestamps used to pre-fill the selected slot (from CalendarPreview) */
  prefillStartIso?: string;
  prefillEndIso?: string;
};

export default function AppointmentForm({
  clinicianId = 'clin-za-001',
  onSaved = () => {},
  prefillStartIso,
  prefillEndIso,
}: AppointmentFormProps) {
  const [patientId, setPatientId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);

  const [startDayOffset, setStartDayOffset] = useState(0);
  const daysToShow = 7;
  const slotDuration = 30; // minutes

  // When CalendarPreview passes a new slot, pre-fill the form
  useEffect(() => {
    if (prefillStartIso) setStartsAt(prefillStartIso);
    if (prefillEndIso) setEndsAt(prefillEndIso);
  }, [prefillStartIso, prefillEndIso]);

  const generateMockSlots = (baseDate: Date) => {
    const mock: Slot[] = [];
    const patientNames = MOCK_PATIENTS;
    for (let d = 0; d < daysToShow; d++) {
      for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += slotDuration) {
          const start = new Date(baseDate);
          start.setDate(baseDate.getDate() + d);
          start.setHours(h, m, 0, 0);
          const end = new Date(start);
          end.setMinutes(end.getMinutes() + slotDuration);
          const booked = Math.random() < 0.3;
          mock.push({
            start: start.toISOString(),
            end: end.toISOString(),
            booked,
            patientId: booked
              ? patientNames[Math.floor(Math.random() * patientNames.length)]
              : undefined,
          });
        }
      }
    }
    return mock;
  };

  const loadSlots = async () => {
    setLoadingSlots(true);
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + startDayOffset);
    try {
      const res = await fetch(`${GATEWAY}/api/clinicians/${clinicianId}/slots`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Slot[] = await res.json();
      setSlots(data);
    } catch {
      setSlots(generateMockSlots(baseDate));
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicianId, startDayOffset]);

  const submit = async () => {
    if (!startsAt || !endsAt || !patientId) {
      setErr('Patient ID and slot selection are required.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        clinicianId,
        patientId,
        patientName: patientId,
        startsAt,
        endsAt,
        start: startsAt,
        end: endsAt,
        reason,
      };

      const result = onSaved?.(payload);
      if (result && typeof (result as any).then === 'function') {
        await (result as Promise<any>);
      }

      setPatientId('');
      setStartsAt('');
      setEndsAt('');
      setReason('');
    } catch (e: any) {
      setErr(e?.message || 'Failed to create appointment');
    } finally {
      setBusy(false);
    }
  };

  const selectSlot = (slot: Slot) => {
    if (slot.booked || new Date(slot.end) < new Date()) return;
    setStartsAt(slot.start);
    setEndsAt(slot.end);
  };

  const today = new Date();
  const dayLabels = Array.from({ length: daysToShow }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + startDayOffset + i);
    return d;
  });

  const timeLabels: string[] = [];
  for (let h = 0; h < 24; h++) {
    timeLabels.push(`${h.toString().padStart(2, '0')}:00`);
    timeLabels.push(`${h.toString().padStart(2, '0')}:30`);
  }

  const filteredPatients = MOCK_PATIENTS.filter((p) =>
    p.toLowerCase().includes(patientId.toLowerCase()),
  );

  return (
    <div className="bg-white rounded p-4 flex flex-col gap-3">
      <h3 className="text-sm font-semibold mb-1">Create Appointment</h3>

      {err && <div className="text-sm text-rose-600">{err}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="relative">
          <label className="block text-sm">
            <div className="text-xs text-gray-500">Patient</div>
            <input
              className="mt-1 w-full border rounded px-3 py-2"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder="Type to search patient..."
            />
          </label>
          {patientId && filteredPatients.length > 0 && (
            <ul className="absolute z-20 bg-white border w-full mt-1 max-h-32 overflow-auto rounded shadow">
              {filteredPatients.map((p) => (
                <li
                  key={p}
                  className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                  onClick={() => setPatientId(p)}
                >
                  {p}
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="block text-sm">
          <div className="text-xs text-gray-500">Reason</div>
          <input
            className="mt-1 w-full border rounded px-3 py-2"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Consult / Follow-up"
          />
        </label>
      </div>

      {/* Slot summary (if pre-filled) */}
      {startsAt && (
        <div className="text-xs text-gray-600">
          Selected slot:{' '}
          <span className="font-mono">
            {new Date(startsAt).toLocaleString([], {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setStartDayOffset(startDayOffset - daysToShow)}
          className="px-2 py-1 border rounded"
        >
          {'<'} Previous
        </button>
        <button
          onClick={() => setStartDayOffset(startDayOffset + daysToShow)}
          className="px-2 py-1 border rounded"
        >
          Next {'>'}
        </button>
      </div>

      {/* Calendar */}
      <div className="overflow-x-auto border rounded max-h-[500px]">
        <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b sticky top-0 z-10 bg-gray-50">
          <div className="border-r px-2 py-1 text-xs font-medium">Time</div>
          {dayLabels.map((d, i) => (
            <div
              key={i}
              className="px-2 py-1 text-xs font-medium text-center border-r"
            >
              {d.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </div>
          ))}
        </div>

        {loadingSlots ? (
          <div className="p-3 text-xs text-gray-500">Loading slots…</div>
        ) : (
          <div className="grid grid-cols-[80px_repeat(7,1fr)]">
            {timeLabels.map((t, rowIdx) => (
              <React.Fragment key={rowIdx}>
                <div className="border-t border-r px-2 py-1 text-xs font-mono bg-gray-50 sticky left-0 z-0">
                  {t}
                </div>
                {dayLabels.map((d, colIdx) => {
                  const [hStr, mStr] = t.split(':');
                  const hour = parseInt(hStr, 10);
                  const minute = parseInt(mStr, 10);

                  const slot = slots.find((s) => {
                    const sDate = new Date(s.start);
                    return (
                      sDate.getDate() === d.getDate() &&
                      sDate.getMonth() === d.getMonth() &&
                      sDate.getFullYear() === d.getFullYear() &&
                      sDate.getHours() === hour &&
                      sDate.getMinutes() === minute
                    );
                  });

                  const isSelected = slot && slot.start === startsAt;
                  const now = new Date();
                  const isPast = slot && new Date(slot.end) < now;

                  const tooltip = slot
                    ? slot.booked
                      ? `Booked: ${slot.patientId}`
                      : `${new Date(slot.start).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })} - ${new Date(slot.end).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}`
                    : '';

                  let dotColor = '';
                  if (!slot || isPast) dotColor = 'bg-gray-300';
                  else if (slot.booked) dotColor = 'bg-red-500';
                  else if (isSelected) dotColor = 'bg-indigo-500 animate-pulse-glow';
                  else dotColor = 'bg-green-500';

                  return (
                    <button
                      key={colIdx}
                      onClick={() => slot && selectSlot(slot)}
                      disabled={!slot || slot.booked || isPast}
                      className="border-t border-r w-full h-10 flex items-center justify-center text-xs relative hover:bg-gray-50 transition-colors"
                      title={tooltip}
                    >
                      <span
                        className={`w-3 h-3 rounded-full ${dotColor} mr-1`}
                        style={{ transition: 'all 0.2s ease' }}
                      ></span>
                      <span>
                        {slot
                          ? new Date(slot.start).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </span>
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-2">
        <button
          onClick={() => {
            setPatientId('');
            setStartsAt('');
            setEndsAt('');
            setReason('');
          }}
          className="px-3 py-1 rounded border"
        >
          Clear
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="px-3 py-1 rounded bg-indigo-600 text-white disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Save Appointment'}
        </button>
      </div>

      <style jsx>{`
        @keyframes glowPulse {
          0%,
          100% {
            box-shadow: 0 0 2px 0 rgba(99, 102, 241, 0.6);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 6px 2px rgba(99, 102, 241, 0.9);
            transform: scale(1.1);
          }
        }
        .animate-pulse-glow {
          animation: glowPulse 1s infinite;
        }
      `}</style>
    </div>
  );
}
