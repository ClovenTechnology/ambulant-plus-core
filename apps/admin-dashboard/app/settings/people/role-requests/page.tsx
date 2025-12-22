// apps/admin-dashboard/app/settings/people/role-requests/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { RoleName } from '@/src/lib/gateway';
import { RoleReqApi } from '@/src/lib/gateway';

type Item = {
  id: string;
  email: string;
  name?: string;
  userId?: string;
  departmentId?: string | null;
  designationId?: string | null;
  requestedRoles: RoleName[];
  status: 'pending' | 'approved' | 'denied';
  reason?: string | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
  createdAt: string;
};

export default function RoleRequestsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [view, setView] = useState<'pending' | 'approved' | 'denied' | 'all'>('pending');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    setLoading(true); setErr(null);
    try {
      const j = await RoleReqApi.list(view === 'all' ? undefined : view);
      setItems(j.items || []);
    } catch (e: any) {
      setErr(e?.message || 'failed');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [view]);

  const counts = useMemo(() => ({
    pending: items.filter(i => i.status === 'pending').length,
    approved: items.filter(i => i.status === 'approved').length,
    denied: items.filter(i => i.status === 'denied').length,
  }), [items]);

  async function decide(id: string, status: 'approved' | 'denied') {
    const reason = status === 'denied' ? (prompt('Reason (optional)') ?? undefined) : undefined;
    try {
      await RoleReqApi.decide(id, { status, decidedBy: 'admin@example.com', reason });
      refresh();
    } catch (e: any) {
      alert(`Failed: ${e?.message || 'error'}`);
    }
  }

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Role Requests</h1>
        <div className="flex gap-2">
          {(['pending','approved','denied','all'] as const).map(v => (
            <button key={v}
              className={`px-3 py-1.5 rounded border text-sm ${view===v? 'bg-black text-white' : 'bg-white hover:bg-black/5'}`}
              onClick={()=>setView(v)}
            >
              {v[0].toUpperCase()+v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {err && <div className="p-3 border bg-rose-50 text-rose-700 rounded text-sm">{err}</div>}
      {loading && <div className="text-sm text-gray-600">Loading…</div>}

      <div className="text-xs text-gray-600">Showing {items.length} requests (P:{counts.pending} / A:{counts.approved} / D:{counts.denied})</div>

      <ul className="space-y-2">
        {items.map(it => (
          <li key={it.id} className="border rounded bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{it.name || it.email}</div>
                <div className="text-xs text-gray-500 flex flex-wrap gap-2">
                  <span>{it.email}</span>
                  {it.userId && <span className="font-mono">({it.userId})</span>}
                  <span>Requested: {it.requestedRoles.join(', ') || '—'}</span>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${it.status==='pending'?'border-amber-200 bg-amber-50 text-amber-800': it.status==='approved'?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-rose-200 bg-rose-50 text-rose-700'}`}>
                {it.status}
              </span>
            </div>

            {it.reason && <div className="text-xs text-gray-600 mt-1">Note: {it.reason}</div>}

            <div className="mt-2 flex gap-2">
              <button className="px-2 py-1 text-xs rounded border" onClick={()=>decide(it.id, 'approved')} disabled={it.status!=='pending'}>Approve</button>
              <button className="px-2 py-1 text-xs rounded border" onClick={()=>decide(it.id, 'denied')} disabled={it.status!=='pending'}>Deny</button>
              <button className="px-2 py-1 text-xs rounded border" onClick={()=>navigator.clipboard.writeText(it.id)}>Copy ID</button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
