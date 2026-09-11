'use client';

import { useEffect, useMemo, useState } from 'react';

type PharmacyComplianceProfile = {
  version?: string;
  institution?: {
    registeredName?: string | null;
    registrationNumber?: string | null;
    legalForm?: string | null;
  };
  premises?: {
    pharmacyCategory?: string | null;
    yNumber?: string | null;
    premisesLicenceNumber?: string | null;
    licenceIssuedAt?: string | null;
    licenceExpiresAt?: string | null;
  };
  responsiblePharmacist?: {
    fullName?: string | null;
    pNumber?: string | null;
    registrationNumber?: string | null;
    registrationExpiresAt?: string | null;
  };
  medicalScheme?: {
    claimsEnabled?: boolean;
    pcnsPracticeNumber?: string | null;
    pcnsExpiresAt?: string | null;
  };
  sahpra?: {
    required?: boolean;
    operations?: string[];
    licenceNumber?: string | null;
    licenceExpiresAt?: string | null;
  };
  coldChain?: {
    required?: boolean;
    capable?: boolean;
    monitoringMethod?: string | null;
    minTempC?: number | null;
    maxTempC?: number | null;
    validationExpiresAt?: string | null;
  };
  review?: {
    notes?: string | null;
    updatedAt?: string | null;
  };
};

type PharmacyComplianceItem = {
  code: string;
  label: string;
  authority: string;
  required: boolean;
  present: boolean;
  applicable: boolean;
  expiresAt?: string | null;
  status: string;
  enforcementPoint: string;
  enforcementScope: string;
};

type PharmacyCapabilityReadiness = {
  applicable?: boolean;
  ready?: boolean;
  missing?: string[];
};

type PharmacyComplianceSummary = {
  version?: string;
  readyForRegulatedFulfilment?: boolean;
  missingForRegulatedFulfilment?: string[];
  capabilities?: {
    medicalSchemeClaims?: PharmacyCapabilityReadiness;
    sahpraRegulatedOperations?: PharmacyCapabilityReadiness;
    coldChainFulfilment?: PharmacyCapabilityReadiness;
  };
  items?: PharmacyComplianceItem[];
};

type PharmacyKycRow = {
  id: string;
  name?: string | null;
  contact?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  currency?: string | null;
  kycStatus?: string | null;
  kycSchemaKey?: string | null;
  kycSubmittedAt?: string | null;
  kycVerifiedAt?: string | null;
  kycRejectedReason?: string | null;
  kycPayload?: unknown;
  complianceProfile?: PharmacyComplianceProfile | null;
  complianceSummary?: PharmacyComplianceSummary | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type PharmacyKycPayload = {
  ok?: boolean;
  error?: string;
  orgId?: string;
  country?: string;
  status?: string;
  pharmacies?: PharmacyKycRow[];
};

const STATUS_OPTIONS = ['PENDING_REVIEW', 'NEEDS_MORE_INFO', 'LIMITED', 'APPROVED', 'REJECTED'];

function dateText(value?: string | null) {
  if (!value) return 'Not recorded';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function statusClass(value?: string | null) {
  const status = String(value || '').toUpperCase();

  if (status === 'APPROVED') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'REJECTED') return 'border-rose-200 bg-rose-50 text-rose-800';
  if (status === 'LIMITED') return 'border-blue-200 bg-blue-50 text-blue-800';
  if (status === 'NEEDS_MORE_INFO') return 'border-violet-200 bg-violet-50 text-violet-800';

  return 'border-amber-200 bg-amber-50 text-amber-900';
}

function prettyJson(value: unknown) {
  if (value == null || value === '') return 'No payload supplied.';

  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}


function asReviewRecord(value: unknown): Record<string, any> {
  if (!value) return {};

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function reviewPath(source: unknown, path: string[]) {
  let current: any = asReviewRecord(source);

  for (const part of path) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[part];
  }

  return current;
}

function reviewText(source: unknown, path: string[], fallback = 'Not recorded') {
  const value = reviewPath(source, path);

  if (Array.isArray(value)) {
    const joined = value.map((item) => String(item ?? '').trim()).filter(Boolean).join(', ');
    return joined || fallback;
  }

  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  const text = String(value ?? '').trim();
  return text || fallback;
}

function maskedAccountFromPayload(payload: unknown, fallback?: unknown) {
  const last4 = reviewText(payload, ['payout', 'accountNumberLast4'], '').replace(/\D/g, '').slice(-4);

  if (last4) return `****${last4}`;

  const fallbackText = String(fallback ?? '').trim();
  return fallbackText || 'Not recorded';
}

function ReviewField({ label, value }: { label: string; value: unknown }) {
  const text = Array.isArray(value)
    ? value.map((item) => String(item ?? '').trim()).filter(Boolean).join(', ')
    : typeof value === 'boolean'
      ? value ? 'Yes' : 'No'
      : String(value ?? '').trim();

  return (
    <div className="rounded-xl border border-slate-100 bg-white px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-slate-900">{text || 'Not recorded'}</dd>
    </div>
  );
}

function PharmacyEnterpriseReview({ row }: { row: PharmacyKycRow }) {
  const payload = asReviewRecord(row.kycPayload);
  const logoUrl = reviewText(payload, ['visualIdentity', 'logoUrl'], '');
  const organisation = asReviewRecord(reviewPath(payload, ['organisationIdentity']));
  const contact = asReviewRecord(reviewPath(payload, ['responsibleContact']));
  const location = asReviewRecord(reviewPath(payload, ['location']));
  const operatingModel = asReviewRecord(reviewPath(payload, ['operatingModel']));
  const payout = asReviewRecord(reviewPath(payload, ['payout']));

  return (
    <div className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 xl:flex-1">
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="w-full lg:w-40">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Pharmacy logo preview
          </div>
          <div className="mt-2 flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border border-emerald-100 bg-white">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Pharmacy logo preview" className="h-full w-full object-cover" />
            ) : (
              <span className="px-3 text-center text-xs text-slate-400">No logo supplied</span>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Organisation identity</h3>
            <dl className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <ReviewField label="Display / trading name" value={organisation.displayName || organisation.tradingName || row.name} />
              <ReviewField label="Registered name" value={organisation.registeredName || organisation.legalName} />
              <ReviewField label="Registration number" value={organisation.registrationNumber} />
              <ReviewField label="SAPC / licence" value={organisation.sapcNumber} />
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Responsible contact</h3>
            <dl className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <ReviewField label="First name" value={contact.firstName} />
              <ReviewField label="Middle name" value={contact.middleName} />
              <ReviewField label="Last name" value={contact.lastName} />
              <ReviewField label="Email / phone" value={[contact.email, contact.phone].filter(Boolean).join(' / ') || row.contact} />
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Location, fulfilment and payout</h3>
            <dl className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <ReviewField label="Address" value={location.address || row.address} />
              <ReviewField label="City / province" value={[location.city || row.city, location.province].filter(Boolean).join(', ')} />
              <ReviewField label="Service areas" value={location.serviceAreas} />
              <ReviewField label="Pickup / delivery" value={`Pickup: ${operatingModel.supportsPickup === false ? 'No' : 'Yes'} / Delivery: ${operatingModel.supportsDelivery === false ? 'No' : 'Yes'}`} />
              <ReviewField label="Card / medical aid" value={`Card: ${operatingModel.acceptsCard === false ? 'No' : 'Yes'} / Medical aid: ${operatingModel.acceptsMedicalAid ? 'Yes' : 'No'}`} />
              <ReviewField label="Bank name" value={payout.bankName} />
              <ReviewField label="Account name" value={payout.accountName} />
              <ReviewField label="Account / branch" value={`${maskedAccountFromPayload(payload)} / ${payout.branchCode || 'No branch code'}`} />
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}


function dateInputValue(value?: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function complianceTone(status?: string | null) {
  const value = String(status || '').toUpperCase();
  if (value === 'PRESENT') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (value === 'NOT_APPLICABLE') return 'border-slate-200 bg-slate-50 text-slate-600';
  if (value === 'EXPIRY_UNKNOWN') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (value === 'EXPIRED') return 'border-rose-200 bg-rose-50 text-rose-800';
  return 'border-violet-200 bg-violet-50 text-violet-800';
}

function PharmacyComplianceReview({
  row,
  draft,
  onChange,
}: {
  row: PharmacyKycRow;
  draft: PharmacyComplianceProfile;
  onChange: (section: keyof PharmacyComplianceProfile, field: string, value: unknown) => void;
}) {
  const summary = row.complianceSummary;
  const institution = draft.institution || {};
  const premises = draft.premises || {};
  const rp = draft.responsiblePharmacist || {};
  const medicalScheme = draft.medicalScheme || {};
  const sahpra = draft.sahpra || {};
  const coldChain = draft.coldChain || {};

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400';

  return (
    <section className="mt-5 rounded-3xl border border-sky-200 bg-sky-50/40 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            A7-C2 pharmacy compliance
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">
            Institution, premises, professional and capability assurance
          </h3>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            Registration numbers, licences and professional registrations are deliberately separate.
            Approval enables regulated CarePort fulfilment; Limited / Needs more info keeps the partner
            workspace available without enabling dispensing or fulfilment privileges.
          </p>
        </div>

        <div
          className={
            'rounded-full border px-3 py-1 text-xs font-semibold ' +
            (summary?.readyForRegulatedFulfilment
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-200 bg-amber-50 text-amber-900')
          }
        >
          {summary?.readyForRegulatedFulfilment ? 'Ready for regulated fulfilment review' : 'Compliance facts incomplete'}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {[
          ['Medical-scheme claims', summary?.capabilities?.medicalSchemeClaims],
          ['SAHPRA-regulated operations', summary?.capabilities?.sahpraRegulatedOperations],
          ['Cold-chain fulfilment', summary?.capabilities?.coldChainFulfilment],
        ].map(([label, capability]) => {
          const value = capability as PharmacyCapabilityReadiness | undefined;
          const text = !value?.applicable ? 'Not applicable' : value.ready ? 'Cleared' : 'Not cleared';
          const cls = !value?.applicable
            ? 'border-slate-200 bg-slate-50 text-slate-600'
            : value.ready
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-200 bg-amber-50 text-amber-900';

          return (
            <div key={String(label)} className={'rounded-2xl border px-3 py-2 text-xs ' + cls}>
              <span className="font-semibold">{String(label)}</span>
              <span className="ml-2">{text}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-950">Institution & pharmacy premises</h4>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-xs font-medium text-slate-600">
              Registered / legal name
              <input
                className={inputClass}
                value={institution.registeredName || ''}
                onChange={(e) => onChange('institution', 'registeredName', e.target.value)}
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Business registration number
              <input
                className={inputClass}
                value={institution.registrationNumber || ''}
                onChange={(e) => onChange('institution', 'registrationNumber', e.target.value)}
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Pharmacy category
              <select
                className={inputClass}
                value={premises.pharmacyCategory || ''}
                onChange={(e) => onChange('premises', 'pharmacyCategory', e.target.value)}
              >
                <option value="">Not recorded</option>
                <option value="COMMUNITY">Community</option>
                <option value="INSTITUTIONAL_PRIVATE">Institutional — private</option>
                <option value="INSTITUTIONAL_PUBLIC">Institutional — public</option>
                <option value="CONSULTANT">Consultant</option>
                <option value="WHOLESALE">Wholesale</option>
                <option value="MANUFACTURING">Manufacturing</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              SAPC pharmacy Y-number
              <input
                className={inputClass}
                value={premises.yNumber || ''}
                onChange={(e) => onChange('premises', 'yNumber', e.target.value)}
                placeholder="Y..."
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              NDoH pharmacy premises licence
              <input
                className={inputClass}
                value={premises.premisesLicenceNumber || ''}
                onChange={(e) => onChange('premises', 'premisesLicenceNumber', e.target.value)}
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Premises licence expiry / review date
              <input
                type="date"
                className={inputClass}
                value={dateInputValue(premises.licenceExpiresAt)}
                onChange={(e) => onChange('premises', 'licenceExpiresAt', e.target.value || null)}
              />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-950">Responsible pharmacist</h4>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-xs font-medium text-slate-600">
              Responsible pharmacist name
              <input
                className={inputClass}
                value={rp.fullName || ''}
                onChange={(e) => onChange('responsiblePharmacist', 'fullName', e.target.value)}
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              SAPC P-number / registration
              <input
                className={inputClass}
                value={rp.pNumber || rp.registrationNumber || ''}
                onChange={(e) => onChange('responsiblePharmacist', 'pNumber', e.target.value)}
                placeholder="P..."
              />
            </label>
            <label className="text-xs font-medium text-slate-600 md:col-span-2">
              Registration expiry / review date
              <input
                type="date"
                className={inputClass}
                value={dateInputValue(rp.registrationExpiresAt)}
                onChange={(e) => onChange('responsiblePharmacist', 'registrationExpiresAt', e.target.value || null)}
              />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-950">Conditional funding & establishment controls</h4>
          <div className="mt-3 space-y-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(medicalScheme.claimsEnabled)}
                onChange={(e) => onChange('medicalScheme', 'claimsEnabled', e.target.checked)}
              />
              Medical-scheme claims enabled — PCNS applies to this capability
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs font-medium text-slate-600">
                PCNS practice number
                <input
                  className={inputClass}
                  value={medicalScheme.pcnsPracticeNumber || ''}
                  onChange={(e) => onChange('medicalScheme', 'pcnsPracticeNumber', e.target.value)}
                  disabled={!medicalScheme.claimsEnabled}
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                PCNS renewal / expiry
                <input
                  type="date"
                  className={inputClass}
                  value={dateInputValue(medicalScheme.pcnsExpiresAt)}
                  onChange={(e) => onChange('medicalScheme', 'pcnsExpiresAt', e.target.value || null)}
                  disabled={!medicalScheme.claimsEnabled}
                />
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(sahpra.required)}
                onChange={(e) => onChange('sahpra', 'required', e.target.checked)}
              />
              SAHPRA section 22C licence applies to this pharmacy’s activities
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs font-medium text-slate-600">
                SAHPRA licence number
                <input
                  className={inputClass}
                  value={sahpra.licenceNumber || ''}
                  onChange={(e) => onChange('sahpra', 'licenceNumber', e.target.value)}
                  disabled={!sahpra.required}
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                SAHPRA licence expiry
                <input
                  type="date"
                  className={inputClass}
                  value={dateInputValue(sahpra.licenceExpiresAt)}
                  onChange={(e) => onChange('sahpra', 'licenceExpiresAt', e.target.value || null)}
                  disabled={!sahpra.required}
                />
              </label>
              <label className="text-xs font-medium text-slate-600 md:col-span-2">
                Applicable operations
                <input
                  className={inputClass}
                  value={(sahpra.operations || []).join(', ')}
                  onChange={(e) =>
                    onChange(
                      'sahpra',
                      'operations',
                      e.target.value.split(',').map((item) => item.trim()).filter(Boolean),
                    )
                  }
                  placeholder="WHOLESALE, DISTRIBUTION, MANUFACTURE, IMPORT, EXPORT"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-950">Cold-chain capability</h4>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Only enable this requirement where the pharmacy will fulfil temperature-sensitive products.
          </p>
          <div className="mt-3 space-y-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(coldChain.required)}
                onChange={(e) => onChange('coldChain', 'required', e.target.checked)}
              />
              Cold-chain fulfilment required
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(coldChain.capable)}
                onChange={(e) => onChange('coldChain', 'capable', e.target.checked)}
                disabled={!coldChain.required}
              />
              Validated cold-chain capability available
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs font-medium text-slate-600">
                Temperature monitoring method
                <input
                  className={inputClass}
                  value={coldChain.monitoringMethod || ''}
                  onChange={(e) => onChange('coldChain', 'monitoringMethod', e.target.value)}
                  disabled={!coldChain.required}
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Validation expiry / review
                <input
                  type="date"
                  className={inputClass}
                  value={dateInputValue(coldChain.validationExpiresAt)}
                  onChange={(e) => onChange('coldChain', 'validationExpiresAt', e.target.value || null)}
                  disabled={!coldChain.required}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {(summary?.items || []).map((item) => (
          <div key={item.code} className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-900">{item.label}</p>
                <p className="mt-1 text-[11px] text-slate-500">{item.authority}</p>
              </div>
              <span className={'rounded-full border px-2 py-0.5 text-[10px] font-semibold ' + complianceTone(item.status)}>
                {item.status}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              {item.applicable ? item.enforcementScope.replace(/_/g, ' ') : 'Not applicable to current capability'}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600">
        <strong>Control separation:</strong> NDoH pharmacy premises licence, SAPC Y-number, responsible-pharmacist
        registration, PCNS and SAHPRA licences are not interchangeable. PCNS applies to medical-scheme claims;
        SAHPRA section 22C is conditional on regulated establishment activities; cold chain applies only to
        temperature-sensitive fulfilment.
      </div>
    </section>
  );
}


function searchable(row: PharmacyKycRow) {
  return [
    row.id,
    row.name,
    row.contact,
    row.address,
    row.city,
    row.country,
    row.currency,
    row.kycStatus,
    row.kycSchemaKey,
    row.kycRejectedReason,
    prettyJson(row.kycPayload),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export default function CarePortPharmacyKycReviewPage() {
  const [rows, setRows] = useState<PharmacyKycRow[]>([]);
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [country, setCountry] = useState('ZA');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [complianceDrafts, setComplianceDrafts] = useState<Record<string, PharmacyComplianceProfile>>({});

  async function loadRows() {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        status,
        country,
        limit: '100',
      });

      const res = await fetch('/api/careport/admin/kyc/pharmacies?' + params.toString(), {
        cache: 'no-store',
      });

      const payload = (await res.json()) as PharmacyKycPayload;

      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || 'Failed to load pharmacy KYC submissions.');
      }

      const pharmacies = Array.isArray(payload.pharmacies) ? payload.pharmacies : [];
      setRows(pharmacies);
      setComplianceDrafts(
        Object.fromEntries(
          pharmacies.map((row) => [row.id, row.complianceProfile || {}]),
        ),
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to load pharmacy KYC submissions.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
  }, [status, country]);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;

    return rows.filter((row) => searchable(row).includes(needle));
  }, [query, rows]);

  const counts = useMemo(() => {
    const approved = rows.filter((row) => String(row.kycStatus).toUpperCase() === 'APPROVED').length;
    const rejected = rows.filter((row) => String(row.kycStatus).toUpperCase() === 'REJECTED').length;
    const pending = rows.length - approved - rejected;

    return { total: rows.length, pending, approved, rejected };
  }, [rows]);

  function patchComplianceDraft(
    rowId: string,
    section: keyof PharmacyComplianceProfile,
    field: string,
    value: unknown,
  ) {
    setComplianceDrafts((current) => {
      const base = current[rowId] || {};
      const sectionValue =
        base[section] && typeof base[section] === 'object'
          ? (base[section] as Record<string, unknown>)
          : {};

      return {
        ...current,
        [rowId]: {
          ...base,
          [section]: {
            ...sectionValue,
            [field]: value,
          },
        },
      };
    });
  }

  async function decide(
    row: PharmacyKycRow,
    decision: 'approve' | 'limited' | 'needs_more_info' | 'reject',
  ) {
    const reason = reasons[row.id]?.trim() || '';

    if (decision !== 'approve' && !reason) {
      setError('Please enter a reason for Limited, Needs more info or Rejected decisions.');
      return;
    }

    setBusyId(row.id);
    setError('');
    setNotice('');

    try {
      const res = await fetch(
        '/api/careport/admin/kyc/pharmacies/' + encodeURIComponent(row.id) + '/decision',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            decision,
            reason,
            complianceProfile: complianceDrafts[row.id] || row.complianceProfile || {},
          }),
        },
      );

      const payload = await res.json().catch(() => ({}));

      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || 'Failed to save pharmacy KYC decision.');
      }

      setNotice(
        decision === 'approve'
          ? 'Pharmacy compliance approved for regulated CarePort fulfilment.'
          : decision === 'limited'
            ? 'Pharmacy retained in limited workspace mode; regulated fulfilment remains disabled.'
            : decision === 'needs_more_info'
              ? 'Pharmacy marked as needing more compliance information.'
              : 'Pharmacy application rejected with reason recorded.',
      );

      setReasons((current) => ({ ...current, [row.id]: '' }));
      await loadRows();
    } catch (err: any) {
      setError(err?.message || 'Failed to save pharmacy KYC decision.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                CarePort KYC governance
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
                Pharmacy KYB / KYP compliance review
              </h1>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
                Review institution identity, pharmacy-premises licensing, responsible-pharmacist assurance and
                capability-specific evidence before enabling regulated CarePort fulfilment. Workspace access remains
                separate from dispensing and fulfilment privileges.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="/admin/careport/kyc"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                KYC hub
              </a>
              <a
                href="/admin/careport/kyc/riders"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Rider review
              </a>
              <a
                href="/admin/careport"
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                CarePort admin
              </a>
            </div>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Loaded</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{counts.total}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Pending</p>
            <p className="mt-2 text-2xl font-bold text-amber-950">{counts.pending}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Approved</p>
            <p className="mt-2 text-2xl font-bold text-emerald-950">{counts.approved}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Rejected</p>
            <p className="mt-2 text-2xl font-bold text-rose-950">{counts.rejected}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_160px_auto]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search pharmacy name, city, contact, status or rejection reason"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
            />

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
            >
              {STATUS_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <input
              value={country}
              onChange={(event) => setCountry(event.target.value.toUpperCase())}
              placeholder="ZA"
              maxLength={3}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm uppercase outline-none focus:border-slate-400"
            />

            <button
              type="button"
              onClick={loadRows}
              disabled={loading}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {notice ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {notice}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {error}
            </div>
          ) : null}
        </section>

        <section className="space-y-4">
          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              Loading pharmacy KYC submissions...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              No pharmacy KYC submissions matched this filter.
            </div>
          ) : (
            filteredRows.map((row) => (
              <article key={row.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-slate-950">
                        {row.name || 'Unnamed pharmacy'}
                      </h2>
                      <span className={'rounded-full border px-3 py-1 text-xs font-semibold ' + statusClass(row.kycStatus)}>
                        {row.kycStatus || 'PENDING_REVIEW'}
                      </span>
                    </div>

                    <dl className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <dt className="font-medium text-slate-400">Contact</dt>
                        <dd className="mt-1 text-slate-900">{row.contact || 'Not recorded'}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-400">Location</dt>
                        <dd className="mt-1 text-slate-900">
                          {[row.city, row.country].filter(Boolean).join(', ') || 'Not recorded'}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-400">Submitted</dt>
                        <dd className="mt-1 text-slate-900">{dateText(row.kycSubmittedAt)}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-400">Verified</dt>
                        <dd className="mt-1 text-slate-900">{dateText(row.kycVerifiedAt)}</dd>
                      </div>
                    </dl>

                    {row.address ? (
                      <p className="mt-3 text-sm text-slate-600">
                        <span className="font-medium text-slate-400">Address:</span> {row.address}
                      </p>
                    ) : null}

                    {row.kycRejectedReason ? (
                      <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
                        <span className="font-semibold">Previous rejection reason:</span> {row.kycRejectedReason}
                      </div>
                    ) : null}
                  </div>

                  <PharmacyEnterpriseReview row={row} />

                  <div className="w-full space-y-3 xl:w-80">
                    <textarea
                      value={reasons[row.id] || ''}
                      onChange={(event) =>
                        setReasons((current) => ({ ...current, [row.id]: event.target.value }))
                      }
                      placeholder="Reason for Limited / Needs more info / Reject"
                      className="min-h-[92px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => decide(row, 'approve')}
                        disabled={busyId === row.id}
                        className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Approve fulfilment
                      </button>
                      <button
                        type="button"
                        onClick={() => decide(row, 'needs_more_info')}
                        disabled={busyId === row.id}
                        className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Needs more info
                      </button>
                      <button
                        type="button"
                        onClick={() => decide(row, 'limited')}
                        disabled={busyId === row.id}
                        className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Limited workspace
                      </button>
                      <button
                        type="button"
                        onClick={() => decide(row, 'reject')}
                        disabled={busyId === row.id}
                        className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>

                <PharmacyComplianceReview
                  row={row}
                  draft={complianceDrafts[row.id] || row.complianceProfile || {}}
                  onChange={(section, field, value) =>
                    patchComplianceDraft(row.id, section, field, value)
                  }
                />

                <details className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                    View submitted KYC payload
                  </summary>
                  <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                    {prettyJson(row.kycPayload)}
                  </pre>
                </details>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
