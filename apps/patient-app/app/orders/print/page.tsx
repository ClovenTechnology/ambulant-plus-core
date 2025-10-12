// apps/patient-app/app/orders/print/page.tsx
import { headers } from 'next/headers';
import PrintButton from '../../../components/PrintButton';           // âœ… 3 levels up
import { formatDate, formatDateTime } from '../../../src/lib/date';  // âœ… 3 levels up
import { fmt2 } from '../../../src/lib/number';                      // âœ… 3 levels up

export const dynamic = 'force-dynamic';

type Med = { drug: string; sig?: string; qty?: number; refills?: number };
type Order = {
  id: string;
  type?: string;
  note?: string;
  status?: string;           // 'Open'|'Closed'
  createdAt?: string;        // ISO
  meds?: Med[];
};

type Allergy = {
  id: string;
  substance: string;
  reaction: string;
  severity: 'Mild' | 'Moderate' | 'Severe';
  status: 'Active' | 'Resolved';
  notedAt: string;
};

function baseUrl() {
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3002';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${baseUrl()}${path}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function OrdersPrintPage() {
  const orders = (await getJson<Order[]>('/api/orders')) ?? [];
  const allergies = (await getJson<Allergy[]>('/api/allergies')) ?? [];

  // Build a fast set of active allergen names (case-insensitive)
  const activeAllergens = new Set(
    allergies
      .filter(a => a.status === 'Active')
      .map(a => a.substance.trim().toLowerCase())
  );

  const hasAllergyHit = (m?: Med) => {
    const name = (m?.drug ?? '').toLowerCase();
    for (const a of activeAllergens) {
      if (a && name.includes(a)) return true;
    }
    return false;
  };

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between print:justify-start print:gap-4">
        <div>
          <h1 className="text-2xl font-bold">Order Summary</h1>
          <div className="text-xs text-gray-500">
            Generated: {formatDateTime(new Date())}
          </div>
        </div>
        <div className="print:hidden">
          <PrintButton />
        </div>
      </header>

      {orders.length === 0 ? (
        <section className="p-4 bg-white border rounded">
          <div className="text-sm text-gray-600">No orders to print.</div>
        </section>
      ) : (
        <section className="p-4 bg-white border rounded space-y-6">
          {orders.map((o) => {
            const status = (o.status ?? 'Open').toLowerCase();
            return (
              <div key={o.id} className="border rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                  <div className="font-semibold">
                    {o.type ?? 'Order'} <span className="text-gray-400">â€¢</span> {o.id}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={[
                        'inline-flex items-center rounded px-1.5 py-0.5 border',
                        status === 'closed'
                          ? 'bg-gray-100 text-gray-700 border-gray-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200',
                      ].join(' ')}
                    >
                      {o.status ?? 'Open'}
                    </span>
                    <span className="text-gray-500">
                      {formatDateTime(o.createdAt ?? new Date().toISOString())}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {o.note && (
                    <div className="text-sm">
                      <span className="font-medium">Note:</span>{' '}
                      <span className="text-gray-700">{o.note}</span>
                    </div>
                  )}

                  {(o.meds ?? []).length > 0 && (
                    <table className="w-full text-sm border">
                      <thead>
                        <tr className="bg-gray-50 text-left">
                          <th className="p-2 border">Drug</th>
                          <th className="p-2 border">SIG</th>
                          <th className="p-2 border">Qty</th>
                          <th className="p-2 border">Refills</th>
                          <th className="p-2 border">Warnings</th>
                        </tr>
                      </thead>
                      <tbody>
                        {o.meds!.map((m, i) => {
                          const warn = hasAllergyHit(m);
                          return (
                            <tr key={i} className="odd:bg-white even:bg-gray-50">
                              <td className="p-2 border">{m?.drug ?? 'â€”'}</td>
                              <td className="p-2 border">{m?.sig ?? 'â€”'}</td>
                              <td className="p-2 border">{m?.qty ?? 'â€”'}</td>
                              <td className="p-2 border">{m?.refills ?? 0}</td>
                              <td className="p-2 border">
                                {warn ? (
                                  <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] bg-rose-50 text-rose-700 border border-rose-200">
                                    Allergy match
                                  </span>
                                ) : (
                                  <span className="text-gray-400">â€”</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <footer className="text-xs text-gray-500 print:hidden">
        Use your browserâ€™s Print dialog to save as PDF.
      </footer>
    </main>
  );
}
