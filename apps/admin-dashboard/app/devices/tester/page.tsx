'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Catalog = {
  vendors: Array<{
    key: string; name: string;
    categories: Array<{
      key: string; name: string;
      models: Array<{ key: string; name: string; ingest_key: string; capabilities: string[] }>;
    }>;
  }>;
};

function hmacSha256Hex(secret: string, body: string) {
  // browser HMAC using SubtleCrypto
  const enc = new TextEncoder();
  return window.crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  ).then(key => window.crypto.subtle.sign("HMAC", key, enc.encode(body)))
   .then(sig => Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join(""));
}

type Vital = { t:string; type:string; value:number; unit?:string };
function useVitalsSSE(roomId?: string) {
  const [vitals, setVitals] = useState<Vital[]>([]);
  useEffect(() => {
    if (!roomId) return;
    const ev = new EventSource(`/api/televisit/stream?roomId=${encodeURIComponent(roomId)}`);
    ev.onmessage = (m) => {
      const v = JSON.parse(m.data) as Vital;
      setVitals(prev => [...prev.slice(-99), v]);
    };
    return () => ev.close();
  }, [roomId]);
  return vitals;
}

export default function DeviceTesterPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);

  // Device credentials
  const [deviceId, setDeviceId] = useState('');
  const [secret, setSecret] = useState('');

  // Hierarchy (optional – mapper selection is actually driven by device row in DB,
  // but admins can sanity-check payloads targeting a room.)
  const [vendor, setVendor] = useState('');
  const [category, setCategory] = useState('');
  const [model, setModel] = useState('');

  // Target room (SSE preview)
  const [roomId, setRoomId] = useState('');

  // Payload JSON
  const [payload, setPayload] = useState<string>('{\n  "events": [\n    { "patient_id": "pt-za-1001", "t": "2025-09-11T10:00:00Z", "spo2": 98, "hr": 76, "room_id": "consult-room" }\n  ]\n}');

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const vitals = useVitalsSSE(roomId);

  useEffect(() => {
    fetch('/api/devices/catalog', { cache: 'no-store' })
      .then(r => r.json()).then(setCatalog).catch(() => setCatalog(null));
  }, []);

  const vendorObj = useMemo(() => catalog?.vendors.find(v => v.key === vendor), [catalog, vendor]);
  const catObj = useMemo(() => vendorObj?.categories.find(c => c.key === category), [vendorObj, category]);
  const modelObj = useMemo(() => catObj?.models.find(m => m.key === model), [catObj, model]);

  async function send() {
    setSending(true); setErr(null); setResult(null);
    try {
      if (!deviceId || !secret) throw new Error('Provide deviceId & secret from a registered device');

      // Attach room_id into payload if provided (helper)
      let body = payload;
      if (roomId) {
        try {
          const o = JSON.parse(body);
          const putRoom = (ev: any) => { if (roomId && !ev.room_id) ev.room_id = roomId; };
          if (Array.isArray(o.events)) o.events.forEach(putRoom);
          else if (o.event) putRoom(o.event);
          else putRoom(o);
          body = JSON.stringify(o);
        } catch {}
      }

      const sig = await hmacSha256Hex(secret, body);
      const res = await fetch('/api/devices/ingest', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-device-id': deviceId,
          'x-signature': sig
        },
        body
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (e: any) {
      setErr(e?.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Admin · Device Tester</h1>
      </header>

      <section className="grid md:grid-cols-3 gap-3">
        <Field label="Device ID" value={deviceId} onChange={setDeviceId}/>
        <Field label="Secret" value={secret} onChange={setSecret} password />
        <Field label="Room (SSE preview)" value={roomId} onChange={setRoomId} placeholder="consult-room"/>
      </section>

      <section className="grid md:grid-cols-3 gap-3">
        <Select label="Vendor" value={vendor} onChange={setVendor}
          options={(catalog?.vendors || []).map(v => ({ value: v.key, label: v.name }))}/>
        <Select label="Category" value={category} onChange={setCategory}
          options={(vendorObj?.categories || []).map(c => ({ value: c.key, label: c.name }))}/>
        <Select label="Model" value={model} onChange={setModel}
          options={(catObj?.models || []).map(m => ({ value: m.key, label: m.name }))}/>
      </section>

      <section className="border rounded bg-white p-3">
        <div className="text-sm font-medium mb-2">Payload (JSON)</div>
        <textarea className="w-full min-h-[180px] border rounded p-2 font-mono text-xs"
          value={payload} onChange={e => setPayload(e.target.value)} />
        <div className="mt-2">
          <button onClick={send} disabled={sending} className="px-3 py-1 border rounded bg-black text-white">
            {sending ? 'Sending…' : 'Send to /api/devices/ingest'}
          </button>
        </div>
      </section>

      {err && <div className="p-3 border rounded bg-red-50 text-red-700 text-sm">Error: {err}</div>}
      {result && <pre className="text-xs p-3 border rounded bg-slate-50 overflow-auto">{JSON.stringify(result, null, 2)}</pre>}

      {roomId && (
        <section className="border rounded bg-white p-3">
          <div className="text-sm font-medium mb-2">Live SSE (last {vitals.length} events)</div>
          <div className="grid grid-cols-1 gap-1 text-xs">
            {vitals.map((v,i) => (
              <div key={i} className="flex justify-between">
                <span className="font-mono text-slate-600">{v.t}</span>
                <span>{v.type}</span>
                <span className="font-semibold">{v.value}{v.unit ? ` ${v.unit}` : ''}</span>
              </div>
            ))}
            {vitals.length === 0 && <div className="text-slate-500">No events yet.</div>}
          </div>
        </section>
      )}
    </main>
  );
}

function Field({ label, value, onChange, password=false, placeholder }:{
  label: string; value: string; onChange: (v:string)=>void; password?: boolean; placeholder?: string;
}) {
  return (
    <label className="text-sm">
      <div className="text-gray-600 mb-1">{label}</div>
      <input value={value} onChange={e=>onChange(e.target.value)}
        type={password ? 'password':'text'}
        className="w-full border rounded px-2 py-1" placeholder={placeholder}/>
    </label>
  );
}

function Select({ label, value, onChange, options }:{
  label: string; value: string; onChange: (v:string)=>void; options: Array<{value:string; label:string}>;
}) {
  return (
    <label className="text-sm">
      <div className="text-gray-600 mb-1">{label}</div>
      <select value={value} onChange={e=>onChange(e.target.value)} className="w-full border rounded px-2 py-1">
        <option value="">—</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
