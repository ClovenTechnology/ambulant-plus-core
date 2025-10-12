'use client';

import { useState } from 'react';
const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ?? 'http://localhost:3010';

export default function DevicesAdmin() {
  const [msg, setMsg] = useState<string>('');

  async function reseed() {
    setMsg('Seeding…');
    try {
      const r = await fetch(`${GATEWAY}/api/devices/seed`, { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(JSON.stringify(j) || `HTTP ${r.status}`);
      setMsg('✔ Devices re-seeded');
    } catch (e: any) {
      setMsg(`❌ ${e?.message || 'Failed'}`);
    }
  }

  return (
    <main className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Devices</h1>
      <button onClick={reseed} className="px-3 py-2 rounded bg-black text-white">Re-seed devices</button>
      {msg && <div className="text-sm">{msg}</div>}
    </main>
  );
}
