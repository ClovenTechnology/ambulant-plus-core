'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Briefcase, Plus, RefreshCw, Search, Star } from 'lucide-react';
import {
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_TYPES,
  STATUS_LABELS,
  TYPE_LABELS,
  humanizeOpportunityError,
  opportunityAvailability,
  type AdminOpportunity,
  type OpportunityStatus,
  type OpportunityType,
} from './opportunity-ui';

export const dynamic = 'force-dynamic';

type ListPayload = {
  ok: boolean;
  total?: number;
  items?: AdminOpportunity[];
  error?: string;
};

function availabilityLabel(item: AdminOpportunity) {
  const value = opportunityAvailability(item);
  if (value === 'OPEN') return 'Open now';
  if (value === 'UPCOMING') return 'Upcoming';
  if (value === 'CLOSED') return 'Window closed';
  return STATUS_LABELS[item.status];
}

export default function AdminOpportunitiesPage() {
  const [items, setItems] = useState<AdminOpportunity[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [createType, setCreateType] = useState<OpportunityType>('CAREER_JOB');
  const [summary, setSummary] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams({ pageSize: '100' });
    if (q.trim()) params.set('q', q.trim());
    if (status) params.set('status', status);
    if (type) params.set('type', type);
    return params.toString();
  }, [q, status, type]);

  async function load() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/opportunities?${query}`, { cache: 'no-store' });
      const json = (await response.json().catch(() => null)) as ListPayload | null;
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || 'opportunity_list_failed');
      }
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (err: any) {
      setError(humanizeOpportunityError(err?.message));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 150);
    return () => window.clearTimeout(timer);
  }, [query]);

  async function createOpportunity(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/opportunities', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title,
          type: createType,
          summary: summary || undefined,
          visibility: 'PUBLIC',
          applicationMode: 'NONE',
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok || !json?.opportunity?.id) {
        throw new Error(json?.error || 'opportunity_create_failed');
      }
      window.location.assign(`/admin/opportunities/${encodeURIComponent(json.opportunity.id)}`);
    } catch (err: any) {
      setError(humanizeOpportunityError(err?.message));
      setBusy(false);
    }
  }

  const counts = useMemo(() => {
    const result: Record<OpportunityStatus, number> = {
      DRAFT: 0,
      PUBLISHED: 0,
      PAUSED: 0,
      CLOSED: 0,
      ARCHIVED: 0,
    };
    for (const item of items) result[item.status] += 1;
    return result;
  }, [items]);

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
            Applications & Opportunities
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Opportunities</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Publish careers, internships, onboarding programmes, partnerships, franchises,
            provider opportunities and research pilots from one governed workspace.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={load}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowCreate((value) => !value)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" />
            New opportunity
          </button>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {OPPORTUNITY_STATUSES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatus(status === value ? '' : value)}
            className={`rounded-2xl border p-4 text-left transition ${status === value ? 'border-slate-950 bg-slate-950 text-white' : 'bg-white'}`}
          >
            <div className="text-2xl font-semibold">{counts[value]}</div>
            <div className={`mt-1 text-xs ${status === value ? 'text-white/70' : 'text-slate-500'}`}>
              {STATUS_LABELS[value]}
            </div>
          </button>
        ))}
      </section>

      {showCreate ? (
        <form onSubmit={createOpportunity} className="grid gap-4 rounded-3xl border bg-white p-5 shadow-sm lg:grid-cols-2">
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-slate-950">Create opportunity draft</h2>
            <p className="mt-1 text-sm text-slate-500">
              Creation is always draft-first. Configure application routing and publication details on the next screen.
            </p>
          </div>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={240}
              className="w-full rounded-xl border px-3 py-2"
              placeholder="Graduate Clinical Operations Programme"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Opportunity type</span>
            <select
              value={createType}
              onChange={(event) => setCreateType(event.target.value as OpportunityType)}
              className="w-full rounded-xl border px-3 py-2"
            >
              {OPPORTUNITY_TYPES.map((value) => (
                <option key={value} value={value}>{TYPE_LABELS[value]}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm lg:col-span-2">
            <span className="font-medium text-slate-700">Summary (optional)</span>
            <textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              maxLength={1200}
              className="min-h-24 w-full rounded-xl border p-3"
              placeholder="A concise public-facing summary."
            />
          </label>
          <div className="flex gap-2 lg:col-span-2">
            <button type="submit" disabled={busy} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Create and configure
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border px-4 py-2 text-sm">Cancel</button>
          </div>
        </form>
      ) : null}

      <section className="rounded-3xl border bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search title, key, slug, department or location"
              className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm"
            />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border px-3 py-2 text-sm">
            <option value="">All statuses</option>
            {OPPORTUNITY_STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}
          </select>
          <select value={type} onChange={(event) => setType(event.target.value)} className="rounded-xl border px-3 py-2 text-sm">
            <option value="">All types</option>
            {OPPORTUNITY_TYPES.map((value) => <option key={value} value={value}>{TYPE_LABELS[value]}</option>)}
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        {items.length === 0 && !busy ? (
          <div className="p-10 text-center text-sm text-slate-500">No opportunities match this view.</div>
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/admin/opportunities/${encodeURIComponent(item.id)}`}
                className="grid gap-4 p-5 transition hover:bg-slate-50 lg:grid-cols-[76px_1fr_180px_150px] lg:items-center"
              >
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.imageAlt || ''} className="h-full w-full object-cover" />
                  ) : (
                    <Briefcase className="h-6 w-6 text-slate-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-semibold text-slate-950">{item.title}</h2>
                    {item.featured ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"><Star className="h-3 w-3" /> Featured</span> : null}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {TYPE_LABELS[item.type]} · /{item.slug}
                    {item.referenceCode ? ` · ${item.referenceCode}` : ''}
                  </div>
                  {item.summary ? <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.summary}</p> : null}
                  {item.tags?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.tags.slice(0, 5).map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{tag}</span>)}
                    </div>
                  ) : null}
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-800">{STATUS_LABELS[item.status]}</div>
                  <div className="mt-1 text-xs text-slate-500">{availabilityLabel(item)}</div>
                </div>
                <div className="text-sm text-slate-600">
                  {item.locationLabel || item.locationMode || 'Location not set'}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
