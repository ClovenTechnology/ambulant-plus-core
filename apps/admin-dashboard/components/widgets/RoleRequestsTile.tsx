//apps/admin-dashboard/components/widgets/RoleRequestsTile.tsx
'use client';

import { useEffect, useState } from 'react';
import { UserRoundCog } from 'lucide-react';

const APIGW = process.env.NEXT_PUBLIC_APIGW_BASE || 'http://localhost:3010';

type RoleReqItem = {
  id: string;
  email: string;
  name?: string;
  requestedRoles?: string[];
  createdAt?: string;
};

export default function RoleRequestsTile() {
  const [count, setCount] = useState<number | null>(null);
  const [recent, setRecent] = useState<RoleReqItem[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${APIGW}/api/roles/requests?status=pending`, {
          credentials: 'include',
          cache: 'no-store',
        });
        const j = await r.json().catch(() => ({}));
        const items: RoleReqItem[] = Array.isArray(j?.items) ? j.items : [];
        if (alive) {
          setCount(items.length ?? 0);
          setRecent(items.slice(0, 3));
        }
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
          <UserRoundCog className="h-5 w-5 text-gray-700" />
        </div>
      </div>
      <div className="text-xs text-gray-600">Pending role requests</div>

      {err ? (
        <div className="text-xs text-rose-600">Could not load role requests.</div>
      ) : (
        <ul className="mt-2 space-y-1">
          {recent.map((r) => (
            <li key={r.id} className="text-sm">
              <span className="font-medium">{r.name || r.email}</span>
              {r.requestedRoles?.length ? (
                <span className="text-gray-600"> — {r.requestedRoles.join(', ')}</span>
              ) : null}
            </li>
          ))}
          {recent.length === 0 && <li className="text-sm text-gray-500">No recent requests.</li>}
        </ul>
      )}

      <div className="mt-2">
        <a href="/settings/people/role-requests" className="text-sm text-blue-600 hover:underline">
          Open role requests →
        </a>
      </div>
    </div>
  );
}
