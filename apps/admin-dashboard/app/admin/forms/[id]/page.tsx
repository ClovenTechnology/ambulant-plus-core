'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Archive, CopyPlus, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

type Version = {
  id: string;
  versionNumber: number;
  state: 'DRAFT' | 'PUBLISHED' | 'RETIRED';
  accessMode: string;
  title: string;
  description?: string | null;
  locale: string;
  fallbackLocale?: string | null;
  submitLabel: string;
  allowSaveResume: boolean;
  acceptingFrom?: string | null;
  acceptingUntil?: string | null;
  retentionDays?: number | null;
  createdFromVersionId?: string | null;
  publishedAt?: string | null;
  retiredAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type FormRecord = {
  id: string;
  key: string;
  slug: string;
  name: string;
  description?: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  defaultLocale: string;
  versions: Version[];
};

export default function EnterpriseFormDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [form, setForm] = useState<FormRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [defaultLocale, setDefaultLocale] = useState('en');
  const [sourceVersionId, setSourceVersionId] = useState('');
  const [canDelete, setCanDelete] = useState(false);

  async function load() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/forms/${encodeURIComponent(params.id)}`, {
        cache: 'no-store',
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok || !json?.form) {
        throw new Error(json?.error || 'Unable to load enterprise form');
      }

      setForm(json.form);
      setCanDelete(Boolean(json.permissions?.canDelete));
      setName(json.form.name || '');
      setSlug(json.form.slug || '');
      setDescription(json.form.description || '');
      setDefaultLocale(json.form.defaultLocale || 'en');
    } catch (err: any) {
      setError(err?.message || 'Unable to load enterprise form');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, [params.id]);

  const draft = useMemo(
    () => form?.versions?.find((version) => version.state === 'DRAFT') || null,
    [form],
  );

  const cloneSources = useMemo(
    () =>
      (form?.versions || []).filter(
        (version) => version.state === 'PUBLISHED' || version.state === 'RETIRED',
      ),
    [form],
  );

  async function saveMetadata(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/forms/${encodeURIComponent(params.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, slug, description, defaultLocale }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || 'Unable to update enterprise form');
      }
      await load();
    } catch (err: any) {
      setError(err?.message || 'Unable to update enterprise form');
      setBusy(false);
    }
  }

  async function setArchived(nextArchived: boolean) {
    if (
      nextArchived &&
      !window.confirm(
        'Archive this form? Existing versions and submission history will be preserved.',
      )
    ) {
      return;
    }

    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/forms/${encodeURIComponent(params.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: nextArchived ? 'ARCHIVED' : 'ACTIVE' }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || 'Unable to change enterprise form status');
      }
      await load();
    } catch (err: any) {
      setError(err?.message || 'Unable to change enterprise form status');
      setBusy(false);
    }
  }

  async function deleteForm() {
    if (!form || !canDelete) return;
    const confirmation = window.prompt(`Permanently delete “${form.name}”? This is only available for unused forms. Type DELETE to continue.`);
    if (confirmation !== 'DELETE') return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/forms/${encodeURIComponent(params.id)}`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error === 'enterprise_form_delete_not_allowed'
          ? 'This form has publication, submission or workflow history and cannot be permanently deleted. Archive it instead.'
          : json?.error || 'Unable to delete form');
      }
      window.location.assign('/admin/forms');
    } catch (err: any) {
      setError(err?.message || 'Unable to delete form');
      setBusy(false);
    }
  }

  async function createDraft() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/admin/forms/${encodeURIComponent(params.id)}/versions`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sourceVersionId: sourceVersionId || undefined,
          }),
        },
      );
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok || !json?.version?.id) {
        throw new Error(json?.error || 'Unable to create draft version');
      }
      window.location.assign(
        `/admin/forms/${encodeURIComponent(params.id)}/versions/${encodeURIComponent(json.version.id)}`,
      );
    } catch (err: any) {
      setError(err?.message || 'Unable to create draft version');
      setBusy(false);
    }
  }

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link
            href="/admin/forms"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Enterprise Forms
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {form?.name || 'Enterprise form'}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Form settings, versions and publication.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
        >
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {form ? (
        <>
          <section className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
            <form onSubmit={saveMetadata} className="space-y-4 rounded-3xl border bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-lg font-semibold">Form identity</h2>
                <p className="mt-1 text-sm text-slate-500">
                  The stable key cannot be changed after creation. Name, public slug,
                  description and default locale can be maintained here.
                </p>
              </div>

              <label className="block space-y-1 text-sm">
                <span className="font-medium">Name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-xl border px-3 py-2"
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Stable key</span>
                  <input
                    value={form.key}
                    disabled
                    className="w-full rounded-xl border bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500"
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium">Public slug</span>
                  <input
                    value={slug}
                    onChange={(event) => setSlug(event.target.value)}
                    className="w-full rounded-xl border px-3 py-2 font-mono text-xs"
                  />
                </label>
              </div>

              <label className="block space-y-1 text-sm">
                <span className="font-medium">Description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="min-h-28 w-full rounded-xl border p-3"
                />
              </label>

              <label className="block max-w-xs space-y-1 text-sm">
                <span className="font-medium">Default locale</span>
                <input
                  value={defaultLocale}
                  onChange={(event) => setDefaultLocale(event.target.value)}
                  className="w-full rounded-xl border px-3 py-2"
                />
              </label>

              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Save form identity
              </button>
            </form>

            <div className="space-y-4 rounded-3xl border bg-white p-5 shadow-sm">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Lifecycle
                </div>
                <div className="mt-2 text-xl font-semibold">{form.status}</div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                Archiving blocks creation/publication of new drafts without deleting form
                definitions or historical submissions.
              </div>

              {form.status === 'ACTIVE' ? (
                <button
                  type="button"
                  onClick={() => setArchived(true)}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-800"
                >
                  <Archive className="h-4 w-4" />
                  Archive form
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setArchived(false)}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"
                >
                  <RotateCcw className="h-4 w-4" />
                  Restore active
                </button>
              )}

              {canDelete ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <div className="text-sm font-semibold text-rose-900">Super Admin</div>
                  <p className="mt-1 text-xs leading-5 text-rose-700">This form has no submissions, published versions or workflow dependencies and can be permanently deleted.</p>
                  <button type="button" onClick={deleteForm} disabled={busy} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-40"><Trash2 className="h-4 w-4" />Delete permanently</button>
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Versions</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Published and retired versions are locked. Create a new draft when you need to make changes.
                </p>
              </div>

              {form.status === 'ACTIVE' && !draft ? (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={sourceVersionId}
                    onChange={(event) => setSourceVersionId(event.target.value)}
                    className="rounded-xl border px-3 py-2 text-sm"
                  >
                    <option value="">Blank draft</option>
                    {cloneSources.map((version) => (
                      <option key={version.id} value={version.id}>
                        Clone v{version.versionNumber} · {version.state}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={createDraft}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                  >
                    <CopyPlus className="h-4 w-4" />
                    Create draft
                  </button>
                </div>
              ) : null}
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border">
              {form.versions.map((version) => (
                <div
                  key={version.id}
                  className="grid gap-3 border-b px-4 py-4 text-sm last:border-b-0 md:grid-cols-[0.7fr_1fr_1fr_auto]"
                >
                  <div>
                    <div className="font-semibold">v{version.versionNumber}</div>
                    <div className="mt-1 text-xs text-slate-500">{version.state}</div>
                  </div>
                  <div>
                    <div className="font-medium">{version.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {version.accessMode} · {version.locale}
                    </div>
                  </div>
                  <div className="text-xs leading-5 text-slate-500">
                    Updated {new Date(version.updatedAt).toLocaleString()}
                    {version.publishedAt ? (
                      <div>Published {new Date(version.publishedAt).toLocaleString()}</div>
                    ) : null}
                    {version.retiredAt ? (
                      <div>Retired {new Date(version.retiredAt).toLocaleString()}</div>
                    ) : null}
                  </div>
                  <Link
                    href={`/admin/forms/${encodeURIComponent(form.id)}/versions/${encodeURIComponent(version.id)}`}
                    className="self-start rounded-xl border px-3 py-2 text-xs font-semibold"
                  >
                    {version.state === 'DRAFT' ? 'Open builder' : 'Inspect'}
                  </Link>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
