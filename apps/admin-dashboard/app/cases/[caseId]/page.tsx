"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function CaseDetailPage({ params }: { params: { caseId: string } }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const response = await fetch(`/api/admin/cases/${encodeURIComponent(params.caseId)}`, {
          cache: 'no-store',
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`);
        if (live) setData(body);
      } catch (err: any) {
        if (live) setError(err?.message || 'Unable to load Case.');
      }
    })();
    return () => {
      live = false;
    };
  }, [params.caseId]);

  if (error) {
    return (
      <main className="p-6">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800">{error}</div>
      </main>
    );
  }
  if (!data) return <main className="p-6 text-sm text-slate-500">Loading Case…</main>;

  const clinicalCase = data.case;

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="rounded-3xl border bg-white p-6 shadow-sm">
        <Link href="/cases" className="text-sm text-teal-700">← Case register</Link>
        <div className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
          Longitudinal Clinical Case
        </div>
        <h1 className="mt-2 text-3xl font-semibold">{clinicalCase.title || 'Clinical case'}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border px-2 py-1">{clinicalCase.status}</span>
          <span className="rounded-full border px-2 py-1">Priority: {clinicalCase.priority}</span>
          <span className="rounded-full border px-2 py-1">{data.encounters.length} encounter(s)</span>
        </div>
        <p className="mt-4 text-sm text-slate-600">
          Patient: <strong>{data.patient?.name || clinicalCase.patientId}</strong>
          {data.patient?.mrn ? ` • MRN ${data.patient.mrn}` : ''}
        </p>
        {clinicalCase.summary ? (
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-700">{clinicalCase.summary}</p>
        ) : null}
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5">
          <div className="text-xs text-slate-500">Opened</div>
          <div className="mt-2 text-sm font-semibold">{new Date(clinicalCase.openedAt).toLocaleString()}</div>
        </div>
        <div className="rounded-2xl border bg-white p-5">
          <div className="text-xs text-slate-500">Last Case activity</div>
          <div className="mt-2 text-sm font-semibold">{new Date(clinicalCase.updatedAt).toLocaleString()}</div>
        </div>
        <div className="rounded-2xl border bg-white p-5">
          <div className="text-xs text-slate-500">Lead clinician</div>
          <div className="mt-2 text-sm font-semibold">
            {clinicalCase.leadClinician?.displayName || 'Not assigned'}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Encounters</h2>
        <div className="mt-4 space-y-3">
          {data.encounters.map((encounter: any) => (
            <Link
              key={encounter.id}
              href={`/cases/${encodeURIComponent(clinicalCase.id)}/encounters/${encodeURIComponent(encounter.id)}`}
              className="block rounded-xl border p-4 hover:bg-slate-50"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{encounter.clinician?.displayName || 'Clinical encounter'}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {new Date(encounter.createdAt).toLocaleString()} • {encounter.status}
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  Rx {encounter.counts.prescriptions} • Labs {encounter.counts.labOrders} • Diagnoses {encounter.counts.diagnoses}
                </div>
              </div>
            </Link>
          ))}
          {data.encounters.length === 0 ? (
            <div className="text-sm text-slate-500">No encounters recorded.</div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Case timeline</h2>
        <div className="mt-4 space-y-3">
          {data.timeline.map((event: any, index: number) => (
            <div
              key={`${event.at}-${index}`}
              className="grid gap-2 border-l-2 border-teal-200 pl-4 md:grid-cols-[180px_1fr]"
            >
              <div className="text-xs text-slate-500">{new Date(event.at).toLocaleString()}</div>
              <div>
                <div className="text-sm font-medium">{event.label}</div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400">{event.type}</div>
              </div>
            </div>
          ))}
          {data.timeline.length === 0 ? (
            <div className="text-sm text-slate-500">No timeline events recorded.</div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
