'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, RefreshCw, Search, UserRound } from 'lucide-react';
import {
  APPLICATION_STATUSES,
  STATUS_LABELS,
  formatApplicationDate,
  humanizeApplicationError,
  type AdminApplicationListItem,
  type ApplicationStatus,
} from './application-ui';

export const dynamic = 'force-dynamic';

type ListPayload = {
  ok: boolean;
  total?: number;
  actorProfileId?: string;
  items?: AdminApplicationListItem[];
  opportunities?: Array<{ id: string; title: string; key: string }>;
  error?: string;
};

export default function AdminApplicationsPage() {
  const [items, setItems] = useState<AdminApplicationListItem[]>([]);
  const [opportunities, setOpportunities] = useState<Array<{ id: string; title: string; key: string }>>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [opportunityId, setOpportunityId] = useState('');
  const [mine, setMine] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams({ pageSize: '100' });
    if (q.trim()) params.set('q', q.trim());
    if (status) params.set('status', status);
    if (opportunityId) params.set('opportunityId', opportunityId);
    if (mine) params.set('mine', '1');
    return params.toString();
  }, [q, status, opportunityId, mine]);

  async function load() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/applications?${query}`, { cache: 'no-store' });
      const json = (await response.json().catch(() => null)) as ListPayload | null;
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || 'application_list_failed');
      }
      setItems(Array.isArray(json.items) ? json.items : []);
      setOpportunities(Array.isArray(json.opportunities) ? json.opportunities : []);
    } catch (err: any) {
      setError(humanizeApplicationError(err?.message));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 120);
    return () => window.clearTimeout(timer);
  }, [query]);

  const counts = useMemo(() => {
    const result = Object.fromEntries(APPLICATION_STATUSES.map((value) => [value, 0])) as Record<ApplicationStatus, number>;
    for (const item of items) result[item.status] += 1;
    return result;
  }, [items]);

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Applications & Opportunities</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Applications</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Review submitted applications, assign reviewers and progress candidates through the recruitment process.
          </p>
        </div>
        <button type="button" onClick={load} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm">
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {(['SUBMITTED','UNDER_REVIEW','SHORTLISTED','DOCUMENTS_REQUESTED','INTERVIEW_INVITED','DECLINED','ONBOARDING'] as ApplicationStatus[]).map((value) => (
          <button key={value} type="button" onClick={() => setStatus(status === value ? '' : value)} className={`rounded-2xl border p-4 text-left transition ${status === value ? 'border-slate-950 bg-slate-950 text-white' : 'bg-white'}`}>
            <div className="text-2xl font-semibold">{counts[value]}</div>
            <div className={`mt-1 text-xs ${status === value ? 'text-white/70' : 'text-slate-500'}`}>{STATUS_LABELS[value]}</div>
          </button>
        ))}
      </section>

      <section className="grid gap-3 rounded-3xl border bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_260px_auto]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search reference, applicant or opportunity" className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm" />
        </label>
        <select value={opportunityId} onChange={(event) => setOpportunityId(event.target.value)} className="rounded-xl border px-3 py-2 text-sm">
          <option value="">All opportunities</option>
          {opportunities.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
        <label className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
          <input type="checkbox" checked={mine} onChange={(event) => setMine(event.target.checked)} /> Assigned to me
        </label>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Application</th><th className="px-4 py-3">Applicant</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Reviewer</th><th className="px-4 py-3">Submitted</th></tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-4">
                    <Link href={`/admin/applications/${encodeURIComponent(item.id)}`} className="font-semibold text-slate-950 hover:underline">{item.referenceCode}</Link>
                    <div className="mt-1 max-w-sm truncate text-xs text-slate-500">{item.opportunity.title}</div>
                  </td>
                  <td className="px-4 py-4 text-slate-700">{item.applicantEmailNormalized || 'Email not supplied'}</td>
                  <td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium">{STATUS_LABELS[item.status]}</span></td>
                  <td className="px-4 py-4 text-slate-700">{item.assignedReviewer?.name || item.assignedReviewer?.email || 'Unassigned'}</td>
                  <td className="px-4 py-4 text-slate-500">{formatApplicationDate(item.submittedAt)}</td>
                </tr>
              ))}
              {!busy && items.length === 0 ? <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500"><ClipboardCheck className="mx-auto mb-3 h-6 w-6" />No applications match these filters.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="text-xs text-slate-500"><UserRound className="mr-1 inline h-3.5 w-3.5" />Reviewer assignments are limited to active staff members.</div>
    </main>
  );
}
