'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type OrderDetail = {
  id: string;
  status: string;
  createdAt?: string | null;
  paidAt?: string | null;
  currency?: string | null;
  receiptUrl?: string | null;
  items?: Array<{
    id: string;
    name: string;
    sku?: string | null;
    quantity: number;
    unitAmountZar?: number | null; // legacy field (major units)
    unitAmount?: number | null; // future-friendly (major units)
    currency?: string | null;
    imageUrl?: string | null;
  }>;
};

function fmtMoney(major: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(major);
  } catch {
    return `${currency} ${Number(major || 0).toFixed(2)}`;
  }
}

function fallbackImgForItem(name?: string) {
  const n = String(name || '').toLowerCase();
  if (n.includes('hoodie') || n.includes('shirt') || n.includes('cap') || n.includes('scrub')) return '/shop/stock/placeholder-clothing.png';
  if (n.includes('pod') || n.includes('solar') || n.includes('battery') || n.includes('router')) return '/shop/stock/placeholder-clinic.png';
  if (n.includes('ring') || n.includes('steth') || n.includes('otoscope') || n.includes('monitor') || n.includes('duecare')) return '/shop/stock/placeholder-duecare.png';
  if (n.includes('laptop') || n.includes('macbook') || n.includes('dell') || n.includes('acer')) return '/shop/stock/placeholder-tech.png';
  return '/shop/stock/placeholder-generic.png';
}

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();

    (async () => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/shop/orders/${encodeURIComponent(params.id)}`, {
          cache: 'no-store',
          signal: ac.signal,
        });
        const js = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(js?.error || 'Failed to load order');
        setOrder(js.order);
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        setError(e?.message || 'Failed to load order');
      } finally {
        setBusy(false);
      }
    })();

    return () => ac.abort();
  }, [params.id]);

  const currency = useMemo(() => order?.currency || 'ZAR', [order?.currency]);

  if (busy) return <div className="container mx-auto px-4 py-6 text-sm text-gray-600">Loading…</div>;
  if (error) return <div className="container mx-auto px-4 py-6 text-sm text-red-600">{error}</div>;
  if (!order) return null;

  return (
    <div className="container mx-auto px-4 py-6 space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">1Stop Order #{order.id}</h1>
          <p className="text-sm text-gray-600">Status: {order.status}</p>
        </div>
        <Link href="/1stop" className="text-sm text-blue-600 hover:underline">
          Back
        </Link>
      </header>

      <div className="border rounded-lg bg-white shadow-sm p-3 space-y-2">
        <div className="text-xs text-gray-600">
          <div>Created: {order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'}</div>
          <div>Paid: {order.paidAt ? new Date(order.paidAt).toLocaleString() : '—'}</div>
          <div className="mt-1">
            Currency: <span className="font-mono">{currency}</span>
          </div>
        </div>

        {order.receiptUrl && (
          <a className="text-sm text-blue-600 hover:underline" href={order.receiptUrl} target="_blank" rel="noreferrer">
            Open receipt
          </a>
        )}
      </div>

      <div className="grid gap-3">
        {(order.items || []).map((it) => {
          const itCurrency = it.currency || currency;
          const unitMajor = it.unitAmount ?? it.unitAmountZar ?? null;

          return (
            <div key={it.id} className="border rounded-lg bg-white shadow-sm p-3 flex items-center gap-3">
              <div className="w-14 h-14 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.imageUrl || fallbackImgForItem(it.name)}
                  alt={it.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1">
                <div className="text-sm font-medium">{it.name}</div>
                <div className="text-xs text-gray-600">
                  Qty: {it.quantity}
                  {it.sku ? ` • SKU: ${it.sku}` : ''}
                  {unitMajor != null ? ` • ${fmtMoney(Number(unitMajor), itCurrency)}` : ''}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
