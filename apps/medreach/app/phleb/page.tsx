'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UserProvider } from '@/context/UserContext';
import RoleGuard from '@/components/RoleGuard';
import type { Phleb } from '@/app/api/phlebs/route';

export default function MedReachPhlebsPage() {
  const [phlebs, setPhlebs] = useState<Phleb[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showOnlyActive, setShowOnlyActive] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await fetch('/api/phlebs', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!mounted) return;
        setPhlebs(data.phlebs || []);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || 'Unable to load phlebotomists');
        setPhlebs([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const visiblePhlebs = phlebs.filter((p) =>
    showOnlyActive ? p.active : true
  );

  if (loading) {
    return (
      <UserProvider>
        <main className="max-w-5xl mx-auto p-6 text-sm text-gray-500">
          Loading phlebotomists…
        </main>
      </UserProvider>
    );
  }

  return (
    <UserProvider>
      <RoleGuard allowed={['admin']}>
        <main className="max-w-5xl mx-auto p-6 space-y-4">
          <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold">MedReach — Phlebotomists</h1>
              <p className="text-xs text-gray-500 mt-1">
                View onboarded field phlebotomists. Canonical onboarding happens in the
                Admin Dashboard.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <label className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={showOnlyActive}
                  onChange={(e) => setShowOnlyActive(e.target.checked)}
                />
                <span>Show only active</span>
              </label>
              <Link
                href="/"
                className="text-indigo-600 underline"
              >
                Back to MedReach dashboard →
              </Link>
            </div>
          </header>

          {err ? (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
              {err}
            </div>
          ) : null}

          <div className="grid md:grid-cols-2 gap-4">
            {visiblePhlebs.map((phleb) => {
              const active = phleb.active;
              return (
                <div
                  key={phleb.id}
                  className={`border rounded p-4 bg-white space-y-3 ${
                    active ? '' : 'opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{phleb.fullName}</div>
                      <div className="text-xs text-gray-600">
                        {phleb.city} • {phleb.phone}
                      </div>
                      <div className="mt-1 text-[11px]">
                        Status:{' '}
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            active
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Service areas / preferences */}
                  <div className="text-[11px] space-y-1">
                    {phleb.serviceAreas && phleb.serviceAreas.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-600">Areas: </span>
                        {phleb.serviceAreas.map((area) => (
                          <span
                            key={area}
                            className="inline-flex items-center px-2 py-0.5 mr-1 mb-1 rounded-full bg-slate-50 border text-[10px] text-slate-700"
                          >
                            {area}
                          </span>
                        ))}
                      </div>
                    )}
                    {phleb.preferredLabs && phleb.preferredLabs.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-600">Prefers labs: </span>
                        {phleb.preferredLabs.map((labId) => (
                          <span
                            key={labId}
                            className="inline-flex items-center px-2 py-0.5 mr-1 mb-1 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] text-indigo-700"
                          >
                            {labId}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 text-xs">
                    <Link
                      href={`/phleb/${encodeURIComponent(phleb.id)}`}
                      className="px-2 py-1 border rounded bg-white hover:bg-gray-50"
                    >
                      Open console
                    </Link>
                    <Link
                      href={`/phleb/${encodeURIComponent(phleb.id)}/dashboard`}
                      className="px-2 py-1 border rounded bg-white hover:bg-gray-50"
                    >
                      View dashboard
                    </Link>
                  </div>
                </div>
              );
            })}

            {visiblePhlebs.length === 0 && (
              <div className="text-sm text-gray-500 border rounded bg-white p-4">
                No phlebotomists matched this filter.
              </div>
            )}
          </div>
        </main>
      </RoleGuard>
    </UserProvider>
  );
}
