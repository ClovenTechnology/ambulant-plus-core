'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Branding = {
  organizationName: string;
  serviceLine: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  verificationUrl: string;
  accentColor: string;
  prescriptionFooter: string;
  labFooter: string;
  certificateFooter: string;
};

const EMPTY: Branding = {
  organizationName: 'Ambulant+',
  serviceLine: 'Contactless Medicine',
  address: '0B Meadowbrook Lane, Epsom Downs, Bryanston 2152, South Africa',
  phone: '069 669 0899',
  email: 'support@ambulantplus.co.za',
  website: 'ambulantplus.co.za',
  verificationUrl: 'ambulantplus.co.za',
  accentColor: '#0AA7A8',
  prescriptionFooter: '',
  labFooter: '',
  certificateFooter: '',
};

export default function ClinicalDocumentBrandingPage() {
  const [data, setData] = useState<Branding>(EMPTY);
  const [original, setOriginal] = useState<Branding>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const dirty = useMemo(() => JSON.stringify(data) !== JSON.stringify(original), [data, original]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/settings/clinical-documents', { cache: 'no-store' });
        const js = await res.json();
        if (!res.ok || !js?.ok) throw new Error(js?.error || 'Unable to load clinical document branding');
        setData({ ...EMPTY, ...js.data });
        setOriginal({ ...EMPTY, ...js.data });
      } catch (e: any) {
        setMessage(e?.message || 'Unable to load clinical document branding');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const field = (key: keyof Branding, label: string, multiline = false) => (
    <label className="block text-sm text-slate-700">
      <span className="font-medium text-slate-900">{label}</span>
      {multiline ? (
        <textarea value={data[key]} onChange={(e) => setData((p) => ({ ...p, [key]: e.target.value }))} rows={3} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" />
      ) : (
        <input value={data[key]} onChange={(e) => setData((p) => ({ ...p, [key]: e.target.value }))} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" />
      )}
    </label>
  );

  async function save() {
    setSaving(true); setMessage(null);
    try {
      const res = await fetch('/api/admin/settings/clinical-documents', {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data }),
      });
      const js = await res.json();
      if (!res.ok || !js?.ok) throw new Error(js?.error || 'Unable to save clinical document branding');
      const next = { ...EMPTY, ...js.data };
      setData(next); setOriginal(next); setMessage('Clinical document branding saved. New documents will snapshot this version.');
    } catch (e: any) {
      setMessage(e?.message || 'Unable to save clinical document branding');
    } finally { setSaving(false); }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-teal-700">Ambulant+ clinical documents</div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Branding & issuing identity</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">Controls the organisation identity used on prescriptions, laboratory requisitions and clinical certificates. Issued documents keep a snapshot of the branding active at issuance.</p>
        </div>
        <Link href="/settings/general" className="rounded-xl border bg-white px-3 py-2 text-sm text-slate-700">General settings</Link>
      </div>

      {message ? <div className="rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</div> : null}
      {loading ? <div className="rounded-2xl border bg-white p-8 text-sm text-slate-500">Loading…</div> : (
        <>
          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">Organisation identity</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {field('organizationName', 'Organisation name')}
              {field('serviceLine', 'Service line')}
              <div className="md:col-span-2">{field('address', 'Address')}</div>
              {field('phone', 'Phone')}
              {field('email', 'Email')}
              {field('website', 'Website')}
              {field('verificationUrl', 'Document reference / verification URL')}
              {field('accentColor', 'Accent colour (#RRGGBB)')}
            </div>
          </section>
          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">Document-specific footer copy</h2>
            <div className="mt-4 space-y-4">
              {field('prescriptionFooter', 'Prescription footer', true)}
              {field('labFooter', 'Laboratory requisition footer', true)}
              {field('certificateFooter', 'Clinical certificate footer', true)}
            </div>
          </section>
          <div className="sticky bottom-4 flex items-center justify-between rounded-2xl border bg-white/95 p-3 shadow-lg backdrop-blur">
            <span className="text-xs text-slate-600">{dirty ? 'Unsaved changes' : 'Up to date'}</span>
            <button type="button" onClick={() => void save()} disabled={!dirty || saving} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">{saving ? 'Saving…' : 'Save branding'}</button>
          </div>
        </>
      )}
    </main>
  );
}
