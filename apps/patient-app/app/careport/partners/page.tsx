'use client';

import React, { useMemo, useState } from 'react';

type PartnerType = 'pharmacy' | 'rider';

type FormState = {
  partnerType: PartnerType;
  pharmacyName: string;
  fullName: string;
  contactName: string;
  email: string;
  phone: string;
  registrationNumber: string;
  sapcNumber: string;
  address: string;
  city: string;
  serviceAreas: string;
  vehicleType: string;
  vehicleRegistration: string;
  bankAccountMasked: string;
  notes: string;
  supportsPickup: boolean;
  supportsDelivery: boolean;
  acceptsCard: boolean;
  acceptsMedicalAid: boolean;
  hasOwnTransport: boolean;
  coldChainAware: boolean;
};

const INITIAL_FORM: FormState = {
  partnerType: 'pharmacy',
  pharmacyName: '',
  fullName: '',
  contactName: '',
  email: '',
  phone: '',
  registrationNumber: '',
  sapcNumber: '',
  address: '',
  city: '',
  serviceAreas: '',
  vehicleType: '',
  vehicleRegistration: '',
  bankAccountMasked: '',
  notes: '',
  supportsPickup: true,
  supportsDelivery: true,
  acceptsCard: true,
  acceptsMedicalAid: false,
  hasOwnTransport: true,
  coldChainAware: false,
};

function prettyError(value?: string) {
  return String(value || 'Application could not be submitted. Please check the form and try again.')
    .replace(/_/g, ' ');
}

function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">
        {props.label}
        {props.required ? <span className="text-rose-600"> *</span> : null}
      </span>
      <input
        type={props.type || 'text'}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
      />
    </label>
  );
}

function TextArea(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{props.label}</span>
      <textarea
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        rows={4}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
      />
    </label>
  );
}

function Toggle(props: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <span className="text-sm font-medium text-slate-700">{props.label}</span>
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
        className="h-5 w-5 rounded border-slate-300 text-emerald-600"
      />
    </label>
  );
}

export default function CarePortPartnerApplicationPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const isPharmacy = form.partnerType === 'pharmacy';

  const endpoint = useMemo(
    () =>
      isPharmacy
        ? '/api/careport/partners/pharmacy/apply'
        : '/api/careport/partners/rider/apply',
    [isPharmacy],
  );

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const payload = isPharmacy
        ? {
            pharmacyName: form.pharmacyName,
            contactName: form.contactName,
            email: form.email,
            phone: form.phone,
            registrationNumber: form.registrationNumber,
            sapcNumber: form.sapcNumber,
            address: form.address,
            city: form.city,
            bankAccountMasked: form.bankAccountMasked,
            supportsPickup: form.supportsPickup,
            supportsDelivery: form.supportsDelivery,
            acceptsCard: form.acceptsCard,
            acceptsMedicalAid: form.acceptsMedicalAid,
            notes: form.notes,
          }
        : {
            fullName: form.fullName,
            email: form.email,
            phone: form.phone,
            city: form.city,
            serviceAreas: form.serviceAreas,
            vehicleType: form.vehicleType,
            vehicleRegistration: form.vehicleRegistration,
            bankAccountMasked: form.bankAccountMasked,
            hasOwnTransport: form.hasOwnTransport,
            coldChainAware: form.coldChainAware,
            notes: form.notes,
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || data?.ok === false) {
        throw new Error(prettyError(data?.error));
      }

      setResult(data);
      setForm((current) => ({
        ...INITIAL_FORM,
        partnerType: current.partnerType,
      }));
    } catch (err: any) {
      setError(err?.message || 'Application could not be submitted.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
            CarePort partner onboarding
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-5xl">
            Apply to become a CarePort pharmacy or rider partner
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
            Submit your application for review. Applications do not go live automatically.
            Ambulant+ reviews pharmacy KYB/KYC and rider KYI before enabling marketplace
            fulfilment, eRx collection, pickup or delivery operations.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {[
              'Submit application',
              'Admin reviews KYC/KYI',
              'Approval unlocks operations',
              'Payout readiness is monitored',
            ].map((step, index) => (
              <div key={step} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Step {index + 1}
                </div>
                <div className="mt-2 text-sm font-semibold text-emerald-950">{step}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <aside className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Choose application type</h2>
              <div className="mt-4 grid gap-3">
                <button
                  type="button"
                  onClick={() => patch('partnerType', 'pharmacy')}
                  className={
                    'rounded-2xl border px-4 py-4 text-left transition ' +
                    (isPharmacy
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
                  }
                >
                  <div className="font-semibold">Pharmacy partner</div>
                  <div className="mt-1 text-sm">
                    For registered pharmacies supplying OTC marketplace items or fulfilling eRx orders.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => patch('partnerType', 'rider')}
                  className={
                    'rounded-2xl border px-4 py-4 text-left transition ' +
                    (!isPharmacy
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
                  }
                >
                  <div className="font-semibold">Rider partner</div>
                  <div className="mt-1 text-sm">
                    For pickup and delivery partners supporting pharmacy-to-patient logistics.
                  </div>
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
              <div className="font-semibold">Operational safety note</div>
              <p className="mt-2">
                Submitting this form only creates a pending application. You must be approved
                before you receive orders, dispatch jobs or payout eligibility.
              </p>
            </div>
          </aside>

          <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-semibold text-slate-950">
              {isPharmacy ? 'Pharmacy application' : 'Rider application'}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {isPharmacy
                ? 'We will review your pharmacy registration, responsible contact, location, fulfilment model and payout readiness.'
                : 'We will review your identity, contact details, service area, transport readiness and payout readiness.'}
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {isPharmacy ? (
                <>
                  <Field
                    label="Pharmacy name"
                    required
                    value={form.pharmacyName}
                    onChange={(value) => patch('pharmacyName', value)}
                    placeholder="Example Pharmacy"
                  />
                  <Field
                    label="Responsible contact"
                    value={form.contactName}
                    onChange={(value) => patch('contactName', value)}
                    placeholder="Responsible pharmacist / owner"
                  />
                </>
              ) : (
                <Field
                  label="Full name"
                  required
                  value={form.fullName}
                  onChange={(value) => patch('fullName', value)}
                  placeholder="Full legal name"
                />
              )}

              <Field
                label="Email"
                required
                type="email"
                value={form.email}
                onChange={(value) => patch('email', value)}
                placeholder="name@example.com"
              />
              <Field
                label="Phone"
                required
                value={form.phone}
                onChange={(value) => patch('phone', value)}
                placeholder="+27..."
              />

              {isPharmacy ? (
                <>
                  <Field
                    label="Registration number"
                    value={form.registrationNumber}
                    onChange={(value) => patch('registrationNumber', value)}
                    placeholder="Company / practice registration"
                  />
                  <Field
                    label="SAPC / licence number"
                    value={form.sapcNumber}
                    onChange={(value) => patch('sapcNumber', value)}
                    placeholder="SAPC / licence reference"
                  />
                  <Field
                    label="City"
                    value={form.city}
                    onChange={(value) => patch('city', value)}
                    placeholder="Johannesburg"
                  />
                  <Field
                    label="Payout account mask"
                    value={form.bankAccountMasked}
                    onChange={(value) => patch('bankAccountMasked', value)}
                    placeholder="Bank / last 4 digits only"
                  />
                  <div className="md:col-span-2">
                    <Field
                      label="Physical address"
                      value={form.address}
                      onChange={(value) => patch('address', value)}
                      placeholder="Street address"
                    />
                  </div>
                  <Toggle
                    label="Supports patient pickup"
                    checked={form.supportsPickup}
                    onChange={(checked) => patch('supportsPickup', checked)}
                  />
                  <Toggle
                    label="Supports delivery fulfilment"
                    checked={form.supportsDelivery}
                    onChange={(checked) => patch('supportsDelivery', checked)}
                  />
                  <Toggle
                    label="Accepts card-paid orders"
                    checked={form.acceptsCard}
                    onChange={(checked) => patch('acceptsCard', checked)}
                  />
                  <Toggle
                    label="Interested in medical-aid fulfilment"
                    checked={form.acceptsMedicalAid}
                    onChange={(checked) => patch('acceptsMedicalAid', checked)}
                  />
                </>
              ) : (
                <>
                  <Field
                    label="City"
                    value={form.city}
                    onChange={(value) => patch('city', value)}
                    placeholder="Johannesburg"
                  />
                  <Field
                    label="Service areas"
                    value={form.serviceAreas}
                    onChange={(value) => patch('serviceAreas', value)}
                    placeholder="Sandton, Midrand, Pretoria..."
                  />
                  <Field
                    label="Vehicle type"
                    value={form.vehicleType}
                    onChange={(value) => patch('vehicleType', value)}
                    placeholder="Motorbike, car, bicycle..."
                  />
                  <Field
                    label="Vehicle registration"
                    value={form.vehicleRegistration}
                    onChange={(value) => patch('vehicleRegistration', value)}
                    placeholder="Optional"
                  />
                  <Field
                    label="Payout account mask"
                    value={form.bankAccountMasked}
                    onChange={(value) => patch('bankAccountMasked', value)}
                    placeholder="Bank / last 4 digits only"
                  />
                  <Toggle
                    label="I have my own transport"
                    checked={form.hasOwnTransport}
                    onChange={(checked) => patch('hasOwnTransport', checked)}
                  />
                  <Toggle
                    label="I can follow medicine handling instructions"
                    checked={form.coldChainAware}
                    onChange={(checked) => patch('coldChainAware', checked)}
                  />
                </>
              )}

              <div className="md:col-span-2">
                <TextArea
                  label="Notes for onboarding team"
                  value={form.notes}
                  onChange={(value) => patch('notes', value)}
                  placeholder="Tell us anything we should verify before onboarding."
                />
              </div>
            </div>

            {error ? (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                {error}
              </div>
            ) : null}

            {result ? (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <div className="font-semibold">{result.message || 'Application submitted.'}</div>
                <div className="mt-1">
                  Application reference: <span className="font-mono">{result.applicationId}</span>
                </div>
                <div className="mt-1">Status: {result.status || 'PENDING_REVIEW'}</div>
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-slate-500">
                By submitting, you agree that Ambulant+ may review your information before enabling live operations.
              </p>
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? 'Submitting...' : isPharmacy ? 'Submit pharmacy application' : 'Submit rider application'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}