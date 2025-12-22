// apps/patient-app/app/careport/timeline/page.tsx
'use client';

import React, { useEffect, useState } from 'react';

type Item = { status: string; at: string };

const MOCK_TIMELINE: Item[] = [
  {
    status: 'ORDER_CREATED',
    at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  {
    status: 'PHARMACY_ASSIGNED',
    at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    status: 'RIDER_EN_ROUTE',
    at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  },
];

type TimelinePageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export default function TimelinePage({ searchParams }: TimelinePageProps) {
  const encIdFromQuery =
    (searchParams?.encId as string | undefined) ||
    (searchParams?.id as string | undefined) ||
    '';

  const [id, setId] = useState(encIdFromQuery);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !id.trim()) {
      setItems([]);
      setError('Enter an eRx, encounter or tracking ID to view its timeline.');
      return;
    }

    let mounted = true;
    const ac = new AbortController();

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/careport/timeline?id=${encodeURIComponent(
          id.trim(),
        )}`;
        const res = await fetch(url, {
          cache: 'no-store',
          signal: ac.signal,
        });

        if (!mounted) return;

        if (!res.ok) {
          console.warn(
            'Timeline API returned non-OK status, using mock fallback',
          );
          setItems(MOCK_TIMELINE);
          setError('Live timeline unavailable — showing a recent mock example.');
          return;
        }

        const data = await res.json();
        const timeline: Item[] =
          (Array.isArray(data.timeline)
            ? data.timeline
            : data.timeline?.items) ||
          (Array.isArray(data) ? data : []);

        if (!timeline || timeline.length === 0) {
          setItems([]);
          setError('No timeline events found for this ID.');
        } else {
          setItems(timeline);
        }
      } catch (err) {
        if (!mounted || ac.signal.aborted) return;
        console.error('Failed to load timeline; using mock fallback', err);
        setItems(MOCK_TIMELINE);
        setError('Unable to reach timeline service — showing a mock example.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      ac.abort();
    };
  }, [id]);

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">
            CarePort Delivery Timeline
          </h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1">
            View the event timeline for a specific eRx / encounter / tracking
            ID.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <a
            href="/careport"
            className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
          >
            ← Back to CarePort
          </a>
          <a
            href="/careport/track"
            className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
          >
            Open tracking
          </a>
        </div>
      </header>

      <section className="bg-white border rounded-lg p-4 space-y-3">
        <div>
          <label htmlFor="timeline-id" className="text-xs text-gray-500">
            eRx / Encounter / Tracking ID
          </label>
          <div className="mt-1 flex flex-col sm:flex-row gap-2">
            <input
              id="timeline-id"
              className="border px-3 py-2 rounded text-sm flex-1"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="e.g. ERX-1001 or ENC-2001"
            />
          </div>
          <p className="mt-1 text-[11px] text-gray-400">
            If you opened this from CarePort Dispatch, the current encounter ID
            is pre-filled.
          </p>
        </div>

        {loading && (
          <div className="text-sm text-gray-500">Loading timeline…</div>
        )}
        {!loading && error && (
          <div className="text-xs text-rose-600 mt-1">{error}</div>
        )}
      </section>

      <section className="bg-white border rounded-lg p-4">
        <h2 className="text-sm font-medium mb-3">Events</h2>
        {items.length === 0 && !loading ? (
          <p className="text-sm text-gray-500">
            No events to show yet. Check the ID above or try again later.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {items.map((it, i) => (
              <li
                key={`${it.status}-${it.at}-${i}`}
                className="p-2 border rounded flex justify-between items-center bg-gray-50"
              >
                <span className="font-medium">
                  {it.status.replaceAll('_', ' ')}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(it.at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
