'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  SlidersHorizontal,
  Percent,
  ShieldCheck,
  Receipt,
  Users,
  Bell,
  Save,
  RefreshCw,
  AlertTriangle,
  BadgeCheck,
  Plus,
  X,
} from 'lucide-react';

type SplitPolicy = {
  defaultClinicianPct: number; // 0..100
  defaultPracticePct: number; // derived / optional override
  applyTo: Array<'consults' | 'reports' | 'procedures'>;
  perServiceOverrides: Array<{ serviceKey: string; clinicianPct: number }>;
};

type ClaimRules = {
  requireEvidenceForClaims: boolean;
  autoBlockProhibitedClaims: boolean;
  allow“OutOfScope”NonClinical: boolean; // for Class C style roles
  prohibitedClaims: string[];
};

type FeeTemplate = {
  key: string;
  label: string;
  baseConsultFeeZar: number;
  followUpFeeZar: number;
  afterHoursSurchargePct: number;
  cancellationFeeZar: number;
  notes: string;
};

type StaffInvite = {
  id: string;
  email: string;
  role: 'admin' | 'billing' | 'assistant' | 'frontdesk';
};

type NotificationPrefs = {
  notifyOnBooking: boolean;
  notifyOnPayment: boolean;
  notifyOnClaimChange: boolean;
  dailyDigest: boolean;
};

type PracticeSettingsDraft = {
  splitPolicy: SplitPolicy;
  claimRules: ClaimRules;
  feeTemplates: FeeTemplate[];
  staffInvites: StaffInvite[];
  notifications: NotificationPrefs;
};

const STORAGE_KEY = 'ambulant.practice.settings.draft.v1';

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(' ');
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
  min,
  max,
  step,
}: {
  label: string;
  hint?: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  min?: number;
  max?: number;
  step?: number;
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
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-0 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
      />
    </label>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3">
      <div>
        <div className="text-xs font-semibold text-gray-900">{label}</div>
        {description ? <div className="mt-0.5 text-xs text-gray-600">{description}</div> : null}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cx(
          'h-6 w-11 rounded-full border p-0.5 transition',
          checked ? 'border-emerald-300 bg-emerald-200' : 'border-gray-200 bg-gray-100'
        )}
        aria-pressed={checked}
      >
        <span
          className={cx(
            'block h-5 w-5 rounded-full bg-white shadow-sm transition',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
}

function Tabs({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (v: string) => void;
  items: Array<{ key: string; label: string; icon?: React.ReactNode; hint?: string }>;
}) {
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            className={cx(
              'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition',
              active ? 'bg-gray-900 text-white' : 'bg-white text-gray-800 hover:bg-gray-50 border border-gray-200'
            )}
          >
            {it.icon ? <span className={cx(active ? 'text-white' : 'text-gray-700')}>{it.icon}</span> : null}
            <span>{it.label}</span>
            {it.hint ? (
              <span className={cx('rounded-full px-2 py-0.5 text-[10px]', active ? 'bg-white/15' : 'bg-gray-100')}>
                {it.hint}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
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

const DEFAULT_DRAFT: PracticeSettingsDraft = {
  splitPolicy: {
    defaultClinicianPct: 70,
    defaultPracticePct: 30,
    applyTo: ['consults', 'reports'],
    perServiceOverrides: [{ serviceKey: 'televisit_consult', clinicianPct: 70 }],
  },
  claimRules: {
    requireEvidenceForClaims: true,
    autoBlockProhibitedClaims: true,
    allow“OutOfScope”NonClinical: false,
    prohibitedClaims: [
      'Cures cancer',
      'Guaranteed weight loss',
      'Replace in-person emergency care',
      'Prescribe medication (non-prescribers)',
    ],
  },
  feeTemplates: [
    {
      key: 'standard',
      label: 'Standard',
      baseConsultFeeZar: 450,
      followUpFeeZar: 300,
      afterHoursSurchargePct: 20,
      cancellationFeeZar: 150,
      notes: 'Default practice fee template.',
    },
  ],
  staffInvites: [],
  notifications: {
    notifyOnBooking: true,
    notifyOnPayment: true,
    notifyOnClaimChange: true,
    dailyDigest: false,
  },
};

export default function PracticeSettingsPage() {
  const [draft, setDraft] = useState<PracticeSettingsDraft>(DEFAULT_DRAFT);
  const [loaded, setLoaded] = useState(false);

  const [tab, setTab] = useState<'splits' | 'claims' | 'fees' | 'staff' | 'notifications'>('splits');

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
        const parsed = JSON.parse(raw) as PracticeSettingsDraft;
        const merged = { ...DEFAULT_DRAFT, ...(parsed || {}) };
        setDraft(merged);
        setLastSavedSnapshot(JSON.stringify(merged));
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
    // Safe, optional endpoint: later wire this to practice-scope settings
    const resp = await tryPublish('/api/practice/settings', draft);
    if (resp.ok) setStatus({ kind: 'published', at: Date.now() });
    else setStatus({ kind: 'error', message: `Publish failed: ${resp.error}` });
  };

  const tabs = [
    { key: 'splits', label: 'Splits', icon: <Percent className="h-4 w-4" />, hint: 'Payout rules' },
    { key: 'claims', label: 'Claims rules', icon: <ShieldCheck className="h-4 w-4" />, hint: 'Safety' },
    { key: 'fees', label: 'Fees templates', icon: <Receipt className="h-4 w-4" />, hint: 'Pricing' },
    { key: 'staff', label: 'Staff access', icon: <Users className="h-4 w-4" />, hint: 'Roles' },
    { key: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
  ] as const;

  return (
    <main className="space-y-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm md:text-base font-semibold text-gray-900">Practice Settings</h2>
            {dirty ? <Pill tone="warn">Unsaved changes</Pill> : <Pill tone="good">Up to date</Pill>}
          </div>
          <p className="mt-1 text-xs text-gray-600">
            Global rules for this practice: splits, claims rules, fee templates, and staff access.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
                <div className="text-gray-600">Safe fallback until your practice settings API exists.</div>
              </div>
            </div>
          ) : null}
          {status.kind === 'publishing' ? (
            <div className="flex items-start gap-2 text-gray-700">
              <RefreshCw className="mt-0.5 h-4 w-4 animate-spin text-gray-700" />
              <div>
                <div className="font-medium text-gray-900">Publishing…</div>
                <div className="text-gray-600">Attempting PUT /api/practice/settings</div>
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

      <Tabs value={tab} onChange={(v) => setTab(v as any)} items={tabs as any} />

      {tab === 'splits' ? (
        <Card
          title="Revenue splits"
          subtitle="Default payout rules. Per-service overrides let you handle special cases cleanly."
          icon={<SlidersHorizontal className="h-4 w-4" />}
          right={<Pill tone="neutral">Practice-scope</Pill>}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field
              label="Default clinician payout (%)"
              value={draft.splitPolicy.defaultClinicianPct}
              type="number"
              min={0}
              max={100}
              step={1}
              onChange={(v) => {
                const n = Math.max(0, Math.min(100, Number(v || 0)));
                setDraft((d) => ({
                  ...d,
                  splitPolicy: {
                    ...d.splitPolicy,
                    defaultClinicianPct: n,
                    defaultPracticePct: Math.max(0, Math.min(100, 100 - n)),
                  },
                }));
              }}
            />
            <Field
              label="Default practice fee (%)"
              hint="Auto-derived"
              value={draft.splitPolicy.defaultPracticePct}
              type="number"
              min={0}
              max={100}
              step={1}
              onChange={(v) => {
                const n = Math.max(0, Math.min(100, Number(v || 0)));
                setDraft((d) => ({
                  ...d,
                  splitPolicy: {
                    ...d.splitPolicy,
                    defaultPracticePct: n,
                    defaultClinicianPct: Math.max(0, Math.min(100, 100 - n)),
                  },
                }));
              }}
            />
          </div>

          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
            Applies to: <span className="font-medium">{draft.splitPolicy.applyTo.join(', ')}</span>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-gray-900">Per-service overrides</div>
                <div className="text-xs text-gray-600">Example: specific consult types or packages.</div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    splitPolicy: {
                      ...d.splitPolicy,
                      perServiceOverrides: [
                        ...d.splitPolicy.perServiceOverrides,
                        { serviceKey: '', clinicianPct: d.splitPolicy.defaultClinicianPct },
                      ],
                    },
                  }))
                }
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50"
              >
                <Plus className="h-4 w-4" />
                Add override
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {draft.splitPolicy.perServiceOverrides.map((row, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-2 rounded-xl border border-gray-200 bg-white p-3 md:grid-cols-[1fr_180px_auto]">
                  <Field
                    label="Service key"
                    value={row.serviceKey}
                    onChange={(v) =>
                      setDraft((d) => {
                        const next = [...d.splitPolicy.perServiceOverrides];
                        next[idx] = { ...next[idx], serviceKey: v };
                        return { ...d, splitPolicy: { ...d.splitPolicy, perServiceOverrides: next } };
                      })
                    }
                    placeholder="e.g. televisit_consult"
                  />
                  <Field
                    label="Clinician (%)"
                    value={row.clinicianPct}
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    onChange={(v) =>
                      setDraft((d) => {
                        const next = [...d.splitPolicy.perServiceOverrides];
                        next[idx] = { ...next[idx], clinicianPct: Math.max(0, Math.min(100, Number(v || 0))) };
                        return { ...d, splitPolicy: { ...d.splitPolicy, perServiceOverrides: next } };
                      })
                    }
                  />
                  <div className="flex items-end justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((d) => {
                          const next = d.splitPolicy.perServiceOverrides.filter((_, i) => i !== idx);
                          return { ...d, splitPolicy: { ...d.splitPolicy, perServiceOverrides: next } };
                        })
                      }
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                      aria-label="Remove override"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 text-[11px] text-gray-500">
              Later: enforce that totals are valid, and add “effectiveFrom / effectiveTo” for time-based split changes.
            </div>
          </div>
        </Card>
      ) : null}

      {tab === 'claims' ? (
        <Card
          title="Claims rules"
          subtitle="Guardrails that keep clinical + non-clinical roles safe and compliant."
          icon={<ShieldCheck className="h-4 w-4" />}
          right={<Pill tone="warn">High impact</Pill>}
        >
          <div className="space-y-2">
            <Toggle
              label="Require evidence for claims"
              description="When enabled, claims should be tied to structured notes, files, or specific encounter evidence."
              checked={draft.claimRules.requireEvidenceForClaims}
              onChange={(v) => setDraft((d) => ({ ...d, claimRules: { ...d.claimRules, requireEvidenceForClaims: v } }))}
            />
            <Toggle
              label="Auto-block prohibited claims"
              description="When enabled, marketing/onboarding UI should warn and block known unsafe/prohibited text."
              checked={draft.claimRules.autoBlockProhibitedClaims}
              onChange={(v) => setDraft((d) => ({ ...d, claimRules: { ...d.claimRules, autoBlockProhibitedClaims: v } }))}
            />
            <Toggle
              label="Allow out-of-scope non-clinical consultants"
              description="When enabled, you can host non-diagnostic coaching roles under strict prohibited-claims rules."
              checked={draft.claimRules.allow“OutOfScope”NonClinical}
              onChange={(v) => setDraft((d) => ({ ...d, claimRules: { ...d.claimRules, allow“OutOfScope”NonClinical: v } }))}
            />
          </div>

          <div className="mt-4">
            <div className="text-xs font-semibold text-gray-900">Prohibited claims library</div>
            <div className="mt-1 text-xs text-gray-600">Used by onboarding UI + practice marketing pages for protection.</div>

            <div className="mt-3 space-y-2">
              {draft.claimRules.prohibitedClaims.map((c, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-2">
                  <input
                    value={c}
                    onChange={(e) =>
                      setDraft((d) => {
                        const next = [...d.claimRules.prohibitedClaims];
                        next[idx] = e.target.value;
                        return { ...d, claimRules: { ...d.claimRules, prohibitedClaims: next } };
                      })
                    }
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-300"
                    placeholder="Add a prohibited claim…"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((d) => {
                        const next = d.claimRules.prohibitedClaims.filter((_, i) => i !== idx);
                        return { ...d, claimRules: { ...d.claimRules, prohibitedClaims: next } };
                      })
                    }
                    className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white p-2 hover:bg-gray-50"
                    aria-label="Remove claim"
                  >
                    <X className="h-4 w-4 text-gray-700" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  claimRules: { ...d.claimRules, prohibitedClaims: [...d.claimRules.prohibitedClaims, ''] },
                }))
              }
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" />
              Add item
            </button>
          </div>
        </Card>
      ) : null}

      {tab === 'fees' ? (
        <Card
          title="Fee templates"
          subtitle="Define reusable pricing blocks. Clinicians can inherit or override (future wiring)."
          icon={<Receipt className="h-4 w-4" />}
          right={<Pill tone="neutral">{draft.feeTemplates.length} template(s)</Pill>}
        >
          <div className="space-y-3">
            {draft.feeTemplates.map((t, idx) => (
              <div key={t.key || idx} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-gray-900">{t.label || 'Untitled template'}</div>
                    <div className="text-[11px] text-gray-500">Key: <span className="font-mono">{t.key || '(unset)'}</span></div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((d) => ({ ...d, feeTemplates: d.feeTemplates.filter((_, i) => i !== idx) }))
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                  >
                    <X className="h-4 w-4" />
                    Remove
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field
                    label="Template key"
                    value={t.key}
                    onChange={(v) =>
                      setDraft((d) => {
                        const next = [...d.feeTemplates];
                        next[idx] = { ...next[idx], key: v };
                        return { ...d, feeTemplates: next };
                      })
                    }
                    placeholder="standard"
                  />
                  <Field
                    label="Label"
                    value={t.label}
                    onChange={(v) =>
                      setDraft((d) => {
                        const next = [...d.feeTemplates];
                        next[idx] = { ...next[idx], label: v };
                        return { ...d, feeTemplates: next };
                      })
                    }
                    placeholder="Standard"
                  />
                  <Field
                    label="Base consult fee (ZAR)"
                    value={t.baseConsultFeeZar}
                    type="number"
                    min={0}
                    step={1}
                    onChange={(v) =>
                      setDraft((d) => {
                        const next = [...d.feeTemplates];
                        next[idx] = { ...next[idx], baseConsultFeeZar: Math.max(0, Number(v || 0)) };
                        return { ...d, feeTemplates: next };
                      })
                    }
                  />
                  <Field
                    label="Follow-up fee (ZAR)"
                    value={t.followUpFeeZar}
                    type="number"
                    min={0}
                    step={1}
                    onChange={(v) =>
                      setDraft((d) => {
                        const next = [...d.feeTemplates];
                        next[idx] = { ...next[idx], followUpFeeZar: Math.max(0, Number(v || 0)) };
                        return { ...d, feeTemplates: next };
                      })
                    }
                  />
                  <Field
                    label="After-hours surcharge (%)"
                    value={t.afterHoursSurchargePct}
                    type="number"
                    min={0}
                    max={300}
                    step={1}
                    onChange={(v) =>
                      setDraft((d) => {
                        const next = [...d.feeTemplates];
                        next[idx] = { ...next[idx], afterHoursSurchargePct: Math.max(0, Number(v || 0)) };
                        return { ...d, feeTemplates: next };
                      })
                    }
                  />
                  <Field
                    label="Cancellation fee (ZAR)"
                    value={t.cancellationFeeZar}
                    type="number"
                    min={0}
                    step={1}
                    onChange={(v) =>
                      setDraft((d) => {
                        const next = [...d.feeTemplates];
                        next[idx] = { ...next[idx], cancellationFeeZar: Math.max(0, Number(v || 0)) };
                        return { ...d, feeTemplates: next };
                      })
                    }
                  />
                </div>

                <div className="mt-3">
                  <label className="block">
                    <div className="text-xs font-medium text-gray-800">Notes</div>
                    <textarea
                      value={t.notes}
                      onChange={(e) =>
                        setDraft((d) => {
                          const next = [...d.feeTemplates];
                          next[idx] = { ...next[idx], notes: e.target.value };
                          return { ...d, feeTemplates: next };
                        })
                      }
                      rows={3}
                      className="mt-1 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-300"
                      placeholder="Any internal notes…"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                feeTemplates: [
                  ...d.feeTemplates,
                  {
                    key: '',
                    label: 'New template',
                    baseConsultFeeZar: 0,
                    followUpFeeZar: 0,
                    afterHoursSurchargePct: 0,
                    cancellationFeeZar: 0,
                    notes: '',
                  },
                ],
              }))
            }
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
            Add template
          </button>
        </Card>
      ) : null}

      {tab === 'staff' ? (
        <Card
          title="Staff access"
          subtitle="Invite non-clinical staff for scheduling, billing, or admin tasks (future wiring)."
          icon={<Users className="h-4 w-4" />}
          right={<Pill tone="neutral">{draft.staffInvites.length} pending</Pill>}
        >
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
            This is a safe draft UI. Later, wire it to <span className="font-medium">PracticeMember</span> with roles + audit logs.
          </div>

          <div className="mt-3 space-y-2">
            {draft.staffInvites.map((inv) => (
              <div key={inv.id} className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-3 md:flex-row md:items-center">
                <div className="flex-1">
                  <div className="text-xs font-semibold text-gray-900">{inv.email}</div>
                  <div className="text-[11px] text-gray-500">Role: {inv.role}</div>
                </div>
                <select
                  value={inv.role}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      staffInvites: d.staffInvites.map((x) => (x.id === inv.id ? { ...x, role: e.target.value as any } : x)),
                    }))
                  }
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900"
                >
                  <option value="admin">Admin</option>
                  <option value="billing">Billing</option>
                  <option value="assistant">Assistant</option>
                  <option value="frontdesk">Frontdesk</option>
                </select>
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, staffInvites: d.staffInvites.filter((x) => x.id !== inv.id) }))}
                  className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                staffInvites: [
                  ...d.staffInvites,
                  {
                    id: `inv_${Math.random().toString(16).slice(2)}`,
                    email: '',
                    role: 'assistant',
                  },
                ],
              }))
            }
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
            Add invite row
          </button>

          <div className="mt-3 text-[11px] text-gray-500">
            Later: email invites, acceptance flow, and fine-grained permissions (book, bill, export, manage templates).
          </div>
        </Card>
      ) : null}

      {tab === 'notifications' ? (
        <Card
          title="Notifications"
          subtitle="Practice-level alerts. Later: route to email + in-app notifications."
          icon={<Bell className="h-4 w-4" />}
        >
          <div className="space-y-2">
            <Toggle
              label="Notify on booking"
              checked={draft.notifications.notifyOnBooking}
              onChange={(v) => setDraft((d) => ({ ...d, notifications: { ...d.notifications, notifyOnBooking: v } }))}
            />
            <Toggle
              label="Notify on payment"
              checked={draft.notifications.notifyOnPayment}
              onChange={(v) => setDraft((d) => ({ ...d, notifications: { ...d.notifications, notifyOnPayment: v } }))}
            />
            <Toggle
              label="Notify on claim change"
              checked={draft.notifications.notifyOnClaimChange}
              onChange={(v) => setDraft((d) => ({ ...d, notifications: { ...d.notifications, notifyOnClaimChange: v } }))}
            />
            <Toggle
              label="Daily digest"
              description="One summary per day (recommended for busy practices)."
              checked={draft.notifications.dailyDigest}
              onChange={(v) => setDraft((d) => ({ ...d, notifications: { ...d.notifications, dailyDigest: v } }))}
            />
          </div>
        </Card>
      ) : null}

      <footer className="rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-600">
        <div className="flex items-start gap-2">
          <SlidersHorizontal className="mt-0.5 h-4 w-4 text-gray-700" />
          <div>
            <div className="font-medium text-gray-900">Next wiring targets</div>
            <ul className="mt-1 list-disc pl-4 space-y-1">
              <li>GET/PUT: <span className="font-mono">/api/practice/settings</span> (PracticeSettings)</li>
              <li>Staff: <span className="font-mono">PracticeMember</span> invites + acceptance + auditing</li>
              <li>Fee templates: bind to consult catalog + per-clinician overrides + effective dates</li>
            </ul>
          </div>
        </div>
      </footer>
    </main>
  );
}
