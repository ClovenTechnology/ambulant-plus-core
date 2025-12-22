'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Lab = {
  id: string;
  name: string;
  city: string;
  contact: string;
  active?: boolean;
};

export default function MedReachLabsPage() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // TODO: point this to your real API gateway or admin API
        const res = await fetch('/api/labs', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!mounted) return;
        setLabs(data.labs || []);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || 'Unable to load labs');
        setLabs([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <main className="p-6 text-sm text-gray-500">Loading labs…</main>;
  }

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-4">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">MedReach — Labs Directory</h1>
          <p className="text-xs text-gray-500 mt-1">
            View onboarded partner laboratories and open their workspaces or dashboards.
          </p>
        </div>
        <div className="text-xs text-gray-500">
          {/* If you decide to allow creation here, add a button that calls the same backend as admin */}
          Managed primarily via Admin Dashboard.
        </div>
      </header>

      {err ? (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
          {err}
        </div>
      ) : null}

      <div className="grid md:grid-cols-2 gap-4">
        {labs.map((lab) => {
          const active = lab.active !== false;
          return (
            <div
              key={lab.id}
              className={`border rounded p-4 bg-white space-y-2 ${
                active ? '' : 'opacity-60'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{lab.name}</div>
                  <div className="text-xs text-gray-600">
                    {lab.city} • {lab.contact}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    active
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {active ? 'Active' : 'Disabled'}
                </span>
              </div>

              <div className="flex gap-2 text-xs">
                <Link
                  href={`/lab/${encodeURIComponent(lab.id)}`}
                  className="px-2 py-1 border rounded bg-white hover:bg-gray-50"
                >
                  Open workspace
                </Link>
                <Link
                  href={`/lab/${encodeURIComponent(lab.id)}/dashboard`}
                  className="px-2 py-1 border rounded bg-white hover:bg-gray-50"
                >
                  View dashboard
                </Link>
              </div>
            </div>
          );
        })}
        {labs.length === 0 && (
          <div className="text-sm text-gray-500 border rounded bg-white p-4">
            No labs onboarded yet. Use the Admin Dashboard to create one.
          </div>
        )}
      </div>
    </main>
  );
}
