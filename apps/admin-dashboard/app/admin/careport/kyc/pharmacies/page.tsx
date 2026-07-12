'use client';

import { useEffect, useMemo, useState } from 'react';

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

const STATUS_OPTIONS = ['PENDING_REVIEW', 'APPROVED', 'REJECTED'];

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

      setRows(Array.isArray(payload.pharmacies) ? payload.pharmacies : []);
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

  async function decide(row: PharmacyKycRow, decision: 'approve' | 'reject') {
    const reason = reasons[row.id]?.trim() || '';

    if (decision === 'reject' && !reason) {
      setError('Please enter a rejection reason before rejecting this pharmacy.');
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
          body: JSON.stringify({ decision, reason }),
        },
      );

      const payload = await res.json().catch(() => ({}));

      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || 'Failed to save pharmacy KYC decision.');
      }

      setNotice(
        decision === 'approve'
          ? 'Pharmacy KYC approved.'
          : 'Pharmacy KYC rejected with reason recorded.',
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
                Pharmacy KYB / KYC review
              </h1>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
                Review pharmacy partner KYC submissions, operational details, evidence payloads and rejection history
                before enabling trusted marketplace and fulfilment participation.
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
                      placeholder="Reason required for rejection"
                      className="min-h-[92px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => decide(row, 'approve')}
                        disabled={busyId === row.id}
                        className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Approve
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