'use client';

import { useEffect, useMemo, useState } from 'react';

type PartnerModule = 'careport' | 'medreach';
type PartnerType = 'pharmacy' | 'lab';

type TierRules = {
  minSkuCount: number | null;
  maxSkuCount: number | null;
  minTestCount: number | null;
  maxTestCount: number | null;
  minStorageMb: number | null;
  maxStorageMb: number | null;
  minMonthlyOrders: number | null;
  maxMonthlyOrders: number | null;
};

type PartnerTier = {
  id: string;
  module: PartnerModule;
  partnerType: PartnerType;
  name: string;
  description: string;
  enabled: boolean;
  currency: string;
  monthlyPlatformFeeCents: number;
  catalogueHostingFeeCents: number;
  onboardingFeeCents: number;
  transactionCommissionBps: number;
  paymentProviderFeeBps: number;
  paymentProviderFixedFeeCents: number;
  includedSkuCount: number;
  includedTestCount: number;
  includedStorageMb: number;
  includedBranches: number;
  monthlyOrderLimit: number;
  autoAssignRules: TierRules;
};

type TierConfig = {
  version: number;
  tiers: PartnerTier[];
};

type TierResponse = {
  ok?: boolean;
  error?: string;
  source?: string;
  persistence?: string;
  config?: TierConfig;
  resolver?: {
    tier?: PartnerTier | null;
  } | null;
};

const emptyRules: TierRules = {
  minSkuCount: null,
  maxSkuCount: null,
  minTestCount: null,
  maxTestCount: null,
  minStorageMb: null,
  maxStorageMb: null,
  minMonthlyOrders: null,
  maxMonthlyOrders: null,
};

function asNumber(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function nullableNumber(value: string) {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
}

function money(cents: number, currency = 'ZAR') {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency,
  }).format(asNumber(cents) / 100);
}

function pct(bps: number) {
  return String(asNumber(bps) / 100) + '%';
}

function newTier(): PartnerTier {
  const id = 'partner-tier-' + Date.now();

  return {
    id,
    module: 'careport',
    partnerType: 'pharmacy',
    name: 'New partner tier',
    description: '',
    enabled: true,
    currency: 'ZAR',
    monthlyPlatformFeeCents: 0,
    catalogueHostingFeeCents: 0,
    onboardingFeeCents: 0,
    transactionCommissionBps: 0,
    paymentProviderFeeBps: 0,
    paymentProviderFixedFeeCents: 0,
    includedSkuCount: 0,
    includedTestCount: 0,
    includedStorageMb: 0,
    includedBranches: 0,
    monthlyOrderLimit: 0,
    autoAssignRules: { ...emptyRules },
  };
}

function normalizeConfig(payload: TierResponse): TierConfig {
  return {
    version: 1,
    tiers: Array.isArray(payload.config?.tiers) ? payload.config!.tiers : [],
  };
}

function ruleValue(value: number | null | undefined) {
  return value === null || value === undefined ? '' : String(value);
}

export default function PartnerCommercialTiersPage() {
  const [config, setConfig] = useState<TierConfig>({ version: 1, tiers: [] });
  const [source, setSource] = useState('defaults');
  const [persistence, setPersistence] = useState('unknown');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [resolverModule, setResolverModule] = useState<PartnerModule>('careport');
  const [resolverPartnerType, setResolverPartnerType] = useState<PartnerType>('pharmacy');
  const [resolverSkuCount, setResolverSkuCount] = useState('0');
  const [resolverTestCount, setResolverTestCount] = useState('0');
  const [resolverStorageMb, setResolverStorageMb] = useState('0');
  const [resolverMonthlyOrders, setResolverMonthlyOrders] = useState('0');
  const [resolverResult, setResolverResult] = useState<PartnerTier | null>(null);

  async function load() {
    setError('');
    setNotice('');

    try {
      const res = await fetch('/api/admin/partner-commercial-tiers', { cache: 'no-store' });
      const payload = (await res.json().catch(() => ({}))) as TierResponse;

      if (!res.ok || payload.ok === false) {
        throw new Error(payload.error || 'partner_tiers_load_http_' + res.status);
      }

      setConfig(normalizeConfig(payload));
      setSource(payload.source || 'defaults');
      setPersistence(payload.persistence || 'available');
    } catch (err: any) {
      setError(err?.message || 'Failed to load partner commercial tiers.');
    }
  }

  async function save() {
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch('/api/admin/partner-commercial-tiers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config }),
      });

      const payload = (await res.json().catch(() => ({}))) as TierResponse;

      if (!res.ok || payload.ok === false) {
        throw new Error(payload.error || 'partner_tiers_save_http_' + res.status);
      }

      setConfig(normalizeConfig(payload));
      setSource(payload.source || 'database');
      setPersistence(payload.persistence || 'available');
      setNotice('Partner commercial tiers saved.');
    } catch (err: any) {
      setError(err?.message || 'Failed to save partner commercial tiers.');
    } finally {
      setSaving(false);
    }
  }

  async function resolvePreview() {
    setError('');
    setResolverResult(null);

    try {
      const params = new URLSearchParams({
        module: resolverModule,
        partnerType: resolverPartnerType,
        skuCount: resolverSkuCount,
        testCount: resolverTestCount,
        storageMb: resolverStorageMb,
        monthlyOrders: resolverMonthlyOrders,
      });

      const res = await fetch('/api/admin/partner-commercial-tiers?' + params.toString(), { cache: 'no-store' });
      const payload = (await res.json().catch(() => ({}))) as TierResponse;

      if (!res.ok || payload.ok === false) {
        throw new Error(payload.error || 'partner_tier_resolver_http_' + res.status);
      }

      setResolverResult(payload.resolver?.tier || null);
    } catch (err: any) {
      setError(err?.message || 'Failed to resolve partner tier preview.');
    }
  }

  function updateTier(index: number, patch: Partial<PartnerTier>) {
    setConfig((current) => ({
      ...current,
      tiers: current.tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)),
    }));
  }

  function updateRules(index: number, patch: Partial<TierRules>) {
    setConfig((current) => ({
      ...current,
      tiers: current.tiers.map((tier, i) =>
        i === index
          ? {
              ...tier,
              autoAssignRules: { ...(tier.autoAssignRules || emptyRules), ...patch },
            }
          : tier,
      ),
    }));
  }

  function removeTier(index: number) {
    setConfig((current) => ({
      ...current,
      tiers: current.tiers.filter((_, i) => i !== index),
    }));
  }

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(() => {
    const enabled = config.tiers.filter((tier) => tier.enabled).length;
    const careport = config.tiers.filter((tier) => tier.module === 'careport').length;
    const medreach = config.tiers.filter((tier) => tier.module === 'medreach').length;
    const paid = config.tiers.filter(
      (tier) =>
        tier.monthlyPlatformFeeCents ||
        tier.catalogueHostingFeeCents ||
        tier.onboardingFeeCents ||
        tier.transactionCommissionBps,
    ).length;

    return [
      ['Total tiers', String(config.tiers.length)],
      ['Enabled', String(enabled)],
      ['CarePort tiers', String(careport)],
      ['MedReach tiers', String(medreach)],
      ['Configured charges', String(paid)],
      ['Source', source + ' / ' + persistence],
    ];
  }, [config.tiers, source, persistence]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Partner commercial tiers</p>
              <h1 className="mt-2 text-2xl font-bold text-slate-950">Subscription tiers and threshold rules</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Configure named partner tiers for CarePort pharmacies and MedReach labs, including monthly fees,
                catalogue or test hosting fees, onboarding fees, transaction commission and threshold rules based on
                SKU count, test count, storage and order volume.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a href="/admin/careport/commercial-policy" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                CarePort policy
              </a>
              <a href="/admin/medreach/commercial-policy" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                MedReach policy
              </a>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save tiers'}
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {summary.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs text-slate-500">{label}</div>
              <div className="mt-2 text-lg font-bold text-slate-950">{value}</div>
            </div>
          ))}
        </section>

        {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div> : null}
        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Tier resolver preview</h2>
              <p className="mt-1 text-sm text-slate-600">Test how the current thresholds classify a partner.</p>
            </div>
            <button type="button" onClick={() => void resolvePreview()} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
              Resolve tier
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-6">
            <select value={resolverModule} onChange={(event) => setResolverModule(event.target.value as PartnerModule)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm">
              <option value="careport">CarePort</option>
              <option value="medreach">MedReach</option>
            </select>
            <select value={resolverPartnerType} onChange={(event) => setResolverPartnerType(event.target.value as PartnerType)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm">
              <option value="pharmacy">Pharmacy</option>
              <option value="lab">Lab</option>
            </select>
            <input value={resolverSkuCount} onChange={(event) => setResolverSkuCount(event.target.value)} placeholder="SKU count" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
            <input value={resolverTestCount} onChange={(event) => setResolverTestCount(event.target.value)} placeholder="Test count" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
            <input value={resolverStorageMb} onChange={(event) => setResolverStorageMb(event.target.value)} placeholder="Storage MB" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
            <input value={resolverMonthlyOrders} onChange={(event) => setResolverMonthlyOrders(event.target.value)} placeholder="Monthly orders" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            Resolver result:{' '}
            <span className="font-semibold text-slate-950">
              {resolverResult ? resolverResult.name + ' (' + resolverResult.id + ')' : 'No preview result yet'}
            </span>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Configured tiers</h2>
              <p className="mt-1 text-sm text-slate-600">Add, edit or disable partner tiers. Amounts are stored in cents.</p>
            </div>
            <button
              type="button"
              onClick={() => setConfig((current) => ({ ...current, tiers: [...current.tiers, newTier()] }))}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            >
              Add tier
            </button>
          </div>

          <div className="mt-5 flex flex-col gap-5">
            {config.tiers.map((tier, index) => (
              <div key={tier.id + index} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 lg:grid-cols-4">
                  <input value={tier.id} onChange={(event) => updateTier(index, { id: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="tier id" />
                  <input value={tier.name} onChange={(event) => updateTier(index, { name: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="name" />
                  <select value={tier.module} onChange={(event) => updateTier(index, { module: event.target.value as PartnerModule })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                    <option value="careport">CarePort</option>
                    <option value="medreach">MedReach</option>
                  </select>
                  <select value={tier.partnerType} onChange={(event) => updateTier(index, { partnerType: event.target.value as PartnerType })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                    <option value="pharmacy">Pharmacy</option>
                    <option value="lab">Lab</option>
                  </select>
                </div>

                <textarea value={tier.description} onChange={(event) => updateTier(index, { description: event.target.value })} className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="description" />

                <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                  <input value={tier.monthlyPlatformFeeCents} onChange={(event) => updateTier(index, { monthlyPlatformFeeCents: asNumber(event.target.value) })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Monthly fee cents" />
                  <input value={tier.catalogueHostingFeeCents} onChange={(event) => updateTier(index, { catalogueHostingFeeCents: asNumber(event.target.value) })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Hosting fee cents" />
                  <input value={tier.onboardingFeeCents} onChange={(event) => updateTier(index, { onboardingFeeCents: asNumber(event.target.value) })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Onboarding fee cents" />
                  <input value={tier.transactionCommissionBps} onChange={(event) => updateTier(index, { transactionCommissionBps: asNumber(event.target.value) })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Commission bps" />
                  <input value={tier.paymentProviderFixedFeeCents} onChange={(event) => updateTier(index, { paymentProviderFixedFeeCents: asNumber(event.target.value) })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Provider fixed fee cents" />
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                  <input value={tier.includedSkuCount} onChange={(event) => updateTier(index, { includedSkuCount: asNumber(event.target.value) })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Included SKUs" />
                  <input value={tier.includedTestCount} onChange={(event) => updateTier(index, { includedTestCount: asNumber(event.target.value) })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Included tests" />
                  <input value={tier.includedStorageMb} onChange={(event) => updateTier(index, { includedStorageMb: asNumber(event.target.value) })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Storage MB" />
                  <input value={tier.includedBranches} onChange={(event) => updateTier(index, { includedBranches: asNumber(event.target.value) })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Branches" />
                  <input value={tier.monthlyOrderLimit} onChange={(event) => updateTier(index, { monthlyOrderLimit: asNumber(event.target.value) })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Monthly orders" />
                </div>

                <div className="mt-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Auto-assignment thresholds</div>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <input value={ruleValue(tier.autoAssignRules?.minSkuCount)} onChange={(event) => updateRules(index, { minSkuCount: nullableNumber(event.target.value) })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Min SKU" />
                    <input value={ruleValue(tier.autoAssignRules?.maxSkuCount)} onChange={(event) => updateRules(index, { maxSkuCount: nullableNumber(event.target.value) })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Max SKU" />
                    <input value={ruleValue(tier.autoAssignRules?.minTestCount)} onChange={(event) => updateRules(index, { minTestCount: nullableNumber(event.target.value) })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Min tests" />
                    <input value={ruleValue(tier.autoAssignRules?.maxTestCount)} onChange={(event) => updateRules(index, { maxTestCount: nullableNumber(event.target.value) })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Max tests" />
                    <input value={ruleValue(tier.autoAssignRules?.minStorageMb)} onChange={(event) => updateRules(index, { minStorageMb: nullableNumber(event.target.value) })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Min storage MB" />
                    <input value={ruleValue(tier.autoAssignRules?.maxStorageMb)} onChange={(event) => updateRules(index, { maxStorageMb: nullableNumber(event.target.value) })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Max storage MB" />
                    <input value={ruleValue(tier.autoAssignRules?.minMonthlyOrders)} onChange={(event) => updateRules(index, { minMonthlyOrders: nullableNumber(event.target.value) })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Min monthly orders" />
                    <input value={ruleValue(tier.autoAssignRules?.maxMonthlyOrders)} onChange={(event) => updateRules(index, { maxMonthlyOrders: nullableNumber(event.target.value) })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Max monthly orders" />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-slate-600">
                    Monthly: <strong>{money(tier.monthlyPlatformFeeCents, tier.currency)}</strong> · Hosting:{' '}
                    <strong>{money(tier.catalogueHostingFeeCents, tier.currency)}</strong> · Commission:{' '}
                    <strong>{pct(tier.transactionCommissionBps)}</strong>
                  </div>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
                      <input type="checkbox" checked={tier.enabled} onChange={(event) => updateTier(index, { enabled: event.target.checked })} />
                      Enabled
                    </label>
                    <button type="button" onClick={() => removeTier(index)} className="rounded-2xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700">
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {!config.tiers.length ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                No partner commercial tiers configured yet.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
