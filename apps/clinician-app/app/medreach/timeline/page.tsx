// apps/clinician-app/app/medreach/timeline/page.tsx
'use client';

import { useEffect, useState } from 'react';

function Timeline({ kind }: { kind: 'medreach' }) {
  const [items, setItems] = useState<any[]>([]);
  const [id, setId] = useState<string>('ERX-1001');

  useEffect(() => {
    let cancelled = false;

    async function loadTimeline() {
      try {
        const res = await fetch(`/api/${kind}/timeline?id=${encodeURIComponent(id)}`, {
          cache: 'no-store',
        });

        const data = await res.json().catch(() => ({}));

        if (!cancelled) {
          setItems(Array.isArray(data.timeline) ? data.timeline : []);
        }
      } catch {
        if (!cancelled) {
          setItems([]);
        }
      }
    }

    loadTimeline();

    return () => {
      cancelled = true;
    };
  }, [id, kind]);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">MedReach Phlebotomist Timeline</h1>

      <input
        className="border px-2 py-1 rounded"
        value={id}
        onChange={(e) => setId(e.target.value)}
      />

      <ul className="space-y-2 text-sm">
        {items.map((it, i) => (
          <li key={i} className="p-2 border rounded flex justify-between">
            <span>{String(it.status || '').replace(/_/g, ' ')}</span>
            <span className="text-gray-500">
              {it.at ? new Date(it.at).toLocaleString() : '—'}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default function Page() {
  return <Timeline kind="medreach" />;
}