'use client';
import React, { useEffect, useState, useCallback } from 'react';

type Encounter = {
  id: string;
  ts: string;
  source: string;
  visitId?: string;
  text: string;
};

export default function EncountersClient({ initial }: { initial: Encounter[] }) {
  const [items, setItems] = useState<Encounter[]>(initial);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setErr(null);
      const res = await fetch('/api/encounters', { cache: 'no-store' });
      const data: Encounter[] = await res.json();
      setItems(data.slice().sort((a, b) => (a.ts < b.ts ? 1 : -1))); // newest first
    } catch (e) {
      setErr('Failed to refresh encounters');
    } finally {
      setLoading(false);
    }
  }, []);

  // If you navigate here after adding a note, this makes the list fresh immediately.
  useEffect(() => {
    // NOTE: we could rely on `initial`, but this ensures the UI always matches /api now.
    load();
  }, [load]);

  // Auto-refresh on tab focus
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Encounters</h1>
        <button
          onClick={load}
          className="px-3 py-2 border rounded bg-white hover:bg-gray-50 text-sm disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {err ? (
        <div className="p-3 border rounded bg-red-50 text-sm text-red-700">{err}</div>
      ) : null}

      {items.length === 0 ? (
        <div className="p-4 border rounded bg-white text-sm text-gray-600">
          No encounter notes yet. Add from{' '}
          <a className="underline" href="/televisit/demo-123">Televisit</a>.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((e) => (
            <li key={e.id} className="p-4 border rounded-lg bg-white">
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span>{new Date(e.ts).toLocaleString()}</span>
                <span></span>
                <span className="uppercase">{e.source}</span>
                {e.visitId ? (<><span></span><span>Visit: {e.visitId}</span></>) : null}
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm">{e.text}</div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
