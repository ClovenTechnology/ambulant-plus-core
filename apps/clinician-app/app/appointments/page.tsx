// apps/clinician-app/app/appointments/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

type Appt = {
  id: string;
  encounterId?: string | null;
  visitId?: string | null;
  televisitId?: string | null;
  patientId?: string | null;
  patientName?: string | null;
  clinicianId?: string | null;
  clinicianName?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  start?: string | null;
  end?: string | null;
  status?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  roomId?: string | null;
  roomName?: string | null;
  patientJoinUrl?: string | null;
  clinicianJoinUrl?: string | null;
  patientParticipantId?: string | null;
  clinicianParticipantId?: string | null;
};

function fmt(dt: string | null | undefined) {
  if (!dt) return '-';

  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function appointmentStart(a: Appt) {
  return a.startsAt || a.start || null;
}

function appointmentEnd(a: Appt) {
  return a.endsAt || a.end || null;
}

function asList(payload: any): Appt[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.appointments)) return payload.appointments;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

async function resolveClinicianId(): Promise<string> {
  if (typeof window !== 'undefined') {
    const fromUrl = new URLSearchParams(window.location.search).get('clinicianId') || '';
    if (fromUrl) return fromUrl;
  }

  try {
    const r = await fetch('/api/me', { cache: 'no-store' });
    if (!r.ok) return '';

    const me = await r.json();

    return (
      me?.clinicianId ||
      me?.clinician?.id ||
      me?.user?.clinicianId ||
      me?.user?.clinician?.id ||
      ''
    );
  } catch {
    return '';
  }
}

function lobbyHref(a: Appt) {
  const roomId = a.roomId || a.roomName || ('room-' + a.id);
  const sp = new URLSearchParams();

  sp.set('roomId', roomId);
  sp.set('appointmentId', a.id);

  if (a.encounterId) sp.set('encounterId', a.encounterId);
  if (a.visitId || a.televisitId) sp.set('visitId', String(a.visitId || a.televisitId));
  if (a.patientId) sp.set('patientId', a.patientId);
  if (a.patientName) sp.set('patientName', a.patientName);
  if (a.clinicianId) sp.set('clinicianId', a.clinicianId);
  if (a.clinicianName) sp.set('clinicianName', a.clinicianName);
  if (a.patientParticipantId) sp.set('patientParticipantId', a.patientParticipantId);
  if (a.clinicianParticipantId) sp.set('participantId', a.clinicianParticipantId);
  if (a.patientJoinUrl) sp.set('patientJoinUrl', a.patientJoinUrl);
  if (a.clinicianJoinUrl) sp.set('clinicianJoinUrl', a.clinicianJoinUrl);

  return '/lobby?' + sp.toString();
}

export default function ClinicianAppointmentsPage() {
  const [items, setItems] = useState<Appt[]>([]);
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string>('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setErr('');
    setBusy(true);

    try {
      const clinicianId = await resolveClinicianId();

      if (!clinicianId) {
        setItems([]);
        setErr('Clinician context could not be resolved. Please sign in again.');
        return;
      }

      const params = new URLSearchParams();
      params.set('clinicianId', clinicianId);
      params.set('excludeSimulation', '1');
      if (q.trim()) params.set('q', q.trim());

      const r = await fetch('/api/appointments?' + params.toString(), {
        cache: 'no-store',
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.ok === false) throw new Error(data?.error || 'HTTP ' + r.status);

      setItems(asList(data));
    } catch (e: any) {
      setItems([]);
      setErr(e?.message ? 'Appointments could not be loaded: ' + e.message : 'Appointments could not be loaded.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();

    const t = setInterval(load, 10000);
    return () => clearInterval(t);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;

    return items.filter((a) =>
      String(a.id || '').toLowerCase().includes(s) ||
      String(a.patientId || '').toLowerCase().includes(s) ||
      String(a.status || '').toLowerCase().includes(s)
    );
  }, [items, q]);

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
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {err}
        </div>
      )}

      <div className="bg-white rounded-xl border divide-y">
        {filtered.length === 0 ? (
          <div className="p-4 text-gray-500">
            {busy ? 'Loading...' : 'No appointments yet.'}
          </div>
        ) : (
          filtered.map((a) => (
            <div key={a.id} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium">
                  #{a.id} - <span className="text-gray-600">{a.status || 'pending'}</span>
                </div>

                <div className="text-sm text-gray-700">
                  {fmt(appointmentStart(a))} - {fmt(appointmentEnd(a))}
                </div>

                <div className="text-xs text-gray-500">
                  Patient: {a.patientName || a.patientId || '-'} - Encounter: {a.encounterId || '-'}
                </div>

                <div className="text-xs text-gray-500">
                  Room: {a.roomId || a.roomName || '-'}
                </div>
              </div>

              <div className="text-right space-y-2">
                {a.priceCents != null && (
                  <div className="text-sm">
                    {(a.currency || 'ZAR')} {(a.priceCents / 100).toFixed(2)}
                  </div>
                )}

                <a
                  href={lobbyHref(a)}
                  className="inline-flex rounded bg-black px-3 py-1.5 text-sm text-white hover:bg-gray-800"
                >
                  Open lobby
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
