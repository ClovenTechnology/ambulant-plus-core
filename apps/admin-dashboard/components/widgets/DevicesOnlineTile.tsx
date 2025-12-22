//apps/admin-dashboard/components/widgets/DevicesOnlineTile.tsx
'use client';

import { useEffect, useState } from 'react';
import { Cpu } from 'lucide-react';

const APIGW = process.env.NEXT_PUBLIC_APIGW_BASE || 'http://localhost:3010';

export default function DevicesOnlineTile() {
  const [count, setCount] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Expected Gateway endpoint (optional stub):
        // GET /api/devices/online?window=300 → { count: number }
        const r = await fetch(`${APIGW}/api/devices/online?window=300`, {
          credentials: 'include',
          cache: 'no-store',
        });

        if (r.status === 404) {
          if (alive) setCount(0); // graceful default
          return;
        }

        const j = await r.json().catch(() => ({}));
        if (alive) setCount(Number.isFinite(j?.count) ? j.count : 0);
      } catch (e: any) {
        if (alive) setErr(e?.message || 'failed');
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-semibold">{count ?? '—'}</div>
        <div className="rounded-lg border bg-gray-50 p-2">
          <Cpu className="h-5 w-5 text-gray-700" />
        </div>
      </div>
      <div className="text-xs text-gray-600">Devices online (last 5 min)</div>
      {err && <div className="text-xs text-rose-600">Could not load devices.</div>}
      <div className="mt-2">
        <a href="/devices" className="text-sm text-blue-600 hover:underline">
          Open device fleet →
        </a>
      </div>
    </div>
  );
}
