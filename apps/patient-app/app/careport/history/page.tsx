// apps/patient-app/app/careport/history/page.tsx
'use client';

import React, { useEffect, useState } from 'react';

type HistoryItem = {
  id: string;
  encId?: string;
  orderNo?: string;
  status: string;
  createdAt?: string;
  deliveredAt?: string | null;
  pharmacyName?: string;
  riderName?: string;
  total?: number;
  paymentMethod?: string;
};

const MOCK_HISTORY: HistoryItem[] = [
  {
    id: 'H-1',
    encId: 'E-2000',
    orderNo: 'ORD-1001',
    status: 'Delivered',
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    deliveredAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    pharmacyName: 'MedCare Sandton',
    riderName: 'Sipho R.',
    total: 120.0,
    paymentMethod: 'Medical Aid',
  },
  {
    id: 'H-2',
    encId: 'E-2001',
    orderNo: 'ORD-1002',
    status: 'Out for delivery',
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    deliveredAt: null,
    pharmacyName: 'HealthPlus Rosebank',
    riderName: 'Thandi M.',
    total: 85.5,
    paymentMethod: 'Card',
  },
];

type HistoryPageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export default function HistoryPage({ searchParams }: HistoryPageProps) {
  const encIdFilter =
    (searchParams?.encId as string | undefined) ||
    (searchParams?.id as string | undefined) ||
    '';

  const [encId, setEncId] = useState(encIdFilter);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const ac = new AbortController();

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const param =
          encId && encId.trim()
            ? `?encId=${encodeURIComponent(encId.trim())}`
            : '';
        const url = `/api/careport/history${param}`;
        const res = await fetch(url, {
          cache: 'no-store',
          signal: ac.signal,
        });

        if (!mounted) return;

        if (!res.ok) {
          console.warn(
            'History API returned non-OK status, using mock fallback',
          );
          setItems(MOCK_HISTORY);
          setError(
            'Live history unavailable — showing a recent mock example.',
          );
          return;
        }

        const data = await res.json();
        let list: HistoryItem[] = [];

        if (Array.isArray(data.items)) list = data.items;
        else if (Array.isArray(data.history)) list = data.history;
        else if (Array.isArray(data)) list = data;

        if (!list || list.length === 0) {
          setItems([]);
          setError('No delivery history found for the selected filter.');
        } else {
          setItems(list);
        }
      } catch (err) {
        if (!mounted || ac.signal.aborted) return;
        console.error(
          'Failed to load delivery history; using mock fallback',
          err,
        );
        setItems(MOCK_HISTORY);
        setError(
          'Unable to reach history service — showing a mock example.',
        );
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      ac.abort();
    };
  }, [encId]);

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-4">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">
            CarePort Delivery History
          </h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1">
            View recent CarePort deliveries. Filter by encounter ID if needed.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <a
            href="/careport"
            className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
          >
            ← Back to CarePort
          </a>
        </div>
      </header>

      <section className="bg-white border rounded-lg p-4 space-y-3">
        <div>
          <label htmlFor="history-encId" className="text-xs text-gray-500">
            Filter by encounter ID (optional)
          </label>
          <div className="mt-1 flex flex-col sm:flex-row gap-2">
            <input
              id="history-encId"
              className="border px-3 py-2 rounded text-sm flex-1"
              value={encId}
              onChange={(e) => setEncId(e.target.value)}
              placeholder="e.g. E-2000 (leave blank to see all)"
            />
          </div>
          <p className="mt-1 text-[11px] text-gray-400">
            If opened from CarePort Dispatch, the current encounter ID is
            pre-filled.
          </p>
        </div>

        {loading && (
          <div className="text-sm text-gray-500">Loading delivery history…</div>
        )}
        {!loading && error && (
          <div className="text-xs text-rose-600 mt-1">{error}</div>
        )}
      </section>

      <section className="bg-white border rounded-lg p-4">
        <h2 className="text-sm font-medium mb-3">Deliveries</h2>
        {items.length === 0 && !loading ? (
          <p className="text-sm text-gray-500">
            No deliveries to show yet. Adjust the filter above or try again
            later.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs md:text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">Order</th>
                  <th className="py-2 pr-4">Encounter</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Pharmacy</th>
                  <th className="py-2 pr-4">Rider</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2 pr-4">Delivered</th>
                  <th className="py-2 pr-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr
                    key={it.id}
                    className="border-b last:border-b-0 hover:bg-gray-50"
                  >
                    <td className="py-2 pr-4 font-medium">
                      {it.orderNo ?? it.id}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">
                      {it.encId ?? '—'}
                    </td>
                    <td className="py-2 pr-4 text-gray-700">{it.status}</td>
                    <td className="py-2 pr-4 text-gray-600">
                      {it.pharmacyName ?? '—'}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">
                      {it.riderName ?? '—'}
                    </td>
                    <td className="py-2 pr-4 text-gray-500">
                      {it.createdAt
                        ? new Date(it.createdAt).toLocaleString()
                        : '—'}
                    </td>
                    <td className="py-2 pr-4 text-gray-500">
                      {it.deliveredAt
                        ? new Date(it.deliveredAt).toLocaleString()
                        : '—'}
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-700">
                      {typeof it.total === 'number'
                        ? `R ${it.total.toFixed(2)}${
                            it.paymentMethod ? ` • ${it.paymentMethod}` : ''
                          }`
                        : it.paymentMethod || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
