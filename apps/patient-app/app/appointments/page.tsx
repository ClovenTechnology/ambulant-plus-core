'use client';

import { useEffect, useState } from 'react';
const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ?? 'http://localhost:3010';

type Appt = { id: string; clinicianId: string; startsAt: string; endsAt: string; status: string; reason?: string };

export default function PatientAppointments() {
  const [items, setItems] = useState<Appt[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${GATEWAY}/api/appointments?patientId=pt-za-001`, { cache: 'no-store' });
        if (!r.ok) throw new Error(await r.text());
        const j = await r.json();
        setItems(j.items || []);
      } catch (e: any) {
        setErr(e?.message || 'Failed to load');
      }
    })();
  }, []);

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">My Appointments</h1>
      {err && <div className="text-sm text-rose-600">{err}</div>}
      <div className="bg-white border rounded divide-y">
        {items.length === 0 && <div className="p-3 text-sm text-gray-500">No appointments yet.</div>}
        {items.map(a => (
          <div key={a.id} className="p-3 text-sm flex items-center justify-between">
            <div>
              <div className="font-medium">{a.reason || 'Consult'}</div>
              <div className="text-gray-600">
                {new Date(a.startsAt).toLocaleString()} – {new Date(a.endsAt).toLocaleTimeString()} · {a.clinicianId}
              </div>
            </div>
            <span className="px-2 py-0.5 rounded border">{a.status}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
