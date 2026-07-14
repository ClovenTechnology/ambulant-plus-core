'use client';

import { useEffect, useMemo, useState } from 'react';

// A5_J_F_C_CLINICIAN_CONTRACTOR_PAYOUT_SUMMARY_PAGE

type PayoutStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded' | string;

type PayoutRow = {
  id: string;
  periodStart: string | null;
  periodEnd: string | null;
  periodMonth: string | null;
  amountCents: number;
  currency: string;
  status: PayoutStatus;
  payoutRef?: string | null;
  transferStatus?: string | null;
  transferCode?: string | null;
  grossEarningsCents: number;
  refundCents: number;
  platformFeeCents: number;
  baseClinicianTakeCents: number;
  onboardingInstalmentCents: number;
  planFeeCents: number;
  customDeductionCents: number;
  taxWithholdingCents: number;
  taxEstimateCents: number;
  totalChargedDeductionsCents: number;
  netPayableCents: number;
  deductionLines?: any[];
  customDeductions?: any[];
  taxAdvisory?: any;
  contractorNotice?: string;
};

type MonthlySummary = {
  month: string;
  count: number;
  grossEarningsCents: number;
  platformFeeCents: number;
  refundCents: number;
  totalDeductionsCents: number;
  netPayableCents: number;
  paidCents: number;
  pendingCents: number;
  failedCents: number;
};

type PayoutSummary = {
  ok: boolean;
  label: string;
  currency: string;
  clinician?: {
    id?: string;
    displayName?: string | null;
    email?: string | null;
  };
  range: {
    from: string;
    to: string;
  };
  items: PayoutRow[];
  monthlySummaries: MonthlySummary[];
  totals: {
    count: number;
    grossEarningsCents: number;
    platformFeeCents: number;
    refundCents: number;
    totalDeductionsCents: number;
    netPayableCents: number;
    paidCents: number;
    pendingCents: number;
    failedCents: number;
    paidCount: number;
    pendingCount: number;
    failedCount: number;
  };
  emptyState?: {
    title?: string;
    message?: string;
  } | null;
  contractorNotice: string;
  payoutSettings?: {
    schedule?: string;
    bankLast4?: string | null;
    currentPlanId?: string;
    billingCycle?: string;
  };
  lastPayout?: {
    amountCents?: number;
    at?: string | null;
    reference?: string | null;
  };
  nextPayout?: {
    amountCents?: number;
    at?: string | null;
  };
};

function sameOrigin(path: string, params?: URLSearchParams) {
  const query = params ? params.toString() : '';
  return query ? path + '?' + query : path;
}

function money(cents: number | null | undefined, currency = 'ZAR') {
  const amount = Number.isFinite(Number(cents)) ? Number(cents) : 0;

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'ZAR',
  }).format(amount / 100);
}

function statusClass(status: string) {
  const value = String(status || '').toLowerCase();

  if (value === 'paid') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (value === 'failed' || value === 'cancelled' || value === 'refunded') {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  if (value === 'pending') return 'border-amber-200 bg-amber-50 text-amber-700';

  return 'border-gray-200 bg-gray-50 text-gray-700';
}

function shortText(value: unknown, max = 44) {
  const text = String(value || '').trim();
  if (!text) return '—';
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

function formatDate(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

export default function ClinicianPayoutPage() {
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(todayIso());

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      const res = await fetch(sameOrigin('/api/clinicians/me/payouts', params), {
        cache: 'no-store',
        headers: {
          accept: 'application/json',
        },
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'Failed to load Contractor Payout Summary.');
      }

      setSummary(json);
    } catch (e: any) {
      console.error('[clinician payout summary] load error', e);
      setSummary(null);
      setError(e?.message || 'Failed to load Contractor Payout Summary.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currency = summary?.currency || 'ZAR';
  const items = summary?.items || [];
  const monthly = summary?.monthlySummaries || [];
  const totals = summary?.totals;

  const visibleNotice = useMemo(() => {
    if (error) return error;
    if (!summary && loading) return null;
    if (!items.length) {
      return summary?.emptyState?.message || "You haven't completed any eligible jobs yet.";
    }
    return null;
  }, [error, items.length, loading, summary]);

  function downloadCsv() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    params.set('format', 'csv');

    window.location.href = sameOrigin('/api/clinicians/me/payouts', params);
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Ambulant+ finance
            </p>
            <h1 className="text-2xl font-semibold text-gray-950">
              Contractor Payout Summary
            </h1>
            <p className="max-w-3xl text-sm text-gray-600">
              Review your completed eligible clinician work, payout status,
              deduction/advisory lines and monthly contractor payout summaries.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded-xl border bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={downloadCsv}
              disabled={loading}
              className="rounded-xl bg-gray-950 px-3 py-2 text-xs font-medium text-white hover:bg-black disabled:opacity-50"
            >
              Download CSV
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-2xl border bg-gray-50 p-4">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              Net payable
            </div>
            <div className="mt-1 text-lg font-semibold text-gray-950">
              {money(totals?.netPayableCents || 0, currency)}
            </div>
            <div className="text-[11px] text-gray-500">
              {totals?.count || 0} payout row(s)
            </div>
          </div>

          <div className="rounded-2xl border bg-amber-50 p-4">
            <div className="text-[11px] uppercase tracking-wide text-amber-700">
              Pending
            </div>
            <div className="mt-1 text-lg font-semibold text-amber-950">
              {money(totals?.pendingCents || 0, currency)}
            </div>
            <div className="text-[11px] text-amber-700">
              {totals?.pendingCount || 0} row(s)
            </div>
          </div>

          <div className="rounded-2xl border bg-emerald-50 p-4">
            <div className="text-[11px] uppercase tracking-wide text-emerald-700">
              Paid
            </div>
            <div className="mt-1 text-lg font-semibold text-emerald-950">
              {money(totals?.paidCents || 0, currency)}
            </div>
            <div className="text-[11px] text-emerald-700">
              {totals?.paidCount || 0} row(s)
            </div>
          </div>

          <div className="rounded-2xl border bg-red-50 p-4">
            <div className="text-[11px] uppercase tracking-wide text-red-700">
              Failed
            </div>
            <div className="mt-1 text-lg font-semibold text-red-950">
              {money(totals?.failedCents || 0, currency)}
            </div>
            <div className="text-[11px] text-red-700">
              {totals?.failedCount || 0} row(s)
            </div>
          </div>

          <div className="rounded-2xl border bg-gray-50 p-4">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              Deductions
            </div>
            <div className="mt-1 text-lg font-semibold text-gray-950">
              {money(totals?.totalDeductionsCents || 0, currency)}
            </div>
            <div className="text-[11px] text-gray-500">
              Charged deduction lines only
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-2xl border bg-gray-50 p-4 md:flex-row md:items-end md:justify-between">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-gray-700">
              From
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 block rounded-xl border bg-white px-3 py-2 text-sm text-gray-900"
              />
            </label>
            <label className="text-xs font-medium text-gray-700">
              To
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 block rounded-xl border bg-white px-3 py-2 text-sm text-gray-900"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-xl border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Apply date range
          </button>
        </div>
      </section>

      {visibleNotice && (
        <section className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-medium">
            {error ? 'Unable to load payout summary' : 'No payout summary yet.'}
          </div>
          <div className="mt-1">
            {visibleNotice}
          </div>
        </section>
      )}

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-1">
          <h2 className="text-base font-semibold text-gray-950">
            Monthly summary
          </h2>
          <p className="text-xs text-gray-500">
            Monthly totals are grouped from generated payout records.
          </p>
        </div>

        {monthly.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {monthly.map((month) => (
              <div key={month.month} className="rounded-2xl border bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-gray-950">{month.month}</div>
                  <span className="rounded-full border bg-white px-2 py-0.5 text-[11px] text-gray-600">
                    {month.count} row(s)
                  </span>
                </div>
                <dl className="mt-3 space-y-1 text-xs text-gray-600">
                  <div className="flex justify-between gap-3">
                    <dt>Gross earnings</dt>
                    <dd>{money(month.grossEarningsCents, currency)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Platform fee</dt>
                    <dd>{money(month.platformFeeCents, currency)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Deductions</dt>
                    <dd>{money(month.totalDeductionsCents, currency)}</dd>
                  </div>
                  <div className="flex justify-between gap-3 font-semibold text-gray-950">
                    <dt>Net payable</dt>
                    <dd>{money(month.netPayableCents, currency)}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed bg-gray-50 p-6 text-center text-sm text-gray-500">
            No payout summary yet. You haven’t completed any eligible jobs yet.
          </div>
        )}
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-1">
          <h2 className="text-base font-semibold text-gray-950">
            Payout records
          </h2>
          <p className="text-xs text-gray-500">
            These rows are generated from completed eligible consultations and
            reconciled by Ambulant+ finance.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">Period</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">Gross</th>
                <th className="px-3 py-2 font-medium text-right">Platform fee</th>
                <th className="px-3 py-2 font-medium text-right">Deductions</th>
                <th className="px-3 py-2 font-medium text-right">Net payable</th>
                <th className="px-3 py-2 font-medium">Reference</th>
              </tr>
            </thead>
            <tbody>
              {items.length ? (
                items.map((row) => (
                  <tr key={row.id} className="border-t align-top">
                    <td className="px-3 py-2 text-gray-700">
                      <div>{row.periodMonth || '—'}</div>
                      <div className="text-[11px] text-gray-400">
                        {formatDate(row.periodStart)} → {formatDate(row.periodEnd)}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={'rounded-full border px-2 py-0.5 text-[11px] font-medium ' + statusClass(row.status)}>
                        {row.status || 'pending'}
                      </span>
                      {row.transferStatus && (
                        <div className="mt-1 text-[11px] text-gray-400">
                          Transfer: {row.transferStatus}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money(row.grossEarningsCents, row.currency)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money(row.platformFeeCents, row.currency)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money(row.totalChargedDeductionsCents, row.currency)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-950">
                      {money(row.netPayableCents, row.currency)}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      <div>{shortText(row.payoutRef, 34)}</div>
                      {row.transferCode && (
                        <div className="text-[11px] text-gray-400">
                          {shortText(row.transferCode, 34)}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">
                    No payout summary yet. You haven’t completed any eligible jobs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-950">
          Contractor notice
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          {summary?.contractorNotice ||
            'This is a contractor payout summary, not an employment payslip. Tax, PAYE, UIF, pension, professional indemnity and other statutory or professional obligations may remain your responsibility unless Ambulant+ explicitly applies a deduction line.'}
        </p>
        <p className="mt-3 text-xs text-gray-500">
          Please retain this Contractor Payout Summary for your records and
          obtain independent tax advice where required.
        </p>
      </section>
    </main>
  );
}
