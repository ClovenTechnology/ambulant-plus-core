'use client';
import { useState } from 'react';

export default function SeedDevices() {
  const base = process.env.NEXT_PUBLIC_GATEWAY_BASE || 'http://localhost:3010';
  const [msg, setMsg] = useState<string>('');

  async function run() {
    setMsg('Seeding…');
    try {
      const r = await fetch(`${base}/api/devices/seed`, { method: 'POST' });
      const j = await r.json().catch(()=>({}));
      setMsg(r.ok ? `OK: ${JSON.stringify(j)}` : `Failed: ${r.status}`);
    } catch (e: any) {
      setMsg(e?.message || 'Failed');
    }
  }

  return (
    <main className="p-6 space-y-3">
      <h1 className="text-xl font-semibold">Devices / Seed</h1>
      <button onClick={run} className="px-3 py-1 border rounded bg-white">Re-seed device catalog</button>
      {msg && <div className="text-sm">{msg}</div>}
    </main>
  );
}
