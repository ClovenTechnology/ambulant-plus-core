function humanErrorMessage(value: unknown, fallback = "Unable to complete this request. Please try again.") {
  if (typeof value === "string") {
    const text = value.trim();
    if (text && text !== "[object Object]") return text;
  }

  if (value instanceof Error) {
    const text = value.message.trim();
    if (text && text !== "[object Object]") return text;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    for (const key of ["message", "error", "detail", "reason", "statusText", "code"]) {
      const candidate = record[key];

      if (typeof candidate === "string") {
        const text = candidate.trim();
        if (text && text !== "[object Object]") return text;
      }

      if (candidate && typeof candidate === "object") {
        const nested = candidate as Record<string, unknown>;

        for (const nestedKey of ["message", "error", "detail", "reason", "statusText", "code"]) {
          const nestedCandidate = nested[nestedKey];

          if (typeof nestedCandidate === "string") {
            const text = nestedCandidate.trim();
            if (text && text !== "[object Object]") return text;
          }
        }
      }
    }
  }

  if (value != null) {
    const text = String(value).trim();
    if (text && text !== "[object Object]") return text;
  }

  return fallback;
}

//apps/careport/app/rider/jobs/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Job = {
  id: string;
  status: string;
  fulfillment: 'DELIVERY' | 'PICKUP';
  destinationAddr?: string | null;
  totalCents?: number;
  currency?: string;
  updatedAt?: string | null;
  pharmacy?: { name?: string | null; address?: string | null; city?: string | null } | null;
  items?: Array<{ id: string; name: string; quantity: number }>;
};

const tabs = [
  { key: '', label: 'Active' },
  { key: 'RIDER_ASSIGNED', label: 'Assigned' },
  { key: 'AT_PHARMACY', label: 'At pharmacy' },
  { key: 'PICKED_UP', label: 'Picked up' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { key: 'DELIVERED', label: 'Delivered' },
];

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

export default function RiderJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load(nextStatus = status) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (nextStatus) params.set('status', nextStatus);
      params.set('limit', '100');
      const res = await fetch(`/api/careport/riders/me/jobs?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(humanErrorMessage(data?.error, `jobs_http_${res.status}`));
      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch (err: any) {
      setError(humanErrorMessage(err, 'Unable to load rider jobs.'));
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const metrics = useMemo(() => ({
    assigned: jobs.filter((j) => j.status === 'RIDER_ASSIGNED').length,
    pickup: jobs.filter((j) => ['AT_PHARMACY', 'PICKED_UP'].includes(j.status)).length,
    delivery: jobs.filter((j) => j.status === 'OUT_FOR_DELIVERY').length,
    done: jobs.filter((j) => j.status === 'DELIVERED').length,
  }), [jobs]);

  async function action(orderId: string, workflowAction: string) {
    setBusy(orderId + workflowAction);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/careport/riders/me/jobs/${encodeURIComponent(orderId)}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: workflowAction }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(humanErrorMessage(data?.error, `status_http_${res.status}`));
      setMessage(`Job moved to ${displayStatus(data.status)}.`);
      await load(status);
    } catch (err: any) {
      setError(humanErrorMessage(err, 'Could not update job.'));
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

      const activeJob = jobs.find((job) => ['RIDER_ASSIGNED', 'AT_PHARMACY', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(job.status));
      const res = await fetch('/api/careport/location', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderId: activeJob?.id || null,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          source: 'careport_rider_console',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) throw new Error(humanErrorMessage(data?.error, `location_http_${res.status}`));
      setMessage('Location shared with CarePort tracking.');
    } catch (err: any) {
      setError(humanErrorMessage(err, 'Could not share location.'));
    } finally {
      setGeoBusy(false);
    }
  }

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Rider jobs</p>
          <h1 className="text-2xl font-semibold text-slate-950">Assigned CarePort deliveries</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Update pickup and delivery progress. Location sharing is sent through the gateway, not local demo data.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/rider/kyi" className="rounded-xl border bg-white px-3 py-2 hover:bg-slate-50">KYI</Link>
          <button onClick={() => void shareLocation()} disabled={geoBusy} className="rounded-xl bg-slate-900 px-3 py-2 font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
            {geoBusy ? 'Sharing…' : 'Share location'}
          </button>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4"><div className="text-xs text-slate-500">Assigned</div><div className="text-2xl font-semibold">{metrics.assigned}</div></div>
        <div className="rounded-2xl border bg-white p-4"><div className="text-xs text-slate-500">Pickup</div><div className="text-2xl font-semibold">{metrics.pickup}</div></div>
        <div className="rounded-2xl border bg-white p-4"><div className="text-xs text-slate-500">Delivery</div><div className="text-2xl font-semibold">{metrics.delivery}</div></div>
        <div className="rounded-2xl border bg-white p-4"><div className="text-xs text-slate-500">Done</div><div className="text-2xl font-semibold">{metrics.done}</div></div>
      </section>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{humanErrorMessage(error, "Unable to complete this request. Please try again.")}</div>}
      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{humanErrorMessage(message, "Request completed.")}</div>}

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.key || 'active'}
                onClick={() => setStatus(tab.key)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${status === tab.key ? 'bg-slate-900 text-white' : 'bg-white hover:bg-slate-50'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button onClick={() => void load(status)} className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-slate-50">Refresh</button>
        </div>

        <div className="mt-5 space-y-3">
          {jobs.map((job) => {
            const itemSummary = (job.items || []).slice(0, 2).map((item) => `${item.name} ×${item.quantity}`).join(', ');
            const canAtPharmacy = job.status === 'RIDER_ASSIGNED' || job.status === 'DISPATCHING';
            const canPickedUp = job.status === 'AT_PHARMACY';
            const canOut = job.status === 'PICKED_UP';
            const canDelivered = job.status === 'OUT_FOR_DELIVERY';

            return (
              <article key={job.id} className="rounded-2xl border p-4 transition hover:border-indigo-200 hover:bg-indigo-50/20">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/rider/jobs/${encodeURIComponent(job.id)}`} className="font-semibold text-slate-950 hover:underline">{job.id}</Link>
                      <span className={`rounded-full border px-2 py-1 text-xs ${statusClass(job.status)}`}>{displayStatus(job.status)}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{itemSummary || 'No item details'}</p>
                    <p className="mt-1 text-xs text-slate-500">Pharmacy: {job.pharmacy?.name || 'Not recorded'} · Updated {dt(job.updatedAt)}</p>
                    <p className="mt-1 text-xs text-slate-500">Destination: {job.destinationAddr || 'Not recorded'}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/rider/jobs/${encodeURIComponent(job.id)}`} className="rounded-xl border bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50">Open job</Link>
                  {canAtPharmacy && <button disabled={busy === job.id + 'at_pharmacy'} onClick={() => void action(job.id, 'at_pharmacy')} className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50">At pharmacy</button>}
                  {canPickedUp && <button disabled={busy === job.id + 'picked_up'} onClick={() => void action(job.id, 'picked_up')} className="rounded-xl bg-indigo-700 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">Picked up</button>}
                  {canOut && <button disabled={busy === job.id + 'out_for_delivery'} onClick={() => void action(job.id, 'out_for_delivery')} className="rounded-xl bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-50">Out for delivery</button>}
                  {canDelivered && <button disabled={busy === job.id + 'delivered'} onClick={() => void action(job.id, 'delivered')} className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">Delivered</button>}
                </div>
              </article>
            );
          })}

          {!jobs.length && (
            <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">
              {loading ? 'Loading jobs…' : 'No rider jobs found for this view.'}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
