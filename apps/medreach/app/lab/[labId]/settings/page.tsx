// apps/medreach/app/lab/[labId]/settings/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type LabProfile = {
  id: string;
  name: string;
  contact?: string | null;
  active?: boolean;
  status?: string | null;
  onboardingStatus?: string | null;
  country?: string | null;
  currency?: string | null;
  canManageStaff?: boolean;
  canPublishResults?: boolean;
  payoutAccountMasked?: string | null;
  ownerUserId?: string | null;
  commissionKind?: string | null;
  commissionValue?: number | null;
  monthlyAccessFeeCents?: number | null;
  counts?: {
    offeredTests?: number;
    panels?: number;
    staffMembers?: number;
    eligibleOrders?: number;
  };
};

function normalizeLab(raw: any): LabProfile | null {
  const lab = raw?.data || raw?.settings || raw?.lab || raw;

  if (!lab || typeof lab !== 'object') return null;

  return {
    id: String(lab.id || ''),
    name: String(lab.name || ''),
    contact: lab.contact ?? null,
    active: lab.active,
    status: lab.status ?? null,
    onboardingStatus: lab.onboardingStatus ?? null,
    country: lab.country ?? null,
    currency: lab.currency ?? null,
    canManageStaff: lab.canManageStaff,
    canPublishResults: lab.canPublishResults,
    payoutAccountMasked: lab.payoutAccountMasked ?? null,
    ownerUserId: lab.ownerUserId ?? null,
    commissionKind: lab.commissionKind ?? null,
    commissionValue: lab.commissionValue == null ? null : Number(lab.commissionValue),
    monthlyAccessFeeCents: lab.monthlyAccessFeeCents ?? null,
    counts: lab.counts,
  };
}

function money(cents: unknown) {
  const n = Number(cents);
  const safe = Number.isFinite(n) ? n : 0;

  return `R ${(safe / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

export default function LabSettingsPage() {
  const params = useParams<{ labId: string }>();
  const labId = params.labId;

  const [profile, setProfile] = useState<LabProfile | null>(null);
  const [draft, setDraft] = useState<Partial<LabProfile>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(`/api/labs/${encodeURIComponent(labId)}`, {
        cache: 'no-store',
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      const lab = normalizeLab(json);

      if (!lab) {
        throw new Error('Invalid lab profile payload');
      }

      setProfile(lab);
      setDraft({
        name: lab.name,
        contact: lab.contact,
        country: lab.country,
        currency: lab.currency,
        active: lab.active,
        canManageStaff: lab.canManageStaff,
        canPublishResults: lab.canPublishResults,
      });
    } catch (e: any) {
      setErr(e?.message || 'Unable to load lab profile');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labId]);

  async function handleSave() {
    setSaving(true);
    setErr(null);

    try {
      const res = await fetch(`/api/labs/${encodeURIComponent(labId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labId,
          ...draft,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      const lab = normalizeLab(json);

      if (lab) {
        setProfile(lab);
      }

      await load();
    } catch (e: any) {
      setErr(e?.message || 'Unable to save lab settings');
    } finally {
      setSaving(false);
    }
  }

  const readiness = useMemo(() => {
    if (!profile) {
      return {
        score: 0,
        approved: false,
        staff: false,
        tests: false,
        panels: false,
        resultPublishing: false,
        payout: false,
      };
    }

    const approved = profile.active !== false && profile.status === 'ACTIVE';
    const staff = Number(profile.counts?.staffMembers || 0) > 0;
    const tests = Number(profile.counts?.offeredTests || 0) > 0;
    const panels = Number(profile.counts?.panels || 0) > 0;
    const resultPublishing = profile.canPublishResults !== false;
    const payout = Boolean(profile.payoutAccountMasked);

    return {
      score: [approved, staff, tests, panels, resultPublishing, payout].filter(Boolean).length,
      approved,
      staff,
      tests,
      panels,
      resultPublishing,
      payout,
    };
  }, [profile]);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 text-sm text-gray-500">
        Loading lab profile...
      </main>
    );
  }

  if (err && !profile) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 text-sm text-red-600">
        {err}
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 text-sm text-red-600">
        Lab profile unavailable.
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-950">
            {profile.name || labId} — Lab Settings
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Enterprise profile, onboarding and operational-readiness surface for this lab.
            Finance and KYC/KYB decisions remain governed by admin workflows.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            href={`/lab/${encodeURIComponent(labId)}/dashboard`}
            className="rounded-full border bg-white px-3 py-1 hover:bg-gray-50"
          >
            Dashboard
          </Link>
          <Link
            href={`/lab/${encodeURIComponent(labId)}/tests`}
            className="rounded-full border bg-white px-3 py-1 hover:bg-gray-50"
          >
            Tests & panels
          </Link>
        </div>
      </header>

      {err ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {err}
        </section>
      ) : null}

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-950">Readiness</h2>
            <p className="mt-1 text-xs text-gray-500">
              A lab should not be live unless approval, staff, tests, panels, payout and
              result-publishing capability are coherent.
            </p>
          </div>
          <div className="text-sm font-semibold text-gray-900">
            {readiness.score}/6 ready
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Pill ok={readiness.approved} text="Active/approved" />
          <Pill ok={readiness.staff} text="Staff configured" />
          <Pill ok={readiness.tests} text="Tests published" />
          <Pill ok={readiness.panels} text="Panels configured" />
          <Pill ok={readiness.resultPublishing} text="Result publishing enabled" />
          <Pill ok={readiness.payout} text="Payout configured" />
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-950">Profile</h2>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="text-xs font-medium text-gray-600">Lab name</span>
            <input
              value={String(draft.name || '')}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="text-xs font-medium text-gray-600">Contact</span>
            <input
              value={String(draft.contact || '')}
              onChange={(e) => setDraft((prev) => ({ ...prev, contact: e.target.value }))}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              placeholder="Operations email / phone"
            />
          </label>

          <label className="block text-sm">
            <span className="text-xs font-medium text-gray-600">Country</span>
            <input
              value={String(draft.country || '')}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, country: e.target.value.toUpperCase() }))
              }
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              placeholder="ZA"
              maxLength={2}
            />
          </label>

          <label className="block text-sm">
            <span className="text-xs font-medium text-gray-600">Currency</span>
            <input
              value={String(draft.currency || '')}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))
              }
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              placeholder="ZAR"
              maxLength={3}
            />
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 text-xs text-gray-700 md:grid-cols-3">
          <div className="rounded-lg border bg-gray-50 p-3">
            <div className="text-gray-500">Status</div>
            <div className="font-semibold">{profile.status || 'PENDING'}</div>
          </div>
          <div className="rounded-lg border bg-gray-50 p-3">
            <div className="text-gray-500">Onboarding</div>
            <div className="font-semibold">{profile.onboardingStatus || 'Not recorded'}</div>
          </div>
          <div className="rounded-lg border bg-gray-50 p-3">
            <div className="text-gray-500">Monthly access fee</div>
            <div className="font-semibold">{money(profile.monthlyAccessFeeCents)}</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-xs">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.active !== false}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, active: e.target.checked }))
              }
            />
            Active
          </label>

          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.canManageStaff !== false}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, canManageStaff: e.target.checked }))
              }
            />
            Can manage staff
          </label>

          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.canPublishResults !== false}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, canPublishResults: e.target.checked }))
              }
            />
            Can publish results
          </label>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`rounded border px-4 py-2 text-sm ${
              saving
                ? 'bg-gray-200 text-gray-500'
                : 'bg-gray-900 text-white hover:bg-black'
            }`}
          >
            {saving ? 'Saving...' : 'Save lab settings'}
          </button>
        </div>
      </section>
    </main>
  );
}