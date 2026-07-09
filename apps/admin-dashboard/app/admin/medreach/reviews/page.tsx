'use client';

import React from 'react';

type ReviewStatus = 'PENDING' | 'PUBLISHED' | 'HIDDEN' | 'FLAGGED' | 'REJECTED';
type ModerationDecision = 'PUBLISHED' | 'HIDDEN' | 'FLAGGED' | 'REJECTED';

type MedReachReview = {
  id: string;
  labId?: string | null;
  networkId?: string | null;
  orderId?: string | null;
  patientId?: string | null;
  reviewerUserId?: string | null;
  stars?: number | null;
  comment?: string | null;
  status?: ReviewStatus | string | null;
  source?: string | null;
  metadata?: any;
  createdAt?: string | null;
  updatedAt?: string | null;
  reviewedAt?: string | null;
  moderatedBy?: string | null;
  moderatedAt?: string | null;
};

const statuses: Array<'ALL' | ReviewStatus> = [
  'PENDING',
  'PUBLISHED',
  'HIDDEN',
  'FLAGGED',
  'REJECTED',
  'ALL',
];

const decisions: Array<{ status: ModerationDecision; label: string; tone: string }> = [
  { status: 'PUBLISHED', label: 'Publish', tone: 'bg-emerald-700 hover:bg-emerald-800 text-white' },
  { status: 'HIDDEN', label: 'Hide', tone: 'bg-slate-700 hover:bg-slate-800 text-white' },
  { status: 'FLAGGED', label: 'Flag', tone: 'bg-amber-600 hover:bg-amber-700 text-white' },
  { status: 'REJECTED', label: 'Reject', tone: 'bg-red-700 hover:bg-red-800 text-white' },
];

function statusClasses(status?: string | null) {
  const value = String(status || '').toUpperCase();

  if (value === 'PUBLISHED') return 'bg-emerald-100 text-emerald-800';
  if (value === 'PENDING') return 'bg-amber-100 text-amber-800';
  if (value === 'FLAGGED') return 'bg-orange-100 text-orange-800';
  if (value === 'REJECTED') return 'bg-red-100 text-red-800';
  if (value === 'HIDDEN') return 'bg-slate-200 text-slate-800';

  return 'bg-slate-100 text-slate-700';
}

function formatDate(value?: string | null) {
  if (!value) return 'Not recorded';

  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function normalizeRows(payload: any): MedReachReview[] {
  const data = payload?.data || payload?.rows || payload?.reviews || payload?.items || [];
  return Array.isArray(data) ? data : [];
}

function labName(review: MedReachReview) {
  return (
    review.metadata?.labName ||
    review.metadata?.lab?.name ||
    review.metadata?.partnerName ||
    review.labId ||
    'Unknown lab'
  );
}

function resultStatus(review: MedReachReview) {
  return (
    review.metadata?.resultStatus ||
    review.metadata?.drawStatus ||
    review.metadata?.status ||
    'Not recorded'
  );
}

function starText(value?: number | null) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return 'No stars';

  return `${n}/5`;
}

async function readJsonSafe(res: Response) {
  const text = await res.text().catch(() => '');
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export default function MedReachReviewModerationPage() {
  const [rows, setRows] = React.useState<MedReachReview[]>([]);
  const [status, setStatus] = React.useState<'ALL' | ReviewStatus>('PENDING');
  const [query, setQuery] = React.useState('');
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const params = new URLSearchParams();

      if (status !== 'ALL') params.set('status', status);

      const res = await fetch(`/api/admin/medreach/reviews?${params.toString()}`, {
        cache: 'no-store',
      });

      const payload = await readJsonSafe(res);

      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || `Review load failed: HTTP ${res.status}`);
      }

      setRows(normalizeRows(payload));
    } catch (err: any) {
      setRows([]);
      setError(err?.message || 'Unable to load MedReach lab reviews');
    } finally {
      setLoading(false);
    }
  }, [status]);

  React.useEffect(() => {
    load();
  }, [load]);

  const filteredRows = React.useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) return rows;

    return rows.filter((review) => {
      const blob = [
        review.id,
        review.labId,
        review.networkId,
        review.orderId,
        review.patientId,
        review.reviewerUserId,
        review.status,
        labName(review),
        resultStatus(review),
        review.comment,
        review.metadata?.specimenBundleId,
        review.metadata?.drawId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return blob.includes(needle);
    });
  }, [rows, query]);

  const counts = React.useMemo(() => {
    return {
      total: rows.length,
      pending: rows.filter((row) => String(row.status).toUpperCase() === 'PENDING').length,
      published: rows.filter((row) => String(row.status).toUpperCase() === 'PUBLISHED').length,
      hidden: rows.filter((row) => String(row.status).toUpperCase() === 'HIDDEN').length,
      flagged: rows.filter((row) => String(row.status).toUpperCase() === 'FLAGGED').length,
      rejected: rows.filter((row) => String(row.status).toUpperCase() === 'REJECTED').length,
    };
  }, [rows]);

  function updateNote(id: string, value: string) {
    setNotes((current) => ({ ...current, [id]: value }));
  }

  async function moderate(review: MedReachReview, nextStatus: ModerationDecision) {
    const moderationNote = (notes[review.id] || '').trim();

    if ((nextStatus === 'HIDDEN' || nextStatus === 'FLAGGED' || nextStatus === 'REJECTED') && !moderationNote) {
      setError('A moderation note is required when hiding, flagging, or rejecting a review.');
      return;
    }

    setSavingId(review.id);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(`/api/admin/medreach/reviews/${encodeURIComponent(review.id)}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          moderationNote: moderationNote || `Admin moderation decision: ${nextStatus}`,
        }),
      });

      const payload = await readJsonSafe(res);

      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || `Moderation failed: HTTP ${res.status}`);
      }

      setNotice(`Review ${review.id} updated to ${nextStatus}.`);
      updateNote(review.id, '');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Unable to moderate review');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700">
                MedReach governance
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">
                Lab review moderation
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Moderate patient-submitted lab service reviews before they contribute to public
                lab or network reputation. Labs and lab networks can view permitted records, but
                publication decisions remain central-admin controlled.
              </p>
            </div>

            <button
              type="button"
              onClick={load}
              className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-5">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Total loaded</p>
              <p className="mt-1 text-2xl font-bold">{counts.total}</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase text-amber-700">Pending</p>
              <p className="mt-1 text-2xl font-bold">{counts.pending}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase text-emerald-700">Published</p>
              <p className="mt-1 text-2xl font-bold">{counts.published}</p>
            </div>
            <div className="rounded-2xl bg-orange-50 p-4">
              <p className="text-xs font-semibold uppercase text-orange-700">Flagged</p>
              <p className="mt-1 text-2xl font-bold">{counts.flagged}</p>
            </div>
            <div className="rounded-2xl bg-red-50 p-4">
              <p className="text-xs font-semibold uppercase text-red-700">Rejected</p>
              <p className="mt-1 text-2xl font-bold">{counts.rejected}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex flex-wrap gap-2">
              {statuses.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setStatus(item)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    status === item
                      ? 'bg-slate-950 text-white'
                      : 'border border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  {item === 'ALL' ? 'All' : item.charAt(0) + item.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search lab, order, review id, patient, comment..."
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>
        </section>

        {notice ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
            Loading MedReach reviews...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
            No MedReach reviews found for this filter.
          </div>
        ) : (
          <div className="grid gap-5">
            {filteredRows.map((review) => {
              const statusValue = String(review.status || 'PENDING').toUpperCase();

              return (
                <article key={review.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold">{labName(review)}</h2>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClasses(statusValue)}`}>
                          {statusValue}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {starText(review.stars)}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-slate-600">
                        Order {review.orderId || 'not recorded'} · Review {review.id}
                      </p>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase text-slate-500">Submitted</p>
                          <p className="mt-1 text-sm font-semibold">{formatDate(review.createdAt)}</p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase text-slate-500">Result/order state</p>
                          <p className="mt-1 text-sm font-semibold">{resultStatus(review)}</p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase text-slate-500">Moderated</p>
                          <p className="mt-1 text-sm font-semibold">{formatDate(review.moderatedAt)}</p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-slate-200 p-4">
                        <p className="text-xs font-semibold uppercase text-slate-500">Patient comment</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                          {review.comment || 'No comment supplied.'}
                        </p>
                      </div>

                      <div className="mt-4 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                        <p>Lab ID: {review.labId || 'not recorded'}</p>
                        <p>Network ID: {review.networkId || 'not recorded'}</p>
                        <p>Reviewer user ID: {review.reviewerUserId || 'not recorded'}</p>
                        <p>Patient ID: {review.patientId || 'not recorded'}</p>
                      </div>
                    </div>

                    <aside className="w-full max-w-xl rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-bold text-slate-900">Moderation decision</p>
                      <p className="mt-1 text-xs text-slate-600">
                        Publish only appropriate, non-identifying patient feedback. Hide, flag, or
                        reject anything unsafe, defamatory, irrelevant, or containing sensitive detail.
                      </p>

                      <label className="mt-4 grid gap-1 text-sm font-medium text-slate-700">
                        Moderation note
                        <textarea
                          value={notes[review.id] || ''}
                          onChange={(event) => updateNote(review.id, event.target.value)}
                          rows={4}
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                          placeholder="Record why this review is being published, hidden, flagged, or rejected."
                        />
                      </label>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {decisions.map((decision) => (
                          <button
                            key={decision.status}
                            type="button"
                            disabled={savingId === review.id}
                            onClick={() => moderate(review, decision.status)}
                            className={`rounded-2xl px-4 py-2 text-sm font-bold disabled:opacity-50 ${decision.tone}`}
                          >
                            {savingId === review.id ? 'Saving...' : decision.label}
                          </button>
                        ))}
                      </div>
                    </aside>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
