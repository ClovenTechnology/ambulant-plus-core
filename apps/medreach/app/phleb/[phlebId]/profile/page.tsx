// apps/medreach/app/phleb/[phlebId]/profile/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type Vehicle = {
  make?: string;
  model?: string;
  registration?: string;
  color?: string;
  type?: string;
  changePending?: boolean;
};

type PhlebProfile = {
  id?: string;
  phlebId?: string;
  userId?: string;
  fullName?: string;
  name?: string;
  email?: string;
  dob?: string;
  gender?: string;
  qualification?: string;
  basePhone?: string;
  contactPhone?: string;
  active?: boolean;
  approvalStatus?: string;
  country?: string;
  currency?: string;
  payoutAccountMasked?: string | null;
  defaultLabId?: string | null;
  defaultLab?: {
    id?: string;
    name?: string;
    active?: boolean;
    status?: string;
  } | null;
  commissionKind?: string | null;
  commissionValue?: number | null;
  ratingAvg?: number | null;
  ratingCount?: number;
  completedJobsCount?: number;
  cancelledJobsCount?: number;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
};

type Preferences = {
  phlebId?: string;
  avatarUrl?: string;
  contactPhone?: string;
  serviceAreas?: string[];
  preferredLabIds?: string[];
  vehicle?: Vehicle;
};

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeProfile(raw: any): PhlebProfile | null {
  const profile = raw?.data || raw?.profile || raw?.phleb || raw;

  if (!profile || typeof profile !== 'object') return null;

  return {
    id: profile.id,
    phlebId: profile.phlebId || profile.id,
    userId: profile.userId,
    fullName: profile.fullName || profile.name || profile.displayName,
    name: profile.name || profile.fullName || profile.displayName,
    email: profile.email,
    dob: profile.dob,
    gender: profile.gender,
    qualification: profile.qualification,
    basePhone: profile.basePhone,
    contactPhone: profile.contactPhone,
    active: profile.active,
    approvalStatus: profile.approvalStatus || profile.status,
    country: profile.country,
    currency: profile.currency,
    payoutAccountMasked: profile.payoutAccountMasked ?? null,
    defaultLabId: profile.defaultLabId ?? profile.labId ?? null,
    defaultLab: profile.defaultLab || profile.lab || null,
    commissionKind: profile.commissionKind ?? null,
    commissionValue:
      profile.commissionValue == null ? null : Number(profile.commissionValue),
    ratingAvg: profile.ratingAvg == null ? null : Number(profile.ratingAvg),
    ratingCount: Number(profile.ratingCount || 0),
    completedJobsCount: Number(profile.completedJobsCount || 0),
    cancelledJobsCount: Number(profile.cancelledJobsCount || 0),
    approvedAt: profile.approvedAt ?? null,
    rejectedAt: profile.rejectedAt ?? null,
    rejectionReason: profile.rejectionReason ?? null,
  };
}

function normalizePreferences(raw: any): Preferences {
  const prefs = raw?.data || raw?.preferences || raw || {};

  return {
    phlebId: prefs.phlebId,
    avatarUrl: prefs.avatarUrl || '',
    contactPhone: prefs.contactPhone || '',
    serviceAreas: Array.isArray(prefs.serviceAreas) ? prefs.serviceAreas : [],
    preferredLabIds: Array.isArray(prefs.preferredLabIds) ? prefs.preferredLabIds : [],
    vehicle: prefs.vehicle || {},
  };
}

function splitCsv(value: string) {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function joinCsv(value: string[] | undefined) {
  return Array.isArray(value) ? value.join(', ') : '';
}

function displayName(profile: PhlebProfile | null, fallback: string) {
  return (
    clean(profile?.fullName) ||
    clean(profile?.name) ||
    clean(profile?.email) ||
    clean(profile?.userId) ||
    fallback
  );
}

function Pill({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${
        ok
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-amber-200 bg-amber-50 text-amber-700'
      }`}
    >
      {text}
    </span>
  );
}

export default function PhlebProfilePage() {
  const params = useParams<{ phlebId: string }>();
  const phlebId = params.phlebId;

  const [profile, setProfile] = useState<PhlebProfile | null>(null);
  const [preferences, setPreferences] = useState<Preferences>(() => normalizePreferences(null));
  const [draft, setDraft] = useState<Preferences>(() => normalizePreferences(null));
  const [serviceAreasText, setServiceAreasText] = useState('');
  const [preferredLabsText, setPreferredLabsText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    setNotice(null);

    try {
      const [profileRes, prefsRes] = await Promise.all([
        fetch(`/api/phlebs/profile?phlebId=${encodeURIComponent(phlebId)}`, {
          cache: 'no-store',
        }),
        fetch(`/api/phlebs/preferences?phlebId=${encodeURIComponent(phlebId)}`, {
          cache: 'no-store',
        }),
      ]);

      const profileJson = await profileRes.json().catch(() => null);
      const prefsJson = await prefsRes.json().catch(() => null);

      if (!profileRes.ok || profileJson?.ok === false) {
        throw new Error(profileJson?.error || `Profile HTTP ${profileRes.status}`);
      }

      if (!prefsRes.ok || prefsJson?.ok === false) {
        throw new Error(prefsJson?.error || `Preferences HTTP ${prefsRes.status}`);
      }

      const nextProfile = normalizeProfile(profileJson);
      const nextPrefs = normalizePreferences(prefsJson);

      setProfile(nextProfile);
      setPreferences(nextPrefs);
      setDraft(nextPrefs);
      setServiceAreasText(joinCsv(nextPrefs.serviceAreas));
      setPreferredLabsText(joinCsv(nextPrefs.preferredLabIds));
    } catch (e: any) {
      setErr(e?.message || 'Unable to load phleb profile');
      setProfile(null);
      setPreferences(normalizePreferences(null));
      setDraft(normalizePreferences(null));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phlebId]);

  const readiness = useMemo(() => {
    const approved =
      profile?.approvalStatus === 'ACTIVE' || profile?.approvalStatus === 'APPROVED';
    const active = profile?.active !== false;
    const defaultLab = Boolean(profile?.defaultLabId || profile?.defaultLab?.id);
    const payout = Boolean(profile?.payoutAccountMasked);
    const areas = Boolean(preferences.serviceAreas?.length);
    const vehicle = Boolean(
      preferences.vehicle?.type ||
        preferences.vehicle?.make ||
        preferences.vehicle?.registration,
    );

    return {
      approved,
      active,
      defaultLab,
      payout,
      areas,
      vehicle,
      score: [approved, active, defaultLab, payout, areas, vehicle].filter(Boolean).length,
    };
  }, [profile, preferences]);

  async function savePreferences() {
    setSaving(true);
    setErr(null);
    setNotice(null);

    try {
      const body: Preferences & { phlebId: string } = {
        phlebId,
        avatarUrl: clean(draft.avatarUrl) || undefined,
        contactPhone: clean(draft.contactPhone) || undefined,
        serviceAreas: splitCsv(serviceAreasText),
        preferredLabIds: splitCsv(preferredLabsText),
        vehicle: {
          make: clean(draft.vehicle?.make),
          model: clean(draft.vehicle?.model),
          registration: clean(draft.vehicle?.registration),
          color: clean(draft.vehicle?.color),
          type: clean(draft.vehicle?.type),
        },
      };

      const res = await fetch('/api/phlebs/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      setNotice('Preferences saved.');
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Unable to save preferences');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 text-sm text-gray-500">
        Loading phleb profile...
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-950">
            {displayName(profile, phlebId)} — Profile & Readiness
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Phleb identity, approval state, operational preferences, default lab routing,
            service areas, vehicle/transport detail and payout-readiness overview.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            href={`/phleb/${encodeURIComponent(phlebId)}`}
            className="rounded-full border bg-white px-3 py-1 hover:bg-gray-50"
          >
            Field console
          </Link>
          <Link
            href={`/phleb/${encodeURIComponent(phlebId)}/dashboard`}
            className="rounded-full border bg-white px-3 py-1 hover:bg-gray-50"
          >
            Dashboard
          </Link>
          <Link
            href={`/phleb/${encodeURIComponent(phlebId)}/payouts`}
            className="rounded-full border bg-white px-3 py-1 hover:bg-gray-50"
          >
            Payouts
          </Link>
        </div>
      </header>

      {notice ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {notice}
        </section>
      ) : null}

      {err ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {err}
        </section>
      ) : null}

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-950">Operational readiness</h2>
            <p className="mt-1 text-xs text-gray-500">
              A phleb should not be live unless approval, active state, default lab,
              payout, service area and transport details are coherent.
            </p>
          </div>
          <div className="text-sm font-semibold text-gray-900">
            {readiness.score}/6 ready
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Pill ok={readiness.approved} text="Approved" />
          <Pill ok={readiness.active} text="Active" />
          <Pill ok={readiness.defaultLab} text="Default lab linked" />
          <Pill ok={readiness.payout} text="Payout configured" />
          <Pill ok={readiness.areas} text="Service areas set" />
          <Pill ok={readiness.vehicle} text="Vehicle/transport set" />
        </div>

        {profile?.rejectedAt ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            Rejected: {profile.rejectionReason || 'No reason supplied'}
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">Approval status</div>
          <div className="mt-1 text-lg font-semibold text-gray-950">
            {profile?.approvalStatus || 'PENDING'}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">Default lab</div>
          <div className="mt-1 truncate text-lg font-semibold text-gray-950">
            {profile?.defaultLab?.name || profile?.defaultLabId || '-'}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">Payout mask</div>
          <div className="mt-1 truncate text-lg font-semibold text-gray-950">
            {profile?.payoutAccountMasked || '-'}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-950">Identity and performance</h2>

        <div className="mt-4 grid grid-cols-1 gap-3 text-xs text-gray-700 md:grid-cols-3">
          <div className="rounded-lg border bg-gray-50 p-3">
            <div className="text-gray-500">User ID</div>
            <div className="truncate font-mono">{profile?.userId || profile?.id || '-'}</div>
          </div>
          <div className="rounded-lg border bg-gray-50 p-3">
            <div className="text-gray-500">Email</div>
            <div className="truncate font-semibold">{profile?.email || '-'}</div>
          </div>
          <div className="rounded-lg border bg-gray-50 p-3">
            <div className="text-gray-500">Phone</div>
            <div className="font-semibold">
              {profile?.contactPhone || profile?.basePhone || draft.contactPhone || '-'}
            </div>
          </div>
          <div className="rounded-lg border bg-gray-50 p-3">
            <div className="text-gray-500">Completed jobs</div>
            <div className="font-semibold">{profile?.completedJobsCount || 0}</div>
          </div>
          <div className="rounded-lg border bg-gray-50 p-3">
            <div className="text-gray-500">Cancelled jobs</div>
            <div className="font-semibold">{profile?.cancelledJobsCount || 0}</div>
          </div>
          <div className="rounded-lg border bg-gray-50 p-3">
            <div className="text-gray-500">Rating</div>
            <div className="font-semibold">
              {profile?.ratingAvg == null
                ? '-'
                : `${Number(profile.ratingAvg).toFixed(1)} (${profile.ratingCount || 0})`}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-950">Operational preferences</h2>
        <p className="mt-1 text-xs text-gray-500">
          These settings are used for routing, coverage and field operations. Admin approval
          and KYI decisions remain governed centrally.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="text-xs font-medium text-gray-600">Avatar URL</span>
            <input
              value={draft.avatarUrl || ''}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, avatarUrl: e.target.value }))
              }
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              placeholder="https://..."
            />
          </label>

          <label className="block text-sm">
            <span className="text-xs font-medium text-gray-600">Contact phone</span>
            <input
              value={draft.contactPhone || ''}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, contactPhone: e.target.value }))
              }
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              placeholder="+27..."
            />
          </label>

          <label className="block text-sm md:col-span-2">
            <span className="text-xs font-medium text-gray-600">Service areas</span>
            <input
              value={serviceAreasText}
              onChange={(e) => setServiceAreasText(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              placeholder="Randburg, Rosebank, Sandton"
            />
          </label>

          <label className="block text-sm md:col-span-2">
            <span className="text-xs font-medium text-gray-600">Preferred/default lab IDs</span>
            <input
              value={preferredLabsText}
              onChange={(e) => setPreferredLabsText(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              placeholder="lancet-cresta, adc-diagnostics-durban"
            />
          </label>

          <label className="block text-sm">
            <span className="text-xs font-medium text-gray-600">Vehicle type</span>
            <input
              value={draft.vehicle?.type || ''}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  vehicle: { ...prev.vehicle, type: e.target.value },
                }))
              }
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              placeholder="Bike, car, scooter"
            />
          </label>

          <label className="block text-sm">
            <span className="text-xs font-medium text-gray-600">Registration</span>
            <input
              value={draft.vehicle?.registration || ''}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  vehicle: { ...prev.vehicle, registration: e.target.value },
                }))
              }
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              placeholder="ABC 123 GP"
            />
          </label>

          <label className="block text-sm">
            <span className="text-xs font-medium text-gray-600">Make</span>
            <input
              value={draft.vehicle?.make || ''}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  vehicle: { ...prev.vehicle, make: e.target.value },
                }))
              }
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              placeholder="Toyota"
            />
          </label>

          <label className="block text-sm">
            <span className="text-xs font-medium text-gray-600">Model / colour</span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <input
                value={draft.vehicle?.model || ''}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    vehicle: { ...prev.vehicle, model: e.target.value },
                  }))
                }
                className="rounded border px-3 py-2 text-sm"
                placeholder="Model"
              />
              <input
                value={draft.vehicle?.color || ''}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    vehicle: { ...prev.vehicle, color: e.target.value },
                  }))
                }
                className="rounded border px-3 py-2 text-sm"
                placeholder="Colour"
              />
            </div>
          </label>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={savePreferences}
            disabled={saving}
            className={`rounded border px-4 py-2 text-sm ${
              saving
                ? 'bg-gray-200 text-gray-500'
                : 'bg-gray-900 text-white hover:bg-black'
            }`}
          >
            {saving ? 'Saving...' : 'Save preferences'}
          </button>
        </div>
      </section>
    </main>
  );
}