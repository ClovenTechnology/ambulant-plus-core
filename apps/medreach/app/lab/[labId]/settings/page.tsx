function humanErrorMessage(value: unknown, fallback = "Unable to complete this request. Please try again.") {
  if (typeof value === "string") {
    const text = value.trim();
    if (text && text !== "[object Object]") return text;
  }

  if (value instanceof Error) {
    const text = value.message.trim();
    if (text && text !== "[object Object]") return text;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    for (const key of ["message", "error", "detail", "reason", "statusText", "code"]) {
      const candidate = record[key];

      if (typeof candidate === "string") {
        const text = candidate.trim();
        if (text && text !== "[object Object]") return text;
      }

      if (candidate && typeof candidate === "object") {
        const nested = candidate as Record<string, unknown>;

        for (const nestedKey of ["message", "error", "detail", "reason", "statusText", "code"]) {
          const nestedCandidate = nested[nestedKey];

          if (typeof nestedCandidate === "string") {
            const text = nestedCandidate.trim();
            if (text && text !== "[object Object]") return text;
          }
        }
      }
    }
  }

  if (value != null) {
    const text = String(value).trim();
    if (text && text !== "[object Object]") return text;
  }

  return fallback;
}

// apps/medreach/app/lab/[labId]/settings/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type LabStaffRole = 'OWNER' | 'ADMIN' | 'OPERATIONS' | 'RESULTS' | 'BILLING' | 'VIEWER';
type LabStaffStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED' | 'REVOKED';

type LabStaffMember = {
  id: string;
  userId: string;
  labId: string;
  role: LabStaffRole;
  active: boolean;
  status: LabStaffStatus;
  invitedBy?: string | null;
  approvedBy?: string | null;
  invitedAt?: string | null;
  approvedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type StaffCounts = {
  total?: number;
  active?: number;
  pending?: number;
  suspended?: number;
  revoked?: number;
};

const STAFF_ROLES: LabStaffRole[] = [
  'OWNER',
  'ADMIN',
  'OPERATIONS',
  'RESULTS',
  'BILLING',
  'VIEWER',
];

const STAFF_STATUSES: LabStaffStatus[] = [
  'PENDING',
  'ACTIVE',
  'SUSPENDED',
  'REJECTED',
  'REVOKED',
];

const STAFF_ROLE_HELP: Record<LabStaffRole, string> = {
  OWNER: 'Full operational ownership within this lab.',
  ADMIN: 'Can manage staff and operational settings.',
  OPERATIONS: 'Can coordinate lab workflow and specimen operations.',
  RESULTS: 'Can focus on result workflow and publishing operations.',
  BILLING: 'Can support finance and billing operations.',
  VIEWER: 'Read-only operational visibility.',
};
type LabProfile = {
  id: string;
  name: string;
  displayName?: string | null;
  contact?: string | null;
  logoUrl?: string | null;
  website?: string | null;
  operationalPhone?: string | null;
  operationalEmail?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
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
    displayName: lab.displayName ?? null,
    contact: lab.contact ?? null,
    logoUrl: lab.logoUrl ?? null,
    website: lab.website ?? null,
    operationalPhone: lab.operationalPhone ?? null,
    operationalEmail: lab.operationalEmail ?? null,
    addressLine1: lab.addressLine1 ?? null,
    addressLine2: lab.addressLine2 ?? null,
    city: lab.city ?? null,
    province: lab.province ?? null,
    postalCode: lab.postalCode ?? null,
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

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read profile image.'));
    reader.readAsDataURL(blob);
  });
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not load profile image.'));
    };

    img.src = objectUrl;
  });
}

async function prepareProfileImage(file: File): Promise<string> {
  const maxBytes = 900 * 1024;
  const maxSide = 512;

  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }

  const img = await loadImageFromFile(file);
  const size = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = Math.max(0, Math.floor((img.naturalWidth - size) / 2));
  const sy = Math.max(0, Math.floor((img.naturalHeight - size) / 2));

  const canvas = document.createElement('canvas');
  canvas.width = maxSide;
  canvas.height = maxSide;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Image processing is not available in this browser.');
  }

  ctx.drawImage(img, sx, sy, size, size, 0, 0, maxSide, maxSide);

  let quality = 0.82;
  let blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  );

  while (blob && blob.size > maxBytes && quality > 0.55) {
    quality -= 0.08;
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
  }

  if (!blob) {
    throw new Error('Could not prepare profile image.');
  }

  if (blob.size > maxBytes) {
    throw new Error('Please choose a smaller image.');
  }

  return blobToDataUrl(blob);
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
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [staff, setStaff] = useState<LabStaffMember[]>([]);
  const [staffCounts, setStaffCounts] = useState<StaffCounts>({});
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffSaving, setStaffSaving] = useState(false);
  const [staffErr, setStaffErr] = useState<string | null>(null);
  const [staffNotice, setStaffNotice] = useState<string | null>(null);
  const [staffDraft, setStaffDraft] = useState<{
    userId: string;
    role: LabStaffRole;
    status: LabStaffStatus;
  }>({
    userId: '',
    role: 'VIEWER',
    status: 'PENDING',
  });

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(`/api/labs/${encodeURIComponent(labId)}`, {
        cache: 'no-store',
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(humanErrorMessage(json?.error, `HTTP ${res.status}`));
      }

      const lab = normalizeLab(json);

      if (!lab) {
        throw new Error('Invalid lab profile payload');
      }

      setProfile(lab);
      setDraft({
        displayName: lab.displayName || lab.name,
        contact: lab.contact,
        logoUrl: lab.logoUrl,
        website: lab.website,
        operationalPhone: lab.operationalPhone,
        operationalEmail: lab.operationalEmail,
        addressLine1: lab.addressLine1,
        addressLine2: lab.addressLine2,
        city: lab.city,
        province: lab.province,
        postalCode: lab.postalCode,
      });
    } catch (e: any) {
      setErr(e?.message || 'Unable to load lab profile');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadStaff() {
    setStaffLoading(true);
    setStaffErr(null);

    try {
      const res = await fetch(`/api/labs/${encodeURIComponent(labId)}/staff`, {
        cache: 'no-store',
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(humanErrorMessage(json?.error, `Staff HTTP ${res.status}`));
      }

      setStaff(Array.isArray(json?.data) ? json.data : []);
      setStaffCounts(json?.counts || {});
    } catch (e: any) {
      setStaffErr(e?.message || 'Unable to load lab staff');
      setStaff([]);
      setStaffCounts({});
    } finally {
      setStaffLoading(false);
    }
  }

  async function inviteStaff() {
    const userId = staffDraft.userId.trim();

    if (!userId) {
      setStaffErr('Enter the staff user ID or user reference.');
      return;
    }

    setStaffSaving(true);
    setStaffErr(null);
    setStaffNotice(null);

    try {
      const res = await fetch(`/api/labs/${encodeURIComponent(labId)}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffDraft),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(humanErrorMessage(json?.error, `Staff HTTP ${res.status}`));
      }

      setStaffDraft({
        userId: '',
        role: 'VIEWER',
        status: 'PENDING',
      });
      setStaffNotice('Staff member saved.');
      await loadStaff();
    } catch (e: any) {
      setStaffErr(e?.message || 'Unable to save staff member');
    } finally {
      setStaffSaving(false);
    }
  }

  async function updateStaffMember(staffId: string, body: Record<string, unknown>) {
    setStaffSaving(true);
    setStaffErr(null);
    setStaffNotice(null);

    try {
      const res = await fetch(
        `/api/labs/${encodeURIComponent(labId)}/staff/${encodeURIComponent(staffId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(humanErrorMessage(json?.error, `Staff HTTP ${res.status}`));
      }

      setStaffNotice('Staff member updated.');
      await loadStaff();
    } catch (e: any) {
      setStaffErr(e?.message || 'Unable to update staff member');
    } finally {
      setStaffSaving(false);
    }
  }

  async function revokeStaffMember(staffId: string) {
    setStaffSaving(true);
    setStaffErr(null);
    setStaffNotice(null);

    try {
      const res = await fetch(
        `/api/labs/${encodeURIComponent(labId)}/staff/${encodeURIComponent(staffId)}`,
        {
          method: 'DELETE',
        },
      );

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(humanErrorMessage(json?.error, `Staff HTTP ${res.status}`));
      }

      setStaffNotice('Staff member revoked.');
      await loadStaff();
    } catch (e: any) {
      setStaffErr(e?.message || 'Unable to revoke staff member');
    } finally {
      setStaffSaving(false);
    }
  }
  useEffect(() => {
    void load();
    void loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labId]);

  async function handleLogoFileChange(file: File | null) {
    if (!file) return;

    setUploadingLogo(true);
    setErr(null);
    setNotice(null);

    try {
      const logoUrl = await prepareProfileImage(file);
      setDraft((prev) => ({ ...prev, logoUrl }));
      setNotice('Logo prepared. Save lab settings to publish it.');
    } catch (e: any) {
      setErr(e?.message || 'Unable to prepare logo image');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setErr(null);
    setNotice(null);

    try {
      const res = await fetch(`/api/labs/${encodeURIComponent(labId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labId,
          displayName: String(draft.displayName || '').trim() || undefined,
          contact: String(draft.contact || '').trim() || undefined,
          logoUrl: String(draft.logoUrl || '').trim() || undefined,
          website: String(draft.website || '').trim() || undefined,
          operationalPhone: String(draft.operationalPhone || '').trim() || undefined,
          operationalEmail: String(draft.operationalEmail || '').trim() || undefined,
          addressLine1: String(draft.addressLine1 || '').trim() || undefined,
          addressLine2: String(draft.addressLine2 || '').trim() || undefined,
          city: String(draft.city || '').trim() || undefined,
          province: String(draft.province || '').trim() || undefined,
          postalCode: String(draft.postalCode || '').trim() || undefined,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(humanErrorMessage(json?.error, `HTTP ${res.status}`));
      }

      const lab = normalizeLab(json);

      if (lab) {
        setProfile(lab);
      }

      setNotice('Lab public profile saved.');
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
        {humanErrorMessage(err, "Unable to complete this request. Please try again.")}
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
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-gray-50">
            {draft.logoUrl || profile.logoUrl ? (
              <img
                src={String(draft.logoUrl || profile.logoUrl)}
                alt={`${profile.displayName || profile.name} logo`}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-lg font-semibold text-gray-500">
                {(profile.displayName || profile.name || labId).slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          <div>
            <h1 className="text-xl font-semibold text-gray-950">
              {profile.displayName || profile.name || labId} — Lab Settings
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-600">
              Public lab profile and operational contact details. Verified KYB,
              approval, fees, payout and permissions remain governed by admin workflows.
            </p>
          </div>
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

      {notice ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {notice}
        </section>
      ) : null}

      {err ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {humanErrorMessage(err, "Unable to complete this request. Please try again.")}
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
        <h2 className="text-sm font-semibold text-gray-950">Public profile</h2>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[220px,1fr]">
          <div className="rounded-xl border bg-gray-50 p-4">
            <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border bg-white">
              {draft.logoUrl || profile.logoUrl ? (
                <img
                  src={String(draft.logoUrl || profile.logoUrl)}
                  alt="Lab logo preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-2xl font-semibold text-gray-400">
                  {(profile.displayName || profile.name || 'LA').slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>

            <label className="mt-4 block">
              <span className="sr-only">Upload lab logo</span>
              <input
                type="file"
                accept="image/*"
                disabled={uploadingLogo}
                onChange={(e) => void handleLogoFileChange(e.target.files?.[0] || null)}
                className="block w-full text-xs text-gray-600 file:mr-3 file:rounded-full file:border-0 file:bg-gray-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
              />
            </label>

            <p className="mt-2 text-[11px] text-gray-500">
              Square logo preferred. The image is cropped and compressed in-browser before saving.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="text-xs font-medium text-gray-600">Verified legal name</span>
              <input
                value={profile.name || ''}
                disabled
                className="mt-1 w-full rounded border bg-gray-100 px-3 py-2 text-sm text-gray-600"
              />
              <span className="mt-1 block text-[11px] text-gray-500">
                Locked. Changes require admin KYB review.
              </span>
            </label>

            <label className="block text-sm">
              <span className="text-xs font-medium text-gray-600">Public display name</span>
              <input
                value={String(draft.displayName || '')}
                onChange={(e) => setDraft((prev) => ({ ...prev, displayName: e.target.value }))}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                placeholder="e.g. Yanwide Labs Sandton"
              />
            </label>

            <label className="block text-sm">
              <span className="text-xs font-medium text-gray-600">General contact</span>
              <input
                value={String(draft.contact || '')}
                onChange={(e) => setDraft((prev) => ({ ...prev, contact: e.target.value }))}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                placeholder="Operations email / phone"
              />
            </label>

            <label className="block text-sm">
              <span className="text-xs font-medium text-gray-600">Website</span>
              <input
                value={String(draft.website || '')}
                onChange={(e) => setDraft((prev) => ({ ...prev, website: e.target.value }))}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                placeholder="https://..."
              />
            </label>

            <label className="block text-sm">
              <span className="text-xs font-medium text-gray-600">Operational phone</span>
              <input
                value={String(draft.operationalPhone || '')}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, operationalPhone: e.target.value }))
                }
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                placeholder="+27..."
              />
            </label>

            <label className="block text-sm">
              <span className="text-xs font-medium text-gray-600">Operational email</span>
              <input
                value={String(draft.operationalEmail || '')}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, operationalEmail: e.target.value }))
                }
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                placeholder="operations@example.co.za"
              />
            </label>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="text-xs font-medium text-gray-600">Address line 1</span>
            <input
              value={String(draft.addressLine1 || '')}
              onChange={(e) => setDraft((prev) => ({ ...prev, addressLine1: e.target.value }))}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="text-xs font-medium text-gray-600">Address line 2</span>
            <input
              value={String(draft.addressLine2 || '')}
              onChange={(e) => setDraft((prev) => ({ ...prev, addressLine2: e.target.value }))}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="text-xs font-medium text-gray-600">City</span>
            <input
              value={String(draft.city || '')}
              onChange={(e) => setDraft((prev) => ({ ...prev, city: e.target.value }))}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="text-xs font-medium text-gray-600">Province</span>
            <input
              value={String(draft.province || '')}
              onChange={(e) => setDraft((prev) => ({ ...prev, province: e.target.value }))}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="text-xs font-medium text-gray-600">Postal code</span>
            <input
              value={String(draft.postalCode || '')}
              onChange={(e) => setDraft((prev) => ({ ...prev, postalCode: e.target.value }))}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 text-xs text-gray-700 md:grid-cols-4">
          <div className="rounded-lg border bg-gray-50 p-3">
            <div className="text-gray-500">Status</div>
            <div className="font-semibold">{profile.status || 'PENDING'}</div>
          </div>
          <div className="rounded-lg border bg-gray-50 p-3">
            <div className="text-gray-500">Country</div>
            <div className="font-semibold">{profile.country || 'ZA'}</div>
          </div>
          <div className="rounded-lg border bg-gray-50 p-3">
            <div className="text-gray-500">Currency</div>
            <div className="font-semibold">{profile.currency || 'ZAR'}</div>
          </div>
          <div className="rounded-lg border bg-gray-50 p-3">
            <div className="text-gray-500">Monthly access fee</div>
            <div className="font-semibold">{money(profile.monthlyAccessFeeCents)}</div>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || uploadingLogo}
            className={`rounded border px-4 py-2 text-sm ${
              saving || uploadingLogo
                ? 'bg-gray-200 text-gray-500'
                : 'bg-gray-900 text-white hover:bg-black'
            }`}
          >
            {saving ? 'Saving...' : uploadingLogo ? 'Preparing logo...' : 'Save public profile'}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-950">Staff and access control</h2>
            <p className="mt-1 max-w-3xl text-xs text-gray-500">
              Invite and manage lab staff using MedReach roles. KYB approval, payout,
              commission and legal identity remain locked to admin workflows.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-right text-xs md:grid-cols-4">
            <div className="rounded-lg border bg-gray-50 px-3 py-2">
              <div className="text-gray-500">Total</div>
              <div className="font-semibold text-gray-950">{staffCounts.total || staff.length}</div>
            </div>
            <div className="rounded-lg border bg-gray-50 px-3 py-2">
              <div className="text-gray-500">Active</div>
              <div className="font-semibold text-emerald-700">{staffCounts.active || 0}</div>
            </div>
            <div className="rounded-lg border bg-gray-50 px-3 py-2">
              <div className="text-gray-500">Pending</div>
              <div className="font-semibold text-amber-700">{staffCounts.pending || 0}</div>
            </div>
            <div className="rounded-lg border bg-gray-50 px-3 py-2">
              <div className="text-gray-500">Suspended</div>
              <div className="font-semibold text-gray-700">{staffCounts.suspended || 0}</div>
            </div>
          </div>
        </div>

        {staffNotice ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            {staffNotice}
          </div>
        ) : null}

        {staffErr ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {staffErr}
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border bg-gray-50 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Add or update staff
          </h3>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr,180px,180px,auto]">
            <label className="block text-sm">
              <span className="text-xs font-medium text-gray-600">User ID / user reference</span>
              <input
                value={staffDraft.userId}
                onChange={(e) =>
                  setStaffDraft((prev) => ({ ...prev, userId: e.target.value }))
                }
                className="mt-1 w-full rounded border bg-white px-3 py-2 text-sm"
                placeholder="user_xxx or staff user ID"
              />
            </label>

            <label className="block text-sm">
              <span className="text-xs font-medium text-gray-600">Role</span>
              <select
                value={staffDraft.role}
                onChange={(e) =>
                  setStaffDraft((prev) => ({
                    ...prev,
                    role: e.target.value as LabStaffRole,
                  }))
                }
                className="mt-1 w-full rounded border bg-white px-3 py-2 text-sm"
              >
                {STAFF_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="text-xs font-medium text-gray-600">Initial status</span>
              <select
                value={staffDraft.status}
                onChange={(e) =>
                  setStaffDraft((prev) => ({
                    ...prev,
                    status: e.target.value as LabStaffStatus,
                  }))
                }
                className="mt-1 w-full rounded border bg-white px-3 py-2 text-sm"
              >
                <option value="PENDING">PENDING</option>
                <option value="ACTIVE">ACTIVE</option>
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={inviteStaff}
                disabled={staffSaving}
                className={`w-full rounded border px-4 py-2 text-sm ${
                  staffSaving
                    ? 'bg-gray-200 text-gray-500'
                    : 'bg-gray-900 text-white hover:bg-black'
                }`}
              >
                {staffSaving ? 'Saving...' : 'Save staff'}
              </button>
            </div>
          </div>

          <p className="mt-2 text-[11px] text-gray-500">
            Use ACTIVE only when the user has already completed internal onboarding. Otherwise
            keep PENDING until acceptance/approval is fully wired.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {STAFF_ROLES.map((role) => (
            <div key={role} className="rounded-xl border bg-white p-3 text-xs">
              <div className="font-semibold text-gray-900">{role}</div>
              <div className="mt-1 text-gray-500">{STAFF_ROLE_HELP[role]}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border">
          <div className="grid grid-cols-12 gap-2 border-b bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <div className="col-span-4">User</div>
            <div className="col-span-2">Role</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Invited</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {staffLoading ? (
            <div className="px-3 py-4 text-sm text-gray-500">Loading staff...</div>
          ) : staff.length === 0 ? (
            <div className="px-3 py-4 text-sm text-gray-500">
              No lab staff have been configured yet.
            </div>
          ) : (
            <div className="divide-y">
              {staff.map((member) => (
                <div
                  key={member.id}
                  className="grid grid-cols-1 gap-3 px-3 py-3 text-xs md:grid-cols-12 md:items-center"
                >
                  <div className="md:col-span-4">
                    <div className="truncate font-mono text-gray-900">{member.userId}</div>
                    <div className="text-[11px] text-gray-500">{member.id}</div>
                  </div>

                  <div className="md:col-span-2">
                    <select
                      value={member.role}
                      disabled={staffSaving}
                      onChange={(e) =>
                        void updateStaffMember(member.id, {
                          role: e.target.value,
                        })
                      }
                      className="w-full rounded border bg-white px-2 py-1 text-xs"
                    >
                      {STAFF_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <select
                      value={member.status}
                      disabled={staffSaving}
                      onChange={(e) =>
                        void updateStaffMember(member.id, {
                          status: e.target.value,
                        })
                      }
                      className="w-full rounded border bg-white px-2 py-1 text-xs"
                    >
                      {STAFF_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="text-gray-500 md:col-span-2">
                    {member.invitedAt ? new Date(member.invitedAt).toLocaleDateString() : '-'}
                  </div>

                  <div className="flex flex-wrap justify-start gap-2 md:col-span-2 md:justify-end">
                    {member.status !== 'ACTIVE' ? (
                      <button
                        type="button"
                        disabled={staffSaving}
                        onClick={() =>
                          void updateStaffMember(member.id, {
                            status: 'ACTIVE',
                          })
                        }
                        className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
                      >
                        Activate
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={staffSaving}
                        onClick={() =>
                          void updateStaffMember(member.id, {
                            status: 'SUSPENDED',
                          })
                        }
                        className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100"
                      >
                        Suspend
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={staffSaving || member.status === 'REVOKED'}
                      onClick={() => void revokeStaffMember(member.id)}
                      className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}