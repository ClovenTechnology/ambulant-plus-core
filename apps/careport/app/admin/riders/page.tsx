'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

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

type Rider = {
  userId: string;
  country?: string | null;
  currency?: string | null;
  kyiStatus?: string | null;
  kyiSubmittedAt?: string | null;
  kyiRejectedReason?: string | null;
  kyiPayload?: any;
  isActive?: boolean;
  isOnJob?: boolean;
};

function label(value?: string | null) {
  return String(value || 'Not recorded').split('_').join(' ');
}

function badge(status?: string | null) {
  if (status === 'VERIFIED' || status === 'APPROVED') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'REJECTED') return 'border-rose-200 bg-rose-50 text-rose-800';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

export default function AdminRidersPage() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(nextStatus = status) {
    setError(null);
    const params = new URLSearchParams({ status: nextStatus, country: 'ZA', limit: '100' });
    try {
      const res = await fetch(`/api/careport/admin/riders?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(humanErrorMessage(data?.error, `riders_http_${res.status}`));
      setRiders(Array.isArray(data.riders) ? data.riders : []);
    } catch (err: any) {
      setError(humanErrorMessage(err, 'Unable to load riders.'));
      setRiders([]);
    }
  }

  useEffect(() => { void load(status); }, [status]);

  async function decide(userId: string, decision: 'APPROVED' | 'REJECTED') {
    setBusy(`${userId}:${decision}`);
    setError(null);
    try {
      const res = await fetch(`/api/careport/admin/riders/${encodeURIComponent(userId)}/decision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, reason: reason.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(humanErrorMessage(data?.error, `decision_http_${res.status}`));
      setReason('');
      await load(status);
    } catch (err: any) {
      setError(humanErrorMessage(err, 'Could not save decision.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Admin</p>
          <h1 className="text-2xl font-semibold text-slate-950">Rider KYI review</h1>
          <p className="mt-1 text-sm text-slate-600">Approve rider identity and vehicle submissions before assignment.</p>
        </div>
        <Link href="/admin" className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-slate-50">Admin home</Link>
      </header>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{humanErrorMessage(error, "Unable to complete this request. Please try again.")}</div>}

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
          {riders.map((r) => (
            <article key={r.userId} className="rounded-2xl border p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-950">{r.kyiPayload?.fullName || r.userId}</h2>
                    <span className={`rounded-full border px-2 py-1 text-xs ${badge(r.kyiStatus)}`}>{label(r.kyiStatus)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{r.kyiPayload?.phone || 'No phone'} · {r.kyiPayload?.vehicleType || 'No vehicle'} · {r.kyiPayload?.vehicleRegistration || 'No registration'}</p>
                  <p className="mt-1 text-xs text-slate-500">{r.country || 'ZA'} · {r.currency || 'ZAR'} · {r.isActive ? 'Active' : 'Inactive'} · {r.isOnJob ? 'On job' : 'Available'}</p>
                  {r.kyiRejectedReason && <p className="mt-2 text-xs text-rose-700">Rejected reason: {r.kyiRejectedReason}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button disabled={busy === `${r.userId}:APPROVED`} onClick={() => void decide(r.userId, 'APPROVED')} className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">Approve</button>
                  <button disabled={busy === `${r.userId}:REJECTED`} onClick={() => void decide(r.userId, 'REJECTED')} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Reject</button>
                </div>
              </div>
            </article>
          ))}
          {!riders.length && <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">No riders found for this filter.</div>}
        </div>
      </section>
    </main>
  );
}
