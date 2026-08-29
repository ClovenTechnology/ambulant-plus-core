'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type PublishedLegalDocument = {
  title?: string | null;
  key?: string | null;
  version?: {
    versionNumber?: number | null;
    versionLabel?: string | null;
    content?: string | null;
    effectiveAt?: string | null;
    publishedAt?: string | null;
  } | null;
};

export default function PatientTelevisitPolicyPage() {
  const [document, setDocument] = useState<PublishedLegalDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const response = await fetch(
          '/api/legal/published?key=PATIENT_TELEVISIT_CONSENT&application=patient-app&surface=televisit-consent',
          { cache: 'no-store', credentials: 'include' },
        );
        const body = await response.json().catch(() => null);
        const next = response.ok && body?.ok && Array.isArray(body?.documents) ? body.documents[0] : null;
        if (!alive) return;
        setDocument(next || null);
        setError(next ? '' : 'The Patient Televisit consent notice is not currently published. Please contact Ambulant+ Support before continuing if you need assistance.');
      } catch (err: any) {
        if (!alive) return;
        setDocument(null);
        setError(err?.message || 'Unable to load the governed Patient Televisit consent notice.');
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, []);

  const versionLabel =
    document?.version?.versionLabel ||
    (document?.version?.versionNumber ? `v${document.version.versionNumber}` : 'Published version');

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Ambulant+ Legal</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                {document?.title || 'Patient Televisit Informed Consent and Privacy Notice'}
              </h1>
              {document ? (
                <p className="mt-2 text-sm text-slate-500">
                  {versionLabel}
                  {document.version?.publishedAt ? ` · Published ${new Date(document.version.publishedAt).toLocaleString()}` : ''}
                </p>
              ) : null}
            </div>
            <Link href="/" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50">
              Back to Patient App
            </Link>
          </div>

          {loading ? (
            <div className="py-12 text-sm text-slate-500">Loading governed Legal notice…</div>
          ) : error ? (
            <div className="my-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
              {error}
            </div>
          ) : (
            <article className="whitespace-pre-wrap break-words py-8 text-sm leading-7 text-slate-800 sm:text-base">
              {document?.version?.content || 'No governed content is available.'}
            </article>
          )}
        </div>
      </div>
    </main>
  );
}
