'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type Appt = { id: string; patientName: string; clinicianName: string; };

export default function NewErx() {
  const [appts, setAppts] = useState<Appt[]>([]);
  const [aptId, setAptId] = useState('');
  const [rows, setRows] = useState([{ drug: '', sig: '', qty: '', refills: 0 }]);
  const [result, setResult] = useState<any>(null);
  const sp = useSearchParams();
  const seed = sp.get('apt') || '';

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/appointments', { cache: 'no-store' });
      const js = await r.json();
      setAppts(js);
      if (seed) setAptId(seed);
    })();
  }, [seed]);

  const addRow = () => setRows(r => [...r, { drug: '', sig: '', qty: '', refills: 0 }]);
  const save = async () => {
    const meds = rows.filter(r => r.drug && r.sig);
    const r = await fetch('/api/erx', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ appointmentId: aptId, meds }),
    });
    const js = await r.json();
    setResult(js);
  };

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-lg font-semibold">New eRx</h1>

      <div className="space-y-2">
        <label className="text-sm text-gray-600">Appointment</label>
        <select className="border rounded p-2" value={aptId} onChange={e=>setAptId(e.target.value)}>
          <option value="">Select…</option>
          {appts.map(a => (
            <option key={a.id} value={a.id}>{a.patientName} — {a.id}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">Medications</div>
        {rows.map((r, i) => (
          <div key={i} className="grid md:grid-cols-4 gap-2">
            <input className="border rounded p-2" placeholder="Drug" value={r.drug} onChange={e=>setRows(x => x.map((y,j)=> j===i?{...y,drug:e.target.value}:y))} />
            <input className="border rounded p-2" placeholder="Sig (e.g., 1 tab BID)" value={r.sig} onChange={e=>setRows(x => x.map((y,j)=> j===i?{...y,sig:e.target.value}:y))} />
            <input className="border rounded p-2" placeholder="Qty" value={r.qty} onChange={e=>setRows(x => x.map((y,j)=> j===i?{...y,qty:e.target.value}:y))} />
            <input className="border rounded p-2" placeholder="Refills" type="number" value={r.refills} onChange={e=>setRows(x => x.map((y,j)=> j===i?{...y,refills:Number(e.target.value)}:y))} />
          </div>
        ))}
        <button className="border rounded px-3 py-1" onClick={addRow}>Add drug</button>
      </div>

      <button className="border rounded px-3 py-1" onClick={save} disabled={!aptId}>Send eRx</button>

      {result && (
        <div className="mt-4 border rounded p-3 bg-white text-sm">
          <div>eRx ID: <b>{result.id}</b></div>
          <div>Status: <b>{result.status}</b></div>
          <div>Dispense Code: <b>{result.dispenseCode}</b></div>
        </div>
      )}
    </main>
  );
}
