'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useActiveEncounter } from '../../components/context/ActiveEncounterContext';
import { toast } from '../../components/ToastMount';
import StatusBadge from '../../components/StatusBadge';

/* ---------------- types ---------------- */
type Status = 'Idle' | 'Preparing' | 'Out for delivery' | 'Delivered';
type Rx = { drug: string; sig: string } | null;
type Activity = {
  id: string;
  t: string;
  msg: string;
  entity?: 'system' | 'pharmacy' | 'rider';
};

/* ---------------- mocks (fallbacks) ---------------- */
const MOCK_RX: Rx = {
  drug: 'Amoxicillin 500mg (30 caps)',
  sig: '1 capsule PO TID x 10 days',
};
const MOCK_ACTIVITIES: Activity[] = [
  {
    id: 'a1',
    t: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    msg: 'Order created',
    entity: 'system',
  },
  {
    id: 'a2',
    t: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    msg: 'Pharmacy assigned',
    entity: 'pharmacy',
  },
  {
    id: 'a3',
    t: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    msg: 'Rider en route',
    entity: 'rider',
  },
];

/* ---------------- small UI helpers ---------------- */

function LiveBadge({
  connected,
  error,
}: {
  connected: boolean;
  error: string | null;
}) {
  return (
    <div className="flex flex-col items-end gap-0.5 text-xs">
      <div
        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-medium ${
          connected
            ? 'bg-green-50 text-green-700 border border-green-100'
            : 'bg-gray-100 text-gray-600 border border-gray-200'
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            connected ? 'bg-green-500' : 'bg-gray-400'
          }`}
          aria-hidden
        />
        {connected ? 'Live' : 'Offline'}
      </div>
      {error ? (
        <div className="text-[11px] text-rose-600 max-w-xs text-right">
          {error}
        </div>
      ) : (
        <div className="text-[10px] text-gray-400 text-right">
          Live status auto-reconnects in the background.
        </div>
      )}
    </div>
  );
}

/* ---------------- Shared Activities Store ---------------- */
type Sub = (activities: Activity[]) => void;
type SSEStatusSub = (connected: boolean, error?: string | null) => void;

class CareportActivityStore {
  activities: Activity[] = [];
  subs: Set<Sub> = new Set();
  sseStatusSubs: Set<SSEStatusSub> = new Set();
  es: EventSource | null = null;
  backoff = 500;
  reconnectTimer: number | null = null;
  sseConnected = false;
  sseError: string | null = null;
  encId: string | null = null;

  constructor() {
    this.activities = MOCK_ACTIVITIES.slice();
  }

  get() {
    return this.activities.slice();
  }

  subscribe(fn: Sub) {
    this.subs.add(fn);
    fn(this.get());
    return () => this.subs.delete(fn);
  }

  subscribeStatus(fn: SSEStatusSub) {
    this.sseStatusSubs.add(fn);
    fn(this.sseConnected, this.sseError);
    return () => this.sseStatusSubs.delete(fn);
  }

  push(activity: Activity) {
    if (activity.id && this.activities.some((a) => a.id === activity.id)) return;
    this.activities = [...this.activities.slice(-19), activity];
    for (const s of this.subs) s(this.get());
  }

  notifyStatus() {
    for (const s of this.sseStatusSubs) s(this.sseConnected, this.sseError);
  }

  async connect(encId?: string | null) {
    if (encId !== undefined) this.encId = encId;

    try {
      this.es?.close();
    } catch {}
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.es = null;
    this.sseConnected = false;
    this.sseError = null;
    this.notifyStatus();

    const tryConnect = () => {
      try {
        const param = this.encId ? `?encId=${encodeURIComponent(this.encId)}` : '';
        const url = `/api/careport/stream${param}`;
        const es = new EventSource(url);
        this.es = es;

        es.onopen = () => {
          this.backoff = 500;
          this.sseConnected = true;
          this.sseError = null;
          this.notifyStatus();
        };

        es.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            if (data?.activity) {
              this.push(data.activity as Activity);
            }
            if (data?.status) {
              this.push({
                id: `status-${Date.now()}`,
                t: new Date().toISOString(),
                msg: `Status: ${data.status}`,
                entity: 'system',
              });
            }
          } catch (err) {
            console.warn('ActivityStore parse failed', err);
          }
        };

        es.addEventListener('activity', (ev: MessageEvent) => {
          try {
            const a = JSON.parse(ev.data) as Activity;
            if (a) this.push(a);
          } catch (err) {
            console.warn('activity event parse failed', err);
          }
        });

        es.onerror = () => {
          this.sseConnected = false;
          this.sseError = 'Connection error — reconnecting';
          this.notifyStatus();
          try {
            es.close();
          } catch {}
          this.es = null;
          this.reconnectTimer = window.setTimeout(() => {
            this.backoff = Math.min(30_000, Math.round(this.backoff * 1.8));
            tryConnect();
          }, this.backoff);
        };
      } catch (err: any) {
        this.sseConnected = false;
        this.sseError = String(err);
        this.notifyStatus();
        this.reconnectTimer = window.setTimeout(() => {
          this.backoff = Math.min(30_000, Math.round(this.backoff * 1.8));
          tryConnect();
        }, this.backoff);
      }
    };

    tryConnect();
  }

  disconnect() {
    try {
      this.es?.close();
    } catch {}
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.es = null;
    this.sseConnected = false;
    this.sseError = null;
    this.notifyStatus();
  }
}

// attach singleton to window for cross-page sharing
declare global {
  interface Window {
    __careportActivityStore?: CareportActivityStore;
  }
}

if (typeof window !== 'undefined' && !window.__careportActivityStore) {
  window.__careportActivityStore = new CareportActivityStore();
}

/* ---------------- Component ---------------- */

export default function CarePortPage() {
  const { activeEncounter, setActiveEncounter } =
    (useActiveEncounter() as any) || {
      activeEncounter: null,
      setActiveEncounter: undefined,
    };

  const encIdFromContext = activeEncounter?.id ?? null;
  const [encId, setEncId] = useState<string | null>(encIdFromContext);

  const [encounters, setEncounters] = useState<{ id: string; label: string }[]>(
    [],
  );
  const [rx, setRx] = useState<Rx>(null);
  const [status, setStatus] = useState<Status>('Idle');
  const [loading, setLoading] = useState(false);
  const [loadingRx, setLoadingRx] = useState(false);

  // activities from shared store
  const [activities, setActivities] = useState<Activity[]>(
    typeof window !== 'undefined'
      ? window.__careportActivityStore?.get() ?? MOCK_ACTIVITIES
      : MOCK_ACTIVITIES,
  );
  const [sseConnected, setSseConnected] = useState<boolean>(
    typeof window !== 'undefined'
      ? window.__careportActivityStore?.sseConnected ?? false
      : false,
  );
  const [sseError, setSseError] = useState<string | null>(null);

  // subscribe to store once per encId
  useEffect(() => {
    const store = window.__careportActivityStore!;
    const unsub = store.subscribe((list) => setActivities(list));
    const unsubStatus = store.subscribeStatus((connected, err) => {
      setSseConnected(connected);
      setSseError(err ?? null);
    });
    store.connect(encId ?? undefined);
    return () => {
      unsub();
      unsubStatus();
    };
  }, [encId]);

  // encounters list
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/encounters?mode=list', {
          cache: 'no-store',
        });
        if (!mounted) return;
        if (!res.ok) throw new Error('no encounters');
        const json = await res.json();
        if (Array.isArray(json.encounters)) {
          setEncounters(
            json.encounters.map((e: any) => ({
              id: e.id,
              label: e.title ?? e.id,
            })),
          );
        } else if (Array.isArray(json)) {
          setEncounters(
            json.map((e: any) => ({
              id: e.id,
              label: e.title ?? e.id,
            })),
          );
        } else {
          setEncounters([]);
        }
      } catch (err) {
        setEncounters([
          { id: 'E-2000', label: 'Encounter E-2000 (mock)' },
          { id: 'E-2001', label: 'Encounter E-2001 (mock)' },
        ]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // sync encId -> global active encounter + activity store
  useEffect(() => {
    if (!encId) {
      setRx(null);
      window.__careportActivityStore?.connect(undefined);
      return;
    }
    if (typeof setActiveEncounter === 'function') {
      try {
        setActiveEncounter({ id: encId });
      } catch {}
    }
    window.__careportActivityStore?.connect(encId);
  }, [encId, setActiveEncounter]);

  // load lastRx when encId changes
  useEffect(() => {
    if (!encId) {
      setRx(null);
      return;
    }
    let mounted = true;
    const ac = new AbortController();
    setLoadingRx(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/careport/lastRx?encId=${encodeURIComponent(encId)}`,
          { signal: ac.signal },
        );
        if (!mounted) return;
        if (!res.ok) {
          setRx(MOCK_RX);
          return;
        }
        const json = await res.json();
        setRx(json ?? MOCK_RX);
      } catch (err) {
        if (!mounted) return;
        console.warn('lastRx load failed — using mock', err);
        setRx(MOCK_RX);
      } finally {
        if (mounted) setLoadingRx(false);
      }
    })();
    return () => {
      mounted = false;
      ac.abort();
    };
  }, [encId]);

  // derive status from activities
  useEffect(() => {
    const mostRecentStatus = activities
      .slice()
      .reverse()
      .find((a) => /^Status:/i.test(a.msg));
    if (mostRecentStatus) {
      const parts = mostRecentStatus.msg.split(':');
      const st = parts[1]?.trim() as Status | undefined;
      if (st) setStatus(st);
    }
  }, [activities]);

  // dispatch action
  const dispatch = async () => {
    if (!rx || !encId) {
      toast('No prescription or encounter selected', 'error');
      return;
    }

    // tiny confirmation to avoid accidental dispatch
    if (typeof window !== 'undefined') {
      const ok = window.confirm(
        `Dispatch CarePort delivery for encounter ${encId}?`,
      );
      if (!ok) return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/careport/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encId }),
      });
      if (!res.ok) throw new Error('Dispatch failed');
      toast('CarePort: dispatch requested', 'info');
      const a: Activity = {
        id: `local-${Date.now()}`,
        t: new Date().toISOString(),
        msg: 'Dispatch requested',
        entity: 'system',
      };
      window.__careportActivityStore?.push(a);
    } catch (err) {
      toast('Failed to dispatch order', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const dispatchLabel = useMemo(() => {
    if (status === 'Delivered') return 'Delivered';
    if (loading) return 'Dispatching...';
    return 'Dispatch via CarePort';
  }, [status, loading]);

  const dispatchDisabled = useMemo(
    () => loading || status === 'Delivered' || !rx || !encId,
    [loading, status, rx, encId],
  );

  // helper to carry encId through to child pages
  const buildHref = (base: string) =>
    encId ? { pathname: base, query: { encId } } : base;

  /* ---------------- render ---------------- */

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      {/* HEADER + NAV */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">CarePort Dispatch</h1>
          <p className="text-sm text-gray-500 mt-1">
            Dispatch prescriptions for same-day delivery and track progress in
            real time.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* main CarePort actions */}
            <div className="inline-flex rounded-full border bg-white shadow-sm overflow-hidden">
              <span className="px-3 py-2 text-xs md:text-sm border-r bg-indigo-50 text-indigo-700">
                Dispatch
              </span>
              <Link
                href={buildHref('/careport/track')}
                className="px-3 py-2 text-xs md:text-sm border-r hover:bg-gray-50"
              >
                Track
              </Link>
              <Link
                href={buildHref('/careport/reorder')}
                className="px-3 py-2 text-xs md:text-sm border-r hover:bg-gray-50"
              >
                Reorder
              </Link>
              <Link
                href={buildHref('/careport/reprint')}
                className="px-3 py-2 text-xs md:text-sm border-r hover:bg-gray-50"
              >
                Reprint
              </Link>
              <Link
                href={buildHref('/careport/timeline')}
                className="px-3 py-2 text-xs md:text-sm border-r hover:bg-gray-50"
              >
                Timeline
              </Link>
              <Link
                href={buildHref('/careport/history')}
                className="px-3 py-2 text-xs md:text-sm hover:bg-gray-50"
              >
                History
              </Link>
            </div>

            {/* back to orders */}
            <Link
              href="/orders"
              className="px-3 py-2 border rounded-full bg-white hover:bg-gray-50 text-xs md:text-sm"
            >
              Back to Orders
            </Link>
          </div>

          <LiveBadge connected={sseConnected} error={sseError} />
        </div>
      </header>

      {/* Encounter selector */}
      <section className="p-4 bg-white border rounded-lg space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <label className="text-xs text-gray-500">Select encounter</label>
            <div className="mt-1 flex flex-col sm:flex-row sm:items-center gap-2">
              <select
                aria-label="Select encounter"
                className="border rounded px-3 py-2 min-w-[260px]"
                value={encId ?? ''}
                onChange={(e) => setEncId(e.target.value || null)}
              >
                <option value="">— choose encounter —</option>
                {encounters.map((ec) => (
                  <option key={ec.id} value={ec.id}>
                    {ec.label}
                  </option>
                ))}
              </select>

              {encId && (
                <div className="text-sm text-gray-500">
                  Selected: <span className="font-medium">{encId}</span>
                </div>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Not all eRx are eligible for CarePort delivery — pick the encounter
              to see last Rx and dispatch options.
            </div>
          </div>
        </div>

        {/* RX + dispatch UI */}
        {!encId ? (
          <div className="mt-2 flex items-start gap-2 text-gray-500 text-sm">
            <span className="text-lg" aria-hidden>
              ☝️
            </span>
            <div>
              Please choose an encounter above to load prescriptions and dispatch
              options.
            </div>
          </div>
        ) : loadingRx ? (
          <div className="mt-3 space-y-2">
            <div className="animate-pulse p-3 border rounded bg-gray-50">
              <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-1" />
              <div className="h-3 bg-gray-100 rounded w-3/4" />
            </div>
          </div>
        ) : !rx ? (
          <div className="mt-2 text-gray-500 text-sm">
            No eRx available for this encounter (patient may pick up in-store).
          </div>
        ) : (
          <div className="p-3 border rounded bg-gray-50 mt-2">
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              Prescription
            </div>
            <div className="text-sm mt-1 font-medium">{rx.drug}</div>
            <div className="text-xs text-gray-600 mt-1">{rx.sig}</div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={dispatch}
                disabled={dispatchDisabled}
                className="px-3 py-2 border rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 text-sm"
              >
                {dispatchLabel}
              </button>
              <StatusBadge status={status} />
              <Link
                href="/orders"
                className="text-xs text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline"
              >
                View full script →
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Recent activity (from shared store) */}
      <section className="p-4 bg-white border rounded-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Recent activity</h2>
          <div className="text-xs text-gray-500">Live updates</div>
        </div>

        <ul className="mt-3 space-y-2 text-sm" aria-live="polite">
          {activities.length === 0 ? (
            <li className="text-gray-500 text-sm">No recent activity.</li>
          ) : (
            activities
              .slice()
              .reverse()
              .slice(0, 8)
              .map((a) => {
                const icon =
                  a.entity === 'pharmacy'
                    ? '🏥'
                    : a.entity === 'rider'
                    ? '🏍️'
                    : 'ℹ️';
                const entityLabel =
                  a.entity === 'pharmacy'
                    ? 'Pharmacy'
                    : a.entity === 'rider'
                    ? 'Rider'
                    : 'System';

                return (
                  <li
                    key={a.id}
                    className="relative pl-6 pb-3 p-2 border rounded flex items-start justify-between gap-3 hover:bg-gray-50 transition"
                  >
                    {/* vertical timeline rail */}
                    <div
                      className="absolute left-3 top-0 bottom-0 border-l border-gray-200"
                      aria-hidden
                    />
                    <div className="absolute left-2.5 top-3 w-2 h-2 rounded-full bg-indigo-500" />

                    <div className="flex items-start gap-2 ml-2">
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs">
                        {icon}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{a.msg}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(a.t).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {entityLabel}
                    </div>
                  </li>
                );
              })
          )}
        </ul>

        <div className="mt-3 flex flex-wrap gap-2 justify-between items-center">
          <Link
            href={buildHref('/careport/timeline')}
            className="text-xs text-gray-600 hover:text-gray-900 underline-offset-2 hover:underline"
          >
            View full delivery timeline
          </Link>
          <Link
            href={buildHref('/careport/history')}
            className="text-xs text-gray-600 hover:text-gray-900 underline-offset-2 hover:underline"
          >
            View delivery history
          </Link>
          <Link
            href={buildHref('/careport/track')}
            className="text-xs px-3 py-1 rounded border bg-white hover:bg-gray-50"
          >
            Open tracking →
          </Link>
        </div>
      </section>
    </main>
  );
}
