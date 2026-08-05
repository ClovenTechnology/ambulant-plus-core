// apps/clinician-app/app/settings/fees/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { SettingsTabs } from '@/components/SettingsTabs';
import { toast } from '@/components/ToastMount';

type BillingUnit = 'per_consult' | 'per_followup' | 'per_hour' | 'per_day' | 'per_task';
type ServiceOwnerType = 'clinician' | 'admin_staff';

type ServiceFee = {
  id: string;
  ownerType: ServiceOwnerType;
  ownerAdminStaffId?: string;
  code?: string;
  label: string;
  description?: string | null;
  billingUnit: BillingUnit;
  amountCents: number; // minor units (kept for API compatibility)
  currency: string;
  active: boolean;
};

type AdminStaffCompMode = 'none' | 'flat_monthly' | 'percent_revenue';

type AdminStaffCompensation = {
  mode: AdminStaffCompMode;
  amountCents?: number | null; // minor units
  percent?: number | null;
};

type AdminStaffNormalized = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  type: 'medical' | 'non-medical';
  role?: string | null;
  status: 'active' | 'invited' | 'disabled';
  compensation: AdminStaffCompensation;
  canHaveServices: boolean;
};

type FeesExtendedGetResponse = {
  ok: boolean;
  currency: string;
  baseFees: {
    consultationCents: number;
    followupCents: number;
  };
  clinicianServices: ServiceFee[];
  adminStaff: {
    staff: AdminStaffNormalized[];
    services: ServiceFee[];
  };
  error?: string;
};

type MultiCareFeeKind = 'STANDARD' | 'FOLLOWUP';
type MultiCareVisitMode = 'televisit' | 'in_person' | 'hybrid';
type MultiCarePricingMode =
  | 'FULL_FEE_PER_RECIPIENT'
  | 'BASE_PLUS_ADDITIONAL'
  | 'FIXED_PACKAGE'
  | 'NO_ADDITIONAL_FEE';

type MultiCarePolicy = {
  id: string | null;
  clinicianUserId: string;
  feeKind: MultiCareFeeKind;
  visitMode: MultiCareVisitMode;
  enabled: boolean;
  pricingMode: MultiCarePricingMode;
  currency: string;
  includedCareRecipients: number;
  additionalRecipientAmountMinor: number | null;
  additionalRecipientPercentBps: number | null;
  packageAmountMinor: number | null;
  maxCareRecipients: number;
  additionalMinutesPerRecipient: number;
  maxAdditionalMinutes: number | null;
  requireAllRecipientsVerifiedBeforeCheckout: boolean;
  allowPendingAdultInvitations: boolean;
  allowProvisionalDependentProfiles: boolean;
  version: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  persisted: boolean;
};

type MultiCarePolicyResponse = {
  ok: boolean;
  currency: string;
  policies: MultiCarePolicy[];
  error?: string;
  detail?: string;
};

function currencyFractionDigits(currency: string) {
  try {
    const opts = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions();
    return typeof opts.maximumFractionDigits === 'number' ? opts.maximumFractionDigits : 2;
  } catch {
    return 2;
  }
}

function minorToMajor(minor: number, currency: string) {
  const d = currencyFractionDigits(currency);
  const n = Number.isFinite(minor) ? minor : 0;
  const denom = Math.pow(10, d);
  // keep a stable number for inputs
  return Number((n / denom).toFixed(d));
}

function majorToMinor(major: number, currency: string) {
  const d = currencyFractionDigits(currency);
  const n = Number.isFinite(major) ? major : 0;
  const mult = Math.pow(10, d);
  return Math.round(n * mult);
}

function stepForCurrency(currency: string) {
  const d = currencyFractionDigits(currency);
  return d === 0 ? 1 : Math.pow(10, -d);
}

const BILLING_UNIT_LABEL: Record<BillingUnit, string> = {
  per_consult: 'Per consultation',
  per_followup: 'Per follow-up',
  per_hour: 'Per hour',
  per_day: 'Per day',
  per_task: 'Per task',
};

const MULTI_CARE_VISIT_MODE_LABEL: Record<MultiCareVisitMode, string> = {
  televisit: 'Televisit',
  in_person: 'In person',
  hybrid: 'Hybrid',
};

const MULTI_CARE_FEE_KIND_LABEL: Record<MultiCareFeeKind, string> = {
  STANDARD: 'Standard consultation',
  FOLLOWUP: 'Follow-up consultation',
};

const MULTI_CARE_PRICING_MODE_LABEL: Record<MultiCarePricingMode, string> = {
  FULL_FEE_PER_RECIPIENT: 'Full consultation fee per care recipient',
  BASE_PLUS_ADDITIONAL: 'Base fee plus an additional-recipient charge',
  FIXED_PACKAGE: 'Fixed package price',
  NO_ADDITIONAL_FEE: 'No additional fee',
};

const MULTI_CARE_VISIT_MODES: MultiCareVisitMode[] = [
  'televisit',
  'in_person',
  'hybrid',
];

const MULTI_CARE_FEE_KINDS: MultiCareFeeKind[] = [
  'STANDARD',
  'FOLLOWUP',
];

function multiCarePolicyKey(
  feeKind: MultiCareFeeKind,
  visitMode: MultiCareVisitMode,
) {
  return `${feeKind}:${visitMode}`;
}

export default function FeesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currency, setCurrency] = useState('ZAR');
  const currencyStep = useMemo(() => stepForCurrency(currency), [currency]);

  // major units (e.g. 250.00 ZAR / 80.00 USD)
  const [consultMajor, setConsultMajor] = useState(0);
  const [followupMajor, setFollowupMajor] = useState(0);

  const [clinicianServices, setClinicianServices] = useState<ServiceFee[]>([]);
  const [adminStaff, setAdminStaff] = useState<AdminStaffNormalized[]>([]);
  const [adminServices, setAdminServices] = useState<ServiceFee[]>([]);

  const [touched, setTouched] = useState(false);

  const [multiCareLoading, setMultiCareLoading] = useState(true);
  const [multiCareSaving, setMultiCareSaving] = useState(false);
  const [multiCareError, setMultiCareError] = useState<string | null>(null);
  const [multiCarePolicies, setMultiCarePolicies] = useState<MultiCarePolicy[]>([]);
  const [multiCareTouched, setMultiCareTouched] = useState(false);
  const [selectedVisitMode, setSelectedVisitMode] =
    useState<MultiCareVisitMode>('televisit');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/clinicians/me/fees/extended', { cache: 'no-store' });
        const js: FeesExtendedGetResponse = await res.json().catch(() => ({} as any));
        if (!res.ok || js.ok === false) {
          throw new Error(js.error || `Failed to load fees (${res.status})`);
        }
        if (cancelled) return;

        const cur = js.currency || 'ZAR';
        setCurrency(cur);
        setConsultMajor(minorToMajor(js.baseFees.consultationCents, cur));
        setFollowupMajor(minorToMajor(js.baseFees.followupCents, cur));

        setClinicianServices(js.clinicianServices || []);
        setAdminStaff(js.adminStaff?.staff || []);
        setAdminServices(js.adminStaff?.services || []);
        setTouched(false);
      } catch (err: any) {
        console.error('Fees load error', err);
        if (!cancelled) setError(err?.message || 'Failed to load fees & services');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);


  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setMultiCareLoading(true);
        setMultiCareError(null);

        const res = await fetch(
          '/api/clinicians/me/multi-care-policy',
          { cache: 'no-store' },
        );
        const js: MultiCarePolicyResponse = await res
          .json()
          .catch(() => ({} as any));

        if (!res.ok || js.ok === false) {
          throw new Error(
            js.detail ||
              js.error ||
              `Failed to load multi-care policy (${res.status})`,
          );
        }

        if (cancelled) return;

        setMultiCarePolicies(
          Array.isArray(js.policies) ? js.policies : [],
        );
        setMultiCareTouched(false);
      } catch (err: any) {
        console.error('Multi-care policy load error', err);

        if (!cancelled) {
          setMultiCareError(
            err?.message || 'Failed to load multi-care policy',
          );
        }
      } finally {
        if (!cancelled) setMultiCareLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const markMultiCareTouched = () => {
    if (!multiCareTouched) setMultiCareTouched(true);
  };

  const updateMultiCarePolicy = (
    feeKind: MultiCareFeeKind,
    patch: Partial<MultiCarePolicy>,
  ) => {
    markMultiCareTouched();

    setMultiCarePolicies((previous) =>
      previous.map((policy) =>
        multiCarePolicyKey(policy.feeKind, policy.visitMode) ===
        multiCarePolicyKey(feeKind, selectedVisitMode)
          ? { ...policy, ...patch }
          : policy,
      ),
    );
  };

  const handleSaveMultiCare = async () => {
    try {
      setMultiCareSaving(true);
      setMultiCareError(null);

      const response = await fetch(
        '/api/clinicians/me/multi-care-policy',
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ policies: multiCarePolicies }),
        },
      );
      const body: MultiCarePolicyResponse = await response
        .json()
        .catch(() => ({} as any));

      if (!response.ok || body.ok === false) {
        throw new Error(
          body.detail ||
            body.error ||
            `Multi-care policy save failed (${response.status})`,
        );
      }

      setMultiCarePolicies(
        Array.isArray(body.policies) ? body.policies : [],
      );
      setMultiCareTouched(false);
      toast('Multi-care consultation policy updated.', 'success');
    } catch (err: any) {
      console.error('Multi-care policy save error', err);
      setMultiCareError(
        err?.message || 'Failed to save multi-care policy',
      );
      toast(
        err?.message || 'Failed to save multi-care policy',
        'error',
      );
    } finally {
      setMultiCareSaving(false);
    }
  };

  const markTouched = () => {
    if (!touched) setTouched(true);
  };

  const handleAddService = () => {
    markTouched();
    setClinicianServices((prev) => [
      ...prev,
      {
        id: `sf-ui-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
        ownerType: 'clinician',
        label: 'New service',
        billingUnit: 'per_consult',
        amountCents: 0,
        currency,
        active: true,
      },
    ]);
  };

  const handleUpdateService = (id: string, patch: Partial<ServiceFee>) => {
    markTouched();
    setClinicianServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const handleRemoveService = (id: string) => {
    markTouched();
    setClinicianServices((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAdminCompChange = (staffId: string, patch: Partial<AdminStaffCompensation>) => {
    markTouched();
    setAdminStaff((prev) =>
      prev.map((s) =>
        s.id === staffId
          ? { ...s, compensation: { ...s.compensation, ...patch } }
          : s,
      ),
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const adminStaffComp = adminStaff.map((s) => {
        const mode = s.compensation?.mode || 'none';
        const base: any = { adminStaffId: s.id, mode };
        if (mode === 'flat_monthly') {
          base.amountCents = s.compensation?.amountCents ?? 0;
        } else if (mode === 'percent_revenue') {
          base.percent = s.compensation?.percent ?? 0;
        }
        return base;
      });

      const allServices: any[] = [...clinicianServices, ...adminServices].map((s) => ({
        id: s.id,
        ownerType: s.ownerType,
        ownerAdminStaffId: s.ownerAdminStaffId,
        code: s.code,
        label: s.label,
        description: s.description,
        billingUnit: s.billingUnit,
        amountCents: s.amountCents,
        currency: s.currency || currency,
        active: s.active,
      }));

      const payload = {
        baseFees: {
          consultationCents: majorToMinor(consultMajor, currency),
          followupCents: majorToMinor(followupMajor, currency),
          currency,
        },
        services: allServices,
        adminStaffComp,
      };

      const res = await fetch('/api/clinicians/me/fees/extended', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const js: FeesExtendedGetResponse = await res.json().catch(() => ({} as any));
      if (!res.ok || js.ok === false) throw new Error(js.error || `Save failed (${res.status})`);

      const cur = js.currency || 'ZAR';
      setCurrency(cur);
      setConsultMajor(minorToMajor(js.baseFees.consultationCents, cur));
      setFollowupMajor(minorToMajor(js.baseFees.followupCents, cur));
      setClinicianServices(js.clinicianServices || []);
      setAdminStaff(js.adminStaff?.staff || []);
      setAdminServices(js.adminStaff?.services || []);
      setTouched(false);

      toast('Fees & services updated.', 'success');
    } catch (err: any) {
      console.error('Fees save error', err);
      setError(err?.message || 'Failed to save fees');
      toast(err?.message || 'Failed to save fees', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="p-6 space-y-4 max-w-5xl mx-auto">
      <SettingsTabs />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Fees &amp; Services</h1>
          <p className="text-sm text-gray-600">
            Configure your base consultation fees, optional add-on services, and how admin staff are compensated.
          </p>
        </div>
        <div className="text-xs text-gray-500">
          Currency: <span className="font-mono">{currency}</span>
        </div>
      </header>

      {loading && <div className="text-sm text-gray-600">Loading fees…</div>}
      {error && (
        <div className="text-sm text-rose-600 border border-rose-200 bg-rose-50 px-3 py-2 rounded">
          {error}
        </div>
      )}

      {/* Base consultation fees */}
      <section className="border rounded bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">Base consultation fees</h2>
        <p className="text-xs text-gray-600">
          These are used for standard bookings and appear in payout calculations as your default consultation fees.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 mt-2">
          <label className="text-xs text-gray-700 flex flex-col gap-1">
            Standard consultation ({currency})
            <input
              className="border rounded px-2 py-1 w-full text-sm"
              type="number"
              min={0}
              step={currencyStep}
              value={consultMajor}
              onChange={(e) => {
                markTouched();
                setConsultMajor(Number(e.target.value || '0'));
              }}
            />
          </label>

          <label className="text-xs text-gray-700 flex flex-col gap-1">
            Follow-up ({currency})
            <input
              className="border rounded px-2 py-1 w-full text-sm"
              type="number"
              min={0}
              step={currencyStep}
              value={followupMajor}
              onChange={(e) => {
                markTouched();
                setFollowupMajor(Number(e.target.value || '0'));
              }}
            />
          </label>
        </div>
      </section>

      {/* Multi-care consultation policy */}
      <section className="border rounded bg-white p-4 space-y-4 text-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">
              Multi-care consultations
            </h2>
            <p className="text-xs text-gray-600 max-w-3xl">
              Decide whether one appointment may cover multiple people receiving
              care. Each care recipient will still have an individual clinical
              encounter, record and downstream orders.
            </p>
          </div>

          <div className="flex flex-wrap gap-1">
            {MULTI_CARE_VISIT_MODES.map((visitMode) => (
              <button
                key={visitMode}
                type="button"
                onClick={() => setSelectedVisitMode(visitMode)}
                className={`px-3 py-1.5 rounded border text-xs ${
                  selectedVisitMode === visitMode
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-700'
                }`}
              >
                {MULTI_CARE_VISIT_MODE_LABEL[visitMode]}
              </button>
            ))}
          </div>
        </div>

        {multiCareLoading && (
          <div className="text-gray-600">
            Loading multi-care consultation policy…
          </div>
        )}

        {multiCareError && (
          <div className="text-rose-600 border border-rose-200 bg-rose-50 px-3 py-2 rounded">
            {multiCareError}
          </div>
        )}

        {!multiCareLoading && multiCarePolicies.length > 0 && (
          <div className="grid xl:grid-cols-2 gap-4">
            {MULTI_CARE_FEE_KINDS.map((feeKind) => {
              const policy = multiCarePolicies.find(
                (candidate) =>
                  candidate.feeKind === feeKind &&
                  candidate.visitMode === selectedVisitMode,
              );

              if (!policy) return null;

              const policyCurrency = policy.currency || currency;
              const pricingMode = policy.pricingMode;
              const additionalChargeType =
                policy.additionalRecipientPercentBps != null
                  ? 'percentage'
                  : 'fixed';

              return (
                <div
                  key={multiCarePolicyKey(feeKind, selectedVisitMode)}
                  className="border rounded p-3 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-800">
                        {MULTI_CARE_FEE_KIND_LABEL[feeKind]}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {policy.persisted
                          ? `Policy version ${policy.version}`
                          : 'Not configured yet'}
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={policy.enabled}
                        onChange={(event) =>
                          updateMultiCarePolicy(feeKind, {
                            enabled: event.target.checked,
                          })
                        }
                      />
                      Enabled
                    </label>
                  </div>

                  <label className="flex flex-col gap-1">
                    Pricing method
                    <select
                      className="border rounded px-2 py-1 text-sm"
                      value={pricingMode}
                      onChange={(event) => {
                        const nextMode =
                          event.target.value as MultiCarePricingMode;

                        updateMultiCarePolicy(feeKind, {
                          pricingMode: nextMode,
                          additionalRecipientAmountMinor:
                            nextMode === 'BASE_PLUS_ADDITIONAL'
                              ? policy.additionalRecipientPercentBps == null
                                ? policy.additionalRecipientAmountMinor ?? 0
                                : null
                              : null,
                          additionalRecipientPercentBps:
                            nextMode === 'BASE_PLUS_ADDITIONAL'
                              ? policy.additionalRecipientPercentBps
                              : null,
                          packageAmountMinor:
                            nextMode === 'FIXED_PACKAGE'
                              ? policy.packageAmountMinor ?? 0
                              : null,
                        });
                      }}
                    >
                      {(
                        Object.keys(
                          MULTI_CARE_PRICING_MODE_LABEL,
                        ) as MultiCarePricingMode[]
                      ).map((mode) => (
                        <option key={mode} value={mode}>
                          {MULTI_CARE_PRICING_MODE_LABEL[mode]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1">
                      Care recipients included in base price
                      <input
                        type="number"
                        min={1}
                        max={policy.maxCareRecipients}
                        className="border rounded px-2 py-1 text-sm"
                        value={policy.includedCareRecipients}
                        onChange={(event) =>
                          updateMultiCarePolicy(feeKind, {
                            includedCareRecipients: Math.max(
                              1,
                              Math.min(
                                policy.maxCareRecipients,
                                Number(event.target.value || '1'),
                              ),
                            ),
                          })
                        }
                      />
                    </label>

                    <label className="flex flex-col gap-1">
                      Maximum care recipients
                      <input
                        type="number"
                        min={2}
                        max={20}
                        className="border rounded px-2 py-1 text-sm"
                        value={policy.maxCareRecipients}
                        onChange={(event) => {
                          const maxCareRecipients = Math.max(
                            2,
                            Math.min(
                              20,
                              Number(event.target.value || '2'),
                            ),
                          );

                          updateMultiCarePolicy(feeKind, {
                            maxCareRecipients,
                            includedCareRecipients: Math.min(
                              policy.includedCareRecipients,
                              maxCareRecipients,
                            ),
                          });
                        }}
                      />
                    </label>
                  </div>

                  {pricingMode === 'BASE_PLUS_ADDITIONAL' && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <label className="flex flex-col gap-1">
                        Additional-recipient charge type
                        <select
                          className="border rounded px-2 py-1 text-sm"
                          value={additionalChargeType}
                          onChange={(event) => {
                            const nextType = event.target.value;

                            updateMultiCarePolicy(
                              feeKind,
                              nextType === 'percentage'
                                ? {
                                    additionalRecipientAmountMinor: null,
                                    additionalRecipientPercentBps:
                                      policy.additionalRecipientPercentBps ??
                                      0,
                                  }
                                : {
                                    additionalRecipientAmountMinor:
                                      policy.additionalRecipientAmountMinor ??
                                      0,
                                    additionalRecipientPercentBps: null,
                                  },
                            );
                          }}
                        >
                          <option value="fixed">
                            Fixed amount per additional recipient
                          </option>
                          <option value="percentage">
                            Percentage of the base consultation fee
                          </option>
                        </select>
                      </label>

                      {additionalChargeType === 'percentage' ? (
                        <label className="flex flex-col gap-1">
                          Additional percentage (%)
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            className="border rounded px-2 py-1 text-sm"
                            value={
                              (policy.additionalRecipientPercentBps || 0) /
                              100
                            }
                            onChange={(event) =>
                              updateMultiCarePolicy(feeKind, {
                                additionalRecipientPercentBps: Math.round(
                                  Math.max(
                                    0,
                                    Math.min(
                                      100,
                                      Number(event.target.value || '0'),
                                    ),
                                  ) * 100,
                                ),
                                additionalRecipientAmountMinor: null,
                              })
                            }
                          />
                        </label>
                      ) : (
                        <label className="flex flex-col gap-1">
                          Additional amount ({policyCurrency})
                          <input
                            type="number"
                            min={0}
                            step={stepForCurrency(policyCurrency)}
                            className="border rounded px-2 py-1 text-sm"
                            value={minorToMajor(
                              policy.additionalRecipientAmountMinor || 0,
                              policyCurrency,
                            )}
                            onChange={(event) =>
                              updateMultiCarePolicy(feeKind, {
                                additionalRecipientAmountMinor:
                                  majorToMinor(
                                    Number(event.target.value || '0'),
                                    policyCurrency,
                                  ),
                                additionalRecipientPercentBps: null,
                              })
                            }
                          />
                        </label>
                      )}
                    </div>
                  )}

                  {pricingMode === 'FIXED_PACKAGE' && (
                    <label className="flex flex-col gap-1">
                      Package amount ({policyCurrency})
                      <input
                        type="number"
                        min={0}
                        step={stepForCurrency(policyCurrency)}
                        className="border rounded px-2 py-1 text-sm"
                        value={minorToMajor(
                          policy.packageAmountMinor || 0,
                          policyCurrency,
                        )}
                        onChange={(event) =>
                          updateMultiCarePolicy(feeKind, {
                            packageAmountMinor: majorToMinor(
                              Number(event.target.value || '0'),
                              policyCurrency,
                            ),
                          })
                        }
                      />
                    </label>
                  )}

                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1">
                      Extra minutes per additional recipient
                      <input
                        type="number"
                        min={0}
                        max={240}
                        className="border rounded px-2 py-1 text-sm"
                        value={policy.additionalMinutesPerRecipient}
                        onChange={(event) =>
                          updateMultiCarePolicy(feeKind, {
                            additionalMinutesPerRecipient: Math.max(
                              0,
                              Math.min(
                                240,
                                Number(event.target.value || '0'),
                              ),
                            ),
                          })
                        }
                      />
                    </label>

                    <label className="flex flex-col gap-1">
                      Maximum added minutes
                      <input
                        type="number"
                        min={0}
                        max={720}
                        placeholder="No cap"
                        className="border rounded px-2 py-1 text-sm"
                        value={policy.maxAdditionalMinutes ?? ''}
                        onChange={(event) =>
                          updateMultiCarePolicy(feeKind, {
                            maxAdditionalMinutes:
                              event.target.value === ''
                                ? null
                                : Math.max(
                                    0,
                                    Math.min(
                                      720,
                                      Number(event.target.value || '0'),
                                    ),
                                  ),
                          })
                        }
                      />
                    </label>
                  </div>

                  <div className="space-y-2 border-t pt-3">
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={
                          policy.requireAllRecipientsVerifiedBeforeCheckout
                        }
                        onChange={(event) =>
                          updateMultiCarePolicy(feeKind, {
                            requireAllRecipientsVerifiedBeforeCheckout:
                              event.target.checked,
                          })
                        }
                      />
                      <span>
                        Require all care recipients to be verified before
                        checkout.
                      </span>
                    </label>

                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={policy.allowPendingAdultInvitations}
                        onChange={(event) =>
                          updateMultiCarePolicy(feeKind, {
                            allowPendingAdultInvitations:
                              event.target.checked,
                          })
                        }
                      />
                      <span>
                        Allow an invited adult care recipient to complete
                        identity verification after booking.
                      </span>
                    </label>

                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={
                          policy.allowProvisionalDependentProfiles
                        }
                        onChange={(event) =>
                          updateMultiCarePolicy(feeKind, {
                            allowProvisionalDependentProfiles:
                              event.target.checked,
                          })
                        }
                      />
                      <span>
                        Allow a verified parent or guardian to create a
                        provisional dependant profile.
                      </span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2 border-t pt-3">
          <button
            type="button"
            onClick={handleSaveMultiCare}
            disabled={
              multiCareSaving ||
              multiCareLoading ||
              !multiCareTouched ||
              multiCarePolicies.length === 0
            }
            className="px-4 py-2 border rounded bg-black text-white text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {multiCareSaving
              ? 'Saving multi-care policy…'
              : 'Save multi-care policy'}
          </button>

          {multiCareTouched && !multiCareSaving && (
            <span className="text-[11px] text-amber-600">
              You have unsaved multi-care policy changes.
            </span>
          )}
        </div>
      </section>

      {/* Clinician-owned services */}
      <section className="border rounded bg-white p-4 space-y-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Additional services (clinician)</h2>
            <p className="text-xs text-gray-600">
              Examples: remote monitoring, chronic check-ins or special procedures billed separately.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddService}
            className="px-3 py-1.5 rounded bg-black text-white text-xs"
          >
            Add Service
          </button>
        </div>

        {clinicianServices.length === 0 ? (
          <div className="text-gray-500">No additional clinician services configured yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-1 text-left border-b text-[11px] font-semibold text-gray-600">Code</th>
                  <th className="px-2 py-1 text-left border-b text-[11px] font-semibold text-gray-600">Label</th>
                  <th className="px-2 py-1 text-left border-b text-[11px] font-semibold text-gray-600">Unit</th>
                  <th className="px-2 py-1 text-left border-b text-[11px] font-semibold text-gray-600">
                    Amount ({currency})
                  </th>
                  <th className="px-2 py-1 text-left border-b text-[11px] font-semibold text-gray-600">Active</th>
                  <th className="px-2 py-1 text-left border-b text-[11px] font-semibold text-gray-600" />
                </tr>
              </thead>

              <tbody>
                {clinicianServices.map((s) => {
                  const cur = s.currency || currency;
                  const st = stepForCurrency(cur);
                  return (
                    <tr key={s.id} className="border-t">
                      <td className="px-2 py-1">
                        <input
                          className="border rounded px-1 py-0.5 w-24"
                          value={s.code || ''}
                          onChange={(e) => handleUpdateService(s.id, { code: e.target.value || undefined })}
                        />
                      </td>

                      <td className="px-2 py-1">
                        <input
                          className="border rounded px-1 py-0.5 w-full"
                          value={s.label}
                          onChange={(e) => handleUpdateService(s.id, { label: e.target.value })}
                        />
                      </td>

                      <td className="px-2 py-1">
                        <select
                          className="border rounded px-1 py-0.5"
                          value={s.billingUnit}
                          onChange={(e) => handleUpdateService(s.id, { billingUnit: e.target.value as BillingUnit })}
                        >
                          {(Object.keys(BILLING_UNIT_LABEL) as BillingUnit[]).map((u) => (
                            <option key={u} value={u}>
                              {BILLING_UNIT_LABEL[u]}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min={0}
                          step={st}
                          className="border rounded px-1 py-0.5 w-28"
                          value={minorToMajor(s.amountCents, cur)}
                          onChange={(e) =>
                            handleUpdateService(s.id, {
                              amountCents: majorToMinor(Number(e.target.value || '0'), cur),
                            })
                          }
                        />
                      </td>

                      <td className="px-2 py-1">
                        <input
                          type="checkbox"
                          checked={s.active !== false}
                          onChange={(e) => handleUpdateService(s.id, { active: e.target.checked })}
                        />
                      </td>

                      <td className="px-2 py-1 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveService(s.id)}
                          className="px-2 py-1 rounded border text-[11px] hover:bg-gray-50"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Admin staff comp + services */}
      <section className="border rounded bg-white p-4 space-y-3 text-xs">
        <h2 className="text-sm font-semibold text-gray-800">Admin staff compensation &amp; services</h2>
        <p className="text-xs text-gray-600 mb-2">
          Non-medical staff are usually flat or percent-of-revenue. Medical admin staff can also be attached to
          service-level fees (configured by you).
        </p>

        {/* Compensation editor */}
        <div className="overflow-x-auto mb-3">
          <table className="min-w-full border text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1 text-left border-b text-[11px] font-semibold text-gray-600">Staff</th>
                <th className="px-2 py-1 text-left border-b text-[11px] font-semibold text-gray-600">Type</th>
                <th className="px-2 py-1 text-left border-b text-[11px] font-semibold text-gray-600">Mode</th>
                <th className="px-2 py-1 text-left border-b text-[11px] font-semibold text-gray-600">Value</th>
              </tr>
            </thead>

            <tbody>
              {adminStaff.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-2 py-2 text-gray-500">
                    No admin staff linked yet. Add admin staff under{' '}
                    <span className="font-mono text-[11px]">Settings &gt; Admin Staff</span>.
                  </td>
                </tr>
              )}

              {adminStaff.map((s) => {
                const mode = s.compensation?.mode || 'none';
                const valueLabel =
                  mode === 'flat_monthly' ? `Monthly (${currency})` : mode === 'percent_revenue' ? 'Percent of revenue (%)' : '—';

                return (
                  <tr key={s.id} className="border-t">
                    <td className="px-2 py-1">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-[11px] text-gray-500">{s.email}</div>
                    </td>

                    <td className="px-2 py-1 capitalize">{s.type.replace('-', ' ')}</td>

                    <td className="px-2 py-1">
                      <select
                        className="border rounded px-1 py-0.5"
                        value={mode}
                        onChange={(e) => handleAdminCompChange(s.id, { mode: e.target.value as AdminStaffCompMode })}
                      >
                        <option value="none">None (no base)</option>
                        <option value="flat_monthly">Flat monthly</option>
                        <option value="percent_revenue">% of revenue</option>
                      </select>
                    </td>

                    <td className="px-2 py-1">
                      {mode === 'flat_monthly' && (
                        <label className="flex items-center gap-1">
                          <span className="text-[11px] text-gray-500">{valueLabel}</span>
                          <input
                            type="number"
                            min={0}
                            step={currencyStep}
                            className="border rounded px-1 py-0.5 w-28"
                            value={minorToMajor(s.compensation?.amountCents || 0, currency)}
                            onChange={(e) =>
                              handleAdminCompChange(s.id, {
                                amountCents: majorToMinor(Number(e.target.value || '0'), currency),
                              })
                            }
                          />
                        </label>
                      )}

                      {mode === 'percent_revenue' && (
                        <label className="flex items-center gap-1">
                          <span className="text-[11px] text-gray-500">{valueLabel}</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            className="border rounded px-1 py-0.5 w-20"
                            value={s.compensation?.percent ?? 0}
                            onChange={(e) =>
                              handleAdminCompChange(s.id, {
                                percent: Math.max(0, Math.min(100, Number(e.target.value || '0'))),
                              })
                            }
                          />
                        </label>
                      )}

                      {mode === 'none' && <span className="text-[11px] text-gray-400">(No base compensation)</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Admin services list (read-only) */}
        {adminServices.length > 0 && (
          <div className="mt-2 border-t pt-2">
            <div className="text-[11px] font-semibold text-gray-700 mb-1">Admin-owned services (read-only for now)</div>
            <div className="overflow-x-auto">
              <table className="min-w-full border text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-1 text-left border-b text-[11px] font-semibold text-gray-600">Staff</th>
                    <th className="px-2 py-1 text-left border-b text-[11px] font-semibold text-gray-600">Label</th>
                    <th className="px-2 py-1 text-left border-b text-[11px] font-semibold text-gray-600">Unit</th>
                    <th className="px-2 py-1 text-left border-b text-[11px] font-semibold text-gray-600">
                      Amount ({currency})
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {adminServices.map((s) => {
                    const staff = adminStaff.find((a) => a.id === s.ownerAdminStaffId) || null;
                    const cur = s.currency || currency;
                    return (
                      <tr key={s.id} className="border-t">
                        <td className="px-2 py-1">
                          {staff ? (
                            <>
                              <div className="font-medium">{staff.name}</div>
                              <div className="text-[11px] text-gray-500">{staff.email}</div>
                            </>
                          ) : (
                            <span className="text-gray-400">Unknown staff</span>
                          )}
                        </td>
                        <td className="px-2 py-1">{s.label}</td>
                        <td className="px-2 py-1">{BILLING_UNIT_LABEL[s.billingUnit]}</td>
                        <td className="px-2 py-1">{minorToMajor(s.amountCents, cur).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Save bar */}
      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading || !touched}
          className="px-4 py-2 border rounded bg-black text-white text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {touched && !saving && <span className="text-[11px] text-amber-600">You have unsaved changes.</span>}
      </div>
    </main>
  );
}
