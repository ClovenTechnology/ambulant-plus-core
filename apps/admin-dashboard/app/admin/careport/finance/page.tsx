'use client';

import React, { useEffect, useMemo, useState } from 'react';

type Policy = {
  currency?: string;
  platformCommissionBps?: number;
  passPaymentProviderFeeToPharmacy?: boolean;
  paymentProviderFeeBps?: number;
  paymentProviderFixedFeeCents?: number;
  riderDeliveryShareBps?: number;
  riderBaseFeeCents?: number;
  riderPerKmFeeCents?: number;
  pharmacyMonthlyPlatformFeeCents?: number;
  pharmacyInventoryHostingFeeCents?: number;
  settlementCycle?: string;
};

type PolicyEnvelope = {
  policy?: Policy;
  source?: string;
  persistence?: string;
};

type FinanceSummary = {
  orders?: number;
  grossCents?: number;
  grossMinor?: number;
  pharmacyGrossCents?: number;
  pharmacyGrossMinor?: number;
  deliveryGrossCents?: number;
  deliveryGrossMinor?: number;
  platformFeesCents?: number;
  platformFeeMinor?: number;
  paymentProviderFeesCents?: number;
  paymentProviderFeeMinor?: number;
  pharmacyPayoutCents?: number;
  pharmacyNetPayableMinor?: number;
  riderPayoutCents?: number;
  riderNetPayableMinor?: number;
  lineCount?: number;
};

type FinanceRow = {
  role?: string;
  recipientType?: string;
  entityId?: string;
  recipientId?: string;
  name?: string;
  orders?: number;
  orderCount?: number;
  trips?: number;
  tripCount?: number;
  grossCents?: number;
  grossMinor?: number;
  platformFeeCents?: number;
  platformFeeMinor?: number;
  paymentProviderFeeCents?: number;
  paymentProviderFeeMinor?: number;
  monthlyFeeCents?: number;
  subscriptionFeeMinor?: number;
  inventoryHostingFeeCents?: number;
  inventoryHostingFeeMinor?: number;
  riderFeeMinor?: number;
  netCents?: number;
  netPayableMinor?: number;
  orderIds?: string[];
};

type SettlementBatch = {
  id?: string;
  status?: string;
  currency?: string;
  totalGrossMinor?: number;
  pharmacyNetPayableMinor?: number;
  riderNetPayableMinor?: number;
  lineCount?: number;
  remittanceRef?: string | null;
  createdAt?: string | null;
  paidAt?: string | null;
  failedAt?: string | null;
};


// A5_G_F_D3_CAREPORT_PAYSTACK_TRANSFER_UI_TYPES
type CarePortPaystackBalanceInfo = {
  currency?: string | null;
  balanceCents?: number | null;
  raw?: any;
};

type CarePortPaystackTransferResult = {
  ok?: boolean;
  settlementLineId?: string;
  batchId?: string | null;
  recipientType?: string;
  recipientId?: string;
  amountCents?: number | null;
  currency?: string | null;
  paystackStatus?: string;
  settlementStatus?: string;
  paid?: boolean;
  failed?: boolean;
  reference?: string;
  transferCode?: string | null;
  recipientCode?: string | null;
  error?: string;
  status?: string;
};

type FinanceResponse = {
  ok?: boolean;
  orgId?: string;
  from?: string;
  to?: string;
  includePaid?: boolean;
  policy?: PolicyEnvelope;
  summary?: FinanceSummary;
  pharmacy?: FinanceRow[];
  riders?: FinanceRow[];
  existingBatches?: SettlementBatch[];
  existingLines?: unknown[];
  batch?: SettlementBatch;
  payouts?: unknown[];
  error?: string;
  preview?: FinanceResponse;
};

function startOfMonthInput() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function pretty(value?: string | null) {
  return String(value || 'UNKNOWN').replace(/_/g, ' ');
}

function amount(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function pickMinor(source: Record<string, unknown> | undefined, keys: string[]) {
  if (!source) return 0;

  for (const key of keys) {
    const value = amount(source[key]);
    if (value) return value;
  }

  return 0;
}

function money(cents: number, currency = 'ZAR') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

function formatWhen(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function statusTone(status?: string | null) {
  const s = String(status || '').toUpperCase();

  if (s === 'PAID') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (s === 'FAILED') return 'border-rose-200 bg-rose-50 text-rose-800';
  if (s === 'PENDING' || s === 'BATCHED') return 'border-amber-200 bg-amber-50 text-amber-900';

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function rowGross(row: FinanceRow) {
  return pickMinor(row as Record<string, unknown>, ['grossCents', 'grossMinor']);
}

function rowProviderFee(row: FinanceRow) {
  return pickMinor(row as Record<string, unknown>, ['paymentProviderFeeCents', 'paymentProviderFeeMinor']);
}

function rowPlatformFee(row: FinanceRow) {
  return pickMinor(row as Record<string, unknown>, ['platformFeeCents', 'platformFeeMinor']);
}

function rowSubscriptionFee(row: FinanceRow) {
  return pickMinor(row as Record<string, unknown>, ['monthlyFeeCents', 'subscriptionFeeMinor']);
}

function rowInventoryFee(row: FinanceRow) {
  return pickMinor(row as Record<string, unknown>, ['inventoryHostingFeeCents', 'inventoryHostingFeeMinor']);
}

function rowRiderFee(row: FinanceRow) {
  return pickMinor(row as Record<string, unknown>, ['riderFeeMinor']);
}

function rowNet(row: FinanceRow) {
  return pickMinor(row as Record<string, unknown>, ['netCents', 'netPayableMinor']);
}

export default function CarePortFinancePage() {
  const [from, setFrom] = useState(startOfMonthInput);
  const [to, setTo] = useState(todayInput);
  const [includePaid, setIncludePaid] = useState(false);
  const [data, setData] = useState<FinanceResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [paystackBusy, setPaystackBusy] = useState<string | null>(null);
  const [paystackBalance, setPaystackBalance] = useState<CarePortPaystackBalanceInfo | null>(null);
  const [paystackTransferResults, setPaystackTransferResults] = useState<CarePortPaystackTransferResult[]>([]);
  const [paystackSkippedSettlementLines, setPaystackSkippedSettlementLines] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const params = new URLSearchParams();
      params.set('from', from);
      params.set('to', to);
      if (includePaid) params.set('includePaid', '1');

      const res = await fetch(`/api/careport/admin/finance?${params.toString()}`, {
        cache: 'no-store',
      });

      const payload = (await res.json().catch(() => ({}))) as FinanceResponse;

      if (!res.ok || payload.ok === false) {
        throw new Error(payload.error || `careport_admin_finance_http_${res.status}`);
      }

      setData(payload);
    } catch (err: any) {
      setData(null);
      setError(err?.message || 'Failed to load CarePort finance.');
    } finally {
      setBusy(false);
    }
  }

  async function generateSettlement(dryRun: boolean) {
    setActionBusy(dryRun ? 'dryRun' : 'generate');
    setError(null);
    setNotice(null);

    try {
      const res = await fetch('/api/careport/admin/finance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          from,
          to,
          includePaid,
          dryRun,
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as FinanceResponse;

      if (!res.ok || payload.ok === false) {
        if (payload.preview) setData(payload.preview);
        throw new Error(payload.error || `careport_admin_finance_generate_http_${res.status}`);
      }

      setData(payload);
      setNotice(dryRun ? 'Settlement preview refreshed.' : 'Settlement batch generated.');
    } catch (err: any) {
      setError(err?.message || 'Failed to generate CarePort settlement.');
    } finally {
      setActionBusy(null);
    }
  }

  async function markBatch(batchId: string, action: 'mark_paid' | 'mark_failed') {
    const remittanceRef =
      action === 'mark_paid' ? window.prompt('Remittance reference, optional') || '' : '';
    const failureReason =
      action === 'mark_failed' ? window.prompt('Failure reason, optional') || '' : '';

    setActionBusy(`${action}:${batchId}`);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch('/api/careport/admin/finance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action,
          batchId,
          remittanceRef,
          failureReason,
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as FinanceResponse;

      if (!res.ok || payload.ok === false) {
        throw new Error(payload.error || `careport_admin_finance_${action}_http_${res.status}`);
      }

      setNotice(action === 'mark_paid' ? 'Settlement marked paid.' : 'Settlement marked failed.');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to update settlement batch.');
    } finally {
      setActionBusy(null);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currency = data?.policy?.policy?.currency || 'ZAR';
  // A5_G_F_D3_CAREPORT_PAYSTACK_TRANSFER_UI_ACTIONS
  function carePortGeneratedSettlementLineIds() {
    const rows = Array.isArray((data as any)?.payouts) ? ((data as any).payouts as any[]) : [];
    return rows.map((row) => String(row?.id || '')).filter(Boolean);
  }

  function carePortPendingBatchId() {
    const generatedBatchId = String((data as any)?.batch?.id || '');
    if (generatedBatchId) return generatedBatchId;

    const batches = Array.isArray((data as any)?.existingBatches) ? ((data as any).existingBatches as any[]) : [];
    const pending = batches.find((batch) => String(batch?.status || '').toUpperCase() === 'PENDING');
    return String(pending?.id || '');
  }

  function hasCarePortPaystackTransferTarget() {
    return carePortGeneratedSettlementLineIds().length > 0 || Boolean(carePortPendingBatchId());
  }

  function carePortCount(value: unknown) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n.toLocaleString() : '0';
  }

  function carePortMoney(value: unknown, fallbackCurrency = 'ZAR') {
    const n = Number(value || 0);
    return money(Number.isFinite(n) ? n : 0, fallbackCurrency);
  }

  async function runCarePortPaystackBalanceCheck() {
    setPaystackBusy('balance');
    setError(null);
    setNotice(null);

    try {
      const transferCurrency = String((data as any)?.summary?.currency || 'ZAR').toUpperCase();

      const res = await fetch('/api/careport/admin/finance', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-user-role': 'admin' },
        body: JSON.stringify({
          action: 'check_paystack_balance',
          currency: transferCurrency,
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as any;

      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || 'careport_paystack_balance_http_' + res.status);
      }

      setPaystackBalance(payload?.balance || null);
      setNotice(
        'Paystack transfer balance checked: ' +
          carePortMoney(payload?.balance?.balanceCents, payload?.balance?.currency || transferCurrency),
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to check CarePort Paystack transfer balance.');
    } finally {
      setPaystackBusy(null);
    }
  }

  async function runCarePortPaystackTransfer(batchIdOverride?: string) {
    const settlementLineIds = carePortGeneratedSettlementLineIds();
    const batchId = batchIdOverride || carePortPendingBatchId();

    if (!settlementLineIds.length && !batchId) {
      setError('Generate a CarePort settlement batch first, or keep a pending batch available before sending Paystack transfers.');
      return;
    }

    setPaystackBusy('transfer');
    setError(null);
    setNotice(null);

    try {
      const res = await fetch('/api/careport/admin/finance', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-user-role': 'admin' },
        body: JSON.stringify({
          action: 'send_paystack_transfers',
          settlementLineIds: settlementLineIds.length ? settlementLineIds : undefined,
          batchId: settlementLineIds.length ? undefined : batchId,
          currency: String((data as any)?.summary?.currency || 'ZAR').toUpperCase(),
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as any;

      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || 'careport_paystack_transfer_http_' + res.status);
      }

      const transferResults = Array.isArray(payload?.transferResults) ? payload.transferResults : [];
      const skippedRows = Array.isArray(payload?.skippedSettlementLines) ? payload.skippedSettlementLines : [];

      setPaystackTransferResults(transferResults);
      setPaystackSkippedSettlementLines(skippedRows);

      setData((current) => ({
        ...((current || {}) as any),
        paystackTransferResults: transferResults,
        paystackSkippedSettlementLines: skippedRows,
      }) as FinanceResponse);

      setNotice(
        'CarePort Paystack transfer request completed: ' +
          carePortCount(payload?.transferredCount) +
          ' submitted, ' +
          carePortCount(payload?.failedCount) +
          ' failed, ' +
          carePortCount(payload?.skippedCount) +
          ' skipped.',
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to send CarePort settlement lines via Paystack.');
    } finally {
      setPaystackBusy(null);
    }
  }


  const summary = data?.summary || {};
  const pharmacy = Array.isArray(data?.pharmacy) ? data.pharmacy : [];
  const riders = Array.isArray(data?.riders) ? data.riders : [];
  const rows = useMemo(() => [...pharmacy, ...riders], [pharmacy, riders]);
  const batches = Array.isArray(data?.existingBatches) ? data.existingBatches : [];

  const cards = [
    ['Orders', amount(summary.orders)],
    ['Gross', money(pickMinor(summary as Record<string, unknown>, ['grossCents', 'grossMinor']), currency)],
    ['Platform fees', money(pickMinor(summary as Record<string, unknown>, ['platformFeesCents', 'platformFeeMinor']), currency)],
    ['Provider fees', money(pickMinor(summary as Record<string, unknown>, ['paymentProviderFeesCents', 'paymentProviderFeeMinor']), currency)],
    ['Pharmacy payable', money(pickMinor(summary as Record<string, unknown>, ['pharmacyPayoutCents', 'pharmacyNetPayableMinor']), currency)],
    ['Rider payable', money(pickMinor(summary as Record<string, unknown>, ['riderPayoutCents', 'riderNetPayableMinor']), currency)],
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                CarePort finance
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                Settlement and payout visibility
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Preview pharmacy and rider settlement lines from completed CarePort orders, estimate platform and provider
                fees, and generate payout batches when settlement models are configured.
              </p>
              {data?.orgId ? <p className="mt-2 text-xs text-slate-400">Org: {data.orgId}</p> : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="/admin/careport/orders"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Order board
              </a>
              <a
                href="/admin/careport/catalogue/global-products"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Global catalogue
              </a>
              <a
                href="/admin/careport/commercial-policy"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Commercial policy
              </a>
              <button
                type="button"
                onClick={() => void load()}
                disabled={busy}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {busy ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {cards.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="mt-1 text-xl font-semibold text-slate-950">{value}</div>
              </div>
            ))}
          </div>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[180px_180px_1fr_auto_auto_auto] md:items-end">
            <label>
              <div className="text-xs font-medium text-slate-600">From</div>
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
              />
            </label>

            <label>
              <div className="text-xs font-medium text-slate-600">To</div>
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
              />
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={includePaid}
                onChange={(event) => setIncludePaid(event.target.checked)}
              />
              Include paid and active orders
            </label>

            <button
              type="button"
              onClick={() => void load()}
              disabled={busy}
              className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Apply
            </button>

            <button
              type="button"
              onClick={() => void generateSettlement(true)}
              disabled={!!actionBusy}
              className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {actionBusy === 'dryRun' ? 'Previewing...' : 'Preview'}
            </button>

            <button
              type="button"
              onClick={() => void generateSettlement(false)}
              disabled={!!actionBusy}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {actionBusy === 'generate' ? 'Generating...' : 'Generate batch'}
            </button>
              {/* A5_G_F_D3_CAREPORT_PAYSTACK_TRANSFER_UI_BUTTONS */}
              <button
                type="button"
                onClick={() => void runCarePortPaystackBalanceCheck()}
                disabled={!!actionBusy || !!paystackBusy}
                className="rounded-2xl border border-cyan-200 bg-cyan-50 px-5 py-3 text-sm font-medium text-cyan-800 hover:bg-cyan-100 disabled:opacity-50"
              >
                {paystackBusy === 'balance' ? 'Checking balance...' : 'Check Paystack balance'}
              </button>
              <button
                type="button"
                onClick={() => void runCarePortPaystackTransfer()}
                disabled={!!actionBusy || !!paystackBusy || !hasCarePortPaystackTransferTarget()}
                className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                title={!hasCarePortPaystackTransferTarget() ? 'Generate or load a pending settlement batch first' : 'Send CarePort settlement lines via Paystack'}
              >
                {paystackBusy === 'transfer' ? 'Sending Paystack transfers...' : 'Send settlement via Paystack'}
              </button>

          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
            Policy source: {data?.policy?.source || 'unknown'} | Settlement cycle:{' '}
            {data?.policy?.policy?.settlementCycle || 'monthly'} | Commission:{' '}
            {amount(data?.policy?.policy?.platformCommissionBps) / 100}% | Provider fee:{' '}
            {amount(data?.policy?.policy?.paymentProviderFeeBps) / 100}% +{' '}
            {money(amount(data?.policy?.policy?.paymentProviderFixedFeeCents), currency)}
          </div>

          {notice ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              {notice}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
    
          {/* A5_G_F_D3_CAREPORT_PAYSTACK_TRANSFER_UI_RESULTS */}
          {paystackBalance ? (
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900">
              <div className="font-semibold">Paystack transfer balance</div>
              <div className="mt-1">
                {paystackBalance.currency || 'ZAR'}: {carePortMoney(paystackBalance.balanceCents, paystackBalance.currency || 'ZAR')}
              </div>
            </div>
          ) : null}

          {paystackTransferResults.length || paystackSkippedSettlementLines.length ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <div className="font-semibold">CarePort Paystack transfer results</div>
              <div className="mt-1">
                Submitted: {carePortCount(paystackTransferResults.filter((row) => row?.ok).length)} · Failed:{' '}
                {carePortCount(paystackTransferResults.filter((row) => row?.ok === false).length)} · Skipped:{' '}
                {carePortCount(paystackSkippedSettlementLines.length)}
              </div>
              {paystackTransferResults.length ? (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {paystackTransferResults.slice(0, 6).map((row, index) => (
                    <div key={row.settlementLineId || row.reference || index} className="rounded-xl border border-emerald-200 bg-white p-3 text-xs">
                      <div className="font-semibold">{row.reference || row.settlementLineId || 'CarePort transfer'}</div>
                      <div>Recipient: {row.recipientType || 'partner'} {row.recipientId || ''}</div>
                      <div>Status: {row.paystackStatus || row.settlementStatus || row.status || (row.ok ? 'submitted' : 'failed')}</div>
                      <div>Amount: {carePortMoney(row.amountCents, row.currency || 'ZAR')}</div>
                      {row.error ? <div className="text-rose-700">{row.error}</div> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <h2 className="text-lg font-semibold text-slate-950">Settlement preview lines</h2>
              <p className="text-sm text-slate-500">
                Pharmacy and rider rows calculated from eligible CarePort orders for the selected period.
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              {rows.length} line(s)
            </span>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Recipient</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Orders / trips</th>
                    <th className="px-4 py-3">Gross</th>
                    <th className="px-4 py-3">Fees</th>
                    <th className="px-4 py-3">Net payable</th>
                    <th className="px-4 py-3">Order IDs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {busy ? (
                    <tr>
                      <td className="px-4 py-6 text-slate-500" colSpan={7}>
                        Loading finance preview...
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-slate-500" colSpan={7}>
                        No settlement rows for this period.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, index) => (
                      <tr key={`${row.recipientType || row.role}-${row.recipientId || row.entityId}-${index}`} className="align-top">
                        <td className="px-4 py-4">
                          <div className="font-medium text-slate-900">{row.name || row.recipientId || row.entityId || '-'}</div>
                          <div className="mt-1 font-mono text-xs text-slate-400">{row.recipientId || row.entityId || '-'}</div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                            {pretty(row.recipientType || row.role)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {amount(row.orderCount ?? row.orders) || amount(row.tripCount ?? row.trips)}
                        </td>
                        <td className="px-4 py-4 font-medium text-slate-900">{money(rowGross(row), currency)}</td>
                        <td className="px-4 py-4 text-xs text-slate-500">
                          <div>Platform: {money(rowPlatformFee(row), currency)}</div>
                          <div>Provider: {money(rowProviderFee(row), currency)}</div>
                          <div>Monthly: {money(rowSubscriptionFee(row), currency)}</div>
                          <div>Inventory: {money(rowInventoryFee(row), currency)}</div>
                          <div>Rider: {money(rowRiderFee(row), currency)}</div>
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-950">{money(rowNet(row), currency)}</td>
                        <td className="px-4 py-4">
                          <div className="max-w-[260px] truncate font-mono text-xs text-slate-400">
                            {Array.isArray(row.orderIds) && row.orderIds.length ? row.orderIds.join(', ') : '-'}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Existing settlement batches</h2>
            <p className="text-sm text-slate-500">
              Mark generated batches as paid or failed after finance reconciliation.
            </p>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Gross</th>
                    <th className="px-4 py-3">Payable</th>
                    <th className="px-4 py-3">Lines</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {batches.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-slate-500" colSpan={7}>
                        No existing settlement batches for this period.
                      </td>
                    </tr>
                  ) : (
                    batches.map((batch) => (
                      <tr key={batch.id} className="align-top">
                        <td className="px-4 py-4">
                          <div className="font-mono text-xs text-slate-900">{batch.id || '-'}</div>
                          {batch.remittanceRef ? (
                            <div className="mt-1 text-xs text-slate-400">Ref: {batch.remittanceRef}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-4">
                          <span className={'rounded-full border px-3 py-1 text-xs font-semibold ' + statusTone(batch.status)}>
                            {pretty(batch.status)}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-medium text-slate-900">
                          {money(amount(batch.totalGrossMinor), batch.currency || currency)}
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          <div>Pharmacy: {money(amount(batch.pharmacyNetPayableMinor), batch.currency || currency)}</div>
                          <div>Rider: {money(amount(batch.riderNetPayableMinor), batch.currency || currency)}</div>
                        </td>
                        <td className="px-4 py-4 text-slate-700">{amount(batch.lineCount)}</td>
                        <td className="px-4 py-4 text-xs text-slate-500">{formatWhen(batch.createdAt)}</td>
                        <td className="px-4 py-4">
                          {batch.id ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void markBatch(batch.id as string, 'mark_paid')}
                                disabled={!!actionBusy}
                                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                              >
                                Mark paid
                              </button>
                              <button
                                type="button"
                                onClick={() => void markBatch(batch.id as string, 'mark_failed')}
                                disabled={!!actionBusy}
                                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
                              >
                                Mark failed
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}