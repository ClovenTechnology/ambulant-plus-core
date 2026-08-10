'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  Download,
  FileText,
  History,
  Landmark,
  Loader2,
  Palmtree,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { uploadStaffEmploymentDocument } from '@/lib/managed-document-upload';
import { errorText, userFacingApiError, type UserFacingError } from '@/lib/admin-error';

function money(cents: unknown, currency = 'ZAR') {
  const value = Number(cents || 0) / 100;
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function duration(seconds: unknown) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m`;
  return `${value}s`;
}

function formatDate(value: unknown, withTime = false) {
  if (!value) return '—';
  const parsed = new Date(String(value));
  if (!Number.isFinite(parsed.getTime())) return '—';
  return parsed.toLocaleString('en-ZA', withTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' });
}

function ErrorBanner({ error, onRetry }: { error: UserFacingError | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      <div className="font-semibold">We could not complete that action.</div>
      <div className="mt-1">{errorText(error)}</div>
      {error.retryable && onRetry ? <button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-rose-300 bg-white px-3 py-1.5 font-medium">Try again</button> : null}
    </div>
  );
}

export function StaffEmploymentWorkspace({ staffProfileId }: { staffProfileId: string }) {
  const [workspace, setWorkspace] = useState<any>(null);
  const [activity, setActivity] = useState<any>(null);
  const [activityDays, setActivityDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<UserFacingError | null>(null);
  const [notice, setNotice] = useState('');
  const [employment, setEmployment] = useState<any>({});
  const [bank, setBank] = useState<any>({ country: 'ZA', currency: 'ZAR' });
  const [leave, setLeave] = useState<any>({ leaveType: 'ANNUAL', year: new Date().getUTCFullYear(), entitlementDays: 20, usedDays: 0, adjustmentDays: 0 });
  const [change, setChange] = useState<any>({ changeType: 'PROMOTION', effectiveAt: new Date().toISOString().slice(0, 10), salaryAfterZar: '', benefitsText: '', privilegesText: '' });
  const [documentMeta, setDocumentMeta] = useState<any>({ documentType: 'APPOINTMENT_LETTER', title: '', effectiveAt: '' });

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/staff/${encodeURIComponent(staffProfileId)}/employment`, { cache: 'no-store' });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw userFacingApiError({ response, json, fallback: 'Unable to load employment information.' });
      setWorkspace(json);
      const profile = json.payrollProfile || {};
      setEmployment({
        employmentType: profile.employmentType || 'permanent',
        payrollStatus: profile.payrollStatus || 'active',
        startDate: profile.startDate ? String(profile.startDate).slice(0, 10) : '',
        endDate: profile.endDate ? String(profile.endDate).slice(0, 10) : '',
        positionTitle: profile.profileMeta?.positionTitle || '',
        contractType: profile.profileMeta?.contractType || '',
        contractStatus: profile.profileMeta?.contractStatus || '',
        baseSalaryZar: profile.baseSalaryCents != null ? String(Number(profile.baseSalaryCents) / 100) : '',
        hourlyRateZar: profile.hourlyRateCents != null ? String(Number(profile.hourlyRateCents) / 100) : '',
        payFrequency: profile.payFrequency || 'monthly',
        taxNumber: profile.taxNumber || '',
        payrollNumber: profile.payrollNumber || '',
      });
    } catch (err: any) {
      setError(err?.referenceId ? err : { message: err?.message || 'Unable to load employment information.', referenceId: `ADM-${Date.now().toString(36).toUpperCase()}`, retryable: true, code: 'load_failed' });
    } finally {
      setBusy(false);
    }
  }

  async function loadActivity(days = activityDays) {
    if (!staffProfileId) return;
    try {
      const response = await fetch(`/api/admin/staff/${encodeURIComponent(staffProfileId)}/activity?days=${days}`, { cache: 'no-store' });
      const json = await response.json().catch(() => null);
      if (response.ok && json?.ok) setActivity(json);
      else if (response.status !== 403) setError(userFacingApiError({ response, json, fallback: 'Unable to load Staff activity.' }));
    } catch {
      // Employment workspace remains usable if telemetry is temporarily unavailable.
    }
  }

  useEffect(() => {
    void load();
    void loadActivity(30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffProfileId]);

  const permissions = workspace?.permissions || {};
  const payroll = workspace?.payrollProfile;
  const primaryBank = workspace?.bankAccounts?.find((item: any) => item.isPrimary) || workspace?.bankAccounts?.[0] || null;
  const openArrearsCents = useMemo(() => (workspace?.arrears || []).reduce((sum: number, row: any) => sum + Math.max(0, Number(row.debitCents || 0) - Number(row.creditCents || 0)), 0), [workspace?.arrears]);

  async function saveEmployment() {
    setBusy(true); setError(null); setNotice('');
    try {
      const response = await fetch(`/api/admin/staff/${encodeURIComponent(staffProfileId)}/employment`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...employment,
          baseSalaryCents: Math.round(Number(employment.baseSalaryZar || 0) * 100),
          hourlyRateCents: Math.round(Number(employment.hourlyRateZar || 0) * 100),
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw userFacingApiError({ response, json, fallback: 'Unable to save employment details.' });
      setNotice('Employment and compensation details saved.');
      await load();
    } catch (err: any) { setError(err?.referenceId ? err : { message: err?.message || 'Unable to save employment details.', referenceId: `ADM-${Date.now().toString(36).toUpperCase()}`, retryable: true, code: 'save_failed' }); }
    finally { setBusy(false); }
  }

  async function saveBank() {
    setBusy(true); setError(null); setNotice('');
    try {
      const response = await fetch(`/api/admin/staff/${encodeURIComponent(staffProfileId)}/bank`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(bank),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw userFacingApiError({ response, json, fallback: 'Unable to save payout details.' });
      setNotice(json.providerPending ? 'Bank details saved securely. Transfer-recipient verification is pending.' : 'Bank details saved and payout recipient is ready.');
      setBank({ country: 'ZA', currency: 'ZAR' });
      await load();
    } catch (err: any) { setError(err?.referenceId ? err : { message: err?.message || 'Unable to save payout details.', referenceId: `ADM-${Date.now().toString(36).toUpperCase()}`, retryable: true, code: 'bank_failed' }); }
    finally { setBusy(false); }
  }

  async function uploadDocument(file: File | null) {
    if (!file) return;
    setBusy(true); setError(null); setNotice('');
    try {
      await uploadStaffEmploymentDocument({
        file,
        presignUrl: `/api/admin/staff/${encodeURIComponent(staffProfileId)}/documents/presign`,
        confirmUrl: `/api/admin/staff/${encodeURIComponent(staffProfileId)}/documents/confirm`,
        documentType: documentMeta.documentType,
        title: documentMeta.title || file.name,
        effectiveAt: documentMeta.effectiveAt || null,
      });
      setNotice('Employment document issued to this Staff profile.');
      setDocumentMeta({ ...documentMeta, title: '' });
      await load();
    } catch (err: any) {
      const synthetic = { error: err?.message };
      setError(userFacingApiError({ json: synthetic, fallback: err?.message || 'Unable to upload employment document.' }));
    } finally { setBusy(false); }
  }

  async function saveLeave() {
    setBusy(true); setError(null); setNotice('');
    try {
      const response = await fetch(`/api/admin/staff/${encodeURIComponent(staffProfileId)}/leave`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(leave) });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw userFacingApiError({ response, json, fallback: 'Unable to update leave balance.' });
      setNotice('Leave entitlement and usage updated.');
      await load();
    } catch (err: any) { setError(err?.referenceId ? err : userFacingApiError({ json: { error: err?.message }, fallback: 'Unable to update leave balance.' })); }
    finally { setBusy(false); }
  }

  async function saveChange() {
    setBusy(true); setError(null); setNotice('');
    try {
      const response = await fetch(`/api/admin/staff/${encodeURIComponent(staffProfileId)}/employment-changes`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...change,
          salaryAfterCents: change.salaryAfterZar === '' ? undefined : Math.round(Number(change.salaryAfterZar || 0) * 100),
          benefits: String(change.benefitsText || '').split(/\n|,/).map((x) => x.trim()).filter(Boolean),
          privileges: String(change.privilegesText || '').split(/\n|,/).map((x) => x.trim()).filter(Boolean),
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw userFacingApiError({ response, json, fallback: 'Unable to record the employment change.' });
      setNotice('Employment history updated.');
      await load();
    } catch (err: any) { setError(err?.referenceId ? err : userFacingApiError({ json: { error: err?.message }, fallback: 'Unable to record the employment change.' })); }
    finally { setBusy(false); }
  }

  if (!workspace && busy) return <div className="rounded-3xl border bg-white p-6 text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading employment workspace…</div>;
  if (!workspace && error) return <ErrorBanner error={error} onRetry={load} />;
  if (!workspace) return null;

  return (
    <div className="space-y-6">
      <ErrorBanner error={error} onRetry={load} />
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div> : null}

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><BriefcaseBusiness className="h-5 w-5" /><h2 className="text-lg font-semibold">Employment & compensation</h2></div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><div className="text-xs uppercase text-slate-400">Joined / employed since</div><div className="mt-1 font-medium">{formatDate(payroll?.startDate)}</div></div>
          <div><div className="text-xs uppercase text-slate-400">Employment</div><div className="mt-1 font-medium">{payroll?.employmentType || 'Not configured'}</div></div>
          <div><div className="text-xs uppercase text-slate-400">Position</div><div className="mt-1 font-medium">{payroll?.profileMeta?.positionTitle || workspace.staff?.designation?.name || '—'}</div></div>
          {permissions.canReadCompensation ? <div><div className="text-xs uppercase text-slate-400">Base salary</div><div className="mt-1 font-medium">{payroll ? money(payroll.baseSalaryCents, payroll.currency) : 'Not configured'}</div></div> : null}
          {permissions.canReadCompensation ? <div><div className="text-xs uppercase text-slate-400">Pay frequency</div><div className="mt-1 font-medium">{payroll?.payFrequency || '—'}</div></div> : null}
          {permissions.canReadCompensation ? <div><div className="text-xs uppercase text-slate-400">Open salary arrears</div><div className={`mt-1 font-medium ${openArrearsCents ? 'text-rose-700' : 'text-emerald-700'}`}>{money(openArrearsCents, payroll?.currency || 'ZAR')}</div></div> : null}
          <div><div className="text-xs uppercase text-slate-400">Contract</div><div className="mt-1 font-medium">{payroll?.profileMeta?.contractType || '—'}</div></div>
          {permissions.canReadCompensation ? <div><div className="text-xs uppercase text-slate-400">Tax number</div><div className="mt-1 font-medium">{payroll?.taxNumber || '—'}</div></div> : null}
          <div className="sm:col-span-2 lg:col-span-4"><div className="text-xs uppercase text-slate-400">Benefits / privileges</div><div className="mt-1 text-sm text-slate-700">{Array.isArray(payroll?.profileMeta?.benefits) ? payroll.profileMeta.benefits.join(' · ') : payroll?.profileMeta?.benefits ? String(payroll.profileMeta.benefits) : '—'}</div></div>
        </div>
        {permissions.canManageEmployment ? (
          <details className="mt-5 rounded-2xl border p-4">
            <summary className="cursor-pointer font-semibold">Edit employment and payroll profile</summary>
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <input className="rounded-xl border px-3 py-2" placeholder="Position title" value={employment.positionTitle || ''} onChange={(e) => setEmployment({ ...employment, positionTitle: e.target.value })} />
              <select className="rounded-xl border px-3 py-2" value={employment.employmentType || 'permanent'} onChange={(e) => setEmployment({ ...employment, employmentType: e.target.value })}><option value="permanent">Permanent</option><option value="fixed_term">Fixed term</option><option value="part_time">Part time</option><option value="casual">Casual</option><option value="contractor">Contractor</option></select>
              <input type="date" className="rounded-xl border px-3 py-2" value={employment.startDate || ''} onChange={(e) => setEmployment({ ...employment, startDate: e.target.value })} />
              <input className="rounded-xl border px-3 py-2" placeholder="Contract type" value={employment.contractType || ''} onChange={(e) => setEmployment({ ...employment, contractType: e.target.value })} />
              <input className="rounded-xl border px-3 py-2" placeholder="Monthly/base salary (ZAR)" inputMode="decimal" value={employment.baseSalaryZar || ''} onChange={(e) => setEmployment({ ...employment, baseSalaryZar: e.target.value })} />
              <input className="rounded-xl border px-3 py-2" placeholder="Hourly rate (ZAR, if applicable)" inputMode="decimal" value={employment.hourlyRateZar || ''} onChange={(e) => setEmployment({ ...employment, hourlyRateZar: e.target.value })} />
              <select className="rounded-xl border px-3 py-2" value={employment.payFrequency || 'monthly'} onChange={(e) => setEmployment({ ...employment, payFrequency: e.target.value })}><option value="monthly">Monthly</option><option value="fortnightly">Fortnightly</option><option value="weekly">Weekly</option><option value="hourly">Hourly</option></select>
              <input className="rounded-xl border px-3 py-2" placeholder="Tax number" value={employment.taxNumber || ''} onChange={(e) => setEmployment({ ...employment, taxNumber: e.target.value })} />
              <input className="rounded-xl border px-3 py-2" placeholder="Payroll number" value={employment.payrollNumber || ''} onChange={(e) => setEmployment({ ...employment, payrollNumber: e.target.value })} />
            </div>
            <button type="button" disabled={busy} onClick={saveEmployment} className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save employment profile</button>
          </details>
        ) : null}
      </section>

      {permissions.canReadCompensation ? <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><Landmark className="h-5 w-5" /><h2 className="text-lg font-semibold">Banking & payouts</h2></div>
        <p className="mt-1 text-sm text-slate-500">Primary bank details are encrypted at rest. Only masked account numbers are returned to the UI.</p>
        {primaryBank ? <div className="mt-4 grid gap-3 sm:grid-cols-3"><div><div className="text-xs uppercase text-slate-400">Account</div><div className="font-medium">{primaryBank.accountNumberMasked}</div></div><div><div className="text-xs uppercase text-slate-400">Bank</div><div className="font-medium">{primaryBank.bankName || primaryBank.bankCode}</div></div><div><div className="text-xs uppercase text-slate-400">Payout readiness</div><div className="font-medium">{String(primaryBank.verificationStatus || '').replaceAll('_', ' ')}</div></div></div> : <div className="mt-4 rounded-xl border border-dashed p-4 text-sm text-slate-500">No payout bank account has been added.</div>}
        {permissions.canEditBank ? <details className="mt-4 rounded-2xl border p-4"><summary className="cursor-pointer font-semibold">{primaryBank ? 'Replace primary payout account' : 'Add payout account'}</summary><div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3"><input className="rounded-xl border px-3 py-2" placeholder="Account holder name" value={bank.accountHolderName || ''} onChange={(e) => setBank({ ...bank, accountHolderName: e.target.value })}/><input className="rounded-xl border px-3 py-2" placeholder="Bank name" value={bank.bankName || ''} onChange={(e) => setBank({ ...bank, bankName: e.target.value })}/><input className="rounded-xl border px-3 py-2" placeholder="Bank code" value={bank.bankCode || ''} onChange={(e) => setBank({ ...bank, bankCode: e.target.value })}/><input className="rounded-xl border px-3 py-2" placeholder="Branch code (optional)" value={bank.branchCode || ''} onChange={(e) => setBank({ ...bank, branchCode: e.target.value })}/><input className="rounded-xl border px-3 py-2" placeholder="Account number" value={bank.accountNumber || ''} onChange={(e) => setBank({ ...bank, accountNumber: e.target.value })}/><select className="rounded-xl border px-3 py-2" value={bank.accountType || ''} onChange={(e) => setBank({ ...bank, accountType: e.target.value })}><option value="">Account type</option><option value="cheque">Cheque / current</option><option value="savings">Savings</option><option value="transmission">Transmission</option></select></div><button type="button" disabled={busy} onClick={saveBank} className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Save payout details</button></details> : null}
      </section> : null}

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><FileText className="h-5 w-5" /><h2 className="text-lg font-semibold">Employment documents & Staff ID</h2></div>
        <div className="mt-4 space-y-2">{(workspace.documents || []).length ? workspace.documents.map((doc: any) => <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><div className="font-medium">{doc.title}</div><div className="text-xs text-slate-500">{String(doc.documentType).replaceAll('_', ' ')} · {formatDate(doc.createdAt)}</div></div><a href={`/api/admin/staff/${encodeURIComponent(staffProfileId)}/documents/${encodeURIComponent(doc.id)}/download`} className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm"><Download className="h-4 w-4"/>Download</a></div>) : <div className="rounded-xl border border-dashed p-4 text-sm text-slate-500">No appointment letters, contracts or employment documents issued yet.</div>}</div>
        <div className="mt-4 flex flex-wrap gap-2">{workspace.staffId?.downloadUrl ? <a href={workspace.staffId.downloadUrl} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium"><ShieldCheck className="h-4 w-4"/>Download Staff ID</a> : <span className="text-sm text-slate-500">Assign a Staff identifier before generating the Staff ID.</span>}</div>
        {permissions.canUploadDocuments ? <details className="mt-4 rounded-2xl border p-4"><summary className="cursor-pointer font-semibold">Issue a document</summary><div className="mt-4 grid gap-3 md:grid-cols-3"><select className="rounded-xl border px-3 py-2" value={documentMeta.documentType} onChange={(e) => setDocumentMeta({ ...documentMeta, documentType: e.target.value })}><option value="APPOINTMENT_LETTER">Appointment letter</option><option value="EMPLOYMENT_CONTRACT">Employment contract</option><option value="PROMOTION_LETTER">Promotion / salary review letter</option><option value="TAX_DOCUMENT">Tax document</option><option value="OTHER">Other</option></select><input className="rounded-xl border px-3 py-2" placeholder="Document title" value={documentMeta.title} onChange={(e) => setDocumentMeta({ ...documentMeta, title: e.target.value })}/><input type="date" className="rounded-xl border px-3 py-2" value={documentMeta.effectiveAt} onChange={(e) => setDocumentMeta({ ...documentMeta, effectiveAt: e.target.value })}/></div><label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"><Upload className="h-4 w-4"/>Upload PDF/image<input type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" onChange={(e) => { const file=e.currentTarget.files?.[0]||null; e.currentTarget.value=''; void uploadDocument(file); }}/></label></details> : null}
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><Palmtree className="h-5 w-5" /><h2 className="text-lg font-semibold">Leave & career history</h2></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">{(workspace.leaveBalances || []).map((row: any) => <div key={row.id} className="rounded-xl border p-3"><div className="font-medium">{String(row.leaveType).replaceAll('_',' ')} · {row.year}</div><div className="mt-1 text-sm text-slate-600">Entitlement {Number(row.entitlementDays)} days · Used {Number(row.usedDays)} · Adjustment {Number(row.adjustmentDays)}</div></div>)}</div>
        {permissions.canManageLeave ? <details className="mt-4 rounded-2xl border p-4"><summary className="cursor-pointer font-semibold">Update leave balance</summary><div className="mt-4 grid gap-3 md:grid-cols-4"><input className="rounded-xl border px-3 py-2" placeholder="Leave type" value={leave.leaveType} onChange={(e)=>setLeave({...leave,leaveType:e.target.value})}/><input type="number" className="rounded-xl border px-3 py-2" value={leave.year} onChange={(e)=>setLeave({...leave,year:Number(e.target.value)})}/><input type="number" step="0.5" className="rounded-xl border px-3 py-2" placeholder="Entitlement days" value={leave.entitlementDays} onChange={(e)=>setLeave({...leave,entitlementDays:Number(e.target.value)})}/><input type="number" step="0.5" className="rounded-xl border px-3 py-2" placeholder="Used days" value={leave.usedDays} onChange={(e)=>setLeave({...leave,usedDays:Number(e.target.value)})}/></div><button type="button" onClick={saveLeave} className="mt-3 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Save leave balance</button></details> : null}
        <div className="mt-5 space-y-2">{(workspace.employmentChanges || []).length ? workspace.employmentChanges.map((row:any)=><div key={row.id} className="rounded-xl border p-3"><div className="flex flex-wrap justify-between gap-2"><div className="font-medium">{String(row.changeType).replaceAll('_',' ')}</div><div className="text-sm text-slate-500">{formatDate(row.effectiveAt)}</div></div>{row.salaryAfterCents!=null?<div className="mt-1 text-sm">Salary after: {money(row.salaryAfterCents,row.currency)}</div>:null}{row.notes?<div className="mt-1 text-sm text-slate-600">{row.notes}</div>:null}</div>) : <div className="text-sm text-slate-500">No promotion or employment-change history yet.</div>}</div>
        {permissions.canRecordEmploymentChange ? <details className="mt-4 rounded-2xl border p-4"><summary className="cursor-pointer font-semibold">Record promotion, salary review or employment change</summary><div className="mt-4 grid gap-3 md:grid-cols-2"><select className="rounded-xl border px-3 py-2" value={change.changeType} onChange={(e)=>setChange({...change,changeType:e.target.value})}><option value="PROMOTION">Promotion</option><option value="SALARY_REVIEW">Salary review</option><option value="TRANSFER">Department / role transfer</option><option value="BENEFITS_CHANGE">Benefits change</option><option value="CONTRACT_CHANGE">Contract change</option></select><input type="date" className="rounded-xl border px-3 py-2" value={change.effectiveAt} onChange={(e)=>setChange({...change,effectiveAt:e.target.value})}/><input className="rounded-xl border px-3 py-2" placeholder="New salary ZAR (optional)" value={change.salaryAfterZar} onChange={(e)=>setChange({...change,salaryAfterZar:e.target.value})}/><input className="rounded-xl border px-3 py-2" placeholder="Benefits (comma-separated)" value={change.benefitsText} onChange={(e)=>setChange({...change,benefitsText:e.target.value})}/><textarea className="rounded-xl border p-3 md:col-span-2" placeholder="Privileges / responsibilities (comma-separated or one per line)" value={change.privilegesText} onChange={(e)=>setChange({...change,privilegesText:e.target.value})}/><textarea className="rounded-xl border p-3 md:col-span-2" placeholder="Notes" value={change.notes||''} onChange={(e)=>setChange({...change,notes:e.target.value})}/></div><button type="button" onClick={saveChange} className="mt-3 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Record employment change</button></details> : null}
      </section>

      {permissions.canReadCompensation ? <section className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><BadgeDollarSign className="h-5 w-5"/><h2 className="text-lg font-semibold">Payslips & salary arrears</h2></div><div className="mt-4 grid gap-3 lg:grid-cols-2"><div><div className="mb-2 font-medium">Recent payslips</div>{(workspace.payslips||[]).length?(workspace.payslips||[]).slice(0,12).map((row:any)=><div key={row.id} className="mb-2 rounded-xl border p-3 text-sm"><div className="flex justify-between gap-3"><span>{row.payslipNumber||'Payslip'}</span><span className="font-medium">{money(row.netPayCents,row.currency)}</span></div><div className="mt-1 text-xs text-slate-500">{String(row.status).replaceAll('_',' ')} · {formatDate(row.issuedAt||row.createdAt)}</div></div>):<div className="text-sm text-slate-500">No payslips issued yet.</div>}</div><div><div className="mb-2 font-medium">Open arrears</div>{(workspace.arrears||[]).length?(workspace.arrears||[]).map((row:any)=><div key={row.id} className="mb-2 rounded-xl border border-rose-100 bg-rose-50/40 p-3 text-sm"><div className="flex justify-between gap-3"><span>{row.description||'Salary arrears'}</span><span className="font-medium text-rose-700">{money(Math.max(0,Number(row.debitCents||0)-Number(row.creditCents||0)),row.currency)}</span></div><div className="mt-1 text-xs text-slate-500">Due {formatDate(row.dueDate)} · {row.status}</div></div>):<div className="text-sm text-emerald-700">No open salary arrears.</div>}</div></div></section> : null}

      {activity ? <section className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><History className="h-5 w-5"/><h2 className="text-lg font-semibold">Staff activity intelligence</h2></div><select className="rounded-xl border px-3 py-2 text-sm" value={activityDays} onChange={(e)=>{const days=Number(e.target.value);setActivityDays(days);void loadActivity(days);}}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></div><p className="mt-1 text-sm text-slate-500">Active time counts focused, visible Admin activity rather than an unattended browser tab.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><div className="rounded-xl border p-3"><div className="text-xs uppercase text-slate-400">Logins today</div><div className="text-2xl font-semibold">{activity.metrics.loginsToday}</div></div><div className="rounded-xl border p-3"><div className="text-xs uppercase text-slate-400">Active today</div><div className="text-2xl font-semibold">{duration(activity.metrics.activeSecondsToday)}</div></div><div className="rounded-xl border p-3"><div className="text-xs uppercase text-slate-400">Logins in range</div><div className="text-2xl font-semibold">{activity.metrics.totalLogins}</div></div><div className="rounded-xl border p-3"><div className="text-xs uppercase text-slate-400">Active in range</div><div className="text-2xl font-semibold">{duration(activity.metrics.totalActiveSeconds)}</div></div><div className="rounded-xl border p-3"><div className="text-xs uppercase text-slate-400">Avg active / login</div><div className="text-2xl font-semibold">{duration(activity.metrics.averageActiveSecondsPerLogin)}</div></div></div><div className="mt-5 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-400"><th className="py-2">Top page</th><th>Visits</th><th>Active time</th><th>Average / visit</th></tr></thead><tbody>{(activity.metrics.topPages||[]).map((row:any)=><tr key={row.path} className="border-b last:border-0"><td className="py-2 font-medium">{row.path}</td><td>{row.visits}</td><td>{duration(row.activeSeconds)}</td><td>{duration(row.averageSecondsPerVisit)}</td></tr>)}</tbody></table></div><details className="mt-4 rounded-xl border p-3"><summary className="cursor-pointer font-medium">Login sessions</summary><div className="mt-3 space-y-2">{(activity.sessions||[]).slice(0,30).map((row:any)=><div key={row.id} className="grid gap-1 rounded-lg bg-slate-50 p-3 text-sm md:grid-cols-4"><span>{formatDate(row.loginAt,true)}</span><span>{duration(row.activeSeconds)} active</span><span>{duration(row.wallSeconds)} session</span><span>{row.lastPath||'—'}</span></div>)}</div></details></section> : null}
    </div>
  );
}
