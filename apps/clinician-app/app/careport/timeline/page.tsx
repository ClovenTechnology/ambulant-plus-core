'use client';

import { useEffect, useState } from 'react';

function Timeline({ kind }: { kind: 'erx' | 'lab' }) {
  const [items, setItems] = useState<Array<{ status: string; at: string }>>([]);
  const [id, setId] = useState<string>(kind === 'erx' ? 'ERX-1001' : 'LAB-2001');
  const [loading, setLoading] = useState(false);
  const title =
    kind === 'erx' ? 'CarePort (Pharmacy) Timeline' : 'MedReach (Phlebotomy) Timeline';

  useEffect(() => {
    let on = true;
    (async () => {
      if (!id) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/${kind}/timeline?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
        const data = await res.json();
        if (!on) return;
        setItems(Array.isArray(data.timeline) ? data.timeline : []);
      } catch {
        if (on) setItems([]);
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => { on = false; };
  }, [id, kind]);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">{title}</h1>

      <div className="flex items-center gap-2">
        <input
          className="border px-2 py-1 rounded w-48"
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder={kind === 'erx' ? 'ERX-1001' : 'LAB-2001'}
        />
        <span className="text-xs text-gray-500">Enter an order ID returned by the POST API.</span>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : !items.length ? (
        <div className="text-sm text-gray-500">No timeline yet for <span className="font-mono">{id}</span>.</div>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((it, i) => (
            <li key={i} className="p-2 border rounded flex justify-between bg-white">
              <span className="capitalize">{it.status.replaceAll('_', ' ')}</span>
              <span className="text-gray-500">{new Date(it.at).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default function Page() {
  // CarePort timeline focuses on ERX by default
  return <Timeline kind="erx" />;
}
