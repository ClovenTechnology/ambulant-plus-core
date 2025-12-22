// apps/admin-dashboard/app/analytics/daily/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

/* ---------- Types (aligned conceptually with monthly API) ---------- */

type PayerMix = {
  card: number;
  medicalAid: number;
  voucher: number;
  other: number;
};

type DailyPoint = {
  date: string; // yyyy-mm-dd
  revenueZAR: number;
  consultations: number;
  deliveries: number;
  draws: number;

  // Daily eRx / journey extras (optional)
  rxPharmCount?: number;
  rxLabCount?: number;
  sickNotes?: number;
  referralsInternal?: number;
  referralsExternal?: number;
  followUps?: number;
  appointments?: number;
  closedCases?: number;

  // Payment mix (counts of consultations paid via…)
  payerMix?: PayerMix;

  // Simple daily average rating across entities
  avgRating?: number;
};

type MonthlyPayload = {
  month: string; // e.g. "2025-08"
  revenueZAR: number;
  deliveries: number;
  labTests: number;
  consultations: number;
  daily?: DailyPoint[];
};

/* ---------- Fallback (used only if API fails) ---------- */

const FALLBACK_MONTHLY_DAILY: MonthlyPayload = {
  month: '2025-08',
  revenueZAR: 512_000,
  deliveries: 842,
  labTests: 391,
  consultations: 1_260,
  daily: Array.from({ length: 30 }, (_, idx): DailyPoint => {
    const day = idx + 1;
    const factor = 0.75 + 0.4 * Math.sin((idx / 30) * Math.PI * 2);
    const revenueZAR = Math.round((512_000 / 30) * factor);
    const consultations = Math.round((1_260 / 30) * factor);
    const deliveries = Math.round((842 / 30) * factor);
    const draws = Math.round(391 / 30 * (0.6 + 0.3 * factor));

    const rxPharmCount = Math.round(consultations * 0.7);
    const rxLabCount = Math.round(consultations * 0.3);

    const payerTotal = Math.max(consultations, 1);
    const payerMix: PayerMix = {
      card: Math.round(payerTotal * 0.5),
      medicalAid: Math.round(payerTotal * 0.3),
      voucher: Math.round(payerTotal * 0.15),
      other: Math.max(
        payerTotal -
          Math.round(payerTotal * 0.5) -
          Math.round(payerTotal * 0.3) -
          Math.round(payerTotal * 0.15),
        0,
      ),
    };

    const avgRating = 4.2 + 0.3 * Math.sin((idx / 30) * Math.PI * 2);

    const date = `2025-08-${String(day).padStart(2, '0')}`;
    return {
      date,
      revenueZAR,
      consultations,
      deliveries,
      draws,
      rxPharmCount,
      rxLabCount,
      payerMix,
      avgRating,
    };
  }),
};

/* ---------- Helpers ---------- */

function currentMonthString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatMonthLabel(ym: string) {
  const MONTH_LABELS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const [yearStr, monthStr] = ym.split('-');
  const year = Number(yearStr) || new Date().getFullYear();
  const monthIndex = (Number(monthStr) || 1) - 1;
  const name = MONTH_LABELS[monthIndex] ?? ym;
  return `${name} ${year}`;
}

function safeRatio(n: number, d: number) {
  if (!n || !d) return 0;
  if (!Number.isFinite(n) || !Number.isFinite(d)) return 0;
  return n / d;
}

/* ---------- Small UI helpers ---------- */

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
      {children}
    </span>
  );
}

function DailyBarStrip({
  daily,
  selectedDate,
}: {
  daily: DailyPoint[];
  selectedDate: string | null;
}) {
  if (!daily.length) return null;
  const max = Math.max(...daily.map((d) => d.revenueZAR), 1);

  return (
    <div className="w-full">
      <div className="flex h-32 items-end gap-[2px]">
        {daily.map((d) => {
          const pct = (d.revenueZAR / max) * 100;
          const isSelected = d.date === selectedDate;
          return (
            <div
              key={d.date}
              className={`flex-1 rounded-t ${
                isSelected ? 'bg-teal-500' : 'bg-gray-200'
              }`}
              style={{ height: `${pct}%` }}
              title={`${d.date}: R ${d.revenueZAR.toLocaleString()}`}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-gray-400">
        <span>{daily[0]?.date}</span>
        <span>{daily[daily.length - 1]?.date}</span>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

export default function DailyAnalyticsPage() {
  const [monthly, setMonthly] = useState<MonthlyPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [requestedMonth, setRequestedMonth] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Fetch monthly payload and reuse its daily[] to zoom down
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const monthParam = requestedMonth ?? currentMonthString();
        const url = new URL('/api/analytics/monthly', window.location.origin);
        url.searchParams.set('month', monthParam);

        const res = await fetch(url.toString(), { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as MonthlyPayload;
        if (!mounted) return;
        setMonthly(json);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || 'Using fallback daily snapshot.');
        setMonthly(FALLBACK_MONTHLY_DAILY);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [requestedMonth]);

  const dailySorted = useMemo<DailyPoint[]>(() => {
    if (!monthly?.daily) return [];
    return [...monthly.daily].sort((a, b) => a.date.localeCompare(b.date));
  }, [monthly]);

  // Choose a default selected date once we have daily data
  useEffect(() => {
    if (!dailySorted.length) return;
    const today = todayISO();
    const hasToday = dailySorted.some((d) => d.date === today);
    const defaultDate = hasToday
      ? today
      : dailySorted[dailySorted.length - 1]?.date;
    setSelectedDate((prev) => prev || defaultDate || null);
  }, [dailySorted]);

  if (!monthly) {
    return (
      <main className="p-6 text-sm text-gray-500">
        Loading daily snapshot…
      </main>
    );
  }

  const month = monthly.month || requestedMonth || currentMonthString();
  const monthLabel = formatMonthLabel(month);

  const daily = dailySorted;
  const daysInThisMonth = dailySorted.length || 30;

  const selected =
    (selectedDate && daily.find((d) => d.date === selectedDate)) ||
    daily[daily.length - 1] ||
    null;

  const minDate = daily[0]?.date;
  const maxDate = daily[daily.length - 1]?.date;

  // Derived metrics for selected day
  const revenueRankSorted = [...daily].sort(
    (a, b) => b.revenueZAR - a.revenueZAR,
  );

  const revenueRankIndex = selected
    ? revenueRankSorted.findIndex((d) => d.date === selected.date)
    : -1;

  const shareOfRevenue = selected
    ? safeRatio(selected.revenueZAR, monthly.revenueZAR) * 100
    : 0;
  const shareOfConsults = selected
    ? safeRatio(selected.consultations, monthly.consultations) * 100
    : 0;
  const shareOfDeliveries = selected
    ? safeRatio(selected.deliveries, monthly.deliveries) * 100
    : 0;

  const revPerConsult = selected
    ? safeRatio(selected.revenueZAR, selected.consultations)
    : 0;
  const delPerConsult = selected
    ? safeRatio(selected.deliveries, selected.consultations)
    : 0;

  const revPerDayAvg = safeRatio(monthly.revenueZAR, daysInThisMonth);

  const selectedDayLabel = selected
    ? new Date(selected.date + 'T00:00:00').toLocaleDateString('en-ZA', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : '—';

  // Daily eRx and payer mix
  const rxPharmCount = selected?.rxPharmCount ?? 0;
  const rxLabCount = selected?.rxLabCount ?? 0;
  const totalErxDay = rxPharmCount + rxLabCount;
  const erxPerConsult = selected
    ? safeRatio(totalErxDay, selected.consultations)
    : 0;

  const payerMix = selected?.payerMix;
  const payerTotal =
    (payerMix?.card ?? 0) +
    (payerMix?.medicalAid ?? 0) +
    (payerMix?.voucher ?? 0) +
    (payerMix?.other ?? 0);

  const avgRating = selected?.avgRating ?? 0;

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header + nav */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Daily Snapshot</h1>
          <p className="text-sm text-gray-500 mt-1">
            Zoomed-in view for a single day in{' '}
            <span className="font-medium text-gray-700">
              {monthLabel}
            </span>
            , reusing the same monthly analytics and slicing down to
            one date.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-xs">
          {/* Global analytics nav */}
          <div className="inline-flex flex-wrap items-center gap-1 rounded-full border bg-white px-2 py-1.5">
            <Link
              href="/analytics"
              className="px-2 py-0.5 rounded-full hover:bg-gray-50"
            >
              Overview
            </Link>
            <span className="h-4 w-px bg-gray-200" />
            <Link
              href="/analytics/monthly"
              className="px-2 py-0.5 rounded-full hover:bg-gray-50"
            >
              Monthly
            </Link>
            <Link
              href="/analytics/daily"
              className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700"
            >
              Daily
            </Link>
            <span className="h-4 w-px bg-gray-200" />
            <Link
              href="/careport/analytics"
              className="px-2 py-0.5 rounded-full hover:bg-gray-50"
            >
              CarePort
            </Link>
            <Link
              href="/medreach/analytics"
              className="px-2 py-0.5 rounded-full hover:bg-gray-50"
            >
              MedReach
            </Link>
          </div>

          {/* Day selector + prev/next controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5">
              <span className="text-gray-500">Day</span>
              <input
                type="date"
                className="text-gray-900 text-xs outline-none"
                value={selected?.date || selectedDate || ''}
                min={minDate}
                max={maxDate}
                onChange={(e) =>
                  setSelectedDate(e.target.value || null)
                }
              />
            </div>
            <div className="flex gap-1">
              <button
                className="px-2 py-1 border rounded bg-white hover:bg-gray-50"
                onClick={() => {
                  if (!selected) return;
                  const idx = daily.findIndex(
                    (d) => d.date === selected.date,
                  );
                  if (idx > 0) {
                    setSelectedDate(daily[idx - 1].date);
                  }
                }}
              >
                ◀ Prev
              </button>
              <button
                className="px-2 py-1 border rounded bg-white hover:bg-gray-50"
                onClick={() => {
                  if (!selected) return;
                  const idx = daily.findIndex(
                    (d) => d.date === selected.date,
                  );
                  if (idx >= 0 && idx < daily.length - 1) {
                    setSelectedDate(daily[idx + 1].date);
                  }
                }}
              >
                Next ▶
              </button>
            </div>
          </div>

          {loading && (
            <div className="text-[11px] text-gray-400">
              Refreshing daily metrics…
            </div>
          )}
        </div>
      </header>

      {err && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
          {err}
        </div>
      )}

      {!selected ? (
        <section className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-gray-500">
            No daily data provided for this month.
          </div>
        </section>
      ) : (
        <>
          {/* KPIs for selected day */}
          <section className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="text-xs text-gray-500">
                Revenue ({selected.date})
              </div>
              <div className="text-2xl font-semibold">
                R {selected.revenueZAR.toLocaleString()}
              </div>
              <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-gray-500">
                <Badge>
                  ~R {Math.round(revPerConsult || 0).toLocaleString()} /
                  consult
                </Badge>
                <Badge>
                  {shareOfRevenue.toFixed(1)}% of month revenue
                </Badge>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="text-xs text-gray-500">
                Consultations
              </div>
              <div className="text-2xl font-semibold">
                {selected.consultations.toLocaleString()}
              </div>
              <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-gray-500">
                <Badge>
                  {shareOfConsults.toFixed(1)}% of month cons.
                </Badge>
                <Badge>
                  {delPerConsult.toFixed(2)} deliveries / consult
                </Badge>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="text-xs text-gray-500">
                Deliveries & Draws
              </div>
              <div className="text-2xl font-semibold">
                {selected.deliveries.toLocaleString()}{' '}
                <span className="text-sm text-gray-400 font-normal">
                  deliveries
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-gray-500">
                <Badge>
                  {selected.draws.toLocaleString()} lab draws
                </Badge>
                <Badge>
                  {shareOfDeliveries.toFixed(1)}% of month jobs
                </Badge>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="text-xs text-gray-500">
                Relative Performance
              </div>
              <div className="text-xl font-semibold">
                {selectedDayLabel}
              </div>
              <div className="mt-1 flex flex-col gap-1 text-[11px] text-gray-600">
                {revenueRankIndex >= 0 ? (
                  <span>
                    Revenue rank:{' '}
                    <span className="font-semibold">
                      #{revenueRankIndex + 1}
                    </span>{' '}
                    of {daily.length} days
                  </span>
                ) : (
                  <span>Revenue rank unavailable.</span>
                )}
                <span>
                  Daily average this month ~R{' '}
                  {Math.round(revPerDayAvg).toLocaleString()}
                </span>
                {avgRating ? (
                  <span>
                    Avg rating:{' '}
                    <span className="font-semibold">
                      {avgRating.toFixed(1)}★
                    </span>
                  </span>
                ) : null}
              </div>
            </div>
          </section>

          {/* Daily eRx + payer mix */}
          <section className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-2xl border bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">
                  Daily eRx & Care Journey
                </h2>
                <span className="text-[11px] text-gray-500">
                  Derived from the same counters used in the monthly
                  care journey.
                </span>
              </div>
              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                <div className="rounded-xl border bg-gray-50 p-3 space-y-1">
                  <div className="text-[11px] text-gray-500">
                    eRx volume
                  </div>
                  <div className="text-base font-semibold text-gray-900">
                    {totalErxDay.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {rxPharmCount.toLocaleString()} pharmacy •{' '}
                    {rxLabCount.toLocaleString()} lab
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {erxPerConsult
                      ? `${erxPerConsult.toFixed(2)} eRx / consult`
                      : 'No eRx recorded'}
                  </div>
                </div>
                <div className="rounded-xl border bg-gray-50 p-3 space-y-1">
                  <div className="text-[11px] text-gray-500">
                    Clinical notes
                  </div>
                  <div className="text-[11px] text-gray-500">
                    <span className="font-medium">
                      {(selected.sickNotes ?? 0).toLocaleString()}
                    </span>{' '}
                    sick notes
                  </div>
                  <div className="text-[11px] text-gray-500">
                    <span className="font-medium">
                      {(selected.referralsInternal ?? 0).toLocaleString()}
                    </span>{' '}
                    referrals (network)
                  </div>
                  <div className="text-[11px] text-gray-500">
                    <span className="font-medium">
                      {(selected.referralsExternal ?? 0).toLocaleString()}
                    </span>{' '}
                    referrals (external)
                  </div>
                </div>
                <div className="rounded-xl border bg-gray-50 p-3 space-y-1">
                  <div className="text-[11px] text-gray-500">
                    Scheduling
                  </div>
                  <div className="text-[11px] text-gray-500">
                    <span className="font-medium">
                      {(selected.followUps ?? 0).toLocaleString()}
                    </span>{' '}
                    follow-ups
                  </div>
                  <div className="text-[11px] text-gray-500">
                    <span className="font-medium">
                      {(selected.appointments ?? 0).toLocaleString()}
                    </span>{' '}
                    appointments
                  </div>
                  <div className="text-[11px] text-gray-500">
                    <span className="font-medium">
                      {(selected.closedCases ?? 0).toLocaleString()}
                    </span>{' '}
                    cases closed
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
              <h2 className="text-sm font-medium">
                Payer Mix (Consultations)
              </h2>
              {!payerMix || !payerTotal ? (
                <div className="text-xs text-gray-500">
                  No payer mix breakdown for this day.
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <PayerRow
                    label="Card"
                    value={payerMix.card}
                    total={payerTotal}
                  />
                  <PayerRow
                    label="Medical aid"
                    value={payerMix.medicalAid}
                    total={payerTotal}
                  />
                  <PayerRow
                    label="Voucher"
                    value={payerMix.voucher}
                    total={payerTotal}
                  />
                  <PayerRow
                    label="Other"
                    value={payerMix.other}
                    total={payerTotal}
                  />
                  <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
                    {payerTotal.toLocaleString()} consultations with
                    payer info recorded for this day.
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Bar strip + summary table */}
          <section className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-2xl border bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-medium">
                    Revenue by Day — {monthLabel}
                  </h2>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    The teal bar highlights the currently selected date.
                  </p>
                </div>
              </div>
              <DailyBarStrip
                daily={daily}
                selectedDate={selected.date}
              />
            </div>

            <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
              <h2 className="text-sm font-medium">
                Selected Day Details
              </h2>
              <div className="text-sm text-gray-700 space-y-1">
                <div>
                  <span className="font-medium">Date:</span>{' '}
                  {selected.date} ({selectedDayLabel})
                </div>
                <div>
                  <span className="font-medium">Revenue:</span>{' '}
                  R {selected.revenueZAR.toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">
                    Consultations:
                  </span>{' '}
                  {selected.consultations.toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">Deliveries:</span>{' '}
                  {selected.deliveries.toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">Lab draws:</span>{' '}
                  {selected.draws.toLocaleString()}
                </div>
                {totalErxDay ? (
                  <div>
                    <span className="font-medium">eRx:</span>{' '}
                    {totalErxDay.toLocaleString()} total (
                    {rxPharmCount.toLocaleString()} pharmacy /{' '}
                    {rxLabCount.toLocaleString()} lab)
                  </div>
                ) : null}
                {avgRating ? (
                  <div>
                    <span className="font-medium">Avg rating:</span>{' '}
                    {avgRating.toFixed(1)}★
                  </div>
                ) : null}
                <div className="text-[11px] text-gray-500 mt-2">
                  All metrics are derived from the same{' '}
                  <span className="font-semibold">Monthly</span>{' '}
                  payload used in the overview page, zoomed down to a
                  single day. As you wire richer per-day data from
                  APIGW, this view automatically becomes more detailed.
                </div>
              </div>
            </div>
          </section>

          {/* Full daily table */}
          <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
            <h2 className="text-sm font-medium">
              Day-by-Day Table — {monthLabel}
            </h2>
            <p className="text-[11px] text-gray-500">
              Quickly scan revenue, consultations, deliveries and draws
              across the month. The selected date row is highlighted.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">
                      Date
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      Revenue (ZAR)
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      Consultations
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      Deliveries
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      Lab draws
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {daily.map((d) => {
                    const isSelected = d.date === selected.date;
                    return (
                      <tr
                        key={d.date}
                        className={`border-t text-[11px] cursor-pointer ${
                          isSelected
                            ? 'bg-teal-50'
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => setSelectedDate(d.date)}
                      >
                        <td className="px-3 py-2 text-left">
                          {d.date}
                        </td>
                        <td className="px-3 py-2 text-right">
                          R {d.revenueZAR.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {d.consultations.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {d.deliveries.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {d.draws.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                  {!daily.length && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-3 text-center text-gray-500"
                      >
                        No daily breakdown available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

/* ---------- Small components ---------- */

function PayerRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const pct = total ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-700">{label}</span>
        <span className="text-gray-500">
          {value.toLocaleString()} ({pct.toFixed(1)}%)
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-100">
        <div
          className="h-1.5 rounded-full bg-teal-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
