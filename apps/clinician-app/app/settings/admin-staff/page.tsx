'use client';

import { useEffect, useState } from 'react';
import { SettingsTabs } from '@/components/SettingsTabs';
import { toast } from '@/components/ToastMount';

// --- Plan tiers (local copy, trimmed to what we need) ---

type PlanTierId = 'solo' | 'starter' | 'team' | 'group';

type PlanTier = {
  id: PlanTierId;
  label: string;
  monthlySubscriptionZar: number;
  maxAdminStaffSlots: number;
};

const PLAN_TIERS: PlanTier[] = [
  {
    id: 'solo',
    label: 'Solo (Free)',
    monthlySubscriptionZar: 0,
    maxAdminStaffSlots: 1,
  },
  {
    id: 'starter',
    label: 'Starter (Premium)',
    monthlySubscriptionZar: 399,
    maxAdminStaffSlots: 2,
  },
  {
    id: 'team',
    label: 'Team',
    monthlySubscriptionZar: 799,
    maxAdminStaffSlots: 5,
  },
  {
    id: 'group',
    label: 'Group',
    monthlySubscriptionZar: 1499,
    maxAdminStaffSlots: 10,
  },
];

// --- Types for API responses ---

type BillingCycle = 'monthly' | 'annual';

type PlanSettingsResponse = {
  ok: boolean;
  clinicianId: string;
  currentPlanId: PlanTierId;
  smartIdDispatch: 'collect' | 'courier';
  billingCycle: BillingCycle;
  maxAdminStaffSlots: number | null;
  activeAdminStaffSlots: number;
};

type AdminStaffMember = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  type: 'medical' | 'non-medical';
  role?: string | null;
  status: 'active' | 'invited' | 'disabled';
};

type AdminStaffListResponse = {
  ok: boolean;
  maxSlots: number;
  activeSlots: number;
  staff: AdminStaffMember[];
};

export default function AdminStaffSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [planTierId, setPlanTierId] = useState<PlanTierId>('solo');
  const [maxSlots, setMaxSlots] = useState<number | null>(null);
  const [activeSlots, setActiveSlots] = useState(0);

  const [staff, setStaff] = useState<AdminStaffMember[]>([]);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newType, setNewType] = useState<'medical' | 'non-medical'>(
    'non-medical',
  );
  const [newRole, setNewRole] = useState('');

  const [saving, setSaving] = useState(false);

  const selectedPlan =
    PLAN_TIERS.find((t) => t.id === planTierId) ?? PLAN_TIERS[0];

  const isFreePlan = selectedPlan.monthlySubscriptionZar === 0;
  const atMaxSlots =
    maxSlots != null && activeSlots >= maxSlots && maxSlots > 0;

  // Load plan settings (to know current plan & slot limits)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setPlanLoading(true);
        setError(null);
        const res = await fetch('/api/clinicians/me/payout-settings', {
          cache: 'no-store',
        });
        const js: PlanSettingsResponse = await res.json();
        if (!res.ok || !js.ok) {
          throw new Error((js as any)?.error || `HTTP ${res.status}`);
        }

        if (cancelled) return;

        const safePlan: PlanTierId =
          PLAN_TIERS.find((t) => t.id === js.currentPlanId)?.id ?? 'solo';

        setPlanTierId(safePlan);
        setMaxSlots(js.maxAdminStaffSlots);
        setActiveSlots(js.activeAdminStaffSlots);
      } catch (err: any) {
        console.error('Failed to load plan/admin slots', err);
        if (!cancelled) {
          setError(err?.message || 'Failed to load plan/admin slots');
        }
      } finally {
        if (!cancelled) setPlanLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load staff list
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/clinicians/me/admin-staff', {
          cache: 'no-store',
        });
        const js: AdminStaffListResponse = await res.json();
        if (!res.ok || !js.ok) {
          throw new Error((js as any)?.error || `HTTP ${res.status}`);
        }
        if (cancelled) return;

        setStaff(js.staff || []);
        setActiveSlots(js.activeSlots);
        if (maxSlots == null) {
          setMaxSlots(js.maxSlots);
        }
      } catch (err: any) {
        console.error('Failed to load admin staff', err);
        if (!cancelled) {
          setError(err?.message || 'Failed to load admin staff');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canAddStaff = !isFreePlan && !atMaxSlots;

  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!canAddStaff) {
      if (isFreePlan) {
        toast(
          'Admin staff are only available on Starter plan and above. Upgrade your plan first.',
          'info',
        );
      } else if (atMaxSlots) {
        toast(
          'You have reached your admin staff slot limit. Upgrade or request a slot increase.',
          'warning',
        );
      }
      return;
    }
    if (!newName.trim() || !newEmail.trim()) {
      toast('Name and email are required for admin staff.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: newName.trim(),
        email: newEmail.trim(),
        phone: newPhone.trim() || null,
        type: newType,
        role: newRole.trim() || null,
      };

      const res = await fetch('/api/clinicians/me/admin-staff', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const js = await res.json().catch(() => ({}));
      if (!res.ok || !js.ok) {
        throw new Error(js?.error || `HTTP ${res.status}`);
      }

      const created: AdminStaffMember = js.staff ?? js.data ?? js;
      setStaff((prev) => [...prev, created]);
      setActiveSlots((n) => n + 1);

      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setNewRole('');

      toast('Admin staff added.', 'success');
    } catch (err: any) {
      console.error('Add admin staff failed', err);
      toast(err?.message || 'Failed to add admin staff', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDisableStaff(id: string) {
    try {
      const res = await fetch(`/api/clinicians/me/admin-staff/${id}`, {
        method: 'DELETE',
      });
      const js = await res.json().catch(() => ({}));
      if (!res.ok || js?.error) {
        throw new Error(js?.error || `HTTP ${res.status}`);
      }
      setStaff((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: 'disabled' } : s)),
      );
      setActiveSlots((n) => Math.max(0, n - 1));
      toast('Admin staff disabled.', 'success');
    } catch (err: any) {
      console.error('Disable admin staff failed', err);
      toast(err?.message || 'Failed to disable admin staff', 'error');
    }
  }

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <SettingsTabs />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            Admin Staff &amp; Assistants
          </h1>
          <p className="text-sm text-gray-600">
            Link medical and non-medical admin staff to your profile for
            bookings, follow-ups and Smart ID logistics.
          </p>
        </div>
        <div className="text-xs text-gray-600 flex flex-col items-end">
          <span>
            Plan:{' '}
            <span className="font-medium">
              {
                (PLAN_TIERS.find((t) => t.id === planTierId) ??
                  PLAN_TIERS[0]
                ).label
              }
            </span>
          </span>
          <span className="mt-0.5">
            Admin slots:{' '}
            <span className="font-medium">{activeSlots}</span> /{' '}
            <span className="font-medium">
              {maxSlots ?? selectedPlan.maxAdminStaffSlots}
            </span>
          </span>
        </div>
      </header>

      {error && (
        <div className="text-sm text-rose-600 border border-rose-200 bg-rose-50 px-3 py-2 rounded">
          {error}
        </div>
      )}

      {/* Info about limits */}
      <section className="border rounded bg-white p-3 text-xs text-gray-700 space-y-1">
        <div>
          <span className="font-semibold">How slots work:</span>
        </div>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>
            Your current plan determines the{' '}
            <span className="font-medium">maximum number of admin staff</span>{' '}
            that can be attached to your profile.
          </li>
          <li>
            On the <span className="font-medium">Solo (Free)</span> plan, admin
            staff are disabled. Upgrade in{' '}
            <span className="font-mono text-[11px]">Payout &amp; Plan</span> to
            unlock admin slots.
          </li>
          <li>
            Both <span className="font-medium">medical</span> and{' '}
            <span className="font-medium">non-medical</span> staff can be
            attached (e.g. practice manager, receptionist, enrolled nurse).
          </li>
        </ul>
      </section>

      {/* Add admin staff form */}
      <section className="border rounded bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h2 className="text-sm font-semibold text-gray-800">
            Add admin staff
          </h2>
          {isFreePlan && (
            <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              Upgrade plan to enable admin staff
            </span>
          )}
          {atMaxSlots && !isFreePlan && (
            <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              Slot limit reached
            </span>
          )}
        </div>

        <form
          onSubmit={handleAddStaff}
          className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs"
        >
          <label className="flex flex-col gap-1">
            Full name
            <input
              type="text"
              className="border rounded px-2 py-1 text-sm"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={!canAddStaff}
              placeholder="e.g. Thandi Mokoena"
            />
          </label>
          <label className="flex flex-col gap-1">
            Email
            <input
              type="email"
              className="border rounded px-2 py-1 text-sm"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              disabled={!canAddStaff}
              placeholder="admin@example.com"
            />
          </label>
          <label className="flex flex-col gap-1">
            Mobile (optional)
            <input
              type="tel"
              className="border rounded px-2 py-1 text-sm"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              disabled={!canAddStaff}
              placeholder="+27..."
            />
          </label>
          <label className="flex flex-col gap-1">
            Role / job title (optional)
            <input
              type="text"
              className="border rounded px-2 py-1 text-sm"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              disabled={!canAddStaff}
              placeholder="Receptionist, Practice manager, Enrolled nurse..."
            />
          </label>
          <div className="flex flex-col gap-1">
            <span>Type</span>
            <div className="flex gap-2">
              <button
                type="button"
                className={`px-3 py-1 rounded-full border text-xs ${
                  newType === 'non-medical'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
                onClick={() => setNewType('non-medical')}
                disabled={!canAddStaff}
              >
                Non-medical
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded-full border text-xs ${
                  newType === 'medical'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
                onClick={() => setNewType('medical')}
                disabled={!canAddStaff}
              >
                Medical
              </button>
            </div>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={!canAddStaff || saving}
              className="px-4 py-2 rounded bg-black text-white text-xs disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {saving ? 'Adding…' : 'Add Admin Staff'}
            </button>
          </div>
        </form>
      </section>

      {/* Staff list */}
      <section className="border rounded bg-white p-4 text-xs">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium text-gray-800">
            Linked admin staff
          </h2>
          {loading && (
            <span className="text-[11px] text-gray-500">Loading…</span>
          )}
        </div>

        {staff.length === 0 && !loading && (
          <div className="text-gray-500">No admin staff linked yet.</div>
        )}

        {staff.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full border text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-1 text-left border-b text-[11px] font-semibold text-gray-600">
                    Name
                  </th>
                  <th className="px-2 py-1 text-left border-b text-[11px] font-semibold text-gray-600">
                    Type
                  </th>
                  <th className="px-2 py-1 text-left border-b text-[11px] font-semibold text-gray-600">
                    Role
                  </th>
                  <th className="px-2 py-1 text-left border-b text-[11px] font-semibold text-gray-600">
                    Email
                  </th>
                  <th className="px-2 py-1 text-left border-b text-[11px] font-semibold text-gray-600">
                    Phone
                  </th>
                  <th className="px-2 py-1 text-left border-b text-[11px] font-semibold text-gray-600">
                    Status
                  </th>
                  <th className="px-2 py-1 text-left border-b text-[11px] font-semibold text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-2 py-1">{s.name}</td>
                    <td className="px-2 py-1 capitalize">
                      {s.type.replace('-', ' ')}
                    </td>
                    <td className="px-2 py-1">{s.role || '—'}</td>
                    <td className="px-2 py-1">{s.email}</td>
                    <td className="px-2 py-1">{s.phone || '—'}</td>
                    <td className="px-2 py-1 capitalize">{s.status}</td>
                    <td className="px-2 py-1">
                      {s.status !== 'disabled' ? (
                        <button
                          type="button"
                          onClick={() => handleDisableStaff(s.id)}
                          className="px-2 py-1 rounded border text-[11px] text-rose-600 border-rose-300 hover:bg-rose-50"
                        >
                          Disable
                        </button>
                      ) : (
                        <span className="text-[11px] text-gray-400">
                          Disabled
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
