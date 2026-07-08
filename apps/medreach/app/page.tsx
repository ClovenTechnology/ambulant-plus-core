// apps/medreach/app/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRightIcon,
  BeakerIcon,
  ShieldCheckIcon,
  TruckIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

import { UserProvider, useUserContext } from '@/context/UserContext';

type MetricsPayload = {
  ok?: boolean;
  data?: {
    scope?: any;
    registry?: Record<string, number>;
    marketplace?: Record<string, any>;
    specimens?: Record<string, any>;
    finance?: Record<string, number>;
    operations?: Record<string, number>;
  };
  registry?: Record<string, number>;
  marketplace?: Record<string, any>;
  specimens?: Record<string, any>;
  finance?: Record<string, number>;
  operations?: Record<string, number>;
  error?: string;
};

type Range = '7' | '30' | '90';

function n(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function money(cents: unknown) {
  return `R ${(n(cents) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dataOf(metrics: MetricsPayload | null) {
  return metrics?.data || metrics || {};
}

function readinessTone(done: boolean) {
  return done
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'border-amber-200 bg-amber-50 text-amber-800';
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-950">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-gray-500">{hint}</div> : null}
    </div>
  );
}

function MedReachHomeInner() {
  const { user, isLoading: identityLoading } = useUserContext();

  const [range, setRange] = useState<Range>('30');
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(`/api/metrics?scope=admin&days=${range}`, {
        cache: 'no-store',
      });

      const json = (await res.json().catch(() => null)) as MetricsPayload | null;

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      setMetrics(json);
    } catch (e: any) {
      setMetrics(null);
      setErr(e?.message || 'Unable to load MedReach metrics');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const payload = dataOf(metrics);
  const registry = payload.registry || {};
  const marketplace = payload.marketplace || {};
  const specimens = payload.specimens || {};
  const finance = payload.finance || {};
  const operations = payload.operations || {};

  const readiness = useMemo(() => {
    const activeLabs = n(registry.activeLabs);
    const activePhlebs = n(registry.activePhlebs);
    const offeredTests = n(registry.activeOfferedTests);
    const panels = n(registry.activePanels);

    return {
      labsReady: activeLabs > 0,
      phlebsReady: activePhlebs > 0,
      inventoryReady: offeredTests > 0,
      panelsReady: panels > 0,
    };
  }, [registry]);

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-800">
              MedReach Command Centre
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-gray-950">
              Lab marketplace and phlebotomy operations
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-600">
              Enterprise control surface for lab partners, lab staff, field phlebotomists,
              specimen custody, result readiness, operational metrics and financial routing.
            </p>
          </div>

          <div className="rounded-xl border bg-gray-50 p-3 text-xs text-gray-700">
            <div className="font-semibold text-gray-900">Runtime identity</div>
            <div className="mt-1">
              {identityLoading ? 'Loading identity...' : user.role}
              {user.labId ? ` / lab ${user.labId}` : ''}
              {user.phlebId ? ` / phleb ${user.phlebId}` : ''}
            </div>
            {!user.isAuthenticated ? (
              <div className="mt-1 text-amber-700">
                No authenticated MedReach identity detected.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard
          label="Active labs"
          value={loading ? '...' : n(registry.activeLabs)}
          hint={`${n(registry.labs)} total registered`}
        />
        <MetricCard
          label="Active phlebs"
          value={loading ? '...' : n(registry.activePhlebs)}
          hint={`${n(registry.phlebs)} total registered`}
        />
        <MetricCard
          label="Open draws"
          value={loading ? '...' : n(marketplace.draws)}
          hint={`${range} day operational window`}
        />
        <MetricCard
          label="Platform fees"
          value={loading ? '...' : money(finance.platformFeeCents)}
          hint="Gateway-derived metrics only"
        />
      </section>

      {err ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">Gateway metrics unavailable</div>
          <div className="mt-1">{err}</div>
          <div className="mt-1 text-xs">
            Local metric fallbacks are disabled. Configure the API Gateway base URL before live use.
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link
          href="/lab"
          className="group rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <BeakerIcon className="h-7 w-7 text-teal-700" />
          <h2 className="mt-3 text-sm font-semibold text-gray-950">Lab operations</h2>
          <p className="mt-1 text-sm text-gray-600">
            Registry, onboarding readiness, test inventory, panels, offers and lab workspaces.
          </p>
          <div className="mt-4 inline-flex items-center text-xs font-medium text-teal-700">
            Open lab directory <ArrowRightIcon className="ml-1 h-4 w-4" />
          </div>
        </Link>

        <Link
          href="/phleb"
          className="group rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <UserGroupIcon className="h-7 w-7 text-indigo-700" />
          <h2 className="mt-3 text-sm font-semibold text-gray-950">Phleb operations</h2>
          <p className="mt-1 text-sm text-gray-600">
            Field readiness, job assignment, phleb profile state, payout visibility and performance.
          </p>
          <div className="mt-4 inline-flex items-center text-xs font-medium text-indigo-700">
            Open phleb registry <ArrowRightIcon className="ml-1 h-4 w-4" />
          </div>
        </Link>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <ShieldCheckIcon className="h-7 w-7 text-emerald-700" />
          <h2 className="mt-3 text-sm font-semibold text-gray-950">Enterprise readiness</h2>
          <div className="mt-3 space-y-2 text-xs">
            <div className={`rounded-lg border px-3 py-2 ${readinessTone(readiness.labsReady)}`}>
              Lab partner readiness: {readiness.labsReady ? 'available' : 'not ready'}
            </div>
            <div className={`rounded-lg border px-3 py-2 ${readinessTone(readiness.phlebsReady)}`}>
              Phleb network readiness: {readiness.phlebsReady ? 'available' : 'not ready'}
            </div>
            <div className={`rounded-lg border px-3 py-2 ${readinessTone(readiness.inventoryReady)}`}>
              Test inventory: {readiness.inventoryReady ? 'published' : 'missing'}
            </div>
            <div className={`rounded-lg border px-3 py-2 ${readinessTone(readiness.panelsReady)}`}>
              Lab panels: {readiness.panelsReady ? 'configured' : 'not configured'}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-950">Marketplace</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <MetricCard label="Eligible lab rows" value={n(marketplace.eligibleLabRows)} />
            <MetricCard label="Draws" value={n(marketplace.draws)} />
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-950">Specimens</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <MetricCard label="Bundles" value={n(specimens.bundles)} />
            <MetricCard
              label="Location pings"
              value={n(operations.locationPings)}
            />
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-950">
            <TruckIcon className="h-4 w-4" />
            Finance
          </h2>
          <div className="mt-3 space-y-2 text-xs text-gray-700">
            <div className="flex justify-between">
              <span>Lab gross</span>
              <span className="font-semibold">{money(finance.labGrossCents)}</span>
            </div>
            <div className="flex justify-between">
              <span>Phleb gross</span>
              <span className="font-semibold">{money(finance.phlebGrossCents)}</span>
            </div>
            <div className="flex justify-between">
              <span>Patient co-pay</span>
              <span className="font-semibold">{money(finance.patientCopayMinor)}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-gray-500">Window:</span>
        {(['7', '30', '90'] as Range[]).map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => setRange(days)}
            className={`rounded-full border px-3 py-1 ${
              range === days
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Last {days} days
          </button>
        ))}
        <button
          type="button"
          onClick={load}
          className="rounded-full border bg-white px-3 py-1 text-gray-700 hover:bg-gray-50"
        >
          Refresh
        </button>
      </section>

      <section className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
              Network command
            </p>
            <h2 className="mt-2 text-lg font-semibold text-gray-950">
              Lab HQ, branch and franchise management
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">
              Manage multi-branch lab groups, franchise networks, HQ visibility,
              branch attachment and network-level staff governance.
            </p>
          </div>

          <a
            href="/lab-networks"
            className="inline-flex w-fit items-center justify-center rounded-xl bg-gray-950 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-black"
          >
            Open network command
          </a>
        </div>
      </section>
    </main>
  );
}

export default function MedReachHome() {
  return (
    <UserProvider>
      <MedReachHomeInner />
    </UserProvider>
  );
}