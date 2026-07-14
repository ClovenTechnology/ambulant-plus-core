'use client';

import { useEffect, useMemo, useState } from 'react';

type Summary = {
  records?: number;
  readyRecords?: number;
  needsReviewRecords?: number;
  grossCents?: number;
  labGrossCents?: number;
  phlebGrossCents?: number;
  logisticsFeeCents?: number;
  urgentSurchargeCents?: number;
  coldChainSurchargeCents?: number;
  platformFeeCents?: number;
  providerFeeCents?: number;
  labNetPayableCents?: number;
  phlebNetPayableCents?: number;
  sponsorAmountMinor?: number;
  patientCopayMinor?: number;
  currency?: string;
};

type FinanceRow = {
  id?: string;
  orderId?: string;
  drawId?: string;
  labId?: string | null;
  labName?: string | null;
  labStatus?: string | null;
  phlebId?: string | null;
  phlebUserId?: string | null;
  phlebStatus?: string | null;
  currency?: string;
  subtotalCents?: number;
  logisticsFeeCents?: number;
  urgentSurchargeCents?: number;
  coldChainSurchargeCents?: number;
  platformFeeCents?: number;
  providerFeeCents?: number;
  labGrossCents?: number;
  phlebGrossCents?: number;
  labNetCents?: number;
  phlebNetCents?: number;
  sponsorAmountMinor?: number;
  patientCopayMinor?: number;
  totalCents?: number;
  settlementState?: string;
  settlementReady?: boolean;
  pricingSnapshot?: any;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type Bucket = {
  id?: string;
  name?: string;
  userId?: string;
  status?: string;
  active?: boolean;
  orderCount?: number;
  grossCents?: number;
  platformFeeCents?: number;
  providerFeeCents?: number;
  netPayableCents?: number;
  orderIds?: string[];
};


// A5_G_D_B_MEDREACH_PAYSTACK_TRANSFER_UI_TYPES
type GeneratedPayoutRow = {
  id?: string;
  actorType?: string;
  actorId?: string;
  status?: string;
  payoutRef?: string | null;
  netCents?: number;
  currency?: string;
  meta?: any;
};

type PaystackTransferResultRow = {
  ok?: boolean;
  payoutId?: string;
  actorType?: string;
  actorId?: string;
  amountCents?: number;
  currency?: string;
  paystackStatus?: string;
  payoutStatus?: string;
  paid?: boolean;
  failed?: boolean;
  reference?: string;
  transferCode?: string | null;
  recipientCode?: string | null;
  error?: string;
  status?: string;
};

type PaystackBalanceInfo = {
  currency?: string;
  balanceCents?: number;
  raw?: any;
};

type FinanceResponse = {
  ok?: boolean;
  error?: string;
  from?: string;
  to?: string;
  summary?: Summary;
  rows?: FinanceRow[];
  labs?: Bucket[];
  phlebs?: Bucket[];
};

function todayInput(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function amount(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function money(cents: unknown, currency = 'ZAR') {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency,
  }).format(amount(cents) / 100);
}

function stateBadge(state: string | undefined) {
  const s = String(state || '').toLowerCase();

  if (s === 'ready') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (s === 'needs_provider') return 'border-amber-200 bg-amber-50 text-amber-900';
  if (s === 'needs_amount') return 'border-orange-200 bg-orange-50 text-orange-900';
  if (s === 'needs_net') return 'border-rose-200 bg-rose-50 text-rose-800';

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function shortId(value: string | null | undefined) {
  if (!value) return '—';
  return value.length > 12 ? value.slice(0, 8) + '…' : value;
}

export default function MedReachFinancePage() {
  const [from, setFrom] = useState(todayInput(-30));
  const [to, setTo] = useState(todayInput(0));
  const [labId, setLabId] = useState('');
  const [phlebId, setPhlebId] = useState('');
  const [settlementState, setSettlementState] = useState('');
  const [data, setData] = useState<FinanceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [paystackBusy, setPaystackBusy] = useState(false);
  const [paystackBalance, setPaystackBalance] = useState<PaystackBalanceInfo | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function loadFinance() {
    setLoading(true);
    setError('');
    setNotice('');

    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (labId.trim()) params.set('labId', labId.trim());
      if (phlebId.trim()) params.set('phlebId', phlebId.trim());
      if (settlementState) params.set('settlementState', settlementState);
      params.set('take', '250');

      const res = await fetch('/api/medreach/admin/finance?' + params.toString(), {
        cache: 'no-store',
      });

      const payload = (await res.json().catch(() => ({}))) as FinanceResponse;

      if (!res.ok || payload.ok === false) {
        throw new Error(payload.error || 'medreach_admin_finance_http_' + res.status);
      }

      setData(payload);
      setNotice('MedReach finance visibility refreshed.');
    } catch (err: any) {
      setError(err?.message || 'Failed to load MedReach finance visibility.');
    } finally {
      setLoading(false);
    }
  }


  async function runSettlementAction(dryRun: boolean) {
    setActionBusy(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch('/api/medreach/admin/finance', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-user-role': 'admin' },
        body: JSON.stringify({
          action: dryRun ? 'dry_run' : 'generate_batch',
          from,
          to,
          labId,
          phlebId,
          settlementState: settlementState || 'ready',
        }),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || 'medreach_admin_finance_action_http_' + res.status);
      }

      setData((current) => ({
        ...(current || {}),
        ...payload,
        rows: payload.rows || current?.rows || [],
        summary: payload.summary || current?.summary,
      }));

      setNotice(
        dryRun
          ? 'MedReach payout dry-run generated ' + amount(payload?.payoutPreview?.length) + ' payout line(s).'
          : 'MedReach payout batch generated ' + amount(payload?.generatedCount) + ' new payout(s); skipped ' + amount(payload?.skippedCount) + ' existing payout(s).',
      );
    } catch (error: any) {
      setError(error?.message || 'Failed to run MedReach settlement action.');
    } finally {
      setActionBusy(false);
    }
  }


  // A5_G_D_B_MEDREACH_PAYSTACK_TRANSFER_UI_ACTIONS
  async function runPaystackBalanceCheck() {
    setPaystackBusy(true);
    setError('');
    setNotice('');

    try {
      const transferCurrency = data?.summary?.currency || data?.rows?.[0]?.currency || 'ZAR';

      const res = await fetch('/api/medreach/admin/finance', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-user-role': 'admin' },
        body: JSON.stringify({
          action: 'check_paystack_balance',
          currency: transferCurrency,
        }),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || 'medreach_paystack_balance_http_' + res.status);
      }

      setPaystackBalance(payload?.balance || null);
      setData((current) => ({
        ...(current || {}),
        paystackBalance: payload?.balance || null,
      } as any));

      setNotice(
        'Paystack transfer balance checked: ' +
          money(payload?.balance?.balanceCents, payload?.balance?.currency || transferCurrency),
      );
    } catch (error: any) {
      setError(error?.message || 'Failed to check Paystack transfer balance.');
    } finally {
      setPaystackBusy(false);
    }
  }

  async function runPaystackTransferAction() {
    const payoutRows = ((((data as any)?.generatedPayouts || []) as GeneratedPayoutRow[]));
    const payoutIds = payoutRows.map((row) => String(row?.id || '')).filter(Boolean);

    if (!payoutIds.length) {
      setError('Generate a MedReach payout batch first, then send those generated payouts via Paystack.');
      return;
    }

    setPaystackBusy(true);
    setError('');
    setNotice('');

    try {
      const transferCurrency = data?.summary?.currency || data?.rows?.[0]?.currency || payoutRows[0]?.currency || 'ZAR';

      const res = await fetch('/api/medreach/admin/finance', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-user-role': 'admin' },
        body: JSON.stringify({
          action: 'send_paystack_transfers',
          payoutIds,
          currency: transferCurrency,
        }),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || 'medreach_paystack_transfer_http_' + res.status);
      }

      setData((current) => ({
        ...(current || {}),
        paystackTransferResults: payload?.transferResults || [],
        paystackSkippedPayouts: payload?.skippedPayouts || [],
        transferResults: payload?.transferResults || [],
        generatedPayouts: (current as any)?.generatedPayouts || payoutRows,
      } as any));

      setNotice(
        'Paystack transfer request completed: ' +
          amount(payload?.transferredCount) +
          ' submitted, ' +
          amount(payload?.failedCount) +
          ' failed, ' +
          amount(payload?.skippedCount) +
          ' skipped.',
      );
    } catch (error: any) {
      setError(error?.message || 'Failed to send MedReach payouts via Paystack.');
    } finally {
      setPaystackBusy(false);
    }
  }


  useEffect(() => {
    void loadFinance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = data?.summary || {};
  const rows = data?.rows || [];
  const currency = summary.currency || rows[0]?.currency || 'ZAR';

  // A5_G_D_B_MEDREACH_PAYSTACK_TRANSFER_UI_DERIVED_STATE
  const generatedPayoutRows = ((((data as any)?.generatedPayouts || []) as GeneratedPayoutRow[]));
  const generatedPayoutIds = generatedPayoutRows.map((row) => String(row?.id || '')).filter(Boolean);
  const paystackTransferRows = ((((data as any)?.paystackTransferResults || (data as any)?.transferResults || []) as PaystackTransferResultRow[]));
  const paystackSkippedRows = ((((data as any)?.paystackSkippedPayouts || []) as any[]));
  const transferSuccessCount = paystackTransferRows.filter((row) => row?.ok).length;
  const transferFailureCount = paystackTransferRows.filter((row) => row?.ok === false).length;

  const cards = useMemo(
    () => [
      ['Financial records', String(amount(summary.records))],
      ['Ready for settlement', String(amount(summary.readyRecords))],
      ['Needs review', String(amount(summary.needsReviewRecords))],
      ['Gross value', money(summary.grossCents, currency)],
      ['Lab net payable', money(summary.labNetPayableCents, currency)],
      ['Phleb net payable', money(summary.phlebNetPayableCents, currency)],
      ['Platform fees', money(summary.platformFeeCents, currency)],
      ['Logistics fees', money(summary.logisticsFeeCents, currency)],
    ],
    [summary, currency],
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">MedReach finance</p>
              <h1 className="mt-2 text-2xl font-bold text-slate-950">Lab and phleb payout visibility</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Inspect MedReach financial snapshots from completed billing flows, including lab gross, phleb gross,
                logistics, urgent and cold-chain surcharges, platform fees, patient copay, sponsor amount and settlement
                readiness.
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void runSettlementAction(true)}
                  disabled={loading || actionBusy}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Dry-run payout batch
                </button>
                <button
                  type="button"
                  onClick={() => void runSettlementAction(false)}
                  disabled={loading || actionBusy}
                  className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Generate payout batch
                </button>
                <button
                  type="button"
                  onClick={() => void runPaystackBalanceCheck()}
                  disabled={loading || actionBusy || paystackBusy}
                  className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-50"
                >
                  Check Paystack balance
                </button>
                <button
                  type="button"
                  onClick={() => void runPaystackTransferAction()}
                  disabled={loading || actionBusy || paystackBusy || !generatedPayoutIds.length}
                  className="rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                  title={!generatedPayoutIds.length ? 'Generate a payout batch first' : 'Send generated payouts via Paystack'}
                >
                  Send generated payouts via Paystack
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="/admin/medreach/commercial-policy"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Commercial policy
              </a>
              <a
                href="/admin/medreach/onboarding"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Onboarding
              </a>
            </div>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs text-slate-500">{label}</div>
              <div className="mt-2 text-xl font-bold text-slate-950">{value}</div>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-6">
            <label className="text-sm font-medium text-slate-700">
              From
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              To
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Lab ID
              <input
                value={labId}
                onChange={(event) => setLabId(event.target.value)}
                placeholder="optional"
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Phleb ID
              <input
                value={phlebId}
                onChange={(event) => setPhlebId(event.target.value)}
                placeholder="optional"
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Settlement state
              <select
                value={settlementState}
                onChange={(event) => setSettlementState(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
              >
                <option value="">All</option>
                <option value="ready">Ready</option>
                <option value="needs_provider">Needs provider</option>
                <option value="needs_amount">Needs amount</option>
                <option value="needs_net">Needs net</option>
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => void loadFinance()}
                disabled={loading}
                className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {loading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
          </div>

          {notice ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div> : null}
          {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}

          {paystackBalance ? (
            <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-900">
              <div className="font-semibold">Paystack transfer balance</div>
              <div className="mt-1">
                {paystackBalance.currency || currency}: {money(paystackBalance.balanceCents, paystackBalance.currency || currency)}
              </div>
            </div>
          ) : null}

          {paystackTransferRows.length ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <div className="font-semibold">Paystack transfer results</div>
              <div className="mt-1">
                Submitted: {amount(transferSuccessCount)} · Failed: {amount(transferFailureCount)} · Skipped: {amount(paystackSkippedRows.length)}
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {paystackTransferRows.slice(0, 6).map((row, index) => (
                  <div key={row.payoutId || row.reference || index} className="rounded-xl border border-emerald-200 bg-white p-2 text-xs">
                    <div className="font-semibold">{row.reference || row.payoutId || 'Paystack transfer'}</div>
                    <div>Status: {row.paystackStatus || row.payoutStatus || row.status || (row.ok ? 'submitted' : 'failed')}</div>
                    <div>Amount: {money(row.amountCents, row.currency || currency)}</div>
                    {row.error ? <div className="text-rose-700">{row.error}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Lab payable summary</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Lab</th>
                    <th className="px-3 py-2">Orders</th>
                    <th className="px-3 py-2">Gross</th>
                    <th className="px-3 py-2">Platform</th>
                    <th className="px-3 py-2">Provider fee</th>
                    <th className="px-3 py-2">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.labs || []).map((lab) => (
                    <tr key={lab.id} className="border-t border-slate-100">
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-900">{lab.name || lab.id}</div>
                        <div className="text-xs text-slate-500">{lab.status || 'unknown'}</div>
                      </td>
                      <td className="px-3 py-3">{amount(lab.orderCount)}</td>
                      <td className="px-3 py-3">{money(lab.grossCents, currency)}</td>
                      <td className="px-3 py-3">{money(lab.platformFeeCents, currency)}</td>
                      <td className="px-3 py-3">{money(lab.providerFeeCents, currency)}</td>
                      <td className="px-3 py-3 font-semibold">{money(lab.netPayableCents, currency)}</td>
                    </tr>
                  ))}
                  {!(data?.labs || []).length ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                        No lab finance lines in this range.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Phleb payable summary</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Phleb</th>
                    <th className="px-3 py-2">Orders</th>
                    <th className="px-3 py-2">Gross</th>
                    <th className="px-3 py-2">Net</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.phlebs || []).map((phleb) => (
                    <tr key={phleb.id} className="border-t border-slate-100">
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-900">{shortId(phleb.userId || phleb.id)}</div>
                        <div className="text-xs text-slate-500">{shortId(phleb.id)}</div>
                      </td>
                      <td className="px-3 py-3">{amount(phleb.orderCount)}</td>
                      <td className="px-3 py-3">{money(phleb.grossCents, currency)}</td>
                      <td className="px-3 py-3 font-semibold">{money(phleb.netPayableCents, currency)}</td>
                      <td className="px-3 py-3">{phleb.status || 'unknown'}</td>
                    </tr>
                  ))}
                  {!(data?.phlebs || []).length ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                        No phleb finance lines in this range.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Financial snapshots</h2>
              <p className="mt-1 text-sm text-slate-600">
                Source of truth: MedReachOrderFinancial snapshots created by the billing endpoint.
              </p>
            </div>
            <div className="text-sm text-slate-500">{rows.length} record(s)</div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Providers</th>
                  <th className="px-3 py-2">Gross</th>
                  <th className="px-3 py-2">Lab net</th>
                  <th className="px-3 py-2">Phleb net</th>
                  <th className="px-3 py-2">Fees</th>
                  <th className="px-3 py-2">State</th>
                  <th className="px-3 py-2">Phleb fee source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id || row.orderId} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-3">
                      <div className="font-semibold text-slate-900">{shortId(row.orderId)}</div>
                      <div className="text-xs text-slate-500">Draw {shortId(row.drawId)}</div>
                      <div className="text-xs text-slate-400">{row.createdAt ? new Date(row.createdAt).toLocaleString() : ''}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-900">{row.labName || shortId(row.labId)}</div>
                      <div className="text-xs text-slate-500">Phleb {shortId(row.phlebUserId || row.phlebId)}</div>
                    </td>
                    <td className="px-3 py-3">{money(row.totalCents, row.currency || currency)}</td>
                    <td className="px-3 py-3">{money(row.labNetCents, row.currency || currency)}</td>
                    <td className="px-3 py-3">{money(row.phlebNetCents, row.currency || currency)}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      <div>Platform: {money(row.platformFeeCents, row.currency || currency)}</div>
                      <div>Logistics: {money(row.logisticsFeeCents, row.currency || currency)}</div>
                      <div>Urgent: {money(row.urgentSurchargeCents, row.currency || currency)}</div>
                      <div>Cold chain: {money(row.coldChainSurchargeCents, row.currency || currency)}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={'inline-flex rounded-full border px-2 py-1 text-xs font-semibold ' + stateBadge(row.settlementState)}>
                        {row.settlementState || 'unknown'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      <div>{row.pricingSnapshot?.phlebFeeSource || 'policy/default'}</div>
                      <div>{row.pricingSnapshot?.phlebFeeStatus || '—'}</div>
                    </td>
                  </tr>
                ))}

                {!rows.length ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                      No MedReach finance snapshots found for the selected filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
