// apps/clinician-app/app/encounters/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';

const CLIN = (process.env.NEXT_PUBLIC_CLINICIAN_BASE_URL || 'http://localhost:3010').replace(/\/$/, '');

type Appt = {
  id: string;
  patientName: string;
  clinicianName: string;
  timeISO: string;
  roomId: string;
  status: string;
  notes?: string;
  diagnosis?: string;
  disposition?: string;
};

export default function FinalizeEncounter({ params }: { params: { id: string } }) {
  const { id } = params;
  const [a, setA] = useState<Appt | null>(null);
  const [notes, setNotes] = useState('');
  const [dx, setDx] = useState('');
  const [disp, setDisp] = useState<'home' | 'followup' | 'refer' | 'admit'>('home');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await fetch(`${CLIN}/api/appointments/${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setA(data);
      setNotes(data?.notes || '');
      setDx(data?.diagnosis || '');
      setDisp((data?.disposition as any) || 'home');
    } catch (e: any) {
      setErr(`Failed to load appointment: ${e?.message || 'error'}`);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`${CLIN}/api/appointments/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notes, diagnosis: dx, disposition: disp, status: 'completed' }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await load();
      alert('Saved and marked completed');
    } catch (e: any) {
      setErr(`Save failed: ${e?.message || 'error'}`);
    } finally {
      setBusy(false);
    }
  };

  if (!a) return <main className="p-6">Loading…</main>;

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Finalize Encounter — {a.patientName}</h1>
          <div className="text-sm text-gray-600">Room: {a.roomId} • {new Date(a.timeISO).toLocaleString()}</div>
        </div>

        <div className="flex gap-2">
          <a href={`/orders/new?encounterId=${encodeURIComponent(id)}`} className="px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700">Write eRx</a>
          <a href={`/orders/new?encounterId=${encodeURIComponent(id)}&tab=lab`} className="px-3 py-1 rounded border bg-white hover:bg-gray-50">Order Lab</a>
          <a href="/encounters" className="px-3 py-1 rounded border bg-white hover:bg-gray-50">Back</a>
        </div>
      </div>

      {err && <div className="text-sm text-rose-600">{err}</div>}

      <div className="grid gap-3">
        <label className="text-sm">
          <div className="text-xs text-gray-600 mb-1">SOAP Notes</div>
          <textarea className="border rounded p-2 w-full" rows={6} placeholder="SOAP Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <label className="text-sm">
          <div className="text-xs text-gray-600 mb-1">Diagnosis</div>
          <input className="border rounded p-2 w-full" placeholder="Diagnosis" value={dx} onChange={(e) => setDx(e.target.value)} />
        </label>

        <label className="text-sm">
          <div className="text-xs text-gray-600 mb-1">Disposition</div>
          <select className="border rounded p-2 w-full" value={disp} onChange={(e) => setDisp(e.target.value as any)}>
            <option value="home">Discharge home</option>
            <option value="followup">Follow up</option>
            <option value="refer">Refer</option>
            <option value="admit">Admit</option>
          </select>
        </label>

        <div className="flex items-center gap-2">
          <button onClick={save} disabled={busy} className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50">Save & Complete</button>
          <button onClick={() => { setNotes(a.notes || ''); setDx(a.diagnosis || ''); setDisp((a.disposition as any) || 'home'); }} className="px-3 py-1 rounded border bg-white">Reset</button>
        </div>
      </div>
    </main>
  );
}
