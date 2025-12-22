// apps/admin-dashboard/app/orders/analytics/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Tooltip from '@/components/Tooltip';

/** ---------- Types (from the API route) ---------- */
type TopItem = { label: string; value: number };
type AnalyticsPayload = {
  total: number;
  revenueZAR: number;
  completionPct: number;
  counts: { pharm: number; labs: number };
  statusCounts: {
    s: 'pending' | 'in-progress' | 'done' | 'failed';
    n: number;
  }[];
  trend: number[]; // last N days
  trendLabels: string[]; // yyyy-mm-dd
  topPharmacies: TopItem[];
  topLabs: TopItem[];
  heat: number[][]; // 7 x 24 (Sun..Sat x 0..23)
  tat: {
    pharmacyHours: { p50: number; p90: number; p95: number; n: number };
    labHours: { p50: number; p90: number; p95: number; n: number };
    sla: {
      pharmBreaches: number;
      labBreaches: number;
      pharmSlaH: number;
      labSlaH: number;
    };
  };
};

/** ---------- Tiny SVG chart primitives (no deps) ---------- */
function Donut({
  pct,
  size = 72,
  stroke = 10,
  label,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = size / 2;
  const len = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  const off = len * (1 - p / 100);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-[72px] h-[72px]">
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeWidth={stroke}
      />
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeDasharray={len}
        strokeDashoffset={off}
        transform={`rotate(-90 ${c} ${c})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize="14"
      >
        {Math.round(p)}%
      </text>
      {label && <title>{label}</title>}
    </svg>
  );
}

function Line({
  values,
  labels,
  w = 360,
  h = 120,
  pad = 16,
}: {
  values: number[];
  labels?: string[];
  w?: number;
  h?: number;
  pad?: number;
}) {
  const max = Math.max(...values, 1);
  const stepX = (w - pad * 2) / Math.max(1, values.length - 1);
  const pts = values
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = h - pad - (v / max) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[120px]">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeWidth="1"
        points={`${pad},${h - pad} ${w - pad},${h - pad}`}
      />
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        points={pts}
      />
      {labels?.length ? (
        <title>
          {labels.map((d, i) => `${d}: ${values[i] ?? 0}`).join(' • ')}
        </title>
      ) : null}
    </svg>
  );
}

function HBar({ label, v, vmax }: { label: string; v: number; vmax: number }) {
  const pct = vmax ? Math.round((v / vmax) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="truncate" title={label}>
          {label}
        </span>
        <span className="text-gray-600">{v}</span>
      </div>
      <div className="h-2 w-full bg-gray-100 rounded">
        <div
          className="h-2 rounded bg-black"
          style={{ width: `${pct}%` }}
        ></div>
      </div>
    </div>
  );
}

function Heatmap({ grid }: { grid: number[][] }) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const max = Math.max(...grid.flat(), 1);
  const labelsRow = [
    '0h',
    '',
    '',
    '',
    '4h',
    '',
    '',
    '',
    '8h',
    '',
    '',
    '',
    '12h',
    '',
    '',
    '',
    '16h',
    '',
    '',
    '',
    '20h',
    '',
    '',
    '',
    '23h',
  ];
  return (
    <div className="space-y-2">
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {grid.flatMap((_, i) => {
          const r = Math.floor(i / cols);
          const c = i % cols;
          const v = grid[r][c];
          const opacity = v ? 0.18 + 0.82 * (v / max) : 0.08;
          return (
            <div
              key={i}
              className="aspect-square rounded"
              style={{ backgroundColor: `rgba(0,0,0,${opacity})` }}
              title={`Day ${r} • ${c}:00 — ${v} orders`}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-24 text-[10px] text-gray-500">
        {labelsRow.map((t, i) => (
          <div key={i} className="text-center">
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

/** ---------- URL <-> state helpers ---------- */
function readParam(sp: URLSearchParams, key: string, def = '') {
  return sp.get(key) ?? def;
}
function writeParams(url: URL, obj: Record<string, string>) {
  Object.entries(obj).forEach(([k, v]) => {
    if (!v) url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  });
  return url;
}

/** ---------- Page ---------- */
type StatusFilter = 'all' | 'pending' | 'in-progress' | 'done' | 'failed';
type KindFilter = 'all' | 'pharmacy' | 'lab';

export default function OrdersAnalytics() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  // for cross-linking back to /orders with the same filters
  const qs = search.toString();
  const ordersHref = qs ? `/orders?${qs}` : '/orders';

  // Filters synced with query params
  const [q, setQ] = useState(readParam(search, 'q'));
  const [status, setStatus] = useState<StatusFilter>(
    (readParam(search, 'status', 'all') as StatusFilter) || 'all',
  );
  const [kind, setKind] = useState<KindFilter>(
    (readParam(search, 'kind', 'all') as KindFilter) || 'all',
  );
  const [from, setFrom] = useState(readParam(search, 'from'));
  const [to, setTo] = useState(readParam(search, 'to'));

  // SLA thresholds (hours) are tweakable via query too
  const [pharmSlaH, setPharmSlaH] = useState(
    Number(readParam(search, 'phSLA', '4')) || 4,
  );
  const [labSlaH, setLabSlaH] = useState(
    Number(readParam(search, 'lbSLA', '48')) || 48,
  );

  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Keep URL in sync whenever filters change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = writeParams(new URL(window.location.href), {
      q,
      status,
      kind,
      from,
      to,
      phSLA: String(pharmSlaH),
      lbSLA: String(labSlaH),
    });
    router.replace(url.pathname + url.search, { scroll: false });
  }, [q, status, kind, from, to, pharmSlaH, labSlaH, router]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const u = writeParams(
        new URL('/api/orders/analytics', window.location.origin),
        {
          q,
          status,
          kind,
          from,
          to,
          phSLA: String(pharmSlaH),
          lbSLA: String(labSlaH),
        },
      );
      const r = await fetch(u.toString(), { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j: AnalyticsPayload = await r.json();
      setData(j);
    } catch (e: any) {
      setErr(e?.message || 'Unable to load analytics.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  // initial + whenever page is (re)mounted via navigation
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const vmaxPharm = useMemo(
    () => Math.max(...(data?.topPharmacies || []).map((d) => d.value), 1),
    [data],
  );
  const vmaxLabs = useMemo(
    () => Math.max(...(data?.topLabs || []).map((d) => d.value), 1),
    [data],
  );

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Orders — Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            Merged KPIs, trends, top entities, activity heatmap, and TAT
            percentiles across CarePort &amp; MedReach.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            href={ordersHref}
            className="inline-flex items-center rounded-lg border bg-white px-3 py-2 hover:bg-gray-50"
          >
            Orders Table
          </Link>
          <Link
            href="/careport"
            className="inline-flex items-center rounded-lg border bg-white px-3 py-2 hover:bg-gray-50"
          >
            CarePort
          </Link>
          <Link
            href="/medreach"
            className="inline-flex items-center rounded-lg border bg-white px-3 py-2 hover:bg-gray-50"
          >
            MedReach
          </Link>
          <button
            onClick={load}
            className="inline-flex items-center rounded-lg border bg-white px-3 py-2 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </header>

      {/* Filters */}
      <section className="rounded-2xl border bg-white p-4">
        <div className="grid md:grid-cols-7 gap-2">
          <input
            className="border rounded px-3 py-2 text-sm md:col-span-2"
            placeholder="Search (ID, title, site…) "
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="border rounded px-2 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            {['all', 'pending', 'in-progress', 'done', 'failed'].map((s) => (
              <option key={s} value={s}>
                {s === 'in-progress'
                  ? 'In progress'
                  : s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <select
            className="border rounded px-2 py-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as any)}
          >
            {['all', 'pharmacy', 'lab'].map((k) => (
              <option key={k} value={k}>
                {k[0].toUpperCase() + k.slice(1)}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="border rounded px-2 py-2 text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            type="date"
            className="border rounded px-2 py-2 text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <div className="flex gap-2 items-center text-[11px] text-gray-600">
            <span>SLA (h):</span>
            <input
              type="number"
              min={1}
              className="w-14 border rounded px-2 py-1"
              value={pharmSlaH}
              onChange={(e) =>
                setPharmSlaH(parseInt(e.target.value || '4', 10))
              }
              title="Pharmacy SLA hours"
            />
            <input
              type="number"
              min={1}
              className="w-14 border rounded px-2 py-1"
              value={labSlaH}
              onChange={(e) =>
                setLabSlaH(parseInt(e.target.value || '48', 10))
              }
              title="Lab SLA hours"
            />
          </div>
        </div>
      </section>

      {err && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
          {err}
        </div>
      )}
      {loading && <div className="text-sm text-gray-500">Loading…</div>}

      {/* KPI row */}
      {data && (
        <section className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="rounded-2xl border p-4 bg-white">
            <div className="text-xs text-gray-500">Total Orders</div>
            <div className="text-2xl font-semibold">{data.total}</div>
            <div className="text-[11px] text-gray-500 mt-1">
              {data.counts.pharm} pharmacy • {data.counts.labs} lab
            </div>
          </div>
          <div className="rounded-2xl border p-4 bg-white flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500">Completion</div>
              <div className="text-2xl font-semibold">
                {data.completionPct}%
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                {data.statusCounts.find((s) => s.s === 'done')?.n ?? 0} done
              </div>
            </div>
            <Tooltip label="Percentage of orders marked done after applying all filters.">
              <span>
                <Donut pct={data.completionPct} label="Completion rate" />
              </span>
            </Tooltip>
          </div>
          <div className="rounded-2xl border p-4 bg-white">
            <div className="text-xs text-gray-500">Est. Revenue</div>
            <div className="text-2xl font-semibold">
              R{' '}
              {data.revenueZAR.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              Sum of order prices
            </div>
          </div>
          <div className="rounded-2xl border p-4 bg-white">
            <div className="text-xs text-gray-500">Pharmacy TAT (h)</div>
            <div className="text-2xl font-semibold">
              {data.tat.pharmacyHours.p50}h
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              p90 {data.tat.pharmacyHours.p90} • p95{' '}
              {data.tat.pharmacyHours.p95} ({data.tat.pharmacyHours.n} jobs)
            </div>
          </div>
          <div className="rounded-2xl border p-4 bg-white">
            <div className="text-xs text-gray-500">Lab TAT (h)</div>
            <div className="text-2xl font-semibold">
              {data.tat.labHours.p50}h
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              p90 {data.tat.labHours.p90} • p95 {data.tat.labHours.p95} (
              {data.tat.labHours.n} jobs)
            </div>
          </div>
          <div className="rounded-2xl border p-4 bg-white">
            <div className="text-xs text-gray-500">SLA Breaches</div>
            <div className="text-2xl font-semibold">
              {data.tat.sla.pharmBreaches + data.tat.sla.labBreaches}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              Pharm &gt; {data.tat.sla.pharmSlaH}h: {data.tat.sla.pharmBreaches}{' '}
              • Lab &gt; {data.tat.sla.labSlaH}h: {data.tat.sla.labBreaches}
            </div>
          </div>
        </section>
      )}

      {/* Status split + trend */}
      {data && (
        <section className="grid lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border p-4 bg-white">
            <div className="font-medium mb-2">Status Distribution</div>
            <ul className="space-y-2">
              {data.statusCounts.map(({ s, n }) => (
                <li
                  key={s}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="capitalize">
                    {s.replace('in-progress', 'In progress')}
                  </span>
                  <span className="text-gray-700">{n}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2 rounded-2xl border p-4 bg-white">
            <div className="font-medium mb-2">
              Orders — Last {data.trend.length} Days
            </div>
            <Tooltip label="Orders per day over the last period, filtered by the controls above.">
              <span>
                <Line values={data.trend} labels={data.trendLabels} />
              </span>
            </Tooltip>
          </div>
        </section>
      )}

      {/* Top entities */}
      {data && (
        <section className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border p-4 bg-white">
            <div className="font-medium mb-3">Top Pharmacies by Volume</div>
            <div className="space-y-2">
              {data.topPharmacies.length ? (
                data.topPharmacies.map((d) => (
                  <HBar
                    key={d.label}
                    label={d.label}
                    v={d.value}
                    vmax={vmaxPharm}
                  />
                ))
              ) : (
                <div className="text-sm text-gray-500">No data</div>
              )}
            </div>
          </div>
          <div className="rounded-2xl border p-4 bg-white">
            <div className="font-medium mb-3">Top Labs by Volume</div>
            <div className="space-y-2">
              {data.topLabs.length ? (
                data.topLabs.map((d) => (
                  <HBar
                    key={d.label}
                    label={d.label}
                    v={d.value}
                    vmax={vmaxLabs}
                  />
                ))
              ) : (
                <div className="text-sm text-gray-500">No data</div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Activity heatmap */}
      {data && (
        <section className="rounded-2xl border p-4 bg-white">
          <div className="flex items-center justify-between">
            <div className="font-medium">
              Order Activity by Hour (Sun → Sat, 0–23h)
            </div>
            <div className="text-xs text-gray-500">{data.total} rows</div>
          </div>
          <div className="mt-3">
            <Tooltip label="Hourly order density by weekday and hour. Darker cells mean more orders.">
              <span>
                <Heatmap grid={data.heat} />
              </span>
            </Tooltip>
          </div>
        </section>
      )}
    </main>
  );
}
