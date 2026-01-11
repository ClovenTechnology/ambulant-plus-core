'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  BadgeCheck,
  Landmark,
  CreditCard,
  Save,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';

type PracticeProfileDraft = {
  legalName: string;
  tradingName: string;
  practiceNumber: string;
  regulatorHint: string; // e.g. "HPCSA practice / facility" (placeholder)
  description: string;

  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;

  contactPhone: string;
  contactEmail: string;
  website: string;

  taxNumber: string;
  billingContactName: string;
  billingEmail: string;
  billingPhone: string;

  bankName: string;
  bankAccountName: string;
  bankAccountNumberMasked: string; // store masked only in UI draft
  bankBranchCode: string;
};

const STORAGE_KEY = 'ambulant.practice.profile.draft.v1';

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(' ');
}

function Card({
  title,
  subtitle,
  icon,
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl border border-gray-200 bg-gray-50 p-2 text-gray-700">
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-gray-600">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  type = 'text',
  autoComplete,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-end justify-between gap-2">
        <span className="text-xs font-medium text-gray-800">{label}</span>
        {hint ? <span className="text-[11px] text-gray-500">{hint}</span> : null}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-0 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
      />
    </label>
  );
}

function TextArea({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-end justify-between gap-2">
        <span className="text-xs font-medium text-gray-800">{label}</span>
        {hint ? <span className="text-[11px] text-gray-500">{hint}</span> : null}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="mt-1 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-0 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
      />
    </label>
  );
}

function Pill({
  tone,
  children,
}: {
  tone: 'neutral' | 'good' | 'warn' | 'bad';
  children: React.ReactNode;
}) {
  const cls =
    tone === 'good'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : tone === 'bad'
          ? 'border-rose-200 bg-rose-50 text-rose-800'
          : 'border-gray-200 bg-gray-50 text-gray-800';

  return (
    <span className={cx('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium', cls)}>
      {children}
    </span>
  );
}

async function tryPublish(endpoint: string, payload: unknown) {
  try {
    const res = await fetch(endpoint, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false as const, error: `HTTP ${res.status}${txt ? ` — ${txt}` : ''}` };
    }
    return { ok: true as const };
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Network error' };
  }
}

const DEFAULT_DRAFT: PracticeProfileDraft = {
  legalName: '',
  tradingName: '',
  practiceNumber: '',
  regulatorHint: '',
  description: '',

  addressLine1: '',
  addressLine2: '',
  city: '',
  province: '',
  postalCode: '',
  country: 'South Africa',

  contactPhone: '',
  contactEmail: '',
  website: '',

  taxNumber: '',
  billingContactName: '',
  billingEmail: '',
  billingPhone: '',

  bankName: '',
  bankAccountName: '',
  bankAccountNumberMasked: '',
  bankBranchCode: '',
};

export default function PracticeProfilePage() {
  const [draft, setDraft] = useState<PracticeProfileDraft>(DEFAULT_DRAFT);
  const [loaded, setLoaded] = useState(false);

  const [status, setStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'savedLocal'; at: number }
    | { kind: 'publishing' }
    | { kind: 'published'; at: number }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  const snapshot = useMemo(() => JSON.stringify(draft), [draft]);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string>('');
  const dirty = loaded && snapshot !== lastSavedSnapshot;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PracticeProfileDraft;
        setDraft({ ...DEFAULT_DRAFT, ...(parsed || {}) });
        setLastSavedSnapshot(JSON.stringify({ ...DEFAULT_DRAFT, ...(parsed || {}) }));
      } else {
        setLastSavedSnapshot(JSON.stringify(DEFAULT_DRAFT));
      }
    } catch {
      setLastSavedSnapshot(JSON.stringify(DEFAULT_DRAFT));
    } finally {
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveLocal = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      setLastSavedSnapshot(JSON.stringify(draft));
      setStatus({ kind: 'savedLocal', at: Date.now() });
    } catch {
      setStatus({ kind: 'error', message: 'Could not save draft locally (storage blocked).' });
    }
  };

  const resetLocal = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setDraft(DEFAULT_DRAFT);
    setLastSavedSnapshot(JSON.stringify(DEFAULT_DRAFT));
    setStatus({ kind: 'idle' });
  };

  const publish = async () => {
    setStatus({ kind: 'publishing' });
    // Safe, optional endpoint: if you later add it, this page automatically goes “live”
    const resp = await tryPublish('/api/practice/profile', draft);
    if (resp.ok) setStatus({ kind: 'published', at: Date.now() });
    else setStatus({ kind: 'error', message: `Publish failed: ${resp.error}` });
  };

  return (
    <main className="space-y-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm md:text-base font-semibold text-gray-900">Practice Profile</h2>
            {dirty ? <Pill tone="warn">Unsaved changes</Pill> : <Pill tone="good">Up to date</Pill>}
          </div>
          <p className="mt-1 text-xs text-gray-600">
            Manage your hosted practice identity. This is structured to map cleanly to <span className="font-medium">Practice</span> &amp;{' '}
            <span className="font-medium">PracticeMember</span> when you wire it.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/practices"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50"
          >
            <ExternalLink className="h-4 w-4" />
            Back to Practices
          </Link>

          <button
            onClick={resetLocal}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50"
            type="button"
          >
            <RefreshCw className="h-4 w-4" />
            Reset
          </button>

          <button
            onClick={saveLocal}
            disabled={!dirty}
            className={cx(
              'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold',
              dirty
                ? 'border border-gray-900 bg-gray-900 text-white hover:bg-black'
                : 'border border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed'
            )}
            type="button"
          >
            <Save className="h-4 w-4" />
            Save draft
          </button>

          <button
            onClick={publish}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            type="button"
          >
            <BadgeCheck className="h-4 w-4" />
            Publish
          </button>
        </div>
      </header>

      {status.kind !== 'idle' ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-3 text-xs">
          {status.kind === 'savedLocal' ? (
            <div className="flex items-start gap-2 text-gray-700">
              <BadgeCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
              <div>
                <div className="font-medium text-gray-900">Draft saved locally</div>
                <div className="text-gray-600">Safe fallback until your Practice API endpoints are ready.</div>
              </div>
            </div>
          ) : null}
          {status.kind === 'publishing' ? (
            <div className="flex items-start gap-2 text-gray-700">
              <RefreshCw className="mt-0.5 h-4 w-4 animate-spin text-gray-700" />
              <div>
                <div className="font-medium text-gray-900">Publishing…</div>
                <div className="text-gray-600">Attempting PUT /api/practice/profile</div>
              </div>
            </div>
          ) : null}
          {status.kind === 'published' ? (
            <div className="flex items-start gap-2 text-gray-700">
              <BadgeCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
              <div>
                <div className="font-medium text-gray-900">Published</div>
                <div className="text-gray-600">Server accepted the update.</div>
              </div>
            </div>
          ) : null}
          {status.kind === 'error' ? (
            <div className="flex items-start gap-2 text-gray-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
              <div>
                <div className="font-medium text-gray-900">Could not publish</div>
                <div className="text-gray-600">{status.message}</div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          title="Identity"
          subtitle="How your practice appears across the platform."
          icon={<Building2 className="h-4 w-4" />}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field
              label="Legal name"
              value={draft.legalName}
              onChange={(v) => setDraft((d) => ({ ...d, legalName: v }))}
              placeholder="e.g. Example Health (Pty) Ltd"
              autoComplete="organization"
            />
            <Field
              label="Trading name"
              value={draft.tradingName}
              onChange={(v) => setDraft((d) => ({ ...d, tradingName: v }))}
              placeholder="e.g. Example Family Practice"
            />
            <Field
              label="Practice number"
              hint="If applicable"
              value={draft.practiceNumber}
              onChange={(v) => setDraft((d) => ({ ...d, practiceNumber: v }))}
              placeholder="e.g. PR-123456"
            />
            <Field
              label="Regulator / registry hint"
              hint="Placeholder"
              value={draft.regulatorHint}
              onChange={(v) => setDraft((d) => ({ ...d, regulatorHint: v }))}
              placeholder="e.g. HPCSA / BHF / Facility registry"
            />
          </div>

          <div className="mt-3">
            <TextArea
              label="Short description"
              hint="1–2 lines (recommended)"
              value={draft.description}
              onChange={(v) => setDraft((d) => ({ ...d, description: v }))}
              placeholder="Primary care practice focused on preventive care, chronic management, and telehealth follow-ups."
            />
          </div>
        </Card>

        <Card
          title="Address"
          subtitle="Used for invoices, visit notes, referrals, and routing."
          icon={<MapPin className="h-4 w-4" />}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field
              label="Address line 1"
              value={draft.addressLine1}
              onChange={(v) => setDraft((d) => ({ ...d, addressLine1: v }))}
              placeholder="Street + number"
              autoComplete="address-line1"
            />
            <Field
              label="Address line 2"
              value={draft.addressLine2}
              onChange={(v) => setDraft((d) => ({ ...d, addressLine2: v }))}
              placeholder="Suite / building (optional)"
              autoComplete="address-line2"
            />
            <Field
              label="City"
              value={draft.city}
              onChange={(v) => setDraft((d) => ({ ...d, city: v }))}
              placeholder="e.g. Johannesburg"
              autoComplete="address-level2"
            />
            <Field
              label="Province"
              value={draft.province}
              onChange={(v) => setDraft((d) => ({ ...d, province: v }))}
              placeholder="e.g. Gauteng"
              autoComplete="address-level1"
            />
            <Field
              label="Postal code"
              value={draft.postalCode}
              onChange={(v) => setDraft((d) => ({ ...d, postalCode: v }))}
              placeholder="e.g. 2001"
              autoComplete="postal-code"
            />
            <Field
              label="Country"
              value={draft.country}
              onChange={(v) => setDraft((d) => ({ ...d, country: v }))}
              placeholder="South Africa"
              autoComplete="country-name"
            />
          </div>
        </Card>

        <Card
          title="Public contact"
          subtitle="Optional. Helps patients and partners reach the practice."
          icon={<Phone className="h-4 w-4" />}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field
              label="Phone"
              value={draft.contactPhone}
              onChange={(v) => setDraft((d) => ({ ...d, contactPhone: v }))}
              placeholder="+27 …"
              autoComplete="tel"
            />
            <Field
              label="Email"
              value={draft.contactEmail}
              onChange={(v) => setDraft((d) => ({ ...d, contactEmail: v }))}
              placeholder="frontdesk@practice.co.za"
              type="email"
              autoComplete="email"
            />
            <div className="md:col-span-2">
              <Field
                label="Website"
                value={draft.website}
                onChange={(v) => setDraft((d) => ({ ...d, website: v }))}
                placeholder="https://…"
                autoComplete="url"
              />
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 text-gray-700" />
              <div>
                <div className="font-medium text-gray-900">Tip</div>
                <p className="mt-0.5 text-gray-600">
                  Keep billing contacts separate from public contacts. That makes reconciliation &amp; insurer comms cleaner.
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card
          title="Billing & tax"
          subtitle="Used for invoices, payouts, and compliance checks."
          icon={<Landmark className="h-4 w-4" />}
          right={<Pill tone="neutral">Draft-safe</Pill>}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field
              label="Tax number"
              value={draft.taxNumber}
              onChange={(v) => setDraft((d) => ({ ...d, taxNumber: v }))}
              placeholder="e.g. VAT / Tax ID"
            />
            <Field
              label="Billing contact name"
              value={draft.billingContactName}
              onChange={(v) => setDraft((d) => ({ ...d, billingContactName: v }))}
              placeholder="e.g. Accounts Department"
            />
            <Field
              label="Billing email"
              value={draft.billingEmail}
              onChange={(v) => setDraft((d) => ({ ...d, billingEmail: v }))}
              placeholder="accounts@practice.co.za"
              type="email"
            />
            <Field
              label="Billing phone"
              value={draft.billingPhone}
              onChange={(v) => setDraft((d) => ({ ...d, billingPhone: v }))}
              placeholder="+27 …"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field
              label="Bank name"
              value={draft.bankName}
              onChange={(v) => setDraft((d) => ({ ...d, bankName: v }))}
              placeholder="e.g. FNB"
            />
            <Field
              label="Account name"
              value={draft.bankAccountName}
              onChange={(v) => setDraft((d) => ({ ...d, bankAccountName: v }))}
              placeholder="Account holder"
            />
            <Field
              label="Account number (masked)"
              hint="Store masked only"
              value={draft.bankAccountNumberMasked}
              onChange={(v) => setDraft((d) => ({ ...d, bankAccountNumberMasked: v }))}
              placeholder="****1234"
            />
            <Field
              label="Branch code"
              value={draft.bankBranchCode}
              onChange={(v) => setDraft((d) => ({ ...d, bankBranchCode: v }))}
              placeholder="e.g. 250655"
            />
          </div>

          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
            <div className="flex items-start gap-2">
              <CreditCard className="mt-0.5 h-4 w-4 text-amber-700" />
              <div>
                <div className="font-medium">Security note</div>
                <p className="mt-0.5 text-amber-900/80">
                  This UI draft stores only masked banking info. When you wire the real backend, store full bank details in a secure vault / encrypted column,
                  and restrict access to admins with explicit audit logs.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <footer className="rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-600">
        <div className="flex items-start gap-2">
          <Globe className="mt-0.5 h-4 w-4 text-gray-700" />
          <div>
            <div className="font-medium text-gray-900">Next wiring targets</div>
            <ul className="mt-1 list-disc pl-4 space-y-1">
              <li>GET/PUT: <span className="font-mono">/api/practice/profile</span> (Practice)</li>
              <li>GET: <span className="font-mono">/api/practice/members</span> (PracticeMember)</li>
              <li>Audit: record who updated what, when, and from which org/practice scope</li>
            </ul>
          </div>
        </div>
      </footer>
    </main>
  );
}
