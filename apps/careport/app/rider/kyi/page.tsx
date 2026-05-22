'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Rider = {
  id?: string;
  userId?: string;
  country?: string;
  currency?: string;
  kyiStatus?: string | null;
  kyiSubmittedAt?: string | null;
  kyiVerifiedAt?: string | null;
  kyiRejectedReason?: string | null;
  kyiPayload?: any;
};

function label(status?: string | null) {
  return String(status || 'NOT_SUBMITTED').split('_').join(' ');
}

function statusClass(status?: string | null) {
  if (status === 'APPROVED') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'PENDING_REVIEW') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'REJECTED') return 'border-rose-200 bg-rose-50 text-rose-800';
  return 'border-slate-200 bg-white text-slate-700';
}

export default function RiderKyiPage() {
  const [rider, setRider] = useState<Rider | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    idNumber: '',
    phone: '',
    vehicleType: 'motorbike',
    vehicleRegistration: '',
    licenceNumber: '',
  });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/careport/riders/me/kyi', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || `kyi_http_${res.status}`);
      setRider(data.rider || null);
      const payload = data.rider?.kyiPayload || {};
      setForm((prev) => ({
        ...prev,
        fullName: payload.fullName || payload.name || prev.fullName,
        idNumber: payload.idNumber || payload.nationalId || prev.idNumber,
        phone: payload.phone || prev.phone,
        vehicleType: payload.vehicleType || prev.vehicleType,
        vehicleRegistration: payload.vehicleRegistration || prev.vehicleRegistration,
        licenceNumber: payload.licenceNumber || prev.licenceNumber,
      }));
    } catch (err: any) {
      setError(err?.message || 'Unable to load rider verification.');
      setRider(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        idNumber: form.idNumber.trim(),
        phone: form.phone.trim(),
        vehicleType: form.vehicleType.trim(),
        vehicleRegistration: form.vehicleRegistration.trim(),
        licenceNumber: form.licenceNumber.trim(),
      };

      const res = await fetch('/api/careport/riders/me/kyi', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ country: 'ZA', schemaKey: 'ZA_RIDER_KYI_v1', payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || `kyi_submit_http_${res.status}`);
      setMessage('Rider verification submitted for review.');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not submit rider verification.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Rider KYI</p>
          <h1 className="text-2xl font-semibold text-slate-950">Rider identity verification</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Complete rider verification before accepting pharmacy pickup and home delivery jobs.
          </p>
        </div>
        <Link href="/rider/jobs" className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-slate-50">Open jobs</Link>
      </header>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}

      <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="rounded-3xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-950">Current status</h2>
          <div className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusClass(rider?.kyiStatus)}`}>
            {loading ? 'Loading' : label(rider?.kyiStatus)}
          </div>
          {rider?.kyiRejectedReason && <p className="mt-3 text-sm text-rose-700">{rider.kyiRejectedReason}</p>}
          <p className="mt-4 text-xs text-slate-500">
            Approved riders can receive assignments, update live delivery state, and submit proof of delivery.
          </p>
        </aside>

        <section className="rounded-3xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-950">Verification details</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Full name" value={form.fullName} onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))} />
            <input className="rounded-xl border px-3 py-2 text-sm" placeholder="ID / passport number" value={form.idNumber} onChange={(e) => setForm((s) => ({ ...s, idNumber: e.target.value }))} />
            <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Phone number" value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} />
            <select className="rounded-xl border px-3 py-2 text-sm" value={form.vehicleType} onChange={(e) => setForm((s) => ({ ...s, vehicleType: e.target.value }))}>
              <option value="motorbike">Motorbike</option>
              <option value="car">Car</option>
              <option value="bicycle">Bicycle</option>
              <option value="walking">Walking courier</option>
            </select>
            <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Vehicle registration" value={form.vehicleRegistration} onChange={(e) => setForm((s) => ({ ...s, vehicleRegistration: e.target.value }))} />
            <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Licence number" value={form.licenceNumber} onChange={(e) => setForm((s) => ({ ...s, licenceNumber: e.target.value }))} />
          </div>
          <button
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            disabled={busy || !form.fullName.trim() || !form.phone.trim()}
            onClick={() => void submit()}
          >
            {busy ? 'Submitting…' : 'Submit for review'}
          </button>
        </section>
      </section>
    </main>
  );
}
