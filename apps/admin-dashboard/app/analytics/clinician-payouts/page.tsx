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

type FinancePayoutRow = {
  id: string;
  role: string;
  entityId: string;
  periodStart?: string;
  periodEnd?: string;
  amountCents: number;
  currency?: string;
  status: string;
  meta?: Record<string, any> | null;
};

type FinancePayoutApiResponse = {
  ok?: boolean;
  items?: FinancePayoutRow[];
  summary?: any[];
  emptyState?: {
    title?: string;
    message?: string;
  } | null;
  error?: string;
};

function asPayoutObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function formatPayoutMoney(amountCents: number | null | undefined, currency = 'ZAR') {
  const cents = Number.isFinite(Number(amountCents)) ? Number(amountCents) : 0;
  return `${currency || 'ZAR'} ${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function shortPayoutText(value: unknown, max = 42) {
  const text = String(value || '').trim();
  if (!text) return '—';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function payoutStatusClass(status: string) {
  const value = String(status || '').toLowerCase();

  if (value === 'paid') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (value === 'failed' || value === 'cancelled' || value === 'refunded') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (value === 'pending') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  return 'border-gray-200 bg-gray-50 text-gray-700';
}

function describePaystackBalance(payload: any) {
  const balance = payload?.balance;

  const candidate =
    balance?.availableBalance ??
    balance?.availableBalanceCents ??
    balance?.balance ??
    balance?.balanceCents ??
    balance?.amountCents ??
    balance?.data?.[0]?.balance ??
    balance?.data?.[0]?.availableBalance ??
    null;

  if (Number.isFinite(Number(candidate))) {
    return `Paystack balance checked: ${formatPayoutMoney(Number(candidate), balance?.currency || 'ZAR')}`;
  }

  const raw = JSON.stringify(balance ?? payload ?? {});
  return raw && raw !== '{}'
    ? `Paystack balance checked: ${raw.slice(0, 220)}`
    : 'Paystack balance checked.';
}

export default function ClinicianPayouts() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totalPayout, setTotalPayout] = useState<number>(0);
  const [period, setPeriod] = useState<string>('last_30_days');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('payoutZAR');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [financePayoutRows, setFinancePayoutRows] = useState<FinancePayoutRow[]>([]);
  const [financePayoutLoading, setFinancePayoutLoading] = useState(false);
  const [financePayoutBusy, setFinancePayoutBusy] = useState<string | null>(null);
  const [financePayoutNotice, setFinancePayoutNotice] = useState<string | null>(null);
  const [financePayoutError, setFinancePayoutError] = useState<string | null>(null);
  const [paystackBalanceNotice, setPaystackBalanceNotice] = useState<string | null>(null);
  const [transferResults, setTransferResults] = useState<any[]>([]);
  const [skippedPayouts, setSkippedPayouts] = useState<any[]>([]);

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


  async function loadFinancePayoutRows() {
    setFinancePayoutLoading(true);
    setFinancePayoutError(null);

    try {
      const res = await fetch('/api/finance/payouts?role=clinician&limit=100', {
        cache: 'no-store',
      });

      const json = (await res.json().catch(() => ({}))) as FinancePayoutApiResponse;
      if (!res.ok || json.ok === false) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      const items = Array.isArray(json.items) ? json.items : [];
      setFinancePayoutRows(items);

      if (!items.length && json.emptyState?.message) {
        setFinancePayoutNotice(json.emptyState.message);
      } else if (!items.length) {
        setFinancePayoutNotice(
          "No payout summary yet. You haven't completed any eligible jobs yet.",
        );
      } else {
        setFinancePayoutNotice(null);
      }
    } catch (e: any) {
      setFinancePayoutRows([]);
      setFinancePayoutError(e?.message || 'Failed to load clinician payout records.');
    } finally {
      setFinancePayoutLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void loadFinancePayoutRows();
  }, []);

  async function postFinancePayoutAction(payload: Record<string, any>) {
    const res = await fetch('/api/finance/payouts', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-role': 'admin',
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok === false) {
      throw new Error(json?.error || `HTTP ${res.status}`);
    }

    return json;
  }

  async function handleCheckPaystackBalance() {
    setFinancePayoutBusy('balance');
    setFinancePayoutError(null);
    setFinancePayoutNotice(null);

    try {
      const json = await postFinancePayoutAction({
        action: 'check_paystack_balance',
        currency: 'ZAR',
      });

      setPaystackBalanceNotice(describePaystackBalance(json));
    } catch (e: any) {
      setFinancePayoutError(e?.message || 'Failed to check Paystack balance.');
    } finally {
      setFinancePayoutBusy(null);
    }
  }

  async function handleSendPendingPaystackTransfers() {
    const payoutIds = financePayoutRows
      .filter((row) => {
        return (
          String(row.role || '').toLowerCase() === 'clinician' &&
          String(row.status || '').toLowerCase() === 'pending' &&
          Number(row.amountCents || 0) > 0
        );
      })
      .map((row) => row.id);

    if (!payoutIds.length) {
      setFinancePayoutError('No pending clinician payouts are available for Paystack transfer.');
      return;
    }

    const confirmed = window.confirm(
      `Send ${payoutIds.length} pending clinician payout(s) via Paystack Transfers?`,
    );

    if (!confirmed) return;

    setFinancePayoutBusy('send_paystack_transfers');
    setFinancePayoutError(null);
    setFinancePayoutNotice(null);

    try {
      const json = await postFinancePayoutAction({
        action: 'send_paystack_transfers',
        payoutIds,
        actorRole: 'admin',
      });

      setTransferResults(Array.isArray(json.transferResults) ? json.transferResults : []);
      setSkippedPayouts(Array.isArray(json.skippedPayouts) ? json.skippedPayouts : []);
      setFinancePayoutNotice(
        `Paystack transfer submission complete. Sent: ${json.transferredCount || 0}; failed: ${json.failedCount || 0}; skipped: ${json.skippedCount || 0}.`,
      );

      await loadFinancePayoutRows();
    } catch (e: any) {
      setFinancePayoutError(e?.message || 'Failed to send clinician payouts via Paystack.');
    } finally {
      setFinancePayoutBusy(null);
    }
  }

  async function handleAddDeduction(row: FinancePayoutRow) {
    const amountText = window.prompt(
      'Enter deduction or advisory estimate amount in ZAR. Example: 125.50',
    );

    if (!amountText) return;

    const amount = Number(amountText);
    if (!Number.isFinite(amount) || amount < 0) {
      setFinancePayoutError('Deduction amount must be a valid positive number.');
      return;
    }

    const label = window.prompt(
      'Enter deduction label or reason. Example: Onboarding instalment, plan fee, tax advisory.',
      'Custom deduction',
    );

    if (!label) return;

    const advisoryOnly = window.confirm(
      'Should this be advisory-only and NOT reduce the payout? Press OK for advisory-only, Cancel to deduct from payout.',
    );

    setFinancePayoutBusy(`deduction:${row.id}`);
    setFinancePayoutError(null);

    try {
      await postFinancePayoutAction({
        action: 'add_deduction',
        payoutId: row.id,
        amountCents: Math.round(amount * 100),
        label,
        advisoryOnly,
        actorRole: 'admin',
      });

      setFinancePayoutNotice(
        advisoryOnly
          ? 'Advisory deduction/estimate added without reducing payout.'
          : 'Deduction added and payout amount updated.',
      );

      await loadFinancePayoutRows();
    } catch (e: any) {
      setFinancePayoutError(e?.message || 'Failed to add deduction.');
    } finally {
      setFinancePayoutBusy(null);
    }
  }

  async function handleMarkPayoutPaid(row: FinancePayoutRow) {
    const reference = window.prompt(
      'Enter remittance/reference for this manual paid reconciliation.',
    );

    if (!reference) return;

    setFinancePayoutBusy(`mark_paid:${row.id}`);
    setFinancePayoutError(null);

    try {
      await postFinancePayoutAction({
        action: 'mark_paid',
        payoutIds: [row.id],
        remittanceRef: reference,
        actorRole: 'admin',
      });

      setFinancePayoutNotice('Clinician payout manually marked as paid.');
      await loadFinancePayoutRows();
    } catch (e: any) {
      setFinancePayoutError(e?.message || 'Failed to mark payout as paid.');
    } finally {
      setFinancePayoutBusy(null);
    }
  }

  async function handleMarkPayoutFailed(row: FinancePayoutRow) {
    const reason = window.prompt(
      'Enter failure reason for this manual failed reconciliation.',
    );

    if (!reason) return;

    setFinancePayoutBusy(`mark_failed:${row.id}`);
    setFinancePayoutError(null);

    try {
      await postFinancePayoutAction({
        action: 'mark_failed',
        payoutIds: [row.id],
        failureReason: reason,
        actorRole: 'admin',
      });

      setFinancePayoutNotice('Clinician payout manually marked as failed.');
      await loadFinancePayoutRows();
    } catch (e: any) {
      setFinancePayoutError(e?.message || 'Failed to mark payout as failed.');
    } finally {
      setFinancePayoutBusy(null);
    }
  }

  const pendingFinancePayoutRows = useMemo(() => {
    return financePayoutRows.filter((row) => {
      return (
        String(row.status || '').toLowerCase() === 'pending' &&
        Number(row.amountCents || 0) > 0
      );
    });
  }, [financePayoutRows]);

  const financePayoutTotals = useMemo(() => {
    return financePayoutRows.reduce(
      (acc, row) => {
        const amount = Number(row.amountCents || 0);
        acc.totalCents += amount;

        if (String(row.status || '').toLowerCase() === 'pending') {
          acc.pendingCents += amount;
          acc.pendingCount += 1;
        }

        if (String(row.status || '').toLowerCase() === 'paid') {
          acc.paidCents += amount;
          acc.paidCount += 1;
        }

        if (String(row.status || '').toLowerCase() === 'failed') {
          acc.failedCents += amount;
          acc.failedCount += 1;
        }

        return acc;
      },
      {
        totalCents: 0,
        pendingCents: 0,
        paidCents: 0,
        failedCents: 0,
        pendingCount: 0,
        paidCount: 0,
        failedCount: 0,
      },
    );
  }, [financePayoutRows]);

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
              No payout summary yet.
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
                    No payout summary yet. You haven’t completed any eligible jobs yet.
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
      {/* A5_J_E_B_CLINICIAN_PAYOUT_ADMIN_CONTROLS */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <span className="text-sm font-medium text-gray-900">
              Clinician payout finance controls
            </span>
            <p className="text-[11px] text-gray-500 max-w-3xl">
              Review generated clinician contractor payouts, check Paystack balance,
              submit pending approved payouts, add Admin deductions or advisory
              estimates, and use manual reconciliation only when required.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadFinancePayoutRows()}
              disabled={financePayoutLoading || Boolean(financePayoutBusy)}
              className="rounded border bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {financePayoutLoading ? 'Refreshing…' : 'Refresh payout records'}
            </button>
            <button
              type="button"
              onClick={() => void handleCheckPaystackBalance()}
              disabled={Boolean(financePayoutBusy)}
              className="rounded border bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {financePayoutBusy === 'balance'
                ? 'Checking…'
                : 'Check Paystack balance'}
            </button>
            <button
              type="button"
              onClick={() => void handleSendPendingPaystackTransfers()}
              disabled={Boolean(financePayoutBusy) || pendingFinancePayoutRows.length === 0}
              className="rounded bg-gray-900 px-3 py-1.5 text-xs text-white hover:bg-black disabled:opacity-50"
            >
              {financePayoutBusy === 'send_paystack_transfers'
                ? 'Submitting…'
                : `Send pending payouts via Paystack (${pendingFinancePayoutRows.length})`}
            </button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          <div className="rounded-xl border bg-gray-50 p-3">
            <div className="text-[11px] text-gray-500">Total payout records</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">
              {financePayoutRows.length.toLocaleString()}
            </div>
          </div>
          <div className="rounded-xl border bg-amber-50 p-3">
            <div className="text-[11px] text-amber-700">Pending payable</div>
            <div className="mt-1 text-lg font-semibold text-amber-900">
              {formatPayoutMoney(financePayoutTotals.pendingCents)}
            </div>
            <div className="text-[11px] text-amber-700">
              {financePayoutTotals.pendingCount.toLocaleString()} row(s)
            </div>
          </div>
          <div className="rounded-xl border bg-emerald-50 p-3">
            <div className="text-[11px] text-emerald-700">Paid</div>
            <div className="mt-1 text-lg font-semibold text-emerald-900">
              {formatPayoutMoney(financePayoutTotals.paidCents)}
            </div>
            <div className="text-[11px] text-emerald-700">
              {financePayoutTotals.paidCount.toLocaleString()} row(s)
            </div>
          </div>
          <div className="rounded-xl border bg-red-50 p-3">
            <div className="text-[11px] text-red-700">Failed</div>
            <div className="mt-1 text-lg font-semibold text-red-900">
              {formatPayoutMoney(financePayoutTotals.failedCents)}
            </div>
            <div className="text-[11px] text-red-700">
              {financePayoutTotals.failedCount.toLocaleString()} row(s)
            </div>
          </div>
        </div>

        {(paystackBalanceNotice || financePayoutNotice || financePayoutError) && (
          <div className="space-y-2 text-xs">
            {paystackBalanceNotice && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-blue-800">
                {paystackBalanceNotice}
              </div>
            )}
            {financePayoutNotice && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-800">
                {financePayoutNotice}
              </div>
            )}
            {financePayoutError && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-red-800">
                {financePayoutError}
              </div>
            )}
          </div>
        )}

        {(transferResults.length > 0 || skippedPayouts.length > 0) && (
          <div className="grid gap-3 lg:grid-cols-2">
            {transferResults.length > 0 && (
              <div className="rounded-xl border bg-gray-50 p-3">
                <div className="text-xs font-medium text-gray-900">
                  Latest transfer results
                </div>
                <div className="mt-2 max-h-40 space-y-1 overflow-auto text-[11px] text-gray-600">
                  {transferResults.slice(0, 12).map((row, index) => (
                    <div key={`transfer-${index}`} className="rounded bg-white px-2 py-1">
                      {shortPayoutText(row.payoutId, 18)} · {row.payoutStatus || row.paystackStatus || 'submitted'}
                      {row.error ? ` · ${row.error}` : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {skippedPayouts.length > 0 && (
              <div className="rounded-xl border bg-gray-50 p-3">
                <div className="text-xs font-medium text-gray-900">
                  Skipped payout rows
                </div>
                <div className="mt-2 max-h-40 space-y-1 overflow-auto text-[11px] text-gray-600">
                  {skippedPayouts.slice(0, 12).map((row, index) => (
                    <div key={`skipped-${index}`} className="rounded bg-white px-2 py-1">
                      {shortPayoutText(row.payoutId, 18)} · {row.reason || row.error || 'skipped'}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Clinician</th>
                <th className="px-3 py-2 font-medium">Period</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">Net payable</th>
                <th className="px-3 py-2 font-medium">Reference</th>
                <th className="px-3 py-2 font-medium">Deductions / advisory</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {financePayoutRows.length ? (
                financePayoutRows.map((row) => {
                  const meta = asPayoutObject(row.meta);
                  const summary = asPayoutObject(meta.contractorPayoutSummary);
                  const customDeductions = Array.isArray(summary.customDeductions)
                    ? summary.customDeductions
                    : [];
                  const transfer = asPayoutObject(meta.paystackTransfer);
                  const isBusy = Boolean(financePayoutBusy?.endsWith(row.id));
                  const status = String(row.status || 'pending').toLowerCase();

                  return (
                    <tr key={row.id} className="border-t align-top">
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">
                          {shortPayoutText(row.entityId, 22)}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {shortPayoutText(row.id, 24)}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        <div>
                          {row.periodStart
                            ? new Date(row.periodStart).toLocaleDateString()
                            : '—'}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {row.periodEnd
                            ? new Date(row.periodEnd).toLocaleDateString()
                            : '—'}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${payoutStatusClass(status)}`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-900">
                        {formatPayoutMoney(row.amountCents, row.currency)}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        <div>{shortPayoutText(meta.payoutRef || transfer.reference, 34)}</div>
                        {transfer.transferCode && (
                          <div className="text-[11px] text-gray-400">
                            {shortPayoutText(transfer.transferCode, 34)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        <div className="text-[11px]">
                          Platform: {formatPayoutMoney(summary.platformFeeCents || meta.platformFeeCents || 0, row.currency)}
                        </div>
                        <div className="text-[11px]">
                          Custom: {formatPayoutMoney(summary.customDeductionCents || 0, row.currency)}
                        </div>
                        {customDeductions.length > 0 && (
                          <div className="mt-1 text-[11px] text-gray-400">
                            {customDeductions.length} added deduction/advisory item(s)
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => void handleAddDeduction(row)}
                            disabled={isBusy || status === 'paid'}
                            className="rounded border bg-white px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Add deduction
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleMarkPayoutPaid(row)}
                            disabled={isBusy || status === 'paid'}
                            className="rounded border bg-white px-2 py-1 text-[11px] text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            Mark paid
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleMarkPayoutFailed(row)}
                            disabled={isBusy || status === 'failed'}
                            className="rounded border bg-white px-2 py-1 text-[11px] text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            Mark failed
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-xs text-gray-500">
                    No payout summary yet. You haven’t completed any eligible jobs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-gray-500">
          Contractor summaries are not employment payslips. Tax, PAYE, UIF,
          pension, professional indemnity and other statutory or professional
          obligations may remain the clinician’s responsibility unless Ambulant+
          explicitly applies a deduction line.
        </p>
      </section>

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
            No payout summary yet. You haven’t completed any eligible jobs yet.
            Once eligible consultations are completed and processed, this view will summarise
            total payouts, blended rates and class-level performance.
          </p>
        )}
      </section>
    </main>
  );
}
