'use client';
import { useEffect, useState } from 'react';

const CLIN = process.env.NEXT_PUBLIC_CLINICIAN_BASE_URL || 'http://localhost:3001';

type Item = { status: string; at: string };

export default function Page() {
  const [items, setItems] = useState<Item[]>([]);
  const [id, setId] = useState('ERX-1001');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${CLIN}/api/careport/timeline?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
        const data = await res.json();
        setItems(data.timeline || []);
      } catch { setItems([]); }
    })();
  }, [id]);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">CarePort Rider Timeline</h1>
      <input className="border px-2 py-1 rounded" value={id} onChange={e => setId(e.target.value)} />
      <ul className="space-y-2 text-sm">
        {items.map((it, i) => (
          <li key={i} className="p-2 border rounded flex justify-between">
            <span>{it.status.replaceAll('_', ' ')}</span>
            <span className="text-gray-500">{new Date(it.at).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
