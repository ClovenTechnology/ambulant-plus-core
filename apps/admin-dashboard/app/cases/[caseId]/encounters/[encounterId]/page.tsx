"use client";

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

function List({
  title,
  items,
  render,
}: {
  title: string;
  items: any[];
  render: (item: any) => ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-3 space-y-2">
        {items.length ? items.map(render) : <div className="text-sm text-slate-500">None recorded.</div>}
      </div>
    </section>
  );
}

export default function EncounterDetailPage({
  params,
}: {
  params: { caseId: string; encounterId: string };
}) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const response = await fetch(
          `/api/admin/cases/${encodeURIComponent(params.caseId)}/encounters/${encodeURIComponent(params.encounterId)}`,
          { cache: 'no-store' },
        );
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`);
        if (live) setData(body);
      } catch (err: any) {
        if (live) setError(err?.message || 'Unable to load encounter.');
      }
    })();
    return () => {
      live = false;
    };
  }, [params.caseId, params.encounterId]);

  if (error) {
    return (
      <main className="p-6">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800">{error}</div>
      </main>
    );
  }
  if (!data) return <main className="p-6 text-sm text-slate-500">Loading encounter…</main>;

  const encounter = data.encounter;

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="rounded-3xl border bg-white p-6 shadow-sm">
        <Link href={`/cases/${encodeURIComponent(params.caseId)}`} className="text-sm text-teal-700">
          ← Back to Case
        </Link>
        <div className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
          Encounter within longitudinal Case
        </div>
        <h1 className="mt-2 text-3xl font-semibold">Encounter detail</h1>
        <div className="mt-3 text-sm text-slate-600">
          {data.patient?.name || encounter.patientId} • {data.clinician?.displayName || encounter.clinicianId || 'Clinician not assigned'} • {encounter.status}
        </div>
        <div className="mt-2 font-mono text-xs text-slate-400">{encounter.id}</div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4"><div className="text-xs text-slate-500">Visit mode</div><div className="mt-2 font-semibold">{encounter.visitMode || '—'}</div></div>
        <div className="rounded-2xl border bg-white p-4"><div className="text-xs text-slate-500">Created</div><div className="mt-2 text-sm font-semibold">{new Date(encounter.createdAt).toLocaleString()}</div></div>
        <div className="rounded-2xl border bg-white p-4"><div className="text-xs text-slate-500">Started</div><div className="mt-2 text-sm font-semibold">{encounter.consultationStartedAt ? new Date(encounter.consultationStartedAt).toLocaleString() : '—'}</div></div>
        <div className="rounded-2xl border bg-white p-4"><div className="text-xs text-slate-500">Ended</div><div className="mt-2 text-sm font-semibold">{encounter.consultationEndedAt ? new Date(encounter.consultationEndedAt).toLocaleString() : '—'}</div></div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <List title="Appointments" items={encounter.appointments || []} render={(item: any) => (
          <div key={item.id} className="rounded-xl border p-3 text-sm"><div className="font-medium">{item.status}</div><div className="text-xs text-slate-500">{new Date(item.startsAt).toLocaleString()}</div></div>
        )} />
        <List title="Prescriptions / CarePort" items={encounter.erxOrders || []} render={(item: any) => (
          <div key={item.id} className="rounded-xl border p-3 text-sm"><div className="font-medium">{item.drug || item.id}</div><div className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</div></div>
        )} />
        <List title="Laboratory orders" items={encounter.labOrders || []} render={(item: any) => (
          <div key={item.id} className="rounded-xl border p-3 text-sm"><div className="font-medium">{item.panel || item.id}</div><div className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</div></div>
        )} />
        <List title="Diagnoses" items={encounter.diagnoses || []} render={(item: any) => (
          <div key={item.id} className="rounded-xl border p-3 text-sm"><div className="font-medium">{item.description || item.icd10 || 'Diagnosis'}</div></div>
        )} />
        <List title="Lab results" items={encounter.labResults || []} render={(item: any) => (
          <div key={item.id} className="rounded-xl border p-3 text-sm"><div className="font-medium">{item.name || item.id}</div><div className="text-xs text-slate-500">{item.valueNum ?? ''} {item.unit || ''}</div></div>
        )} />
        <List title="Payments" items={encounter.payments || []} render={(item: any) => (
          <div key={item.id} className="rounded-xl border p-3 text-sm"><div className="font-medium">{item.status}</div><div className="text-xs text-slate-500">{typeof item.amountCents === 'number' ? (item.amountCents / 100).toFixed(2) : '—'} {item.currency || ''}</div></div>
        )} />
      </div>
    </main>
  );
}
