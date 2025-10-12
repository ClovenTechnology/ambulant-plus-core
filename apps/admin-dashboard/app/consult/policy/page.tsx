'use client';

import { useEffect, useState } from 'react';

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ?? '';

type AdminPolicy = {
  minStandardMinutes: number;
  minFollowupMinutes: number;
  bufferAfterMinutes: number;
  joinGracePatientMin: number;
  joinGraceClinicianMin: number;
  minWithin24hPercent: number;
  minNoShowPercent: number;
  minClinicianMissPercent: number;
};

export default function AdminConsultPolicyPage(){
  const [p, setP] = useState<AdminPolicy | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${GATEWAY}/api/admin/consult/policy`, {
      headers: { 'x-role': 'admin' },
      cache: 'no-store',
    }).then(r => r.json()).then(setP).catch(() => setP(null));
  }, []);

  function set<K extends keyof AdminPolicy>(k: K, v: number){
    if (!p) return;
    setP({ ...p, [k]: Math.max(0, Math.floor(v)) });
  }

  async function save(){
    if (!p) return;
    setSaving(true); setSaved(false); setErr(null);
    const res = await fetch(`${GATEWAY}/api/admin/consult/policy`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-role':'admin' },
      body: JSON.stringify(p),
    });
    setSaving(false);
    if (res.ok) setSaved(true); else setErr(await res.text());
  }

  if (!p) return <main className="p-6">Loading…</main>;

  return (
    <main className="p-6 space-y-4 max-w-2xl">
      <h1 className="text-lg font-semibold">Admin — Consult Policy</h1>
      <section className="bg-white border rounded p-4 grid grid-cols-2 gap-3 text-sm">
        <Num label="Min Standard (min)" v={p.minStandardMinutes} onChange={n => set('minStandardMinutes', n)} />
        <Num label="Min Follow-up (min)" v={p.minFollowupMinutes} onChange={n => set('minFollowupMinutes', n)} />
        <Num label="Buffer After (min)" v={p.bufferAfterMinutes} onChange={n => set('bufferAfterMinutes', n)} />
        <Num label="Join Grace — Patient (min)" v={p.joinGracePatientMin} onChange={n => set('joinGracePatientMin', n)} />
        <Num label="Join Grace — Clinician (min)" v={p.joinGraceClinicianMin} onChange={n => set('joinGraceClinicianMin', n)} />

        {/* NEW refund minima controls */}
        <Num label="Min <24h Cancel Refund (%)" v={p.minWithin24hPercent} onChange={n => set('minWithin24hPercent', n)} />
        <Num label="Min No-show Refund (%)" v={p.minNoShowPercent} onChange={n => set('minNoShowPercent', n)} />
        <Num label="Min Clinician Miss Refund (%)" v={p.minClinicianMissPercent} onChange={n => set('minClinicianMissPercent', n)} />
      </section>
      <div className="flex items-center gap-2">
        <button onClick={save} disabled={saving} className="px-3 py-2 rounded border bg-black text-white">
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="text-green-700 text-sm">Saved ✓</span>}
        {err && <span className="text-rose-600 text-sm">{err}</span>}
      </div>
    </main>
  );
}

function Num({label, v, onChange}:{label:string; v:number; onChange:(n:number)=>void}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-gray-600">{label}</span>
      <input type="number" value={v} onChange={e => onChange(Number(e.target.value||0))}
             className="border rounded px-2 py-1 w-28" />
    </label>
  );
}
