'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  Clock3,
  FileDown,
  FileText,
  History,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { uploadManagedFinanceDocument } from '@/lib/managed-finance-document-upload';

type Row = Record<string, any>;

type SettlementForm = {
  payslipId: string;
  amount: string;
  paymentMethod: string;
  paymentReference: string;
  settledAt: string;
  note: string;
};

const money = (cents: any) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format((Number(cents) || 0) / 100);
const day = (value: any) =>
  value ? new Date(value).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: '2-digit' }) : '—';
const dateTime = (value: any) =>
  value ? new Date(value).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100';
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40';
const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40';

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    cache: 'no-store',
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    const error: any = new Error(payload?.error || `Request failed (${response.status})`);
    error.payload = payload;
    throw error;
  }
  return payload;
}

function friendlyError(error: any) {
  const key = String(error?.message || 'Request failed');
  const payload = error?.payload || {};
  const map: Record<string, string> = {
    settlement_amount_must_be_greater_than_zero: 'Settlement amount must be greater than R0.00.',
    settlement_amount_exceeds_remaining_balance: `Settlement amount cannot exceed the remaining balance${payload.remainingCents != null ? ` of ${money(payload.remainingCents)}` : ''}.`,
    payment_reference_required: 'Enter a bank, transfer, card, cash receipt or internal transaction reference.',
    valid_payment_method_required: 'Choose a valid payment method.',
    valid_settlement_timestamp_required: 'Enter a valid settlement date and time that is not in the future.',
    payment_batch_and_reversal_reason_required: 'A reversal reason is required.',
    payroll_payment_batch_not_found: 'The selected settlement batch could not be found.',
    payroll_cash_allocation_invariant_failed: 'Settlement was blocked because the cash allocation did not balance. No partial write was committed.',
    payroll_non_cash_settlement_invariant_failed: 'Settlement was blocked because source-balance closeout exceeded the payslip deductions/withholding authority. No partial write was committed.',
  };
  if (map[key]) return map[key];
  if (key.startsWith('payroll_cash_allocation_invariant_failed:')) return map.payroll_cash_allocation_invariant_failed;
  if (key.startsWith('payroll_non_cash_settlement_invariant_failed:')) return map.payroll_non_cash_settlement_invariant_failed;
  return key.replaceAll('_', ' ');
}

function localDateTimeValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function statusPill(status: unknown) {
  const value = String(status || 'draft').toLowerCase();
  const cls = value === 'paid'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : value === 'partial'
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : value === 'reversed'
        ? 'bg-rose-50 text-rose-700 border-rose-200'
        : 'bg-slate-100 text-slate-700 border-slate-200';
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${cls}`}>{value}</span>;
}

export default function PayrollPage() {
  const [q, setQ] = useState('');
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [history, setHistory] = useState<Row | null>(null);
  const [payout, setPayout] = useState<Row | null>(null);
  const [selectedEntitlements, setSelectedEntitlements] = useState<string[]>([]);
  const [legacyPartial, setLegacyPartial] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState<File | null>(null);
  const [newWorker, setNewWorker] = useState({
    displayName: '', email: '', engagementType: 'CASUAL', startDate: '', baseSalary: '',
  });
  const [composer, setComposer] = useState({
    bonus: '', otherEarnings: '', deduction: '', tax: '', uif: '', pension: '', employerNote: '',
  });
  const [settlement, setSettlement] = useState<SettlementForm>({
    payslipId: '', amount: '', paymentMethod: 'bank_transfer', paymentReference: '', settledAt: localDateTimeValue(), note: '',
  });

  const selected = profiles.find((row) => row.id === selectedId) || null;
  const entitlements: Row[] = history?.entitlements || [];
  const compensation: Row[] = history?.compensationHistory || [];
  const payslips: Row[] = payout?.payslips || [];
  const paymentBatches: Row[] = payout?.paymentBatches || [];
  const latestEntitlement = entitlements.length ? entitlements[entitlements.length - 1] : null;
  const outstanding = useMemo(
    () => entitlements.reduce((sum, row) => sum + (Number(row.remainingCents) || 0), 0),
    [entitlements],
  );

  const loadProfiles = useCallback(async () => {
    try {
      const payload = await api('/api/enterprise-finance/staff-payroll/profiles?limit=500&q=' + encodeURIComponent(q));
      const items = payload.items || [];
      setProfiles(items);
      if (!selectedId && items.length) setSelectedId(items[0].id);
    } catch (err: any) {
      setError(friendlyError(err));
    }
  }, [q, selectedId]);

  const loadHistory = useCallback(async (id: string) => {
    if (!id) {
      setHistory(null);
      return;
    }
    try {
      const payload = await api('/api/enterprise-finance/staff-payroll/history?payrollProfileId=' + encodeURIComponent(id));
      setHistory(payload);
      setSelectedEntitlements([]);
    } catch (err: any) {
      if (String(err?.message).includes('not_found')) setHistory(null);
      else setError(friendlyError(err));
    }
  }, []);

  const loadPayout = useCallback(async (id: string) => {
    if (!id) {
      setPayout(null);
      return;
    }
    try {
      setPayout(await api('/api/enterprise-finance/staff-payroll/payout?payrollProfileId=' + encodeURIComponent(id)));
    } catch (err: any) {
      setError(friendlyError(err));
    }
  }, []);

  useEffect(() => { void loadProfiles(); }, [loadProfiles]);
  useEffect(() => {
    void loadHistory(selectedId);
    void loadPayout(selectedId);
  }, [selectedId, loadHistory, loadPayout]);

  async function refreshSelected() {
    await Promise.all([loadHistory(selectedId), loadPayout(selectedId), loadProfiles()]);
  }

  async function historyMutation(body: Row, success: string) {
    setBusy(true); setError(''); setMessage('');
    try {
      const payload = await api('/api/enterprise-finance/staff-payroll/history', { method: 'POST', body: JSON.stringify(body) });
      setHistory(payload);
      setSelectedEntitlements([]);
      setMessage(success);
    } catch (err: any) {
      setError(friendlyError(err));
    } finally { setBusy(false); }
  }

  async function rebuild() {
    if (!selectedId) return;
    await historyMutation(
      { action: 'rebuild', payrollProfileId: selectedId },
      'Payroll entitlement history rebuilt from employment inception.',
    );
    await loadPayout(selectedId);
  }

  async function reconcileLegacy(state: string) {
    if (!selectedId || !selectedEntitlements.length) return;
    const settlements = state === 'PARTIALLY_SETTLED'
      ? selectedEntitlements.map((id) => ({
          entitlementId: id,
          amountHistoricallySettledCents: Math.round(Number(legacyPartial[id] || 0) * 100),
        }))
      : undefined;
    await historyMutation({
      action: 'reconcile', payrollProfileId: selectedId, entitlementIds: selectedEntitlements,
      settlementState: state, settlements, lock: true, reference: 'Legacy payroll reconciliation',
    }, 'Legacy reconciliation saved and locked for audit.');
  }

  async function createWorker() {
    setBusy(true); setError(''); setMessage('');
    try {
      await api('/api/enterprise-finance/staff-payroll/profiles', {
        method: 'POST',
        body: JSON.stringify({
          staffDisplayName: newWorker.displayName,
          staffEmail: newWorker.email || null,
          engagementType: newWorker.engagementType,
          employmentType: newWorker.engagementType,
          startDate: newWorker.startDate,
          baseSalaryCents: Math.round(Number(newWorker.baseSalary || 0) * 100),
          payFrequency: 'monthly', payrollStatus: 'active', approvalStatus: 'approved',
        }),
      });
      setNewWorker({ displayName: '', email: '', engagementType: 'CASUAL', startDate: '', baseSalary: '' });
      await loadProfiles();
      setMessage('Workforce payee created without granting an Admin login.');
    } catch (err: any) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  }

  async function preparePayslip() {
    if (!selectedId || !latestEntitlement) return;
    const arrearsIds = selectedEntitlements.filter((id) => id !== latestEntitlement.id);
    const awards = (payout?.commissions || [])
      .filter((row: Row) => ['APPROVED', 'approved'].includes(String(row.status)))
      .map((row: Row) => row.id);

    setBusy(true); setError(''); setMessage('');
    try {
      const payload = await api('/api/enterprise-finance/staff-payroll/payout', {
        method: 'POST',
        body: JSON.stringify({
          action: 'prepare_payslip', payrollProfileId: selectedId,
          payrollPeriodId: latestEntitlement.payrollPeriodId,
          arrearsEntitlementIds: arrearsIds, commissionAwardIds: awards,
          bonusCents: Math.round(Number(composer.bonus || 0) * 100),
          otherEarningsCents: Math.round(Number(composer.otherEarnings || 0) * 100),
          deductionCents: Math.round(Number(composer.deduction || 0) * 100),
          taxWithholdingCents: Math.round(Number(composer.tax || 0) * 100),
          uifCents: Math.round(Number(composer.uif || 0) * 100),
          pensionCents: Math.round(Number(composer.pension || 0) * 100),
          employerNote: composer.employerNote,
        }),
      });
      setMessage(`System-generated payslip ${payload.payslip?.payslipNumber || ''} prepared for ${money(payload.payslip?.netPayCents)}.`);
      await loadPayout(selectedId);
    } catch (err: any) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  }

  function beginSettlement(slip: Row) {
    setProof(null);
    setSettlement({
      payslipId: slip.id,
      amount: (Number(slip.unpaidBalanceCents || 0) / 100).toFixed(2),
      paymentMethod: 'bank_transfer', paymentReference: '', settledAt: localDateTimeValue(), note: '',
    });
    window.setTimeout(() => document.getElementById('settlement-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  }

  async function recordSettlement() {
    const slip = payslips.find((row) => row.id === settlement.payslipId);
    if (!slip) return;
    const amountCents = Math.round(Number(settlement.amount || 0) * 100);
    if (amountCents <= 0) { setError('Settlement amount must be greater than R0.00.'); return; }
    if (amountCents > Number(slip.unpaidBalanceCents || 0)) { setError(`Settlement amount cannot exceed ${money(slip.unpaidBalanceCents)}.`); return; }
    if (!settlement.paymentReference.trim()) { setError('A payment/transaction reference is required.'); return; }

    setBusy(true); setError(''); setMessage('');
    try {
      let objectKey: string | null = null;
      if (proof) {
        const uploaded = await uploadManagedFinanceDocument({ file: proof, purpose: 'proof-of-payment' });
        objectKey = uploaded.objectKey;
      }
      const payload = await api('/api/enterprise-finance/staff-payroll/payout', {
        method: 'POST',
        body: JSON.stringify({
          action: 'record_payslip_settlement', payslipId: slip.id, amountCents,
          paymentMethod: settlement.paymentMethod, paymentReference: settlement.paymentReference,
          settledAt: new Date(settlement.settledAt).toISOString(), note: settlement.note,
          proofOfPaymentObjectKey: objectKey,
        }),
      });
      setMessage(`Settlement recorded. Remaining payslip balance: ${money(payload.payslip?.unpaidBalanceCents)}.`);
      setSettlement({ payslipId: '', amount: '', paymentMethod: 'bank_transfer', paymentReference: '', settledAt: localDateTimeValue(), note: '' });
      setProof(null);
      await refreshSelected();
    } catch (err: any) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  }

  async function reverseBatch(batch: Row) {
    const reason = window.prompt('Reason for reversing this settlement? This creates an auditable reversal and does not delete history.');
    if (!reason?.trim()) return;
    if (!window.confirm(`Reverse settlement ${batch.manualReference || batch.id}?`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await api('/api/enterprise-finance/staff-payroll/payout', {
        method: 'POST',
        body: JSON.stringify({ action: 'reverse_payslip_settlement', paymentBatchId: batch.id, reason }),
      });
      setMessage('Settlement reversed. Payslip and underlying payroll balances were restored with an audit trail.');
      await refreshSelected();
    } catch (err: any) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  }

  function printPayslip(slip: Row) {
    const rows = (slip.lineItems || []).map((line: Row) => `
      <tr><td>${escapeHtml(line.label)}</td><td>${escapeHtml(line.description || '')}</td><td class="money">${escapeHtml(money(line.amountCents))}</td></tr>
    `).join('');
    const paid = Math.max(0, Number(slip.netPayCents || 0) - Number(slip.unpaidBalanceCents || 0));
    const win = window.open('', '_blank', 'width=920,height=900');
    if (!win) { setError('The browser blocked the payslip window. Allow pop-ups for this Admin site and retry.'); return; }
    try { win.opener = null; } catch {}
    win.document.write(`<!doctype html><html><head><title>${escapeHtml(slip.payslipNumber || 'Ambulant+ payslip')}</title><style>
      @page{size:A4;margin:18mm}body{font-family:Inter,Arial,sans-serif;color:#0f172a;margin:0}.top{border-bottom:3px solid #0f172a;padding-bottom:18px;display:flex;justify-content:space-between}.brand{font-size:22px;font-weight:800}.muted{color:#64748b;font-size:12px}.title{font-size:28px;font-weight:900;margin:26px 0 6px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:22px 0}.box{border:1px solid #e2e8f0;border-radius:12px;padding:12px}.label{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#64748b}.value{font-weight:750;margin-top:5px}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border-bottom:1px solid #e2e8f0;padding:10px 6px;text-align:left;font-size:12px}th{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#64748b}.money{text-align:right;font-variant-numeric:tabular-nums}.summary{margin-left:auto;width:310px;margin-top:20px}.sumrow{display:flex;justify-content:space-between;padding:7px 0}.net{font-weight:900;font-size:18px;border-top:2px solid #0f172a;margin-top:5px;padding-top:10px}.footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:10px;color:#64748b}.pill{display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:5px 9px;font-size:10px;text-transform:uppercase;font-weight:700}@media print{.no-print{display:none}}
    </style></head><body>
      <div class="top"><div><div class="brand">Ambulant+</div><div class="muted">Enterprise Finance · System-generated payroll document</div></div><div style="text-align:right"><div class="pill">${escapeHtml(slip.status)}</div><div class="muted" style="margin-top:7px">Generated ${escapeHtml(dateTime(slip.issuedAt || slip.createdAt))}</div></div></div>
      <div class="title">Payslip</div><div class="muted">${escapeHtml(slip.payslipNumber || slip.id)}</div>
      <div class="grid"><div class="box"><div class="label">Workforce member</div><div class="value">${escapeHtml(selected?.staffName || slip.staffUserId)}</div><div class="muted">${escapeHtml(selected?.staffIdentifier || selected?.staffEmail || '')}</div></div><div class="box"><div class="label">Payroll status</div><div class="value">${escapeHtml(String(slip.status || '').toUpperCase())}</div><div class="muted">Currency ${escapeHtml(slip.currency || 'ZAR')}</div></div></div>
      <table><thead><tr><th>Component</th><th>Description</th><th class="money">Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="summary"><div class="sumrow"><span>Net payable</span><strong>${escapeHtml(money(slip.netPayCents))}</strong></div><div class="sumrow"><span>Settled</span><strong>${escapeHtml(money(paid))}</strong></div><div class="sumrow net"><span>Outstanding</span><span>${escapeHtml(money(slip.unpaidBalanceCents))}</span></div></div>
      ${slip.employerNote ? `<div class="box" style="margin-top:24px"><div class="label">Employer note</div><div style="margin-top:7px;font-size:12px">${escapeHtml(slip.employerNote)}</div></div>` : ''}
      <div class="footer">Generated from Ambulant+ payroll authority. Supporting payment evidence is stored separately from this system-generated payslip.</div>
      <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),180));<\/script>
    </body></html>`);
    win.document.close();
  }

  const activeSlip = payslips.find((row) => row.id === settlement.payslipId) || null;

  return (
    <main className="mx-auto max-w-[1540px] space-y-6 pb-12">
      <header className="rounded-[28px] border border-slate-800 bg-slate-950 px-6 py-6 text-white shadow-lg lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Enterprise Finance · Payroll authority</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight lg:text-4xl">Payroll, payslips & settlement</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">Reconstruct entitlement history, preserve legacy reconciliation, generate canonical payslips and record partial or full cash settlement with immutable payment evidence.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">System-generated payslips</span>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-emerald-200">Auditable settlements</span>
          </div>
        </div>
      </header>

      {message ? <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><CheckCircle2 className="h-4 w-4" />{message}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"><strong>Action blocked.</strong> {error}</div> : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(240px,0.75fr)_minmax(420px,1.6fr)_auto]">
          <input className={input} placeholder="Search name, email, Staff ID or payroll no." value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={input} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            <option value="">Select staff / workforce payee</option>
            {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.staffName} · {profile.engagementType} · {profile.hasAdminLogin ? 'Admin-linked' : 'payee only'}</option>)}
          </select>
          <button className={secondaryButton} onClick={() => void refreshSelected()} disabled={!selectedId || busy}><RefreshCw className="h-4 w-4" />Refresh</button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><UserRoundCheckIcon /><div><h2 className="font-extrabold text-slate-950">Add workforce payee</h2><p className="text-xs text-slate-500">Creates payroll/workforce identity only; it does not grant an Admin login.</p></div></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input className={input} placeholder="Full name" value={newWorker.displayName} onChange={(e) => setNewWorker({ ...newWorker, displayName: e.target.value })} />
          <input className={input} placeholder="Email (optional)" value={newWorker.email} onChange={(e) => setNewWorker({ ...newWorker, email: e.target.value })} />
          <select className={input} value={newWorker.engagementType} onChange={(e) => setNewWorker({ ...newWorker, engagementType: e.target.value })}>{['TEMPORARY','CASUAL','CONTRACTOR','INTERN','COMMISSION_ONLY','FIXED_TERM','PERMANENT'].map((value) => <option key={value}>{value}</option>)}</select>
          <input className={input} type="date" value={newWorker.startDate} onChange={(e) => setNewWorker({ ...newWorker, startDate: e.target.value })} />
          <input className={input} type="number" min="0" step="0.01" placeholder="Monthly salary R" value={newWorker.baseSalary} onChange={(e) => setNewWorker({ ...newWorker, baseSalary: e.target.value })} />
        </div>
        <button className={`${primaryButton} mt-3`} disabled={busy || !newWorker.displayName || !newWorker.startDate} onClick={() => void createWorker()}>Create workforce payee</button>
      </section>

      {selected ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ['Workforce', selected.staffName], ['Engagement', selected.engagementType], ['Current base', money(selected.baseSalaryCents)],
            ['Historical outstanding', money(outstanding)], ['Bank status', selected.bankStatus || 'not configured'],
          ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</div><div className="mt-1.5 text-lg font-black text-slate-950">{value}</div></div>)}
        </section>
      ) : null}

      {selected ? (
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-extrabold text-slate-950">Effective-dated compensation & monthly entitlements</h2><p className="text-xs text-slate-500">Legacy reconciliation is separate from live payout settlement. Locked history is never silently rewritten.</p></div><button className={primaryButton} onClick={() => void rebuild()} disabled={busy}><History className="h-4 w-4" />Rebuild from employment inception</button></div>
          <div className="p-5">
            {compensation.length ? <div className="mb-4 flex flex-wrap gap-2">{compensation.map((row) => <div key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"><strong>{day(row.effectiveFrom)}</strong>{row.effectiveTo ? ` → ${day(row.effectiveTo)}` : ' → present'} · {money(row.baseSalaryCents || row.salaryRateCents)} / month</div>)}</div> : null}
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-[1080px] w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.1em] text-slate-500"><tr><th className="p-3"></th><th className="p-3">Period</th><th className="p-3">Gross</th><th className="p-3">Legacy settled</th><th className="p-3">Paid later</th><th className="p-3">Remaining</th><th className="p-3">State</th><th className="p-3">Legacy partial amount</th><th className="p-3">Lock</th></tr></thead>
                <tbody>{entitlements.map((row) => {
                  const checked = selectedEntitlements.includes(row.id);
                  return <tr key={row.id} className="border-t border-slate-100 align-top"><td className="p-3"><input type="checkbox" checked={checked} onChange={(e) => setSelectedEntitlements((current) => e.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))} /></td><td className="p-3 font-semibold">{day(row.periodStartsAt)} – {day(row.periodEndsAt)}</td><td className="p-3">{money(row.grossEntitlementCents)}</td><td className="p-3">{money(row.amountHistoricallySettledCents)}</td><td className="p-3">{money(row.postReconciliationPaidCents)}</td><td className="p-3 font-bold">{money(row.remainingCents)}</td><td className="p-3">{String(row.settlementState || 'UNPAID').replaceAll('_',' ')}</td><td className="p-3"><input className="w-28 rounded-lg border border-slate-200 px-2 py-1.5" type="number" min="0" step="0.01" placeholder="R0.00" value={legacyPartial[row.id] || ''} onChange={(e) => setLegacyPartial({ ...legacyPartial, [row.id]: e.target.value })} /></td><td className="p-3">{row.lockedAt ? 'Locked' : 'Open'}</td></tr>;
                })}</tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap gap-2"><button className={secondaryButton} disabled={busy || !selectedEntitlements.length} onClick={() => void reconcileLegacy('FULLY_SETTLED')}>Lock selected legacy settled</button><button className={secondaryButton} disabled={busy || !selectedEntitlements.length} onClick={() => void reconcileLegacy('UNPAID')}>Lock selected legacy unpaid</button><button className={secondaryButton} disabled={busy || !selectedEntitlements.length} onClick={() => void reconcileLegacy('PARTIALLY_SETTLED')}>Lock selected legacy partial</button></div>
          </div>
        </section>
      ) : null}

      {selected ? (
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-950 text-white"><FileText className="h-5 w-5" /></div><div><h2 className="text-lg font-extrabold text-slate-950">System-generated payslip composer</h2><p className="text-xs text-slate-500">The payslip is generated from payroll authority. File uploads below are payment evidence only, never the payslip source.</p></div></div></div>
          <div className="grid gap-5 p-5 xl:grid-cols-[1fr_1.25fr]">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{[
                ['Bonus / incentive', 'bonus'], ['Other earnings', 'otherEarnings'], ['Deductions / recoveries', 'deduction'], ['Tax withholding', 'tax'], ['UIF', 'uif'], ['Pension', 'pension'],
              ].map(([label, key]) => <label key={key} className="text-xs font-semibold text-slate-600">{label}<input className={`${input} mt-1`} type="number" min="0" step="0.01" placeholder="R0.00" value={(composer as any)[key]} onChange={(e) => setComposer({ ...composer, [key]: e.target.value })} /></label>)}</div>
              <label className="block text-xs font-semibold text-slate-600">Employer note<textarea className={`${input} mt-1 min-h-24`} value={composer.employerNote} onChange={(e) => setComposer({ ...composer, employerNote: e.target.value })} placeholder="Optional note printed on the payslip" /></label>
              <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-600"><strong className="text-slate-950">Included automatically:</strong> current salary entitlement, selected historical arrears and approved commissions scheduled into payroll.</div>
              <button className={primaryButton} disabled={busy || !latestEntitlement} onClick={() => void preparePayslip()}><FileText className="h-4 w-4" />Generate payslip</button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between"><h3 className="font-bold text-slate-950">Payslip register</h3><span className="text-xs text-slate-500">{payslips.length} generated</span></div>
              {payslips.length ? payslips.map((slip) => {
                const paid = Math.max(0, Number(slip.netPayCents || 0) - Number(slip.unpaidBalanceCents || 0));
                return <div key={slip.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><div className="font-extrabold text-slate-950">{slip.payslipNumber || 'Payslip'}</div>{statusPill(slip.status)}</div><div className="mt-1 text-xs text-slate-500">Issued {dateTime(slip.issuedAt || slip.createdAt)} · Net {money(slip.netPayCents)}</div></div><div className="flex flex-wrap gap-2"><button className={secondaryButton} onClick={() => printPayslip(slip)}><FileDown className="h-4 w-4" />Print / Save PDF</button>{Number(slip.unpaidBalanceCents || 0) > 0 ? <button className={primaryButton} onClick={() => beginSettlement(slip)}><WalletCards className="h-4 w-4" />Record settlement</button> : null}</div></div><div className="mt-3 grid grid-cols-3 gap-2"><div className="rounded-xl bg-slate-50 p-2"><div className="text-[10px] uppercase text-slate-500">Net</div><div className="font-bold">{money(slip.netPayCents)}</div></div><div className="rounded-xl bg-emerald-50 p-2"><div className="text-[10px] uppercase text-emerald-700">Settled</div><div className="font-bold text-emerald-900">{money(paid)}</div></div><div className="rounded-xl bg-amber-50 p-2"><div className="text-[10px] uppercase text-amber-700">Outstanding</div><div className="font-bold text-amber-950">{money(slip.unpaidBalanceCents)}</div></div></div></div>;
              }) : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">No payslip has been generated for this workforce member yet.</div>}
            </div>
          </div>
        </section>
      ) : null}

      {activeSlip ? (
        <section id="settlement-panel" className="rounded-3xl border border-slate-300 bg-slate-950 p-5 text-white shadow-xl">
          <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Payment settlement</div><h2 className="mt-1 text-xl font-black">{activeSlip.payslipNumber} · {money(activeSlip.unpaidBalanceCents)} outstanding</h2></div><button className="rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/10" onClick={() => setSettlement({ ...settlement, payslipId: '' })}>Close</button></div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3"><label className="text-xs font-semibold text-slate-300">Amount settled (ZAR)<input className={`${input} mt-1`} type="number" min="0.01" max={Number(activeSlip.unpaidBalanceCents || 0) / 100} step="0.01" value={settlement.amount} onChange={(e) => setSettlement({ ...settlement, amount: e.target.value })} /></label><label className="text-xs font-semibold text-slate-300">Payment method<select className={`${input} mt-1`} value={settlement.paymentMethod} onChange={(e) => setSettlement({ ...settlement, paymentMethod: e.target.value })}><option value="bank_transfer">Bank transfer</option><option value="eft">EFT</option><option value="paystack">Paystack</option><option value="card">Card</option><option value="cash">Cash</option><option value="internal_adjustment">Internal adjustment</option><option value="manual">Manual</option><option value="other">Other</option></select></label><label className="text-xs font-semibold text-slate-300">Settlement timestamp<input className={`${input} mt-1`} type="datetime-local" value={settlement.settledAt} onChange={(e) => setSettlement({ ...settlement, settledAt: e.target.value })} /></label><label className="text-xs font-semibold text-slate-300 lg:col-span-2">Payment / bank reference<input className={`${input} mt-1`} value={settlement.paymentReference} onChange={(e) => setSettlement({ ...settlement, paymentReference: e.target.value })} placeholder="Required transaction reference" /></label><label className="text-xs font-semibold text-slate-300">Proof of payment <span className="font-normal text-slate-500">(optional)</span><input className="mt-1 block w-full rounded-xl border border-white/15 bg-white p-2 text-xs text-slate-700" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setProof(e.target.files?.[0] || null)} /></label><label className="text-xs font-semibold text-slate-300 lg:col-span-3">Settlement note<textarea className={`${input} mt-1 min-h-20`} value={settlement.note} onChange={(e) => setSettlement({ ...settlement, note: e.target.value })} placeholder="Optional reconciliation note" /></label></div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="text-xs text-slate-400">Outstanding after this settlement: <strong className="text-white">{money(Math.max(0, Number(activeSlip.unpaidBalanceCents || 0) - Math.round(Number(settlement.amount || 0) * 100)))}</strong></div><button className="rounded-xl bg-white px-5 py-2.5 text-sm font-black text-slate-950 hover:bg-slate-100 disabled:opacity-40" disabled={busy} onClick={() => void recordSettlement()}><Banknote className="mr-2 inline h-4 w-4" />Record auditable settlement</button></div>
        </section>
      ) : null}

      {selected ? (
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 p-5"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100"><Clock3 className="h-5 w-5 text-slate-700" /></div><div><h2 className="text-lg font-extrabold text-slate-950">Settlement audit trail</h2><p className="text-xs text-slate-500">Every recorded settlement remains visible. Corrections are reversal events, never destructive edits.</p></div></div>
          <div className="p-5">{paymentBatches.length ? <div className="space-y-2">{paymentBatches.map((batch) => <div key={batch.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><strong>{batch.manualReference || batch.label}</strong>{statusPill(batch.status)}</div><div className="mt-1 text-xs text-slate-500">{money(batch.totalAmountCents)} · {String(batch.paymentMethod || 'manual').replaceAll('_',' ')} · {dateTime(batch.completedAt || batch.createdAt)}</div></div>{String(batch.status).toLowerCase() !== 'reversed' ? <button className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100" disabled={busy} onClick={() => void reverseBatch(batch)}><RotateCcw className="h-3.5 w-3.5" />Reverse</button> : null}</div>)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">No live payroll settlement events recorded yet.</div>}</div>
        </section>
      ) : null}

      <div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4" />Payslip generation, payment settlement and reversals are protected by Enterprise Finance authority and audit events.</div>
    </main>
  );
}

function UserRoundCheckIcon() {
  return <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100"><Banknote className="h-5 w-5 text-slate-700" /></div>;
}
