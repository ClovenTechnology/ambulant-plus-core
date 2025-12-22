// apps/patient-app/app/appointments/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

const GATEWAY = process.env.NEXT_PUBLIC_APIGW_BASE ?? 'http://localhost:3010';

type Appt = {
  id: string;
  clinicianId: string;
  clinicianName?: string;
  startsAt: string;
  endsAt: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | string;
  reason?: string;
  location?: string;
  roomId?: string;
};

function statusChipClasses(status: string) {
  const base = 'px-2 py-0.5 rounded-full text-xs border';
  switch (status) {
    case 'Scheduled':
      return `${base} bg-emerald-50 border-emerald-200 text-emerald-700`;
    case 'Completed':
      return `${base} bg-sky-50 border-sky-200 text-sky-700`;
    case 'Cancelled':
      return `${base} bg-rose-50 border-rose-200 text-rose-700`;
    default:
      return `${base} bg-gray-50 border-gray-200 text-gray-700`;
  }
}

export default function PatientAppointments() {
  const [items, setItems] = useState<Appt[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!cancelled) {
          setLoading(true);
          setErr(null);
        }
        const r = await fetch(`${GATEWAY}/api/appointments?patientId=pt-za-001`, {
          cache: 'no-store',
        });
        if (!r.ok) throw new Error(await r.text());
        const j = await r.json();
        if (!cancelled) {
          setItems(j.appointments || []);
        }
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message || 'Failed to load appointments');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const now = Date.now();
  const upcoming = items
    .filter((a) => new Date(a.startsAt).getTime() >= now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const past = items
    .filter((a) => new Date(a.startsAt).getTime() < now)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">My Appointments</h1>

      {/* keep the “what is this” hint */}
      <p className="text-xs text-neutral-500">
        These are your upcoming and recent bookings. Completed visits will appear under{' '}
        <span className="font-medium">My Cases</span>.
      </p>

      {loading && (
        <div className="rounded-lg border bg-white p-3 text-sm text-gray-600">
          Loading your appointments…
        </div>
      )}

      {err && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded p-3">
          {err}
        </div>
      )}

      {/* ✅ Improved empty state */}
      {!loading && items.length === 0 && !err && (
        <div className="bg-white border rounded p-4 text-sm text-gray-700">
          <div className="font-semibold text-gray-900">No appointments yet</div>
          <p className="mt-1">
            When you book a consultation, we&apos;ll show the date, time and clinician here.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/auto-triage"
              className="px-3 py-1.5 rounded-full text-xs bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Start a quick triage
            </Link>
            <Link
              href="/clinicians"
              className="px-3 py-1.5 rounded-full text-xs border bg-white hover:bg-gray-50"
            >
              Find a clinician
            </Link>
            <Link
              href="/encounters"
              className="px-3 py-1.5 rounded-full text-xs border bg-white hover:bg-gray-50"
            >
              View your cases
            </Link>
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Upcoming</h2>
          <div className="bg-white border rounded divide-y">
            {upcoming.map((a) => {
              const start = new Date(a.startsAt);
              const end = new Date(a.endsAt);
              const rel = formatDistanceToNow(start, { addSuffix: true });
              const canJoin = a.status === 'Scheduled' && Boolean(a.roomId);

              return (
                <div
                  key={a.id}
                  className="p-3 text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="font-medium">{a.reason || 'Consultation'}</div>
                    <div className="text-gray-600">
                      {start.toLocaleString()} – {end.toLocaleTimeString()}
                      <span className="ml-1 text-xs text-gray-400">({rel})</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {a.clinicianName ? a.clinicianName : `Clinician: ${a.clinicianId}`}
                      {a.location ? ` · ${a.location}` : ''}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 md:flex-row flex-row-reverse">
                    <span className={statusChipClasses(a.status)}>{a.status}</span>

                    <Link
                      href={`/appointments/${a.id}`}
                      className="text-xs text-blue-700 underline underline-offset-2"
                    >
                      View details
                    </Link>

                    <Link
                      href={canJoin ? `/sfu/${a.roomId}` : '#'}
                      className={`text-xs px-2 py-1 rounded border ${
                        canJoin
                          ? 'border-blue-600 text-blue-700 hover:bg-blue-50'
                          : 'border-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                      aria-disabled={!canJoin}
                    >
                      Join Televisit
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Past</h2>
          <div className="bg-white border rounded divide-y">
            {past.map((a) => {
              const start = new Date(a.startsAt);
              const end = new Date(a.endsAt);
              const rel = formatDistanceToNow(start, { addSuffix: true });

              return (
                <div key={a.id} className="p-3 text-sm flex items-center justify-between">
                  <div>
                    <div className="font-medium">{a.reason || 'Consultation'}</div>
                    <div className="text-gray-600">
                      {start.toLocaleString()} – {end.toLocaleTimeString()}
                      <span className="ml-1 text-xs text-gray-400">({rel})</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {a.clinicianName ? a.clinicianName : `Clinician: ${a.clinicianId}`}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className={statusChipClasses(a.status)}>{a.status}</span>
                    <Link
                      href={`/appointments/${a.id}`}
                      className="text-xs text-blue-700 underline underline-offset-2"
                    >
                      View details
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
