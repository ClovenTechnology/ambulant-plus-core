// apps/clinician-app/app/encounters/page.tsx
'use client';

import { useEffect, useState } from 'react';

const CLIN = (process.env.NEXT_PUBLIC_CLINICIAN_BASE_URL || 'http://localhost:3010').replace(/\/$/, '');

type Encounter = {
  id: string;
  caseId: string;
  patientId: string;
  clinicianId?: string;
  status: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
};

export default function Encounters() {
  const [rows, setRows] = useState<Encounter[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await fetch(`${CLIN}/api/encounters`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const js = await r.json();
      setRows(Array.isArray(js) ? js : js.items ?? []);
    } catch (e: any) {
      setErr(`Failed to load encounters: ${e?.message || 'network error'}`);
      // fallback: empty
      setRows([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const start = async () => {
    setBusy('new');
    try {
      const r = await fetch(`${CLIN}/api/encounters`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}), // server will synthesize defaults
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await load();
    } catch (e: any) {
      setErr(`Failed to start encounter: ${e?.message || 'error'}`);
    } finally {
      setBusy(null);
    }
  };

  const close = async (id: string) => {
    setBusy(id);
    try {
      const r = await fetch(`${CLIN}/api/encounters/${encodeURIComponent(id)}/close`, { method: 'PUT' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await load();
    } catch (e: any) {
      setErr(`Failed to close ${id}: ${e?.message || 'error'}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Encounters</h1>
        <div className="flex items-center gap-2">
          <a href="/" className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50 text-sm">Home</a>
          <a href="/dashboard" className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50 text-sm">Dashboard</a>
          <button onClick={start} disabled={busy === 'new'} className="px-3 py-1.5 rounded border bg-white disabled:opacity-50">+ Start</button>
        </div>
      </div>

      {err && <div className="text-sm text-rose-600">{err}</div>}

      <table className="w-full text-sm border rounded bg-white">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2 text-left">ID</th>
            <th className="p-2 text-left">Patient</th>
            <th className="p-2 text-left">Case</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Updated</th>
            <th className="p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} className="border-t">
              <td className="p-2 font-mono">{e.id}</td>
              <td className="p-2">{e.patientId}</td>
              <td className="p-2">{e.caseId}</td>
              <td className="p-2">{e.status}</td>
              <td className="p-2">{new Date(e.updatedAt).toLocaleString()}</td>
              <td className="p-2 flex gap-2">
                <a href={`/encounters/${encodeURIComponent(e.id)}`} className="px-2 py-0.5 rounded border bg-white hover:bg-gray-50 text-xs">View</a>
                <a href={`/orders/new?encounterId=${encodeURIComponent(e.id)}`} className="px-2 py-0.5 rounded border bg-white hover:bg-gray-50 text-xs">Write eRx</a>
                <a href={`/orders/new?encounterId=${encodeURIComponent(e.id)}&tab=lab`} className="px-2 py-0.5 rounded border bg-white hover:bg-gray-50 text-xs">Order Lab</a>
                <button onClick={() => close(e.id)} disabled={busy === e.id} className="px-2 py-0.5 rounded border bg-white disabled:opacity-50 text-xs">Close</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="p-3 text-gray-500" colSpan={6}>No encounters</td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
