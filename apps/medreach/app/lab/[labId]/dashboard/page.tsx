function humanErrorMessage(value: unknown, fallback = "Unable to complete this request. Please try again.") {
  if (typeof value === "string") {
    const text = value.trim();
    if (text && text !== "[object Object]") return text;
  }

  if (value instanceof Error) {
    const text = value.message.trim();
    if (text && text !== "[object Object]") return text;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    for (const key of ["message", "error", "detail", "reason", "statusText", "code"]) {
      const candidate = record[key];

      if (typeof candidate === "string") {
        const text = candidate.trim();
        if (text && text !== "[object Object]") return text;
      }

      if (candidate && typeof candidate === "object") {
        const nested = candidate as Record<string, unknown>;

        for (const nestedKey of ["message", "error", "detail", "reason", "statusText", "code"]) {
          const nestedCandidate = nested[nestedKey];

          if (typeof nestedCandidate === "string") {
            const text = nestedCandidate.trim();
            if (text && text !== "[object Object]") return text;
          }
        }
      }
    }
  }

  if (value != null) {
    const text = String(value).trim();
    if (text && text !== "[object Object]") return text;
  }

  return fallback;
}

// apps/medreach/app/lab/[labId]/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type MetricsResponse = {
  ok?: boolean;
  error?: string;
  summary?: Record<string, number>;
  registry?: Record<string, number>;
  marketplace?: Record<string, any>;
  specimens?: Record<string, any>;
  finance?: Record<string, number>;
  operations?: Record<string, number>;
  data?: {
    registry?: Record<string, number>;
    marketplace?: Record<string, any>;
    specimens?: Record<string, any>;
    finance?: Record<string, number>;
    operations?: Record<string, number>;
  };
};

type WindowDays = '7' | '30' | '90';

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

function payload(metrics: MetricsResponse | null) {
  return metrics?.data || metrics || {};
}

function statusRows(counts: Record<string, any> | undefined) {
  return Object.entries(counts || {}).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}

function Card({
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

export default function LabDashboardPage() {
  const params = useParams<{ labId: string }>();
  const labId = params.labId;

  const [days, setDays] = useState<WindowDays>('30');
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const niceLabName =
    labId
      .split('-')
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(
        `/api/metrics?scope=lab&id=${encodeURIComponent(labId)}&days=${days}`,
        { cache: 'no-store' },
      );

      const json = (await res.json().catch(() => null)) as MetricsResponse | null;

      if (!res.ok || json?.ok === false) {
        throw new Error(humanErrorMessage(json?.error, `HTTP ${res.status}`));
      }

      setMetrics(json);
    } catch (e: any) {
      setErr(e?.message || 'Unable to load lab metrics');
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labId, days]);

  const p = payload(metrics);
  const registry = p.registry || {};
  const marketplace = p.marketplace || {};
  const specimens = p.specimens || {};
  const finance = p.finance || {};
  const operations = p.operations || {};
  const drawStatusCounts = marketplace.drawStatusCounts || {};
  const bundleStatusCounts = specimens.bundleStatusCounts || {};

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-950">
            {niceLabName} — Lab Command Dashboard
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Operational, specimen, result and financial visibility for this lab. This is
            backed by the MedReach gateway metrics route without local fallback data.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            href={`/lab/${encodeURIComponent(labId)}`}
            className="rounded-full border bg-white px-3 py-1 hover:bg-gray-50"
          >
            Workspace
          </Link>
          <Link
            href={`/lab/${encodeURIComponent(labId)}/tests`}
            className="rounded-full border bg-white px-3 py-1 hover:bg-gray-50"
          >
            Tests & panels
          </Link>
          <Link
            href={`/lab/${encodeURIComponent(labId)}/settings`}
            className="rounded-full border bg-white px-3 py-1 hover:bg-gray-50"
          >
            Settings
          </Link>
        </div>
      </header>

      <section className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-gray-500">Window:</span>
        {(['7', '30', '90'] as WindowDays[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setDays(option)}
            className={`rounded-full border px-3 py-1 ${
              days === option
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Last {option} days
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

      {err ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">Unable to load live lab metrics</div>
          <div className="mt-1">{humanErrorMessage(err, "Unable to complete this request. Please try again.")}</div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card label="Draws" value={loading ? '...' : n(marketplace.draws)} />
        <Card
          label="Eligible lab rows"
          value={loading ? '...' : n(marketplace.eligibleLabRows)}
        />
        <Card label="Specimen bundles" value={loading ? '...' : n(specimens.bundles)} />
        <Card
          label="Location pings"
          value={loading ? '...' : n(operations.locationPings)}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card
          label="Published tests"
          value={loading ? '...' : n(registry.activeOfferedTests)}
        />
        <Card label="Active panels" value={loading ? '...' : n(registry.activePanels)} />
        <Card label="Lab gross" value={loading ? '...' : money(finance.labGrossCents)} />
        <Card label="Lab net" value={loading ? '...' : money(finance.labNetCents)} />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-950">Draw status distribution</h2>
          <div className="mt-4 space-y-2 text-xs">
            {statusRows(drawStatusCounts).length === 0 ? (
              <div className="text-gray-500">No draw statuses in this window.</div>
            ) : (
              statusRows(drawStatusCounts).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between border-b pb-2">
                  <span className="font-mono text-gray-700">{status}</span>
                  <span className="font-semibold">{String(count)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-950">
            Specimen bundle distribution
          </h2>
          <div className="mt-4 space-y-2 text-xs">
            {statusRows(bundleStatusCounts).length === 0 ? (
              <div className="text-gray-500">No specimen bundle statuses in this window.</div>
            ) : (
              statusRows(bundleStatusCounts).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between border-b pb-2">
                  <span className="font-mono text-gray-700">{status}</span>
                  <span className="font-semibold">{String(count)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-950">Financial routing</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 text-xs md:grid-cols-4">
          <Card label="Subtotal" value={money(finance.subtotalCents)} />
          <Card label="Logistics fee" value={money(finance.logisticsFeeCents)} />
          <Card label="Cold-chain surcharge" value={money(finance.coldChainSurchargeCents)} />
          <Card label="Platform fee" value={money(finance.platformFeeCents)} />
        </div>
      </section>
    </main>
  );
}