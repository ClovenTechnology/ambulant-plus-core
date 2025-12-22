//apps/admin-dashboard/components/widgets/PendingSignupsTile.tsx
'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';

type PendingCount = { signups: number; roleRequests: number };

const APIGW = process.env.NEXT_PUBLIC_APIGW_BASE || 'http://localhost:3010';

/**
 * PendingSignupsTile
 * - Uses role-requests as a proxy for "pending approvals / signups"
 * - If you later add a dedicated endpoint (e.g. /api/admin/pending-signups), wire it below.
 */
export default function PendingSignupsTile() {
  const [data, setData] = useState<PendingCount | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // 1) Role requests pending
        const r1 = await fetch(`${APIGW}/api/roles/requests?status=pending`, {
          credentials: 'include',
          cache: 'no-store',
        });
        const j1 = await r1.json().catch(() => ({}));
        const pendingRoleReq = Array.isArray(j1?.items) ? j1.items.length : (j1?.count ?? 0);

        // 2) Optionally: dedicated pending signups endpoint (wire later)
        // const r2 = await fetch(`${APIGW}/api/admin/pending-signups`, { credentials: 'include', cache: 'no-store' });
        // const j2 = await r2.json().catch(() => ({}));
        const pendingSignups = 0; // fallback until endpoint exists

        if (alive) setData({ signups: pendingSignups, roleRequests: pendingRoleReq });
      } catch (e: any) {
        if (alive) setErr(e?.message || 'failed');
      }
    })();
    return () => { alive = false; };
  }, []);

  const total = (data?.signups ?? 0) + (data?.roleRequests ?? 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-semibold">{Number.isFinite(total) ? total : '—'}</div>
        <div className="rounded-lg border bg-gray-50 p-2">
          <Users className="h-5 w-5 text-gray-700" />
        </div>
      </div>
      <div className="text-xs text-gray-600">
        {err ? (
          <span className="text-rose-600">Could not load pending approvals.</span>
        ) : (
          <>
            <span className="inline-block mr-3">Role requests: <b>{data?.roleRequests ?? 0}</b></span>
            <span className="inline-block">Signups: <b>{data?.signups ?? 0}</b></span>
          </>
        )}
      </div>
      <div className="mt-2">
        <a
          href="/settings/people/role-requests"
          className="text-sm text-blue-600 hover:underline"
        >
          Review approvals →
        </a>
      </div>
    </div>
  );
}
