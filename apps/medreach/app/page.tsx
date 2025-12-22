// apps/medreach/app/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRightIcon,
  BeakerIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

import ChartSample from '@/components/ChartSample';
import { UserProvider } from '@/context/UserContext';
import RoleGuard from '@/components/RoleGuard';
import FiltersBar, { DashboardFilters } from '@/components/FiltersBar';

type Metrics = {
  scope: 'admin';
  surface: 'medreach';
  jobsToday: number;
  pendingCollections: number;
  completedLabs: number;
  chart?: {
    labels: string[];
    values: number[];
  };
};

export default function MedReachHome() {
  const [filters, setFilters] = useState<DashboardFilters>({ range: '7d' });
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          scope: 'admin',
          surface: 'medreach',
          range: filters.range,
        });
        const res = await fetch(`/api/metrics?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Metrics;
        if (!cancelled) {
          setMetrics(json);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setMetrics(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const labels = metrics?.chart?.labels ?? [];
  const values = metrics?.chart?.values ?? [];

  return (
    <UserProvider>
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Welcome Message */}
        <section className="bg-white border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Welcome to MedReach</h2>
          <p className="text-sm text-gray-600 mt-2">
            Lab marketplace &amp; phlebotomy dispatch. This surface is for{' '}
            <strong>lab partners and field teams</strong> (phlebs), not patients.
          </p>
        </section>

        {/* Filters + Overview (admin only, but can be relaxed) */}
        <RoleGuard allowed={['admin']}>
          <FiltersBar value={filters} onChange={setFilters} />
        </RoleGuard>

        {/* Functional Console Links */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/phleb"
            className="group bg-white border rounded-xl p-6 hover:shadow-md transition transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Open phlebotomist console"
          >
            <div className="flex items-start gap-4">
              <UserGroupIcon className="w-6 h-6 text-indigo-600 group-hover:text-indigo-700" />
              <div>
                <h3 className="text-md font-semibold text-gray-900">
                  Phlebotomist Console
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  View your assigned jobs, update statuses, and sync with patient tracking in
                  real time.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-indigo-600 group-hover:text-indigo-700">
              Open phleb jobs <ArrowRightIcon className="w-4 h-4 ml-1" />
            </div>
          </Link>

          <Link
            href="/lab/demo-lab-1"
            className="group bg-white border rounded-xl p-6 hover:shadow-md transition transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-teal-500"
            aria-label="Open lab workspace"
          >
            <div className="flex items-start gap-4">
              <BeakerIcon className="w-6 h-6 text-teal-600 group-hover:text-teal-700" />
              <div>
                <h3 className="text-md font-semibold text-gray-900">Lab Workspace</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Review incoming lab orders, monitor collections, and track result statuses.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-teal-600 group-hover:text-teal-700">
              Open demo lab <ArrowRightIcon className="w-4 h-4 ml-1" />
            </div>
          </Link>
        </section>

        {/* Demo Deep Links (admin only) */}
        <RoleGuard allowed={['admin']}>
          <section className="space-y-2">
            <h4 className="text-sm text-gray-600">Demo Links</h4>
            <Link
              href="/lab/lancet-cresta/dashboard"
              className="text-indigo-600 underline text-sm"
            >
              Lancet Cresta Dashboard
            </Link>
            <br />
            <Link
              href="/phleb/thabo-m/dashboard"
              className="text-teal-600 underline text-sm"
            >
              Thabo M. Dashboard
            </Link>
          </section>
        </RoleGuard>

        {/* Dashboard Metrics (from API) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-xl bg-white border p-6 shadow-sm">
            <h4 className="text-sm font-medium text-gray-500">Jobs Today</h4>
            <p className="text-3xl font-bold text-indigo-600 mt-2">
              {loading ? '…' : metrics?.jobsToday ?? '–'}
            </p>
          </div>
          <div className="rounded-xl bg-white border p-6 shadow-sm">
            <h4 className="text-sm font-medium text-gray-500">Pending Collections</h4>
            <p className="text-3xl font-bold text-orange-500 mt-2">
              {loading ? '…' : metrics?.pendingCollections ?? '–'}
            </p>
          </div>
          <div className="rounded-xl bg-white border p-6 shadow-sm">
            <h4 className="text-sm font-medium text-gray-500">Completed Labs</h4>
            <p className="text-3xl font-bold text-emerald-600 mt-2">
              {loading ? '…' : metrics?.completedLabs ?? '–'}
            </p>
          </div>
        </section>

        {/* Orders Chart (from API) */}
        <section>
          <ChartSample
            labels={labels}
            values={values}
            title={
              filters.range === 'today'
                ? 'Orders Today'
                : filters.range === '7d'
                ? 'Orders (Last 7 Days)'
                : 'Orders (Last 30 Days)'
            }
          />
        </section>
      </main>
    </UserProvider>
  );
}
