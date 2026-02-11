'use client';

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

/* ----------------- PLAN TYPES ----------------- */

export type PlanTierId = 'solo' | 'starter' | 'team' | 'group';
export type SmartIdDispatchOption = 'collect' | 'courier';

export type PlanTier = {
  id: PlanTierId;
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
};

export const PLAN_TIERS: PlanTier[] = [
  {
    id: 'solo',
    label: 'Solo (Free)',
    description: 'Single clinician, no admin staff.',
    currency: 'ZAR',
    monthlySubscriptionZar: 0,
    payoutSharePct: 0.8,
    includedAdminSlots: 0,
    maxAdminSlots: 1,
    extraAdminSlotZar: null,
    recommendedFor: 'Part-time & early adopters',
  },
  {
    id: 'starter',
    label: 'Starter (Premium)',
    description: 'Clinician + 1 admin assistant.',
    currency: 'ZAR',
    monthlySubscriptionZar: 399,
    payoutSharePct: 0.82,
    includedAdminSlots: 1,
    maxAdminSlots: 2,
    extraAdminSlotZar: 149,
    recommendedFor: 'Solo clinics with admin support',
    highlight: true,
  },
  {
    id: 'team',
    label: 'Team',
    description: 'Small group practices.',
    currency: 'ZAR',
    monthlySubscriptionZar: 799,
    payoutSharePct: 0.84,
    includedAdminSlots: 3,
    maxAdminSlots: 5,
    extraAdminSlotZar: 129,
    recommendedFor: 'Shared admin teams',
  },
  {
    id: 'group',
    label: 'Group',
    description: 'Large practices & call-centres.',
    currency: 'ZAR',
    monthlySubscriptionZar: 1499,
    payoutSharePct: 0.86,
    includedAdminSlots: 5,
    maxAdminSlots: 10,
    extraAdminSlotZar: 99,
    recommendedFor: 'Enterprise clinics',
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

/* ================= PAGE ================= */

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

      const currency = js.currency || js.baseConsultation?.currency || 'ZAR';
      const baseConsultation = {
        amountCents: js.baseConsultation?.amountCents ?? js.feeCents ?? null,
        followupAmountCents: js.baseConsultation?.followupAmountCents ?? null,
      };

      setFeesSummary({ ok: true, currency, baseConsultation });
    } catch {}
  }

  useEffect(() => {
    load();
    loadFeesSummary();
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
    } finally {
      setSavingSchedule(false);
    }
  }

  const cur = summary?.currency || feesSummary?.currency || 'ZAR';

  return (
    <main className="p-6 space-y-6">
      <SettingsTabs />

      {/* HEADER */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Payouts & Earnings</h1>
          <p className="text-sm text-gray-600">
            Track earnings, payout schedule, and demographic breakdowns.
          </p>
        </div>
      </header>

      {/* PLAN SECTION */}
      <ClinicianPlanSection />

      {error && (
        <div className="text-sm text-rose-600 border border-rose-200 bg-rose-50 px-3 py-2 rounded">
          {error}
        </div>
      )}

      {loading && !summary && (
        <div className="text-sm text-gray-600">Loading payouts…</div>
      )}
    </main>
  );
}

/* ================= PLAN SECTION ================= */

type PlanTiersApiResponse = {
  ok?: boolean;
  clinicianPlans?: any[];
  error?: string;
};

function ClinicianPlanSection() {
  const router = useRouter();
  const [planTiers, setPlanTiers] = useState<PlanTier[]>(PLAN_TIERS);
  const [selectedTierId, setSelectedTierId] = useState<PlanTierId>('starter');
  const [dispatchOption, setDispatchOption] = useState<SmartIdDispatchOption>('collect');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTier = planTiers.find(t => t.id === selectedTierId) ?? planTiers[0];
  const isFreePlan = selectedTier.monthlySubscriptionZar === 0;

  useEffect(() => {
    setLoading(false);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/clinicians/me/payout-settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          planTierId: selectedTierId,
          smartIdDispatch: dispatchOption,
          billingCycle,
        }),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddAdminStaffClick = () => {
    if (isFreePlan) {
      toast('Upgrade your plan to unlock admin staff slots.', 'info');
      return;
    }
    router.push('/settings/admin-staff');
  };

  return (
    <section className="border rounded bg-white p-4 space-y-4 text-sm">
      <h2 className="text-sm font-semibold text-gray-900">
        Clinician Plan & Smart ID Dispatch
      </h2>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {planTiers.map(tier => (
          <button
            key={tier.id}
            onClick={() => setSelectedTierId(tier.id)}
            className={`text-left rounded-lg border p-3 ${
              tier.id === selectedTierId
                ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/40'
                : 'border-gray-200 bg-white'
            }`}
          >
            <div className="font-semibold">{tier.label}</div>
            <div className="text-xs text-gray-500">{tier.description}</div>
            <div className="mt-1 text-sm font-semibold">
              ZAR {tier.monthlySubscriptionZar}/month
            </div>
            <div className="text-xs text-gray-600">
              Payout share: {Math.round(tier.payoutSharePct * 100)}%
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 rounded bg-black text-white text-xs"
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>

        <button
          onClick={handleAddAdminStaffClick}
          className="px-3 py-1.5 rounded border text-xs"
        >
          Add Admin Staff
        </button>
      </div>

      {error && <div className="text-xs text-rose-600">Error: {error}</div>}
    </section>
  );
}

/* ================= UI HELPERS ================= */

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
