// apps/clinician-app/app/payout/page.tsx
'use client';

import { ClinicianShell } from '@/components/ClinicianShell';
import { SettingsTabs } from '@/components/SettingsTabs';
import { toast } from '@/components/ToastMount';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ?? '';

type DemGender = { [k: string]: { count: number; netCents: number } };
type DemCity = { city: string; count: number; netCents: number }[];
type DemProvince = { province: string; count: number; netCents: number }[];

type PayoutSummary = {
  ok: boolean;
  currency: string;
  splitPercent: { clinician: number; platform: number };
  range: { from: string; to: string };
  earnings: {
    grossCents: number;
    netToClinicianCents: number;
    platformShareCents: number;
    thisWeekNetCents: number;
    avgMonthlyNetCents: number;
  };
  lastPayout: { amountCents: number; at: string | null };
  nextPayout: { amountCents: number; at: string | null };
  payoutSettings: { schedule: 'fortnightly' | 'monthly' };
  demographics: {
    byGender: DemGender;
    byCity: DemCity;
    byProvince: DemProvince;
  };
  rows: {
    id: string;
    startedAt: string;
    feeCents: number;
    netToClinicianCents: number;
    patientGender?: string | null;
    patientCity?: string | null;
    patientProvince?: string | null;
    status: string;
  }[];
};

// ---------- Plan tiers & admin slots ----------

export type PlanTierId = 'solo' | 'starter' | 'team' | 'group';

export type SmartIdDispatchOption = 'collect' | 'courier';

export type PlanTier = {
  id: PlanTierId;
  label: string;
  description: string;
  currency: 'ZAR';
  monthlySubscriptionZar: number;
  payoutSharePct: number; // clinician share of consultation revenue
  includedAdminSlots: number;
  maxAdminSlots: number;
  extraAdminSlotZar?: number | null; // optional per extra slot pricing
  recommendedFor: string;
  highlight?: boolean;
};

export const PLAN_TIERS: PlanTier[] = [
  {
    id: 'solo',
    label: 'Solo (Free)',
    description:
      'Single clinician, no additional admin staff. Ideal for early adopters testing Ambulant+.',
    currency: 'ZAR',
    monthlySubscriptionZar: 0,
    payoutSharePct: 0.8,
    includedAdminSlots: 0,
    maxAdminSlots: 1,
    extraAdminSlotZar: null,
    recommendedFor: 'Part-time virtual clinics and side practices.',
  },
  {
    id: 'starter',
    label: 'Starter (Premium)',
    description: 'Clinician + 1 admin assistant for booking, follow-ups and Smart ID dispatch.',
    currency: 'ZAR',
    monthlySubscriptionZar: 399,
    payoutSharePct: 0.82,
    includedAdminSlots: 1,
    maxAdminSlots: 2,
    extraAdminSlotZar: 149,
    recommendedFor: 'Solo practices with one receptionist or practice manager.',
    highlight: true,
  },
  {
    id: 'team',
    label: 'Team',
    description: 'Designed for small group practices with shared admin pool.',
    currency: 'ZAR',
    monthlySubscriptionZar: 799,
    payoutSharePct: 0.84,
    includedAdminSlots: 3,
    maxAdminSlots: 5,
    extraAdminSlotZar: 129,
    recommendedFor: '2–4 clinicians sharing 2–3 admin assistants.',
  },
  {
    id: 'group',
    label: 'Group',
    description: 'High-volume multi-disciplinary practices with more complex admin workflows.',
    currency: 'ZAR',
    monthlySubscriptionZar: 1499,
    payoutSharePct: 0.86,
    includedAdminSlots: 5,
    maxAdminSlots: 10,
    extraAdminSlotZar: 99,
    recommendedFor: 'Clinics with centralised admin/call-centre staff.',
  },
];

type BillingCycle = 'monthly' | 'annual';

type PlanSettingsResponse = {
  ok: boolean;
  clinicianId: string;
  currentPlanId: PlanTierId;
  smartIdDispatch: SmartIdDispatchOption;
  billingCycle: BillingCycle;
  maxAdminStaffSlots: number | null;
  activeAdminStaffSlots: number;
};

// --- tiny type for fees summary (from /api/clinicians/me/fees/extended proxy) ---
type FeesExtendedSummary = {
  ok?: boolean;
  currency?: string;
  baseConsultation?: {
    amountCents?: number | null;
    followupAmountCents?: number | null;
  };
};

function centsToMoney(cents: number, currency: string) {
  const num = (cents || 0) / 100;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(num);
}

export default function ClinicianPayoutPage() {
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [feesSummary, setFeesSummary] = useState<FeesExtendedSummary | null>(null);

  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);

  const [from, setFrom] = useState(thirtyDaysAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [gender, setGender] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');

  async function load() {
    if (!GATEWAY) {
      setError('Missing NEXT_PUBLIC_GATEWAY_ORIGIN');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (gender) params.set('gender', gender);
      if (city) params.set('city', city);
      if (province) params.set('province', province);

      const res = await fetch(`${GATEWAY}/api/clinicians/me/payouts?${params.toString()}`, {
        cache: 'no-store',
        headers: {
          // stub identity (replace with real auth later)
          'x-uid': 'clinician-local-001',
          'x-role': 'clinician',
        },
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setSummary(json);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to load payouts');
    } finally {
      setLoading(false);
    }
  }

  async function loadFeesSummary() {
    try {
      const res = await fetch('/api/clinicians/me/fees/extended', { cache: 'no-store' });
      const js: any = await res.json().catch(() => null);
      if (!res.ok || !js) return;

      // Very tolerant mapping so it survives future tweaks
      const currency = js.currency || js.baseConsultation?.currency || js.defaultCurrency || 'ZAR';

      const baseConsultation = {
        amountCents: js.baseConsultation?.amountCents ?? js.baseConsultation?.feeCents ?? js.feeCents ?? null,
        followupAmountCents:
          js.baseConsultation?.followupAmountCents ??
          js.followupConsultation?.amountCents ??
          js.followupConsultation?.feeCents ??
          null,
      };

      setFeesSummary({ ok: true, currency, baseConsultation });
    } catch (err) {
      console.warn('fees summary load failed (non-fatal)', err);
    }
  }

  useEffect(() => {
    load();
    loadFeesSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateSchedule(next: 'fortnightly' | 'monthly') {
    if (!summary) return;
    setSavingSchedule(true);
    try {
      const res = await fetch(`${GATEWAY}/api/clinicians/me/payouts`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'x-uid': 'clinician-local-001',
          'x-role': 'clinician',
        },
        body: JSON.stringify({ schedule: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) throw new Error(json?.error || 'Save failed');
      setSummary({ ...summary, payoutSettings: { schedule: next } });
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to update payout schedule');
    } finally {
      setSavingSchedule(false);
    }
  }

  const cur = summary?.currency || feesSummary?.currency || 'ZAR';

  const showBaseFee =
    feesSummary &&
    (feesSummary.baseConsultation?.amountCents != null ||
      feesSummary.baseConsultation?.followupAmountCents != null);

  return (
    <ClinicianShell>
      <main className="p-6 space-y-6">
        <SettingsTabs />

        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Payouts & Earnings</h1>
            <p className="text-sm text-gray-600">
              Track your consultation earnings, payout schedule and demographic breakdowns.
            </p>
          </div>

          {summary && (
            <div className="flex flex-col items-end text-xs text-gray-600">
              <div>
                Split:&nbsp;<strong>{summary.splitPercent.clinician}%</strong> to you ·{' '}
                <strong>{summary.splitPercent.platform}%</strong> platform
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span>Payout schedule:</span>
                <button
                  type="button"
                  disabled={savingSchedule}
                  onClick={() => updateSchedule('fortnightly')}
                  className={`px-2 py-1 rounded border text-xs ${
                    summary.payoutSettings.schedule === 'fortnightly'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  Fortnightly
                </button>
                <button
                  type="button"
                  disabled={savingSchedule}
                  onClick={() => updateSchedule('monthly')}
                  className={`px-2 py-1 rounded border text-xs ${
                    summary.payoutSettings.schedule === 'monthly'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Tiny read-only fees summary */}
        {showBaseFee && (
          <section className="border rounded bg-white p-3 text-xs flex flex-wrap items-center gap-3">
            <div className="font-semibold text-gray-800">Consultation fees (read-only)</div>
            <div className="flex flex-wrap items-center gap-3 text-gray-700">
              {feesSummary?.baseConsultation?.amountCents != null && (
                <span>
                  Base:{' '}
                  <span className="font-mono">
                    {centsToMoney(feesSummary.baseConsultation.amountCents!, cur)}
                  </span>
                </span>
              )}
              {feesSummary?.baseConsultation?.followupAmountCents != null && (
                <span>
                  Follow-up:{' '}
                  <span className="font-mono">
                    {centsToMoney(feesSummary.baseConsultation.followupAmountCents!, cur)}
                  </span>
                </span>
              )}
            </div>
            <div className="ml-auto text-[11px] text-gray-500">
              Update in <span className="font-medium">Settings → Fees</span>.
            </div>
          </section>
        )}

        {/* Plan tiers & admin staff slots (pulls from backend) */}
        <ClinicianPlanSection />

        {/* Filters */}
        <section className="border rounded bg-white p-4 space-y-3 text-sm">
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col text-xs">
              <span className="mb-1 text-gray-600">From</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="border rounded px-2 py-1"
              />
            </label>
            <label className="flex flex-col text-xs">
              <span className="mb-1 text-gray-600">To</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="border rounded px-2 py-1"
              />
            </label>
            <label className="flex flex-col text-xs">
              <span className="mb-1 text-gray-600">Patient gender</span>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="border rounded px-2 py-1"
              >
                <option value="">All</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other / Unknown</option>
              </select>
            </label>
            <label className="flex flex-col text-xs">
              <span className="mb-1 text-gray-600">City</span>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Johannesburg"
                className="border rounded px-2 py-1"
              />
            </label>
            <label className="flex flex-col text-xs">
              <span className="mb-1 text-gray-600">Province</span>
              <input
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                placeholder="e.g. Gauteng"
                className="border rounded px-2 py-1"
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              className="px-3 py-1.5 rounded bg-black text-white text-xs"
            >
              Apply filters
            </button>
            {loading && <span className="text-xs text-gray-500">Loading…</span>}
          </div>
        </section>

        {error && (
          <div className="text-sm text-rose-600 border border-rose-200 bg-rose-50 px-3 py-2 rounded">
            {error}
          </div>
        )}

        {/* Summary cards */}
        {summary && (
          <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card
              label="This Week's Earnings"
              value={centsToMoney(summary.earnings.thisWeekNetCents, cur)}
            />
            <Card
              label="Average Monthly Earnings"
              value={centsToMoney(summary.earnings.avgMonthlyNetCents, cur)}
            />
            <Card
              label="Last Payout"
              value={centsToMoney(summary.lastPayout.amountCents, cur)}
              sub={summary.lastPayout.at ? new Date(summary.lastPayout.at).toLocaleDateString() : '—'}
            />
            <Card
              label="Next Payout (est.)"
              value={centsToMoney(summary.nextPayout.amountCents, cur)}
              sub={summary.nextPayout.at ? new Date(summary.nextPayout.at).toLocaleDateString() : '—'}
            />
          </section>
        )}

        {/* Demographics */}
        {summary && (
          <section className="grid md:grid-cols-3 gap-4 text-xs">
            <Panel title="By Gender">
              {Object.keys(summary.demographics.byGender).length === 0 && (
                <div className="text-gray-500">No data</div>
              )}
              {Object.entries(summary.demographics.byGender).map(([k, v]) => (
                <div key={k} className="flex justify-between py-0.5">
                  <span className="text-gray-700 capitalize">{k}</span>
                  <span className="text-gray-800">
                    {v.count} • {centsToMoney(v.netCents, cur)}
                  </span>
                </div>
              ))}
            </Panel>

            <Panel title="Top Cities">
              {summary.demographics.byCity.length === 0 && <div className="text-gray-500">No data</div>}
              {summary.demographics.byCity.slice(0, 6).map((row) => (
                <div key={row.city} className="flex justify-between py-0.5">
                  <span className="text-gray-700">{row.city}</span>
                  <span className="text-gray-800">
                    {row.count} • {centsToMoney(row.netCents, cur)}
                  </span>
                </div>
              ))}
            </Panel>

            <Panel title="Top Provinces">
              {summary.demographics.byProvince.length === 0 && (
                <div className="text-gray-500">No data</div>
              )}
              {summary.demographics.byProvince.slice(0, 6).map((row) => (
                <div key={row.province} className="flex justify-between py-0.5">
                  <span className="text-gray-700">{row.province}</span>
                  <span className="text-gray-800">
                    {row.count} • {centsToMoney(row.netCents, cur)}
                  </span>
                </div>
              ))}
            </Panel>
          </section>
        )}

        {/* Detailed list */}
        {summary && (
          <section className="border rounded bg-white p-4 text-xs">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-medium text-gray-800 text-sm">Consultation earnings</h2>
              <div className="text-gray-500">
                Showing {summary.rows.length} consults between{' '}
                {new Date(summary.range.from).toLocaleDateString()} and{' '}
                {new Date(summary.range.to).toLocaleDateString()}
              </div>
            </div>
            {summary.rows.length === 0 ? (
              <div className="text-gray-500">No consultations in this range.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <Th>Date</Th>
                      <Th>Status</Th>
                      <Th>Gross</Th>
                      <Th>Net to you</Th>
                      <Th>Gender</Th>
                      <Th>City</Th>
                      <Th>Province</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.rows.map((r) => (
                      <tr key={r.id} className="border-t">
                        <Td>
                          {new Date(r.startedAt).toLocaleString(undefined, {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Td>
                        <Td className="capitalize">{r.status}</Td>
                        <Td>{centsToMoney(r.feeCents, cur)}</Td>
                        <Td>{centsToMoney(r.netToClinicianCents, cur)}</Td>
                        <Td className="capitalize">{r.patientGender || '—'}</Td>
                        <Td>{r.patientCity || '—'}</Td>
                        <Td>{r.patientProvince || '—'}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {loading && !summary && <div className="text-sm text-gray-600">Loading payouts…</div>}
      </main>
    </ClinicianShell>
  );
}

// ---------- Plan section component wired to backend ----------

// optional narrow type for the API payload
type PlanTiersApiResponse = {
  ok?: boolean;
  clinicianPlans?: any[];
  error?: string;
};

function ClinicianPlanSection() {
  const router = useRouter();

  // Dynamic plans from backend; seeded with local defaults
  const [planTiers, setPlanTiers] = useState<PlanTier[]>(PLAN_TIERS);

  const [selectedTierId, setSelectedTierId] = useState<PlanTierId>('starter');
  const [dispatchOption, setDispatchOption] = useState<SmartIdDispatchOption>('collect');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [initial, setInitial] = useState<{
    planTierId: PlanTierId;
    smartIdDispatch: SmartIdDispatchOption;
    billingCycle: BillingCycle;
  } | null>(null);

  // Selected tier from dynamic list (fallback to first entry)
  const selectedTier: PlanTier = (planTiers.find((t) => t.id === selectedTierId) ?? planTiers[0])!;

  const isFreePlan = selectedTier.monthlySubscriptionZar === 0;

  const dirty =
    !!initial &&
    (initial.planTierId !== selectedTierId ||
      initial.smartIdDispatch !== dispatchOption ||
      initial.billingCycle !== billingCycle);

  // 1) Load available plan tiers from backend (proxy → gateway settings/plans)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/settings/plan-tiers', { cache: 'no-store' });
        const js: PlanTiersApiResponse = await res.json().catch(() => ({} as any));

        if (!res.ok || js.ok === false) {
          throw new Error((js as any)?.error || `HTTP ${res.status}`);
        }

        const raw = Array.isArray(js.clinicianPlans) ? js.clinicianPlans : [];
        if (!raw.length || cancelled) return;

        const mapped: PlanTier[] = raw
          .map((p: any): PlanTier | null => {
            const idStr = String(p.id || '').trim();
            if (!['solo', 'starter', 'team', 'group'].includes(idStr)) return null;
            const id = idStr as PlanTierId;

            const monthly =
              Number.isFinite(Number(p.monthlySubscriptionZar)) && Number(p.monthlySubscriptionZar) >= 0
                ? Math.round(Number(p.monthlySubscriptionZar))
                : 0;

            const payoutShareRaw = Number(p.payoutSharePct);
            const payoutSharePct =
              Number.isFinite(payoutShareRaw) && payoutShareRaw >= 0 && payoutShareRaw <= 1
                ? payoutShareRaw
                : 0.8;

            const included =
              Number.isFinite(Number(p.includedAdminSlots)) && Number(p.includedAdminSlots) >= 0
                ? Math.round(Number(p.includedAdminSlots))
                : 0;

            const maxSlots =
              Number.isFinite(Number(p.maxAdminSlots)) && Number(p.maxAdminSlots) >= 0
                ? Math.round(Number(p.maxAdminSlots))
                : included;

            const extra =
              p.extraAdminSlotZar == null ? null : Math.max(0, Math.round(Number(p.extraAdminSlotZar || 0)));

            return {
              id,
              label: String(p.label || '').trim() || id,
              description: String(p.description || '').trim(),
              currency: 'ZAR',
              monthlySubscriptionZar: monthly,
              payoutSharePct,
              includedAdminSlots: included,
              maxAdminSlots: maxSlots,
              extraAdminSlotZar: extra,
              recommendedFor: String(p.recommendedFor || '').trim(),
              highlight: !!p.highlight,
            };
          })
          .filter(Boolean) as PlanTier[];

        if (!mapped.length || cancelled) return;
        setPlanTiers(mapped);
      } catch (err) {
        console.warn('Failed to load dynamic plan tiers, using static defaults', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // 2) Load clinician's current plan selection
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/clinicians/me/payout-settings', { cache: 'no-store' });
        const js: PlanSettingsResponse = await res.json();
        if (!res.ok || !js.ok) throw new Error((js as any)?.error || `HTTP ${res.status}`);

        // decouple from plan list – just ensure it's a valid PlanTierId
        const rawPlan = js.currentPlanId as string;
        const allowedIds: PlanTierId[] = ['solo', 'starter', 'team', 'group'];
        const safePlan: PlanTierId = allowedIds.includes(rawPlan as PlanTierId)
          ? (rawPlan as PlanTierId)
          : 'solo';

        if (!cancelled) {
          setSelectedTierId(safePlan);
          setDispatchOption(js.smartIdDispatch || 'collect');
          setBillingCycle(js.billingCycle || 'monthly');
          setInitial({
            planTierId: safePlan,
            smartIdDispatch: js.smartIdDispatch || 'collect',
            billingCycle: js.billingCycle || 'monthly',
          });
        }
      } catch (err: any) {
        console.error('Failed to load payout settings', err);
        if (!cancelled) setError(err?.message || 'Failed to load plan settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      const res = await fetch('/api/clinicians/me/payout-settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          planTierId: selectedTierId,
          smartIdDispatch: dispatchOption,
          billingCycle,
        }),
      });
      const js: PlanSettingsResponse = await res.json().catch(() => ({} as any));
      if (!res.ok || !js.ok) throw new Error((js as any)?.error || 'Failed to save plan settings');

      // Same safety guard on returned plan id
      const rawPlan = js.currentPlanId as string;
      const allowedIds: PlanTierId[] = ['solo', 'starter', 'team', 'group'];
      const safePlan: PlanTierId = allowedIds.includes(rawPlan as PlanTierId)
        ? (rawPlan as PlanTierId)
        : selectedTierId;

      setInitial({
        planTierId: safePlan,
        smartIdDispatch: js.smartIdDispatch || dispatchOption,
        billingCycle: js.billingCycle || billingCycle,
      });
      setSavedMsg('Plan & dispatch settings updated.');
      setTimeout(() => setSavedMsg(null), 4000);
    } catch (err: any) {
      console.error('Save payout settings error', err);
      setError(err?.message || 'Failed to save plan settings');
    } finally {
      setSaving(false);
    }
  };

  const handleUpgradeClick = () => {
    const el = document.getElementById('plan-tier-grid');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleAddAdminStaffClick = () => {
    if (isFreePlan) {
      toast(
        'Add Admin Staff is available on Starter and above. Upgrade your plan to unlock admin staff slots.',
        'info',
      );
      handleUpgradeClick();
      return;
    }
    router.push('/settings/admin-staff');
  };

  return (
    <section className="border rounded bg-white p-4 space-y-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Clinician Plan &amp; Smart ID Dispatch</h2>
          <p className="text-xs text-gray-600">
            Your plan controls subscription, default payout share and how many admin staff you can
            attach via{' '}
            <code className="text-[11px] bg-gray-100 px-1 py-0.5 rounded">maxAdminStaffSlots</code>.
          </p>
        </div>
        <div className="flex flex-col items-end text-xs text-gray-600 gap-1">
          <div>
            Current plan:&nbsp;<span className="font-medium">{selectedTier.label}</span>
          </div>
          <div>
            Included admins:&nbsp;
            <span className="font-medium">{selectedTier.includedAdminSlots}</span> · Max:&nbsp;
            <span className="font-medium">{selectedTier.maxAdminSlots}</span>
          </div>
          <div>
            Default payout share:&nbsp;
            <span className="font-semibold">{Math.round(selectedTier.payoutSharePct * 100)}%</span>{' '}
            to you
          </div>
          <div className="mt-1 flex gap-2">
            {isFreePlan && (
              <button
                type="button"
                onClick={handleUpgradeClick}
                className="px-2 py-1 rounded border border-emerald-500 text-emerald-700 text-[11px] bg-emerald-50 hover:bg-emerald-100"
              >
                Upgrade Plan
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-gray-600">Billing cycle:</span>
        <button
          type="button"
          onClick={() => setBillingCycle('monthly')}
          className={`px-2 py-1 rounded-full border ${
            billingCycle === 'monthly'
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setBillingCycle('annual')}
          className={`px-2 py-1 rounded-full border ${
            billingCycle === 'annual'
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Annual (billed upfront)
        </button>
        <span className="text-[11px] text-gray-500">
          You&apos;ll see both per-month and per-year amounts on each plan.
        </span>
      </div>

      <div id="plan-tier-grid" className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {planTiers.map((tier) => {
          const selected = tier.id === selectedTierId;
          const perYear = tier.monthlySubscriptionZar * 12;
          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => setSelectedTierId(tier.id)}
              className={[
                'text-left rounded-lg border p-3 transition shadow-sm hover:shadow-md',
                selected
                  ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/40'
                  : 'border-gray-200 bg-white hover:border-gray-300',
              ].join(' ')}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="font-semibold text-sm">{tier.label}</div>
                {tier.highlight && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-600 text-white uppercase tracking-wide">
                    Most popular
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 mb-2">{tier.description}</div>
              <div className="text-sm font-semibold mb-0.5">
                {tier.currency} {tier.monthlySubscriptionZar.toLocaleString('en-ZA')}/month
              </div>
              <div className="text-[11px] text-gray-500 mb-1">
                ≈ {tier.currency} {perYear.toLocaleString('en-ZA')}/year
              </div>
              <div className="text-xs text-gray-600">
                Payout share:{' '}
                <span className="font-semibold">{Math.round(tier.payoutSharePct * 100)}%</span>
              </div>
              <div className="mt-2 border-t pt-2 text-xs space-y-1">
                <div>
                  Included admin staff: <span className="font-semibold">{tier.includedAdminSlots}</span>
                </div>
                <div>
                  Max admin staff slots: <span className="font-semibold">{tier.maxAdminSlots}</span>
                </div>
                {tier.extraAdminSlotZar != null && (
                  <div className="text-[11px] text-gray-500">
                    Extra slot: {tier.currency} {tier.extraAdminSlotZar.toLocaleString('en-ZA')} / month
                  </div>
                )}
                <div className="text-[11px] text-gray-500">{tier.recommendedFor}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700">
        <p className="mb-1">
          <span className="font-semibold">How this applies:</span>
        </p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>
            The plan sets the <span className="font-medium">default upper bound</span> for{' '}
            <code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded">maxAdminStaffSlots</code>{' '}
            on each clinician profile.
          </li>
          <li>
            Ops can override <span className="font-mono text-[11px]">maxAdminStaffSlots</span> per clinician
            or per clinician class.
          </li>
          <li>
            Admin staff created via{' '}
            <code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded">
              /api/clinicians/:id/admin-staff
            </code>{' '}
            must respect the current slot limit.
          </li>
        </ul>
      </div>

      <div className="mt-1 border rounded-lg px-3 py-2 bg-white">
        <div className="text-sm font-medium mb-1">Smart ID dispatch options</div>
        <p className="text-xs text-gray-600 mb-2">
          When an admin prints Smart IDs, indicate whether patients will{' '}
          <span className="font-medium">collect on site</span> or receive IDs by{' '}
          <span className="font-medium">courier</span> to the practice address captured at sign-up.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 text-sm">
          <label className="inline-flex items-center gap-2 rounded-md border px-2 py-1 bg-gray-50 cursor-pointer">
            <input
              type="radio"
              name="smartIdDispatch"
              value="collect"
              checked={dispatchOption === 'collect'}
              onChange={() => setDispatchOption('collect')}
            />
            <span>
              Physical collection at reception
              <span className="block text-[11px] text-gray-500">Patient (or admin) collects Smart ID in person.</span>
            </span>
          </label>
          <label className="inline-flex items-center gap-2 rounded-md border px-2 py-1 bg-gray-50 cursor-pointer">
            <input
              type="radio"
              name="smartIdDispatch"
              value="courier"
              checked={dispatchOption === 'courier'}
              onChange={() => setDispatchOption('courier')}
            />
            <span>
              Courier to practice address
              <span className="block text-[11px] text-gray-500">
                Uses the address stored on clinician sign-up / billing profile.
              </span>
            </span>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading || !dirty}
          className="px-3 py-1.5 rounded bg-black text-white text-xs disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save plan & dispatch'}
        </button>

        <button
          type="button"
          onClick={handleAddAdminStaffClick}
          className="px-3 py-1.5 rounded border text-xs bg-white hover:bg-gray-50"
        >
          Add Admin Staff
        </button>

        {loading && <span className="text-xs text-gray-500">Loading plan settings…</span>}
        {!loading && !saving && !error && dirty && (
          <span className="text-xs text-amber-600">You have unsaved changes.</span>
        )}
        {savedMsg && <span className="text-xs text-emerald-600">{savedMsg}</span>}
        {error && <span className="text-xs text-rose-600">Error: {error || 'Failed to save.'}</span>}
        {isFreePlan && (
          <span className="text-[11px] text-gray-500">
            On the free tier you can&apos;t attach admin staff yet. Upgrade to unlock admin staff slots.
          </span>
        )}
      </div>
    </section>
  );
}

// ---------- Small presentational helpers ----------

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border rounded bg-white p-3">
      <div className="text-xs text-gray-600">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
      {sub && <div className="text-[11px] text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border rounded bg-white p-3">
      <div className="text-xs font-semibold text-gray-800 mb-1">{title}</div>
      {children}
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="text-left px-2 py-1 border-b text-[11px] font-semibold text-gray-600">
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-2 py-1 align-top ${className}`}>{children}</td>;
}
