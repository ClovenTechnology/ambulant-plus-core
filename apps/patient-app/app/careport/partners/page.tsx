'use client';

import React, { useMemo, useState } from 'react';

type PartnerType = 'pharmacy' | 'rider';

type FormState = {
  partnerType: PartnerType;

  displayName: string;
  registeredName: string;
  registrationNumber: string;
  sapcNumber: string;

  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  phone: string;

  address: string;
  city: string;
  province: string;
  country: string;
  currency: string;
  serviceAreas: string;

  saIdNumber: string;
  passportNumber: string;
  passportCountry: string;
  passportExpiry: string;

  vehicleType: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleRegistration: string;
  vehicleColour: string;

  bankName: string;
  accountName: string;
  accountNumber: string;
  branchCode: string;

  notes: string;

  supportsPickup: boolean;
  supportsDelivery: boolean;
  acceptsCard: boolean;
  acceptsMedicalAid: boolean;
  hasOwnTransport: boolean;
  medicineHandlingAcknowledged: boolean;
};

const COUNTRY_OPTIONS = [
  { code: 'ZA', label: 'South Africa', currency: 'ZAR' },
  { code: 'NG', label: 'Nigeria', currency: 'NGN' },
  { code: 'GB', label: 'United Kingdom', currency: 'GBP' },
  { code: 'US', label: 'United States', currency: 'USD' },
  { code: 'CA', label: 'Canada', currency: 'CAD' },
  { code: 'AU', label: 'Australia', currency: 'AUD' },
];

const BANKS_BY_COUNTRY: Record<string, string[]> = {
  ZA: [
    'FNB',
    'Capitec',
    'ABSA',
    'Discovery Bank',
    'Nedbank',
    'African Bank',
    'TymeBank',
    'Investec',
    'Standard Bank',
    'Bidvest Bank',
    'Other',
  ],
  NG: ['Access Bank', 'GTBank', 'Zenith Bank', 'UBA', 'First Bank', 'Kuda', 'Opay', 'Moniepoint', 'Other'],
  GB: ['Barclays', 'HSBC', 'Lloyds', 'NatWest', 'Santander', 'Monzo', 'Starling', 'Other'],
  US: ['Bank of America', 'Chase', 'Citi', 'Wells Fargo', 'Capital One', 'Other'],
  CA: ['RBC', 'TD', 'Scotiabank', 'BMO', 'CIBC', 'Other'],
  AU: ['Commonwealth Bank', 'ANZ', 'Westpac', 'NAB', 'Other'],
};

const VEHICLE_TYPES = ['Car', 'Motorbike', 'Scooter', 'Bicycle', 'Van', 'On foot', 'Other'];

function yearOptions() {
  const now = new Date().getFullYear();
  const years: string[] = [];

  for (let year = now + 1; year >= 1990; year -= 1) {
    years.push(String(year));
  }

  return years;
}

const INITIAL_FORM: FormState = {
  partnerType: 'pharmacy',

  displayName: '',
  registeredName: '',
  registrationNumber: '',
  sapcNumber: '',

  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  phone: '',

  address: '',
  city: '',
  province: '',
  country: 'ZA',
  currency: 'ZAR',
  serviceAreas: '',

  saIdNumber: '',
  passportNumber: '',
  passportCountry: '',
  passportExpiry: '',

  vehicleType: 'Motorbike',
  vehicleMake: '',
  vehicleModel: '',
  vehicleYear: String(new Date().getFullYear()),
  vehicleRegistration: '',
  vehicleColour: '',

  bankName: 'FNB',
  accountName: '',
  accountNumber: '',
  branchCode: '',

  notes: '',

  supportsPickup: true,
  supportsDelivery: true,
  acceptsCard: true,
  acceptsMedicalAid: false,
  hasOwnTransport: true,
  medicineHandlingAcknowledged: false,
};

function currencyForCountry(country: string) {
  return COUNTRY_OPTIONS.find((item) => item.code === country)?.currency || 'ZAR';
}

function banksForCountry(country: string) {
  return BANKS_BY_COUNTRY[country] || ['Other'];
}

function prettyError(value?: string) {
  return String(value || 'Application could not be submitted. Please check the form and try again.')
    .replace(/_/g, ' ');
}

function joinName(form: FormState) {
  return [form.firstName, form.middleName, form.lastName].map((x) => x.trim()).filter(Boolean).join(' ');
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read image.'));
    reader.readAsDataURL(file);
  });
}

async function prepareIdentityImage(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }

  if (file.size > 1_500_000) {
    throw new Error('Image is too large. Please choose an image under 1.5MB.');
  }

  return readAsDataUrl(file);
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

function SelectField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">
        {props.label}
        {props.required ? <span className="text-rose-600"> *</span> : null}
      </span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
      >
        {props.children}
      </select>
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
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [imageFileName, setImageFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const isPharmacy = form.partnerType === 'pharmacy';
  const isSouthAfrican = form.country === 'ZA';

  const endpoint = useMemo(
    () =>
      isPharmacy
        ? '/api/careport/partners/pharmacy/apply'
        : '/api/careport/partners/rider/apply',
    [isPharmacy],
  );

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value };

      if (key === 'country') {
        next.currency = currencyForCountry(String(value));
        const banks = banksForCountry(String(value));
        next.bankName = banks.includes(current.bankName) ? current.bankName : banks[0];
      }

      return next;
    });
  }

  async function handleIdentityImage(file: File | null) {
    if (!file) return;

    setError(null);

    try {
      const dataUrl = await prepareIdentityImage(file);
      setImageDataUrl(dataUrl);
      setImageFileName(file.name);
    } catch (err: any) {
      setImageDataUrl('');
      setImageFileName('');
      setError(err?.message || 'Unable to prepare image.');
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const payload = isPharmacy
        ? {
            displayName: form.displayName,
            tradingName: form.displayName,
            registeredName: form.registeredName,
            registrationNumber: form.registrationNumber,
            sapcNumber: form.sapcNumber,
            contactFirstName: form.firstName,
            contactMiddleName: form.middleName,
            contactLastName: form.lastName,
            email: form.email,
            phone: form.phone,
            address: form.address,
            city: form.city,
            province: form.province,
            country: form.country,
            currency: form.currency,
            serviceAreas: form.serviceAreas,
            bankName: form.bankName,
            accountName: form.accountName,
            accountNumber: form.accountNumber,
            branchCode: form.branchCode,
            logoDataUrl: imageDataUrl,
            supportsPickup: form.supportsPickup,
            supportsDelivery: form.supportsDelivery,
            acceptsCard: form.acceptsCard,
            acceptsMedicalAid: form.acceptsMedicalAid,
            notes: form.notes,
          }
        : {
            firstName: form.firstName,
            middleName: form.middleName,
            lastName: form.lastName,
            fullName: joinName(form),
            email: form.email,
            phone: form.phone,
            address: form.address,
            city: form.city,
            province: form.province,
            country: form.country,
            currency: form.currency,
            serviceAreas: form.serviceAreas,
            saIdNumber: form.saIdNumber,
            passportNumber: form.passportNumber,
            passportCountry: form.passportCountry,
            passportExpiry: form.passportExpiry,
            vehicleType: form.vehicleType,
            vehicleMake: form.vehicleMake,
            vehicleModel: form.vehicleModel,
            vehicleYear: form.vehicleYear,
            vehicleRegistration: form.vehicleRegistration,
            vehicleColour: form.vehicleColour,
            bankName: form.bankName,
            accountName: form.accountName,
            accountNumber: form.accountNumber,
            branchCode: form.branchCode,
            avatarDataUrl: imageDataUrl,
            hasOwnTransport: form.hasOwnTransport,
            medicineHandlingAcknowledged: form.medicineHandlingAcknowledged,
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
        country: current.country,
        currency: current.currency,
        bankName: current.bankName,
      }));
      setImageDataUrl('');
      setImageFileName('');
    } catch (err: any) {
      setError(err?.message || 'Application could not be submitted.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main data-p-ui="patient-careport-partners-page" className="min-w-0 overflow-x-clip min-h-screen bg-slate-50">
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
                ? 'We will review your pharmacy logo, registration, responsible contact, location, fulfilment model and payout readiness.'
                : 'We will review your profile photo, identity, contact details, service area, transport readiness and payout readiness.'}
            </p>

            <section className="mt-6 grid gap-4 rounded-2xl border border-slate-100 p-4 md:grid-cols-[160px_1fr]">
              <div>
                <h3 className="text-sm font-bold text-slate-950">
                  {isPharmacy ? 'Pharmacy logo' : 'Profile photo'}
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {isPharmacy
                    ? 'Upload the logo patients, admin and clinicians will recognise.'
                    : 'Upload a clear rider photo for admin review, delivery handover and patient visibility.'}
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                  {imageDataUrl ? (
                    <img src={imageDataUrl} alt="CarePort partner identity preview" className="h-full w-full object-cover" />
                  ) : (
                    <span className="px-2 text-center text-xs text-slate-400">
                      {isPharmacy ? 'Logo preview' : 'Photo preview'}
                    </span>
                  )}
                </div>
                <div>
                  <label className="inline-flex cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    Choose image
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(event) => void handleIdentityImage(event.target.files?.[0] || null)}
                    />
                  </label>
                  <p className="mt-2 text-xs text-slate-500">
                    PNG, JPG or WEBP. Keep file under 1.5MB.
                    {imageFileName ? ` Selected: ${imageFileName}` : ''}
                  </p>
                </div>
              </div>
            </section>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {isPharmacy ? (
                <>
                  <Field label="Display / trading name" required value={form.displayName} onChange={(value) => patch('displayName', value)} placeholder="Example Pharmacy" />
                  <Field label="Registered legal name" required value={form.registeredName} onChange={(value) => patch('registeredName', value)} placeholder="Registered company name" />
                  <Field label="Registration number" value={form.registrationNumber} onChange={(value) => patch('registrationNumber', value)} placeholder="Company / practice registration" />
                  <Field label="SAPC / licence number" value={form.sapcNumber} onChange={(value) => patch('sapcNumber', value)} placeholder="SAPC / licence reference" />
                  <Field label="Responsible contact first name" value={form.firstName} onChange={(value) => patch('firstName', value)} />
                  <Field label="Responsible contact middle name" value={form.middleName} onChange={(value) => patch('middleName', value)} />
                  <Field label="Responsible contact last name" value={form.lastName} onChange={(value) => patch('lastName', value)} />
                </>
              ) : (
                <>
                  <Field label="First name" required value={form.firstName} onChange={(value) => patch('firstName', value)} />
                  <Field label="Middle name" value={form.middleName} onChange={(value) => patch('middleName', value)} />
                  <Field label="Last name" required value={form.lastName} onChange={(value) => patch('lastName', value)} />
                </>
              )}

              <Field label="Email" required type="email" value={form.email} onChange={(value) => patch('email', value)} placeholder="name@example.com" />
              <Field label="Phone" required value={form.phone} onChange={(value) => patch('phone', value)} placeholder="+27..." />
              <Field label="Address" value={form.address} onChange={(value) => patch('address', value)} placeholder="Street / facility address" />
              <Field label="City" value={form.city} onChange={(value) => patch('city', value)} placeholder="Johannesburg" />
              <Field label="Province" value={form.province} onChange={(value) => patch('province', value)} placeholder="Gauteng" />
              <Field label="Service areas" value={form.serviceAreas} onChange={(value) => patch('serviceAreas', value)} placeholder="Sandton, Rosebank, Randburg" />

              <SelectField label="Country" value={form.country} onChange={(value) => patch('country', value)}>
                {COUNTRY_OPTIONS.map((item) => (
                  <option key={item.code} value={item.code}>{item.label}</option>
                ))}
              </SelectField>
              <Field label="Currency" value={form.currency} onChange={(value) => patch('currency', value)} />
            </div>

            {!isPharmacy ? (
              <section className="mt-6">
                <h3 className="text-sm font-bold text-slate-950">Identity and vehicle details</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {isSouthAfrican ? (
                    <Field label="South African ID number" value={form.saIdNumber} onChange={(value) => patch('saIdNumber', value)} />
                  ) : (
                    <>
                      <Field label="Passport number" value={form.passportNumber} onChange={(value) => patch('passportNumber', value)} />
                      <Field label="Passport country" value={form.passportCountry} onChange={(value) => patch('passportCountry', value)} />
                      <Field label="Passport expiry" type="date" value={form.passportExpiry} onChange={(value) => patch('passportExpiry', value)} />
                    </>
                  )}

                  <SelectField label="Vehicle type" value={form.vehicleType} onChange={(value) => patch('vehicleType', value)}>
                    {VEHICLE_TYPES.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </SelectField>
                  <SelectField label="Vehicle year" value={form.vehicleYear} onChange={(value) => patch('vehicleYear', value)}>
                    {yearOptions().map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </SelectField>
                  <Field label="Vehicle make" value={form.vehicleMake} onChange={(value) => patch('vehicleMake', value)} placeholder="Toyota" />
                  <Field label="Vehicle model" value={form.vehicleModel} onChange={(value) => patch('vehicleModel', value)} placeholder="Corolla" />
                  <Field label="Vehicle registration" value={form.vehicleRegistration} onChange={(value) => patch('vehicleRegistration', value)} placeholder="ABC 123 GP" />
                  <Field label="Vehicle colour" value={form.vehicleColour} onChange={(value) => patch('vehicleColour', value)} placeholder="White" />
                  <Toggle label="I have my own transport" checked={form.hasOwnTransport} onChange={(checked) => patch('hasOwnTransport', checked)} />
                  <Toggle label="I acknowledge medicine-handling and handover instructions" checked={form.medicineHandlingAcknowledged} onChange={(checked) => patch('medicineHandlingAcknowledged', checked)} />
                </div>
              </section>
            ) : null}

            <section className="mt-6">
              <h3 className="text-sm font-bold text-slate-950">Payout details</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <SelectField label="Bank name" required value={form.bankName} onChange={(value) => patch('bankName', value)}>
                  {banksForCountry(form.country).map((bank) => (
                    <option key={bank} value={bank}>{bank}</option>
                  ))}
                </SelectField>
                <Field label="Account name" required value={form.accountName} onChange={(value) => patch('accountName', value)} placeholder={isPharmacy ? form.displayName : joinName(form)} />
                <Field label="Account number" required value={form.accountNumber} onChange={(value) => patch('accountNumber', value)} placeholder="Full account number" />
                <Field label="Branch code" value={form.branchCode} onChange={(value) => patch('branchCode', value)} placeholder="Branch code" />
              </div>
            </section>

            {isPharmacy ? (
              <section className="mt-6 grid gap-4 md:grid-cols-2">
                <Toggle label="Supports patient pickup" checked={form.supportsPickup} onChange={(checked) => patch('supportsPickup', checked)} />
                <Toggle label="Supports delivery fulfilment" checked={form.supportsDelivery} onChange={(checked) => patch('supportsDelivery', checked)} />
                <Toggle label="Accepts card-paid orders" checked={form.acceptsCard} onChange={(checked) => patch('acceptsCard', checked)} />
                <Toggle label="Interested in medical-aid fulfilment" checked={form.acceptsMedicalAid} onChange={(checked) => patch('acceptsMedicalAid', checked)} />
              </section>
            ) : null}

            <div className="mt-6">
              <TextArea
                label="Notes for onboarding team"
                value={form.notes}
                onChange={(value) => patch('notes', value)}
                placeholder="Tell us anything we should verify before onboarding."
              />
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