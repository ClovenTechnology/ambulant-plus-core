// apps/clinician-app/src/components/InsightStreamPanel.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

type InsightSeverity = 'info' | 'warning' | 'critical';

export type InsightEvent = {
  id: string;
  ts: string; // ISO
  type: string; // e.g. "insight" | "alert" | "recommendation" | "triage" | "note"
  title?: string;
  message?: string;
  severity?: InsightSeverity;
  payload?: any;
};

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function toIsoTs(v: any): string {
  if (!v) return new Date().toISOString();
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return isFinite(t) ? new Date(t).toISOString() : new Date().toISOString();
  }
  if (typeof v === 'number') return new Date(v).toISOString();
  return new Date().toISOString();
}

function normalizeSeverity(x: any): InsightSeverity {
  const s = String(x || '').toLowerCase();
  if (s === 'critical' || s === 'high' || s === 'danger') return 'critical';
  if (s === 'warning' || s === 'medium' || s === 'warn') return 'warning';
  return 'info';
}

function badgeClasses(sev: InsightSeverity) {
  if (sev === 'critical') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (sev === 'warning') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-indigo-50 text-indigo-700 border-indigo-200';
}

function dotClasses(status: 'connecting' | 'open' | 'error' | 'closed') {
  if (status === 'open') return 'bg-emerald-500';
  if (status === 'error') return 'bg-rose-500';
  if (status === 'connecting') return 'bg-amber-500';
  return 'bg-gray-400';
}

/**
 * InsightStreamPanel
 * - Listens to SSE endpoint: /api/insight/stream?roomId=... (and/or encounterId/patientId)
 * - Renders a small feed of AI events
 *
 * Notes:
 * - EventSource cannot send custom headers. Keep this same-origin OR use cookie auth OR include a short-lived token in query params.
 * - Your server must respond with Content-Type: text/event-stream and SSE formatted lines.
 */
export default function InsightStreamPanel(props: {
  roomId?: string;
  encounterId?: string;
  patientId?: string;
  className?: string;
  title?: string;
  limit?: number; // default 40
}) {
  const { roomId, encounterId, patientId, className, title, limit = 40 } = props;

  const url = useMemo(() => {
    const q = new URLSearchParams();
    if (roomId) q.set('roomId', roomId);
    if (encounterId) q.set('encounterId', encounterId);
    if (patientId) q.set('patientId', patientId);
    return `/api/insight/stream?${q.toString()}`;
  }, [roomId, encounterId, patientId]);

  const hasContext = Boolean(roomId || encounterId || patientId);

  const [status, setStatus] = useState<'connecting' | 'open' | 'error' | 'closed'>(
    hasContext ? 'connecting' : 'closed',
  );
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<InsightEvent[]>([]);

  const seenRef = useRef<Set<string>>(new Set());
  const esRef = useRef<EventSource | null>(null);

  function pushEvent(raw: any, fallbackType = 'insight') {
    const id =
      String(raw?.id || raw?.eventId || raw?.uuid || '') ||
      `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    if (seenRef.current.has(id)) return;
    seenRef.current.add(id);

    const ev: InsightEvent = {
      id,
      ts: toIsoTs(raw?.ts || raw?.time || raw?.createdAt || raw?.timestamp),
      type: String(raw?.type || raw?.event || raw?.kind || fallbackType || 'insight'),
      title: raw?.title ? String(raw.title) : undefined,
      message: raw?.message ? String(raw.message) : raw?.text ? String(raw.text) : undefined,
      severity: normalizeSeverity(raw?.severity || raw?.risk || raw?.level),
      payload: raw?.payload ?? raw?.data ?? (raw && typeof raw === 'object' ? raw : undefined),
    };

    setEvents((prev) => {
      const next = [ev, ...prev];
      return next.slice(0, Math.max(5, limit));
    });
  }

  useEffect(() => {
    // reset if context disappears
    if (!hasContext) {
      setStatus('closed');
      setError(null);
      setEvents([]);
      seenRef.current.clear();
      esRef.current?.close();
      esRef.current = null;
      return;
    }

    setStatus('connecting');
    setError(null);

    // Close any old stream
    esRef.current?.close();
    esRef.current = null;

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      setStatus('open');
      setError(null);
    };

    es.onerror = () => {
      // EventSource will retry by itself; we just show an indicator
      setStatus('error');
      setError('Stream disconnected — retrying…');
    };

    es.onmessage = (msg) => {
      const data = String(msg?.data ?? '');
      if (!data) return;
      if (data === 'ping' || data === 'keepalive') return;

      const parsed = safeJsonParse(data);
      if (parsed == null) return;

      // Support either a single event or a batch { events: [...] }
      if (Array.isArray(parsed?.events)) {
        for (const item of parsed.events) pushEvent(item, 'insight');
      } else {
        pushEvent(parsed, 'insight');
      }

      setStatus('open');
      setError(null);
    };

    // If the server uses SSE "event: insight" / "event: alert", capture them too:
    const typed = (type: string) => (e: MessageEvent) => {
      const parsed = safeJsonParse(String(e.data ?? ''));
      if (parsed == null) return;
      pushEvent(parsed, type);
      setStatus('open');
      setError(null);
    };

    const types = ['insight', 'alert', 'recommendation', 'triage', 'note', 'task'];
    for (const t of types) es.addEventListener(t, typed(t) as any);

    return () => {
      try {
        for (const t of types) es.removeEventListener(t, typed(t) as any);
      } catch {}
      es.close();
      esRef.current = null;
      setStatus('closed');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, hasContext]);

  return (
    <section
      className={[
        'rounded-lg border bg-white shadow-sm',
        className || '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3 border-b p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${dotClasses(status)}`} />
            <h3 className="text-sm font-semibold text-slate-900">
              {title || 'Insight Stream'}
            </h3>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {hasContext ? (
              <>
                {roomId ? <>roomId: <span className="font-mono">{roomId}</span></> : null}
                {encounterId ? <> · encounterId: <span className="font-mono">{encounterId}</span></> : null}
                {patientId ? <> · patientId: <span className="font-mono">{patientId}</span></> : null}
              </>
            ) : (
              'No context selected'
            )}
          </div>
          {error && <div className="mt-1 text-xs text-amber-700">{error}</div>}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEvents([]);
              seenRef.current.clear();
            }}
            className="rounded border bg-white px-2 py-1 text-xs hover:bg-gray-50"
            title="Clear feed"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="max-h-[340px] overflow-auto p-3">
        {!hasContext ? (
          <div className="rounded border border-dashed p-3 text-xs text-gray-500">
            Select an encounter / room to see live AI events.
          </div>
        ) : events.length === 0 ? (
          <div className="rounded border border-dashed p-3 text-xs text-gray-500">
            Waiting for insights…
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((e) => {
              const sev = e.severity ?? 'info';
              return (
                <div key={e.id} className="rounded-lg border p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${badgeClasses(sev)}`}>
                          {sev}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-700">
                          {e.type}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {new Date(e.ts).toLocaleString()}
                        </span>
                      </div>

                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {e.title || 'AI update'}
                      </div>
                      {e.message && (
                        <div className="mt-0.5 text-sm text-gray-700">
                          {e.message}
                        </div>
                      )}
                    </div>
                  </div>

                  {e.payload != null && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-indigo-700">
                        Details
                      </summary>
                      <pre className="mt-2 overflow-auto rounded bg-slate-950 p-2 text-[11px] text-slate-100">
                        {JSON.stringify(e.payload, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
