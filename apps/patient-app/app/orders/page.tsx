// apps/patient-app/app/orders/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import useSWR from 'swr';
import { CLIN } from '@/src/lib/config'; // gateway/clinic base

// Try to use site-level toast component if present
let toast: ((m: string, t?: 'success' | 'error' | 'info') => void) | null = null;
try {
  toast = require('@/components/ToastMount').toast as typeof toast;
} catch {}

type OrderRow = {
  id: string;
  kind: 'pharmacy' | 'lab';
  encounterId?: string;
  sessionId?: string;
  caseId?: string;
  createdAt?: string;
  title?: string;
  details?: string;
  status?: string;
  providerTrackingUrl?: string | null;

  // provider metadata (optional)
  providerName?: string;
  providerLogoUrl?: string | null;
  providerAddress?: string | null;
  providerPhone?: string | null;
  providerLatLng?: { lat: number; lng: number } | null;
};

const DEFAULT_PAGE_SIZE = 20;

function useToasterFallback() {
  return (msg: string, tone: 'success' | 'error' | 'info' = 'info') => {
    if (toast) toast(msg, tone);
    else {
      // fallback
      // eslint-disable-next-line no-alert
      alert(`${tone.toUpperCase()}: ${msg}`);
    }
  };
}

/* Simple CSV exporter (works without external helper) */
function downloadCsv(rows: OrderRow[], filename = 'orders.csv') {
  if (!rows || rows.length === 0) return;
  const fields = [
    'id',
    'kind',
    'title',
    'details',
    'encounterId',
    'caseId',
    'sessionId',
    'status',
    'createdAt',
    'providerName',
    'providerAddress',
  ];
  const csv = [
    fields.join(','),
    ...rows.map((r) =>
      fields
        .map((f) => {
          const v = (r as any)[f] ?? '';
          const s = String(v).replace(/"/g, '""');
          return `"${s}"`;
        })
        .join(','),
    ),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function statusTone(status?: string) {
  const s = String(status || '').toLowerCase();
  if (['completed', 'delivered', 'ready', 'fulfilled'].includes(s)) {
    return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  }
  if (['sent', 'processing', 'in_progress', 'in-progress'].includes(s)) {
    return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200';
  }
  if (['created', 'pending'].includes(s)) {
    return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
  }
  if (['cancelled', 'failed', 'rejected'].includes(s)) {
    return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200';
  }
  return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
}

function kindTone(kind: OrderRow['kind']) {
  return kind === 'pharmacy'
    ? 'bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200'
    : 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200';
}

function prettyKind(kind: OrderRow['kind']) {
  return kind === 'pharmacy' ? 'Pharmacy' : 'Lab';
}

function formatCreatedAt(value?: string) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
}

function countByKind(rows: OrderRow[], kind: OrderRow['kind']) {
  return rows.filter((r) => r.kind === kind).length;
}

function countCompleted(rows: OrderRow[]) {
  return rows.filter((r) =>
    ['completed', 'delivered', 'fulfilled'].includes(String(r.status || '').toLowerCase()),
  ).length;
}

/* Main component */
export default function OrdersListPage() {
  const [encId, setEncId] = useState('');
  const [debouncedEncId, setDebouncedEncId] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'pharmacy' | 'lab'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [view, setView] = useState<'cards' | 'table'>('cards');

  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const notify = useToasterFallback();

  // Debounce search input without an external runtime dependency.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedEncId(encId);
    }, 400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [encId]);

  // Fetcher URL. Prefer configured gateway/clinic base; otherwise use the local Next API route.
  const baseUrl = CLIN && CLIN.length > 0 ? CLIN.replace(/\/$/, '') : '';
  const apiPath = (path: string) => `${baseUrl}${path}`;
  const ordersUrl = apiPath('/api/orders');

  // useSWR to fetch orders; return an empty live state if the request fails
  const { data: orders = [], mutate } = useSWR<OrderRow[]>(ordersUrl, async (url) => {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // accept several shapes
      if (Array.isArray(json)) return json;
      if (Array.isArray(json.orders)) return json.orders;
      if (Array.isArray(json.data)) return json.data;
      return [];
    } catch (err) {
      console.error('orders fetch error', err);
      notify('Failed to load orders from server.', 'error');
      return [];
    }
  });

  // apply client-side filters as last-resort safety
  const filtered = useMemo(() => {
    return (orders ?? []).filter((r) => {
      if (kindFilter !== 'all' && r.kind !== kindFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (debouncedEncId) {
        const haystack = `${r.encounterId || ''} ${r.caseId || ''} ${r.sessionId || ''} ${r.id || ''}`.toLowerCase();
        if (!haystack.includes(debouncedEncId.toLowerCase())) return false;
      }
      return true;
    });
  }, [orders, kindFilter, statusFilter, debouncedEncId]);

  // pagination controls
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filtered.length / pageSize)),
    [filtered.length, pageSize],
  );

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const visible = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  const visibleSelected = useMemo(
    () => visible.filter((v) => selectedRows.has(v.id)).length,
    [visible, selectedRows],
  );

  const summary = useMemo(
    () => ({
      total: orders.length,
      pharmacy: countByKind(orders, 'pharmacy'),
      lab: countByKind(orders, 'lab'),
      completed: countCompleted(orders),
    }),
    [orders],
  );

  // selection helpers
  const toggleRow = (id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectVisible = () => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      const allVisible = visible.length > 0 && visible.every((v) => next.has(v.id));
      if (allVisible) {
        visible.forEach((v) => next.delete(v.id));
      } else {
        visible.forEach((v) => next.add(v.id));
      }
      return next;
    });
  };

  const clearFilters = () => {
    setEncId('');
    setDebouncedEncId('');
    setKindFilter('all');
    setStatusFilter('all');
    setPage(1);
  };

  // bulk actions
  const handleExportSelected = () => {
    const rows = orders.filter((o) => selectedRows.has(o.id));
    if (rows.length === 0) return notify('No orders selected', 'info');
    downloadCsv(
      rows,
      `orders-bulk-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_')}.csv`,
    );
    notify('Export started', 'success');
  };

  const handleReorderSelected = async () => {
    const rows = orders.filter((o) => selectedRows.has(o.id));
    if (rows.length === 0) return notify('No orders selected', 'info');

    for (const r of rows) {
      try {
        const url = apiPath('/api/orders/reorder');
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ orderId: r.id, caseId: r.caseId ?? null }),
        });
        if (!res.ok) throw new Error(String(res.status));
      } catch (err) {
        console.error('bulk reorder error', err);
      }
    }

    notify('Bulk reorder requested', 'success');
    mutate();
  };

  // single-row actions
  const openDetail = (row: OrderRow) => {
    setSelected(row);
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setSelected(null);
    setDetailOpen(false);
  };

  async function handleReorder(row: OrderRow) {
    try {
      const url = apiPath('/api/orders/reorder');
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId: row.id, caseId: row.caseId ?? null }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      notify('Reorder requested', 'success');
      mutate();
    } catch (e) {
      console.error('reorder error', e);
      notify('Failed to request reorder', 'error');
    }
  }

  async function handleReprint(row: OrderRow) {
    try {
      const url = apiPath(`/api/orders/${encodeURIComponent(row.id)}/print`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${row.id}.pdf`;
      a.click();
      URL.revokeObjectURL(blobUrl);
      notify('Reprint downloaded', 'success');
    } catch (e) {
      console.error('reprint error', e);
      notify('Failed to reprint', 'error');
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white shadow-2xl">
        <div className="p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-slate-100 backdrop-blur">
                Orders workspace
              </div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                My Orders
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                Track pharmacy and lab orders, review provider details, export records,
                and trigger safe reorder and reprint flows from one place.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Total</div>
                <div className="mt-2 text-2xl font-semibold">{summary.total}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Pharmacy</div>
                <div className="mt-2 text-2xl font-semibold">{summary.pharmacy}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Lab</div>
                <div className="mt-2 text-2xl font-semibold">{summary.lab}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Completed</div>
                <div className="mt-2 text-2xl font-semibold">{summary.completed}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur md:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3">
              <div className="md:col-span-1">
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Search
                </label>
                <input
                  placeholder="Encounter, case, session or order ID..."
                  value={encId}
                  onChange={(e) => {
                    setEncId(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Kind
                </label>
                <select
                  value={kindFilter}
                  onChange={(e) => {
                    setKindFilter(e.target.value as 'all' | 'pharmacy' | 'lab');
                    setPage(1);
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                >
                  <option value="all">All kinds</option>
                  <option value="pharmacy">Pharmacy</option>
                  <option value="lab">Lab</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                >
                  <option value="all">All statuses</option>
                  <option value="created">Created</option>
                  <option value="sent">Sent</option>
                  <option value="completed">Completed</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <button
                onClick={() => setView((v) => (v === 'cards' ? 'table' : 'cards'))}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {view === 'cards' ? 'Table view' : 'Card view'}
              </button>

              <button
                onClick={() => mutate()}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Refresh
              </button>

              <button
                onClick={clearFilters}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Clear filters
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
                {filtered.length} shown
              </span>
              <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
                Total {orders.length}
              </span>
              <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
                Selected {selectedRows.size}
              </span>
              {visible.length > 0 ? (
                <button
                  onClick={toggleSelectVisible}
                  className="rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100"
                >
                  {visibleSelected === visible.length ? 'Unselect visible' : 'Select visible'}
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportSelected}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Export selected
              </button>
              <button
                onClick={handleReorderSelected}
                className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Reorder selected
              </button>
            </div>
          </div>
        </div>
      </section>

      {visible.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto max-w-md">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl">
              📦
            </div>
            <h2 className="text-lg font-semibold text-slate-900">No orders found</h2>
            <p className="mt-2 text-sm text-slate-500">
              Try changing your filters or clearing the search to reveal more records.
            </p>
            <button
              onClick={clearFilters}
              className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Reset filters
            </button>
          </div>
        </section>
      ) : view === 'cards' ? (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {visible.map((r) => (
            <article
              key={r.id}
              className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(r.id)}
                    onChange={() => toggleRow(r.id)}
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold',
                          kindTone(r.kind),
                        )}
                      >
                        {prettyKind(r.kind)}
                      </span>
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold',
                          statusTone(r.status),
                        )}
                      >
                        {r.status || 'Unknown'}
                      </span>
                    </div>

                    <h3 className="truncate text-base font-semibold text-slate-900 md:text-lg">
                      {r.title ?? r.id}
                    </h3>

                    <div className="mt-1 text-xs text-slate-500">{r.id}</div>

                    {r.details ? (
                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                        {r.details}
                      </p>
                    ) : null}

                    <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-slate-600 sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 px-3 py-2">
                        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                          Encounter
                        </div>
                        <div className="mt-1 truncate">{r.encounterId ?? '—'}</div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-2">
                        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                          Case
                        </div>
                        <div className="mt-1 truncate">{r.caseId ?? '—'}</div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-2">
                        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                          Session
                        </div>
                        <div className="mt-1 truncate">{r.sessionId ?? '—'}</div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-2">
                        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                          Created
                        </div>
                        <div className="mt-1 truncate">
                          {r.createdAt
                            ? formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })
                            : '—'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                      {r.providerTrackingUrl ? (
                        <a
                          href={r.providerTrackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2 font-medium text-teal-700 transition hover:bg-teal-100"
                        >
                          Track
                        </a>
                      ) : (
                        <Link
                          href="/careport/track"
                          className="rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-2 font-medium text-indigo-700 transition hover:bg-indigo-100"
                        >
                          Track
                        </Link>
                      )}

                      <button
                        onClick={() => handleReorder(r)}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Reorder
                      </button>

                      <button
                        onClick={() => handleReprint(r)}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Reprint
                      </button>

                      <button
                        onClick={() => openDetail(r)}
                        className="rounded-2xl bg-slate-900 px-3 py-2 font-medium text-white transition hover:bg-slate-800"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                </div>

                <div className="hidden shrink-0 md:block">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-semibold text-slate-700">
                    {(r.providerName || prettyKind(r.kind)).slice(0, 2).toUpperCase()}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="p-4">
                    <input
                      type="checkbox"
                      checked={visible.every((v) => selectedRows.has(v.id)) && visible.length > 0}
                      onChange={toggleSelectVisible}
                    />
                  </th>
                  <th className="p-4">Order</th>
                  <th className="p-4">Kind</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Encounter / Case</th>
                  <th className="p-4">Created</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-slate-100 transition hover:bg-slate-50/80"
                  >
                    <td className="p-4 align-top">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(r.id)}
                        onChange={() => toggleRow(r.id)}
                      />
                    </td>

                    <td className="p-4">
                      <div className="font-semibold text-slate-900">{r.title ?? r.id}</div>
                      <div className="mt-1 text-xs text-slate-500">{r.id}</div>
                      {r.details ? (
                        <div className="mt-2 max-w-md text-xs text-slate-500">{r.details}</div>
                      ) : null}
                    </td>

                    <td className="p-4">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold',
                          kindTone(r.kind),
                        )}
                      >
                        {prettyKind(r.kind)}
                      </span>
                    </td>

                    <td className="p-4">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold',
                          statusTone(r.status),
                        )}
                      >
                        {r.status || 'Unknown'}
                      </span>
                    </td>

                    <td className="p-4">
                      <div>{r.encounterId ?? '—'}</div>
                      <div className="mt-1 text-xs text-slate-400">{r.caseId ?? '—'}</div>
                    </td>

                    <td className="p-4">{formatCreatedAt(r.createdAt)}</td>

                    <td className="p-4 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-2">
                        {r.providerTrackingUrl ? (
                          <a
                            href={r.providerTrackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 transition hover:bg-teal-100"
                          >
                            Track
                          </a>
                        ) : (
                          <Link
                            href="/careport/track"
                            className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100"
                          >
                            Track
                          </Link>
                        )}
                        <button
                          onClick={() => handleReorder(r)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          Reorder
                        </button>
                        <button
                          onClick={() => handleReprint(r)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          Reprint
                        </button>
                        <button
                          onClick={() => openDetail(r)}
                          className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800"
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Prev
          </button>
          <div className="rounded-2xl bg-slate-50 px-4 py-2 text-sm text-slate-600">
            Page <span className="font-semibold text-slate-900">{page}</span> of{' '}
            <span className="font-semibold text-slate-900">{totalPages}</span>
          </div>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <label className="flex items-center gap-2">
            <span>Page size</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>

          <div className="rounded-2xl bg-slate-50 px-3 py-2">
            {visible.length} on this page
          </div>
        </div>
      </section>

      {/* detail modal with provider card + map */}
      {detailOpen && selected ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold',
                        kindTone(selected.kind),
                      )}
                    >
                      {prettyKind(selected.kind)}
                    </span>
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold',
                        statusTone(selected.status),
                      )}
                    >
                      {selected.status || 'Unknown'}
                    </span>
                  </div>

                  <h2 className="text-2xl font-semibold tracking-tight">
                    {selected.title ?? selected.id}
                  </h2>
                  <div className="mt-1 text-sm text-slate-300">{selected.id}</div>

                  {selected.details ? (
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                      {selected.details}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleReorder(selected)}
                    className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/20"
                  >
                    Reorder
                  </button>
                  <button
                    onClick={() => handleReprint(selected)}
                    className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/20"
                  >
                    Reprint
                  </button>
                  <button
                    onClick={() => {
                      downloadCsv([selected], `order-${selected.id}.csv`);
                      notify('Order exported', 'success');
                    }}
                    className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/20"
                  >
                    Export single
                  </button>
                  <button
                    onClick={closeDetail}
                    className="rounded-2xl bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-[1.5fr_1fr]">
              <div className="space-y-6">
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Order details
                  </h3>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-[11px] uppercase tracking-wide text-slate-400">
                        Encounter
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {selected.encounterId ?? '—'}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-[11px] uppercase tracking-wide text-slate-400">
                        Case
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {selected.caseId ?? '—'}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-[11px] uppercase tracking-wide text-slate-400">
                        Session
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {selected.sessionId ?? '—'}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-[11px] uppercase tracking-wide text-slate-400">
                        Created
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {formatCreatedAt(selected.createdAt)}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Action center
                  </h3>

                  <div className="mt-4 flex flex-wrap gap-3">
                    {selected.providerTrackingUrl ? (
                      <a
                        href={selected.providerTrackingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-medium text-teal-700 transition hover:bg-teal-100"
                      >
                        Track order
                      </a>
                    ) : (
                      <Link
                        href="/careport/track"
                        className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
                      >
                        Track order
                      </Link>
                    )}

                    <button
                      onClick={() => handleReorder(selected)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Reorder
                    </button>

                    <button
                      onClick={() => handleReprint(selected)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Reprint
                    </button>

                    <button
                      onClick={() => {
                        downloadCsv([selected], `order-${selected.id}.csv`);
                        notify('Order exported', 'success');
                      }}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Export single
                    </button>
                  </div>
                </section>
              </div>

              <aside className="space-y-6">
                <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
                      {selected.providerLogoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selected.providerLogoUrl}
                          alt={selected.providerName ?? 'Provider'}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="text-base font-semibold text-slate-700">
                          {(selected.providerName || 'Provider').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-slate-900">
                        {selected.providerName ?? 'Provider'}
                      </div>
                      {selected.providerPhone ? (
                        <div className="mt-1 text-sm text-slate-500">
                          {selected.providerPhone}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {selected.providerAddress ? (
                    <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                      <div className="text-[11px] uppercase tracking-wide text-slate-400">
                        Collection / Pickup
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-700">
                        {selected.providerAddress}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-5 space-y-3">
                    {selected.providerLatLng ? (
                      <>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            `${selected.providerLatLng.lat},${selected.providerLatLng.lng}`,
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-2xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-medium text-teal-700 transition hover:bg-teal-100"
                        >
                          Open in maps
                        </a>

                        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                          <iframe
                            title="provider-map"
                            src={`https://www.google.com/maps?q=${selected.providerLatLng.lat},${selected.providerLatLng.lng}&hl=en&z=15&output=embed`}
                            style={{ width: '100%', height: 260, border: 0 }}
                            loading="lazy"
                          />
                        </div>
                      </>
                    ) : selected.providerAddress ? (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          selected.providerAddress,
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-2xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-medium text-teal-700 transition hover:bg-teal-100"
                      >
                        View on map
                      </a>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                        Provider location is not available for this order.
                      </div>
                    )}
                  </div>
                </section>
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}