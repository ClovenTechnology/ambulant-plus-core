// apps/patient-app/app/orders/[id]/page.tsx
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import type { Order } from '../../api/orders/route';
import { formatDateTime } from '../../../src/lib/date';     // ✅ correct relative path
import { fmt2 } from '../../../src/lib/number';             // ✅ correct relative path

export const dynamic = 'force-dynamic';

function baseUrl() {
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3002';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

async function fetchOrders(): Promise<Order[]> {
  try {
    const res = await fetch(`${baseUrl()}/api/orders`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const all = await fetchOrders();
  const order = all.find(o => o.id === params.id);

  if (!order) {
    // nicer scoped 404 if you created /app/orders/[id]/not-found.tsx
    notFound();
  }

  const createdAt = order!.createdAt ?? new Date().toISOString();
  const status = (order!.status ?? 'Open').toLowerCase();

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Order: {order!.id}</h1>
          <div className="text-xs text-gray-500">
            Created: {formatDateTime(createdAt)}
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            href="/orders"
            className="px-3 py-2 border rounded bg-white hover:bg-gray-50 text-sm"
          >
            Back to Orders
          </Link>
          <Link
            href="/orders/print"
            className="px-3 py-2 border rounded bg-white hover:bg-gray-50 text-sm"
          >
            Print Orders
          </Link>
        </div>
      </header>

      <section className="p-4 bg-white border rounded-lg space-y-3">
        <div className="flex items-center gap-2">
          <div className="font-medium">{order!.type ?? 'Order'}</div>
          <span
            className={[
              'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] border',
              status === 'closed'
                ? 'bg-gray-50 text-gray-700 border-gray-200'
                : 'bg-amber-50 text-amber-700 border-amber-200',
            ].join(' ')}
          >
            {(order!.status ?? 'Open')}
          </span>
        </div>

        {order!.note && (
          <div className="text-sm">
            <span className="font-medium">Note:</span>{' '}
            <span className="text-gray-700">{order!.note}</span>
          </div>
        )}

        {(order!.meds ?? []).length > 0 && (
          <div className="mt-2">
            <div className="font-semibold mb-2">Medications</div>
            <table className="w-full text-sm border">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="p-2 border">Drug</th>
                  <th className="p-2 border">SIG</th>
                  <th className="p-2 border">Qty</th>
                  <th className="p-2 border">Refills</th>
                </tr>
              </thead>
              <tbody>
                {order!.meds!.map((m, i) => (
                  <tr key={i} className="odd:bg-white even:bg-gray-50">
                    <td className="p-2 border">{m?.drug ?? '—'}</td>
                    <td className="p-2 border">
                      {m?.sig ? <span className="text-gray-700">{m.sig}</span> : '—'}
                    </td>
                    <td className="p-2 border">{m?.qty ?? '—'}</td>
                    <td className="p-2 border">{m?.refills ?? 0}</td>
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
