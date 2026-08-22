//apps/admin-dashboard/components/widgets/PayoutsDueTile.tsx
'use client';

import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';



export default function PayoutsDueTile() {
  const [count, setCount] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/dashboard/payouts-due', {
          credentials: 'include',
          cache: 'no-store',
        });

        const j = await r.json().catch(() => ({}));

        if (!r.ok || j?.ok === false) {
          throw new Error(j?.error || `HTTP ${r.status}`);
        }

        if (alive) {
          setCount(Number.isFinite(j?.count) ? j.count : 0);
          setTotal(Number.isFinite(j?.totalCents) ? j.totalCents : 0);
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
