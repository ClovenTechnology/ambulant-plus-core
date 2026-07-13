// apps/patient-app/app/encounters/[id]/print/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatDateTime, modeLabel, statusLabel } from '@/lib/encounters/display';

type Encounter = {
  id: string;
  caseId?: string | null;
  status?: string | null;
  visitMode?: string | null;
  mode?: string | null;
  startedAt?: string | number | null;
  endedAt?: string | number | null;
  start?: string | number | null;
  stop?: string | number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  primaryTime?: string | null;
  clinician?: { name?: string | null; displayName?: string | null; specialty?: string | null } | null;
  appointment?: any;
  payment?: any;
  documents?: any[];
  counts?: Record<string, number>;
  summaryPayload?: any;
};

async function fetchEncounter(id: string): Promise<Encounter> {
  const res = await fetch(`/api/encounters/${encodeURIComponent(id)}`, { cache: 'no-store' });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok === false) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
  const encounter = data?.encounter ?? data?.item ?? data;
  if (!encounter?.id) throw new Error('Encounter not found');
  return encounter;
}

function valueOrDash(value: unknown) {
  const s = String(value ?? '').trim();
  return s || '—';
}

function summaryOf(encounter: Encounter | null) {
  const s = encounter?.summaryPayload && typeof encounter.summaryPayload === 'object' ? encounter.summaryPayload : null;
  return {
    title: s?.reason || s?.diagnosisText || s?.chiefComplaint || 'Clinical encounter',
    reason: s?.reason || s?.chiefComplaint || s?.synopsis || null,
    assessment: s?.diagnosisText || s?.assessment || s?.primaryDiagnosis || null,
    plan: s?.plan || s?.managementPlan || s?.treatmentPlan || null,
    notes: s?.notes || s?.clinicalNotes || null,
  };
}

export default function EncounterPrintPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || '');
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchEncounter(id);
        if (!cancelled) setEncounter(data);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Encounter not found');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (id) void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const summary = useMemo(() => summaryOf(encounter), [encounter]);
  const documents = Array.isArray(encounter?.documents) ? encounter!.documents! : [];
  const generatedAt = new Date();

  return (
    <main data-p-ui="patient-encounter-print-detail-page" className="min-w-0 overflow-x-clip min-h-screen bg-slate-100 px-4 py-8 text-slate-950 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-5xl rounded-[28px] bg-white p-8 shadow-xl print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Ambulant+ encounter report</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight">{summary.title}</h1>
            <p className="mt-2 text-sm text-slate-500">Generated {formatDateTime(generatedAt)}</p>
          </div>
          <div className="flex gap-2 print:hidden">
            <Link href={encounter?.id ? `/encounters/${encodeURIComponent(encounter.id)}` : '/encounters'} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">Back</Link>
            <button type="button" onClick={() => window.print()} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">Print</button>
          </div>
        </header>

        {loading ? (
          <div className="py-10 text-sm text-slate-500">Loading encounter…</div>
        ) : error || !encounter ? (
          <div className="py-10 text-sm text-rose-700">{error || 'Encounter not found.'}</div>
        ) : (
          <div className="space-y-6 py-6">
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Info label="Encounter ID" value={encounter.id} />
              <Info label="Case ID" value={encounter.caseId} />
              <Info label="Status" value={statusLabel(encounter.status)} />
              <Info label="Mode" value={modeLabel(encounter.visitMode || encounter.mode)} />
              <Info label="Started" value={formatDateTime(encounter.startedAt || encounter.start || encounter.createdAt)} />
              <Info label="Ended / updated" value={formatDateTime(encounter.endedAt || encounter.stop || encounter.updatedAt || encounter.primaryTime)} />
              <Info label="Clinician" value={encounter.clinician?.displayName || encounter.clinician?.name || 'Not recorded'} />
              <Info label="Specialty" value={encounter.clinician?.specialty || 'Not recorded'} />
            </section>

            <section className="rounded-2xl border border-slate-200 p-5">
              <h2 className="text-lg font-black">Clinical summary</h2>
              <div className="mt-4 grid gap-4">
                <PrintBlock label="Reason" value={summary.reason} />
                <PrintBlock label="Assessment" value={summary.assessment} />
                <PrintBlock label="Plan" value={summary.plan} />
                <PrintBlock label="Notes" value={summary.notes} />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 p-5">
              <h2 className="text-lg font-black">Linked outputs</h2>
              <div className="mt-3 grid gap-2 text-sm">
                <div>eRx orders: <strong>{Number(encounter.counts?.erxOrders || 0)}</strong></div>
                <div>Lab orders: <strong>{Number(encounter.counts?.labOrders || 0)}</strong></div>
                <div>Payments: <strong>{Number(encounter.counts?.payments || 0)}</strong></div>
                <div>Documents: <strong>{Number(encounter.counts?.documents || documents.length || 0)}</strong></div>
              </div>
              {documents.length ? (
                <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr><th className="p-3">Title</th><th className="p-3">Type</th><th className="p-3">Created</th></tr>
                    </thead>
                    <tbody>
                      {documents.map((doc: any) => (
                        <tr key={doc.id || doc.fileName} className="border-t border-slate-100">
                          <td className="p-3 font-medium">{doc.title || doc.fileName || 'Document'}</td>
                          <td className="p-3">{doc.documentKind || doc.docType || 'Document'}</td>
                          <td className="p-3">{formatDateTime(doc.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>

            <footer className="border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
              This report is generated from the Ambulant+ encounter record. It should be interpreted alongside the clinician’s official documentation, prescriptions, investigation results and follow-up instructions.
            </footer>
          </div>
        )}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-1 break-words text-sm font-bold text-slate-900">{valueOrDash(value)}</div>
    </div>
  );
}

function PrintBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{valueOrDash(value)}</div>
    </div>
  );
}
