'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CLINICIANS } from '@/mock/clinicians';

type RefundPolicy = {
  within24hPercent: number;      // e.g. 50
  noShowPercent: number;         // e.g. 0
  clinicianMissPercent: number;  // e.g. 100
  networkProrate: boolean;
};

function RefundPolicyPanel({ policy }: { policy: RefundPolicy }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-sm underline text-indigo-700"
        aria-expanded={open}
        aria-controls="refund-policy"
      >
        {open ? 'Hide' : 'View'} clinician’s refund policy
      </button>
      {open && (
        <div id="refund-policy" className="mt-2 border rounded-lg bg-white p-3 text-sm">
          <ul className="space-y-1">
            <li>Cancel &lt; 24h: <b>{policy.within24hPercent}%</b> refund</li>
            <li>No-show: <b>{policy.noShowPercent}%</b> refund</li>
            <li>Clinician misses: <b>{policy.clinicianMissPercent}%</b> refund or fast rebook</li>
            <li>Network interrupted: {policy.networkProrate ? <b>prorated by time</b> : <b>no prorate</b>}</li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ClinicianBioPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const c = CLINICIANS.find(x => x.id === params.id);

  // In real deployment, fetch merged effective policy from CLIN gateway:
  const policy: RefundPolicy = useMemo(() => ({
    within24hPercent: c?.policy?.within24hPercent ?? 50,
    noShowPercent: c?.policy?.noShowPercent ?? 0,
    clinicianMissPercent: c?.policy?.clinicianMissPercent ?? 100,
    networkProrate: c?.policy?.networkProrate ?? true,
  }), [c]);

  if (!c) {
    return (
      <main className="p-6 max-w-5xl mx-auto">
        <div className="text-rose-600">Clinician not found.</div>
        <Link href="/clinicians" className="text-sm underline block mt-2">← Back to clinicians</Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <button onClick={() => router.back()} className="text-sm text-teal-700 hover:underline">← Back</button>
        <h1 className="text-3xl font-semibold">{c.name}</h1>
        <Link href="/clinicians" className="text-sm text-teal-700 hover:underline">All clinicians</Link>
      </header>

      <section className="bg-white rounded-2xl border p-5 flex items-start justify-between gap-6">
        <div>
          <div className="text-lg font-medium">{c.specialty}</div>
          <div className="text-sm text-gray-600">{c.location}</div>
          <div className="text-xs text-amber-700 mt-1">★ {c.rating.toFixed(1)}</div>
          <p className="text-sm text-gray-700 mt-3 max-w-2xl">
            Experienced clinician providing patient-centred care. (Demo bio.)
          </p>
          <RefundPolicyPanel policy={policy} />
        </div>

        <div className="shrink-0 flex flex-col gap-2">
          <Link
            href={`/clinicians/${c.id}/calendar`}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
          >
            Open calendar
          </Link>
          <Link
            href={`/appointments/new?clinicianId=${encodeURIComponent(c.id)}&reason=${encodeURIComponent('Televisit consult')}`}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700"
          >
            Quick book
          </Link>
        </div>
      </section>

      <section className="bg-white rounded-2xl border p-5">
        <h2 className="text-lg font-semibold mb-3">Testimonials</h2>
        <ul className="space-y-3 text-sm text-gray-700">
          <li>“Great bedside manner and very thorough.”</li>
          <li>“Explained everything clearly. Highly recommended.”</li>
        </ul>
      </section>
    </main>
  );
}
