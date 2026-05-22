'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Pharmacy = {
  id: string;
  name: string;
  contact?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  currency?: string | null;
  kycStatus?: string | null;
  kycSubmittedAt?: string | null;
  kycRejectedReason?: string | null;
  supportsPickup?: boolean;
  supportsDelivery?: boolean;
};

function label(value?: string | null) {
  return String(value || 'Not recorded').split('_').join(' ');
}

function badge(status?: string | null) {
  if (status === 'VERIFIED' || status === 'APPROVED') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'REJECTED') return 'border-rose-200 bg-rose-50 text-rose-800';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

export default function AdminPharmaciesPage() {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [busy, setBusy] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load(nextStatus = status) {
    setError(null);
    const params = new URLSearchParams({ status: nextStatus, country: 'ZA', limit: '100' });
    try {
      const res = await fetch(`/api/careport/admin/pharmacies?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || `pharmacies_http_${res.status}`);
      setPharmacies(Array.isArray(data.pharmacies) ? data.pharmacies : []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load pharmacies.');
      setPharmacies([]);
    }
  }

  useEffect(() => { void load(status); }, [status]);

  async function decide(pharmacyId: string, decision: 'APPROVED' | 'REJECTED') {
    setBusy(`${pharmacyId}:${decision}`);
    setError(null);
    try {
      const res = await fetch(`/api/careport/admin/pharmacies/${encodeURIComponent(pharmacyId)}/decision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, reason: reason.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || `decision_http_${res.status}`);
      setReason('');
      await load(status);
    } catch (err: any) {
      setError(err?.message || 'Could not save decision.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Admin</p>
          <h1 className="text-2xl font-semibold text-slate-950">Pharmacy KYC review</h1>
          <p className="mt-1 text-sm text-slate-600">Approve or reject pharmacy partners before they receive CarePort invitations.</p>
        </div>
        <Link href="/admin" className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-slate-50">Admin home</Link>
      </header>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {['PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'ALL'].map((s) => (
              <button key={s} onClick={() => setStatus(s)} className={`rounded-full border px-3 py-1.5 text-xs ${status === s ? 'bg-slate-900 text-white' : 'bg-white hover:bg-slate-50'}`}>{label(s)}</button>
            ))}
          </div>
          <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Optional rejection reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>

        <div className="mt-5 space-y-3">
          {pharmacies.map((p) => (
            <article key={p.id} className="rounded-2xl border p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-950">{p.name}</h2>
                    <span className={`rounded-full border px-2 py-1 text-xs ${badge(p.kycStatus)}`}>{label(p.kycStatus)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{p.address || 'No address'}{p.city ? `, ${p.city}` : ''}</p>
                  <p className="mt-1 text-xs text-slate-500">{p.contact || 'No contact'} · {p.country || 'ZA'} · {p.currency || 'ZAR'}</p>
                  {p.kycRejectedReason && <p className="mt-2 text-xs text-rose-700">Rejected reason: {p.kycRejectedReason}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button disabled={busy === `${p.id}:APPROVED`} onClick={() => void decide(p.id, 'APPROVED')} className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">Approve</button>
                  <button disabled={busy === `${p.id}:REJECTED`} onClick={() => void decide(p.id, 'REJECTED')} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Reject</button>
                </div>
              </div>
            </article>
          ))}
          {!pharmacies.length && <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">No pharmacies found for this filter.</div>}
        </div>
      </section>
    </main>
  );
}
