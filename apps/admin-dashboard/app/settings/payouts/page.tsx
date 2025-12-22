// apps/admin-dashboard/app/settings/payout/page.tsx
'use client';

import { useEffect, useState } from 'react';

/* ---------- Types ---------- */

type ClinicianClass = {
  id: string;
  name: string;
  enabled: boolean;
  rxPayoutPercent: number; // % of consult revenue
};

type Payouts = {
  riderPayoutPercent: number;
  pharmacyCommissionPercent: number;
  platformCommissionPercent: number;
  labCommissionPercent: number;
  monthlyFees: { pharmacyZAR: number; labZAR: number };
  clinicianErxCommissionPercent: number;
  clinicianClasses: ClinicianClass[];
  deliveryModel: { baseFeeZAR: number; perKmZAR: number };
};

/* ---------- Fallback config (used when API fails) ---------- */

const DEFAULT_PAYOUTS: Payouts = {
  riderPayoutPercent: 40,
  pharmacyCommissionPercent: 10,
  platformCommissionPercent: 8,
  labCommissionPercent: 12,
  monthlyFees: {
    pharmacyZAR: 1200,
    labZAR: 1800,
  },
  clinicianErxCommissionPercent: 0,
  clinicianClasses: [
    {
      id: 'classA',
      name: 'Class A — Doctors',
      enabled: true,
      rxPayoutPercent: 70,
    },
    {
      id: 'classB',
      name: 'Class B — Allied Health',
      enabled: true,
      rxPayoutPercent: 65,
    },
    {
      id: 'classC',
      name: 'Class C — Wellness',
      enabled: true,
      rxPayoutPercent: 60,
    },
  ],
  deliveryModel: {
    baseFeeZAR: 45,
    perKmZAR: 6.5,
  },
};

/* ---------- Small UI primitives ---------- */

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
      <div>
        <div className="text-sm font-medium text-gray-900">
          {title}
        </div>
        {subtitle && (
          <div className="text-[11px] text-gray-500 mt-0.5">
            {subtitle}
          </div>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function NumRow({
  label,
  suffix,
  value,
  onChange,
}: {
  label: string;
  suffix?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs">
      <span className="text-gray-600">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          className="w-24 rounded border px-2 py-1 text-right text-xs"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) =>
            onChange(Number.isNaN(Number(e.target.value)) ? 0 : Number(e.target.value))
          }
        />
        {suffix && <span className="text-gray-500">{suffix}</span>}
      </div>
    </label>
  );
}

function PercentRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <NumRow
      label={label}
      suffix="%"
      value={value}
      onChange={(v) =>
        onChange(Math.max(0, Math.min(100, Math.round(v))))
      }
    />
  );
}

/* ---------- Page ---------- */

export default function PayoutSettingsPage() {
  const [cfg, setCfg] = useState<Payouts | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Load configuration
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await fetch('/api/settings/payouts', {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Payouts;
        if (!mounted) return;
        setCfg(json);
      } catch (e: any) {
        console.error('load payouts config error', e);
        if (!mounted) return;
        // Fallback to default config but show a soft warning
        setErr(
          e?.message ||
            'Unable to load payout configuration from API. Showing editable defaults.',
        );
        setCfg(DEFAULT_PAYOUTS);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  function upd(path: string, val: any) {
    if (!cfg) return;
    const next: any = structuredClone(cfg);
    const keys = path.split('.');
    let cur = next;
    for (let i = 0; i < keys.length - 1; i++) {
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = val;
    setCfg(next);
    setSaved(false);
  }

  function setClass(idx: number, patch: Partial<ClinicianClass>) {
    if (!cfg) return;
    const next: Payouts = structuredClone(cfg);
    next.clinicianClasses[idx] = {
      ...next.clinicianClasses[idx],
      ...patch,
    };
    setCfg(next);
    setSaved(false);
  }

  function addClass() {
    if (!cfg) return;
    const next: Payouts = structuredClone(cfg);
    next.clinicianClasses.push({
      id: crypto.randomUUID(),
      name: 'New clinician class',
      enabled: true,
      rxPayoutPercent: 70,
    });
    setCfg(next);
    setSaved(false);
  }

  function removeClass(idx: number) {
    if (!cfg) return;
    const next: Payouts = structuredClone(cfg);
    next.clinicianClasses.splice(idx, 1);
    setCfg(next);
    setSaved(false);
  }

  async function save() {
    if (!cfg) return;
    setSaving(true);
    setSaved(false);
    setErr(null);
    try {
      const res = await fetch('/api/settings/payouts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      console.error('save payouts error', e);
      setErr(e?.message || 'Save failed');
      setSaved(false);
    } finally {
      setSaving(false);
    }
  }

  if (loading && !cfg) {
    return (
      <div className="rounded-2xl border bg-white px-4 py-6 text-sm text-gray-500">
        Loading payout configuration…
      </div>
    );
  }

  if (!cfg) {
    return (
      <div className="rounded-2xl border bg-white px-4 py-6 text-sm text-rose-600">
        Unable to load payout configuration and no fallback is available.
      </div>
    );
  }

  const totalCommission =
    cfg.pharmacyCommissionPercent +
    cfg.labCommissionPercent +
    cfg.platformCommissionPercent;

  return (
    <div className="space-y-5">
      {err && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {err}
        </div>
      )}

      {/* High-level cards */}
      <section className="grid gap-4 md:grid-cols-2">
        <Card
          title="Delivery & Fulfilment Payouts"
          subtitle="How GMV is split between riders/phlebs, pharmacies, labs and the platform."
        >
          <PercentRow
            label="Rider / phleb payout share"
            value={cfg.riderPayoutPercent}
            onChange={(v) => upd('riderPayoutPercent', v)}
          />
          <PercentRow
            label="Pharmacy commission (CarePort orders)"
            value={cfg.pharmacyCommissionPercent}
            onChange={(v) => upd('pharmacyCommissionPercent', v)}
          />
          <PercentRow
            label="Lab commission (MedReach draws)"
            value={cfg.labCommissionPercent}
            onChange={(v) => upd('labCommissionPercent', v)}
          />
          <PercentRow
            label="Platform commission"
            value={cfg.platformCommissionPercent}
            onChange={(v) => upd('platformCommissionPercent', v)}
          />
          <div className="mt-1 text-[11px] text-gray-500">
            Total commission (pharmacy + lab + platform):{' '}
            <span className="font-semibold">
              {totalCommission.toFixed(1)}%
            </span>
            . Riders/phlebs are paid from the remaining share.
          </div>
        </Card>

        <Card
          title="Access Fees & eRx Commission"
          subtitle="Recurring fees for partners and any default commission on clinician eRx."
        >
          <NumRow
            label="Pharmacy monthly access fee"
            suffix="ZAR"
            value={cfg.monthlyFees.pharmacyZAR}
            onChange={(v) => upd('monthlyFees.pharmacyZAR', Math.max(0, Math.round(v)))}
          />
          <NumRow
            label="Lab monthly access fee"
            suffix="ZAR"
            value={cfg.monthlyFees.labZAR}
            onChange={(v) => upd('monthlyFees.labZAR', Math.max(0, Math.round(v)))}
          />
          <PercentRow
            label="Default clinician eRx commission"
            value={cfg.clinicianErxCommissionPercent}
            onChange={(v) => upd('clinicianErxCommissionPercent', v)}
          />
          <div className="mt-1 text-[11px] text-gray-500">
            Set clinician eRx commission to <strong>0%</strong> if clinicians
            are only paid at consultation-level, and not per Rx.
          </div>
        </Card>
      </section>

      {/* Delivery model */}
      <section>
        <Card
          title="Delivery Fee Model"
          subtitle="Base fee + per-km configuration used to quote patients for delivery and to calculate rider/phleb payouts."
        >
          <NumRow
            label="Base fee per job"
            suffix="ZAR"
            value={cfg.deliveryModel.baseFeeZAR}
            onChange={(v) => upd('deliveryModel.baseFeeZAR', Math.max(0, v))}
          />
          <NumRow
            label="Per-km component"
            suffix="ZAR / km"
            value={cfg.deliveryModel.perKmZAR}
            onChange={(v) => upd('deliveryModel.perKmZAR', Math.max(0, v))}
          />
          <div className="mt-1 text-[11px] text-gray-500">
            The rider/phleb payout share is applied to the delivered fee model
            above, after commissions, to compute their actual earnings per job.
          </div>
        </Card>
      </section>

      {/* Clinician classes table */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-gray-900">
              Clinician Rx payout classes
            </div>
            <div className="text-[11px] text-gray-500">
              Configure different payout tiers for clinician classes (e.g.
              doctors vs allied health, premium vs standard).
            </div>
          </div>
          <button
            type="button"
            onClick={addClass}
            className="inline-flex items-center rounded-full border bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-900"
          >
            + Add class
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr className="text-left">
                <th className="px-3 py-2">Enabled</th>
                <th className="px-3 py-2">Class name</th>
                <th className="px-3 py-2 text-right">Rx payout %</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cfg.clinicianClasses.length ? (
                cfg.clinicianClasses.map((c, idx) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={c.enabled}
                        onChange={(e) =>
                          setClass(idx, { enabled: e.target.checked })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="w-full rounded border px-2 py-1 text-xs"
                        value={c.name}
                        onChange={(e) =>
                          setClass(idx, { name: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        className="w-20 rounded border px-2 py-1 text-right text-xs"
                        value={c.rxPayoutPercent}
                        onChange={(e) =>
                          setClass(idx, {
                            rxPayoutPercent: Math.max(
                              0,
                              Math.min(
                                100,
                                Number(e.target.value || 0),
                              ),
                            ),
                          })
                        }
                      />{' '}
                      %
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeClass(idx)}
                        className="rounded border px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-4 text-center text-xs text-gray-500"
                  >
                    No clinician classes configured yet. Add at least one
                    class to control payout tiers.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-2 text-[11px] text-gray-500">
          You can align these classes with your{' '}
          <span className="font-medium">Plans</span> and{' '}
          <span className="font-medium">Roles</span> configuration (e.g.
          premium clinicians vs standard clinicians).
        </div>
      </section>

      {/* Save bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center rounded-md border border-black bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save payout configuration'}
        </button>
        {saved && (
          <span className="text-xs text-emerald-700">
            Saved ✓
          </span>
        )}
        {err && (
          <span className="text-xs text-rose-600">
            {err}
          </span>
        )}
      </div>
    </div>
  );
}
