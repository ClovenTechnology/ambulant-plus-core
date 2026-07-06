'use client';

import { useEffect, useMemo, useState } from 'react';

type EligibilityRow = {
  id: string;
  clientId?: string | null;
  clientMemberId: string;
  patientId?: string | null;
  userId?: string | null;
  periodKey: string;
  source?: string | null;
  status: string;
  eligibilityStatus: string;
  premiumStatus: string;
  reasonCode?: string | null;
  reasonText?: string | null;
  verifiedAt?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  metadata?: any;
};


function currentPeriodKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmtDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : '—';
}

function tone(status?: string, premiumStatus?: string) {
  const s = String(status || '').toUpperCase();
  const p = String(premiumStatus || '').toUpperCase();

  if (s === 'ELIGIBLE' && ['PAID', 'ACTIVE', ''].includes(p)) {
    return 'border-emerald-700 bg-emerald-950 text-emerald-100';
  }

  if (['UNPAID', 'FAILED', 'LAPSED'].includes(p)) {
    return 'border-rose-700 bg-rose-950 text-rose-100';
  }

  if (['SUSPENDED', 'CANCELLED', 'EXPIRED', 'NOT_ELIGIBLE', 'UNVERIFIED'].includes(s)) {
    return 'border-rose-700 bg-rose-950 text-rose-100';
  }

  return 'border-amber-700 bg-amber-950 text-amber-100';
}

export default function EligibilityPage() {
  const [periodKey, setPeriodKey] = useState(currentPeriodKey());
  const [items, setItems] = useState<EligibilityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [memberId, setMemberId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [eligibilityStatus, setEligibilityStatus] = useState('ELIGIBLE');
  const [premiumStatus, setPremiumStatus] = useState('PAID');
  const [reason, setReason] = useState('Monthly eligibility verified.');

  async function load() {
    setLoading(true);
    setErr('');

    try {
      const params = new URLSearchParams({        periodKey,
        limit: '500',
      });

      const res = await fetch(`/api/patient-sponsor-links/eligibility?${params}`, {
        cache: 'no-store',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || 'Could not load eligibility records.');
      }

      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e: any) {
      setErr(e?.message || 'Could not load eligibility records.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function submitVerification(next?: {
    memberId?: string;
    patientId?: string;
    eligibilityStatus?: string;
    premiumStatus?: string;
    reason?: string;
  }) {
    setLoading(true);
    setErr('');

    try {
      const resolvedMemberId = String(next?.memberId || memberId || '').trim();

      const resolvedPatientId = String(next?.patientId || patientId || '').trim();


      if (!resolvedMemberId || !resolvedPatientId) {

        throw new Error('Member link and patient identifier are required.');

      }


      const body = {        periodKey,
        source: 'PAYEROPS_MANUAL',
        adapterChannel: 'PAYEROPS_MANUAL',
        items: [
          {
            patientSponsorLinkId: resolvedMemberId,
            patientId: resolvedPatientId,
            status:
              next?.eligibilityStatus === 'ELIGIBLE' ? 'ACTIVE' : next?.eligibilityStatus || eligibilityStatus,
            eligibilityStatus: next?.eligibilityStatus || eligibilityStatus,
            premiumStatus: next?.premiumStatus || premiumStatus,
            reason: next?.reason || reason,
          },
        ],
      };

      const res = await fetch('/api/patient-sponsor-links/eligibility', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || 'Could not save eligibility verification.');
      }

      await load();
    } catch (e: any) {
      setErr(e?.message || 'Could not save eligibility verification.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [periodKey]);

  const summary = useMemo(() => {
    return {
      total: items.length,
      eligible: items.filter((x) => x.eligibilityStatus === 'ELIGIBLE' && x.premiumStatus === 'PAID').length,
      unpaid: items.filter((x) => x.premiumStatus === 'UNPAID').length,
      blocked: items.filter((x) =>
        ['NOT_ELIGIBLE', 'UNVERIFIED', 'SUSPENDED', 'CANCELLED', 'EXPIRED'].includes(
          String(x.eligibilityStatus || '').toUpperCase(),
        ),
      ).length,
    };
  }, [items]);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">
            PayerOps eligibility verification
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Monthly Eligibility & Premium Status
          </h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
            Verify whether members are eligible, paid-up, suspended, cancelled, or blocked for the current monthly billing period. These results control whether a patient can use Medical Aid / sponsor payment during booking.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs text-slate-400">Total checks</div>
            <div className="mt-2 text-3xl font-semibold">{summary.total}</div>
          </div>
          <div className="rounded-2xl border border-emerald-800 bg-emerald-950/40 p-4">
            <div className="text-xs text-emerald-300">Eligible / paid</div>
            <div className="mt-2 text-3xl font-semibold">{summary.eligible}</div>
          </div>
          <div className="rounded-2xl border border-rose-800 bg-rose-950/40 p-4">
            <div className="text-xs text-rose-300">Unpaid</div>
            <div className="mt-2 text-3xl font-semibold">{summary.unpaid}</div>
          </div>
          <div className="rounded-2xl border border-amber-800 bg-amber-950/40 p-4">
            <div className="text-xs text-amber-300">Blocked / exception</div>
            <div className="mt-2 text-3xl font-semibold">{summary.blocked}</div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="grid gap-3 md:grid-cols-6">
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Period</span>
              <input
                value={periodKey}
                onChange={(e) => setPeriodKey(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Member link</span>
              <input
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Patient</span>
              <input
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Eligibility</span>
              <select
                value={eligibilityStatus}
                onChange={(e) => setEligibilityStatus(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="ELIGIBLE">Eligible</option>
                <option value="UNVERIFIED">Unverified</option>
                <option value="NOT_ELIGIBLE">Not eligible</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Premium</span>
              <select
                value={premiumStatus}
                onChange={(e) => setPremiumStatus(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="PAID">Paid</option>
                <option value="UNPAID">Unpaid</option>
                <option value="GRACE">Grace</option>
                <option value="UNKNOWN">Unknown</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => submitVerification()}
              disabled={loading}
              className="self-end rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
            >
              {loading ? 'Saving…' : 'Save check'}
            </button>
          </div>

          <label className="mt-3 block space-y-1">
            <span className="text-xs text-slate-400">Reason</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                submitVerification({
                  eligibilityStatus: 'ELIGIBLE',
                  premiumStatus: 'PAID',
                  reason: 'Monthly premium paid and member is eligible.',
                })
              }
              className="rounded-xl border border-emerald-700 bg-emerald-950 px-3 py-2 text-xs font-semibold text-emerald-100"
            >
              Mark eligible / paid
            </button>

            <button
              type="button"
              onClick={() =>
                submitVerification({
                  eligibilityStatus: 'NOT_ELIGIBLE',
                  premiumStatus: 'UNPAID',
                  reason: 'Premium unpaid for current period.',
                })
              }
              className="rounded-xl border border-rose-700 bg-rose-950 px-3 py-2 text-xs font-semibold text-rose-100"
            >
              Mark unpaid
            </button>

            <button
              type="button"
              onClick={() =>
                submitVerification({
                  eligibilityStatus: 'SUSPENDED',
                  premiumStatus: 'UNKNOWN',
                  reason: 'Policy suspended for current period.',
                })
              }
              className="rounded-xl border border-amber-700 bg-amber-950 px-3 py-2 text-xs font-semibold text-amber-100"
            >
              Suspend
            </button>
          </div>
        </section>

        {err ? (
          <div className="rounded-2xl border border-rose-800 bg-rose-950/50 p-4 text-sm text-rose-100">
            {err}
          </div>
        ) : null}

        <section className="space-y-3">
          {items.length === 0 && !loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">
              No eligibility checks found for this period yet.
            </div>
          ) : null}

          {items.map((row) => (
            <article key={row.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{row.clientMemberId}</h2>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone(
                        row.eligibilityStatus,
                        row.premiumStatus,
                      )}`}
                    >
                      {row.eligibilityStatus} · {row.premiumStatus}
                    </span>
                  </div>

                  <div className="mt-2 text-xs leading-5 text-slate-400">
                    Patient: {row.patientId || '—'} · Period: {row.periodKey} · Source:{' '}
                    {row.source || '—'}
                    <br />
                    Verified: {fmtDate(row.verifiedAt)} · Valid to: {fmtDate(row.validTo)}
                  </div>
                </div>

                <div className="text-right text-xs text-slate-400">
                  <div>Status: {row.status}</div>
                  <div>Reason: {row.reasonText || row.reasonCode || '—'}</div>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}