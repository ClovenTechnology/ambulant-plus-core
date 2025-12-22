// apps/patient-app/app/orders/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import debounce from 'lodash.debounce';
import useSWR from 'swr';
import { CLIN } from '@/src/lib/config'; // gateway/clinic base

// Try to use site-level toast component if present
let toast: ((m: string, t?: 'success' | 'error' | 'info') => void) | null = null;
try { toast = require('@/components/ToastMount').toast as typeof toast; } catch {}

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
  const fields = ['id','kind','title','details','encounterId','caseId','sessionId','status','createdAt','providerName','providerAddress'];
  const csv = [
    fields.join(','),
    ...rows.map(r => fields.map(f => {
      const v = (r as any)[f] ?? '';
      const s = String(v).replace(/"/g, '""');
      return `"${s}"`;
    }).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* Mock fallback (only used if API unreachable) */
function makeMockOrders(): OrderRow[] {
  const now = Date.now();
  return [
    {
      id: 'ORD-P-0001',
      kind: 'pharmacy',
      createdAt: new Date(now - 1000 * 60 * 60 * 26).toISOString(),
      title: 'Amoxicillin 500mg — 30 tabs',
      details: 'Take 1 TDS × 7 days',
      encounterId: 'enc-1001',
      sessionId: 'sess-901',
      caseId: 'CASE-24001',
      status: 'created',
      providerTrackingUrl: null,
      providerName: 'CarePort Pharmacy',
      providerLogoUrl: '/images/providers/careport.png',
      providerAddress: '12 Clinic Ave, Bryanston, Johannesburg',
      providerPhone: '+27 11 555 0101',
      providerLatLng: { lat: -26.068, lng: 28.030 },
    },
    {
      id: 'ORD-L-0002',
      kind: 'lab',
      createdAt: new Date(now - 1000 * 60 * 60 * 72).toISOString(),
      title: 'Full Blood Count (FBC)',
      details: 'Stat panel - CBC + diff',
      encounterId: 'enc-1002',
      sessionId: 'sess-902',
      caseId: 'CASE-23987',
      status: 'completed',
      providerTrackingUrl: 'https://lab.example/track/ORD-L-0002',
      providerName: 'MedReach Labs',
      providerLogoUrl: '/images/providers/medreach.png',
      providerAddress: '3 Lab Rd, Sandton, Johannesburg',
      providerPhone: '+27 11 555 0202',
      providerLatLng: { lat: -26.107, lng: 28.056 },
    },
  ];
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

  // debounce search input
  const debouncedSearch = useMemo(() => debounce((val: string) => setDebouncedEncId(val), 400), []);
  useEffect(() => {
    debouncedSearch(encId);
    return () => { debouncedSearch.cancel(); };
  }, [encId, debouncedSearch]);

  // fetcher URL (prefer DB-backed gateway; CLIN used as gateway fallback)
  const baseUrl = (CLIN && CLIN.length > 0) ? CLIN.replace(/\/$/, '') : '/api';
  const ordersUrl = `${baseUrl}/api/orders`;

  // useSWR to fetch orders; fall back to mock if request fails
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
      notify('Failed to load orders from server — using mock data', 'info');
      return makeMockOrders();
    }
  });

  // apply client-side filters as last-resort safety
  const filtered = useMemo(() => {
    return (orders ?? []).filter(r => {
      if (kindFilter !== 'all' && r.kind !== kindFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (debouncedEncId && r.encounterId && !r.encounterId.includes(debouncedEncId)) return false;
      return true;
    });
  }, [orders, kindFilter, statusFilter, debouncedEncId]);

  // pagination controls
  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / pageSize)), [filtered.length, pageSize]);
  useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages, page]);

  const visible = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  // selection helpers
  const toggleRow = (id: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectVisible = () => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      const allVisible = visible.every(v => next.has(v.id));
      if (allVisible) {
        visible.forEach(v => next.delete(v.id));
      } else {
        visible.forEach(v => next.add(v.id));
      }
      return next;
    });
  };

  // bulk actions
  const handleExportSelected = () => {
    const rows = orders.filter(o => selectedRows.has(o.id));
    if (rows.length === 0) return notify('No orders selected', 'info');
    downloadCsv(rows, `orders-bulk-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'_')}.csv`);
    notify('Export started', 'success');
  };

  const handleReorderSelected = async () => {
    const rows = orders.filter(o => selectedRows.has(o.id));
    if (rows.length === 0) return notify('No orders selected', 'info');
    for (const r of rows) {
      try {
        const url = `${baseUrl}/api/orders/reorder`;
        const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId: r.id, caseId: r.caseId ?? null }) });
        if (!res.ok) throw new Error(String(res.status));
      } catch (err) {
        console.error('bulk reorder error', err);
      }
    }
    notify('Bulk reorder requested', 'success');
    mutate();
  };

  // single-row actions (read-only status, reorder/reprint)
  const openDetail = (row: OrderRow) => { setSelected(row); setDetailOpen(true); };
  const closeDetail = () => { setSelected(null); setDetailOpen(false); };

  async function handleReorder(row: OrderRow) {
    try {
      const url = `${baseUrl}/api/orders/reorder`;
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId: row.id, caseId: row.caseId ?? null }) });
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
      const url = `${baseUrl}/api/orders/${encodeURIComponent(row.id)}/print`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl; a.download = `${row.id}.pdf`; a.click(); URL.revokeObjectURL(blobUrl);
      notify('Reprint downloaded', 'success');
    } catch (e) {
      console.error('reprint error', e);
      notify('Failed to reprint', 'error');
    }
  }

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Orders</h1>
          <p className="text-sm text-gray-500">Pharmacy & lab orders — track, reorder, or download records.</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setView(v => v === 'cards' ? 'table' : 'cards')} className="px-3 py-1 border rounded text-sm bg-white">
            {view === 'cards' ? 'Table view' : 'Card view'}
          </button>
          <button onClick={() => mutate()} className="px-3 py-1 border rounded text-sm bg-white">Refresh</button>
          <button onClick={handleExportSelected} className="px-3 py-1 border rounded text-sm bg-white">Export selected</button>
          <button onClick={handleReorderSelected} className="px-3 py-1 border rounded text-sm bg-white">Reorder selected</button>
        </div>
      </header>

      <section className="bg-white border rounded p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <input placeholder="Filter by encounterId..." value={encId} onChange={e => setEncId(e.target.value)} className="px-2 py-1 border rounded text-sm min-w-[220px]" />
          <select value={kindFilter} onChange={e => setKindFilter(e.target.value as any)} className="px-2 py-1 border rounded text-sm">
            <option value="all">All kinds</option>
            <option value="pharmacy">Pharmacy</option>
            <option value="lab">Lab</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-2 py-1 border rounded text-sm">
            <option value="all">All statuses</option>
            <option value="created">Created</option>
            <option value="sent">Sent</option>
            <option value="completed">Completed</option>
            <option value="delivered">Delivered</option>
          </select>

          <div className="ml-auto text-sm text-gray-500">
            {`${filtered.length} shown${orders.length ? ` • total ${orders.length}` : ''}`}
          </div>
        </div>
      </section>

      {view === 'cards' ? (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visible.map(r => (
            <article key={r.id} className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={selectedRows.has(r.id)} onChange={() => toggleRow(r.id)} className="w-4 h-4" />
                    <div>
                      <div className="text-sm font-medium">{r.title ?? r.id}</div>
                      <div className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 inline-block mt-1">{r.kind}</div>
                      <div className="text-xs px-2 py-0.5 rounded bg-gray-50 text-gray-500 inline-block ml-2 mt-1">{r.status ?? '—'}</div>
                    </div>
                  </div>
                  {r.details && <div className="text-sm text-gray-600 mt-2">{r.details}</div>}
                  <div className="text-xs text-gray-500 mt-2">
                    {r.encounterId ? <span className="mr-2">Encounter: {r.encounterId}</span> : null}
                    {r.caseId ? <span className="mr-2">Case: {r.caseId}</span> : null}
                    <span>{r.sessionId ?? ''}</span>
                    <span className="ml-2"> • {r.createdAt ? formatDistanceToNow(new Date(r.createdAt), { addSuffix: true }) : ''}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <button onClick={() => openDetail(r)} className="text-sm underline text-indigo-700">Details</button>
                  <div className="flex flex-col items-end gap-1">
                    {r.providerTrackingUrl ? (
                      <a href={r.providerTrackingUrl} target="_blank" rel="noreferrer" className="text-xs underline text-teal-700">Track</a>
                    ) : (
                      <Link href="/careport/track" className="text-xs underline text-indigo-700">Track</Link>
                    )}
                    <button onClick={() => handleReorder(r)} className="text-xs underline text-indigo-700">Reorder</button>
                    <button onClick={() => handleReprint(r)} className="text-xs underline text-indigo-700">Reprint</button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="bg-white border rounded">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="p-3"><input type="checkbox" checked={visible.every(v => selectedRows.has(v.id)) && visible.length > 0} onChange={toggleSelectVisible} /></th>
                  <th className="p-3">Order</th>
                  <th className="p-3">Kind</th>
                  <th className="p-3">Encounter / Case</th>
                  <th className="p-3">Created</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(r => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3"><input type="checkbox" checked={selectedRows.has(r.id)} onChange={() => toggleRow(r.id)} /></td>
                    <td className="p-3">
                      <div className="font-medium">{r.title ?? r.id}</div>
                      <div className="text-xs text-gray-500">{r.details ?? ''}</div>
                    </td>
                    <td className="p-3">{r.kind}</td>
                    <td className="p-3">{r.encounterId ?? '—'} <div className="text-xs text-gray-400">{r.caseId ?? ''}</div></td>
                    <td className="p-3">{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</td>
                    <td className="p-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        {r.providerTrackingUrl ? (
                          <a href={r.providerTrackingUrl} target="_blank" rel="noreferrer" className="text-xs underline text-teal-700">Track</a>
                        ) : (
                          <Link href="/careport/track" className="text-xs underline text-indigo-700">Track</Link>
                        )}
                        <button onClick={() => handleReorder(r)} className="text-xs underline text-indigo-700">Reorder</button>
                        <button onClick={() => handleReprint(r)} className="text-xs underline text-indigo-700">Reprint</button>
                        <button onClick={() => openDetail(r)} className="text-xs underline text-indigo-700">Details</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* pagination */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-2 py-1 border rounded disabled:opacity-50">Prev</button>
          <span>Page {page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-2 py-1 border rounded disabled:opacity-50">Next</button>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <label>Page size:
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className="ml-1 border rounded px-2 py-1">
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
          <div className="text-sm">{`${visible.length} shown`}</div>
        </div>
      </div>

      {/* detail modal with provider card + map */}
      {detailOpen && selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="bg-white rounded-lg p-4 w-[900px] max-w-[98vw]">
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1">
                <div className="text-xs text-gray-500">{selected.kind?.toUpperCase()}</div>
                <h2 className="text-lg font-semibold">{selected.title ?? selected.id}</h2>
                <div className="text-sm text-gray-600 mt-2">{selected.details}</div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium text-sm">Order details</h3>
                    <div className="text-sm text-gray-700 mt-2 space-y-1">
                      <div>Encounter: {selected.encounterId ?? '—'}</div>
                      <div>Case: {selected.caseId ?? '—'}</div>
                      <div>Session: {selected.sessionId ?? '—'}</div>
                      <div>Status: <span className="font-medium">{selected.status ?? '—'}</span></div>
                      <div>Created: {selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '—'}</div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium text-sm">Actions</h3>
                    <div className="mt-2 flex flex-col gap-2">
                      <div className="flex gap-2">
                        <button onClick={() => handleReorder(selected)} className="px-3 py-1 border rounded text-sm">Reorder</button>
                        <button onClick={() => handleReprint(selected)} className="px-3 py-1 border rounded text-sm">Reprint</button>
                        {selected.providerTrackingUrl ? <a href={selected.providerTrackingUrl} className="px-3 py-1 border rounded text-sm" target="_blank" rel="noreferrer">Track</a> : null}
                      </div>
                      <button onClick={() => { downloadCsv([selected], `order-${selected.id}.csv`); notify('Order exported', 'success'); }} className="px-3 py-1 border rounded text-sm">Export single</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* provider card */}
              <div className="w-64 flex-shrink-0">
                <div className="border rounded p-3 bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white rounded overflow-hidden flex items-center justify-center">
                      {selected.providerLogoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={selected.providerLogoUrl} alt={selected.providerName ?? 'Provider'} className="object-contain w-full h-full" />
                      ) : (
                        <div className="text-sm font-medium">{(selected.providerName || 'Provider').slice(0,2).toUpperCase()}</div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{selected.providerName ?? 'Provider'}</div>
                      {selected.providerPhone && <div className="text-xs text-gray-500">{selected.providerPhone}</div>}
                    </div>
                  </div>

                  {selected.providerAddress && (
                    <div className="mt-3 text-xs text-gray-600">
                      <div className="font-medium">Collection / Pickup</div>
                      <div className="mt-1">{selected.providerAddress}</div>
                    </div>
                  )}

                  <div className="mt-3 flex flex-col gap-2">
                    {selected.providerLatLng ? (
                      <>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selected.providerLatLng.lat},${selected.providerLatLng.lng}`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs underline text-teal-700"
                        >
                          Open in maps
                        </a>
                        <div className="border rounded overflow-hidden">
                          <iframe
                            title="provider-map"
                            src={`https://www.google.com/maps?q=${selected.providerLatLng.lat},${selected.providerLatLng.lng}&hl=en&z=15&output=embed`}
                            style={{ width: '100%', height: 160, border: 0 }}
                            loading="lazy"
                          />
                        </div>
                      </>
                    ) : selected.providerAddress ? (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.providerAddress)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs underline text-teal-700"
                      >
                        View on map
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 text-right">
              <button onClick={closeDetail} className="px-3 py-1 rounded border bg-white">Close</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
