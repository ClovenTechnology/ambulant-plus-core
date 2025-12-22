// apps/clinician-app/app/settings/profile/page.tsx
'use client';
import { SettingsTabs } from '@/components/SettingsTabs';
import { useEffect, useState, FormEvent, ChangeEvent } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SmartIdCard } from '@/components/SmartIdCard';
import { toast } from '@/components/ToastMount';

type Qualification = {
  type: string; // e.g. "MBChB", "Short Course (CPD)", "Diploma"
  institution: string; // e.g. "UCT", "Cloven Technology Institute"
  year: string; // e.g. "2014" or "2025-03-31"
  notes?: string | null;
};

type ClinicianProfile = {
  id: string;
  userId?: string | null;

  // identity (locked)
  fullName?: string | null;
  displayName?: string | null;
  dob?: string | null; // ISO
  email?: string | null;
  gender?: string | null;
  hpcsaRegNo?: string | null;

  // editable
  phone?: string | null;
  city?: string | null;
  country?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;

  // NEW: practice & insurance
  practiceName?: string | null;
  practiceNumber?: string | null;
  regulatorBody?: string | null;
  regulatorRegistration?: string | null;
  acceptsMedicalAid?: boolean | null;
  acceptedSchemes?: string[] | null;

  // NEW: public-facing bio
  bio?: string | null;

  // qualifications
  verifiedQualifications?: Qualification[];
  additionalQualifications?: Qualification[];

  photoUrl?: string | null;

  feeCents?: number | null;
  currency?: string | null;
  status?: string | null;
  meta?: any;
};

type ProfileForm = {
  fullName: string;
  displayName: string;
  dob: string;
  email: string;
  gender: string;
  hpcsaRegNo: string;

  phone: string;
  city: string;
  country: string;
  addressLine1: string;
  addressLine2: string;

  // practice & insurance
  practiceName: string;
  practiceNumber: string;
  regulatorBody: string;
  regulatorRegistration: string;
  acceptsMedicalAid: boolean;
  acceptedSchemesCsv: string;

  // NEW
  bio: string;
};

const IMMUTABLE_FIELDS: (keyof ProfileForm)[] = [
  'fullName',
  'displayName',
  'dob',
  'email',
  'gender',
  'hpcsaRegNo',
];

const API_ME = '/api/clinician/me';
const API_FEES = '/api/clinicians/me/fees';

const DEMO_PROFILE: ClinicianProfile = {
  id: 'clin-demo-001',
  userId: 'user-demo-001',
  fullName: 'Dr Demo Clinician',
  displayName: 'Dr Demo Clinician',
  dob: '1985-04-12',
  email: 'demo.clinician@example.com',
  gender: 'female',
  hpcsaRegNo: 'MP 1234567',
  phone: '+27 82 000 0000',
  city: 'Johannesburg',
  country: 'South Africa',
  addressLine1: '123 Demo Street',
  addressLine2: 'Sandton',

  // NEW demo defaults
  practiceName: 'Virtual practice',
  practiceNumber: '1234567-001',
  regulatorBody: 'HPCSA',
  regulatorRegistration: '',
  acceptsMedicalAid: false,
  acceptedSchemes: ['Discovery', 'Bonitas'],

  // NEW: demo bio
  bio: 'Virtual care clinician with a focus on primary care, chronic disease management and patient education.',

  verifiedQualifications: [
    {
      type: 'MBChB',
      institution: 'University of Cape Town',
      year: '2010',
    },
    {
      type: 'Short Course Contactless Medicine (CPD)',
      institution: 'Cloven Technology Institute',
      year: '2024-03-31', // mandatory onboarding training example
      notes: 'Ambulant+ Onboarding & Virtual Care Safety',
    },
  ],
  additionalQualifications: [],
  photoUrl: null,
  feeCents: 75000,
  currency: 'ZAR',
  status: 'pending',
  meta: {
    smartIdActive: false,
  },
};

function normalizeQualification(raw: any): Qualification {
  return {
    type:
      raw.type ??
      raw.degree ??
      raw.qualificationType ??
      raw.title ??
      'Qualification',
    institution:
      raw.institution ??
      raw.institutionName ??
      raw.organization ??
      raw.organisation ??
      raw.institutionOrOrganisation ??
      'Unknown institution',
    year: raw.year ?? raw.yearOfCompletion ?? raw.completionDate ?? '',
    notes: raw.notes ?? null,
  };
}

function mapRawProfile(raw: any): ClinicianProfile {
  if (!raw) return DEMO_PROFILE;

  // Try to pick up structured qualifications if backend provides them
  const vqSrc =
    raw.verifiedQualifications ??
    raw.profile?.qualifications ??
    raw.qualificationsVerified ??
    [];
  const aqSrc =
    raw.additionalQualifications ??
    raw.profile?.additionalQualifications ??
    raw.otherQualifications ??
    [];

  const verifiedQualifications: Qualification[] = Array.isArray(vqSrc)
    ? vqSrc.map(normalizeQualification)
    : [];

  const additionalQualifications: Qualification[] = Array.isArray(aqSrc)
    ? aqSrc.map(normalizeQualification)
    : [];

  return {
    id: String(raw.id ?? raw.clinicianId ?? 'clin-unknown'),
    userId: raw.userId ?? null,

    fullName: raw.fullName ?? raw.name ?? null,
    displayName:
      raw.displayName ??
      raw.preferredName ??
      raw.fullName ??
      raw.name ??
      null,
    dob: raw.dob ?? raw.dateOfBirth ?? raw.birthDate ?? null,
    email: raw.email ?? raw.contactEmail ?? null,
    gender: raw.gender ?? raw.sex ?? raw.profile?.gender ?? null,
    hpcsaRegNo:
      raw.hpcsaRegNo ??
      raw.registrationNumber ??
      raw.hpcsaNumber ??
      raw.hpcsa ??
      null,

    phone: raw.phone ?? raw.mobile ?? raw.cell ?? null,
    city: raw.city ?? raw.practiceCity ?? null,
    country: raw.country ?? raw.practiceCountry ?? 'South Africa',
    addressLine1:
      raw.addressLine1 ??
      raw.practiceAddressLine1 ??
      raw.practiceAddress ??
      null,
    addressLine2: raw.addressLine2 ?? raw.practiceAddressLine2 ?? null,

    practiceName: raw.practiceName ?? raw.meta?.practiceName ?? null,
    practiceNumber:
      raw.practiceNumber ??
      raw.practiceNo ??
      raw.meta?.practiceNumber ??
      null,
    regulatorBody:
      raw.regulatorBody ??
      raw.regBody ??
      raw.boardCertificateIssuer ??
      null,
    regulatorRegistration:
      raw.regulatorRegistration ?? raw.meta?.regulatorRegistration ?? null,
    acceptsMedicalAid:
      typeof raw.acceptsMedicalAid === 'boolean'
        ? raw.acceptsMedicalAid
        : raw.meta?.acceptsMedicalAid ?? false,
    acceptedSchemes: Array.isArray(raw.acceptedSchemes)
      ? raw.acceptedSchemes
      : Array.isArray(raw.meta?.acceptedSchemes)
      ? raw.meta.acceptedSchemes
      : [],

    // NEW
    bio: raw.bio ?? raw.profile?.bio ?? raw.meta?.bio ?? null,

    verifiedQualifications,
    additionalQualifications,

    photoUrl: raw.avatarUrl ?? raw.photoUrl ?? null,

    feeCents:
      typeof raw.feeCents === 'number'
        ? raw.feeCents
        : typeof raw.feeZar === 'number'
        ? Math.round(raw.feeZar * 100)
        : null,
    currency: raw.currency ?? 'ZAR',
    status: raw.status ?? null,
    meta: raw.meta ?? {},
  };
}

function profileToForm(p: ClinicianProfile): ProfileForm {
  return {
    fullName: p.fullName ?? '',
    displayName: p.displayName ?? '',
    dob: p.dob ? p.dob.slice(0, 10) : '',
    email: p.email ?? '',
    gender: p.gender ?? '',
    hpcsaRegNo: p.hpcsaRegNo ?? '',

    phone: p.phone ?? '',
    city: p.city ?? '',
    country: p.country ?? '',
    addressLine1: p.addressLine1 ?? '',
    addressLine2: p.addressLine2 ?? '',

    practiceName: p.practiceName ?? '',
    practiceNumber: p.practiceNumber ?? '',
    regulatorBody: p.regulatorBody ?? 'HPCSA',
    regulatorRegistration: p.regulatorRegistration ?? '',
    acceptsMedicalAid: !!p.acceptsMedicalAid,
    acceptedSchemesCsv: (p.acceptedSchemes ?? []).join(', '),

    bio: p.bio ?? '',
  };
}

type FeeSummary = {
  feeZar: number;
  currency: string;
};

const SETTINGS_TABS = [
  { href: '/settings/profile', label: 'Profile' },
  { href: '/settings/schedule', label: 'Schedule' },
  { href: '/settings/consult', label: 'Consult' },
  { href: '/settings/fees', label: 'Fees' },
  { href: '/payout', label: 'Payout & Plan' },
];

export default function ClinicianProfilePage() {
  const router = useRouter();
  const pathname = usePathname();

  const [profile, setProfile] = useState<ClinicianProfile | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [usingDemo, setUsingDemo] = useState(false);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [additionalQualifications, setAdditionalQualifications] = useState<
    Qualification[]
  >([]);
  const [feeSummary, setFeeSummary] = useState<FeeSummary | null>(null);

  // ---- bootstrap profile + fees ----
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setUsingDemo(false);

        const [meRes, feeRes] = await Promise.allSettled([
          fetch(API_ME, { cache: 'no-store' }),
          fetch(API_FEES, { cache: 'no-store' }),
        ]);

        // PROFILE
        if (meRes.status === 'fulfilled' && meRes.value.ok) {
          const js = await meRes.value.json().catch(() => ({} as any));
          const raw = js?.clinician ?? js?.profile ?? js?.data ?? js;
          const mapped = mapRawProfile(raw);
          if (!cancelled) {
            setProfile(mapped);
            setForm(profileToForm(mapped));
            setAdditionalQualifications(mapped.additionalQualifications ?? []);
          }
        } else {
          console.warn('[profile] /api/clinician/me failed, using demo');
          if (!cancelled) {
            setProfile(DEMO_PROFILE);
            setForm(profileToForm(DEMO_PROFILE));
            setAdditionalQualifications(
              DEMO_PROFILE.additionalQualifications ?? [],
            );
            setUsingDemo(true);
            toast(
              "Using demo clinician profile (API gateway not reachable or /api/clinician/me not implemented yet).",
              'info',
            );
          }
        }

        // FEES
        if (feeRes.status === 'fulfilled' && feeRes.value.ok) {
          const js = await feeRes.value.json().catch(() => ({} as any));
          const cents = Number(js.fee_cents ?? 0);
          const currency = js.currency || 'ZAR';
          if (!cancelled) {
            setFeeSummary({
              feeZar: cents / 100,
              currency,
            });
          }
        } else {
          console.warn(
            '[profile] /api/clinicians/me/fees not available; fees section will be blank',
          );
        }
      } catch (err) {
        console.error('[profile] bootstrap failed', err);
        if (!cancelled) {
          setProfile(DEMO_PROFILE);
          setForm(profileToForm(DEMO_PROFILE));
          setAdditionalQualifications(
            DEMO_PROFILE.additionalQualifications ?? [],
          );
          setUsingDemo(true);
          toast(
            'Using demo clinician profile (API gateway not reachable).',
            'info',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange =
    (field: keyof ProfileForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!form) return;
      if (IMMUTABLE_FIELDS.includes(field)) return; // identity locked
      setForm({ ...form, [field]: e.target.value as any });
    };

  // helper for checkboxes
  const handleBoolChange =
    (field: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!form) return;
      setForm({ ...form, [field]: e.target.checked as any });
    };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!form || !profile) return;

    setSaving(true);

    const payload: any = {
      phone: form.phone.trim() || null,
      city: form.city.trim() || null,
      country: form.country.trim() || null,
      addressLine1: form.addressLine1.trim() || null,
      addressLine2: form.addressLine2.trim() || null,
      additionalQualifications,

      practiceName: form.practiceName.trim() || null,
      practiceNumber: form.practiceNumber.trim() || null,
      regulatorBody: form.regulatorBody.trim() || null,
      regulatorRegistration: form.regulatorRegistration.trim() || null,
      acceptsMedicalAid: !!form.acceptsMedicalAid,
      acceptedSchemes: form.acceptedSchemesCsv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),

      // NEW
      bio: form.bio.trim() || null,
    };

    try {
      const res = await fetch(API_ME, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const js = await res.json().catch(() => null);
      const updatedRaw = js?.clinician ?? js?.profile ?? js?.data ?? js ?? {};
      const merged = {
        ...mapRawProfile(profile),
        ...mapRawProfile({ ...profile, ...updatedRaw }),
      };

      setProfile(merged);
      setForm(profileToForm(merged));
      setAdditionalQualifications(
        merged.additionalQualifications ?? additionalQualifications,
      );
      setUsingDemo(false);
      toast('Profile updated.', 'success');
    } catch (err) {
      console.error('[profile] save failed', err);
      toast(
        'Failed to save profile. Check that /api/clinician/me (PATCH) is implemented.',
        'error',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast('Please choose an image file.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/clinicians/me/avatar', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const js = await res.json().catch(() => null);
      const url = js?.url || js?.avatarUrl || js?.photoUrl || null;

      if (url && profile) {
        setProfile({ ...profile, photoUrl: url });
        toast('Profile picture updated.', 'success');
      } else {
        toast(
          'Avatar uploaded, but no URL returned – check the API response.',
          'warning',
        );
      }
    } catch (err) {
      console.error('[profile] avatar upload failed', err);
      toast(
        'Failed to upload profile picture. Implement /api/clinicians/me/avatar on the API gateway.',
        'error',
      );
    } finally {
      setAvatarUploading(false);
    }
  };

  const addAdditionalQualification = () => {
    setAdditionalQualifications((prev) => [
      ...prev,
      { type: '', institution: '', year: '' },
    ]);
  };

  const updateAdditionalQualification = (
    idx: number,
    patch: Partial<Qualification>,
  ) => {
    setAdditionalQualifications((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)),
    );
  };

  const removeAdditionalQualification = (idx: number) => {
    setAdditionalQualifications((prev) => prev.filter((_, i) => i !== idx));
  };

  const downloadSmartId = async (
    side: 'front' | 'back',
    format: 'png' | 'pdf' = 'png',
  ) => {
    const current = profile;
    if (!current?.id) return;
    try {
      const url = `/api/clinicians/${encodeURIComponent(
        current.id,
      )}/id-card?side=${side}&format=${format}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `clinician-${current.id}-smart-id-${side}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      toast(
        `Downloaded ${side} of Smart ID as ${format.toUpperCase()}.`,
        'success',
      );
    } catch (err) {
      console.error('[profile] smart-id png download failed', err);
      toast(
        'Failed to generate Smart ID image. Check the /api/clinicians/:id/id-card endpoint.',
        'error',
      );
    }
  };

  const openSmartId = async (side: 'front' | 'back') => {
    const current = profile;
    if (!current?.id) return;
    const url = `/api/clinicians/${encodeURIComponent(
      current.id,
    )}/id-card?side=${side}&format=png`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const current = profile;
  const hasActiveSmartId = !!(
    current &&
    current.meta &&
    current.meta.smartIdActive
  );

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Tabs across settings sections */}
      <nav className="border-b border-gray-200 mb-2 flex flex-wrap gap-2">
        {SETTINGS_TABS.map((tab) => {
          const active =
            pathname === tab.href ||
            (tab.href === '/settings/profile' &&
              (pathname === '/settings' ||
                pathname === '/settings/profile'));
          return (
            <button
              key={tab.href}
              type="button"
              onClick={() => router.push(tab.href)}
              className={
                'px-3 py-2 text-xs font-medium border-b-2 -mb-px transition ' +
                (active
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-black hover:border-gray-300')
              }
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Clinician Profile
          </h1>
          <p className="text-sm text-gray-500">
            Core identity, gender and verified qualifications are locked once
            onboarding is approved. You can still update contact details,
            practice/insurance info, and add new qualifications.
          </p>
        </div>

        {current && (
          <div className="flex flex-col items-end gap-1 text-xs text-gray-600">
            <span className="font-mono text-[11px]">ID: {current.id}</span>
            <span className="inline-flex items-center gap-1">
              <span
                className={`h-2 w-2 rounded-full ${
                  current.status === 'active'
                    ? 'bg-emerald-500'
                    : current.status === 'pending'
                    ? 'bg-amber-500'
                    : current.status === 'disabled'
                    ? 'bg-red-500'
                    : current.status === 'disciplinary'
                    ? 'bg-amber-600'
                    : 'bg-gray-400'
                }`}
              />
              <span className="capitalize">{current.status || 'unknown'}</span>
            </span>
          </div>
        )}
      </header>

      {current && !loading && (
        <>
          {current.status === 'disabled' && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              <div className="font-semibold text-[13px]">
                Your profile is currently <span className="lowercase">disabled</span>.
              </div>
              <div className="mt-0.5">
                Patients cannot see or book you on Ambulant+ while your profile
                is disabled. Please contact an admin if you believe this is an
                error or need more information.
              </div>
            </div>
          )}

          {current.status === 'disciplinary' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <div className="font-semibold text-[13px]">
                Your profile is under disciplinary review.
              </div>
              <div className="mt-0.5">
                Admin are currently reviewing your account. Some features or
                visibility may be limited depending on the outcome of the
                review.
              </div>
            </div>
          )}
        </>
      )}

      {usingDemo && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Showing a demo clinician profile because the API gateway is not running
          or <code className="font-mono">{API_ME}</code> doesn&apos;t exist yet.
          Once you wire that up, this page will load real data.
        </div>
      )}

      {loading && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2 h-56 rounded-lg bg-gray-100 animate-pulse" />
          <div className="h-56 rounded-lg bg-gray-100 animate-pulse" />
        </div>
      )}

      {!loading && current && form && (
        <form
          onSubmit={handleSave}
          className="grid gap-4 md:grid-cols-3 items-start"
        >
          {/* LEFT: identity + editable details + qualifications */}
          <section className="md:col-span-2 space-y-4">
            {/* Identity (locked) */}
            <div className="rounded-lg border bg-white p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">
                    Identity (locked)
                  </h2>
                  <p className="text-xs text-gray-500">
                    For legal, fraud prevention and HPCSA compliance. To change
                    these fields, contact an admin.
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                  Locked by admin
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs text-gray-700 flex flex-col gap-1">
                  Full name (legal)
                  <input
                    type="text"
                    className="border rounded px-2 py-1.5 text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
                    value={form.fullName}
                    disabled
                    readOnly
                  />
                </label>

                <label className="text-xs text-gray-700 flex flex-col gap-1">
                  Display name
                  <input
                    type="text"
                    className="border rounded px-2 py-1.5 text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
                    value={form.displayName}
                    disabled
                    readOnly
                  />
                </label>

                <label className="text-xs text-gray-700 flex flex-col gap-1">
                  Email
                  <input
                    type="email"
                    className="border rounded px-2 py-1.5 text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
                    value={form.email}
                    disabled
                    readOnly
                  />
                </label>

                <label className="text-xs text-gray-700 flex flex-col gap-1">
                  Date of birth
                  <input
                    type="date"
                    className="border rounded px-2 py-1.5 text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
                    value={form.dob}
                    disabled
                    readOnly
                  />
                </label>

                <label className="text-xs text-gray-700 flex flex-col gap-1">
                  Gender
                  <input
                    type="text"
                    className="border rounded px-2 py-1.5 text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
                    value={form.gender}
                    disabled
                    readOnly
                  />
                </label>

                <label className="text-xs text-gray-700 flex flex-col gap-1">
                  HPCSA / registration number
                  <input
                    type="text"
                    className="border rounded px-2 py-1.5 text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
                    value={form.hpcsaRegNo}
                    disabled
                    readOnly
                  />
                </label>
              </div>

              <p className="text-[11px] text-gray-500">
                Need to update these? Ask an Ambulant+ admin to change your
                onboarding details in the admin dashboard after verifying your
                documents.
              </p>
            </div>

            {/* Contact & practice details (editable) */}
            <div className="rounded-lg border bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">
                  Contact &amp; practice details
                </h2>
                <span className="text-[11px] text-gray-500">
                  Editable by you
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs text-gray-700 flex flex-col gap-1">
                  Mobile number
                  <input
                    type="tel"
                    className="border rounded px-2 py-1.5 text-sm"
                    value={form.phone}
                    onChange={handleChange('phone')}
                    placeholder="+27 ..."
                  />
                </label>

                <label className="text-xs text-gray-700 flex flex-col gap-1">
                  City
                  <input
                    type="text"
                    className="border rounded px-2 py-1.5 text-sm"
                    value={form.city}
                    onChange={handleChange('city')}
                    placeholder="Johannesburg"
                  />
                </label>

                <label className="text-xs text-gray-700 flex flex-col gap-1">
                  Country
                  <input
                    type="text"
                    className="border rounded px-2 py-1.5 text-sm"
                    value={form.country}
                    onChange={handleChange('country')}
                    placeholder="South Africa"
                  />
                </label>
              </div>

              <label className="text-xs text-gray-700 flex flex-col gap-1">
                Address line 1
                <input
                  type="text"
                  className="border rounded px-2 py-1.5 text-sm"
                  value={form.addressLine1}
                  onChange={handleChange('addressLine1')}
                  placeholder="Street, building"
                />
              </label>

              <label className="text-xs text-gray-700 flex flex-col gap-1">
                Address line 2 (optional)
                <input
                  type="text"
                  className="border rounded px-2 py-1.5 text-sm"
                  value={form.addressLine2}
                  onChange={handleChange('addressLine2')}
                  placeholder="Suburb / area"
                />
              </label>
            </div>

            {/* Public bio (editable) */}
            <div className="rounded-lg border bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">
                  Public bio
                </h2>
                <span className="text-[11px] text-gray-500">
                  Shown on your clinician card &amp; profile
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Write a short intro for patients. Avoid personal identifiers
                (e.g. ID numbers, home address) or direct contact details – those
                are handled by Ambulant+.
              </p>
              <textarea
                className="border rounded px-2 py-1.5 text-sm w-full"
                rows={4}
                value={form.bio}
                onChange={handleChange('bio')}
                placeholder="Example: I am a GP with experience in chronic disease management and women’s health. I focus on clear communication and shared decision-making with my patients."
              />
              <div className="text-[11px] text-gray-500 space-y-1">
                <div className="font-medium">Suggestions:</div>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Mention your experience and main areas of interest.</li>
                  <li>
                    Explain how you like to work with patients (e.g. education,
                    prevention).
                  </li>
                  <li>Keep it friendly, clear and non-technical.</li>
                </ul>
              </div>
            </div>

            {/* Practice & insurance participation */}
            <div className="rounded-lg border bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">
                  Practice &amp; insurance
                </h2>
              <span className="text-[11px] text-gray-500">
                  Used on claims, letters &amp; Smart ID back
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs text-gray-700 flex flex-col gap-1">
                  Practice name (optional)
                  <input
                    type="text"
                    className="border rounded px-2 py-1.5 text-sm"
                    value={form.practiceName}
                    onChange={handleChange('practiceName')}
                    placeholder="e.g. Dr N. Zuma Inc."
                  />
                </label>

                <label className="text-xs text-gray-700 flex flex-col gap-1">
                  Practice / BHF number
                  <input
                    type="text"
                    className="border rounded px-2 py-1.5 text-sm"
                    value={form.practiceNumber}
                    onChange={handleChange('practiceNumber')}
                    placeholder="e.g. 1234567 / 1234567-001"
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs text-gray-700 flex flex-col gap-1">
                  Regulator / board
                  <input
                    type="text"
                    className="border rounded px-2 py-1.5 text-sm"
                    value={form.regulatorBody}
                    onChange={handleChange('regulatorBody')}
                    placeholder="HPCSA, AHPCSA…"
                  />
                </label>

                <label className="text-xs text-gray-700 flex flex-col gap-1">
                  Regulator registration (optional)
                  <input
                    type="text"
                    className="border rounded px-2 py-1.5 text-sm"
                    value={form.regulatorRegistration}
                    onChange={handleChange('regulatorRegistration')}
                    placeholder="Additional registration ID"
                  />
                </label>
              </div>

              <div className="flex flex-col gap-2">
                <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.acceptsMedicalAid}
                    onChange={handleBoolChange('acceptsMedicalAid')}
                  />
                  I accept eligible medical aid / insurance claims on Ambulant+.
                </label>
                <label className="text-xs text-gray-700 flex flex-col gap-1">
                  Schemes / insurers I accept
                  <input
                    type="text"
                    className="border rounded px-2 py-1.5 text-sm"
                    value={form.acceptedSchemesCsv}
                    onChange={handleChange('acceptedSchemesCsv')}
                    placeholder="Discovery, Bonitas, Momentum… (comma-separated)"
                  />
                </label>
                <p className="text-[11px] text-gray-500">
                  This helps Ambulant+ route medical aid claims correctly. Admin
                  may still override participation settings in the admin
                  dashboard.
                </p>
              </div>
            </div>

            {/* Qualifications */}
            <div className="rounded-lg border bg-white p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">
                  Qualifications
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Verified (read-only, includes onboarding training) */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-xs text-gray-800">
                      Verified at onboarding
                    </h3>
                    <span className="text-[10px] uppercase tracking-wide border rounded-full px-2 py-0.5 bg-gray-50 text-gray-600">
                      Read-only
                    </span>
                  </div>
                  {(!current.verifiedQualifications ||
                    current.verifiedQualifications.length === 0) && (
                    <p className="text-xs text-gray-500">
                      No verified qualifications recorded yet.
                    </p>
                  )}
                  <ul className="space-y-1 text-xs">
                    {(current.verifiedQualifications ?? []).map((q, i) => (
                      <li key={i} className="border rounded px-2 py-1 bg-gray-50">
                        <div className="font-medium">{q.type}</div>
                        <div className="text-gray-600">
                          {q.institution} {q.year ? `• ${q.year}` : ''}
                        </div>
                        {q.notes && (
                          <div className="text-[11px] text-gray-500">
                            {q.notes}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-gray-500">
                    This includes degrees, diplomas and mandatory onboarding
                    training (e.g. <em>Short Course (CPD), Cloven Technology
                    Institute</em>). Admin adds these after document and training
                    verification.
                  </p>
                </div>

                {/* Additional (clinician can add) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-xs text-gray-800">
                      Additional qualifications
                    </h3>
                    <button
                      type="button"
                      onClick={addAdditionalQualification}
                      className="text-[11px] text-indigo-700 border px-2 py-1 rounded hover:bg-indigo-50"
                    >
                      + Add
                    </button>
                  </div>
                  {additionalQualifications.length === 0 && (
                    <p className="text-xs text-gray-500 mb-2">
                      Add new awards or courses obtained after your initial
                      verification. Use the correct type (e.g. MBChB, MSc, Short
                      Course (CPD)).
                    </p>
                  )}
                  <div className="space-y-2">
                    {additionalQualifications.map((q, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end border rounded px-2 py-2"
                      >
                        <label className="text-[11px] text-gray-700 flex flex-col gap-1">
                          Qualification Type
                          <input
                            type="text"
                            className="border rounded px-2 py-1 text-xs"
                            value={q.type}
                            onChange={(e) =>
                              updateAdditionalQualification(idx, {
                                type: e.target.value,
                              })
                            }
                            placeholder="MBChB, MSc, Short Course (CPD)…"
                          />
                        </label>
                        <label className="text-[11px] text-gray-700 flex flex-col gap-1">
                          Institution / Organisation
                          <input
                            type="text"
                            className="border rounded px-2 py-1 text-xs"
                            value={q.institution}
                            onChange={(e) =>
                              updateAdditionalQualification(idx, {
                                institution: e.target.value,
                              })
                            }
                            placeholder="e.g. Wits, Cloven Technology Institute"
                          />
                        </label>
                        <div className="flex gap-2 items-end">
                          <label className="text-[11px] text-gray-700 flex flex-col gap-1 flex-1">
                            Year / completion date
                            <input
                              type="text"
                              className="border rounded px-2 py-1 text-xs"
                              value={q.year}
                              onChange={(e) =>
                                updateAdditionalQualification(idx, {
                                  year: e.target.value,
                                })
                              }
                              placeholder="2025 or 2025-03-31"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => removeAdditionalQualification(idx)}
                            className="text-[11px] text-rose-600 border border-rose-300 rounded px-2 py-1 h-8"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Save */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 rounded-full bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </section>

          {/* RIGHT: avatar + fees + Smart ID */}
          <section className="space-y-4">
            {/* Avatar */}
            <div className="rounded-lg border bg-white p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-800">
                Profile picture
              </h2>
              <p className="text-xs text-gray-500">
                This appears on your Smart ID (if present) and in internal tools.
                Square images work best.
              </p>

              <div className="flex items-center gap-3">
                <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                  {avatarPreview || current.photoUrl ? (
                    <img
                      src={avatarPreview || current.photoUrl || ''}
                      alt="Clinician avatar"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-gray-400">No photo</span>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs">
                    <span className="sr-only">Upload avatar</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="text-xs"
                    />
                  </label>
                  <span className="text-[11px] text-gray-500">
                    JPG or PNG, &lt; 5MB.
                  </span>
                </div>
              </div>

              {avatarUploading && (
                <div className="text-[11px] text-gray-500">Uploading…</div>
              )}
            </div>

            {/* Fees (read-only) */}
            <div className="rounded-lg border bg-white p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">
                  Consultation fees
                </h2>
                <button
                  type="button"
                  onClick={() => router.push('/settings/fees')}
                  className="text-[11px] underline"
                >
                  Edit in Fees
                </button>
              </div>
              {feeSummary ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-gray-600">Standard consult:</span>
                  <span className="text-sm font-semibold">
                    {feeSummary.currency} {feeSummary.feeZar.toFixed(2)}
                  </span>
                </div>
              ) : (
                <p className="text-gray-500">
                  Fees not loaded from backend. Configure them in Settings → Fees.
                </p>
              )}
              <p className="text-[11px] text-gray-500">
                Fees are stored centrally and used across booking, payouts and
                admin dashboards.
              </p>
            </div>

            {/* Smart ID */}
            <SmartIdCard
              clinicianId={current.id}
              hasActiveSmartId={hasActiveSmartId}
            />

            <div className="rounded-lg border bg-white p-4 space-y-2 text-xs">
              <h2 className="text-sm font-semibold text-gray-800">
                Digital Smart ID (PNG)
              </h2>
              <p className="text-[11px] text-gray-500">
                View or download your Smart ID as a PNG image for digital use
                (e.g. profiles, HR). Physical cards are printed and dispatched by
                admin.
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => openSmartId('front')}
                  className="px-3 py-1.5 rounded-full border text-[11px] bg-white hover:bg-gray-50"
                >
                  View front (PNG)
                </button>
                <button
                  type="button"
                  onClick={() => openSmartId('back')}
                  className="px-3 py-1.5 rounded-full border text-[11px] bg-white hover:bg-gray-50"
                >
                  View back (PNG)
                </button>
                <button
                  type="button"
                  onClick={() => downloadSmartId('front', 'png')}
                  className="px-3 py-1.5 rounded-full border text-[11px] bg-white hover:bg-gray-50"
                >
                  Download front PNG
                </button>
                <button
                  type="button"
                  onClick={() => downloadSmartId('back', 'png')}
                  className="px-3 py-1.5 rounded-full border text-[11px] bg-white hover:bg-gray-50"
                >
                  Download back PNG
                </button>
              </div>
            </div>

            {/* Source info */}
            <div className="border rounded-lg bg-white p-3 text-xs text-gray-600 space-y-1">
              <div className="font-semibold text-gray-800">Profile source</div>
              <div>
                {usingDemo ? (
                  <>
                    Demo mode – not connected to the API gateway. Start your{' '}
                    <code className="font-mono">apps/api-gateway</code> service
                    and implement <code className="font-mono">GET/PATCH {API_ME}</code>{' '}
                    &amp; <code className="font-mono">GET {API_FEES}</code> to load
                    real data.
                  </>
                ) : (
                  <>Loaded from backend ({API_ME}).</>
                )}
              </div>
              <div className="mt-1 text-[11px] text-gray-500">
                Fees are edited in{' '}
                <button
                  type="button"
                  onClick={() => router.push('/settings/fees')}
                  className="underline"
                >
                  Settings → Fees
                </button>
                . Availability &amp; calendar live in{' '}
                <button
                  type="button"
                  onClick={() => router.push('/settings/schedule')}
                  className="underline"
                >
                  Settings → Schedule
                </button>
                . Payouts &amp; plan live under{' '}
                <button
                  type="button"
                  onClick={() => router.push('/payout')}
                  className="underline"
                >
                  Payout &amp; Plan
                </button>
                .
              </div>
            </div>
          </section>
        </form>
      )}
    </main>
  );
}
