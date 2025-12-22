'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import LabTimelineItem, {
  type LabTimelineEntry,
} from '../../../components/LabTimelineItem';

type ApiItem = { status: string; at: string };

export default function MedReachTimelinePage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Prefer id, fall back to labId, then a safe mock default
  const initialId =
    searchParams.get('id') ||
    searchParams.get('labId') ||
    'LAB-2001';

  // inputValue = what's in the box
  // activeId   = what we're actually loading timeline for
  const [inputValue, setInputValue] = useState(initialId);
  const [activeId, setActiveId] = useState(initialId);

  const [items, setItems] = useState<LabTimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch timeline whenever activeId changes
  useEffect(() => {
    let mounted = true;
    const ac = new AbortController();

    const load = async () => {
      const trimmed = (activeId || '').trim();
      if (!trimmed) {
        setItems([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/medreach/timeline?id=${encodeURIComponent(trimmed)}`,
          { cache: 'no-store', signal: ac.signal },
        );

        if (!mounted) return;
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        const timeline = Array.isArray(data.timeline)
          ? (data.timeline as ApiItem[])
          : [];

        const mapped: LabTimelineEntry[] = timeline.map((it) => ({
          status: it.status,
          at: it.at,
        }));

        setItems(mapped);
      } catch (e: any) {
        if (!mounted) return;
        console.warn('MedReach timeline load failed', e);
        setItems([]);
        setError('Unable to load timeline — showing empty view.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
      ac.abort();
    };
  }, [activeId]);

  // Keep URL in sync when user hits "Load timeline"
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    setActiveId(trimmed);

    const params = new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : '',
    );
    if (trimmed) {
      params.set('id', trimmed);
    } else {
      params.delete('id');
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const displayId = activeId || inputValue || initialId;

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            MedReach Phlebotomist Timeline
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Status history for a single lab order / MedReach job.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link
            href="/medreach"
            className="px-3 py-1.5 border rounded-full bg-white hover:bg-gray-50"
          >
            Back to MedReach
          </Link>
          {displayId && (
            <Link
              href={`/medreach/track?id=${encodeURIComponent(displayId)}`}
              className="px-3 py-1.5 border rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            >
              Open patient tracking
            </Link>
          )}
        </div>
      </header>

      {/* SEARCH / INPUT PANEL */}
      <section className="bg-white border rounded-lg p-4 space-y-3">
        <form onSubmit={handleSubmit} className="space-y-2">
          <div>
            <label className="text-xs text-gray-500" htmlFor="lab-id-input">
              Lab order ID / job ID
            </label>
            <div className="mt-1 flex flex-col sm:flex-row gap-2">
              <input
                id="lab-id-input"
                className="border px-3 py-2 rounded text-sm flex-1"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="LAB-2001"
                autoComplete="off"
              />
              <button
                type="submit"
                className="px-3 py-2 text-sm rounded border bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Load timeline
              </button>
            </div>
            <div className="text-[11px] text-gray-400 mt-1">
              Usually the lab order number (e.g. LAB-2001) or MedReach job ID.
              Links from the jobs list will pre-fill this automatically.
            </div>
          </div>
        </form>

        {loading && (
          <div className="text-sm text-gray-500 mt-1">
            Loading timeline…
          </div>
        )}
        {error && (
          <div className="text-xs text-rose-600 mt-1">
            {error}
          </div>
        )}
        {!loading && !error && items.length > 0 && displayId && (
          <div className="text-[11px] text-gray-400 mt-1">
            Showing {items.length} events for{' '}
            <span className="font-mono">{displayId}</span>.
          </div>
        )}
      </section>

      {/* TIMELINE LIST */}
      <section className="space-y-2">
        {items.length === 0 && !loading ? (
          <div className="p-4 bg-white border rounded-lg text-sm text-gray-500">
            No timeline events for{' '}
            <span className="font-mono">{displayId || '—'}</span>.
          </div>
        ) : (
          <ul className="space-y-2 text-sm">
            {items.map((it, i) => (
              <LabTimelineItem key={`${it.status}-${it.at}-${i}`} item={it} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
