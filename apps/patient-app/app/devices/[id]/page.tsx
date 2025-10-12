// apps/patient-app/app/devices/[id]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Vital = { t: string; type: string; value: number; unit?: string };
type Device = {
  device_id: string;
  vendor: string;
  category?: string;
  model?: string;
  patient_id?: string | null;
  room_id?: string | null;
};

export default function DeviceDetails({ params }: { params: { id: string } }) {
  const deviceId = params.id;
  const [dev, setDev] = useState<Device | null>(null);
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [room, setRoom] = useState<string>('');
  const [linking, setLinking] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // assumes you have these read endpoints; if not, you can stub them
        const d = await fetch(`/api/devices/${encodeURIComponent(deviceId)}`, { cache: 'no-store' }).then(r => r.json());
        if (!alive) return;
        setDev(d);
        setRoom(d?.room_id || '');
      } catch (e: any) {
        if (alive) setErr(e?.message || 'Failed to load device');
      }
      try {
        const v = await fetch(`/api/devices/${encodeURIComponent(deviceId)}/vitals?limit=120`, { cache: 'no-store' }).then(r => r.json());
        if (!alive) return;
        setVitals(Array.isArray(v) ? v : []);
      } catch {}
    })();
    return () => { alive = false; };
  }, [deviceId]);

  const seriesByType = useMemo(() => {
    const m = new Map<string, Vital[]>();
    for (const v of vitals) {
      if (!m.has(v.type)) m.set(v.type, []);
      m.get(v.type)!.push(v);
    }
    // keep last 60 points per metric
    for (const [k, arr] of m) m.set(k, arr.slice(-60));
    return m;
  }, [vitals]);

  const linkToRoom = async () => {
    if (!dev) return;
    setLinking(true); setErr(null);
    try {
      const res = await fetch(`/api/devices/${encodeURIComponent(dev.device_id)}/link-room`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ room_id: room || null })
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e:any) {
      setErr(e?.message || 'Failed to update device');
    } finally {
      setLinking(false);
    }
  };

  return (
    <main className="p-6 space-y-4 max-w-5xl mx-auto">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">My Device</h1>
        <Link href="/devices" className="text-sm underline">← Back</Link>
      </header>

      {err && <div className="text-sm text-rose-700">{err}</div>}

      {!dev ? (
        <div className="p-4 border rounded bg-white">Loading…</div>
      ) : (
        <>
          <section className="p-4 border rounded bg-white grid sm:grid-cols-2 gap-3 text-sm">
            <Field label="Device ID" value={dev.device_id} copy />
            <Field label="Vendor" value={dev.vendor} />
            <Field label="Category" value={dev.category || '—'} />
            <Field label="Model" value={dev.model || '—'} />
            <div className="sm:col-span-2 flex items-center gap-2">
              <label className="text-sm text-gray-600">Link to Televisit room</label>
              <input
                value={room}
                onChange={e => setRoom(e.target.value)}
                className="border rounded px-2 py-1 text-sm w-64"
                placeholder="room-abc123"
              />
              <button onClick={linkToRoom} disabled={linking} className="px-3 py-1 border rounded">
                {linking ? 'Saving…' : 'Save'}
              </button>
            </div>
          </section>

          <section className="p-4 border rounded bg-white">
            <h2 className="font-medium mb-3">Recent vitals</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {[...seriesByType.entries()].map(([type, points]) => (
                <div key={type} className="border rounded p-3">
                  <div className="text-sm font-medium mb-2">{labelOf(type)}</div>
                  <Sparkline data={points} />
                  <ul className="text-xs text-gray-600 mt-2">
                    {points.slice(-5).reverse().map((p, i) => (
                      <li key={i} className="flex justify-between">
                        <span>{new Date(p.t).toLocaleTimeString()}</span>
                        <span className="font-mono">{p.value}{p.unit ? ` ${p.unit}` : ''}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {seriesByType.size === 0 && <div className="text-sm text-gray-500">No vitals yet.</div>}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function Field({ label, value, copy=false }: { label: string; value: string; copy?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-gray-600">{label}</div>
      <div className="font-medium">{value}</div>
      {copy && (
        <button
          onClick={() => navigator.clipboard.writeText(value)}
          className="text-xs px-2 py-0.5 border rounded"
        >Copy</button>
      )}
    </div>
  );
}

function labelOf(t: string) {
  const M: Record<string,string> = { spo2: 'SpO₂', hr: 'Heart Rate', temp: 'Temperature', bp_sys: 'Systolic', bp_dia: 'Diastolic' };
  return M[t] || t;
}

function Sparkline({ data }: { data: { value: number }[] }) {
  const w = 260, h = 48, pad = 4;
  if (!data.length) return <div className="h-12 bg-gray-50 rounded" />;
  const vals = data.map(d => d.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const xs = vals.map((_, i) => pad + (i * (w - 2*pad)) / Math.max(1, vals.length - 1));
  const ys = vals.map(v => {
    if (max === min) return h/2;
    return pad + (h - 2*pad) * (1 - (v - min) / (max - min));
  });
  const d = xs.map((x,i) => `${i===0?'M':'L'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} className="block">
      <path d={d} fill="none" stroke="url(#g)" strokeWidth="2" />
      <defs>
        <linearGradient id="g" x1="0" x2="1">
          <stop offset="0%" stopColor="#22c55e"/>
          <stop offset="100%" stopColor="#6366f1"/>
        </linearGradient>
      </defs>
    </svg>
  );
}
