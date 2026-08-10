'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ImagePlus, RefreshCw, Save, ShieldCheck, Upload } from 'lucide-react';
import { uploadManagedImage } from '@/lib/managed-image-upload';
import { errorText, userFacingApiError, type UserFacingError } from '@/lib/admin-error';

export const dynamic = 'force-dynamic';

type Template = {
  id?: string;
  name?: string;
  active?: boolean;
  organisationName?: string;
  subtitle?: string | null;
  backgroundImageRef?: string | null;
  accentHex?: string;
  footerText?: string | null;
  validityMonths?: number;
};

type Payload = {
  ok: boolean;
  item?: Template | null;
  media?: {
    configured?: boolean;
    bucketVariable?: string | null;
    regionVariable?: string | null;
    preferredBucketVariable?: string;
    preferredRegionVariable?: string;
  };
  error?: string;
  message?: string;
};

export default function StaffIdTemplatePage() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [form, setForm] = useState<Template>({
    name: 'Default Staff ID',
    active: true,
    organisationName: 'Ambulant+',
    subtitle: 'Contactless Medicine',
    accentHex: '#0f172a',
    footerText: 'Ambulant+ Contactless Medicine',
    validityMonths: 12,
  });
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageNonce, setImageNonce] = useState(0);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState<UserFacingError | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/staff/id-template', { cache: 'no-store' });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw userFacingApiError({ response, json, fallback: 'Unable to load the Staff ID template.' });
      }
      setPayload(json);
      if (json.item) {
        setForm({
          name: json.item.name || 'Default Staff ID',
          active: json.item.active !== false,
          organisationName: json.item.organisationName || 'Ambulant+',
          subtitle: json.item.subtitle || '',
          backgroundImageRef: json.item.backgroundImageRef || null,
          accentHex: json.item.accentHex || '#0f172a',
          footerText: json.item.footerText || '',
          validityMonths: Number(json.item.validityMonths || 12),
        });
      }
    } catch (caught: any) {
      setError(caught?.referenceId ? caught : userFacingApiError({ json: { error: caught?.message }, fallback: 'Unable to load the Staff ID template.' }));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      const response = await fetch('/api/admin/staff/id-template', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw userFacingApiError({ response, json, fallback: 'Unable to save the Staff ID template.' });
      }
      setNotice('Staff ID template saved. Newly generated Staff IDs will use this template.');
      await load();
    } catch (caught: any) {
      setError(caught?.referenceId ? caught : userFacingApiError({ json: { error: caught?.message }, fallback: 'Unable to save the Staff ID template.' }));
    } finally {
      setBusy(false);
    }
  }

  async function uploadBackground(file: File | null) {
    if (!file) return;
    setImageBusy(true);
    setError(null);
    setNotice('');
    try {
      if (!payload?.item?.id) {
        await save();
      }
      await uploadManagedImage({
        file,
        presignUrl: '/api/admin/staff/id-template/image/presign',
        confirmUrl: '/api/admin/staff/id-template/image/confirm',
      });
      setNotice('Staff ID background image uploaded.');
      setImageNonce((value) => value + 1);
      await load();
    } catch (caught: any) {
      setError(caught?.referenceId ? caught : userFacingApiError({ json: { error: caught?.message }, fallback: 'Unable to upload the Staff ID background image.' }));
    } finally {
      setImageBusy(false);
    }
  }

  const mediaConfigured = payload?.media?.configured !== false;
  const hasBackground = Boolean(payload?.item?.backgroundImageRef || form.backgroundImageRef);

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin/staff" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" />Staff Directory</Link>
          <div className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Ambulant+ People</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Staff ID template</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">Control the organisation branding and validity used when Ambulant+ generates a Staff ID from an approved Staff profile.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />Refresh</button>
      </header>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><div className="font-semibold">We could not complete that action.</div><div className="mt-1">{errorText(error)}</div></div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div> : null}

      {!mediaConfigured ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" />Image storage needs production configuration</div>
          <p className="mt-2">Template text can still be saved, but image uploads remain unavailable until the API Gateway media bucket and region are configured.</p>
          <div className="mt-2 text-xs text-amber-800">Preferred settings: <code>{payload?.media?.preferredBucketVariable || 'ADMIN_MEDIA_S3_BUCKET'}</code> and <code>{payload?.media?.preferredRegionVariable || 'ADMIN_MEDIA_S3_REGION'}</code>.</div>
        </section>
      ) : null}

      <section className="grid gap-5 rounded-3xl border bg-white p-5 shadow-sm xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Template settings</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm"><span className="mb-1 block font-medium">Template name</span><input value={form.name || ''} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-xl border px-3 py-2" /></label>
            <label className="text-sm"><span className="mb-1 block font-medium">Organisation name</span><input value={form.organisationName || ''} onChange={(event) => setForm((current) => ({ ...current, organisationName: event.target.value }))} className="w-full rounded-xl border px-3 py-2" /></label>
            <label className="text-sm"><span className="mb-1 block font-medium">Subtitle</span><input value={form.subtitle || ''} onChange={(event) => setForm((current) => ({ ...current, subtitle: event.target.value }))} className="w-full rounded-xl border px-3 py-2" /></label>
            <label className="text-sm"><span className="mb-1 block font-medium">Accent colour</span><div className="flex gap-2"><input type="color" value={form.accentHex || '#0f172a'} onChange={(event) => setForm((current) => ({ ...current, accentHex: event.target.value }))} className="h-10 w-14 rounded-lg border p-1" /><input value={form.accentHex || ''} onChange={(event) => setForm((current) => ({ ...current, accentHex: event.target.value }))} className="min-w-0 flex-1 rounded-xl border px-3 py-2" /></div></label>
            <label className="text-sm"><span className="mb-1 block font-medium">Validity</span><select value={form.validityMonths || 12} onChange={(event) => setForm((current) => ({ ...current, validityMonths: Number(event.target.value) }))} className="w-full rounded-xl border px-3 py-2"><option value={6}>6 months</option><option value={12}>12 months</option><option value={24}>24 months</option><option value={36}>36 months</option></select></label>
            <label className="text-sm"><span className="mb-1 block font-medium">Footer text</span><input value={form.footerText || ''} onChange={(event) => setForm((current) => ({ ...current, footerText: event.target.value }))} className="w-full rounded-xl border px-3 py-2" /></label>
          </div>
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active !== false} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />Use this as the active Staff ID template</label>
          <button type="button" onClick={() => void save()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />Save template</button>
        </div>

        <div className="rounded-2xl border bg-slate-50 p-4">
          <div className="flex items-center gap-2 font-semibold"><ImagePlus className="h-4 w-4" />Background artwork</div>
          <p className="mt-1 text-xs text-slate-500">JPEG, PNG or WebP · up to 8 MB. The artwork is used subtly behind generated Staff ID details.</p>
          <div className="mt-4 overflow-hidden rounded-2xl border bg-white">
            {hasBackground ? <img key={imageNonce} src={`/api/admin/staff/id-template/image?v=${imageNonce}`} alt="Current Staff ID template background" className="h-48 w-full object-cover" /> : <div className="grid h-48 place-items-center text-sm text-slate-400">No background image</div>}
          </div>
          <label className={`mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-medium ${imageBusy || !mediaConfigured ? 'pointer-events-none opacity-50' : ''}`}>
            <Upload className="h-4 w-4" />{hasBackground ? 'Replace background' : 'Upload background'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={imageBusy || !mediaConfigured} onChange={(event) => { const file = event.currentTarget.files?.[0] || null; event.currentTarget.value = ''; void uploadBackground(file); }} />
          </label>
        </div>
      </section>
    </main>
  );
}
