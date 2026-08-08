'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Plus, RefreshCw, Search } from 'lucide-react';

export const dynamic = 'force-dynamic';

type VersionSummary = {
  id: string;
  versionNumber: number;
  state: 'DRAFT' | 'PUBLISHED' | 'RETIRED';
  accessMode: string;
  locale: string;
  publishedAt?: string | null;
  retiredAt?: string | null;
  updatedAt: string;
};

type FormRow = {
  id: string;
  key: string;
  slug: string;
  name: string;
  description?: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  defaultLocale: string;
  updatedAt: string;
  versions: VersionSummary[];
};

type ListPayload = {
  ok: boolean;
  total?: number;
  items?: FormRow[];
  error?: string;
};

function versionLabel(form: FormRow) {
  const draft = form.versions.find((version) => version.state === 'DRAFT');
  const published = form.versions.find((version) => version.state === 'PUBLISHED');
  if (draft) return `Draft v${draft.versionNumber}`;
  if (published) return `Published v${published.versionNumber}`;
  const latest = form.versions[0];
  return latest ? `${latest.state} v${latest.versionNumber}` : 'No versions';
}

export default function AdminEnterpriseFormsPage() {
  const [items, setItems] = useState<FormRow[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [locale, setLocale] = useState('en');

  const query = useMemo(() => {
    const params = new URLSearchParams({ pageSize: '100' });
    if (q.trim()) params.set('q', q.trim());
    if (status) params.set('status', status);
    return params.toString();
  }, [q, status]);

  async function load() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/forms?${query}`, { cache: 'no-store' });
      const json = (await response.json().catch(() => null)) as ListPayload | null;
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || 'Unable to load enterprise forms');
      }
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load enterprise forms');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const handle = window.setTimeout(load, 150);
    return () => window.clearTimeout(handle);
  }, [query]);

  async function createForm(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/forms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          key: key || undefined,
          slug: slug || undefined,
          description: description || undefined,
          defaultLocale: locale || 'en',
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || 'Unable to create enterprise form');
      }

      const formId = json?.form?.id;
      const versionId = json?.version?.id;
      if (!formId || !versionId) {
        throw new Error('Enterprise form was created without an initial draft identifier');
      }

      window.location.assign(
        `/admin/forms/${encodeURIComponent(formId)}/versions/${encodeURIComponent(versionId)}`,
      );
    } catch (err: any) {
      setError(err?.message || 'Unable to create enterprise form');
      setBusy(false);
    }
  }

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
            Applications & enterprise workflows
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Enterprise Forms
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Build reusable, versioned forms for recruitment, onboarding, partnerships,
            research, vendor workflows and future operational processes.
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
            New form
          </button>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {showCreate ? (
        <form onSubmit={createForm} className="grid gap-4 rounded-3xl border bg-white p-5 shadow-sm lg:grid-cols-2">
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-slate-950">Create enterprise form</h2>
            <p className="mt-1 text-sm text-slate-500">
              Creation produces an ACTIVE form with an editable v1 draft. Nothing is public
              until a version is explicitly published.
            </p>
          </div>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={240}
              className="w-full rounded-xl border px-3 py-2"
              placeholder="Graduate programme application"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Default locale</span>
            <input
              value={locale}
              onChange={(event) => setLocale(event.target.value)}
              className="w-full rounded-xl border px-3 py-2"
              placeholder="en"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Stable key (optional)</span>
            <input
              value={key}
              onChange={(event) => setKey(event.target.value)}
              className="w-full rounded-xl border px-3 py-2 font-mono text-xs"
              placeholder="graduate_programme_application"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Public slug (optional)</span>
            <input
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              className="w-full rounded-xl border px-3 py-2 font-mono text-xs"
              placeholder="graduate-programme-application"
            />
          </label>

          <label className="space-y-1 text-sm lg:col-span-2">
            <span className="font-medium text-slate-700">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-24 w-full rounded-xl border p-3"
            />
          </label>

          <div className="flex gap-2 lg:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Create and open builder
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-xl border px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <section className="rounded-3xl border bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_180px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search name, key, slug or description"
              className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm"
            />
          </label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="grid grid-cols-[1.5fr_0.7fr_0.9fr_auto] gap-3 border-b bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <div>Form</div>
          <div>Status</div>
          <div>Version</div>
          <div />
        </div>

        {!busy && items.length === 0 ? (
          <div className="p-8 text-sm text-slate-500">
            No enterprise forms match this view.
          </div>
        ) : null}

        {items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[1.5fr_0.7fr_0.9fr_auto] gap-3 border-b px-5 py-4 text-sm last:border-b-0"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <ClipboardList className="h-4 w-4 text-teal-700" />
                <span className="truncate">{item.name}</span>
              </div>
              <div className="mt-1 truncate font-mono text-xs text-slate-500">
                /{item.slug} · {item.key}
              </div>
            </div>

            <div>
              <span className="rounded-full border px-2.5 py-1 text-xs font-semibold">
                {item.status}
              </span>
            </div>

            <div>
              <div className="font-medium">{versionLabel(item)}</div>
              <div className="mt-1 text-xs text-slate-500">
                {new Date(item.updatedAt).toLocaleString()}
              </div>
            </div>

            <Link
              href={`/admin/forms/${encodeURIComponent(item.id)}`}
              className="self-start rounded-xl border px-3 py-2 text-xs font-semibold"
            >
              Manage
            </Link>
          </div>
        ))}
      </section>
    </main>
  );
}
