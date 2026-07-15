'use client';

import React, { useEffect, useState } from 'react';

type PatientPlan = {
  id: 'free' | 'premium' | 'family';
  actor: 'patient';
  label: string;
  description: string;
  currency: string;
  priceMonthlyZar: number;
  recommendedFor: string;
  highlight: boolean;
  enabled: boolean;
};

type ClinicianPlan = {
  id: 'solo' | 'starter' | 'team' | 'group';
  actor: 'clinician';
  label: string;
  description: string;
  currency: string;
  monthlySubscriptionZar: number;
  payoutSharePct: number;
  includedAdminSlots: number;
  maxAdminSlots: number;
  extraAdminSlotZar: number | null;
  recommendedFor: string;
  highlight: boolean;
  enabled: boolean;
};

type PlansConfig = {
  patientPlans: PatientPlan[];
  clinicianPlans: ClinicianPlan[];
};

const EMPTY_CONFIG: PlansConfig = {
  patientPlans: [],
  clinicianPlans: [],
};

function asMoney(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

function TextInput(props: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={props.value}
      placeholder={props.placeholder}
      onChange={(event) => props.onChange(event.target.value)}
      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
    />
  );
}

function NumberInput(props: {
  value: number | null;
  onChange: (value: number | null) => void;
  nullable?: boolean;
}) {
  return (
    <input
      type="number"
      value={props.value ?? ''}
      onChange={(event) => {
        if (props.nullable && event.target.value.trim() === '') {
          props.onChange(null);
          return;
        }
        props.onChange(asMoney(event.target.value));
      }}
      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
    />
  );
}

function Toggle(props: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
      />
      {props.label}
    </label>
  );
}

export default function PlansSettingsPage() {
  const [cfg, setCfg] = useState<PlansConfig>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch('/api/settings/plans', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.message || json?.error || 'Failed to load plan settings.');
      }

      setCfg({
        patientPlans: Array.isArray(json.patientPlans) ? json.patientPlans : [],
        clinicianPlans: Array.isArray(json.clinicianPlans) ? json.clinicianPlans : [],
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to load plan settings.');
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch('/api/settings/plans', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(cfg),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.message || json?.error || 'Failed to save plan settings.');
      }

      setCfg({
        patientPlans: Array.isArray(json.patientPlans) ? json.patientPlans : cfg.patientPlans,
        clinicianPlans: Array.isArray(json.clinicianPlans) ? json.clinicianPlans : cfg.clinicianPlans,
      });
      setNotice('Plan settings saved.');
    } catch (err: any) {
      setError(err?.message || 'Failed to save plan settings.');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function patchPatient(index: number, next: Partial<PatientPlan>) {
    setCfg((current) => {
      const patientPlans = [...current.patientPlans];
      patientPlans[index] = { ...patientPlans[index], ...next };
      return { ...current, patientPlans };
    });
  }

  function patchClinician(index: number, next: Partial<ClinicianPlan>) {
    setCfg((current) => {
      const clinicianPlans = [...current.clinicianPlans];
      clinicianPlans[index] = { ...clinicianPlans[index], ...next };
      return { ...current, clinicianPlans };
    });
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                Admin settings
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                Patient and clinician plan pricing
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Configure all subscription plan amounts from Admin. Patient and clinician apps must read these values
                instead of hardcoding plan-tier fees.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading || saving}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={loading || saving}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save plan settings'}
              </button>
            </div>
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

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Patient plans</h2>
          <p className="mt-1 text-sm text-slate-500">
            These prices drive the patient upgrade and checkout flow.
          </p>

          <div className="mt-5 grid gap-4">
            {cfg.patientPlans.map((plan, index) => (
              <div key={plan.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 lg:grid-cols-4">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Plan</div>
                    <div className="mt-1 font-semibold text-slate-950">{plan.label}</div>
                    <div className="text-xs text-slate-500">{plan.id}</div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-500">Monthly price ZAR</div>
                    <NumberInput
                      value={plan.priceMonthlyZar}
                      onChange={(value) => patchPatient(index, { priceMonthlyZar: value ?? 0 })}
                    />
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-500">Currency</div>
                    <TextInput
                      value={plan.currency}
                      onChange={(value) => patchPatient(index, { currency: value.toUpperCase().slice(0, 3) })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Toggle
                      label="Enabled"
                      checked={plan.enabled}
                      onChange={(value) => patchPatient(index, { enabled: value })}
                    />
                    <Toggle
                      label="Highlight"
                      checked={plan.highlight}
                      onChange={(value) => patchPatient(index, { highlight: value })}
                    />
                  </div>
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <TextInput
                    value={plan.description}
                    onChange={(value) => patchPatient(index, { description: value })}
                    placeholder="Description"
                  />
                  <TextInput
                    value={plan.recommendedFor}
                    onChange={(value) => patchPatient(index, { recommendedFor: value })}
                    placeholder="Recommended for"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Clinician plans</h2>
          <p className="mt-1 text-sm text-slate-500">
            These prices drive clinician subscription tier display and downstream charging logic.
          </p>

          <div className="mt-5 grid gap-4">
            {cfg.clinicianPlans.map((plan, index) => (
              <div key={plan.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 lg:grid-cols-5">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Plan</div>
                    <div className="mt-1 font-semibold text-slate-950">{plan.label}</div>
                    <div className="text-xs text-slate-500">{plan.id}</div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-500">Monthly subscription ZAR</div>
                    <NumberInput
                      value={plan.monthlySubscriptionZar}
                      onChange={(value) => patchClinician(index, { monthlySubscriptionZar: value ?? 0 })}
                    />
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-500">Included admin slots</div>
                    <NumberInput
                      value={plan.includedAdminSlots}
                      onChange={(value) => patchClinician(index, { includedAdminSlots: value ?? 0 })}
                    />
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-500">Max admin slots</div>
                    <NumberInput
                      value={plan.maxAdminSlots}
                      onChange={(value) => patchClinician(index, { maxAdminSlots: value ?? 0 })}
                    />
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-500">Extra admin slot ZAR</div>
                    <NumberInput
                      value={plan.extraAdminSlotZar}
                      nullable
                      onChange={(value) => patchClinician(index, { extraAdminSlotZar: value })}
                    />
                  </div>
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-4">
                  <TextInput
                    value={plan.currency}
                    onChange={(value) => patchClinician(index, { currency: value.toUpperCase().slice(0, 3) })}
                  />
                  <TextInput
                    value={plan.description}
                    onChange={(value) => patchClinician(index, { description: value })}
                    placeholder="Description"
                  />
                  <TextInput
                    value={plan.recommendedFor}
                    onChange={(value) => patchClinician(index, { recommendedFor: value })}
                    placeholder="Recommended for"
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Toggle
                      label="Enabled"
                      checked={plan.enabled}
                      onChange={(value) => patchClinician(index, { enabled: value })}
                    />
                    <Toggle
                      label="Highlight"
                      checked={plan.highlight}
                      onChange={(value) => patchClinician(index, { highlight: value })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
