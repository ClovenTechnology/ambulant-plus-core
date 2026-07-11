'use client';

import { useEffect, useMemo, useState } from 'react';

type RiderKyiRow = {
  id?: string | null;
  userId: string;
  country?: string | null;
  kyiStatus?: string | null;
  kyiSubmittedAt?: string | null;
  kyiVerifiedAt?: string | null;
  kyiRejectedReason?: string | null;
  isActive?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
};

type RiderKyiPayload = {
  ok?: boolean;
  error?: string;
  orgId?: string;
  riders?: RiderKyiRow[];
};

const STATUS_OPTIONS = ['PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'ALL'];

function dateText(value?: string | null) {
  if (!value) return 'Not recorded';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function statusClass(value?: string | null) {
  const status = String(value || '').toUpperCase();

  if (status === 'VERIFIED' || status === 'APPROVED') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }

  if (status === 'REJECTED') return 'border-rose-200 bg-rose-50 text-rose-800';

  return 'border-amber-200 bg-amber-50 text-amber-900';
}

function prettyJson(value: unknown) {
  if (value == null || value === '') return 'No value recorded.';

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function searchable(row: RiderKyiRow) {
  return [
    row.id,
    row.userId,
    row.country,
    row.kyiStatus,
    row.kyiRejectedReason,
    row.isActive ? 'active' : 'inactive',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function extraFields(row: RiderKyiRow) {
  const hidden = new Set([
    'id',
    'userId',
    'country',
    'kyiStatus',
    'kyiSubmittedAt',
    'kyiVerifiedAt',
    'kyiRejectedReason',
    'isActive',
    'createdAt',
    'updatedAt',
  ]);

  return Object.entries(row).filter(([key]) => !hidden.has(key));
}

export default function CarePortRiderKyiReviewPage() {
  const [rows, setRows] = useState<RiderKyiRow[]>([]);
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [country, setCountry] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reasons, setReasons] = useState<Record<string, string>>({});

  async function loadRows() {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        status,
        limit: '100',
      });

      if (country.trim()) params.set('country', country.trim().toUpperCase());
      if (query.trim()) params.set('q', query.trim());

      const res = await fetch('/api/careport/admin/kyc/riders?' + params.toString(), {
        cache: 'no-store',
      });

      const payload = (await res.json()) as RiderKyiPayload;

      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || 'Failed to load rider KYI submissions.');
      }

      setRows(Array.isArray(payload.riders) ? payload.riders : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load rider KYI submissions.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
  }, [status, country]);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;

    return rows.filter((row) => searchable(row).includes(needle));
  }, [query, rows]);

  const counts = useMemo(() => {
    const verified = rows.filter((row) => String(row.kyiStatus).toUpperCase() === 'VERIFIED').length;
    const rejected = rows.filter((row) => String(row.kyiStatus).toUpperCase() === 'REJECTED').length;
    const pending = rows.length - verified - rejected;
    const active = rows.filter((row) => row.isActive).length;

    return { total: rows.length, pending, verified, rejected, active };
  }, [rows]);

  async function decide(row: RiderKyiRow, decision: 'APPROVED' | 'REJECTED') {
    const userId = String(row.userId || '').trim();
    const reason = reasons[userId]?.trim() || '';

    if (!userId) {
      setError('Cannot save decision because this rider row has no userId.');
      return;
    }

    if (decision === 'REJECTED' && !reason) {
      setError('Please enter a rejection reason before rejecting this rider.');
      return;
    }

    setBusyId(userId);
    setError('');
    setNotice('');

    try {
      const res = await fetch(
        '/api/careport/admin/kyc/riders/' + encodeURIComponent(userId) + '/decision',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ decision, reason }),
        },
      );

      const payload = await res.json().catch(() => ({}));

      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || 'Failed to save rider KYI decision.');
      }

      setNotice(
        decision === 'APPROVED'
          ? 'Rider KYI approved and rider activation enabled.'
          : 'Rider KYI rejected with reason recorded.',
      );

      setReasons((current) => ({ ...current, [userId]: '' }));
      await loadRows();
    } catch (err: any) {
      setError(err?.message || 'Failed to save rider KYI decision.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                CarePort KYC governance
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
                Rider KYI review
              </h1>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
                Review rider identity status, KYI submission details, rejection history and activation readiness before
                riders can support CarePort pickup and delivery workflows.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="/admin/careport/kyc"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                KYC hub
              </a>
              <a
                href="/admin/careport/kyc/pharmacies"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Pharmacy review
              </a>
              <a
                href="/admin/careport"
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                CarePort admin
              </a>
            </div>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Loaded</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{counts.total}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Pending</p>
            <p className="mt-2 text-2xl font-bold text-amber-950">{counts.pending}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Verified</p>
            <p className="mt-2 text-2xl font-bold text-emerald-950">{counts.verified}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Rejected</p>
            <p className="mt-2 text-2xl font-bold text-rose-950">{counts.rejected}</p>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Active</p>
            <p className="mt-2 text-2xl font-bold text-sky-950">{counts.active}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_160px_auto]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search rider user ID, country, status or rejection reason"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
            />

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
            >
              {STATUS_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <input
              value={country}
              onChange={(event) => setCountry(event.target.value.toUpperCase())}
              placeholder="Country"
              maxLength={3}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm uppercase outline-none focus:border-slate-400"
            />

            <button
              type="button"
              onClick={loadRows}
              disabled={loading}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {notice ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {notice}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {error}
            </div>
          ) : null}
        </section>

        <section className="space-y-4">
          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              Loading rider KYI submissions...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              No rider KYI submissions matched this filter.
            </div>
          ) : (
            filteredRows.map((row) => {
              const userId = String(row.userId || '').trim();

              return (
                <article key={userId || String(row.id)} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold text-slate-950">
                          {userId || 'Unknown rider'}
                        </h2>
                        <span className={'rounded-full border px-3 py-1 text-xs font-semibold ' + statusClass(row.kyiStatus)}>
                          {row.kyiStatus || 'PENDING_REVIEW'}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                          {row.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      <dl className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <dt className="font-medium text-slate-400">Country</dt>
                          <dd className="mt-1 text-slate-900">{row.country || 'Not recorded'}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-400">Submitted</dt>
                          <dd className="mt-1 text-slate-900">{dateText(row.kyiSubmittedAt)}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-400">Verified</dt>
                          <dd className="mt-1 text-slate-900">{dateText(row.kyiVerifiedAt)}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-400">Updated</dt>
                          <dd className="mt-1 text-slate-900">{dateText(row.updatedAt)}</dd>
                        </div>
                      </dl>

                      {row.kyiRejectedReason ? (
                        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
                          <span className="font-semibold">Previous rejection reason:</span> {row.kyiRejectedReason}
                        </div>
                      ) : null}
                    </div>

                    <div className="w-full space-y-3 xl:w-80">
                      <textarea
                        value={reasons[userId] || ''}
                        onChange={(event) =>
                          setReasons((current) => ({ ...current, [userId]: event.target.value }))
                        }
                        placeholder="Reason required for rejection"
                        className="min-h-[92px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => decide(row, 'APPROVED')}
                          disabled={busyId === userId}
                          className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => decide(row, 'REJECTED')}
                          disabled={busyId === userId}
                          className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>

                  <details className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                      View rider KYI record
                    </summary>
                    <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                      {prettyJson(Object.fromEntries(extraFields(row)))}
                    </pre>
                  </details>
                </article>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}