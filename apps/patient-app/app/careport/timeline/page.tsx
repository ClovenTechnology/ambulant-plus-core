// apps/patient-app/app/careport/timeline/page.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

type TimelineItem = {
  status: string;
  at: string;
  note?: string | null;
  actor?: string | null;
};

type TimelineRecord = Record<string, unknown>;

function prettyStatus(status: string) {
  return String(status || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (m) => m.toUpperCase());
}


function timelineTone(status: string) {
  const s = String(status || '').toUpperCase();

  if (['DELIVERED', 'COLLECTED', 'COMPLETED'].includes(s)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }

  if (
    [
      'PAID',
      'PREPARING',
      'READY_FOR_PICKUP',
      'DISPATCHING',
      'RIDER_ASSIGNED',
      'EN_ROUTE_TO_PICKUP',
      'AT_PHARMACY',
      'PICKED_UP',
      'EN_ROUTE_TO_CUSTOMER',
      'DISPATCHED',
      'OUT_FOR_DELIVERY',
    ].includes(s)
  ) {
    return 'border-blue-200 bg-blue-50 text-blue-800';
  }

  if (['PAYMENT_PENDING', 'OFFERS_OPEN', 'CREATED', 'BROADCASTING', 'PHARMACY_SELECTED'].includes(s)) {
    return 'border-amber-200 bg-amber-50 text-amber-900';
  }

  if (['FAILED', 'CANCELLED', 'REJECTED', 'EXPIRED'].includes(s)) {
    return 'border-rose-200 bg-rose-50 text-rose-800';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}
function isValidTimelineItem(value: unknown): value is TimelineItem {
  if (!value || typeof value !== 'object') return false;

  const item = value as Record<string, unknown>;
  return typeof item.status === 'string' && typeof item.at === 'string';
}

function extractTimelineItems(payload: unknown): TimelineItem[] {
  if (Array.isArray(payload)) {
    return payload.filter(isValidTimelineItem);
  }

  if (!payload || typeof payload !== 'object') return [];

  const data = payload as TimelineRecord;

  const directItems = data.items;
  if (Array.isArray(directItems)) {
    return directItems.filter(isValidTimelineItem);
  }

  const directEvents = data.events;
  if (Array.isArray(directEvents)) {
    return directEvents.filter(isValidTimelineItem);
  }

  const timeline = data.timeline;
  if (Array.isArray(timeline)) {
    return timeline.filter(isValidTimelineItem);
  }

  if (timeline && typeof timeline === 'object' && !Array.isArray(timeline)) {
    const nested = timeline as TimelineRecord;
    if (Array.isArray(nested.items)) {
      return nested.items.filter(isValidTimelineItem);
    }
  }

  const dataWrapper = data.data;
  if (dataWrapper && typeof dataWrapper === 'object') {
    return extractTimelineItems(dataWrapper);
  }

  return [];
}

function formatTimelineDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';

  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function TimelinePageContent() {
  const searchParams = useSearchParams();
  const qs = useMemo(
    () => new URLSearchParams(searchParams?.toString() ?? ''),
    [searchParams],
  );

  const initialId = useMemo(
    () =>
      (
        qs.get('orderId') ||
        qs.get('trackingId') ||
        qs.get('erxId') ||
        qs.get('encId') ||
        qs.get('id') ||
        ''
      ).trim(),
    [qs],
  );

  const [id, setId] = useState(initialId);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    setId(initialId);
  }, [initialId]);

  const load = useCallback(async (raw: string) => {
    const value = raw.trim();

    if (!value) {
      setItems([]);
      setError('Enter an eRx, order, encounter, or tracking ID to view its pharmacy delivery timeline.');
      return;
    }

    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/careport/timeline?id=${encodeURIComponent(value)}`, {
        cache: 'no-store',
        signal: abortController.signal,
      });

      if (!mountedRef.current) return;

      if (!response.ok) {
        setItems([]);
        setError('CarePort could not load this pharmacy delivery timeline. Please check the ID and try again.');
        return;
      }

      const payload = (await response.json().catch(() => null)) as unknown;
      const timeline = extractTimelineItems(payload)
        .slice()
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

      if (timeline.length === 0) {
        setItems([]);
        setError('No pharmacy or delivery rider events were found for this ID.');
        return;
      }

      setItems(timeline);
    } catch (err) {
      if (!mountedRef.current || abortController.signal.aborted) return;
      console.error('Failed to load CarePort timeline', err);
      setItems([]);
      setError('Unable to reach the CarePort timeline service. Please try again.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialId) {
      void load(initialId);
    } else {
      setItems([]);
      setError(null);
    }
  }, [initialId, load]);

  const placeholder = useMemo(() => {
    if (id.trim()) return id.trim();
    return 'e.g. CarePort order ID, eRx order ID, encounter ID, or job tracking ID';
  }, [id]);

  return (
    <main data-p-ui="patient-careport-timeline-page" className="min-w-0 overflow-x-clip mx-auto max-w-4xl space-y-4 p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">
            CarePort Pharmacy Delivery Timeline
          </h1>
          <p className="mt-1 text-xs text-slate-500 md:text-sm">
            View pharmacy fulfilment, dispatch, and delivery rider events for an eRx, order, or tracking ID.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <a
            href="/careport/history"
            className="rounded-xl border bg-white px-3 py-2 shadow-sm hover:bg-slate-50"
          >
            History
          </a>
          <a
            href="/careport"
            className="rounded-xl border bg-white px-3 py-2 shadow-sm hover:bg-slate-50"
          >
            ← Back to CarePort
          </a>
          <a
            href={initialId ? `/careport/track?orderId=${encodeURIComponent(initialId)}` : '/careport/track'}
            className="rounded-xl border bg-white px-3 py-2 shadow-sm hover:bg-slate-50"
          >
            Open tracking
          </a>
        </div>
      </header>

      <section className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
        <div>
          <label htmlFor="timeline-id" className="text-xs font-medium text-slate-500">
            CarePort / eRx / Encounter / Job ID
          </label>

          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="timeline-id"
              className="flex-1 rounded-xl border px-3 py-2 text-sm"
              value={id}
              onChange={(event) => setId(event.target.value)}
              placeholder={placeholder}
            />
            <button
              onClick={() => void load(id)}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              type="button"
              disabled={loading}
            >
              {loading ? 'Loading…' : 'Load'}
            </button>
          </div>

          <p className="mt-1 text-[11px] text-slate-400">
            Use a valid CarePortOrder.id, erxOrderId, encounterId, patientId, CarePortJob.id, or CarePortJob.externalId if your API supports those lookups.
          </p>
        </div>

        {error && !loading ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            {error}
          </div>
        ) : null}

        {loading ? <div className="text-sm text-slate-500">Loading timeline…</div> : null}
      </section>

      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-slate-900">Events</h2>

        {items.length === 0 && !loading ? (
          <p className="text-sm text-slate-500">
            No events to show yet. Enter a valid CarePort order, eRx, encounter, patient, or job tracking ID.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {items.map((item, index) => (
              <li
                key={`${item.status}-${item.at}-${index}`}
                className={`rounded-xl border px-3 py-2 ${timelineTone(item.status)}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-900">{prettyStatus(item.status)}</span>
                  <span className="text-xs text-slate-500">{formatTimelineDate(item.at)}</span>
                </div>

                {item.actor || item.note ? (
                  <div className="mt-1 text-xs text-slate-500">
                    {item.actor ? <span>{item.actor}</span> : null}
                    {item.actor && item.note ? <span> · </span> : null}
                    {item.note ? <span>{item.note}</span> : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

export default function TimelinePage() {
  return (
    <Suspense fallback={null}>
      <TimelinePageContent />
    </Suspense>
  );
}

