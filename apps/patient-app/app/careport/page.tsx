// FILE: apps/patient-app/app/careport/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useActiveEncounter } from '../../components/context/ActiveEncounterContext';
import { toast } from '../../components/ToastMount';
import StatusBadge from '../../components/StatusBadge';
import DeliveryDestinationSheet from '@/components/careport/DeliveryDestinationSheet';

type Status = 'Idle' | 'Preparing' | 'Out for delivery' | 'Delivered';
type Rx = {
  drug: string;
  sig: string;
  status?: string;
  expiresAt?: string | null;
} | null;

type Activity = {
  id: string;
  t: string;
  msg: string;
  entity?: 'system' | 'pharmacy' | 'rider';
};

const MOCK_RX: Rx = {
  drug: 'Amoxicillin 500mg (30 caps)',
  sig: '1 capsule PO TID x 10 days',
  status: 'ACTIVE',
  expiresAt: null
};

const MOCK_ACTIVITIES: Activity[] = [
  { id: 'a1', t: new Date(Date.now() - 1000 * 60 * 60).toISOString(), msg: 'Order created', entity: 'system' },
  { id: 'a2', t: new Date(Date.now() - 1000 * 60 * 45).toISOString(), msg: 'Pharmacy assigned', entity: 'pharmacy' },
  { id: 'a3', t: new Date(Date.now() - 1000 * 60 * 20).toISOString(), msg: 'Rider en route', entity: 'rider' }
];

function LiveBadge({ connected, error }: { connected: boolean; error: string | null }) {
  return (
    <div className="flex flex-col items-end gap-0.5 text-xs">
      <div
        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-medium ${
          connected ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-gray-100 text-gray-600 border border-gray-200'
        }`}
      >
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-400'}`} aria-hidden />
        {connected ? 'Live' : 'Offline'}
      </div>
      {error ? (
        <div className="text-[11px] text-rose-600 max-w-xs text-right">{error}</div>
      ) : (
        <div className="text-[10px] text-gray-400 text-right">Live status auto-reconnects in the background.</div>
      )}
    </div>
  );
}

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
            if (data?.activity) this.push(data.activity as Activity);
            if (data?.status) {
              this.push({
                id: `status-${Date.now()}`,
                t: new Date().toISOString(),
                msg: `Status: ${data.status}`,
                entity: 'system'
              });
            }
          } catch {}
        };

        es.addEventListener('activity', (ev: MessageEvent) => {
          try {
            const a = JSON.parse((ev as any).data) as Activity;
            if (a) this.push(a);
          } catch {}
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
            this.backoff = Math.min(30000, Math.round(this.backoff * 1.8));
            tryConnect();
          }, this.backoff);
        };
      } catch (err: any) {
        this.sseConnected = false;
        this.sseError = String(err);
        this.notifyStatus();
        this.reconnectTimer = window.setTimeout(() => {
          this.backoff = Math.min(30000, Math.round(this.backoff * 1.8));
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

declare global {
  interface Window {
    __careportActivityStore?: CareportActivityStore;
  }
}

if (typeof window !== 'undefined' && !window.__careportActivityStore) {
  window.__careportActivityStore = new CareportActivityStore();
}

export default function CarePortPage() {
  const { activeEncounter, setActiveEncounter } =
    (useActiveEncounter() as any) || { activeEncounter: null, setActiveEncounter: undefined };

  const encIdFromContext = activeEncounter?.id ?? null;
  const [encId, setEncId] = useState<string | null>(encIdFromContext);

  const [encounters, setEncounters] = useState<{ id: string; label: string }[]>([]);
  const [rx, setRx] = useState<Rx>(null);
  const [loadingRx, setLoadingRx] = useState(false);

  const [marketplaceOrderId, setMarketplaceOrderId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const [activities, setActivities] = useState<Activity[]>(
    typeof window !== 'undefined' ? window.__careportActivityStore?.get() ?? MOCK_ACTIVITIES : MOCK_ACTIVITIES
  );
  const [sseConnected, setSseConnected] = useState<boolean>(
    typeof window !== 'undefined' ? window.__careportActivityStore?.sseConnected ?? false : false
  );
  const [sseError, setSseError] = useState<string | null>(null);

  const [profile, setProfile] = useState<any>(null);
  const [destOpen, setDestOpen] = useState(false);

  const [useSponsor, setUseSponsor] = useState(true);
  const [allowPartialFulfillment, setAllowPartialFulfillment] = useState(false);
  const [allowGenericSubstitution, setAllowGenericSubstitution] = useState(true);
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState<'CARD' | 'COD'>('CARD');
  const [gapPaymentMethod, setGapPaymentMethod] = useState<'CARD' | 'COD'>('CARD');

  useEffect(() => {
    fetch('/api/profile', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/encounters?mode=list', { cache: 'no-store' });
        if (!mounted) return;
        if (!res.ok) throw new Error('no encounters');
        const json = await res.json();
        if (Array.isArray(json.encounters)) {
          setEncounters(json.encounters.map((e: any) => ({ id: e.id, label: e.title ?? e.id })));
        } else if (Array.isArray(json)) {
          setEncounters(json.map((e: any) => ({ id: e.id, label: e.title ?? e.id })));
        } else {
          setEncounters([]);
        }
      } catch {
        setEncounters([
          { id: 'E-2000', label: 'Encounter E-2000 (mock)' },
          { id: 'E-2001', label: 'Encounter E-2001 (mock)' }
        ]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!encId) {
      setRx(null);
      setMarketplaceOrderId(null);
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

  useEffect(() => {
    if (!encId) return;
    let alive = true;
    fetch(`/api/careport/orders/lookup?encId=${encodeURIComponent(encId)}`, { cache: 'no-store' })
      .then((r) => r.json().then((j) => ({ r, j })))
      .then(({ r, j }) => {
        if (!alive) return;
        if (!r.ok || !j?.ok) {
          setMarketplaceOrderId(null);
          return;
        }
        setMarketplaceOrderId(j?.order?.id ? String(j.order.id) : null);
      })
      .catch(() => alive && setMarketplaceOrderId(null));
    return () => {
      alive = false;
    };
  }, [encId]);

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
        const res = await fetch(`/api/careport/lastRx?encId=${encodeURIComponent(encId)}`, { signal: ac.signal });
        if (!mounted) return;
        if (!res.ok) {
          setRx(MOCK_RX);
          return;
        }
        const json = await res.json();
        setRx(json ?? MOCK_RX);
      } catch {
        if (!mounted) return;
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

  const status = useMemo<Status>(() => {
    const mostRecentStatus = activities.slice().reverse().find((a) => /^Status:/i.test(a.msg));
    if (mostRecentStatus) {
      const parts = mostRecentStatus.msg.split(':');
      const st = parts[1]?.trim() as Status | undefined;
      if (st) return st;
    }
    return 'Idle';
  }, [activities]);

  const scriptInactive = useMemo(() => {
    if (!rx) return true;
    if (rx.status && String(rx.status).toUpperCase() === 'EXPIRED') return true;
    if (rx.expiresAt) {
      const ts = new Date(rx.expiresAt).getTime();
      if (Number.isFinite(ts) && ts < Date.now()) return true;
    }
    return false;
  }, [rx]);

  const startMarketplace = async () => {
    if (!encId) {
      toast('Select an encounter first', 'error');
      return;
    }
    if (!rx || scriptInactive) {
      toast('This prescription is not active for marketplace use.', 'error');
      return;
    }
    setDestOpen(true);
  };

  const doStartMarketplace = async (payload: { fulfillment: 'DELIVERY' | 'PICKUP'; destination?: any }) => {
    if (!encId) {
      toast('Select an encounter first', 'error');
      return;
    }

    setStarting(true);
    try {
      const res = await fetch('/api/careport/start', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': `pt-start:${encId}:${payload.fulfillment}`
        },
        body: JSON.stringify({
          encId,
          fulfillment: payload.fulfillment,
          destination: payload.destination,
          sponsorRequested: useSponsor,
          allowPartialFulfillment,
          allowGenericSubstitution,
          preferredPaymentMethod,
          gapPaymentMethod
        })
      });
      const js = await res.json().catch(() => ({}));
      if (!res.ok || !js?.ok) {
        toast(js?.error || `Failed (HTTP ${res.status})`, 'error');
        return;
      }

      const orderId = String(js.orderId || '').trim();
      if (orderId) setMarketplaceOrderId(orderId);

      const redirectUrl = String(js.redirectUrl || '').trim();
      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }

      if (orderId) {
        window.location.href = `/careport/marketplace/${encodeURIComponent(orderId)}`;
        return;
      }

      toast('Marketplace started, but no order was returned.', 'error');
    } catch (e: any) {
      toast(e?.message || 'Failed to start marketplace', 'error');
    } finally {
      setStarting(false);
      setDestOpen(false);
    }
  };

  const buildHref = (base: string) => (encId ? { pathname: base, query: { encId } } : base);

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">CarePort</h1>
          <p className="text-sm text-gray-500 mt-1">
            Patient-owned pharmacy marketplace. Start marketplace, choose pharmacy, confirm sponsor use, handle any payment gap, then track delivery or pickup.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border bg-white shadow-sm overflow-hidden">
              <span className="px-3 py-2 text-xs md:text-sm border-r bg-indigo-50 text-indigo-700">CarePort</span>

              <Link href={buildHref('/careport/track')} className="px-3 py-2 text-xs md:text-sm border-r hover:bg-gray-50">
                Track
              </Link>

              {marketplaceOrderId ? (
                <Link
                  href={`/careport/marketplace/${encodeURIComponent(marketplaceOrderId)}`}
                  className="px-3 py-2 text-xs md:text-sm border-r hover:bg-gray-50"
                >
                  Marketplace
                </Link>
              ) : (
                <span className="px-3 py-2 text-xs md:text-sm border-r text-gray-400">Marketplace</span>
              )}

              <Link href={buildHref('/careport/timeline')} className="px-3 py-2 text-xs md:text-sm border-r hover:bg-gray-50">
                Timeline
              </Link>
              <Link href={buildHref('/careport/history')} className="px-3 py-2 text-xs md:text-sm hover:bg-gray-50">
                History
              </Link>
            </div>

            <Link href="/orders" className="px-3 py-2 border rounded-full bg-white hover:bg-gray-50 text-xs md:text-sm">
              Back to Orders
            </Link>
          </div>

          <LiveBadge connected={sseConnected} error={sseError} />
        </div>
      </header>

      <section className="p-4 bg-white border rounded-lg space-y-4">
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
        </div>

        {!encId ? (
          <div className="mt-2 text-gray-500 text-sm">Please choose an encounter above.</div>
        ) : loadingRx ? (
          <div className="mt-3 animate-pulse p-3 border rounded bg-gray-50">Loading Rx…</div>
        ) : !rx ? (
          <div className="mt-2 text-gray-500 text-sm">No eRx available for this encounter.</div>
        ) : (
          <div className="p-3 border rounded bg-gray-50 mt-2 space-y-4">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Prescription</div>
              <div className="text-sm mt-1 font-medium">{rx.drug}</div>
              <div className="text-xs text-gray-600 mt-1">{rx.sig}</div>
              <div className="mt-2 text-xs">
                <span className={`inline-flex items-center px-2 py-1 rounded border ${scriptInactive ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                  {scriptInactive ? 'Script inactive' : 'Script active'}
                </span>
              </div>
            </div>

            <div className="rounded-lg border bg-white p-3 space-y-3">
              <div className="font-medium text-sm">Marketplace preferences</div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={useSponsor}
                  onChange={(e) => setUseSponsor(e.target.checked)}
                />
                Use sponsor / medical aid where available
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={allowGenericSubstitution}
                  onChange={(e) => setAllowGenericSubstitution(e.target.checked)}
                />
                Allow generic substitution
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={allowPartialFulfillment}
                  onChange={(e) => setAllowPartialFulfillment(e.target.checked)}
                />
                Allow partial fulfilment if some items are unavailable
              </label>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Preferred payment method</label>
                  <select
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    value={preferredPaymentMethod}
                    onChange={(e) => setPreferredPaymentMethod(e.target.value as 'CARD' | 'COD')}
                  >
                    <option value="CARD">Card</option>
                    <option value="COD">Cash on Delivery</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-500">Gap payment method if sponsor does not fully cover</label>
                  <select
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    value={gapPaymentMethod}
                    onChange={(e) => setGapPaymentMethod(e.target.value as 'CARD' | 'COD')}
                  >
                    <option value="CARD">Card</option>
                    <option value="COD">Cash on Delivery</option>
                  </select>
                </div>
              </div>

              <div className="text-xs text-gray-600">
                Sponsor coverage is checked separately for medication items and delivery. Any uncovered gap will be shown in checkout before you confirm payment.
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={startMarketplace}
                disabled={!encId || starting || scriptInactive}
                className="px-3 py-2 border rounded bg-black text-white hover:bg-gray-900 disabled:opacity-50 text-sm"
              >
                {starting ? 'Starting…' : 'Start CarePort Marketplace'}
              </button>

              {marketplaceOrderId ? (
                <Link
                  href={`/careport/marketplace/${encodeURIComponent(marketplaceOrderId)}`}
                  className="px-3 py-2 border rounded bg-white hover:bg-gray-100 text-sm"
                >
                  View Marketplace →
                </Link>
              ) : null}

              <StatusBadge status={status} />
            </div>

            <div className="text-xs text-gray-500">
              Marketplace start does not dispatch immediately. You will still review pharmacy offers, sponsor coverage, and any outstanding payment before checkout is completed.
            </div>
          </div>
        )}
      </section>

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
              .map((a) => (
                <li key={a.id} className="p-2 border rounded hover:bg-gray-50 transition">
                  <div className="text-sm font-medium">{a.msg}</div>
                  <div className="text-xs text-gray-500 mt-1">{new Date(a.t).toLocaleString()}</div>
                </li>
              ))
          )}
        </ul>
      </section>

      <DeliveryDestinationSheet
        open={destOpen}
        onClose={() => setDestOpen(false)}
        profileAddress={profile?.address}
        defaultCountry="za"
        onConfirm={doStartMarketplace}
      />
    </main>
  );
}