//apps/admin-dashboard/components/widgets/PayoutsDueTile.tsx
'use client';

import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';

const APIGW = process.env.NEXT_PUBLIC_APIGW_BASE || 'http://localhost:3010';

type Payout = { id: string; amountCents: number; currency: string; status: string };

export default function PayoutsDueTile() {
  const [count, setCount] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Expected Gateway endpoint (wire to Prisma Payout model):
        // GET /api/finance/payouts?status=pending → { items: Payout[] }
        const r = await fetch(`${APIGW}/api/finance/payouts?status=pending`, {
          credentials: 'include',
          cache: 'no-store',
        });

        if (r.status === 404) {
          // Graceful fallback values until endpoint exists
          if (alive) { setCount(0); setTotal(0); }
          return;
        }

        const j = await r.json().catch(() => ({}));
        const items: Payout[] = Array.isArray(j?.items) ? j.items : [];
        const sum = items.reduce((acc, p) => acc + (p.amountCents || 0), 0);

        if (alive) {
          setCount(items.length ?? 0);
          setTotal(sum);
        }
      } catch (e: any) {
        if (alive) setErr(e?.message || 'failed');
      }
    })();
    return () => { alive = false; };
  }, []);

  const zar = (total ?? 0) / 100;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-semibold">{count ?? '—'}</div>
        <div className="rounded-lg border bg-gray-50 p-2">
          <Wallet className="h-5 w-5 text-gray-700" />
        </div>
      </div>
      <div className="text-xs text-gray-600">Payouts due</div>
      <div className="text-sm text-gray-700">
        Total: <b>{Number.isFinite(zar) ? `R ${zar.toLocaleString('en-ZA', { maximumFractionDigits: 2 })}` : '—'}</b>
      </div>
      {err && <div className="text-xs text-rose-600">Could not load payouts.</div>}

      <div className="mt-2">
        <a href="/settings/payouts" className="text-sm text-blue-600 hover:underline">
          Manage payouts →
        </a>
      </div>
    </div>
  );
}
