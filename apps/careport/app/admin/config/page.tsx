'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type BroadcastPolicy = {
  initialRadiusKm: number;
  expansionIntervalMinutes: number;
  expansionStepKm: number;
  maxRadiusKm: number;
  minCoverageRatio: number;
  minAcceptedOffersBeforeExpansion: number;
};

type PricingPolicy = {
  country: string;
  currency: string;
  codEnabled: boolean;
  codLimitCents: number;
  baseDeliveryFeeCents: number;
  perKmDeliveryFeeCents: number;
  maxDeliveryFeeCents: number;
};

const fallbackBroadcast: BroadcastPolicy = {
  initialRadiusKm: 10,
  expansionIntervalMinutes: 3,
  expansionStepKm: 10,
  maxRadiusKm: 50,
  minCoverageRatio: 0.6,
  minAcceptedOffersBeforeExpansion: 3,
};

const fallbackPricing: PricingPolicy = {
  country: 'ZA',
  currency: 'ZAR',
  codEnabled: true,
  codLimitCents: 150000,
  baseDeliveryFeeCents: 3500,
  perKmDeliveryFeeCents: 550,
  maxDeliveryFeeCents: 12000,
};

function centsToMajor(value: number) {
  return (Number(value || 0) / 100).toFixed(2);
}

function majorToCents(value: string) {
  const n = Number(String(value || '').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export default function CarePortAdminConfigPage() {
  const [broadcastPolicy, setBroadcastPolicy] = useState<BroadcastPolicy>(fallbackBroadcast);
  const [pricingPolicy, setPricingPolicy] = useState<PricingPolicy>(fallbackPricing);
  const [storage, setStorage] = useState<'database' | 'defaults' | string>('defaults');
  const [moneyForm, setMoneyForm] = useState({
    codLimit: centsToMajor(fallbackPricing.codLimitCents),
    baseDeliveryFee: centsToMajor(fallbackPricing.baseDeliveryFeeCents),
    perKmDeliveryFee: centsToMajor(fallbackPricing.perKmDeliveryFeeCents),
    maxDeliveryFee: centsToMajor(fallbackPricing.maxDeliveryFeeCents),
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/careport/admin/config', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || `config_http_${res.status}`);

      const nextPricing = { ...fallbackPricing, ...(data.pricingPolicy || {}) };
      setBroadcastPolicy({ ...fallbackBroadcast, ...(data.broadcastPolicy || {}) });
      setPricingPolicy(nextPricing);
      setStorage(data.storage || 'defaults');
      setMoneyForm({
        codLimit: centsToMajor(nextPricing.codLimitCents),
        baseDeliveryFee: centsToMajor(nextPricing.baseDeliveryFeeCents),
        perKmDeliveryFee: centsToMajor(nextPricing.perKmDeliveryFeeCents),
        maxDeliveryFee: centsToMajor(nextPricing.maxDeliveryFeeCents),
      });
    } catch (err: any) {
      setError(err?.message || 'Unable to load CarePort configuration.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        broadcastPolicy,
        pricingPolicy: {
          ...pricingPolicy,
          codLimitCents: majorToCents(moneyForm.codLimit),
          baseDeliveryFeeCents: majorToCents(moneyForm.baseDeliveryFee),
          perKmDeliveryFeeCents: majorToCents(moneyForm.perKmDeliveryFee),
          maxDeliveryFeeCents: majorToCents(moneyForm.maxDeliveryFee),
        },
      };

      const res = await fetch('/api/careport/admin/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || `save_http_${res.status}`);

      setMessage(data.storage === 'database' ? 'CarePort configuration saved.' : 'Configuration returned defaults.');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not save CarePort configuration.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Admin control plane</p>
          <h1 className="text-2xl font-semibold text-slate-950">CarePort configuration</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Configure pharmacy search policy, offer quality thresholds, delivery pricing, and COD guardrails from one operational screen.
          </p>
          <p className="mt-2 text-xs text-slate-500">Storage: {loading ? 'checking…' : storage}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/admin" className="rounded-xl border bg-white px-3 py-2 hover:bg-slate-50">Admin home</Link>
          <Link href="/admin/orders" className="rounded-xl border bg-white px-3 py-2 hover:bg-slate-50">Orders</Link>
        </div>
      </header>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-950">Broadcast and offer quality</h2>
          <p className="mt-1 text-xs text-slate-500">Controls which pharmacies receive invitations and when the search expands.</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500">Initial radius, km</span>
              <input
                type="number"
                min={1}
                max={50}
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={broadcastPolicy.initialRadiusKm}
                onChange={(e) => setBroadcastPolicy((s) => ({ ...s, initialRadiusKm: Number(e.target.value) }))}
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500">Expansion interval, minutes</span>
              <input
                type="number"
                min={1}
                max={60}
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={broadcastPolicy.expansionIntervalMinutes}
                onChange={(e) => setBroadcastPolicy((s) => ({ ...s, expansionIntervalMinutes: Number(e.target.value) }))}
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500">Expansion step, km</span>
              <input
                type="number"
                min={1}
                max={50}
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={broadcastPolicy.expansionStepKm}
                onChange={(e) => setBroadcastPolicy((s) => ({ ...s, expansionStepKm: Number(e.target.value) }))}
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500">Maximum radius, km</span>
              <input
                type="number"
                min={1}
                max={100}
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={broadcastPolicy.maxRadiusKm}
                onChange={(e) => setBroadcastPolicy((s) => ({ ...s, maxRadiusKm: Number(e.target.value) }))}
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500">Minimum coverage ratio</span>
              <input
                type="number"
                min={0}
                max={1}
                step="0.05"
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={broadcastPolicy.minCoverageRatio}
                onChange={(e) => setBroadcastPolicy((s) => ({ ...s, minCoverageRatio: Number(e.target.value) }))}
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500">Expand if accepted offers below</span>
              <input
                type="number"
                min={1}
                max={20}
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={broadcastPolicy.minAcceptedOffersBeforeExpansion}
                onChange={(e) => setBroadcastPolicy((s) => ({ ...s, minAcceptedOffersBeforeExpansion: Number(e.target.value) }))}
              />
            </label>
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-950">Pricing and COD guardrails</h2>
          <p className="mt-1 text-xs text-slate-500">Keep delivery and cash-on-delivery limits predictable across pharmacies.</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500">Country</span>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={pricingPolicy.country}
                onChange={(e) => setPricingPolicy((s) => ({ ...s, country: e.target.value.toUpperCase().slice(0, 3) }))}
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500">Currency</span>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={pricingPolicy.currency}
                onChange={(e) => setPricingPolicy((s) => ({ ...s, currency: e.target.value.toUpperCase().slice(0, 3) }))}
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500">COD limit</span>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={moneyForm.codLimit}
                onChange={(e) => setMoneyForm((s) => ({ ...s, codLimit: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500">Base delivery fee</span>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={moneyForm.baseDeliveryFee}
                onChange={(e) => setMoneyForm((s) => ({ ...s, baseDeliveryFee: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500">Per-km delivery fee</span>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={moneyForm.perKmDeliveryFee}
                onChange={(e) => setMoneyForm((s) => ({ ...s, perKmDeliveryFee: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500">Maximum delivery fee</span>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={moneyForm.maxDeliveryFee}
                onChange={(e) => setMoneyForm((s) => ({ ...s, maxDeliveryFee: e.target.value }))}
              />
            </label>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={pricingPolicy.codEnabled}
              onChange={(e) => setPricingPolicy((s) => ({ ...s, codEnabled: e.target.checked }))}
            />
            Enable cash on delivery when within configured limit
          </label>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? 'Saving…' : 'Save CarePort configuration'}
        </button>
      </div>
    </main>
  );
}
