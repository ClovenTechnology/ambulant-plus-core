// apps/medreach/app/auth/signup/page.tsx
'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';

type ApplicantType = 'lab' | 'phleb';

type FormState = {
  applicantType: ApplicantType;

  name: string;
  fullName: string;
  email: string;
  phone: string;
  contact: string;

  country: string;
  currency: string;

  registrationNumber: string;
  accreditationBody: string;
  address: string;
  city: string;
  province: string;

  qualification: string;
  serviceAreas: string;
  preferredLabIds: string;
  defaultLabId: string;

  vehicleType: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleRegistration: string;
  vehicleColor: string;
  hasOwnTransport: boolean;
  hasColdChainBag: boolean;
  experienceYears: string;

  payoutLast4: string;
  notes: string;
};

const initialState: FormState = {
  applicantType: 'lab',

  name: '',
  fullName: '',
  email: '',
  phone: '',
  contact: '',

  country: 'ZA',
  currency: 'ZAR',

  registrationNumber: '',
  accreditationBody: '',
  address: '',
  city: '',
  province: '',

  qualification: '',
  serviceAreas: '',
  preferredLabIds: '',
  defaultLabId: '',

  vehicleType: '',
  vehicleMake: '',
  vehicleModel: '',
  vehicleRegistration: '',
  vehicleColor: '',
  hasOwnTransport: false,
  hasColdChainBag: false,
  experienceYears: '',

  payoutLast4: '',
  notes: '',
};

function clean(value: string) {
  return value.trim();
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs font-medium text-gray-600">
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </span>
      <input
        value={value}
        type={type}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded border px-3 py-2 text-sm"
        placeholder={placeholder}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <textarea
        value={value}
        rows={3}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded border px-3 py-2 text-sm"
        placeholder={placeholder}
      />
    </label>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export default function MedReachSignupPage() {
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const isLab = form.applicantType === 'lab';

  const readiness = useMemo(() => {
    if (isLab) {
      return [
        clean(form.name),
        clean(form.email) || clean(form.phone) || clean(form.contact),
        clean(form.serviceAreas),
      ].filter(Boolean).length;
    }

    return [
      clean(form.fullName),
      clean(form.email) || clean(form.phone),
      clean(form.qualification),
      clean(form.serviceAreas),
      clean(form.vehicleType) || form.hasOwnTransport,
    ].filter(Boolean).length;
  }, [form, isLab]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitting(true);
    setNotice(null);
    setErr(null);
    setReference(null);

    try {
      const endpoint = isLab ? '/api/onboarding/lab' : '/api/onboarding/phleb';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      const id =
        json?.data?.id ||
        json?.id ||
        json?.data?.phleb?.id ||
        json?.data?.lab?.id ||
        json?.profile?.id ||
        json?.lab?.id ||
        null;

      setReference(id ? String(id) : null);
      setNotice(
        isLab
          ? 'Lab application submitted for admin review.'
          : 'Phleb KYI application submitted for admin review.',
      );

      setForm((prev) => ({
        ...initialState,
        applicantType: prev.applicantType,
        country: prev.country,
        currency: prev.currency,
      }));
    } catch (error: any) {
      setErr(error?.message || 'Unable to submit MedReach application');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <section className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-950">
              MedReach partner application
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-600">
              Apply as a lab partner or field phlebotomist. Submitting this form does
              not make the account live. MedReach admin must review KYB/KYC/KYI,
              payout and operational readiness before activation.
            </p>
          </div>

          <Link
            href="/"
            className="rounded-full border bg-white px-3 py-1 text-xs hover:bg-gray-50"
          >
            Back to MedReach
          </Link>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-xs font-medium text-gray-500">Application type</div>
            <div className="mt-1 text-xl font-semibold">
              {isLab ? 'Lab partner' : 'Phlebotomist'}
            </div>
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-xs font-medium text-gray-500">Initial completeness</div>
            <div className="mt-1 text-xl font-semibold">
              {readiness}/{isLab ? 3 : 5}
            </div>
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-xs font-medium text-gray-500">Admin state after submit</div>
            <div className="mt-1 text-xl font-semibold">Pending review</div>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-2 text-xs">
            {(['lab', 'phleb'] as ApplicantType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => set('applicantType', type)}
                className={`rounded-full border px-4 py-2 ${
                  form.applicantType === type
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {type === 'lab' ? 'Apply as lab partner' : 'Apply as phleb'}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            This is an intake form, not final go-live approval. Admin-dashboard remains
            the authority for approval, rejection, pause, suspension and operational
            release.
          </div>
        </section>

        {notice ? (
          <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="font-semibold">{notice}</div>
            {reference ? (
              <div className="mt-1">
                Reference: <span className="font-mono">{reference}</span>
              </div>
            ) : null}
          </section>
        ) : null}

        {err ? (
          <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            <div className="font-semibold">Submission failed</div>
            <div className="mt-1">{err}</div>
          </section>
        ) : null}

        <form onSubmit={submit} className="space-y-6 rounded-2xl border bg-white p-5 shadow-sm">
          {isLab ? (
            <>
              <section>
                <h2 className="text-sm font-semibold text-gray-950">
                  Lab organisation details
                </h2>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field
                    label="Lab name"
                    value={form.name}
                    required
                    onChange={(value) => set('name', value)}
                    placeholder="Example Diagnostics"
                  />
                  <Field
                    label="Primary contact name"
                    value={form.contact}
                    onChange={(value) => set('contact', value)}
                    placeholder="Responsible person"
                  />
                  <Field
                    label="Email"
                    type="email"
                    value={form.email}
                    onChange={(value) => set('email', value)}
                    placeholder="lab@example.com"
                  />
                  <Field
                    label="Phone"
                    value={form.phone}
                    onChange={(value) => set('phone', value)}
                    placeholder="+27..."
                  />
                  <Field
                    label="Registration number"
                    value={form.registrationNumber}
                    onChange={(value) => set('registrationNumber', value)}
                    placeholder="Company / practice registration"
                  />
                  <Field
                    label="Accreditation body"
                    value={form.accreditationBody}
                    onChange={(value) => set('accreditationBody', value)}
                    placeholder="SANAS / other"
                  />
                </div>
              </section>

              <section>
                <h2 className="text-sm font-semibold text-gray-950">
                  Location and coverage
                </h2>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field
                    label="Address"
                    value={form.address}
                    onChange={(value) => set('address', value)}
                    placeholder="Street / facility address"
                  />
                  <Field
                    label="City"
                    value={form.city}
                    onChange={(value) => set('city', value)}
                    placeholder="Johannesburg"
                  />
                  <Field
                    label="Province"
                    value={form.province}
                    onChange={(value) => set('province', value)}
                    placeholder="Gauteng"
                  />
                  <Field
                    label="Service areas"
                    value={form.serviceAreas}
                    onChange={(value) => set('serviceAreas', value)}
                    placeholder="Sandton, Rosebank, Randburg"
                  />
                </div>
              </section>
            </>
          ) : (
            <>
              <section>
                <h2 className="text-sm font-semibold text-gray-950">
                  Phleb identity and contact
                </h2>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field
                    label="Full name"
                    value={form.fullName}
                    required
                    onChange={(value) => set('fullName', value)}
                    placeholder="Full legal name"
                  />
                  <Field
                    label="Qualification"
                    value={form.qualification}
                    onChange={(value) => set('qualification', value)}
                    placeholder="Phlebotomy qualification / experience"
                  />
                  <Field
                    label="Email"
                    type="email"
                    value={form.email}
                    onChange={(value) => set('email', value)}
                    placeholder="phleb@example.com"
                  />
                  <Field
                    label="Phone"
                    value={form.phone}
                    onChange={(value) => set('phone', value)}
                    placeholder="+27..."
                  />
                </div>
              </section>

              <section>
                <h2 className="text-sm font-semibold text-gray-950">
                  Field operations
                </h2>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field
                    label="Service areas"
                    value={form.serviceAreas}
                    onChange={(value) => set('serviceAreas', value)}
                    placeholder="Sandton, Rosebank, Randburg"
                  />
                  <Field
                    label="Preferred lab IDs"
                    value={form.preferredLabIds}
                    onChange={(value) => set('preferredLabIds', value)}
                    placeholder="lab-id-1, lab-id-2"
                  />
                  <Field
                    label="Default lab ID"
                    value={form.defaultLabId}
                    onChange={(value) => set('defaultLabId', value)}
                    placeholder="Optional"
                  />
                  <Field
                    label="Experience years"
                    type="number"
                    value={form.experienceYears}
                    onChange={(value) => set('experienceYears', value)}
                    placeholder="2"
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Checkbox
                    label="Has own transport"
                    checked={form.hasOwnTransport}
                    onChange={(value) => set('hasOwnTransport', value)}
                  />
                  <Checkbox
                    label="Has cold-chain bag"
                    checked={form.hasColdChainBag}
                    onChange={(value) => set('hasColdChainBag', value)}
                  />
                </div>
              </section>

              <section>
                <h2 className="text-sm font-semibold text-gray-950">
                  Vehicle / transport
                </h2>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Field
                    label="Vehicle type"
                    value={form.vehicleType}
                    onChange={(value) => set('vehicleType', value)}
                    placeholder="Car, bike, scooter"
                  />
                  <Field
                    label="Make"
                    value={form.vehicleMake}
                    onChange={(value) => set('vehicleMake', value)}
                    placeholder="Toyota"
                  />
                  <Field
                    label="Model"
                    value={form.vehicleModel}
                    onChange={(value) => set('vehicleModel', value)}
                    placeholder="Corolla"
                  />
                  <Field
                    label="Registration"
                    value={form.vehicleRegistration}
                    onChange={(value) => set('vehicleRegistration', value)}
                    placeholder="ABC 123 GP"
                  />
                  <Field
                    label="Colour"
                    value={form.vehicleColor}
                    onChange={(value) => set('vehicleColor', value)}
                    placeholder="White"
                  />
                </div>
              </section>
            </>
          )}

          <section>
            <h2 className="text-sm font-semibold text-gray-950">
              Country, currency and payout reference
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field
                label="Country"
                value={form.country}
                onChange={(value) => set('country', value)}
                placeholder="ZA"
              />
              <Field
                label="Currency"
                value={form.currency}
                onChange={(value) => set('currency', value)}
                placeholder="ZAR"
              />
              <Field
                label="Payout account last 4"
                value={form.payoutLast4}
                onChange={(value) => set('payoutLast4', value)}
                placeholder="1234"
              />
            </div>
          </section>

          <TextArea
            label="Notes for MedReach admin"
            value={form.notes}
            onChange={(value) => set('notes', value)}
            placeholder="Anything admin should verify during onboarding"
          />

          <div className="flex flex-col gap-3 border-t pt-5 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-gray-500">
              By submitting, the applicant enters pending review. Admin approval is
              required before operational access.
            </p>

            <button
              type="submit"
              disabled={submitting}
              className={`rounded border px-5 py-2 text-sm ${
                submitting
                  ? 'bg-gray-200 text-gray-500'
                  : 'bg-gray-900 text-white hover:bg-black'
              }`}
            >
              {submitting ? 'Submitting...' : 'Submit application'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}