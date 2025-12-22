// apps/admin-dashboard/app/labs/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type TestType = {
  id?: string;
  code: string;
  name: string;
  priceZAR: number;
  etaDays: number;
};

type Lab = {
  id: string;
  name: string;
  city: string;
  contact: string;
  logoUrl?: string | null;
  active?: boolean; // treated as true if undefined
  tests: TestType[];
};

export default function LabsOverviewPage() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch('/api/labs', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setLabs(d.labs || []);
    } catch (e: any) {
      console.error('labs overview load error', e);
      setErr(e?.message || 'Unable to load labs');
      setLabs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const totalLabs = labs.length;
  const activeLabs = labs.filter((l) => l.active !== false).length;
  const totalTests = labs.reduce(
    (sum, l) => sum + (l.tests?.length || 0),
    0,
  );

  const avgTatDays = useMemo(() => {
    const allTests = labs.flatMap((l) => l.tests || []);
    if (!allTests.length) return null;
    const totalTat = allTests.reduce((sum, t) => sum + (t.etaDays || 0), 0);
    return totalTat / allTests.length;
  }, [labs]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      {/* HEADER */}
      <header className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-semibold">Labs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Snapshot of registered partner labs, configured test menus and
            integration status across MedReach.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link
            href="/settings/labs"
            className="rounded-full border bg-white px-3 py-1.5 hover:bg-gray-50"
          >
            Configure labs
          </Link>
          <Link
            href="/analytics/labs"
            className="rounded-full border bg-white px-3 py-1.5 hover:bg-gray-50"
          >
            Lab analytics
          </Link>
          <Link
            href="/medreach"
            className="rounded-full border bg-white px-3 py-1.5 hover:bg-gray-50"
          >
            MedReach ops
          </Link>
        </div>
      </header>

      {err && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {err}
        </div>
      )}
      {loading && (
        <div className="text-xs text-gray-500">Loading labs…</div>
      )}

      {/* KPI STRIP */}
      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border bg-white px-4 py-3">
          <div className="text-xs text-gray-500">Registered labs</div>
          <div className="mt-1 text-xl font-semibold text-gray-900">
            {totalLabs}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            {activeLabs} active integrations
          </div>
        </div>
        <div className="rounded-xl border bg-white px-4 py-3">
          <div className="text-xs text-gray-500">Configured test types</div>
          <div className="mt-1 text-xl font-semibold text-gray-900">
            {totalTests}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            Across all partner labs
          </div>
        </div>
        <div className="rounded-xl border bg-white px-4 py-3">
          <div className="text-xs text-gray-500">Average lab TAT</div>
          <div className="mt-1 text-xl font-semibold text-gray-900">
            {avgTatDays != null ? `${avgTatDays.toFixed(1)} days` : '—'}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            Mean published turnaround for configured tests
          </div>
        </div>
        <div className="rounded-xl border bg-white px-4 py-3">
          <div className="text-xs text-gray-500">Network status</div>
          <div className="mt-1 text-xl font-semibold text-gray-900">
            {activeLabs === 0
              ? 'Offline'
              : activeLabs === totalLabs
              ? 'Healthy'
              : 'Partial'}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            Based on active vs. total labs
          </div>
        </div>
      </section>

      {/* LAB CARDS */}
      <section className="rounded-2xl border bg-white">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-medium text-gray-900">
            Registered labs
          </h2>
          <Link
            href="/settings/labs"
            className="text-xs text-teal-700 underline"
          >
            Manage in Settings →
          </Link>
        </div>
        {labs.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500">
            No labs registered yet. Use{' '}
            <span className="font-medium">Settings → Labs</span> to onboard
            your first partner lab.
          </div>
        ) : (
          <div className="divide-y">
            {labs.map((lab) => {
              const active = lab.active !== false;
              const tests = lab.tests || [];
              const topTests = tests.slice(0, 3);

              return (
                <article
                  key={lab.id}
                  className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-start gap-3">
                    {lab.logoUrl ? (
                      <img
                        src={lab.logoUrl}
                        alt={lab.name}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-[11px] font-medium text-gray-600">
                        {lab.name
                          .split(' ')
                          .slice(0, 2)
                          .map((p) => p[0])
                          .join('')
                          .toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-gray-900">
                          {lab.name}
                        </h3>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            active
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {active ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-gray-500">
                        {lab.city} • {lab.contact}
                      </div>
                      <div className="mt-2 text-[11px] text-gray-500">
                        {tests.length === 0 ? (
                          <span>No tests configured yet.</span>
                        ) : (
                          <>
                            <span className="font-medium text-gray-700">
                              {tests.length} tests
                            </span>
                            {topTests.length > 0 && (
                              <>
                                {' '}
                                •{' '}
                                {topTests
                                  .map((t) => t.name)
                                  .join(', ')}
                                {tests.length > topTests.length && ' + more'}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Link
                      href={`/medreach?labId=${encodeURIComponent(lab.id)}`}
                      className="rounded-full border bg-white px-3 py-1.5 hover:bg-gray-50"
                    >
                      View draws
                    </Link>
                    <Link
                      href="/settings/labs"
                      className="rounded-full border bg-white px-3 py-1.5 hover:bg-gray-50"
                    >
                      Edit settings
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
