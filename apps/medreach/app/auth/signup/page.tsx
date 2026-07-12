'use client';

import React, { FormEvent, useEffect, useMemo, useState } from 'react';

type ApplicantType = 'lab' | 'phleb';

type LabOption = {
  id: string;
  name: string;
  displayName?: string | null;
  city?: string | null;
  province?: string | null;
};

type FormState = {
  applicantType: ApplicantType;

  displayName: string;
  registeredName: string;
  registrationNumber: string;
  accreditationBody: string;

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

  qualification: string;
  hpcsaNumber: string;
  preferredLabIds: string[];

  vehicleType: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleRegistration: string;
  vehicleColour: string;
  hasOwnTransport: boolean;
  hasColdChainBag: boolean;

  bankName: string;
  accountName: string;
  accountNumber: string;
  branchCode: string;

  notes: string;
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
  applicantType: 'lab',
  displayName: '',
  registeredName: '',
  registrationNumber: '',
  accreditationBody: '',

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

  qualification: '',
  hpcsaNumber: '',
  preferredLabIds: [],

  vehicleType: 'Car',
  vehicleMake: '',
  vehicleModel: '',
  vehicleYear: String(new Date().getFullYear()),
  vehicleRegistration: '',
  vehicleColour: '',
  hasOwnTransport: true,
  hasColdChainBag: false,

  bankName: 'FNB',
  accountName: '',
  accountNumber: '',
  branchCode: '',

  notes: '',
};

function currencyForCountry(country: string) {
  return COUNTRY_OPTIONS.find((item) => item.code === country)?.currency || 'ZAR';
}

function banksForCountry(country: string) {
  return BANKS_BY_COUNTRY[country] || ['Other'];
}

function prettyError(value?: string) {
  return String(value || 'Unable to submit application. Please check the form and try again.')
    .replace(/_/g, ' ');
}

function joinName(form: FormState) {
  return [form.firstName, form.middleName, form.lastName].map((x) => x.trim()).filter(Boolean).join(' ');
}

function normaliseItems(input: any): LabOption[] {
  const rows = Array.isArray(input?.data)
    ? input.data
    : Array.isArray(input?.labs)
      ? input.labs
      : Array.isArray(input?.items)
        ? input.items
        : Array.isArray(input)
          ? input
          : [];

  return rows
    .map((row: any) => ({
      id: String(row?.id || '').trim(),
      name: String(row?.displayName || row?.name || row?.id || '').trim(),
      displayName: row?.displayName || row?.name || null,
      city: row?.city || row?.metadata?.city || null,
      province: row?.province || row?.metadata?.province || null,
    }))
    .filter((row: LabOption) => row.id && row.name);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

async function prepareImageDataUrl(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }

  if (file.size > 1_500_000) {
    throw new Error('Image is too large. Please choose an image under 1.5MB.');
  }

  return readAsDataUrl(file);
}

async function prepareEvidenceFile(file: File) {
  const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

  if (!allowed.includes(file.type)) {
    throw new Error('Evidence must be PDF, PNG, JPG or WEBP.');
  }

  if (file.size > 1_500_000) {
    throw new Error('Evidence file is too large for inline onboarding. Use a smaller file.');
  }

  return readAsDataUrl(file);
}

function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-700">
        {props.label}
        {props.required ? <span className="text-rose-600"> *</span> : null}
      </span>
      <input
        type={props.type || 'text'}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
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
      <span className="text-xs font-semibold text-slate-700">
        {props.label}
        {props.required ? <span className="text-rose-600"> *</span> : null}
      </span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
      >
        {props.children}
      </select>
    </label>
  );
}

function Toggle(props: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-300"
      />
      <span>{props.label}</span>
    </label>
  );
}

export default function MedReachSignupPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [labs, setLabs] = useState<LabOption[]>([]);
  const [labsLoading, setLabsLoading] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [imageFileName, setImageFileName] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceFileName, setEvidenceFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const isLab = form.applicantType === 'lab';
  const isSouthAfrican = form.country === 'ZA';

  useEffect(() => {
    let active = true;

    async function loadLabs() {
      setLabsLoading(true);

      try {
        const res = await fetch('/api/labs?active=true&limit=200', { cache: 'no-store' });
        const payload = await res.json().catch(() => null);

        if (active && res.ok) {
          setLabs(normaliseItems(payload));
        }
      } catch {
        if (active) setLabs([]);
      } finally {
        if (active) setLabsLoading(false);
      }
    }

    void loadLabs();

    return () => {
      active = false;
    };
  }, []);

  const completion = useMemo(() => {
    const required = isLab
      ? [form.displayName, form.registeredName, form.registrationNumber, form.email || form.phone, form.bankName, form.accountName, form.accountNumber, imageDataUrl]
      : [form.firstName, form.lastName, form.email || form.phone, form.qualification, form.bankName, form.accountName, form.accountNumber, imageDataUrl];

    return {
      done: required.filter(Boolean).length,
      total: required.length,
    };
  }, [form, imageDataUrl, isLab]);

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

    setError('');

    try {
      const dataUrl = await prepareImageDataUrl(file);
      setImageDataUrl(dataUrl);
      setImageFileName(file.name);
    } catch (err: any) {
      setImageDataUrl('');
      setImageFileName('');
      setError(err?.message || 'Unable to prepare image.');
    }
  }

  async function submitEvidence(applicationId: string, subjectType: ApplicantType) {
    if (!evidenceFile || !applicationId) return;

    const fileDataUrl = await prepareEvidenceFile(evidenceFile);

    const documentType = subjectType === 'lab' ? 'LAB_KYB_DOCUMENT' : 'PHLEB_QUALIFICATION_OR_HPCSA';

    const res = await fetch('/api/onboarding/evidence', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        subjectType,
        subjectId: applicationId,
        applicantRef: applicationId,
        documentType,
        fileName: evidenceFile.name,
        mimeType: evidenceFile.type,
        sizeBytes: evidenceFile.size,
        fileDataUrl,
        notes: 'Submitted from MedReach enterprise signup form.',
      }),
    });

    const payload = await res.json().catch(() => null);

    if (!res.ok || payload?.ok === false) {
      throw new Error(prettyError(payload?.error || 'evidence_upload_failed'));
    }
  }

  function resolveApplicationId(payload: any) {
    return (
      payload?.data?.id ||
      payload?.lab?.id ||
      payload?.phleb?.id ||
      payload?.applicationId ||
      payload?.id ||
      ''
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const endpoint = isLab ? '/api/onboarding/lab' : '/api/onboarding/phleb';

      const body = isLab
        ? {
            displayName: form.displayName,
            tradingName: form.displayName,
            registeredName: form.registeredName,
            registrationNumber: form.registrationNumber,
            accreditationBody: form.accreditationBody,
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
            saIdNumber: form.saIdNumber,
            passportNumber: form.passportNumber,
            passportCountry: form.passportCountry,
            passportExpiry: form.passportExpiry,
            qualification: form.qualification,
            hpcsaNumber: form.hpcsaNumber,
            serviceAreas: form.serviceAreas,
            preferredLabIds: form.preferredLabIds,
            vehicleType: form.vehicleType,
            vehicleMake: form.vehicleMake,
            vehicleModel: form.vehicleModel,
            vehicleYear: form.vehicleYear,
            vehicleRegistration: form.vehicleRegistration,
            vehicleColour: form.vehicleColour,
            hasOwnTransport: form.hasOwnTransport,
            hasColdChainBag: form.hasColdChainBag,
            bankName: form.bankName,
            accountName: form.accountName,
            accountNumber: form.accountNumber,
            branchCode: form.branchCode,
            avatarDataUrl: imageDataUrl,
            notes: form.notes,
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || payload?.ok === false) {
        throw new Error(prettyError(payload?.error));
      }

      const applicationId = resolveApplicationId(payload);

      if (evidenceFile && applicationId) {
        await submitEvidence(applicationId, form.applicantType);
      }

      setNotice(
        `${isLab ? 'Lab' : 'Phlebotomist'} application submitted for admin review.${
          evidenceFile && applicationId ? ' Supporting evidence was uploaded.' : ''
        }${applicationId ? ` Application reference: ${applicationId}` : ''}`,
      );

      setForm((current) => ({
        ...INITIAL_FORM,
        applicantType: current.applicantType,
        country: current.country,
        currency: current.currency,
        bankName: current.bankName,
      }));
      setImageDataUrl('');
      setImageFileName('');
      setEvidenceFile(null);
      setEvidenceFileName('');
    } catch (err: any) {
      setError(err?.message || 'Unable to submit application.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <section className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">MedReach</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Partner application</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Apply as a lab partner or field phlebotomist. This is an intake form only.
              Admin must review identity, evidence, payout and operational readiness before activation.
            </p>
          </div>
          <a href="/" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
            Back to MedReach
          </a>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold text-slate-500">Application type</div>
            <div className="mt-2 text-xl font-bold text-slate-950">{isLab ? 'Lab partner' : 'Phlebotomist'}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold text-slate-500">Initial completeness</div>
            <div className="mt-2 text-xl font-bold text-slate-950">
              {completion.done}/{completion.total}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold text-slate-500">Admin state after submit</div>
            <div className="mt-2 text-xl font-bold text-slate-950">Pending review</div>
          </div>
        </div>

        <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => patch('applicantType', 'lab')}
              className={
                'rounded-full px-4 py-2 text-sm font-semibold ' +
                (isLab ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-700')
              }
            >
              Apply as lab partner
            </button>
            <button
              type="button"
              onClick={() => patch('applicantType', 'phleb')}
              className={
                'rounded-full px-4 py-2 text-sm font-semibold ' +
                (!isLab ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-700')
              }
            >
              Apply as phleb
            </button>
          </div>

          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This is an intake form, not final go-live approval. Admin remains the authority for
            approval, rejection, pause, suspension and operational release.
          </div>

          <section className="mb-8 grid gap-5 rounded-2xl border border-slate-100 p-4 md:grid-cols-[220px_1fr]">
            <div>
              <h2 className="text-sm font-bold text-slate-950">
                {isLab ? 'Lab logo' : 'Profile photo'}
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {isLab
                  ? 'Upload the logo patients, clinicians and admin will recognise.'
                  : 'Upload a clear profile photo for jobs, admin review and patient visibility.'}
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                {imageDataUrl ? (
                  <img src={imageDataUrl} alt="Identity preview" className="h-full w-full object-cover" />
                ) : (
                  <span className="px-3 text-center text-xs text-slate-400">
                    {isLab ? 'Logo preview' : 'Photo preview'}
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

          {isLab ? (
            <section className="mb-8">
              <h2 className="mb-4 text-base font-bold text-slate-950">Lab organisation details</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Display / trading name" required value={form.displayName} onChange={(v) => patch('displayName', v)} placeholder="Example Diagnostics" />
                <Field label="Registered legal name" required value={form.registeredName} onChange={(v) => patch('registeredName', v)} placeholder="Registered company name" />
                <Field label="Registration number" required value={form.registrationNumber} onChange={(v) => patch('registrationNumber', v)} placeholder="Company / practice registration" />
                <Field label="Accreditation body" value={form.accreditationBody} onChange={(v) => patch('accreditationBody', v)} placeholder="SANAS / other" />
              </div>
            </section>
          ) : (
            <section className="mb-8">
              <h2 className="mb-4 text-base font-bold text-slate-950">Phleb identity and professional details</h2>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="First name" required value={form.firstName} onChange={(v) => patch('firstName', v)} />
                <Field label="Middle name" value={form.middleName} onChange={(v) => patch('middleName', v)} />
                <Field label="Last name" required value={form.lastName} onChange={(v) => patch('lastName', v)} />
                <Field label="Qualification" required value={form.qualification} onChange={(v) => patch('qualification', v)} placeholder="Phlebotomy qualification / experience" />
                <Field label="HPCSA / professional reference" value={form.hpcsaNumber} onChange={(v) => patch('hpcsaNumber', v)} placeholder="Latest HPCSA or relevant reference" />
              </div>
            </section>
          )}

          <section className="mb-8">
            <h2 className="mb-4 text-base font-bold text-slate-950">Contact and location</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {!isLab ? null : (
                <>
                  <Field label="Primary contact first name" value={form.firstName} onChange={(v) => patch('firstName', v)} />
                  <Field label="Primary contact last name" value={form.lastName} onChange={(v) => patch('lastName', v)} />
                </>
              )}
              <Field label="Email" type="email" value={form.email} onChange={(v) => patch('email', v)} placeholder="name@example.com" />
              <Field label="Phone" value={form.phone} onChange={(v) => patch('phone', v)} placeholder="+27..." />
              <Field label="Address" value={form.address} onChange={(v) => patch('address', v)} placeholder="Street / facility address" />
              <Field label="City" value={form.city} onChange={(v) => patch('city', v)} placeholder="Johannesburg" />
              <Field label="Province" value={form.province} onChange={(v) => patch('province', v)} placeholder="Gauteng" />
              <Field label="Service areas" value={form.serviceAreas} onChange={(v) => patch('serviceAreas', v)} placeholder="Sandton, Rosebank, Randburg" />
              <SelectField label="Country" value={form.country} onChange={(v) => patch('country', v)}>
                {COUNTRY_OPTIONS.map((item) => (
                  <option key={item.code} value={item.code}>{item.label}</option>
                ))}
              </SelectField>
              <Field label="Currency" value={form.currency} onChange={(v) => patch('currency', v)} />
            </div>
          </section>

          {!isLab ? (
            <section className="mb-8">
              <h2 className="mb-4 text-base font-bold text-slate-950">Identity document</h2>
              {isSouthAfrican ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="South African ID number" value={form.saIdNumber} onChange={(v) => patch('saIdNumber', v)} placeholder="ID number" />
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Passport number" value={form.passportNumber} onChange={(v) => patch('passportNumber', v)} />
                  <Field label="Passport country" value={form.passportCountry} onChange={(v) => patch('passportCountry', v)} />
                  <Field label="Passport expiry" type="date" value={form.passportExpiry} onChange={(v) => patch('passportExpiry', v)} />
                </div>
              )}
            </section>
          ) : null}

          {!isLab ? (
            <section className="mb-8">
              <h2 className="mb-4 text-base font-bold text-slate-950">Preferred labs and vehicle</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="text-xs font-semibold text-slate-700">Preferred labs</span>
                  {labsLoading ? (
                    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">Loading onboarded labs...</div>
                  ) : labs.length === 0 ? (
                    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      No onboarded labs are available yet. You can update preferred labs later from profile settings.
                    </div>
                  ) : (
                    <select
                      multiple
                      value={form.preferredLabIds}
                      onChange={(event) =>
                        patch(
                          'preferredLabIds',
                          Array.from(event.currentTarget.selectedOptions).map((option) => option.value),
                        )
                      }
                      className="mt-2 min-h-32 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    >
                      {labs.map((lab) => (
                        <option key={lab.id} value={lab.id}>
                          {lab.displayName || lab.name}
                          {lab.city ? ` - ${lab.city}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </label>

                <SelectField label="Vehicle type" value={form.vehicleType} onChange={(v) => patch('vehicleType', v)}>
                  {VEHICLE_TYPES.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </SelectField>
                <SelectField label="Vehicle year" value={form.vehicleYear} onChange={(v) => patch('vehicleYear', v)}>
                  {yearOptions().map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </SelectField>
                <Field label="Vehicle make" value={form.vehicleMake} onChange={(v) => patch('vehicleMake', v)} placeholder="Toyota" />
                <Field label="Vehicle model" value={form.vehicleModel} onChange={(v) => patch('vehicleModel', v)} placeholder="Corolla" />
                <Field label="Vehicle registration" value={form.vehicleRegistration} onChange={(v) => patch('vehicleRegistration', v)} placeholder="ABC 123 GP" />
                <Field label="Vehicle colour" value={form.vehicleColour} onChange={(v) => patch('vehicleColour', v)} placeholder="White" />
                <Toggle label="Has own transport" checked={form.hasOwnTransport} onChange={(v) => patch('hasOwnTransport', v)} />
                <Toggle label="Has cold-chain bag" checked={form.hasColdChainBag} onChange={(v) => patch('hasColdChainBag', v)} />
              </div>
            </section>
          ) : null}

          <section className="mb-8">
            <h2 className="mb-4 text-base font-bold text-slate-950">Payout details</h2>
            <div className="grid gap-4 md:grid-cols-4">
              <SelectField label="Bank name" required value={form.bankName} onChange={(v) => patch('bankName', v)}>
                {banksForCountry(form.country).map((bank) => (
                  <option key={bank} value={bank}>{bank}</option>
                ))}
              </SelectField>
              <Field label="Account name" required value={form.accountName} onChange={(v) => patch('accountName', v)} placeholder={isLab ? form.displayName : joinName(form)} />
              <Field label="Account number" required value={form.accountNumber} onChange={(v) => patch('accountNumber', v)} placeholder="Full account number" />
              <Field label="Branch code" value={form.branchCode} onChange={(v) => patch('branchCode', v)} placeholder="Branch code" />
            </div>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-base font-bold text-slate-950">Supporting evidence</h2>
            <label className="block rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5">
              <span className="text-sm font-semibold text-slate-800">
                {isLab ? 'Upload KYB/accreditation document' : 'Upload latest HPCSA / qualification document'}
              </span>
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="mt-3 block w-full text-sm text-slate-600"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setEvidenceFile(file);
                  setEvidenceFileName(file?.name || '');
                }}
              />
              <span className="mt-2 block text-xs text-slate-500">
                PDF, PNG, JPG or WEBP. Keep file under 1.5MB.
                {evidenceFileName ? ` Selected: ${evidenceFileName}` : ''}
              </span>
            </label>
          </section>

          <section className="mb-8">
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">Notes for MedReach admin</span>
              <textarea
                value={form.notes}
                onChange={(event) => patch('notes', event.target.value)}
                rows={4}
                placeholder="Anything admin should verify during onboarding"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </label>
          </section>

          {error ? (
            <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
              {error}
            </div>
          ) : null}

          {notice ? (
            <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              {notice}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-slate-500">
              By submitting, the applicant enters pending review. Admin approval is required before operational access.
            </p>
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Submitting...' : 'Submit application'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}