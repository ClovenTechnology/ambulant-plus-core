'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

type SettlementCycle = 'daily' | 'weekly' | 'monthly';

type MedReachCommercialPolicy = {
  currency: string;
  country: string;

  labOnboardingFeeCents: number;
  labMonthlyPlatformFeeCents: number;
  labCatalogueHostingFeeCents: number;
  labTestHostingFeeCents: number;

  labCommissionBps: number;
  medreachCommissionBps: number;

  paymentProviderFeeBps: number;
  paymentProviderFixedFeeCents: number;
  passPaymentProviderFeeToLab: boolean;

  phlebCalloutFeeCents: number;
  phlebPerKmFeeCents: number;
  phlebUrgentDrawSurchargeCents: number;
  specimenTransportBaseFeeCents: number;
  specimenTransportPerKmFeeCents: number;
  coldChainSurchargeCents: number;

  labPayoutHoldDays: number;
  phlebPayoutHoldDays: number;
  settlementCycle: SettlementCycle;

  allowPhlebSelfSetCalloutFee: boolean;
  requireAdminApprovalForFeeChanges: boolean;
  medicalAidEnabled: boolean;
  medicalAidRequiresPreflight: boolean;
};

type PolicyResponse = {
  ok?: boolean;
  orgId?: string;
  source?: string;
  persistence?: string;
  policy?: Partial<MedReachCommercialPolicy>;
  error?: string;
  message?: string;
};

const DEFAULT_POLICY: MedReachCommercialPolicy = {
  currency: 'ZAR',
  country: 'ZA',

  labOnboardingFeeCents: 0,
  labMonthlyPlatformFeeCents: 0,
  labCatalogueHostingFeeCents: 0,
  labTestHostingFeeCents: 0,

  labCommissionBps: 0,
  medreachCommissionBps: 0,

  paymentProviderFeeBps: 0,
  paymentProviderFixedFeeCents: 0,
  passPaymentProviderFeeToLab: false,

  phlebCalloutFeeCents: 0,
  phlebPerKmFeeCents: 0,
  phlebUrgentDrawSurchargeCents: 0,
  specimenTransportBaseFeeCents: 0,
  specimenTransportPerKmFeeCents: 0,
  coldChainSurchargeCents: 0,

  labPayoutHoldDays: 2,
  phlebPayoutHoldDays: 2,
  settlementCycle: 'monthly',

  allowPhlebSelfSetCalloutFee: false,
  requireAdminApprovalForFeeChanges: true,
  medicalAidEnabled: false,
  medicalAidRequiresPreflight: true,
};

function asNumber(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function normalizePolicy(policy: Partial<MedReachCommercialPolicy> | undefined): MedReachCommercialPolicy {
  const p = policy || {};

  return {
    currency: String(p.currency || DEFAULT_POLICY.currency).slice(0, 3).toUpperCase(),
    country: String(p.country || DEFAULT_POLICY.country).slice(0, 2).toUpperCase(),

    labOnboardingFeeCents: asNumber(p.labOnboardingFeeCents, DEFAULT_POLICY.labOnboardingFeeCents),
    labMonthlyPlatformFeeCents: asNumber(p.labMonthlyPlatformFeeCents, DEFAULT_POLICY.labMonthlyPlatformFeeCents),
    labCatalogueHostingFeeCents: asNumber(p.labCatalogueHostingFeeCents, DEFAULT_POLICY.labCatalogueHostingFeeCents),
    labTestHostingFeeCents: asNumber(p.labTestHostingFeeCents, DEFAULT_POLICY.labTestHostingFeeCents),

    labCommissionBps: asNumber(p.labCommissionBps, DEFAULT_POLICY.labCommissionBps),
    medreachCommissionBps: asNumber(p.medreachCommissionBps, DEFAULT_POLICY.medreachCommissionBps),

    paymentProviderFeeBps: asNumber(p.paymentProviderFeeBps, DEFAULT_POLICY.paymentProviderFeeBps),
    paymentProviderFixedFeeCents: asNumber(p.paymentProviderFixedFeeCents, DEFAULT_POLICY.paymentProviderFixedFeeCents),
    passPaymentProviderFeeToLab: Boolean(p.passPaymentProviderFeeToLab),

    phlebCalloutFeeCents: asNumber(p.phlebCalloutFeeCents, DEFAULT_POLICY.phlebCalloutFeeCents),
    phlebPerKmFeeCents: asNumber(p.phlebPerKmFeeCents, DEFAULT_POLICY.phlebPerKmFeeCents),
    phlebUrgentDrawSurchargeCents: asNumber(
      p.phlebUrgentDrawSurchargeCents,
      DEFAULT_POLICY.phlebUrgentDrawSurchargeCents
    ),
    specimenTransportBaseFeeCents: asNumber(
      p.specimenTransportBaseFeeCents,
      DEFAULT_POLICY.specimenTransportBaseFeeCents
    ),
    specimenTransportPerKmFeeCents: asNumber(
      p.specimenTransportPerKmFeeCents,
      DEFAULT_POLICY.specimenTransportPerKmFeeCents
    ),
    coldChainSurchargeCents: asNumber(p.coldChainSurchargeCents, DEFAULT_POLICY.coldChainSurchargeCents),

    labPayoutHoldDays: asNumber(p.labPayoutHoldDays, DEFAULT_POLICY.labPayoutHoldDays),
    phlebPayoutHoldDays: asNumber(p.phlebPayoutHoldDays, DEFAULT_POLICY.phlebPayoutHoldDays),
    settlementCycle:
      p.settlementCycle === 'daily' || p.settlementCycle === 'weekly' || p.settlementCycle === 'monthly'
        ? p.settlementCycle
        : DEFAULT_POLICY.settlementCycle,

    allowPhlebSelfSetCalloutFee:
      typeof p.allowPhlebSelfSetCalloutFee === 'boolean'
        ? p.allowPhlebSelfSetCalloutFee
        : DEFAULT_POLICY.allowPhlebSelfSetCalloutFee,
    requireAdminApprovalForFeeChanges:
      typeof p.requireAdminApprovalForFeeChanges === 'boolean'
        ? p.requireAdminApprovalForFeeChanges
        : DEFAULT_POLICY.requireAdminApprovalForFeeChanges,
    medicalAidEnabled: typeof p.medicalAidEnabled === 'boolean' ? p.medicalAidEnabled : DEFAULT_POLICY.medicalAidEnabled,
    medicalAidRequiresPreflight:
      typeof p.medicalAidRequiresPreflight === 'boolean'
        ? p.medicalAidRequiresPreflight
        : DEFAULT_POLICY.medicalAidRequiresPreflight,
  };
}

function money(cents: number, currency = 'ZAR') {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency,
  }).format(Number(cents || 0) / 100);
}

function pctFromBps(bps: number) {
  return `${Number(bps || 0) / 100}%`;
}

function Field(props: { label: string; helper?: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-slate-700">{props.label}</div>
      {props.helper ? <div className="mt-1 text-xs text-slate-500">{props.helper}</div> : null}
      <div className="mt-2">{props.children}</div>
    </label>
  );
}

function NumberInput(props: { value: number; onChange: (value: number) => void; min?: number; max?: number }) {
  return (
    <input
      type="number"
      min={props.min ?? 0}
      max={props.max}
      value={Number.isFinite(props.value) ? props.value : 0}
      onChange={(event) => props.onChange(asNumber(event.target.value, 0))}
      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
    />
  );
}

export default function MedReachCommercialPolicyPage() {
  const [policy, setPolicy] = useState<MedReachCommercialPolicy>(DEFAULT_POLICY);
  const [source, setSource] = useState('defaults');
  const [persistence, setPersistence] = useState('unknown');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  function patch(next: Partial<MedReachCommercialPolicy>) {
    setPolicy((current) => ({ ...current, ...next }));
  }

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');
      setNotice('');

      try {
        const res = await fetch('/api/medreach/admin/commercial-policy', {
          cache: 'no-store',
          headers: { 'x-user-role': 'admin' },
        });
        const payload = (await res.json().catch(() => ({}))) as PolicyResponse;

        if (!res.ok || payload.ok === false) {
          throw new Error(payload.message || payload.error || `medreach_commercial_policy_http_${res.status}`);
        }

        if (!active) return;
        setPolicy(normalizePolicy(payload.policy));
        setSource(payload.source || 'defaults');
        setPersistence(payload.persistence || 'available');
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || 'Failed to load MedReach commercial policy.');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch('/api/medreach/admin/commercial-policy', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({ policy }),
      });
      const payload = (await res.json().catch(() => ({}))) as PolicyResponse;

      if (!res.ok || payload.ok === false) {
        throw new Error(payload.message || payload.error || `medreach_commercial_policy_save_http_${res.status}`);
      }

      setPolicy(normalizePolicy(payload.policy));
      setSource(payload.source || 'database');
      setPersistence(payload.persistence || 'available');
      setNotice('MedReach commercial policy saved.');
    } catch (err: any) {
      setError(err?.message || 'Failed to save MedReach commercial policy.');
    } finally {
      setSaving(false);
    }
  }

  const preview = useMemo(
    () => [
      ['Lab onboarding fee', money(policy.labOnboardingFeeCents, policy.currency)],
      ['Lab monthly platform fee', money(policy.labMonthlyPlatformFeeCents, policy.currency)],
      ['Lab catalogue hosting fee', money(policy.labCatalogueHostingFeeCents, policy.currency)],
      ['Lab test hosting fee', money(policy.labTestHostingFeeCents, policy.currency)],
      ['Lab commission', pctFromBps(policy.labCommissionBps)],
      ['MedReach commission', pctFromBps(policy.medreachCommissionBps)],
      ['Provider fee', `${pctFromBps(policy.paymentProviderFeeBps)} + ${money(policy.paymentProviderFixedFeeCents, policy.currency)}`],
      ['Phleb call-out fee', money(policy.phlebCalloutFeeCents, policy.currency)],
      ['Phleb per-km fee', money(policy.phlebPerKmFeeCents, policy.currency)],
      ['Specimen base transport', money(policy.specimenTransportBaseFeeCents, policy.currency)],
      ['Specimen per-km transport', money(policy.specimenTransportPerKmFeeCents, policy.currency)],
      ['Settlement cycle', policy.settlementCycle],
    ],
    [policy],
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">MedReach finance</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">MedReach commercial policy</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Configure lab onboarding and subscription fees, catalogue hosting, lab commission, phlebotomist call-out
                rules, specimen transport charges, payment-provider fee handling and settlement timing.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="/admin/medreach/onboarding"
                className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Onboarding
              </a>
              <button
                type="button"
                onClick={save}
                disabled={saving || loading}
                className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save policy'}
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">Source: {source}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
              Persistence: {persistence}
            </span>
            {loading ? <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700">Loading</span> : null}
          </div>

          {notice ? <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div> : null}
          {error ? <div className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">{error}</div> : null}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {preview.map(([label, value]) => (
            <div key={label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
              <div className="mt-2 text-lg font-bold text-slate-950">{value}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Core policy</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <Field label="Currency">
                <input
                  value={policy.currency}
                  onChange={(event) => patch({ currency: event.target.value.slice(0, 3).toUpperCase() })}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                />
              </Field>
              <Field label="Country">
                <input
                  value={policy.country}
                  onChange={(event) => patch({ country: event.target.value.slice(0, 2).toUpperCase() })}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                />
              </Field>
              <Field label="Lab commission bps" helper="100 bps = 1%. Backend cap is 5000.">
                <NumberInput value={policy.labCommissionBps} max={5000} onChange={(value) => patch({ labCommissionBps: value })} />
              </Field>
              <Field label="MedReach commission bps" helper="100 bps = 1%. Backend cap is 5000.">
                <NumberInput
                  value={policy.medreachCommissionBps}
                  max={5000}
                  onChange={(value) => patch({ medreachCommissionBps: value })}
                />
              </Field>
              <Field label="Payment provider fee bps">
                <NumberInput
                  value={policy.paymentProviderFeeBps}
                  max={2000}
                  onChange={(value) => patch({ paymentProviderFeeBps: value })}
                />
              </Field>
              <Field label="Payment provider fixed fee cents">
                <NumberInput
                  value={policy.paymentProviderFixedFeeCents}
                  onChange={(value) => patch({ paymentProviderFixedFeeCents: value })}
                />
              </Field>
              <Field label="Settlement cycle">
                <select
                  value={policy.settlementCycle}
                  onChange={(event) => patch({ settlementCycle: event.target.value as SettlementCycle })}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </Field>
              <Field label="Pass provider fee to lab">
                <label className="flex min-h-[48px] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={policy.passPaymentProviderFeeToLab}
                    onChange={(event) => patch({ passPaymentProviderFeeToLab: event.target.checked })}
                  />
                  Deduct provider fee from lab payout
                </label>
              </Field>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Lab commercial fees</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <Field label="Lab onboarding fee cents">
                <NumberInput value={policy.labOnboardingFeeCents} onChange={(value) => patch({ labOnboardingFeeCents: value })} />
              </Field>
              <Field label="Monthly platform fee cents">
                <NumberInput
                  value={policy.labMonthlyPlatformFeeCents}
                  onChange={(value) => patch({ labMonthlyPlatformFeeCents: value })}
                />
              </Field>
              <Field label="Catalogue hosting fee cents">
                <NumberInput
                  value={policy.labCatalogueHostingFeeCents}
                  onChange={(value) => patch({ labCatalogueHostingFeeCents: value })}
                />
              </Field>
              <Field label="Per-test hosting fee cents">
                <NumberInput value={policy.labTestHostingFeeCents} onChange={(value) => patch({ labTestHostingFeeCents: value })} />
              </Field>
              <Field label="Lab payout hold days">
                <NumberInput value={policy.labPayoutHoldDays} max={60} onChange={(value) => patch({ labPayoutHoldDays: value })} />
              </Field>
              <Field label="Medical aid preflight">
                <label className="flex min-h-[48px] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={policy.medicalAidRequiresPreflight}
                    onChange={(event) => patch({ medicalAidRequiresPreflight: event.target.checked })}
                  />
                  Require preflight before medical-aid fulfilment
                </label>
              </Field>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Phlebotomist fee policy</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <Field label="Default phleb call-out fee cents">
                <NumberInput value={policy.phlebCalloutFeeCents} onChange={(value) => patch({ phlebCalloutFeeCents: value })} />
              </Field>
              <Field label="Phleb per-km fee cents">
                <NumberInput value={policy.phlebPerKmFeeCents} onChange={(value) => patch({ phlebPerKmFeeCents: value })} />
              </Field>
              <Field label="Urgent draw surcharge cents">
                <NumberInput
                  value={policy.phlebUrgentDrawSurchargeCents}
                  onChange={(value) => patch({ phlebUrgentDrawSurchargeCents: value })}
                />
              </Field>
              <Field label="Phleb payout hold days">
                <NumberInput
                  value={policy.phlebPayoutHoldDays}
                  max={60}
                  onChange={(value) => patch({ phlebPayoutHoldDays: value })}
                />
              </Field>
              <Field label="Allow phlebs to self-set call-out fee">
                <label className="flex min-h-[48px] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={policy.allowPhlebSelfSetCalloutFee}
                    onChange={(event) => patch({ allowPhlebSelfSetCalloutFee: event.target.checked })}
                  />
                  Permit individual phleb fee proposals
                </label>
              </Field>
              <Field label="Require admin approval for fee changes">
                <label className="flex min-h-[48px] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={policy.requireAdminApprovalForFeeChanges}
                    onChange={(event) => patch({ requireAdminApprovalForFeeChanges: event.target.checked })}
                  />
                  Admin must approve changed fee schedules
                </label>
              </Field>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Specimen logistics policy</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <Field label="Specimen transport base fee cents">
                <NumberInput
                  value={policy.specimenTransportBaseFeeCents}
                  onChange={(value) => patch({ specimenTransportBaseFeeCents: value })}
                />
              </Field>
              <Field label="Specimen transport per-km fee cents">
                <NumberInput
                  value={policy.specimenTransportPerKmFeeCents}
                  onChange={(value) => patch({ specimenTransportPerKmFeeCents: value })}
                />
              </Field>
              <Field label="Cold-chain surcharge cents">
                <NumberInput value={policy.coldChainSurchargeCents} onChange={(value) => patch({ coldChainSurchargeCents: value })} />
              </Field>
              <Field label="Medical aid enabled">
                <label className="flex min-h-[48px] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={policy.medicalAidEnabled}
                    onChange={(event) => patch({ medicalAidEnabled: event.target.checked })}
                  />
                  Include MedReach in medical-aid policy calculations
                </label>
              </Field>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
          <strong>Operational note:</strong> These settings define admin-governed commercial defaults. They do not, by
          themselves, charge partners or patients until connected to MedReach order billing, payout previews and partner
          activation workflows.
        </section>
      </div>
    </main>
  );
}
