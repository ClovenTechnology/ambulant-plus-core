//apps/careport/app/rider/jobs/[orderId]/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Order = {
  id: string;
  status: string;
  fulfillment: 'DELIVERY' | 'PICKUP';
  destinationAddr?: string | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  currency?: string;
  totalCents?: number;
  updatedAt?: string | null;
  items?: Array<{ id: string; name: string; quantity: number; directions?: string | null }>;
  chosenPharmacy?: { name?: string | null; address?: string | null; city?: string | null; lat?: number | null; lng?: number | null } | null;
  sponsorPricingSnapshot?: any;
};

function displayStatus(status: string) {
  return String(status || 'UNKNOWN').split('_').join(' ');
}

function statusClass(status: string) {
  if (status === 'RIDER_ASSIGNED') return 'border-blue-200 bg-blue-50 text-blue-800';
  if (status === 'AT_PHARMACY') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (['PICKED_UP', 'OUT_FOR_DELIVERY'].includes(status)) return 'border-violet-200 bg-violet-50 text-violet-800';
  if (status === 'DELIVERED') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (['DELIVERY_FAILED', 'RETURNING_TO_PHARMACY'].includes(status)) return 'border-rose-200 bg-rose-50 text-rose-800';
  return 'border-slate-200 bg-white text-slate-700';
}

function dt(value?: string | null) {
  if (!value) return 'Not recorded';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not recorded';
  return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function RiderJobDetailPage({ params }: { params: { orderId: string } }) {
  const orderId = params.orderId;
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [note, setNote] = useState('');
  const [proof, setProof] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/careport/riders/me/jobs/${encodeURIComponent(orderId)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || `job_http_${res.status}`);
      setOrder(data.order || null);
    } catch (err: any) {
      setError(err?.message || 'Unable to load rider job.');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const workflowHistory = useMemo(() => {
    const history = order?.sponsorPricingSnapshot?.riderWorkflow?.history;
    return Array.isArray(history) ? history.slice().reverse() : [];
  }, [order]);

  async function action(workflowAction: string) {
    setBusy(workflowAction);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/careport/riders/me/jobs/${encodeURIComponent(orderId)}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: workflowAction, note: note.trim() || null, proof: proof.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || `status_http_${res.status}`);
      setMessage(`Job moved to ${displayStatus(data.status)}.`);
      setNote('');
      setProof('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not update job.');
    } finally {
      setBusy(null);
    }
  }

  async function shareLocation() {
    setGeoBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (!navigator.geolocation) throw new Error('Geolocation is not supported by this browser.');

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
      });

      const res = await fetch('/api/careport/location', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderId,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          source: 'careport_rider_job_detail',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) throw new Error(data?.error || `location_http_${res.status}`);
      setMessage('Location shared with CarePort tracking.');
    } catch (err: any) {
      setError(err?.message || 'Could not share location.');
    } finally {
      setGeoBusy(false);
    }
  }

  if (loading) return <main className="rounded-3xl border bg-white p-8 text-sm text-slate-500">Loading job…</main>;

  if (!order) {
    return (
      <main className="space-y-4">
        <Link href="/rider/jobs" className="text-sm text-indigo-700 hover:underline">← Back to rider jobs</Link>
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error || 'Job not found.'}</div>
      </main>
    );
  }

  const canAtPharmacy = order.status === 'RIDER_ASSIGNED' || order.status === 'DISPATCHING';
  const canPickedUp = order.status === 'AT_PHARMACY';
  const canOut = order.status === 'PICKED_UP';
  const canDelivered = order.status === 'OUT_FOR_DELIVERY';

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Link href="/rider/jobs" className="text-sm text-indigo-700 hover:underline">← Back to rider jobs</Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Delivery job {order.id}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={`rounded-full border px-2 py-1 text-xs ${statusClass(order.status)}`}>{displayStatus(order.status)}</span>
            <span className="rounded-full border px-2 py-1 text-xs text-slate-600">Home delivery</span>
          </div>
        </div>
        <button onClick={() => void shareLocation()} disabled={geoBusy} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
          {geoBusy ? 'Sharing…' : 'Share live location'}
        </button>
      </header>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-950">Route</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border p-4 text-sm">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Pickup pharmacy</div>
                <div className="mt-2 font-semibold text-slate-950">{order.chosenPharmacy?.name || 'Not recorded'}</div>
                <div className="mt-1 text-slate-600">{order.chosenPharmacy?.address || order.chosenPharmacy?.city || 'Address not recorded'}</div>
              </div>
              <div className="rounded-2xl border p-4 text-sm">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Delivery destination</div>
                <div className="mt-2 font-semibold text-slate-950">{order.destinationAddr || 'Not recorded'}</div>
                <div className="mt-1 text-slate-600">{order.destinationLat && order.destinationLng ? `${order.destinationLat}, ${order.destinationLng}` : 'Coordinates not recorded'}</div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-950">Package items</h2>
            <div className="mt-4 divide-y rounded-2xl border">
              {(order.items || []).map((item) => (
                <div key={item.id} className="p-4 text-sm">
                  <div className="font-medium text-slate-950">{item.name}</div>
                  <div className="mt-1 text-xs text-slate-500">Quantity {item.quantity}</div>
                  {item.directions && <div className="mt-1 text-xs text-slate-600">Directions: {item.directions}</div>}
                </div>
              ))}
              {!(order.items || []).length && <div className="p-6 text-sm text-slate-500">No items recorded.</div>}
            </div>
          </section>

          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-950">Rider workflow</h2>
            <textarea className="mt-4 h-24 w-full rounded-2xl border p-3 text-sm" placeholder="Optional handover, delivery, or failed-delivery note" value={note} onChange={(e) => setNote(e.target.value)} />
            <input className="mt-3 w-full rounded-2xl border px-3 py-2 text-sm" placeholder="Optional proof / OTP / recipient note" value={proof} onChange={(e) => setProof(e.target.value)} />
            <div className="mt-4 flex flex-wrap gap-2">
              {canAtPharmacy && <button disabled={busy === 'at_pharmacy'} onClick={() => void action('at_pharmacy')} className="rounded-xl bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">At pharmacy</button>}
              {canPickedUp && <button disabled={busy === 'picked_up'} onClick={() => void action('picked_up')} className="rounded-xl bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">Picked up</button>}
              {canOut && <button disabled={busy === 'out_for_delivery'} onClick={() => void action('out_for_delivery')} className="rounded-xl bg-violet-700 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50">Out for delivery</button>}
              {canDelivered && <button disabled={busy === 'delivered'} onClick={() => void action('delivered')} className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">Delivered</button>}
              <button disabled={busy === 'failed_delivery'} onClick={() => void action('failed_delivery')} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50">Failed delivery</button>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-950">Job summary</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-xs text-slate-500">Status</dt><dd className="font-medium">{displayStatus(order.status)}</dd></div>
              <div><dt className="text-xs text-slate-500">Updated</dt><dd>{dt(order.updatedAt)}</dd></div>
              <div><dt className="text-xs text-slate-500">Destination</dt><dd>{order.destinationAddr || 'Not recorded'}</dd></div>
            </dl>
          </section>

          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-950">Rider history</h2>
            <div className="mt-4 space-y-2">
              {workflowHistory.map((entry: any, idx: number) => (
                <div key={`${entry.at || idx}-${idx}`} className="rounded-2xl border p-3 text-xs">
                  <div className="font-medium text-slate-900">{displayStatus(entry.action || '')} · {entry.to}</div>
                  <div className="text-slate-500">{dt(entry.at)}</div>
                  {entry.note && <div className="mt-1 text-slate-600">{entry.note}</div>}
                  {entry.proof && <div className="mt-1 text-slate-600">Proof: {entry.proof}</div>}
                </div>
              ))}
              {!workflowHistory.length && <div className="rounded-2xl border border-dashed p-3 text-xs text-slate-500">No rider events yet.</div>}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
