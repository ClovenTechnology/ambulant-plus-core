'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import ClinicianActions from '@/app/clinicians/ClinicianActions';

function value(input: unknown) {
  const text = String(input ?? '').trim();
  return text || '—';
}

function date(input: unknown) {
  if (!input) return '—';
  const parsed = new Date(String(input));
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : value(input);
}

function money(cents: unknown, currency: unknown) {
  const amount = Number(cents || 0) / 100;
  try {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: value(currency) === '—' ? 'ZAR' : value(currency) }).format(amount);
  } catch {
    return `${value(currency)} ${amount.toFixed(2)}`;
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="rounded-2xl border bg-white p-4"><div className="text-xs uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 break-words text-sm font-medium text-slate-900">{children}</div></div>;
}

export default function AdminClinicianDetailPage({ params }: { params: { id: string } }) {
  const [clinician, setClinician] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let active = true;
    setBusy(true);
    setError('');

    fetch(`/api/admin/clinicians/${encodeURIComponent(params.id)}`, { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body?.ok === false) throw new Error(body?.error || `HTTP ${response.status}`);
        if (active) setClinician(body.clinician || null);
      })
      .catch((reason) => {
        if (active) setError(String(reason?.message || 'clinician_detail_load_failed'));
      })
      .finally(() => {
        if (active) setBusy(false);
      });

    return () => { active = false; };
  }, [params.id]);

  const onboarding = clinician?.onboarding;
  const slot = onboarding?.trainingSlot;
  const actionMode: 'pending' | 'active' =
    String(clinician?.status || '').toLowerCase() === 'pending'
      ? 'pending'
      : 'active';

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm text-slate-500"><Link href="/admin/clinicians" className="hover:underline">Clinicians</Link> / {params.id}</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Clinician profile</h1>
          <p className="mt-1 text-sm text-slate-600">Identity, credentials, practice, onboarding, training, payments and dispatch.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/clinicians/onboarding" className="rounded-xl border bg-white px-4 py-2 text-sm">Onboarding board</Link>
          <Link href={`/admin/clinicians/${encodeURIComponent(params.id)}/fees`} className="rounded-xl border bg-white px-4 py-2 text-sm">Fees &amp; staff comp</Link>
        </div>
      </header>

      {busy ? <div className="rounded-3xl border bg-white p-8 text-sm text-slate-500">Loading clinician…</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
      {!busy && !error && !clinician ? <div className="rounded-3xl border bg-white p-8 text-sm text-slate-500">Clinician not found.</div> : null}

      {clinician ? (
        <>
          <section className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div><h2 className="text-2xl font-semibold">{value(clinician.displayName)}</h2><div className="mt-1 text-sm text-slate-500">{value(clinician.email)} · {value(clinician.phone)}</div><div className="mt-1 font-mono text-xs text-slate-400">{clinician.id}</div></div>
              <div className="flex flex-col items-end gap-3">
                <div className="flex flex-wrap justify-end gap-2"><span className="rounded-full border px-3 py-1 text-xs">{value(clinician.status)}</span><span className="rounded-full border px-3 py-1 text-xs">{value(clinician.specialty)}</span><span className="rounded-full border px-3 py-1 text-xs">{clinician.trainingCompleted ? 'training complete' : 'training pending'}</span></div>
                <ClinicianActions clinicianId={clinician.id} mode={actionMode} />
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Regulator">{value(clinician.regulatorBody)} · {value(clinician.regulatorRegistration)}</Field>
            <Field label="Qualification">{value(clinician.qualification)} · {value(clinician.qualificationInstitution)} · {value(clinician.qualificationYear)}</Field>
            <Field label="Practice">{value(clinician.practiceName)} · {value(clinician.practiceNumber)}</Field>
            <Field label="Consult fee">{money(clinician.feeCents, clinician.currency)}</Field>
            <Field label="Board certificate">{value(clinician.boardCertificateNumber)} · expires {date(clinician.boardCertificateExpires)}</Field>
            <Field label="PI insurance">{value(clinician.piInsuranceProvider)} · {value(clinician.piInsuranceNumber)} · expires {date(clinician.piInsuranceExpiry)}</Field>
            <Field label="Location">{value([clinician.addressLine1, clinician.addressLine2, clinician.city, clinician.postalCode, clinician.country].filter(Boolean).join(', '))}</Field>
            <Field label="Activity">Last seen {date(clinician.lastSeenAt)} · {clinician.online ? 'online' : 'offline'} · rating {Number(clinician.ratingAvg || 0).toFixed(1)} ({Number(clinician.ratingCount || 0)})</Field>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border bg-white p-5"><h3 className="font-semibold">Onboarding and training</h3><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Stage</dt><dd>{value(onboarding?.status)}</dd></div><div><dt className="text-slate-500">Payment plan</dt><dd>{value(onboarding?.paymentPlan)}</dd></div><div><dt className="text-slate-500">Training mode</dt><dd>{value(onboarding?.trainingMode)}</dd></div><div><dt className="text-slate-500">Scheduled</dt><dd>{date(slot?.startAt || clinician.trainingScheduledAt)}</dd></div><div><dt className="text-slate-500">Slot</dt><dd>{value(slot?.id)}</dd></div><div><dt className="text-slate-500">Notes</dt><dd>{value(onboarding?.trainingNotes)}</dd></div></dl></div>
            <div className="rounded-3xl border bg-white p-5"><h3 className="font-semibold">Commercial and fulfilment</h3><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Payments</dt><dd>{Number(onboarding?.payments?.length || 0)}</dd></div><div><dt className="text-slate-500">Pay Later requests</dt><dd>{Number(onboarding?.payLaterRequests?.length || 0)}</dd></div><div><dt className="text-slate-500">Dispatches</dt><dd>{Number(onboarding?.dispatches?.length || 0)}</dd></div><div><dt className="text-slate-500">Fee entries</dt><dd>{Number(clinician.feesV2?.length || 0)}</dd></div></dl></div>
          </section>
        </>
      ) : null}
    </main>
  );
}
