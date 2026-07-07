// apps/admin-dashboard/app/admin/medreach/evidence/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Evidence = {
  id: string;
  kind: string;
  subjectId?: string | null;
  subjectType?: string | null;
  applicantRef?: string | null;
  documentType?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  sha256?: string | null;
  storageMode?: string | null;
  status?: string | null;
  decision?: string | null;
  reviewReason?: string | null;
  sourceEvidenceId?: string | null;
  hasInlineFile?: boolean;
  fileDataUrl?: string | null;
  notes?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
  at?: string | null;
};

type Filter = 'all' | 'submitted' | 'accepted' | 'rejected' | 'needs_more_info';

function fmtDate(value?: string | null) {
  if (!value) return '-';

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';

  return d.toLocaleString();
}

function fmtBytes(value?: number | null) {
  const n = Number(value || 0);

  if (!Number.isFinite(n) || n <= 0) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;

  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function tone(status?: string | null) {
  const s = String(status || '').toUpperCase();

  if (s === 'ACCEPTED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (s === 'REJECTED') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (s === 'NEEDS_MORE_INFO') return 'border-blue-200 bg-blue-50 text-blue-700';

  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function isSubmitted(item: Evidence) {
  return item.kind === 'medreach_onboarding_evidence_submitted';
}

export default function MedReachEvidenceReviewPage() {
  const [items, setItems] = useState<Evidence[]>([]);
  const [filter, setFilter] = useState<Filter>('submitted');
  const [query, setQuery] = useState('');
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Evidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    setNotice(null);

    try {
      const res = await fetch('/api/admin/medreach/evidence?limit=300', {
        cache: 'no-store',
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      setItems(Array.isArray(json?.data) ? json.data : []);
    } catch (error: any) {
      setErr(error?.message || 'Unable to load evidence');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const reviewedSourceIds = useMemo(() => {
    return new Set(
      items
        .filter((item) => item.sourceEvidenceId)
        .map((item) => String(item.sourceEvidenceId)),
    );
  }, [items]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return items.filter((item) => {
      const status = String(item.status || '').toLowerCase();

      if (filter === 'submitted') {
        if (!isSubmitted(item)) return false;
        if (reviewedSourceIds.has(item.id)) return false;
      }

      if (filter === 'accepted' && status !== 'accepted') return false;
      if (filter === 'rejected' && status !== 'rejected') return false;
      if (filter === 'needs_more_info' && status !== 'needs_more_info') return false;

      if (!needle) return true;

      return [
        item.id,
        item.subjectId,
        item.subjectType,
        item.applicantRef,
        item.documentType,
        item.fileName,
        item.actorId,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [filter, items, query, reviewedSourceIds]);

  async function review(item: Evidence, decision: 'ACCEPTED' | 'REJECTED' | 'NEEDS_MORE_INFO') {
    const reviewReason = reasonById[item.id] || '';

    if ((decision === 'REJECTED' || decision === 'NEEDS_MORE_INFO') && !reviewReason.trim()) {
      setErr('Review reason is required for rejection or further-information request.');
      return;
    }

    setBusyId(item.id);
    setErr(null);
    setNotice(null);

    try {
      const res = await fetch('/api/admin/medreach/evidence', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          evidenceId: item.id,
          decision,
          reviewReason,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      setNotice(`Evidence ${decision.toLowerCase().replace(/_/g, ' ')}.`);
      await load();
    } catch (error: any) {
      setErr(error?.message || 'Unable to review evidence');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-950">
            MedReach Compliance Evidence
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Review lab KYB and phleb KYI evidence submitted from MedReach onboarding.
            Evidence review supports the onboarding decision but does not automatically
            activate applicants.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            href="/admin/medreach/onboarding"
            className="rounded-full border bg-white px-3 py-1 hover:bg-gray-50"
          >
            Onboarding control centre
          </Link>
          <button
            type="button"
            onClick={load}
            className="rounded-full border bg-gray-900 px-3 py-1 text-white hover:bg-black"
          >
            Refresh
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">Total evidence events</div>
          <div className="mt-1 text-2xl font-semibold">{items.length}</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">Pending submitted</div>
          <div className="mt-1 text-2xl font-semibold">
            {items.filter((item) => isSubmitted(item) && !reviewedSourceIds.has(item.id)).length}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">Accepted</div>
          <div className="mt-1 text-2xl font-semibold">
            {items.filter((item) => item.status === 'ACCEPTED').length}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">Needs attention</div>
          <div className="mt-1 text-2xl font-semibold">
            {items.filter((item) => ['REJECTED', 'NEEDS_MORE_INFO'].includes(String(item.status))).length}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2 text-xs">
          {(['all', 'submitted', 'accepted', 'rejected', 'needs_more_info'] as Filter[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`rounded-full border px-3 py-1 ${
                filter === item
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {item.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full rounded border px-3 py-2 text-sm md:max-w-sm"
          placeholder="Search applicant, file, document type"
        />
      </section>

      {notice ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {notice}
        </section>
      ) : null}

      {err ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {err}
        </section>
      ) : null}

      <section className="space-y-3">
        {loading ? (
          <div className="rounded-xl border bg-white p-5 text-sm text-gray-500">
            Loading evidence...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border bg-white p-5 text-sm text-gray-500">
            No evidence rows match this filter.
          </div>
        ) : (
          filtered.map((item) => (
            <article key={item.id} className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-gray-950">
                      {item.documentType?.replace(/_/g, ' ') || 'Evidence'}
                    </h2>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone(item.status)}`}>
                      {item.status || 'SUBMITTED'}
                    </span>
                    <span className="rounded-full border bg-gray-50 px-2 py-0.5 text-[10px] text-gray-600">
                      {item.subjectType || '-'}
                    </span>
                  </div>

                  <div className="mt-1 text-xs text-gray-500">
                    Subject <span className="font-mono">{item.subjectId || '-'}</span> / Evidence{' '}
                    <span className="font-mono">{item.id}</span>
                  </div>
                </div>

                <div className="text-xs text-gray-500">{fmtDate(item.at)}</div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 text-xs md:grid-cols-4">
                <div>
                  <div className="text-gray-500">File</div>
                  <div className="truncate font-semibold">{item.fileName || '-'}</div>
                </div>
                <div>
                  <div className="text-gray-500">MIME</div>
                  <div className="truncate font-semibold">{item.mimeType || '-'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Size</div>
                  <div className="font-semibold">{fmtBytes(item.sizeBytes)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Submitted by</div>
                  <div className="truncate font-semibold">{item.actorId || item.actorRole || '-'}</div>
                </div>
              </div>

              {item.notes ? (
                <div className="mt-3 rounded-lg border bg-gray-50 p-3 text-xs text-gray-700">
                  {item.notes}
                </div>
              ) : null}

              {item.reviewReason ? (
                <div className="mt-3 rounded-lg border bg-blue-50 p-3 text-xs text-blue-800">
                  Review note: {item.reviewReason}
                </div>
              ) : null}

              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <textarea
                  value={reasonById[item.id] || ''}
                  onChange={(event) =>
                    setReasonById((prev) => ({ ...prev, [item.id]: event.target.value }))
                  }
                  className="min-h-[70px] flex-1 rounded border px-3 py-2 text-xs"
                  placeholder="Admin review reason / note"
                />

                <div className="flex flex-wrap gap-2 text-xs">
                  {item.fileDataUrl ? (
                    <button
                      type="button"
                      onClick={() => setPreview(item)}
                      className="rounded border bg-white px-3 py-1 hover:bg-gray-50"
                    >
                      Preview
                    </button>
                  ) : null}

                  {isSubmitted(item) && !reviewedSourceIds.has(item.id) ? (
                    <>
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => review(item, 'ACCEPTED')}
                        className="rounded border bg-emerald-700 px-3 py-1 text-white hover:bg-emerald-800 disabled:bg-gray-200"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => review(item, 'NEEDS_MORE_INFO')}
                        className="rounded border bg-white px-3 py-1 hover:bg-gray-50 disabled:bg-gray-100"
                      >
                        Needs info
                      </button>
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => review(item, 'REJECTED')}
                        className="rounded border bg-rose-700 px-3 py-1 text-white hover:bg-rose-800 disabled:bg-gray-200"
                      >
                        Reject
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{preview.fileName}</div>
                <div className="text-xs text-gray-500">{preview.mimeType}</div>
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded border px-3 py-1 text-xs hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            {preview.mimeType === 'application/pdf' ? (
              <iframe
                src={preview.fileDataUrl || ''}
                title={preview.fileName || 'Evidence PDF'}
                className="h-[75vh] w-full rounded border"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.fileDataUrl || ''}
                alt={preview.fileName || 'Evidence'}
                className="max-h-[75vh] w-full rounded border object-contain"
              />
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}