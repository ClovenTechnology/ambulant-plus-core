// apps/admin-dashboard/app/careport/analytics/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/* ---------- Types ---------- */

type BarItem = { label: string; value: number };

type TrendPoint = { label: string; value: number };

type TripLogRow = {
  tripId: string;
  prescriptionId: string;
  rider: string;
  pharmacy: string;
  deliveryFeeZAR: number;
  status: string;
  payoutZAR: number;
};

type CarePortAnalyticsPayload = {
  timeRangeLabel: string; // e.g. "Last 30 days"
  totalPrescriptions: number;
  fulfillmentRatePct: number;
  reprintRatePct: number;
  avgDeliveryMinutes: number;

  breakdown: {
    fulfilled: number;
    reprint: number;
    abandoned: number;
  };

  topPharmacies: BarItem[];
  avgDeliveryTrend: TrendPoint[];
  riderEarningsByRegion: BarItem[];
  tripLogs: TripLogRow[];
};

/* ---------- Tiny chart primitives (no deps) ---------- */

function MetricCard(props: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border bg-white px-4 py-3">
      <div className="text-xs font-medium text-gray-500">
        {props.label}
      </div>
      <div className="mt-1 text-xl font-semibold text-gray-900">
        {props.value}
      </div>
      {props.sub ? (
        <div className="mt-1 text-[11px] text-gray-400">
          {props.sub}
        </div>
      ) : null}
    </div>
  );
}

// multi-segment donut for Fulfilled vs Reprint vs Abandoned
function MultiDonut({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const size = 180;
  const stroke = 26;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const total = Math.max(
    segments.reduce((s, seg) => s + seg.value, 0),
    1,
  );

  let acc = 0;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="h-[190px] w-[190px]"
    >
      {/* background ring */}
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={stroke}
      />
      {segments.map((seg) => {
        const segLen = (seg.value / total) * circ;
        const offset = circ - acc - segLen;
        acc += segLen;
        return (
          <circle
            key={seg.label}
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={stroke}
            strokeDasharray={`${segLen} ${circ - segLen}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${c} ${c})`}
          >
            <title>
              {seg.label}: {seg.value}
            </title>
          </circle>
        );
      })}
      <text
        x="50%"
        y="48%"
        textAnchor="middle"
        className="fill-gray-900 text-[20px] font-semibold"
      >
        {Math.round(
          ((segments[0]?.value ?? 0) / total) * 100,
        )}
        %
      </text>
      <text
        x="50%"
        y="62%"
        textAnchor="middle"
        className="fill-gray-500 text-[11px]"
      >
        Fulfilled
      </text>
    </svg>
  );
}

// simple line for average delivery time trend
function LineChart({ points }: { points: TrendPoint[] }) {
  if (!points.length) return null;
  const w = 320;
  const h = 140;
  const pad = 20;
  const max = Math.max(...points.map((p) => p.value), 1);
  const stepX =
    points.length === 1
      ? 0
      : (w - pad * 2) / (points.length - 1);
  const path = points
    .map((p, i) => {
      const x = pad + i * stepX;
      const y =
        h - pad - (p.value / max) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-[160px] w-full"
    >
      <polyline
        points={`${pad},${h - pad} ${w - pad},${h - pad}`}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={1}
      />
      <polyline
        points={path}
        fill="none"
        stroke="#4f46e5"
        strokeWidth={2}
      />
      <title>
        {points
          .map((p) => `${p.label}: ${p.value}m`)
          .join(' • ')}
      </title>
    </svg>
  );
}

// horizontal bar for Top Pharmacies
function HBar({
  item,
  max,
}: {
  item: BarItem;
  max: number;
}) {
  const pct = max ? (item.value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-gray-800">
        <span className="truncate">{item.label}</span>
        <span className="text-gray-500">{item.value}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100">
        <div
          className="h-2 rounded-full bg-indigo-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// vertical bar for Rider earnings by region
function VBarChart({ items }: { items: BarItem[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="flex h-[180px] items-end gap-4">
      {items.map((i) => {
        const pct = (i.value / max) * 100;
        return (
          <div
            key={i.label}
            className="flex flex-1 flex-col items-center justify-end gap-2"
          >
            <div
              className="w-8 rounded-md bg-indigo-500"
              style={{ height: `${pct}%` }}
              title={`${i.label}: R${i.value.toFixed(0)}`}
            />
            <div className="w-12 text-center text-[11px] text-gray-500">
              {i.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Demo fallback ---------- */

const DEMO_DATA: CarePortAnalyticsPayload = {
  timeRangeLabel: 'Last 30 days',
  totalPrescriptions: 1524,
  fulfillmentRatePct: 78,
  reprintRatePct: 15,
  avgDeliveryMinutes: 42,
  breakdown: {
    fulfilled: 780,
    reprint: 150,
    abandoned: 70,
  },
  topPharmacies: [
    { label: 'MedExpress', value: 210 },
    { label: 'HealRx', value: 180 },
    { label: 'PharmaPlus', value: 150 },
    { label: 'CityMeds', value: 130 },
    { label: 'QuickMeds', value: 110 },
    { label: 'SateMeds', value: 90 },
    { label: 'CarePharmacy', value: 80 },
    { label: 'UnitedMeds', value: 70 },
    { label: 'WellCare', value: 60 },
  ],
  avgDeliveryTrend: [
    { label: 'Mar', value: 44 },
    { label: 'Apr', value: 40 },
    { label: 'May', value: 39 },
    { label: 'Jun', value: 42 },
  ],
  riderEarningsByRegion: [
    { label: 'Gauteng', value: 3220 },
    { label: 'Western Cape', value: 2100 },
    { label: 'Eastern Cape', value: 1650 },
    { label: 'KZN', value: 1300 },
  ],
  tripLogs: [
    {
      tripId: 'TR-00432',
      prescriptionId: 'RX-00137',
      rider: 'Isaac N.',
      pharmacy: 'MedExpress',
      deliveryFeeZAR: 55,
      status: 'Delivered',
      payoutZAR: 52,
    },
    {
      tripId: 'TR-00431',
      prescriptionId: 'RX-00187',
      rider: 'Thandi S.',
      pharmacy: 'HealRx',
      deliveryFeeZAR: 55,
      status: 'Delivered',
      payoutZAR: 52,
    },
    {
      tripId: 'TR-00429',
      prescriptionId: 'RX-00209',
      rider: 'Jacob M.',
      pharmacy: 'PharmaPlus',
      deliveryFeeZAR: 55,
      status: 'Delivered',
      payoutZAR: 52,
    },
    {
      tripId: 'TR-00418',
      prescriptionId: 'RX-00418',
      rider: 'Jacob M.',
      pharmacy: 'HealRx',
      deliveryFeeZAR: 55,
      status: 'Delivered',
      payoutZAR: 52,
    },
    {
      tripId: 'TR-00417',
      prescriptionId: 'RX-00417',
      rider: 'Ethan K.',
      pharmacy: 'PharmaPlus',
      deliveryFeeZAR: 55,
      status: 'Delivered',
      payoutZAR: 52,
    },
  ],
};

/* ---------- Page ---------- */

type RangeKey = '7d' | '30d' | '90d';

export default function CarePortAnalyticsPage() {
  const [data, setData] =
    useState<CarePortAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>('30d');

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const url = new URL(
          '/api/careport/analytics',
          window.location.origin,
        );
        url.searchParams.set('range', range);

        const r = await fetch(url.toString(), {
          cache: 'no-store',
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as CarePortAnalyticsPayload;
        if (!mounted) return;
        setData(j);
      } catch (e: any) {
        // graceful fallback to demo snapshot
        if (!mounted) return;
        setErr(
          e?.message ||
            'Using demo CarePort analytics snapshot.',
        );
        setData(DEMO_DATA);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [range]);

  const d = data ?? DEMO_DATA;
  const totalBreakdown =
    d.breakdown.fulfilled +
      d.breakdown.reprint +
      d.breakdown.abandoned || 1;

  const fulfillmentPct = Math.round(
    (d.breakdown.fulfilled / totalBreakdown) * 100,
  );
  const reprintPct = Math.round(
    (d.breakdown.reprint / totalBreakdown) * 100,
  );

  const maxTopPharm = Math.max(
    ...d.topPharmacies.map((p) => p.value),
    1,
  );

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            CarePort Analytics
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Performance of prescriptions, riders, and partner
            pharmacies across CarePort.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="inline-flex items-center gap-1 rounded-lg border bg-white px-2 py-1">
            <span className="text-gray-500">Range</span>
            <select
              className="bg-transparent text-gray-900 outline-none"
              value={range}
              onChange={(e) =>
                setRange(e.target.value as RangeKey)
              }
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>
          <Link
            href="/careport"
            className="rounded-lg border bg-white px-3 py-1.5 text-xs hover:bg-gray-50"
          >
            CarePort dashboard
          </Link>
          <Link
            href="/careport/orders"
            className="rounded-lg border bg-white px-3 py-1.5 text-xs hover:bg-gray-50"
          >
            Rider timelines
          </Link>
        </div>
      </header>

      {err && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {err}
        </div>
      )}
      {loading && (
        <div className="text-xs text-gray-500">
          Loading analytics…
        </div>
      )}

      {/* KPI strip */}
      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard
          label="Total Prescriptions"
          value={d.totalPrescriptions.toLocaleString()}
        />
        <MetricCard
          label="Fulfilment Rate"
          value={`${d.fulfillmentRatePct}%`}
        />
        <MetricCard
          label="Reprint Rate"
          value={`${d.reprintRatePct}%`}
        />
        <MetricCard
          label="Avg Delivery Time"
          value={`${d.avgDeliveryMinutes}m`}
        />
      </section>

      {/* Fulfilment vs Reprint vs Abandoned + Top Pharmacies */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="text-sm font-medium">
            Fulfilment vs Reprint vs Abandoned
          </h2>
          <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-center">
            <MultiDonut
              segments={[
                {
                  label: 'Fulfilled',
                  value: d.breakdown.fulfilled,
                  color: '#4f46e5',
                },
                {
                  label: 'Reprint',
                  value: d.breakdown.reprint,
                  color: '#f97316',
                },
                {
                  label: 'Abandoned',
                  value: d.breakdown.abandoned,
                  color: '#e11d48',
                },
              ]}
            />
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-indigo-500" />
                  <span>Fulfilled</span>
                </div>
                <span className="text-gray-700">
                  {fulfillmentPct}% (
                  {d.breakdown.fulfilled.toLocaleString()}
                  )
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-orange-400" />
                  <span>Reprint</span>
                </div>
                <span className="text-gray-700">
                  {reprintPct}% (
                  {d.breakdown.reprint.toLocaleString()})
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  <span>Abandoned</span>
                </div>
                <span className="text-gray-700">
                  {d.breakdown.abandoned.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <h2 className="text-sm font-medium">
            Top Performing Pharmacies
          </h2>
          <div className="mt-4 space-y-3">
            {d.topPharmacies.length ? (
              d.topPharmacies.map((p) => (
                <HBar
                  key={p.label}
                  item={p}
                  max={maxTopPharm}
                />
              ))
            ) : (
              <div className="text-sm text-gray-500">
                No pharmacy data.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Average Delivery Time + Rider Earnings by Region */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="text-sm font-medium">
            Average Delivery Time
          </h2>
          <p className="mt-1 text-[11px] text-gray-500">
            Average door-to-door time across the selected
            range.
          </p>
          <div className="mt-3">
            <LineChart points={d.avgDeliveryTrend} />
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <h2 className="text-sm font-medium">
            Rider Earnings by Region
          </h2>
          <p className="mt-1 text-[11px] text-gray-500">
            Total payouts to riders grouped by service region.
          </p>
          <div className="mt-4">
            <VBarChart items={d.riderEarningsByRegion} />
          </div>
        </div>
      </section>

      {/* Trip logs table */}
      <section className="rounded-2xl border bg-white">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-medium">Trip Logs</h2>
          <button className="rounded-md border bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
            Export
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Trip ID</th>
                <th className="px-4 py-2 font-medium">
                  Prescription ID
                </th>
                <th className="px-4 py-2 font-medium">Rider</th>
                <th className="px-4 py-2 font-medium">Pharmacy</th>
                <th className="px-4 py-2 font-medium">
                  Delivery Fee
                </th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Payout</th>
              </tr>
            </thead>
            <tbody>
              {d.tripLogs.length ? (
                d.tripLogs.map((row) => (
                  <tr
                    key={row.tripId}
                    className="border-t text-[11px]"
                  >
                    <td className="px-4 py-2 font-mono text-gray-900">
                      {row.tripId}
                    </td>
                    <td className="px-4 py-2 font-mono text-gray-900">
                      {row.prescriptionId}
                    </td>
                    <td className="px-4 py-2 text-gray-900">
                      {row.rider}
                    </td>
                    <td className="px-4 py-2 text-gray-900">
                      {row.pharmacy}
                    </td>
                    <td className="px-4 py-2 text-gray-900">
                      R {row.deliveryFeeZAR.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-gray-900">
                      {row.status}
                    </td>
                    <td className="px-4 py-2 text-gray-900">
                      R {row.payoutZAR.toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-4 text-center text-gray-500"
                  >
                    No trip logs in this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
