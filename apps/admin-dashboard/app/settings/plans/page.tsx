// apps/admin-dashboard/app/settings/plans/page.tsx
'use client';

import { useEffect, useState } from 'react';

type ClinicianPlan = {
  id: 'solo' | 'starter' | 'team' | 'group' | 'clinic_enterprise';
  actor: 'clinician';
  label: string;
  description: string;
  currency: 'ZAR';
  monthlySubscriptionZar: number;
  payoutSharePct: number;
  includedAdminSlots: number;
  maxAdminSlots: number;
  extraAdminSlotZar?: number | null;
  recommendedFor: string;
  highlight?: boolean;
  enabled: boolean;
};

type PlansConfig = {
  clinicianPlans: ClinicianPlan[];
};

export default function PlanSettingsPage() {
  const [cfg, setCfg] = useState<PlansConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/settings/plans', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setCfg)
      .catch((e) => {
        console.error('load plans error', e);
      });
  }, []);

  function updatePlan(
    idx: number,
    patch: Partial<ClinicianPlan>,
  ) {
    if (!cfg) return;
    const next: PlansConfig = structuredClone(cfg);
    next.clinicianPlans[idx] = {
      ...next.clinicianPlans[idx],
      ...patch,
    };
    setCfg(next);
    setSaved(false);
  }

  async function save() {
    if (!cfg) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/settings/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      setSaved(res.ok);
    } catch (e) {
      console.error('save plans error', e);
      setSaved(false);
    } finally {
      setSaving(false);
    }
  }

  if (!cfg) {
    return (
      <main className="p-6">
        <h1 className="text-lg font-semibold">
          Subscription Plans &amp; Admin Slots
        </h1>
        <div className="mt-4 text-sm text-gray-600">Loading…</div>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-6 max-w-5xl mx-auto">
      <h1 className="text-lg font-semibold">
        Clinician Plans &amp; Admin Slots
      </h1>
      <p className="text-sm text-gray-600">
        Define global subscription plans for clinicians. These control
        subscription pricing, default payout share and the default bounds
        for admin staff slots per clinician.
      </p>

      <section className="border rounded bg-white p-4">
        <table className="w-full text-sm border">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="p-2">ID</th>
              <th className="p-2">Label</th>
              <th className="p-2">Monthly (ZAR)</th>
              <th className="p-2">Payout share to clinician</th>
              <th className="p-2">Admin slots (incl / max)</th>
              <th className="p-2">Extra slot (ZAR)</th>
              <th className="p-2">Highlight</th>
              <th className="p-2">Enabled</th>
            </tr>
          </thead>
          <tbody>
            {cfg.clinicianPlans.map((p, idx) => (
              <tr key={p.id} className="border-t align-top">
                <td className="p-2 text-xs">
                  <div className="font-mono text-[11px]">{p.id}</div>
                </td>
                <td className="p-2">
                  <input
                    className="border rounded px-2 py-1 w-full text-xs"
                    value={p.label}
                    onChange={(e) =>
                      updatePlan(idx, { label: e.target.value })
                    }
                  />
                  <textarea
                    className="mt-1 border rounded px-2 py-1 w-full text-[11px] text-gray-700"
                    rows={2}
                    value={p.description}
                    onChange={(e) =>
                      updatePlan(idx, { description: e.target.value })
                    }
                  />
                  <textarea
                    className="mt-1 border rounded px-2 py-1 w-full text-[11px] text-gray-500"
                    rows={2}
                    value={p.recommendedFor}
                    onChange={(e) =>
                      updatePlan(idx, {
                        recommendedFor: e.target.value,
                      })
                    }
                    placeholder="Recommended for..."
                  />
                </td>
                <td className="p-2 w-32">
                  <input
                    type="number"
                    className="border rounded px-2 py-1 w-24 text-xs"
                    value={p.monthlySubscriptionZar}
                    onChange={(e) =>
                      updatePlan(idx, {
                        monthlySubscriptionZar: Math.max(
                          0,
                          Math.round(
                            Number(e.target.value || 0),
                          ),
                        ),
                      })
                    }
                  />
                </td>
                <td className="p-2 w-40">
                  <div className="flex items-center gap-1 text-xs">
                    <input
                      type="number"
                      className="border rounded px-2 py-1 w-20 text-xs"
                      value={Math.round(p.payoutSharePct * 100)}
                      onChange={(e) => {
                        const pct = Math.max(
                          0,
                          Math.min(
                            100,
                            Number(e.target.value || 0),
                          ),
                        );
                        updatePlan(idx, {
                          payoutSharePct: pct / 100,
                        });
                      }}
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                </td>
                <td className="p-2 w-40">
                  <div className="flex flex-col gap-1 text-xs">
                    <label className="flex items-center gap-1">
                      <span className="text-gray-500">Included</span>
                      <input
                        type="number"
                        className="border rounded px-2 py-1 w-16"
                        value={p.includedAdminSlots}
                        onChange={(e) =>
                          updatePlan(idx, {
                            includedAdminSlots: Math.max(
                              0,
                              Math.round(
                                Number(e.target.value || 0),
                              ),
                            ),
                          })
                        }
                      />
                    </label>
                    <label className="flex items-center gap-1">
                      <span className="text-gray-500">Max</span>
                      <input
                        type="number"
                        className="border rounded px-2 py-1 w-16"
                        value={p.maxAdminSlots}
                        onChange={(e) =>
                          updatePlan(idx, {
                            maxAdminSlots: Math.max(
                              0,
                              Math.round(
                                Number(e.target.value || 0),
                              ),
                            ),
                          })
                        }
                      />
                    </label>
                  </div>
                </td>
                <td className="p-2 w-32">
                  <input
                    type="number"
                    className="border rounded px-2 py-1 w-24 text-xs"
                    value={p.extraAdminSlotZar ?? ''}
                    onChange={(e) =>
                      updatePlan(idx, {
                        extraAdminSlotZar:
                          e.target.value === ''
                            ? null
                            : Math.max(
                                0,
                                Math.round(
                                  Number(e.target.value || 0),
                                ),
                              ),
                      })
                    }
                    placeholder="Optional"
                  />
                </td>
                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    checked={!!p.highlight}
                    onChange={(e) =>
                      updatePlan(idx, { highlight: e.target.checked })
                    }
                  />
                </td>
                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    checked={!!p.enabled}
                    onChange={(e) =>
                      updatePlan(idx, { enabled: e.target.checked })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 text-xs text-gray-500">
          Plan IDs are currently fixed to{' '}
          <code className="bg-gray-100 px-1 rounded text-[10px]">
            solo | starter | team | group | clinic_enterprise
          </code>
          . Later we can relax this to add custom plans or actor-specific
          plans for pharmacies and labs.
        </div>
      </section>

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 border rounded bg-black text-white text-sm"
        >
          {saving ? 'Saving…' : 'Save Plans'}
        </button>
        {saved && (
          <span className="text-green-700 text-sm mt-2">Saved ✓</span>
        )}
      </div>
    </main>
  );
}
