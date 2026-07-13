// apps/patient-app/app/careport/reprint/[id]/page.tsx
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function ReprintUnavailablePage() {
  const params = useParams() as { id?: string };
  const id = String(params?.id || '').trim();

  return (
    <main data-p-ui="patient-careport-reprint-page" className="min-w-0 overflow-x-clip min-h-screen bg-slate-50 px-4 py-8">
      <section className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          eRx reprint is not enabled yet. This is intentional: CarePort must only reprint from the production document
          store once that workflow is connected.
        </div>

        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">Reprint unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          We found the prescription reference, but this page will not show a fake success or trigger a local file-store action.
          Use CarePort marketplace or contact the issuing clinician if the patient needs a new fulfilment route.
        </p>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Prescription reference</div>
          <div className="mt-1 break-all font-mono text-sm font-semibold text-slate-800">{id || '—'}</div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/careport" className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            Go to CarePort
          </Link>
          <Link href="/careport/history" className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            View history
          </Link>
        </div>
      </section>
    </main>
  );
}
