// apps/admin-dashboard/app/settings/insurance/page.tsx
'use client';

import { useEffect, useState } from 'react';

const API = '/api/settings/insurance';

/* ---------- Types ---------- */

type CoverageScope = 'platform' | 'clinician_class' | 'premium' | 'clinician_ids';

type CoveragePolicy = {
  id: string;
  label: string;
  insurerName: string;
  policyNumber: string;
  productType?: 'malpractice' | 'professional_indemnity' | 'combined';
  country?: string;
  currency: 'ZAR';

  coversVirtual: boolean;
  coversInPerson: boolean;
  coversProcedures?: boolean;
  coversHomeVisits?: boolean;

  perIncidentLimitZar?: number | null;
  perAnnumLimitZar?: number | null;
  excessZar?: number | null;

  retroactiveDate?: string; // yyyy-mm-dd
  expiryDate?: string | null;

  notesInternal?: string;
  notesExternal?: string;

  scope: CoverageScope;
  targetClassIds?: string[];
  targetClinicianIds?: string[];

  isPrimary?: boolean;
  active: boolean;
};

type InsuranceSettings = {
  // Original fields (backwards compatible)
  platformCoverEnabled: boolean;
  platformInsurerName?: string;
  platformPolicyNumber?: string;
  platformCoversVirtual?: boolean;
  platformCoverNotes?: string;

  // New, richer schedule (optional until backend is wired)
  policies?: CoveragePolicy[];
};

type ClinicianClassRef = { id: string; name: string };

/* ---------- Helpers ---------- */

const FALLBACK_CLASSES: ClinicianClassRef[] = [
  { id: 'classA', name: 'Class A — Doctors' },
  { id: 'classB', name: 'Class B — Allied Health' },
  { id: 'classC', name: 'Class C — Wellness' },
];

function scopeLabel(scope: CoverageScope) {
  switch (scope) {
    case 'platform':
      return 'Platform default';
    case 'clinician_class':
      return 'Clinician class';
    case 'premium':
      return 'Premium clinicians';
    case 'clinician_ids':
      return 'Specific clinicians';
    default:
      return scope;
  }
}

function ensurePoliciesFromLegacy(json: any): InsuranceSettings {
  const base: InsuranceSettings = {
    platformCoverEnabled: !!json.platformCoverEnabled,
    platformInsurerName: json.platformInsurerName ?? '',
    platformPolicyNumber: json.platformPolicyNumber ?? '',
    platformCoversVirtual: json.platformCoversVirtual ?? false,
    platformCoverNotes: json.platformCoverNotes ?? '',
    policies: Array.isArray(json.policies) ? json.policies : undefined,
  };

  if (!base.policies || base.policies.length === 0) {
    const policy: CoveragePolicy = {
      id: 'platform-default',
      label: 'Platform malpractice cover',
      insurerName: base.platformInsurerName || '',
      policyNumber: base.platformPolicyNumber || '',
      productType: 'malpractice',
      country: 'ZA',
      currency: 'ZAR',
      coversVirtual: base.platformCoversVirtual ?? true,
      coversInPerson: true,
      coversProcedures: false,
      coversHomeVisits: true,
      perIncidentLimitZar: null,
      perAnnumLimitZar: null,
      excessZar: null,
      retroactiveDate: '',
      expiryDate: null,
      notesInternal: base.platformCoverNotes || '',
      notesExternal: '',
      scope: 'platform',
      targetClassIds: [],
      targetClinicianIds: [],
      isPrimary: true,
      active: base.platformCoverEnabled,
    };
    base.policies = [policy];
  }

  return base;
}

function formatCurrency(n?: number | null) {
  if (n == null || !Number.isFinite(n)) return '';
  return n.toLocaleString('en-ZA');
}

function parseCurrencyInput(v: string): number | null {
  const trimmed = v.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : null;
}

/* ---------- Page ---------- */

export default function AdminInsuranceSettingsPage() {
  const [cfg, setCfg] = useState<InsuranceSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [classes, setClasses] = useState<ClinicianClassRef[]>(FALLBACK_CLASSES);
  const [classesErr, setClassesErr] = useState<string | null>(null);

  /* Load base insurance config */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(API, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!mounted) return;
        setCfg(ensurePoliciesFromLegacy(json));
      } catch (e: any) {
        console.error('load insurance error', e);
        if (!mounted) return;
        // Fallback config
        setCfg(
          ensurePoliciesFromLegacy({
            platformCoverEnabled: false,
            platformInsurerName: '',
            platformPolicyNumber: '',
            platformCoversVirtual: true,
            platformCoverNotes: '',
          }),
        );
        setErr(
          e?.message ||
            'Unable to load current insurance settings — using a local snapshot.',
        );
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  /* Try to fetch clinician classes to make class targeting nicer.
     If this fails, we just keep FALLBACK_CLASSES. */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setClassesErr(null);
        // Using analytics endpoint as a convenient source of class labels.
        const res = await fetch('/api/analytics/clinician-payouts', {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!mounted) return;

        if (Array.isArray(json?.classes)) {
          const mapped: ClinicianClassRef[] = json.classes.map((c: any) => ({
            id: String(c.classId),
            name: String(c.name || c.classId),
          }));
          if (mapped.length) setClasses(mapped);
        }
      } catch (e: any) {
        if (!mounted) return;
        console.warn(
          'Unable to hydrate clinician classes for insurance view; using fallback.',
          e,
        );
        setClassesErr(
          'Unable to fetch clinician classes — showing default Class A/B/C labels.',
        );
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  function updateCfg(patch: Partial<InsuranceSettings>) {
    if (!cfg) return;
    setCfg({ ...cfg, ...patch });
    setSaved(false);
  }

  function updatePolicy(index: number, patch: Partial<CoveragePolicy>) {
    if (!cfg || !cfg.policies) return;
    const next: InsuranceSettings = {
      ...cfg,
      policies: cfg.policies.map((p, i) =>
        i === index ? { ...p, ...patch } : p,
      ),
    };
    setCfg(next);
    setSaved(false);
  }

  function toggleClassForPolicy(index: number, classId: string) {
    if (!cfg || !cfg.policies) return;
    const current = cfg.policies[index];
    const set = new Set(current.targetClassIds ?? []);
    if (set.has(classId)) set.delete(classId);
    else set.add(classId);
    updatePolicy(index, { targetClassIds: Array.from(set) });
  }

  function updateClinicianIds(index: number, raw: string) {
    const ids = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    updatePolicy(index, { targetClinicianIds: ids });
  }

  function addPolicy() {
    if (!cfg) return;
    const base = cfg.policies?.[cfg.policies.length - 1];
    const id = `policy-${(globalThis.crypto as any)?.randomUUID?.() ?? Date.now()}`;
    const newPolicy: CoveragePolicy = {
      id,
      label: 'New cover layer',
      insurerName: base?.insurerName ?? cfg.platformInsurerName ?? '',
      policyNumber: '',
      productType: base?.productType ?? 'malpractice',
      country: base?.country ?? 'ZA',
      currency: 'ZAR',
      coversVirtual: base?.coversVirtual ?? true,
      coversInPerson: base?.coversInPerson ?? true,
      coversProcedures: base?.coversProcedures ?? false,
      coversHomeVisits: base?.coversHomeVisits ?? true,
      perIncidentLimitZar: base?.perIncidentLimitZar ?? null,
      perAnnumLimitZar: base?.perAnnumLimitZar ?? null,
      excessZar: base?.excessZar ?? null,
      retroactiveDate: '',
      expiryDate: null,
      notesInternal: '',
      notesExternal: '',
      scope: 'clinician_class',
      targetClassIds: [],
      targetClinicianIds: [],
      isPrimary: false,
      active: true,
    };
    updateCfg({
      policies: [...(cfg.policies ?? []), newPolicy],
    });
  }

  function removePolicy(index: number) {
    if (!cfg || !cfg.policies) return;
    if (cfg.policies.length <= 1) return; // keep at least one
    const nextPolicies = cfg.policies.filter((_, i) => i !== index);
    updateCfg({ policies: nextPolicies });
  }

  async function save() {
    if (!cfg) return;
    setSaving(true);
    setSaved(false);
    setErr(null);
    try {
      const res = await fetch(API, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setErr(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (!cfg) {
    return (
      <main className="p-6 text-sm text-gray-600">
        Loading insurance settings…
      </main>
    );
  }

  const activePolicies = (cfg.policies ?? []).filter((p) => p.active).length;

  return (
    <main className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-lg md:text-xl font-semibold">
          Medical Malpractice &amp; Professional Indemnity
        </h1>
        <p className="text-sm text-gray-600">
          Configure how platform-wide and clinician-level cover behaves. These
          settings can be used to decide whether a clinician may practice on
          Ambulant+, what insurer they rely on, and how cover varies by class,
          premium tier or specific IDs.
        </p>
        <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5">
            {cfg.platformCoverEnabled ? 'Platform cover: enabled' : 'Platform cover: disabled'}
          </span>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5">
            {activePolicies} active policy layer
            {activePolicies === 1 ? '' : 's'}
          </span>
        </div>
      </header>

      {err && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
          {err}
        </div>
      )}
      {classesErr && (
        <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
          {classesErr}
        </div>
      )}

      {/* Legacy / platform-wide toggle (backwards compatible) */}
      <section className="bg-white border rounded-2xl p-4 shadow-sm space-y-3 text-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium">
              Platform-wide coverage toggle
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              When enabled, clinicians can rely on platform malpractice cover
              instead of providing their own policy details during onboarding.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={cfg.platformCoverEnabled}
              onChange={(e) =>
                updateCfg({ platformCoverEnabled: e.target.checked })
              }
              className="h-3.5 w-3.5"
            />
            <span className="text-gray-800">
              Platform-wide cover active
            </span>
          </label>
        </div>

        <div className="grid md:grid-cols-2 gap-3 text-xs">
          <label className="block">
            <div className="text-gray-600 mb-1">Insurer name</div>
            <input
              className="border rounded px-2 py-1 w-full"
              value={cfg.platformInsurerName ?? ''}
              onChange={(e) =>
                updateCfg({ platformInsurerName: e.target.value })
              }
            />
          </label>
          <label className="block">
            <div className="text-gray-600 mb-1">Policy number</div>
            <input
              className="border rounded px-2 py-1 w-full"
              value={cfg.platformPolicyNumber ?? ''}
              onChange={(e) =>
                updateCfg({ platformPolicyNumber: e.target.value })
              }
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={cfg.platformCoversVirtual ?? false}
            onChange={(e) =>
              updateCfg({ platformCoversVirtual: e.target.checked })
            }
            className="h-3.5 w-3.5"
          />
          <span>Cover explicitly includes virtual consultations</span>
        </label>

        <label className="text-xs block">
          <div className="text-gray-600 mb-1">Notes (internal)</div>
          <textarea
            className="border rounded px-2 py-1 w-full"
            rows={3}
            value={cfg.platformCoverNotes ?? ''}
            onChange={(e) =>
              updateCfg({ platformCoverNotes: e.target.value })
            }
          />
        </label>

        {!cfg.platformCoverEnabled && (
          <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            Platform cover is disabled. Ensure clinician onboarding validates
            individual malpractice policies.
          </div>
        )}
      </section>

      {/* Policy schedule / layers */}
      <section className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <div>
            <h2 className="font-medium">Policy schedule &amp; scope</h2>
            <p className="text-[11px] text-gray-500">
              Model multiple layers of cover — e.g. a base platform policy,
              then additional layers for premium clinicians or specific
              clinician classes.
            </p>
          </div>
          <button
            type="button"
            onClick={addPolicy}
            className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 bg-white hover:bg-gray-50 text-xs"
          >
            <span className="text-lg leading-none">＋</span>
            <span>New policy</span>
          </button>
        </div>

        {(cfg.policies ?? []).map((p, index) => {
          const clinicianIdText = (p.targetClinicianIds ?? []).join(', ');
          const scope = p.scope;
          const classNames =
            p.targetClassIds && p.targetClassIds.length
              ? p.targetClassIds
                  .map(
                    (id) => classes.find((c) => c.id === id)?.name || id,
                  )
                  .join(', ')
              : null;

          return (
            <div
              key={p.id}
              className={`rounded-2xl border p-4 bg-white shadow-sm space-y-3 ${
                p.isPrimary ? 'border-gray-900' : 'border-gray-200'
              }`}
            >
              {/* Top row: label, active, primary, remove */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      className="border rounded px-2 py-1 text-sm w-60"
                      value={p.label}
                      onChange={(e) =>
                        updatePolicy(index, { label: e.target.value })
                      }
                    />
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-mono text-gray-700">
                      {p.id}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 text-[11px] text-gray-500">
                    <span>Scope: {scopeLabel(scope)}</span>
                    {classNames && scope === 'clinician_class' && (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5">
                        {classNames}
                      </span>
                    )}
                    {scope === 'clinician_ids' &&
                      p.targetClinicianIds &&
                      p.targetClinicianIds.length > 0 && (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5">
                          {p.targetClinicianIds.length} clinicians
                        </span>
                      )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={!!p.isPrimary}
                      onChange={(e) =>
                        updatePolicy(index, { isPrimary: e.target.checked })
                      }
                      className="h-3.5 w-3.5"
                    />
                    <span className="text-gray-700">
                      Primary for this scope
                    </span>
                  </label>
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={!!p.active}
                      onChange={(e) =>
                        updatePolicy(index, { active: e.target.checked })
                      }
                      className="h-3.5 w-3.5"
                    />
                    <span className="text-gray-700">Active</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => removePolicy(index)}
                    disabled={(cfg.policies ?? []).length <= 1}
                    className="rounded-full border px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {/* Basic policy details */}
              <div className="grid md:grid-cols-3 gap-3 text-xs">
                <div className="space-y-2 rounded-xl border bg-gray-50 p-3">
                  <div className="text-[11px] text-gray-500">
                    Policy details
                  </div>
                  <label className="block">
                    <div className="text-gray-600 mb-1">Insurer name</div>
                    <input
                      className="border rounded px-2 py-1 w-full"
                      value={p.insurerName}
                      onChange={(e) =>
                        updatePolicy(index, {
                          insurerName: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="block">
                    <div className="text-gray-600 mb-1">
                      Policy number / reference
                    </div>
                    <input
                      className="border rounded px-2 py-1 w-full"
                      value={p.policyNumber}
                      onChange={(e) =>
                        updatePolicy(index, {
                          policyNumber: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="block">
                    <div className="text-gray-600 mb-1">Product type</div>
                    <select
                      className="border rounded px-2 py-1 w-full"
                      value={p.productType ?? 'malpractice'}
                      onChange={(e) =>
                        updatePolicy(index, {
                          productType: e.target
                            .value as CoveragePolicy['productType'],
                        })
                      }
                    >
                      <option value="malpractice">Medical malpractice</option>
                      <option value="professional_indemnity">
                        Professional indemnity
                      </option>
                      <option value="combined">
                        Combined malpractice &amp; PI
                      </option>
                    </select>
                  </label>
                  <label className="block">
                    <div className="text-gray-600 mb-1">Country</div>
                    <input
                      className="border rounded px-2 py-1 w-full"
                      value={p.country ?? 'ZA'}
                      onChange={(e) =>
                        updatePolicy(index, { country: e.target.value })
                      }
                    />
                  </label>
                </div>

                {/* Coverage types */}
                <div className="space-y-2 rounded-xl border bg-gray-50 p-3">
                  <div className="text-[11px] text-gray-500">
                    Coverage types
                  </div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5"
                      checked={p.coversVirtual}
                      onChange={(e) =>
                        updatePolicy(index, {
                          coversVirtual: e.target.checked,
                        })
                      }
                    />
                    <span>Virtual consultations</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5"
                      checked={p.coversInPerson}
                      onChange={(e) =>
                        updatePolicy(index, {
                          coversInPerson: e.target.checked,
                        })
                      }
                    />
                    <span>In-person consultations</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5"
                      checked={p.coversProcedures ?? false}
                      onChange={(e) =>
                        updatePolicy(index, {
                          coversProcedures: e.target.checked,
                        })
                      }
                    />
                    <span>Procedures / interventions</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5"
                      checked={p.coversHomeVisits ?? false}
                      onChange={(e) =>
                        updatePolicy(index, {
                          coversHomeVisits: e.target.checked,
                        })
                      }
                    />
                    <span>Home visits</span>
                  </label>

                  <div className="mt-2 space-y-1">
                    <div className="text-[11px] text-gray-500">
                      Limits &amp; excess (ZAR)
                    </div>
                    <label className="flex items-center justify-between gap-2">
                      <span>Per incident</span>
                      <input
                        className="border rounded px-2 py-1 w-24 text-right"
                        value={formatCurrency(p.perIncidentLimitZar ?? null)}
                        onChange={(e) =>
                          updatePolicy(index, {
                            perIncidentLimitZar: parseCurrencyInput(
                              e.target.value,
                            ),
                          })
                        }
                        placeholder="e.g. 2 000 000"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span>Per annum</span>
                      <input
                        className="border rounded px-2 py-1 w-24 text-right"
                        value={formatCurrency(p.perAnnumLimitZar ?? null)}
                        onChange={(e) =>
                          updatePolicy(index, {
                            perAnnumLimitZar: parseCurrencyInput(
                              e.target.value,
                            ),
                          })
                        }
                        placeholder="e.g. 10 000 000"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span>Excess</span>
                      <input
                        className="border rounded px-2 py-1 w-24 text-right"
                        value={formatCurrency(p.excessZar ?? null)}
                        onChange={(e) =>
                          updatePolicy(index, {
                            excessZar: parseCurrencyInput(e.target.value),
                          })
                        }
                        placeholder="Optional"
                      />
                    </label>
                  </div>
                </div>

                {/* Scope & timeline */}
                <div className="space-y-2 rounded-xl border bg-gray-50 p-3">
                  <div className="text-[11px] text-gray-500">
                    Scope, timeline &amp; notes
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] text-gray-500 mb-1">
                      Scope
                    </div>
                    <select
                      className="border rounded px-2 py-1 w-full"
                      value={scope}
                      onChange={(e) =>
                        updatePolicy(index, {
                          scope: e.target.value as CoverageScope,
                        })
                      }
                    >
                      <option value="platform">Platform default</option>
                      <option value="clinician_class">
                        Clinician class (Class A/B/C)
                      </option>
                      <option value="premium">Premium clinicians</option>
                      <option value="clinician_ids">
                        Specific clinician IDs
                      </option>
                    </select>
                  </div>

                  {/* Class targeting */}
                  {scope === 'clinician_class' && (
                    <div className="space-y-1 text-[11px] mt-1">
                      <div className="text-gray-500">
                        Targeted classes (toggle as needed):
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {classes.map((c) => {
                          const checked =
                            (p.targetClassIds ?? []).includes(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() =>
                                toggleClassForPolicy(index, c.id)
                              }
                              className={`rounded-full border px-2 py-0.5 ${
                                checked
                                  ? 'bg-gray-900 text-white border-gray-900'
                                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              {c.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Specific clinicians */}
                  {scope === 'clinician_ids' && (
                    <div className="space-y-1 text-[11px] mt-1">
                      <div className="text-gray-500">
                        Comma-separated clinician IDs:
                      </div>
                      <textarea
                        className="border rounded px-2 py-1 w-full text-[11px] text-gray-700"
                        rows={2}
                        placeholder="e.g. clin-123, dr-naidoo-01, gp-mbele-02"
                        value={clinicianIdText}
                        onChange={(e) =>
                          updateClinicianIds(index, e.target.value)
                        }
                      />
                    </div>
                  )}

                  {/* Timeline */}
                  <div className="grid grid-cols-2 gap-2 mt-2 text-[11px]">
                    <label>
                      <div className="text-gray-500 mb-1">
                        Retroactive date
                      </div>
                      <input
                        type="date"
                        className="border rounded px-2 py-1 w-full"
                        value={p.retroactiveDate ?? ''}
                        onChange={(e) =>
                          updatePolicy(index, {
                            retroactiveDate: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      <div className="text-gray-500 mb-1">Expiry date</div>
                      <input
                        type="date"
                        className="border rounded px-2 py-1 w-full"
                        value={p.expiryDate ?? ''}
                        onChange={(e) =>
                          updatePolicy(index, {
                            expiryDate: e.target.value || null,
                          })
                        }
                      />
                    </label>
                  </div>

                  {/* Notes */}
                  <div className="mt-2 space-y-1 text-[11px]">
                    <label className="block">
                      <div className="text-gray-500 mb-1">
                        Notes (internal, ops-facing)
                      </div>
                      <textarea
                        className="border rounded px-2 py-1 w-full"
                        rows={2}
                        value={p.notesInternal ?? ''}
                        onChange={(e) =>
                          updatePolicy(index, {
                            notesInternal: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="block">
                      <div className="text-gray-500 mb-1">
                        Notes (public, for clinicians)
                      </div>
                      <textarea
                        className="border rounded px-2 py-1 w-full"
                        rows={2}
                        value={p.notesExternal ?? ''}
                        onChange={(e) =>
                          updatePolicy(index, {
                            notesExternal: e.target.value,
                          })
                        }
                        placeholder="Optional copy explaining cover in clinician portal."
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Save bar */}
      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="px-3 py-2 rounded border bg-black text-white text-sm disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save insurance settings'}
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
    </main>
  );
}
