// apps/admin-dashboard/app/clinicians/CliniciansSectionClient.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ClinicianActions from './ClinicianActions';

type Clinician = {
  id: string;
  userId?: string | null;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  specialty?: string | null;
  feeCents?: number | null;
  currency?: string | null;
  status?: string | null;
  trainingScheduledAt?: string | null;
  trainingCompleted?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastLoginAt?: string | null;
  hpcsaVerified?: boolean | null;
};

type SortKey =
  | 'name'
  | 'specialty'
  | 'email'
  | 'status'
  | 'fee'
  | 'created'
  | 'training'
  | 'updated'
  | 'login'
  | 'hpcsa';

type SortDir = 'asc' | 'desc';

type Tone = 'slate' | 'amber' | 'emerald' | 'blue' | 'rose' | 'gray';

function safeDate(s?: string | null) {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}
function fmtDateTimeShort(s?: string | null) {
  const d = safeDate(s);
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}
function fmtMoney(feeCents?: number | null, currency = 'ZAR') {
  if (typeof feeCents !== 'number') return '—';
  try {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Math.round(feeCents / 100));
  } catch {
    return `R ${(feeCents / 100).toFixed(0)}`;
  }
}
function initials(name?: string | null) {
  const t = (name ?? '').trim();
  if (!t) return 'CL';
  const parts = t.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? 'C';
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : parts[0]?.[1];
  return (a + (b ?? 'L')).toUpperCase();
}
function normalizeStatus(s?: string | null) {
  return String(s ?? '').trim().toLowerCase();
}
function statusTone(status?: string | null): Tone {
  const s = normalizeStatus(status);
  if (s === 'pending') return 'amber';
  if (s === 'active') return 'emerald';
  if (s === 'disabled') return 'slate';
  if (s === 'disciplinary') return 'rose';
  if (s === 'archived') return 'gray';
  return 'slate';
}
function statusLabel(status?: string | null, fallback: string) {
  const s = String(status ?? '').trim();
  return s ? s : fallback;
}

function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    amber: 'bg-amber-100 text-amber-800 ring-amber-200',
    emerald: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    blue: 'bg-blue-100 text-blue-800 ring-blue-200',
    rose: 'bg-rose-100 text-rose-800 ring-rose-200',
    gray: 'bg-gray-100 text-gray-700 ring-gray-200',
  };
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        tones[tone],
      ].join(' ')}
    >
      {children}
    </span>
  );
}

function buildHref(baseParams: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  const merged = { ...baseParams, ...patch };
  for (const [k, v] of Object.entries(merged)) {
    if (v == null || v === '') continue;
    sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `/clinicians?${qs}` : '/clinicians';
}

function nextDir(currentSort: SortKey | null, currentDir: SortDir, key: SortKey): SortDir {
  if (currentSort !== key) return 'asc';
  return currentDir === 'asc' ? 'desc' : 'asc';
}

export default function CliniciansSectionClient(props: {
  title: string;
  mode: 'pending' | 'active';
  demo: boolean;
  rows: Clinician[];
  total: number;
  page: number;
  pageSize: number;
  pageKey: 'page' | 'pp' | 'ap';
  baseParams: Record<string, string | undefined>;
  sort: SortKey | null;
  dir: SortDir;
}) {
  const router = useRouter();

  const {
    title,
    mode,
    demo,
    rows,
    total,
    page,
    pageSize,
    pageKey,
    baseParams,
    sort,
    dir,
  } = props;

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: Tone; text: string } | null>(null);

  // reset selection when rows change (paging/search/sort)
  useEffect(() => {
    setSelected({});
  }, [rows]);

  const idsOnPage = useMemo(() => rows.map((r) => r.id), [rows]);
  const selectedIds = useMemo(() => idsOnPage.filter((id) => selected[id]), [idsOnPage, selected]);
  const allOnPageSelected = idsOnPage.length > 0 && selectedIds.length === idsOnPage.length;
  const someOnPageSelected = selectedIds.length > 0 && selectedIds.length < idsOnPage.length;

  const masterRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (masterRef.current) masterRef.current.indeterminate = someOnPageSelected;
  }, [someOnPageSelected]);

  const maxPage = Math.max(1, Math.ceil((total || 0) / Math.max(1, pageSize)));
  const from = total === 0 ? 0 : Math.min(total, (page - 1) * pageSize + 1);
  const to = total === 0 ? 0 : Math.min(total, page * pageSize);

  const hrefPrev = buildHref(baseParams, { [pageKey]: String(Math.max(1, page - 1)) });
  const hrefNext = buildHref(baseParams, { [pageKey]: String(Math.min(maxPage, page + 1)) });

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const next: Record<string, boolean> = { ...prev };
      const target = !allOnPageSelected;
      for (const id of idsOnPage) next[id] = target;
      return next;
    });
  }, [allOnPageSelected, idsOnPage]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const runBulk = useCallback(
    async (endpoint: string, actionName: string) => {
      if (demo) return;
      if (selectedIds.length === 0) return;

      setBusy(actionName);
      setNotice(null);

      const results = await Promise.allSettled(
        selectedIds.map(async (id) => {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id }),
          });
          if (!res.ok) {
            const txt = await res.text().catch(() => '');
            throw new Error(`${id}: ${res.status} ${txt}`);
          }
          return true;
        })
      );

      const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      if (failed.length) {
        setNotice({
          tone: 'rose',
          text: `${actionName}: ${failed.length} failed. (First: ${String(failed[0]?.reason?.message ?? failed[0]?.reason)})`,
        });
      } else {
        setNotice({ tone: 'emerald', text: `${actionName}: done for ${selectedIds.length}.` });
      }

      setBusy(null);
      setSelected({});
      router.refresh();
    },
    [demo, router, selectedIds]
  );

  const sortHeader = useCallback(
    (label: string, key: SortKey) => {
      const active = sort === key;
      const currentSymbol = active ? (dir === 'asc' ? '▲' : '▼') : '↕';
      const href = buildHref(baseParams, {
        sort: key,
        dir: nextDir(sort, dir, key),
        [pageKey]: '1', // reset paging on sort
      });

      return (
        <Link
          href={href}
          className={[
            'inline-flex items-center gap-2 hover:underline underline-offset-4',
            active ? 'text-slate-900' : 'text-slate-700',
          ].join(' ')}
          title={`Sort by ${label}`}
        >
          <span>{label}</span>
          <span className={active ? 'text-slate-700' : 'text-slate-400'}>{currentSymbol}</span>
        </Link>
      );
    },
    [baseParams, dir, pageKey, sort]
  );

  const onRowClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (demo) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Ignore clicks from interactive elements or anything marked no-rowclick
      if (
        target.closest('[data-no-rowclick]') ||
        target.closest('a') ||
        target.closest('button') ||
        target.closest('input') ||
        target.closest('label')
      ) {
        return;
      }

      router.push(`/clinicians/${encodeURIComponent(id)}`);
    },
    [demo, router]
  );

  return (
    <section className="bg-white border rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{title}</h2>
            <Badge tone={mode === 'pending' ? 'amber' : 'emerald'}>{total}</Badge>
            {demo && <Badge tone="blue">Demo</Badge>}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Showing <span className="font-medium text-slate-700">{from}-{to}</span> of{' '}
            <span className="font-medium text-slate-700">{total}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link
              href={hrefPrev}
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-black/5"
            >
              Prev
            </Link>
          ) : (
            <span className="rounded-lg border px-3 py-1.5 text-sm text-slate-400">Prev</span>
          )}

          {page < maxPage ? (
            <Link
              href={hrefNext}
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-black/5"
            >
              Next
            </Link>
          ) : (
            <span className="rounded-lg border px-3 py-1.5 text-sm text-slate-400">Next</span>
          )}
        </div>
      </div>

      {demo && (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          Actions are disabled in demo mode.
        </div>
      )}

      {notice && (
        <div
          className={[
            'mt-3 rounded-lg border p-3 text-sm',
            notice.tone === 'emerald'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900',
          ].join(' ')}
        >
          {notice.text}
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border bg-white p-3">
          <div className="text-sm text-slate-700">
            Selected <span className="font-semibold">{selectedIds.length}</span> on this page
          </div>

          <div className="flex flex-wrap items-center gap-2" data-no-rowclick>
            {mode === 'pending' ? (
              <>
                <button
                  disabled={demo || !!busy}
                  onClick={() => runBulk('/api/admin/clinicians/approve', 'Approve')}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {busy === 'Approve' ? 'Approving…' : 'Approve selected'}
                </button>
                <button
                  disabled={demo || !!busy}
                  onClick={() => runBulk('/api/admin/clinicians/reject', 'Reject')}
                  className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {busy === 'Reject' ? 'Rejecting…' : 'Reject selected'}
                </button>
              </>
            ) : (
              <>
                <button
                  disabled={demo || !!busy}
                  onClick={() => runBulk('/api/admin/clinicians/disable', 'Disable')}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {busy === 'Disable' ? 'Disabling…' : 'Disable selected'}
                </button>
                <button
                  disabled={demo || !!busy}
                  onClick={() => runBulk('/api/admin/clinicians/discipline', 'Disciplinary')}
                  className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {busy === 'Disciplinary' ? 'Updating…' : 'Disciplinary selected'}
                </button>
                <button
                  disabled={demo || !!busy}
                  onClick={() => runBulk('/api/admin/clinicians/archive', 'Archive')}
                  className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {busy === 'Archive' ? 'Archiving…' : 'Archive selected'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Desktop table */}
      <div className="mt-4 hidden md:block rounded-xl border bg-white overflow-hidden">
        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-white">
              <tr className="border-b">
                <th className="sticky top-0 z-10 bg-white px-4 py-3 text-left w-[48px]" data-no-rowclick>
                  <input
                    ref={masterRef}
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleAll}
                    disabled={demo}
                    aria-label="Select all on page"
                  />
                </th>

                <th className="sticky top-0 z-10 bg-white px-4 py-3 text-left font-semibold text-slate-700">
                  {sortHeader('Clinician', 'name')}
                </th>

                <th className="sticky top-0 z-10 bg-white px-4 py-3 text-left font-semibold text-slate-700">
                  {sortHeader('Specialty', 'specialty')}
                </th>

                <th className="sticky top-0 z-10 bg-white px-4 py-3 text-left font-semibold text-slate-700">
                  {sortHeader('Email', 'email')}
                </th>

                <th className="sticky top-0 z-10 bg-white px-4 py-3 text-left font-semibold text-slate-700">
                  {sortHeader('HPCSA', 'hpcsa')}
                </th>

                <th className="sticky top-0 z-10 bg-white px-4 py-3 text-left font-semibold text-slate-700">
                  {sortHeader('Last login', 'login')}
                </th>

                <th className="sticky top-0 z-10 bg-white px-4 py-3 text-left font-semibold text-slate-700">
                  {sortHeader('Updated', 'updated')}
                </th>

                {mode === 'pending' ? (
                  <>
                    <th className="sticky top-0 z-10 bg-white px-4 py-3 text-left font-semibold text-slate-700">
                      {sortHeader('Signed up', 'created')}
                    </th>
                    <th className="sticky top-0 z-10 bg-white px-4 py-3 text-left font-semibold text-slate-700">
                      {sortHeader('Training', 'training')}
                    </th>
                  </>
                ) : (
                  <>
                    <th className="sticky top-0 z-10 bg-white px-4 py-3 text-left font-semibold text-slate-700">
                      {sortHeader('Status', 'status')}
                    </th>
                    <th className="sticky top-0 z-10 bg-white px-4 py-3 text-left font-semibold text-slate-700">
                      {sortHeader('Fee', 'fee')}
                    </th>
                  </>
                )}

                <th className="sticky top-0 z-10 bg-white px-4 py-3 text-right font-semibold text-slate-700 w-[320px]" data-no-rowclick>
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((c) => {
                const name = c.displayName ?? c.userId ?? c.id;
                const status = statusLabel(c.status, mode === 'pending' ? 'pending' : 'active');
                const tone = statusTone(status);

                return (
                  <tr
                    key={c.id}
                    className={[
                      'border-b last:border-b-0 hover:bg-slate-50/60',
                      demo ? '' : 'cursor-pointer',
                    ].join(' ')}
                    onClick={(e) => onRowClick(e, c.id)}
                  >
                    <td className="px-4 py-3" data-no-rowclick>
                      <input
                        type="checkbox"
                        checked={!!selected[c.id]}
                        onChange={() => toggleOne(c.id)}
                        disabled={demo}
                        aria-label={`Select ${name}`}
                      />
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-slate-100 ring-1 ring-slate-200 flex items-center justify-center text-xs font-semibold text-slate-700">
                          {initials(c.displayName)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <Link
                              href={`/clinicians/${encodeURIComponent(c.id)}`}
                              className="font-medium text-slate-900 truncate hover:underline underline-offset-4"
                              title={name}
                              data-no-rowclick
                            >
                              {name}
                            </Link>
                            {demo && <Badge tone="blue">Demo</Badge>}
                            <Badge tone={tone}>{status}</Badge>
                          </div>
                          <div className="text-xs text-slate-500 truncate">{c.id}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-slate-700">{c.specialty ?? '—'}</td>

                    <td className="px-4 py-3 text-slate-700">
                      {c.email ? (
                        <a
                          className="hover:underline underline-offset-4"
                          href={`mailto:${c.email}`}
                          data-no-rowclick
                        >
                          {c.email}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {c.hpcsaVerified === true ? (
                        <Badge tone="emerald">Verified</Badge>
                      ) : c.hpcsaVerified === false ? (
                        <Badge tone="rose">Unverified</Badge>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-700">{fmtDateTimeShort(c.lastLoginAt)}</td>
                    <td className="px-4 py-3 text-slate-700">{fmtDateTimeShort(c.updatedAt)}</td>

                    {mode === 'pending' ? (
                      <>
                        <td className="px-4 py-3 text-slate-700">{fmtDateTimeShort(c.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-700">{fmtDateTimeShort(c.trainingScheduledAt)}</span>
                            {c.trainingCompleted ? (
                              <Badge tone="emerald">Complete</Badge>
                            ) : c.trainingScheduledAt ? (
                              <Badge tone="blue">Scheduled</Badge>
                            ) : (
                              <Badge tone="slate">Not set</Badge>
                            )}
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3">
                          <Badge tone={tone}>{status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {fmtMoney(c.feeCents ?? null, c.currency ?? 'ZAR')}
                        </td>
                      </>
                    )}

                    <td className="px-4 py-3 text-right" data-no-rowclick>
                      <div className={demo ? 'opacity-60 pointer-events-none' : ''}>
                        <ClinicianActions mode={mode} clinicianId={c.id} />
                      </div>
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={mode === 'pending' ? 11 : 11} className="px-4 py-8 text-center text-slate-600">
                    No clinicians found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards (kept) */}
      <ul className="md:hidden mt-4 space-y-3">
        {rows.map((c) => {
          const name = c.displayName ?? c.userId ?? c.id;
          const status = statusLabel(c.status, mode === 'pending' ? 'pending' : 'active');
          const tone = statusTone(status);

          return (
            <li key={c.id} className="border rounded-xl p-3 bg-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-100 ring-1 ring-slate-200 flex items-center justify-center text-sm font-semibold text-slate-700">
                    {initials(c.displayName)}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/clinicians/${encodeURIComponent(c.id)}`}
                        className="font-medium truncate hover:underline underline-offset-4"
                        title={name}
                      >
                        {name}
                      </Link>
                      <Badge tone={tone}>{status}</Badge>
                      {demo && <Badge tone="blue">Demo</Badge>}
                    </div>

                    <div className="text-sm text-slate-600 mt-0.5">{c.specialty ?? '—'}</div>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>HPCSA: {c.hpcsaVerified === true ? 'Verified' : c.hpcsaVerified === false ? 'Unverified' : '—'}</span>
                      <span>Last login: {fmtDateTimeShort(c.lastLoginAt)}</span>
                      <span>Updated: {fmtDateTimeShort(c.updatedAt)}</span>

                      {mode === 'pending' ? (
                        <>
                          <span>Signed up: {fmtDateTimeShort(c.createdAt)}</span>
                          <span>Training: {fmtDateTimeShort(c.trainingScheduledAt)}</span>
                        </>
                      ) : (
                        <span>Consult fee: {fmtMoney(c.feeCents ?? null, c.currency ?? 'ZAR')}</span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-2" data-no-rowclick>
                      <input
                        type="checkbox"
                        checked={!!selected[c.id]}
                        onChange={() => toggleOne(c.id)}
                        disabled={demo}
                        aria-label={`Select ${name}`}
                      />
                      <span className="text-xs text-slate-500">Select</span>
                    </div>
                  </div>
                </div>

                <div className={demo ? 'opacity-60 pointer-events-none' : ''} data-no-rowclick>
                  <ClinicianActions mode={mode} clinicianId={c.id} />
                </div>
              </div>
            </li>
          );
        })}

        {rows.length === 0 && <li className="text-sm text-slate-600">No clinicians found.</li>}
      </ul>

      {/* Bottom pager */}
      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
        <div>
          Page <span className="font-medium text-slate-800">{page}</span> of{' '}
          <span className="font-medium text-slate-800">{maxPage}</span>
        </div>
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link href={hrefPrev} className="rounded-lg border px-3 py-1.5 hover:bg-black/5">
              Prev
            </Link>
          ) : (
            <span className="rounded-lg border px-3 py-1.5 text-slate-400">Prev</span>
          )}
          {page < maxPage ? (
            <Link href={hrefNext} className="rounded-lg border px-3 py-1.5 hover:bg-black/5">
              Next
            </Link>
          ) : (
            <span className="rounded-lg border px-3 py-1.5 text-slate-400">Next</span>
          )}
        </div>
      </div>
    </section>
  );
}
