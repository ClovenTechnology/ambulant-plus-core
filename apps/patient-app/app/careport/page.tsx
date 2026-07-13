// FILE: apps/patient-app/app/careport/page.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useActiveEncounter } from '../../components/context/ActiveEncounterContext';
import { toast } from '../../components/ToastMount';
import StatusBadge from '../../components/StatusBadge';
import DeliveryDestinationSheet from '@/components/careport/DeliveryDestinationSheet';

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

type EncounterOption = {
  id: string;
  label: string;
};

type ProfilePayload = {
  ok?: boolean;
  address?: string | null;
  patientId?: string | null;
  name?: string | null;
};

type ExistingOrder = {
  id: string;
  status?: string | null;
  fulfillment?: 'DELIVERY' | 'PICKUP' | string | null;
  createdAt?: string | null;
  destinationAddr?: string | null;
  chosenPharmacyId?: string | null;
  chosenOfferId?: string | null;
};

type DestinationPayload = {
  fulfillment: 'DELIVERY' | 'PICKUP';
  destination?: {
    label: string;
    addr: string;
    lat: number;
    lng: number;
    source: 'last' | 'home' | 'gps' | 'manual';
  };
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function formatWhen(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function normalizeEncounterOptions(payload: any): EncounterOption[] {
  const direct = asArray(payload?.encounters);
  const fromCases = asArray(payload?.cases).flatMap((c: any) => asArray(c?.encounters));

  const source = direct.length ? direct : fromCases;

  return source
    .map((e: any) => {
      const id = String(e?.id || e?.encounterId || '').trim();
      if (!id) return null;

      const date = e?.startedAt || e?.createdAt || e?.updatedAt || '';
      const clinician =
        e?.clinician?.name ||
        e?.clinicianName ||
        e?.clinicianId ||
        'Clinician';
      const label = `${clinician}${date ? ` • ${formatWhen(date)}` : ''}`;

      return { id, label };
    })
    .filter(Boolean)
    .slice(0, 50) as EncounterOption[];
}

function normalizeRx(payload: any): Rx {
  if (!payload || payload?.ok === false) return null;

  const drug = String(payload?.drug || payload?.name || payload?.medication || '').trim();
  const sig = String(payload?.sig || payload?.directions || payload?.instructions || '').trim();

  if (!drug) return null;

  return {
    drug,
    sig: sig || 'Use as directed',
    status: payload?.status ? String(payload.status) : 'ACTIVE',
    expiresAt: payload?.expiresAt ?? null,
  };
}

function normalizeOrder(payload: any): ExistingOrder | null {
  const row = payload?.order ?? payload;
  const id = String(row?.id || row?.orderId || '').trim();

  if (!id) return null;

  return {
    id,
    status: row?.status ?? null,
    fulfillment: row?.fulfillment ?? null,
    createdAt: row?.createdAt ?? null,
    destinationAddr: row?.destinationAddr ?? null,
    chosenPharmacyId: row?.chosenPharmacyId ?? null,
    chosenOfferId: row?.chosenOfferId ?? null,
  };
}

function normalizeActivities(payload: any): Activity[] {
  const rows = asArray(payload?.timeline || payload?.items || payload?.events || payload);

  return rows
    .map((x: any, idx: number) => {
      const t = String(x?.t || x?.at || x?.createdAt || '');
      const msg = String(x?.msg || x?.message || x?.status || x?.note || '').trim();

      if (!t || !msg) return null;

      return {
        id: String(x?.id || `${t}-${idx}`),
        t,
        msg,
        entity:
          x?.entity === 'rider' || x?.entity === 'pharmacy' || x?.entity === 'system'
            ? x.entity
            : 'system',
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => new Date(b.t).getTime() - new Date(a.t).getTime()) as Activity[];
}

function isScriptInactive(rx: Rx) {
  if (!rx) return false;

  const status = String(rx.status || '').toLowerCase();
  if (['expired', 'cancelled', 'canceled', 'inactive', 'voided'].includes(status)) return true;

  if (rx.expiresAt) {
    const dt = new Date(rx.expiresAt);
    if (!Number.isNaN(dt.getTime()) && dt.getTime() < Date.now()) return true;
  }

  return false;
}

function statusTone(status?: string | null) {
  const s = String(status || '').toUpperCase();

  if (['PAID', 'PREPARING', 'READY_FOR_PICKUP', 'DISPATCHING', 'RIDER_ASSIGNED', 'EN_ROUTE_TO_PICKUP', 'AT_PHARMACY', 'PICKED_UP', 'EN_ROUTE_TO_CUSTOMER', 'DISPATCHED', 'OUT_FOR_DELIVERY'].includes(s)) {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  if (['DELIVERED', 'COLLECTED', 'COMPLETED'].includes(s)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (['FAILED', 'CANCELLED', 'REJECTED', 'EXPIRED'].includes(s)) {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function StatusPill({ status }: { status?: string | null }) {
  return (
    <span className={cx('inline-flex rounded-full border px-3 py-1 text-xs font-medium', statusTone(status))}>
      {String(status || 'Not started').replace(/_/g, ' ')}
    </span>
  );
}

function LiveBadge({ connected, error }: { connected: boolean; error: string | null }) {
  return (
    <div className="flex flex-col items-end gap-0.5 text-xs">
      <div
        className={cx(
          'inline-flex items-center gap-2 rounded-full border px-3 py-1 font-medium',
          connected
            ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
            : 'border-slate-200 bg-slate-100 text-slate-600',
        )}
      >
        <span className={cx('h-2 w-2 rounded-full', connected ? 'bg-emerald-500' : 'bg-slate-400')} aria-hidden />
        {connected ? 'Live' : 'Offline'}
      </div>
      {error ? (
        <div className="max-w-xs text-right text-[11px] text-rose-600">{error}</div>
      ) : (
        <div className="text-right text-[10px] text-slate-400">Live order updates when tracking is available.</div>
      )}
    </div>
  );
}

export default function CarePortPage() {
  const { activeEncounter, setActiveEncounter } =
    (useActiveEncounter() as any) || { activeEncounter: null, setActiveEncounter: undefined };

  const activeEncounterId = String(activeEncounter?.id || '').trim() || null;

  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [encounters, setEncounters] = useState<EncounterOption[]>([]);
  const [encId, setEncId] = useState<string | null>(activeEncounterId);

  const [rx, setRx] = useState<Rx>(null);
  const [loadingRx, setLoadingRx] = useState(false);
  const [rxError, setRxError] = useState<string | null>(null);

  const [order, setOrder] = useState<ExistingOrder | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [sseConnected, setSseConnected] = useState(false);
  const [sseError, setSseError] = useState<string | null>(null);

  const [destOpen, setDestOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  const [useSponsor, setUseSponsor] = useState(true);
  const [allowGenericSubstitution, setAllowGenericSubstitution] = useState(true);
  const [allowPartialFulfillment, setAllowPartialFulfillment] = useState(false);
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState<'CARD' | 'COD'>('CARD');
  const [gapPaymentMethod, setGapPaymentMethod] = useState<'CARD' | 'COD'>('CARD');

  useEffect(() => {
    let alive = true;

    fetch('/api/profile', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (alive) setProfile(data || null);
      })
      .catch(() => {
        if (alive) setProfile(null);
      });

    fetch('/api/encounters', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        const options = normalizeEncounterOptions(data);
        setEncounters(options);
        if (!encId && activeEncounterId) setEncId(activeEncounterId);
      })
      .catch(() => {
        if (alive) setEncounters([]);
      });

    return () => {
      alive = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!encId || !setActiveEncounter) return;
    setActiveEncounter((prev: any) => (prev?.id === encId ? prev : { id: encId }));
  }, [encId, setActiveEncounter]);

  const loadRx = useCallback(async (currentEncId: string) => {
    setLoadingRx(true);
    setRxError(null);
    setRx(null);

    try {
      const r = await fetch(`/api/careport/lastRx?encId=${encodeURIComponent(currentEncId)}`, {
        cache: 'no-store',
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        setRxError(data?.error || 'No active eRx was found for this encounter.');
        setRx(null);
        return;
      }

      setRx(normalizeRx(data));
    } catch (err: any) {
      setRxError(err?.message || 'Could not load latest eRx.');
      setRx(null);
    } finally {
      setLoadingRx(false);
    }
  }, []);

  const loadOrder = useCallback(async (currentEncId: string) => {
    setLoadingOrder(true);

    try {
      const r = await fetch(`/api/careport/orders/lookup?encId=${encodeURIComponent(currentEncId)}`, {
        cache: 'no-store',
      });
      const data = await r.json().catch(() => ({}));
      setOrder(r.ok && data?.ok ? normalizeOrder(data) : null);
    } catch {
      setOrder(null);
    } finally {
      setLoadingOrder(false);
    }
  }, []);

  useEffect(() => {
    if (!encId) {
      setRx(null);
      setOrder(null);
      setActivities([]);
      return;
    }

    loadRx(encId);
    loadOrder(encId);
  }, [encId, loadOrder, loadRx]);

  useEffect(() => {
    const orderId = order?.id;

    if (!orderId) {
      setActivities([]);
      return;
    }

    let alive = true;

    fetch(`/api/careport/timeline?id=${encodeURIComponent(orderId)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (alive) setActivities(normalizeActivities(data));
      })
      .catch(() => {
        if (alive) setActivities([]);
      });

    return () => {
      alive = false;
    };
  }, [order?.id]);

  useEffect(() => {
    const orderId = order?.id;

    if (!orderId || typeof window === 'undefined') {
      setSseConnected(false);
      setSseError(null);
      return;
    }

    let es: EventSource | null = null;

    try {
      es = new EventSource(`/api/careport/stream?orderId=${encodeURIComponent(orderId)}`);

      es.onopen = () => {
        setSseConnected(true);
        setSseError(null);
      };

      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          const activity: Activity | null =
            data?.activity ||
            (data?.kind
              ? {
                  id: String(data.id || `${data.kind}-${Date.now()}`),
                  t: new Date().toISOString(),
                  msg: String(data.status || data.kind).replace(/_/g, ' '),
                  entity: data.kind === 'rider_ping' ? 'rider' : 'system',
                }
              : null);

          if (activity) {
            setActivities((prev) => [activity, ...prev.filter((x) => x.id !== activity.id)].slice(0, 20));
          }
        } catch {
          // Ignore malformed keepalive payloads.
        }
      };

      es.onerror = () => {
        setSseConnected(false);
        setSseError('Live connection unavailable. Refreshing timeline still works.');
      };
    } catch (err: any) {
      setSseConnected(false);
      setSseError(err?.message || 'Live connection unavailable.');
    }

    return () => {
      try {
        es?.close();
      } catch {}
    };
  }, [order?.id]);

  const scriptInactive = isScriptInactive(rx);
  const canStart = Boolean(encId && rx && !scriptInactive && !starting);

  const startMarketplace = () => {
    if (!encId) return toast('Select an encounter first.', 'error');
    if (!rx) return toast('No active eRx is available for this encounter.', 'error');
    if (scriptInactive) return toast('This eRx is inactive or expired.', 'error');

    setDestOpen(true);
  };

  async function broadcastOrder(orderId: string) {
    try {
      await fetch(`/api/careport/orders/${encodeURIComponent(orderId)}/broadcast`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch {
      // Non-blocking. Marketplace can still be opened and refreshed.
    }
  }

  async function doStartMarketplace(payload: DestinationPayload) {
    if (!encId) return;

    setStarting(true);

    try {
      const res = await fetch('/api/careport/start', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': `careport-start:${encId}:${payload.fulfillment}`,
        },
        body: JSON.stringify({
          encId,
          fulfillment: payload.fulfillment,
          destination: payload.fulfillment === 'DELIVERY' ? payload.destination : undefined,
          sponsorRequested: useSponsor,
          allowPartialFulfillment,
          allowGenericSubstitution,
          preferredPaymentMethod,
          gapPaymentMethod,
          metadata: {
            sourceSurface: 'patient_careport_page',
            destinationSource: payload.destination?.source ?? null,
          },
        }),
      });

      const js = await res.json().catch(() => ({}));

      if (!res.ok || !js?.ok) {
        const message =
          js?.error === 'ALLERGY_CONFLICT'
            ? js?.message || 'CarePort blocked this order because of an allergy safety conflict.'
            : js?.message || js?.error || `Failed to start CarePort order. HTTP ${res.status}`;

        toast(message, 'error');
        return;
      }

      const orderId = String(js.orderId || js?.order?.id || '').trim();

      if (!orderId) {
        toast('CarePort order was created, but no order ID was returned.', 'error');
        return;
      }

      await broadcastOrder(orderId);

      setOrder(normalizeOrder(js.order));
      toast('CarePort marketplace started.', 'success');

      const redirectUrl = String(js.redirectUrl || '').trim();
      window.location.href = redirectUrl || `/careport/marketplace/${encodeURIComponent(orderId)}`;
    } catch (err: any) {
      toast(err?.message || 'Failed to start CarePort marketplace.', 'error');
    } finally {
      setStarting(false);
      setDestOpen(false);
    }
  }

  const buildHref = (base: string) => (encId ? { pathname: base, query: { encId } } : base);

  const fulfillmentLabel =
    order?.fulfillment === 'PICKUP'
      ? 'In-store collection'
      : order?.fulfillment === 'DELIVERY'
        ? 'Home delivery'
        : 'Not selected';

  return (
    <main data-p-ui="patient-careport-page" className="min-w-0 overflow-x-clip min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 text-white md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-3 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-slate-100">
                  CarePort pharmacy fulfilment
                </div>
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                  Choose delivery or collection before your prescription goes to pharmacies.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">
                  CarePort lets you send an eRx to the pharmacy marketplace, compare accepted offers, choose substitutions,
                  confirm sponsor or card payment, then track delivery or pickup status.
                </p>
              </div>

              <LiveBadge connected={sseConnected} error={sseError} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white p-4">
            <Link href={buildHref('/careport/track')} className="rounded-full border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
              Track
            </Link>
            {order?.id ? (
              <Link
                href={`/careport/marketplace/${encodeURIComponent(order.id)}`}
                className="rounded-full border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              >
                Marketplace
              </Link>
            ) : (
              <span className="rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-400">Marketplace</span>
            )}
            <Link href={order?.id ? `/careport/timeline?id=${encodeURIComponent(order.id)}` : buildHref('/careport/timeline')} className="rounded-full border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
              Timeline
            </Link>
            <Link href={buildHref('/careport/history')} className="rounded-full border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
              History
            </Link>
            <Link href="/orders" className="ml-auto rounded-full border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
              Back to orders
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Selected fulfilment</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{fulfillmentLabel}</div>
            <p className="mt-2 text-sm text-slate-600">
              Delivery requires a confirmed address and coordinates. Collection does not require a rider destination.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">CarePort order</div>
            <div className="mt-2 flex items-center gap-2">
              <StatusPill status={order?.status} />
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {order?.id ? `Order ${order.id}` : 'No CarePort order has been created for this encounter yet.'}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Safety gate</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">
              {rx ? (scriptInactive ? 'Script inactive' : 'Script active') : 'No eRx selected'}
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Gateway blocks CarePort push when the eRx contains a recorded allergy conflict.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-xl font-semibold text-slate-900">Send prescription to CarePort</h2>
              <p className="mt-1 text-sm text-slate-600">
                Select an encounter, confirm the eRx, then choose home delivery or in-store collection.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {order?.id ? (
                <Link
                  href={`/careport/marketplace/${encodeURIComponent(order.id)}`}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Open marketplace
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => encId && (loadRx(encId), loadOrder(encId))}
                disabled={!encId || loadingRx || loadingOrder}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <label className="text-xs font-medium text-slate-600">Encounter</label>
              <select
                aria-label="Select encounter"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                value={encId ?? ''}
                onChange={(e) => setEncId(e.target.value || null)}
              >
                <option value="">Choose encounter</option>
                {encounters.map((ec) => (
                  <option key={ec.id} value={ec.id}>
                    {ec.label}
                  </option>
                ))}
              </select>

              {encId ? (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  Selected encounter: <span className="font-medium text-slate-800">{encId}</span>
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Select an encounter with an active pharmacy eRx to continue.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {loadingRx ? (
                <div className="animate-pulse text-sm text-slate-600">Loading latest eRx...</div>
              ) : rx ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Prescription</div>
                    <div className="mt-1 text-base font-semibold text-slate-900">{rx.drug}</div>
                    <div className="mt-1 text-sm text-slate-600">{rx.sig}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={cx('rounded-full border px-3 py-1 text-xs font-medium', scriptInactive ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700')}>
                      {scriptInactive ? 'Inactive / expired' : 'Active eRx'}
                    </span>
                    {rx.expiresAt ? (
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                        Expires {formatWhen(rx.expiresAt)}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-600">
                  {rxError || 'No active eRx is available for the selected encounter.'}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">Marketplace preferences</div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="flex items-start gap-2 rounded-2xl border border-slate-200 p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={useSponsor}
                  onChange={(e) => setUseSponsor(e.target.checked)}
                />
                <span>
                  <span className="font-medium text-slate-900">Use sponsor / medical aid</span>
                  <span className="mt-1 block text-xs text-slate-500">Coverage will be checked before checkout.</span>
                </span>
              </label>

              <label className="flex items-start gap-2 rounded-2xl border border-slate-200 p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={allowGenericSubstitution}
                  onChange={(e) => setAllowGenericSubstitution(e.target.checked)}
                />
                <span>
                  <span className="font-medium text-slate-900">Allow generic substitution</span>
                  <span className="mt-1 block text-xs text-slate-500">Patient can still choose the final option.</span>
                </span>
              </label>

              <label className="flex items-start gap-2 rounded-2xl border border-slate-200 p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={allowPartialFulfillment}
                  onChange={(e) => setAllowPartialFulfillment(e.target.checked)}
                />
                <span>
                  <span className="font-medium text-slate-900">Allow partial fulfilment</span>
                  <span className="mt-1 block text-xs text-slate-500">Useful when one item is unavailable.</span>
                </span>
              </label>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label>
                <div className="text-xs font-medium text-slate-600">Preferred patient payment method</div>
                <select
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                  value={preferredPaymentMethod}
                  onChange={(e) => setPreferredPaymentMethod(e.target.value as 'CARD' | 'COD')}
                >
                  <option value="CARD">Card</option>
                  <option value="COD">Cash on delivery / collection where allowed</option>
                </select>
              </label>

              <label>
                <div className="text-xs font-medium text-slate-600">Gap payment if sponsor does not fully cover</div>
                <select
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                  value={gapPaymentMethod}
                  onChange={(e) => setGapPaymentMethod(e.target.value as 'CARD' | 'COD')}
                >
                  <option value="CARD">Card</option>
                  <option value="COD">Cash where allowed</option>
                </select>
              </label>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={startMarketplace}
              disabled={!canStart}
              className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {starting ? 'Starting CarePort...' : 'Send to CarePort'}
            </button>

            {order?.id ? (
              <Link
                href={`/careport/marketplace/${encodeURIComponent(order.id)}`}
                className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                View pharmacy offers
              </Link>
            ) : null}

            <StatusBadge status={order?.status || 'Not started'} />
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Sending to CarePort does not dispatch automatically. You still choose a pharmacy, review substitutions, confirm
            coverage/payment, and then track delivery or pickup.
          </p>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Recent CarePort activity</h2>
              <p className="mt-1 text-sm text-slate-600">Real order timeline events from the selected CarePort order.</p>
            </div>
            {order?.id ? <StatusPill status={order.status} /> : null}
          </div>

          <div className="mt-4 space-y-2" aria-live="polite">
            {activities.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No CarePort activity yet.
              </div>
            ) : (
              activities.slice(0, 8).map((a) => (
                <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="text-sm font-medium text-slate-900">{a.msg}</div>
                  <div className="mt-1 text-xs text-slate-500">{formatWhen(a.t)}</div>
                </div>
              ))
            )}
          </div>
        </section>

        <DeliveryDestinationSheet
          open={destOpen}
          onClose={() => setDestOpen(false)}
          profileAddress={profile?.address}
          defaultCountry="za"
          onConfirm={doStartMarketplace}
        />
      </div>
    </main>
  );
}
