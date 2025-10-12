'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

/** Public props */
export type CalendarClientProps = { clinicianId: string };

/** Local helpers */
type DaySlots = { label: string; dateISO: string; slots: string[] };

function genSlots(): DaySlots[] {
  const now = new Date();
  const days: DaySlots[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const dateISO = d.toISOString().slice(0, 10); // YYYY-MM-DD
    const label = d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    days.push({ label, dateISO, slots: ['09:00', '10:30', '14:00', '16:00'] });
  }
  return days;
}
function toISO(dateStr: string, hm: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const [h, m] = hm.split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toISOString();
}
function fmt(dtISO?: string) {
  if (!dtISO) return '—';
  const d = new Date(dtISO);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Component */
export default function CalendarClient({ clinicianId }: CalendarClientProps) {
  const router = useRouter();
  const days = useMemo(() => genSlots(), []);
  const [selected, setSelected] = useState<{ day: number; time: string } | null>(null);

  const [booking, setBooking] = useState<{
    id: string;
    startISO: string;
    endISO: string;
    status: 'booked' | 'confirmed';
    priceCents: number;
    currency: string; // "R"
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reschedule modal state
  const [reOpen, setReOpen] = useState(false);
  const [reSel, setReSel] = useState<{ day: number; time: string } | null>(null);
  const [reBusy, setReBusy] = useState(false);
  const [reErr, setReErr] = useState('');

  // (legacy demo booking helpers kept as-is to avoid regressions elsewhere)
  async function book() {
    if (!selected) return;
    setSubmitting(true);
    setError('');
    try {
      const day = days[selected.day];
      const startISO = toISO(day.dateISO, selected.time);
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicianId, startISO, durationMin: 30 }),
      });
      if (!res.ok) throw new Error('Failed to create appointment');
      const appt = await res.json();
      // Normalise shape we use locally
      const endISO =
        appt.endISO ??
        new Date(new Date(appt.startISO).getTime() + (appt.durationMin ?? 30) * 60000).toISOString();
      const priceCents =
        typeof appt.priceCents === 'number'
          ? appt.priceCents
          : typeof appt.price === 'number'
          ? Math.round(appt.price * 100)
          : 85000; // fallback R 850.00
      setBooking({
        id: appt.id,
        startISO: appt.startISO,
        endISO,
        status: appt.status ?? 'booked',
        priceCents,
        currency: appt.currency ?? 'R',
      });
      try {
        // await fetch(`/api/appointments/${appt.id}/notify`, { method: 'POST' });
      } catch {}
    } catch (e: any) {
      setError(e?.message || 'Booking failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmReschedule() {
    if (!booking || !reSel) return;
    setReBusy(true);
    setReErr('');
    try {
      const d = days[reSel.day];
      const startISO = toISO(d.dateISO, reSel.time);
      const res = await fetch(`/api/appointments/${booking.id}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startISO }),
      });

      if (!res.ok) {
        // Fail-soft: update locally so UX isn’t blocked in demo mode
        const endISO = new Date(new Date(startISO).getTime() + 30 * 60000).toISOString();
        setBooking((b) => (b ? { ...b, startISO, endISO, status: 'booked' } : b));
      } else {
        const appt = await res.json();
        const endISO =
          appt.endISO ??
          new Date(new Date(appt.startISO).getTime() + (appt.durationMin ?? 30) * 60000).toISOString();
        setBooking((b) =>
          b
            ? {
                ...b,
                startISO: appt.startISO ?? startISO,
                endISO,
                status: appt.status ?? 'booked',
              }
            : b
        );
      }
      setReOpen(false);
      setReSel(null);
    } catch (e: any) {
      setReErr(e?.message || 'Could not reschedule');
    } finally {
      setReBusy(false);
    }
  }

  if (!clinicianId) {
    return <div className="p-4 text-sm text-rose-600 border rounded">No clinician selected.</div>;
  }

  const priceText =
    booking && booking.priceCents != null
      ? `${booking.currency} ${(booking.priceCents / 100).toFixed(2)}`
      : '—';

  // Compute selected slot ISO pair for the confirm button
  const selectedStartISO =
    selected ? toISO(days[selected.day].dateISO, selected.time) : null;
  const selectedEndISO =
    selectedStartISO
      ? new Date(new Date(selectedStartISO).getTime() + 30 * 60000).toISOString()
      : null;

  return (
    <div className="border rounded p-4 space-y-3">
      {!booking ? (
        <>
          <div className="text-sm text-gray-700">
            Booking for clinician: <strong>{clinicianId}</strong>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {days.map((d, idx) => (
              <div key={d.dateISO} className="border rounded p-2">
                <div className="text-xs text-gray-500 mb-1">{d.label}</div>
                <div className="grid grid-cols-2 gap-2">
                  {d.slots.map((t) => {
                    const isSel = selected?.day === idx && selected?.time === t;
                    return (
                      <button
                        key={t}
                        onClick={() => {
                          // ✅ Explicit confirm mode:
                          // Just select the slot (no navigation here)
                          setSelected({ day: idx, time: t });
                        }}
                        className={`text-sm px-2 py-1 rounded border ${
                          isSel ? 'bg-indigo-600 text-white' : 'hover:bg-gray-50'
                        }`}
                        aria-pressed={isSel}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {error && <div className="text-sm text-rose-600">{error}</div>}

          <div className="pt-1 flex items-center gap-2">
            {/* 👇 Confirm button that navigates with prefill */}
            <button
              disabled={!selectedStartISO}
              onClick={() => {
                if (!selectedStartISO || !selectedEndISO) return;
                const url =
                  `/appointments/new` +
                  `?clinicianId=${encodeURIComponent(clinicianId)}` +
                  `&starts=${encodeURIComponent(selectedStartISO)}` +
                  `&startsAt=${encodeURIComponent(selectedStartISO)}` + // tolerate either param name
                  `&ends=${encodeURIComponent(selectedEndISO)}` +
                  `&reason=${encodeURIComponent('Televisit consult')}`;
                router.push(url);
              }}
              className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm disabled:opacity-50"
            >
              Book this slot
            </button>

            {/* (Legacy demo path) Keep original booking button if you still want it */}
            {/* <button
              disabled={!selected || submitting}
              onClick={book}
              className="px-3 py-1.5 rounded bg-gray-900 text-white text-sm disabled:opacity-50"
            >
              {submitting ? 'Booking…' : 'Book directly'}
            </button> */}
          </div>
        </>
      ) : (
        <div className="rounded border p-3 bg-emerald-50 text-emerald-900 text-sm">
          <div className="mb-1">
            ✅ Booked! Appointment ID: <code>{booking.id}</code>
          </div>
          <div className="mb-1">
            <span className="font-medium">When:</span> {fmt(booking.startISO)} — {fmt(booking.endISO)}{' '}
            • <span className="font-medium">Price:</span> {priceText}
          </div>
          <div className="space-x-3">
            <a className="underline" href={`/checkout?a=${booking.id}`}>
              Pay & Confirm
            </a>
            <a className="underline" href={`/appointments/${booking.id}`}>
              View details
            </a>
            <a className="underline" href={`/api/appointments/${booking.id}/ics`}>
              Download .ics
            </a>
            <button className="underline" onClick={() => setReOpen(true)}>
              Reschedule
            </button>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {reOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl">
            <div className="flex items-center justify-between border-b p-4">
              <div className="font-semibold">Reschedule appointment</div>
              <button onClick={() => setReOpen(false)} className="text-sm px-3 py-1.5 rounded border hover:bg-gray-50">
                Close
              </button>
            </div>

            <div className="p-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {days.map((d, di) => (
                  <div key={d.dateISO} className="border rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-2">{d.label}</div>
                    <div className="grid grid-cols-2 gap-2">
                      {d.slots.map((t) => {
                        const sel = reSel?.day === di && reSel?.time === t;
                        return (
                          <button
                            key={t}
                            onClick={() => setReSel({ day: di, time: t })}
                            className={`text-sm px-3 py-2 rounded border ${
                              sel ? 'bg-indigo-600 text-white' : 'hover:bg-gray-50'
                            }`}
                            aria-pressed={sel}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t flex items-center justify-end">
              {reErr && <div className="text-sm text-rose-600 mr-3">{reErr}</div>}
              <button
                disabled={!reSel || reBusy}
                onClick={confirmReschedule}
                className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm disabled:opacity-50"
              >
                {reBusy ? 'Updating…' : 'Confirm new time'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
