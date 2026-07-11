'use client';

import React, { useEffect, useMemo, useState } from 'react';

type CommercialPolicy = {
  currency: string;
  country: string;
  pharmacyOnboardingFeeCents: number;
  pharmacyMonthlyPlatformFeeCents: number;
  pharmacyInventoryHostingFeeCents: number;
  platformCommissionBps: number;
  passPaymentProviderFeeToPharmacy: boolean;
  paymentProviderFeeBps: number;
  paymentProviderFixedFeeCents: number;
  riderDeliveryShareBps: number;
  riderBaseFeeCents: number;
  riderPerKmFeeCents: number;
  settlementCycle: 'daily' | 'weekly' | 'monthly';
  pharmacyPayoutHoldDays: number;
  riderPayoutHoldDays: number;
  medicalAidEnabled: boolean;
  medicalAidRequiresPreflight: boolean;
};

type PolicyResponse = {
  ok?: boolean;
  orgId?: string;
  policy?: Partial<CommercialPolicy>;
  source?: string;
  persistence?: string;
  error?: string;
  message?: string;
};

const DEFAULT_POLICY: CommercialPolicy = {
  currency: 'ZAR',
  country: 'ZA',
  pharmacyOnboardingFeeCents: 0,
  pharmacyMonthlyPlatformFeeCents: 0,
  pharmacyInventoryHostingFeeCents: 0,
  platformCommissionBps: 0,
  passPaymentProviderFeeToPharmacy: false,
  paymentProviderFeeBps: 0,
  paymentProviderFixedFeeCents: 0,
  riderDeliveryShareBps: 10000,
  riderBaseFeeCents: 0,
  riderPerKmFeeCents: 0,
  settlementCycle: 'monthly',
  pharmacyPayoutHoldDays: 2,
  riderPayoutHoldDays: 2,
  medicalAidEnabled: true,
  medicalAidRequiresPreflight: true,
};

function asNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function normalizePolicy(policy: Partial<CommercialPolicy> | undefined): CommercialPolicy {
  const p = policy || {};

  return {
    currency: String(p.currency || DEFAULT_POLICY.currency).slice(0, 3).toUpperCase(),
    country: String(p.country || DEFAULT_POLICY.country).slice(0, 2).toUpperCase(),
    pharmacyOnboardingFeeCents: asNumber(p.pharmacyOnboardingFeeCents, DEFAULT_POLICY.pharmacyOnboardingFeeCents),
    pharmacyMonthlyPlatformFeeCents: asNumber(p.pharmacyMonthlyPlatformFeeCents, DEFAULT_POLICY.pharmacyMonthlyPlatformFeeCents),
    pharmacyInventoryHostingFeeCents: asNumber(p.pharmacyInventoryHostingFeeCents, DEFAULT_POLICY.pharmacyInventoryHostingFeeCents),
    platformCommissionBps: asNumber(p.platformCommissionBps, DEFAULT_POLICY.platformCommissionBps),
    passPaymentProviderFeeToPharmacy: Boolean(p.passPaymentProviderFeeToPharmacy),
    paymentProviderFeeBps: asNumber(p.paymentProviderFeeBps, DEFAULT_POLICY.paymentProviderFeeBps),
    paymentProviderFixedFeeCents: asNumber(p.paymentProviderFixedFeeCents, DEFAULT_POLICY.paymentProviderFixedFeeCents),
    riderDeliveryShareBps: asNumber(p.riderDeliveryShareBps, DEFAULT_POLICY.riderDeliveryShareBps),
    riderBaseFeeCents: asNumber(p.riderBaseFeeCents, DEFAULT_POLICY.riderBaseFeeCents),
    riderPerKmFeeCents: asNumber(p.riderPerKmFeeCents, DEFAULT_POLICY.riderPerKmFeeCents),
    settlementCycle:
      p.settlementCycle === 'daily' || p.settlementCycle === 'weekly' || p.settlementCycle === 'monthly'
        ? p.settlementCycle
        : DEFAULT_POLICY.settlementCycle,
    pharmacyPayoutHoldDays: asNumber(p.pharmacyPayoutHoldDays, DEFAULT_POLICY.pharmacyPayoutHoldDays),
    riderPayoutHoldDays: asNumber(p.riderPayoutHoldDays, DEFAULT_POLICY.riderPayoutHoldDays),
    medicalAidEnabled: typeof p.medicalAidEnabled === 'boolean' ? p.medicalAidEnabled : DEFAULT_POLICY.medicalAidEnabled,
    medicalAidRequiresPreflight:
      typeof p.medicalAidRequiresPreflight === 'boolean'
        ? p.medicalAidRequiresPreflight
        : DEFAULT_POLICY.medicalAidRequiresPreflight,
  };
}

function money(cents: number, currency = 'ZAR') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(Number(cents || 0) / 100);
}

function pctFromBps(bps: number) {
  return `${Number(bps || 0) / 100}%`;
}

function Field(props: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-slate-700">{props.label}</div>
      <div className="mt-1">{props.children}</div>
      {props.helper ? <div className="mt-1 text-xs text-slate-500">{props.helper}</div> : null}
    </label>
  );
}

function NumberInput(props: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(props.value) ? props.value : 0}
      min={props.min ?? 0}
      max={props.max}
      onChange={(event) => props.onChange(asNumber(event.target.value, 0))}
      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
    />
  );
}

export default function CarePortCommercialPolicyPage() {
  const [policy, setPolicy] = useState<CommercialPolicy>(DEFAULT_POLICY);
  const [orgId, setOrgId] = useState('');
  const [source, setSource] = useState('');
  const [persistence, setPersistence] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function patch(next: Partial<CommercialPolicy>) {
    setPolicy((current) => ({ ...current, ...next }));
  }

  async function load() {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch('/api/careport/admin/commercial-policy', {
        cache: 'no-store',
      });

      const payload = (await res.json().catch(() => ({}))) as PolicyResponse;

      if (!res.ok || payload.ok === false) {
        throw new Error(payload.error || `careport_commercial_policy_http_${res.status}`);
      }

      setPolicy(normalizePolicy(payload.policy));
      setOrgId(payload.orgId || '');
      setSource(payload.source || '');
      setPersistence(payload.persistence || '');
    } catch (err: any) {
      setError(err?.message || 'Failed to load CarePort commercial policy.');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch('/api/careport/admin/commercial-policy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ policy }),
      });

      const payload = (await res.json().catch(() => ({}))) as PolicyResponse;

      if (!res.ok || payload.ok === false) {
        throw new Error(payload.message || payload.error || `careport_commercial_policy_save_http_${res.status}`);
      }

      setPolicy(normalizePolicy(payload.policy));
      setOrgId(payload.orgId || orgId);
      setSource(payload.source || 'database');
      setPersistence(payload.persistence || 'available');
      setNotice('CarePort commercial policy saved.');
    } catch (err: any) {
      setError(err?.message || 'Failed to save CarePort commercial policy.');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const preview = useMemo(() => {
    return [
      ['Commission', pctFromBps(policy.platformCommissionBps)],
      ['Provider fee', `${pctFromBps(policy.paymentProviderFeeBps)} + ${money(policy.paymentProviderFixedFeeCents, policy.currency)}`],
      ['Rider delivery share', pctFromBps(policy.riderDeliveryShareBps)],
      ['Monthly pharmacy fee', money(policy.pharmacyMonthlyPlatformFeeCents, policy.currency)],
      ['Inventory hosting fee', money(policy.pharmacyInventoryHostingFeeCents, policy.currency)],
      ['Settlement cycle', policy.settlementCycle],
    ];
  }, [policy]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                CarePort commercial policy
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                Fees, settlement and preflight settings
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Configure the commercial assumptions used by CarePort finance, including pharmacy fees, payment-provider
                fees, rider payout rules, settlement cycle and medical-aid preflight behaviour.
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Org: {orgId || '-'} | Source: {source || 'unknown'} | Persistence: {persistence || 'unknown'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="/admin/careport/finance"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Finance
              </a>
              <a
                href="/admin/careport/orders"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Order board
              </a>
              <button
                type="button"
                onClick={() => void load()}
                disabled={busy || saving}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {busy ? 'Refreshing...' : 'Refresh'}
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={busy || saving}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save policy'}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {preview.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="mt-1 text-lg font-semibold text-slate-950">{value}</div>
              </div>
            ))}
          </div>
        </header>

        {notice ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Core billing policy</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Currency">
                <input
                  value={policy.currency}
                  onChange={(event) => patch({ currency: event.target.value.toUpperCase().slice(0, 3) })}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
                />
              </Field>

              <Field label="Country">
                <input
                  value={policy.country}
                  onChange={(event) => patch({ country: event.target.value.toUpperCase().slice(0, 2) })}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
                />
              </Field>

              <Field label="Platform commission bps" helper="100 bps = 1%. Max backend cap is 5000.">
                <NumberInput
                  value={policy.platformCommissionBps}
                  min={0}
                  max={5000}
                  onChange={(value) => patch({ platformCommissionBps: value })}
                />
              </Field>

              <Field label="Payment provider fee bps" helper="100 bps = 1%.">
                <NumberInput
                  value={policy.paymentProviderFeeBps}
                  min={0}
                  max={2000}
                  onChange={(value) => patch({ paymentProviderFeeBps: value })}
                />
              </Field>

              <Field label="Payment provider fixed fee cents">
                <NumberInput
                  value={policy.paymentProviderFixedFeeCents}
                  min={0}
                  onChange={(value) => patch({ paymentProviderFixedFeeCents: value })}
                />
              </Field>

              <Field label="Pass provider fee to pharmacy">
                <label className="flex min-h-[48px] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={policy.passPaymentProviderFeeToPharmacy}
                    onChange={(event) => patch({ passPaymentProviderFeeToPharmacy: event.target.checked })}
                  />
                  Deduct provider fee from pharmacy payout
                </label>
              </Field>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Pharmacy commercial fees</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Pharmacy onboarding fee cents">
                <NumberInput
                  value={policy.pharmacyOnboardingFeeCents}
                  min={0}
                  onChange={(value) => patch({ pharmacyOnboardingFeeCents: value })}
                />
              </Field>

              <Field label="Monthly platform fee cents">
                <NumberInput
                  value={policy.pharmacyMonthlyPlatformFeeCents}
                  min={0}
                  onChange={(value) => patch({ pharmacyMonthlyPlatformFeeCents: value })}
                />
              </Field>

              <Field label="Inventory hosting fee cents">
                <NumberInput
                  value={policy.pharmacyInventoryHostingFeeCents}
                  min={0}
                  onChange={(value) => patch({ pharmacyInventoryHostingFeeCents: value })}
                />
              </Field>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Rider payout policy</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Rider delivery share bps" helper="10000 bps = 100% of delivery fee.">
                <NumberInput
                  value={policy.riderDeliveryShareBps}
                  min={0}
                  max={10000}
                  onChange={(value) => patch({ riderDeliveryShareBps: value })}
                />
              </Field>

              <Field label="Rider base fee cents">
                <NumberInput
                  value={policy.riderBaseFeeCents}
                  min={0}
                  onChange={(value) => patch({ riderBaseFeeCents: value })}
                />
              </Field>

              <Field label="Rider per-km fee cents">
                <NumberInput
                  value={policy.riderPerKmFeeCents}
                  min={0}
                  onChange={(value) => patch({ riderPerKmFeeCents: value })}
                />
              </Field>

              <Field label="Rider payout hold days">
                <NumberInput
                  value={policy.riderPayoutHoldDays}
                  min={0}
                  max={60}
                  onChange={(value) => patch({ riderPayoutHoldDays: value })}
                />
              </Field>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Settlement and coverage controls</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Settlement cycle">
                <select
                  value={policy.settlementCycle}
                  onChange={(event) => patch({ settlementCycle: event.target.value as CommercialPolicy['settlementCycle'] })}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </Field>

              <Field label="Pharmacy payout hold days">
                <NumberInput
                  value={policy.pharmacyPayoutHoldDays}
                  min={0}
                  max={60}
                  onChange={(value) => patch({ pharmacyPayoutHoldDays: value })}
                />
              </Field>

              <Field label="Medical aid enabled">
                <label className="flex min-h-[48px] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={policy.medicalAidEnabled}
                    onChange={(event) => patch({ medicalAidEnabled: event.target.checked })}
                  />
                  Enable medical-aid commercial pathway
                </label>
              </Field>

              <Field label="Medical aid requires preflight">
                <label className="flex min-h-[48px] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={policy.medicalAidRequiresPreflight}
                    onChange={(event) => patch({ medicalAidRequiresPreflight: event.target.checked })}
                  />
                  Require benefits preflight before covered services
                </label>
              </Field>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}