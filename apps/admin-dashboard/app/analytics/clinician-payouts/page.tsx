// apps/admin-dashboard/app/analytics/clinician-payouts/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Row = {
  classId: string;
  name: string;
  consultations: number;
  revenueZAR: number;
  rxPayoutPercent: number;
  payoutZAR: number;
};

type ApiResponse = {
  period: string; // e.g. 'last_30_days'
  classes: Row[];
  totalPayoutZAR: number;
};

type SortKey =
  | 'payoutZAR'
  | 'revenueZAR'
  | 'consultations'
  | 'effectiveRate';

function safeRatio(n: number, d: number) {
  if (!n || !d || !Number.isFinite(n) || !Number.isFinite(d)) return 0;
  return n / d;
}

function formatPeriodLabel(period: string | undefined) {
  if (!period) return 'Last 30 days';
  switch (period) {
    case 'last_7_days':
    case 'last7':
      return 'Last 7 days';
    case 'last_30_days':
    case 'last30':
      return 'Last 30 days';
    case 'last_90_days':
    case 'last90':
      return 'Last 90 days';
    default:
      return period.replace(/_/g, ' ');
  }
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
      {children}
    </span>
  );
}

function SortIcon({
  active,
  dir,
}: {
  active: boolean;
  dir: 'asc' | 'desc';
}) {
  const color = active ? '#111827' : '#9ca3af';
  const d =
    dir === 'asc'
      ? 'M4 10l4-4 4 4'
      : 'M4 6l4 4 4-4';

  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3 w-3 inline-block"
      aria-hidden="true"
    >
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

export default function ClinicianPayouts() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totalPayout, setTotalPayout] = useState<number>(0);
  const [period, setPeriod] = useState<string>('last_30_days');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('payoutZAR');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch('/api/analytics/clinician-payouts', {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = (await res.json()) as ApiResponse;
        if (!mounted) return;

        setRows(json.classes || []);
        setTotalPayout(json.totalPayoutZAR || 0);
        setPeriod(json.period || 'last_30_days');
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || 'Failed to load clinician payouts.');
        setRows([]);
        setTotalPayout(0);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const {
    totalConsultations,
    totalRevenue,
    blendedPayoutRate,
    topClass,
    sortedRows,
  } = useMemo(() => {
    const totalConsultations = rows.reduce(
      (acc, r) => acc + (r.consultations || 0),
      0,
    );
    const totalRevenue = rows.reduce(
      (acc, r) => acc + (r.revenueZAR || 0),
      0,
    );
    const blendedPayoutRate = safeRatio(totalPayout, totalRevenue) * 100;

    const augmented = rows.map((r) => {
      const effectiveRate =
        safeRatio(r.payoutZAR, r.revenueZAR) * 100;
      const payoutShare = safeRatio(r.payoutZAR, totalPayout) * 100;
      return { ...r, effectiveRate, payoutShare };
    });

    const sortedRows = augmented.slice().sort((a, b) => {
      let av = 0;
      let bv = 0;
      switch (sortKey) {
        case 'revenueZAR':
          av = a.revenueZAR;
          bv = b.revenueZAR;
          break;
        case 'consultations':
          av = a.consultations;
          bv = b.consultations;
          break;
        case 'effectiveRate':
          av = a.effectiveRate;
          bv = b.effectiveRate;
          break;
        case 'payoutZAR':
        default:
          av = a.payoutZAR;
          bv = b.payoutZAR;
          break;
      }
      if (av === bv) return 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });

    const topClass =
      augmented.length > 0
        ? augmented
            .slice()
            .sort((a, b) => b.payoutZAR - a.payoutZAR)[0]
        : null;

    return {
      totalConsultations,
      totalRevenue,
      blendedPayoutRate,
      topClass,
      sortedRows,
    };
  }, [rows, totalPayout, sortKey, sortDir]);

  function toggleSort(next: SortKey) {
    if (sortKey === next) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(next);
      setSortDir('desc');
    }
  }

  const periodLabel = formatPeriodLabel(period);
  const hasData = rows.length > 0;

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            Clinician Payouts
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Payout performance by clinician class for{' '}
            <span className="font-medium text-gray-700">
              {periodLabel}
            </span>
            . Blended payout rate, revenue coverage and effective
            payout by class.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {/* Harmonised analytics nav */}
          <div className="inline-flex rounded-full border bg-white overflow-hidden text-xs">
            <Link
              href="/analytics"
              className="px-3 py-1.5 border-r hover:bg-gray-50"
            >
              Overview
            </Link>
            <Link
              href="/analytics/monthly"
              className="px-3 py-1.5 border-r hover:bg-gray-50"
            >
              Monthly
            </Link>
            <Link
              href="/analytics/daily"
              className="px-3 py-1.5 border-r hover:bg-gray-50"
            >
              Daily
            </Link>
            <Link
              href="/analytics/clinician-payouts"
              className="px-3 py-1.5 bg-gray-900 text-white"
            >
              Clinician payouts
            </Link>
          </div>

          {/* Deep links into product analytics */}
          <div className="flex flex-wrap gap-2 text-[11px]">
            <Link
              href="/orders/analytics"
              className="rounded border bg-white px-2.5 py-1 hover:bg-gray-50"
            >
              Orders analytics
            </Link>
            <Link
              href="/careport/analytics"
              className="rounded border bg-white px-2.5 py-1 hover:bg-gray-50"
            >
              CarePort analytics
            </Link>
            <Link
              href="/medreach/analytics"
              className="rounded border bg-white px-2.5 py-1 hover:bg-gray-50"
            >
              MedReach analytics
            </Link>
          </div>

          {/* Period + loading */}
          <div className="flex items-center gap-2 text-xs">
            <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5">
              <span className="text-gray-500">Period</span>
              <span className="font-medium text-gray-900">
                {periodLabel}
              </span>
            </div>
            {loading && (
              <span className="text-[11px] text-gray-400">
                Refreshing payout data…
              </span>
            )}
          </div>
        </div>
      </header>

      {err && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
          {err}
        </div>
      )}

      {/* Summary KPIs */}
      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">
            Total payout (all classes)
          </div>
          <div className="text-2xl font-semibold">
            R {totalPayout.toLocaleString()}
          </div>
          <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-gray-500">
            <Badge>
              {totalConsultations.toLocaleString()} consults
            </Badge>
            <Badge>
              {totalRevenue
                ? `R ${totalRevenue.toLocaleString()} revenue`
                : 'No revenue recorded'}
            </Badge>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">Blended payout rate</div>
          <div className="text-2xl font-semibold">
            {blendedPayoutRate.toFixed(1)}%
          </div>
          <div className="mt-1 text-[11px] text-gray-500">
            Payout ÷ total RX revenue for all clinician classes.
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">
            Avg payout per consultation
          </div>
          <div className="text-2xl font-semibold">
            R{' '}
            {Math.round(
              safeRatio(totalPayout, totalConsultations),
            ).toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-gray-500">
            Across all clinician classes for this period.
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">
            Top earning class
          </div>
          {topClass ? (
            <>
              <div className="text-sm font-semibold text-gray-900">
                {topClass.name}
              </div>
              <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-gray-500">
                <Badge>
                  R {topClass.payoutZAR.toLocaleString()} payout
                </Badge>
                <Badge>
                  {topClass.consultations.toLocaleString()} consults
                </Badge>
                <Badge>
                  Eff. rate {topClass.effectiveRate.toFixed(1)}%
                </Badge>
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-400 mt-1">
              No payout data.
            </div>
          )}
        </div>
      </section>

      {/* Actions */}
      <section className="flex items-center justify-between text-xs">
        <p className="text-gray-500">
          Breakdown of RX revenue and payouts by clinician class. Use
          this to tune class definitions, commission models and
          incentives.
        </p>
        <a
          href="/api/analytics/clinician-payouts.csv"
          className="inline-flex items-center gap-1 rounded border bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
        >
          <span>Download CSV</span>
        </a>
      </section>

      {/* Table card */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900">
              Payouts by clinician class
            </span>
            <span className="text-[11px] text-gray-500">
              Includes configured payout %, effective payout vs RX
              revenue and share of total payout.
            </span>
          </div>
          <div className="flex flex-col items-end text-[11px] text-gray-500">
            <span>
              Sorted by{' '}
              <span className="font-medium">
                {sortKey === 'payoutZAR'
                  ? 'Payout'
                  : sortKey === 'revenueZAR'
                  ? 'Revenue'
                  : sortKey === 'consultations'
                  ? 'Consultations'
                  : 'Effective payout %'}
              </span>{' '}
              ({sortDir})
            </span>
            <span>
              {rows.length
                ? `${rows.length} classes`
                : 'No classes found'}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Class</th>
                <th className="px-3 py-2 font-medium">
                  <button
                    type="button"
                    onClick={() => toggleSort('consultations')}
                    className="inline-flex items-center gap-1 hover:text-gray-900"
                  >
                    Consultations
                    <SortIcon
                      active={sortKey === 'consultations'}
                      dir={sortDir}
                    />
                  </button>
                </th>
                <th className="px-3 py-2 font-medium">
                  <button
                    type="button"
                    onClick={() => toggleSort('revenueZAR')}
                    className="inline-flex items-center gap-1 hover:text-gray-900"
                  >
                    Revenue (ZAR)
                    <SortIcon
                      active={sortKey === 'revenueZAR'}
                      dir={sortDir}
                    />
                  </button>
                </th>
                <th className="px-3 py-2 font-medium">
                  Configured Rx payout %
                </th>
                <th className="px-3 py-2 font-medium">
                  <button
                    type="button"
                    onClick={() => toggleSort('effectiveRate')}
                    className="inline-flex items-center gap-1 hover:text-gray-900"
                  >
                    Effective payout %
                    <SortIcon
                      active={sortKey === 'effectiveRate'}
                      dir={sortDir}
                    />
                  </button>
                </th>
                <th className="px-3 py-2 font-medium text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('payoutZAR')}
                    className="inline-flex items-center gap-1 hover:text-gray-900"
                  >
                    Payout (ZAR)
                    <SortIcon
                      active={sortKey === 'payoutZAR'}
                      dir={sortDir}
                    />
                  </button>
                </th>
                <th className="px-3 py-2 font-medium text-right">
                  Share of total
                </th>
              </tr>
            </thead>
            <tbody>
              {hasData ? (
                sortedRows.map((r) => (
                  <tr
                    key={r.classId}
                    className="border-t last:border-b-0"
                  >
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900">
                          {r.name}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {r.classId}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top tabular-nums text-gray-800">
                      {r.consultations.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 align-top tabular-nums text-gray-800">
                      R {r.revenueZAR.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 align-top tabular-nums text-gray-700">
                      {r.rxPayoutPercent.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 align-top tabular-nums text-gray-800">
                      {r.effectiveRate.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 align-top tabular-nums text-right text-gray-900">
                      R {r.payoutZAR.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      <div className="flex flex-col items-end gap-1">
                        <div className="h-1.5 w-24 rounded-full bg-gray-100">
                          <div
                            className="h-1.5 rounded-full bg-gray-900"
                            style={{
                              width: `${Math.max(
                                4,
                                Math.min(r.payoutShare, 100),
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="text-[11px] tabular-nums text-gray-700">
                          {r.payoutShare.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-4 text-center text-xs text-gray-500"
                  >
                    No payout data for this period.
                  </td>
                </tr>
              )}
            </tbody>
            {hasData && (
              <tfoot className="bg-gray-50 border-t text-xs">
                <tr>
                  <td className="px-3 py-2 font-semibold">Total</td>
                  <td className="px-3 py-2 tabular-nums font-semibold text-gray-800">
                    {totalConsultations.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 tabular-nums font-semibold text-gray-800">
                    R {totalRevenue.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-gray-400">—</td>
                  <td className="px-3 py-2 tabular-nums font-semibold text-gray-800">
                    {blendedPayoutRate.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 tabular-nums font-semibold text-right text-gray-900">
                    R {totalPayout.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-800 font-semibold">
                    100%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* Narrative summary */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium mb-2">
          Operator Summary
        </h2>
        {hasData ? (
          <>
            <p className="text-sm text-gray-700">
              Across{' '}
              <span className="font-semibold">
                {rows.length}
              </span>{' '}
              clinician classes in {periodLabel}, the platform paid
              out{' '}
              <span className="font-semibold">
                R {totalPayout.toLocaleString()}
              </span>{' '}
              on{' '}
              <span className="font-semibold">
                R {totalRevenue.toLocaleString()}
              </span>{' '}
              of RX revenue. This translates into a blended payout
              rate of{' '}
              <span className="font-semibold">
                {blendedPayoutRate.toFixed(1)}%
              </span>{' '}
              and an average payout of{' '}
              <span className="font-semibold">
                R{' '}
                {Math.round(
                  safeRatio(totalPayout, totalConsultations),
                ).toLocaleString()}
              </span>{' '}
              per consultation.
            </p>
            {topClass && (
              <p className="text-sm text-gray-700 mt-2">
                <span className="font-semibold">
                  {topClass.name}
                </span>{' '}
                is the top earning class with{' '}
                <span className="font-semibold">
                  R {topClass.payoutZAR.toLocaleString()}
                </span>{' '}
                in payouts, covering{' '}
                <span className="font-semibold">
                  {topClass.payoutShare.toFixed(1)}%
                </span>{' '}
                of total payouts at an effective payout rate of{' '}
                <span className="font-semibold">
                  {topClass.effectiveRate.toFixed(1)}%
                </span>
                . Use this view to stress-test your payout rules,
                spot classes that are under- or over-incentivised,
                and align with your target margin profile.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-500">
            No clinician payout records were returned for this period.
            Once payouts are generated, this view will summarise
            total payouts, blended rates and class-level performance.
          </p>
        )}
      </section>
    </main>
  );
}
