// apps/patient-app/app/appointments/[id]/page.tsx
'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

type Appt = {
  id: string;
  when: string;
  clinicianName: string;
  reason: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | string;
  roomId: string;
  prep?: string;
};

export default function AppointmentDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const [appt, setAppt] = useState<Appt | null | 'notfound'>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (!cancelled) setLoading(true);
        const res = await fetch(`/api/appointments/${encodeURIComponent(id)}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          if (!cancelled) setAppt('notfound');
          return;
        }
        const data = (await res.json()) as Appt;
        if (!cancelled) setAppt(data);
      } catch {
        if (!cancelled) setAppt('notfound');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <main className="p-6">
        <div className="rounded-xl border p-4 bg-white">Loading appointment…</div>
      </main>
    );
  }

  if (appt === 'notfound' || appt === null) {
    return (
      <main className="p-6">
        <div className="rounded-xl border p-4 bg-white">Appointment not found.</div>
        <div className="mt-3">
          <Link href="/appointments" className="text-sm text-blue-700 underline">
            ← Back to appointments
          </Link>
        </div>
      </main>
    );
  }

  const when = new Date(appt.when);
  const canJoin = appt.status === 'Scheduled' && Boolean(appt.roomId);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Appointment {appt.id}</h1>
      <div className="text-sm grid md:grid-cols-2 gap-2 border rounded p-4 bg-white">
        <div>
          <span className="opacity-60">When:</span> {when.toLocaleString()}
        </div>
        <div>
          <span className="opacity-60">Clinician:</span> {appt.clinicianName}
        </div>
        <div>
          <span className="opacity-60">Reason:</span> {appt.reason}
        </div>
        <div>
          <span className="opacity-60">Status:</span>{' '}
          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
            {appt.status}
          </span>
        </div>
        {appt.prep && (
          <div className="md:col-span-2">
            <span className="opacity-60">Preparation:</span> {appt.prep}
          </div>
        )}
      </div>
      <div className="flex gap-3">
        <Link
          className={`border rounded px-3 py-1 text-sm ${
            canJoin
              ? 'border-blue-600 text-blue-700 hover:bg-blue-50'
              : 'border-gray-200 text-gray-400 cursor-not-allowed'
          }`}
          href={canJoin ? `/sfu/${appt.roomId}` : '#'}
          aria-disabled={!canJoin}
        >
          Join Televisit
        </Link>
        <Link className="underline text-sm self-center" href="/appointments">
          ← Back
        </Link>
      </div>
    </main>
  );
}
