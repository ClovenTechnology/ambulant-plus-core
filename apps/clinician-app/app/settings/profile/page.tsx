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

const API_ME = '/api/profile';
const API_FEES = '/api/clinicians/me/fees';
const API_TRAINING_CONTEXT = '/api/training/context';

type TrainingCertificate = {
  available: boolean;
  certificateNumber: string | null;
  completedAt: string | null;
  institution: string | null;
};

function clinicianIdFromUrl() {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('clinicianId') || '';
}

function withClinicianId(path: string, clinicianId?: string | null) {
  const resolved = clinicianId || clinicianIdFromUrl();
  if (!resolved) return path;
  const sep = path.includes('?') ? '&' : '?';
  return path + sep + 'clinicianId=' + encodeURIComponent(resolved);
}

async function resolveCurrentClinicianId(): Promise<string> {
  const fromUrl = clinicianIdFromUrl();
  if (fromUrl) return fromUrl;

  const res = await fetch('/api/me', { cache: 'no-store' });
  const js = await res.json().catch(() => null);

  if (!res.ok || !js?.clinicianId) {
    throw new Error('Profile could not resolve the current clinician. Please reopen from your clinician workspace or sign in again.');
  }

  return String(js.clinicianId);
}

function certificateDownloadHref(clinicianId: string) {
  return '/api/training/certificate?clinicianId=' + encodeURIComponent(clinicianId) + '&download=1';
}

function emptyProfile(): ClinicianProfile {
  return {
    id: '',
    fullName: null,
    displayName: null,
    dob: null,
    email: null,
    gender: null,
    hpcsaRegNo: null,
    phone: null,
    city: null,
    country: 'South Africa',
    addressLine1: null,
    addressLine2: null,
    practiceName: null,
    practiceNumber: null,
    regulatorBody: 'HPCSA',
    regulatorRegistration: null,
    acceptsMedicalAid: false,
    acceptedSchemes: [],
    bio: null,
    verifiedQualifications: [],
    additionalQualifications: [],
    photoUrl: null,
    feeCents: null,
    currency: 'ZAR',
    status: null,
    meta: {},
  };
}

function profileApiToRaw(js: any): any {
  if (!js) return null;

  if (js.ok && (js.clinicianId || js.profile)) {
    const p = js.profile || {};

    return {
      id: js.clinicianId,
      clinicianId: js.clinicianId,
      userId: js.userId ?? null,
      fullName: js.displayName ?? null,
      displayName: js.displayName ?? null,
      name: js.displayName ?? null,
      email: p.email ?? js.email ?? js.userId ?? null,
      status: js.status ?? null,
      specialty: js.specialty ?? null,

      dob: p.dob ?? null,
      gender: p.gender ?? null,
      hpcsaRegNo:
        p.hpcsaRegNo ??
        p.hpcsaNumber ??
        p.registrationNumber ??
        p.regulatorRegistration ??
        null,

      phone: p.phone ?? null,
      city: p.city ?? null,
      country: p.country ?? 'South Africa',
      addressLine1: p.addressLine1 ?? p.address ?? null,
      addressLine2: p.addressLine2 ?? null,

      practiceName: p.practiceName ?? null,
      practiceNumber:
        p.practiceNumber ??
        p.practiceNo ??
        p.bhfNumber ??
        p.hpcsaPracticeNumber ??
        null,
      regulatorBody: p.regulatorBody ?? 'HPCSA',
      regulatorRegistration: p.regulatorRegistration ?? null,
      acceptsMedicalAid:
        typeof p.acceptsMedicalAid === 'boolean'
          ? p.acceptsMedicalAid
          : typeof p.hasInsurance === 'boolean'
          ? p.hasInsurance
          : false,
      acceptedSchemes: Array.isArray(p.acceptedSchemes) ? p.acceptedSchemes : [],
      bio: p.bio ?? null,

      verifiedQualifications: Array.isArray(p.qualifications) ? p.qualifications : [],
      additionalQualifications: Array.isArray(p.additionalQualifications)
        ? p.additionalQualifications
        : [],

      photoUrl: p.avatarDataUrl ?? p.photoUrl ?? null,
      feeCents: typeof p.feeCents === 'number' ? p.feeCents : null,
      currency: p.currency ?? 'ZAR',
      meta: { profile: p },
    };
  }

  return js?.clinician ?? js?.profile ?? js?.data ?? js;
}

function trainingCertificateFromContext(js: any): TrainingCertificate | null {
  const training = js?.training || {};
  const available = !!training.certificateAvailable;
  const certificateNumber = training.certificateNumber || training.certificateId || null;
  const completedAt = training.certificateCompletedAt || training.completedAt || null;
  const institution = training.certificateInstitution || training.institution || null;

  if (!available && !certificateNumber) return null;

  return {
    available,
    certificateNumber,
    completedAt,
    institution,
  };
}

function formatDateTimeMaybe(value: string | null | undefined) {
  if (!value) return 'Not recorded';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function smartIdReadiness(profile: ClinicianProfile, certificate: TrainingCertificate | null) {
  const hasCertificate = !!(certificate?.available && certificate.certificateNumber);
  const hasAvatar = !!profile.photoUrl;

  return {
    ready: hasCertificate && hasAvatar,
    hasCertificate,
    hasAvatar,
    reason: !hasCertificate
      ? 'Training certificate is not ready yet.'
      : !hasAvatar
      ? 'Upload your profile photo to unlock Smart ID download and print.'
      : null,
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read avatar image.'));
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
      reject(new Error('Could not load avatar image.'));
    };

    img.src = objectUrl;
  });
}

async function prepareAvatarForUpload(file: File): Promise<{ file: File; previewUrl: string }> {
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
    throw new Error('Avatar image processing is not available in this browser.');
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
    throw new Error('Could not prepare avatar image.');
  }

  if (blob.size > maxBytes) {
    throw new Error('Avatar image is still too large after compression. Please choose a smaller square portrait.');
  }

  const compressed = new File([blob], 'avatar.jpg', {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });

  const previewUrl = await blobToDataUrl(blob);

  return { file: compressed, previewUrl };
}

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
  if (!raw) return emptyProfile();

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
  const [profileError, setProfileError] = useState<string | null>(null);
  const [trainingCertificate, setTrainingCertificate] = useState<TrainingCertificate | null>(null);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [additionalQualifications, setAdditionalQualifications] = useState<
    Qualification[]
  >([]);
  const [feeSummary, setFeeSummary] = useState<FeeSummary | null>(null);

  // ---- bootstrap profile + fees + training certificate ----
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setProfileError(null);

        const activeClinicianId = await resolveCurrentClinicianId();

        const [meRes, feeRes, trainingRes] = await Promise.allSettled([
          fetch(withClinicianId(API_ME, activeClinicianId), { cache: 'no-store' }),
          fetch(withClinicianId(API_FEES, activeClinicianId), { cache: 'no-store' }),
          fetch(withClinicianId(API_TRAINING_CONTEXT, activeClinicianId), { cache: 'no-store' }),
        ]);

        if (meRes.status !== 'fulfilled' || !meRes.value.ok) {
          const status =
            meRes.status === 'fulfilled' ? 'HTTP ' + meRes.value.status : 'request failed';
          throw new Error('Profile could not be loaded from /api/profile (' + status + ').');
        }

        const meJson = await meRes.value.json().catch(() => ({} as any));
        const mapped = mapRawProfile(profileApiToRaw(meJson));

        if (!mapped.id) {
          throw new Error('Profile response did not include a clinician ID.');
        }

        if (!cancelled) {
          setProfile(mapped);
          setForm(profileToForm(mapped));
          setAdditionalQualifications(mapped.additionalQualifications ?? []);
        }

        if (feeRes.status === 'fulfilled' && feeRes.value.ok) {
          const js = await feeRes.value.json().catch(() => ({} as any));
          const cents = Number(js.fee_cents ?? js.feeCents ?? 0);
          const currency = js.currency || 'ZAR';
          if (!cancelled && cents > 0) {
            setFeeSummary({
              feeZar: cents / 100,
              currency,
            });
          }
        } else if (!cancelled) {
          setFeeSummary(null);
        }

        if (trainingRes.status === 'fulfilled' && trainingRes.value.ok) {
          const js = await trainingRes.value.json().catch(() => ({} as any));
          if (!cancelled) {
            setTrainingCertificate(trainingCertificateFromContext(js));
          }
        } else if (!cancelled) {
          setTrainingCertificate(null);
        }
      } catch (err: any) {
        console.error('[profile] bootstrap failed', err);
        if (!cancelled) {
          setProfile(null);
          setForm(null);
          setAdditionalQualifications([]);
          setTrainingCertificate(null);
          const message = err?.message || 'Profile could not be loaded.';
          setProfileError(message);
          toast(message, 'error');
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
      const res = await fetch(withClinicianId(API_ME, profile.id), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const js = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(js?.error || js?.message || `HTTP ${res.status}`);
      }
      const updatedRaw = profileApiToRaw(js) ?? {};
      const merged = {
        ...mapRawProfile(profile),
        ...mapRawProfile({ ...profile, ...updatedRaw }),
      };

      setProfile(merged);
      setForm(profileToForm(merged));
      setAdditionalQualifications(
        merged.additionalQualifications ?? additionalQualifications,
      );
      toast('Profile updated.', 'success');
    } catch (err) {
      console.error('[profile] save failed', err);
      toast(
        'Failed to save profile. Please try again or contact support if the problem persists.',
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

    setAvatarUploading(true);
    try {
      const prepared = await prepareAvatarForUpload(file);
      setAvatarPreview(prepared.previewUrl);

      const formData = new FormData();
      formData.append('payload', JSON.stringify({}));
      formData.append('avatar', prepared.file);

      const res = await fetch(withClinicianId(API_ME, profile?.id), {
        method: 'PUT',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const js = await res.json().catch(() => null);
      const updatedRaw = profileApiToRaw(js);
      const updated = mapRawProfile({ ...profile, ...updatedRaw });
      const url = updated.photoUrl;

      if (url && profile) {
        setProfile(updated);
        setForm(profileToForm(updated));
        setAvatarPreview(url);
        toast('Profile picture updated.', 'success');
      } else {
        toast(
          'Avatar uploaded, but no image was returned from the profile API.',
          'warning',
        );
      }
    } catch (err: any) {
      console.error('[profile] avatar upload failed', err);
      toast(
        err?.message || 'Failed to upload profile picture. Please try again or contact support if the problem persists.',
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
    format: 'svg' | 'pdf' = 'svg',
  ) => {
    const current = profile;
    if (!current?.id) return;

    const readiness = smartIdReadiness(current, trainingCertificate);
    if (!readiness.ready) {
      toast(readiness.reason || 'Smart ID is not ready yet.', 'warning');
      return;
    }

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
        'Failed to generate Smart ID. Please try again or contact support if the problem persists.',
        'error',
      );
    }
  };

  const openSmartId = async (side: 'front' | 'back') => {
    const current = profile;
    if (!current?.id) return;

    const readiness = smartIdReadiness(current, trainingCertificate);
    if (!readiness.ready) {
      toast(readiness.reason || 'Smart ID is not ready yet.', 'warning');
      return;
    }

    const url = `/api/clinicians/${encodeURIComponent(
      current.id,
    )}/id-card?side=${side}&format=svg`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const current = profile;
  const hasActiveSmartId = !!(
    current &&
    current.meta &&
    current.meta.smartIdActive
  );

  const smartIdStatus = current ? smartIdReadiness(current, trainingCertificate) : null;

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

      {profileError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {profileError}
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

            {/* Training certificate */}
            <div className="rounded-lg border bg-white p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-gray-800">
                  Training certificate
                </h2>

                {trainingCertificate?.available && (
                  <a
                    href={certificateDownloadHref(current.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] underline"
                  >
                    Download PDF
                  </a>
                )}
              </div>

              {trainingCertificate ? (
                <div className="space-y-1">
                  <div>
                    <span className="text-gray-600">Status:</span>{' '}
                    <span className="font-semibold text-emerald-700">
                      {trainingCertificate.available ? 'Issued' : 'Recorded'}
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-600">Certificate ID:</span>{' '}
                    <span className="font-mono">
                      {trainingCertificate.certificateNumber || 'Not recorded'}
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-600">Completed:</span>{' '}
                    {formatDateTimeMaybe(trainingCertificate.completedAt)}
                  </div>

                  <div>
                    <span className="text-gray-600">Issuer:</span>{' '}
                    {trainingCertificate.institution || 'Ambulant+ / Cloven Technology'}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">
                  No issued training certificate is currently linked to this profile.
                </p>
              )}

              <p className="text-[11px] text-gray-500">
                Completion unlocks simulation mode only. Real patient visibility still requires final operational approval.
              </p>
            </div>

            {/* Smart ID */}
            <SmartIdCard
              clinicianId={current.id}
              hasActiveSmartId={hasActiveSmartId}
            />

            <div className="rounded-lg border bg-white p-4 space-y-2 text-xs">
              <h2 className="text-sm font-semibold text-gray-800">
                ,
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
                  , (PNG)
                </button>
                <button
                  type="button"
                  onClick={() => openSmartId('back')}
                  className="px-3 py-1.5 rounded-full border text-[11px] bg-white hover:bg-gray-50"
                >
                  , (PNG)
                </button>
                <button
                  type="button"
                  onClick={() => downloadSmartId('front', 'svg')}
                  className="px-3 py-1.5 rounded-full border text-[11px] bg-white hover:bg-gray-50"
                >
                  Download front SVG
                </button>
                <button
                  type="button"
                  onClick={() => downloadSmartId('back', 'svg')}
                  className="px-3 py-1.5 rounded-full border text-[11px] bg-white hover:bg-gray-50"
                >
                  Download back SVG
                </button>
              </div>
            </div>

            {/* Source info */}
            <div className="border rounded-lg bg-white p-3 text-xs text-gray-600 space-y-1">
              <div className="font-semibold text-gray-800">Profile source</div>
              <div>Loaded from backend ({API_ME}).</div>
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
