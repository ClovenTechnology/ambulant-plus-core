// apps/clinician-app/app/appointments/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

/* ================= TYPES ================= */

type Appt = {
  id: string;
  encounterId?: string;
  patientId: string;
  clinicianId: string;
  startsAt: string;
  endsAt: string;
  status: string;
  priceCents?: number;
  currency?: string;
};

/* ================= MOCK FALLBACK DATA ================= */

const MOCK_APPOINTMENTS: Appt[] = [
  {
    id: 'apt-1001',
    encounterId: 'enc-9001',
    patientId: 'pat-01',
    clinicianId: 'doctor-12',
    startsAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    status: 'confirmed',
    priceCents: 65000,
    currency: 'ZAR',
  },
  {
    id: 'apt-1002',
    encounterId: 'enc-9002',
    patientId: 'pat-02',
    clinicianId: 'doctor-12',
    startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
    priceCents: 50000,
    currency: 'ZAR',
  },
  {
    id: 'apt-1003',
    encounterId: 'enc-9003',
    patientId: 'pat-03',
    clinicianId: 'doctor-12',
    startsAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    status: 'completed',
    priceCents: 80000,
    currency: 'ZAR',
  },
];

/* ================= HELPERS ================= */

function fmt(dt: string) {
  try { return new Date(dt).toLocaleString(); } catch { return dt; }
}

/* ================= PAGE ================= */

export default function ClinicianAppointmentsPage() {
  const [items, setItems] = useState<Appt[]>([]);
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const clinicianId = process.env.NEXT_PUBLIC_DEMO_CLINICIAN_ID || 'doctor-12';

  /* ===== API FIRST, MOCK FALLBACK ===== */

  async function load() {
    setErr('');
    setBusy(true);

    try {
      const r = await fetch(
        `/api/appointments?clinicianId=${encodeURIComponent(clinicianId)}&q=${encodeURIComponent(q)}`,
        { cache: 'no-store' }
      );

      if (!r.ok) throw new Error(`HTTP ${r.status}`);

      const data = await r.json();

      // Accept multiple backend shapes
      const list: Appt[] = Array.isArray(data)
        ? data
        : (Array.isArray(data.appointments)
            ? data.appointments
            : (Array.isArray(data.items) ? data.items : []));

      if (list.length > 0) {
        // real API data
        setItems(list);
      } else {
        // graceful fallback if API returns empty
        setItems(MOCK_APPOINTMENTS);
      }
    } catch (e: any) {
      // graceful fallback if API fails
      setErr('API unavailable — demo appointments loaded');
      setItems(MOCK_APPOINTMENTS);
    } finally {
      setBusy(false);
    }
  }

  /* ===== POLLING ===== */

  useEffect(() => {
    load();
    const t = setInterval(load, 10000); // near-real-time refresh
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ===== FILTERING ===== */

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(a =>
      a.id.toLowerCase().includes(s) ||
      (a.patientId || '').toLowerCase().includes(s) ||
      (a.status || '').toLowerCase().includes(s)
    );
  }, [items, q]);

  /* ================= UI ================= */

  return (
    <main className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">My Appointments</h1>

        <div className="flex items-center gap-2">
          <input
            className="rounded border px-3 py-1.5 text-sm"
            placeholder="Search id / patient / status"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            onClick={load}
            className="px-3 py-1.5 rounded border text-sm bg-white hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {err && (
        <div className="text-amber-600 mb-3">{err}</div>
      )}

      <div className="bg-white rounded-xl border divide-y">
        {filtered.length === 0 ? (
          <div className="p-4 text-gray-500">
            {busy ? 'Loading…' : 'No appointments yet.'}
          </div>
        ) : (
          filtered.map(a => (
            <div key={a.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">
                  #{a.id} • <span className="text-gray-600">{a.status || 'pending'}</span>
                </div>
                <div className="text-sm text-gray-700">
                  {fmt(a.startsAt)} — {fmt(a.endsAt)}
                </div>
                <div className="text-xs text-gray-500">
                  Patient: {a.patientId} • Encounter: {a.encounterId || '—'}
                </div>
              </div>

              <div className="text-right">
                {(a.priceCents != null) && (
                  <div className="text-sm">
                    {(a.currency || 'ZAR')} {(a.priceCents / 100).toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
