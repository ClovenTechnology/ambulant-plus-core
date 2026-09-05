// apps/patient-app/app/clinicians/[id]/page.tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

// ===== TYPES =====
type Qualification = {
  type?: string;
  degree?: string;
  title?: string;
  institution?: string;
  year?: string;
  yearOfCompletion?: string;
  notes?: string | null;
  certificateNumber?: string | null;
};

type RefundPolicy = {
  within24hPercent: number;
  noShowPercent: number;
  clinicianMissPercent: number;
  networkProrate: boolean;
};

type FeeProfile = {
  priceCents: number;
  currency: string;
  durationMin: number;
  bufferMin: number;
};

type Testimonial = {
  id?: string;
  stars?: number;
  comment: string;
  createdAt?: string | null;
};

type PublicProfileVisibility = {
  showPracticeAddress?: boolean;
  showPracticePhone?: boolean;
  showPracticeEmail?: boolean;
};

type BookingProfile = {
  clinician: {
    id: string;
    name: string;
    displayName?: string;
    specialty?: string;
    location?: string;
    city?: string;
    province?: string;
    country?: string;
    rating?: number;
    ratingAvg?: number;
    ratingCount?: number;
    timezone?: string;
    bio?: string;
    status?: string;
    online?: boolean;
    photoUrl?: string | null;
    avatarUrl?: string | null;
    acceptsMedicalAid?: boolean;
    acceptedSchemes?: string[];
    practiceName?: string;
    practiceAddress1?: string;
    practiceAddress2?: string;
    practiceCity?: string;
    practiceCountry?: string;
    practicePhone?: string;
    practiceEmail?: string;
    publicProfileVisibility?: PublicProfileVisibility;
    hpcsaRegNo?: string | null;
    regulatorBody?: string | null;
    bhfNumberPresent?: boolean;
    qualifications?: Qualification[];
    verifiedQualifications?: Qualification[];
    additionalQualifications?: Qualification[];
    operational?: {
      canBeListed?: boolean;
      canBeBooked?: boolean;
      canPrescribe?: boolean;
      prescribingMode?: 'no' | 'conditional' | 'yes';
      allowedWorkspaces?: string[];
      patientCategory?: 'clinical' | 'wellness' | null;
    };
  };
  fees: {
    standard: FeeProfile;
    followUp: FeeProfile;
  };
  refundPolicy: RefundPolicy;
  rules?: {
    followUpRequiresOpenCase?: boolean;
    followUpFromCaseContextOnly?: boolean;
  };
  testimonials?: Testimonial[];
};

// ===== HELPERS =====
function cx(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(' ');
}

function getUid() {
  if (typeof window === 'undefined') return 'server-user';
  const key = 'ambulant_uid';
  let v = localStorage.getItem(key);
  if (!v) {
    v = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + '-u';
    localStorage.setItem(key, v);
  }
  return v;
}

async function readJsonSafe(r: Response) {
  return r.json().catch(() => null);
}

function formatMoney(cents?: number, currency = 'ZAR') {
  const amount = Number(cents);
  if (!Number.isFinite(amount)) return 'Fee unavailable';

  const value = amount / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
  } catch {
    return currency === 'ZAR' ? `R ${value.toFixed(2)}` : `${currency} ${value.toFixed(2)}`;
  }
}

function formatDuration(minutes?: number) {
  const value = Number(minutes);
  return Number.isFinite(value) && value > 0 ? `${value} min` : 'Duration unavailable';
}

function initials(name: string) {
  const parts = String(name || 'Clinician')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join('') || 'DR';
}

function ratingValue(c: BookingProfile['clinician']) {
  const n = Number(c.rating ?? c.ratingAvg ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.min(5, n)) : 0;
}

function statusText(status?: string) {
  const s = String(status || 'active').toLowerCase();
  if (s === 'disabled') return 'Temporarily unavailable';
  if (s === 'archived') return 'Not accepting bookings';
  if (s === 'disciplinary') return 'Temporarily unavailable';
  if (s === 'pending') return 'Not yet available for bookings';
  return 'Verified for patient bookings';
}

function normalizeQualification(q: Qualification): { title: string; meta: string; notes?: string | null } {
  const title = String(q.degree || q.title || q.type || 'Clinical qualification').trim();
  const year = q.year || q.yearOfCompletion;
  const institution = q.institution || 'Institution not specified';
  const cert = q.certificateNumber ? `Certificate ${q.certificateNumber}` : '';
  return { title, meta: [institution, year, cert].filter(Boolean).join(' · '), notes: q.notes };
}

function isPlatformTrainingQualification(
  q: Qualification,
  normalized: { title: string; meta: string; notes?: string | null }
) {
  const haystack = [
    q.type, q.degree, q.title, q.institution, q.notes, q.certificateNumber,
    normalized.title, normalized.meta, normalized.notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (haystack.includes('ambulant+') || haystack.includes('cloven technology')) return true;
  if (haystack.includes('contactless medicine')) return true;
  if (haystack.includes('onboarding') || haystack.includes('platform training')) return true;

  const title = String(normalized.title || '').toLowerCase();
  const institution = String(q.institution || '').toLowerCase();
  if (title === 'clinical qualification' && !institution) return true;
  return false;
}

function qualificationList(c: BookingProfile['clinician']) {
  const rows = [
    ...(Array.isArray(c.verifiedQualifications) ? c.verifiedQualifications : []),
    ...(Array.isArray(c.qualifications) ? c.qualifications : []),
    ...(Array.isArray(c.additionalQualifications) ? c.additionalQualifications : []),
  ];
  const seen = new Set<string>();
  return rows
    .map((raw) => ({ raw, normalized: normalizeQualification(raw) }))
    .filter(({ raw, normalized }) => !isPlatformTrainingQualification(raw, normalized))
    .map(({ normalized }) => normalized)
    .filter((q) => {
      const key = `${q.title}|${q.meta}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function refundLine(policy?: RefundPolicy) {
  if (!policy) return 'Standard Ambulant+ booking protection applies.';
  return `${policy.within24hPercent}% refund inside 24h · ${policy.noShowPercent}% for no-show · ${policy.clinicianMissPercent}% if clinician misses`;
}

// ===== INLINE ICONS =====
function StarIcon({ filled, className }: { filled?: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-7.5-1.875a2.25 2.25 0 00-2.15 1.215l-1.5 2.25a14.966 14.966 0 01-6.68-6.68l2.25-1.5a2.25 2.25 0 001.215-2.15L5.25 4.852C5.125 4.351 4.675 4 4.158 4H2.75A2.25 2.25 0 00.5 6.25v1.5A2.25 2.25 0 002.75 10h1.5z" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.287.696.287 1.093m0-1.093c-.18.324-.287.696-.287 1.093m0 0L12 17.25m-4.783-4.217a2.25 2.25 0 100-2.186m0 2.186L12 6.75m-4.783 4.217L12 17.25m0 0l4.783-4.217M12 17.25V6.75" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function AwardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}

function QuoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
    </svg>
  );
}

// ===== SUB-COMPONENTS =====

function StarRating({ value, count }: { value: number; count?: number }) {
  const rounded = Math.round(value * 2) / 2;
  const fullStars = Math.floor(rounded);
  const hasHalf = rounded % 1 !== 0;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((i) => {
          if (i <= fullStars) {
            return <StarIcon key={i} filled className="h-4 w-4 text-amber-400" />;
          }
          if (i === fullStars + 1 && hasHalf) {
            return (
              <div key={i} className="relative h-4 w-4">
                <StarIcon className="absolute h-4 w-4 text-slate-300" />
                <div className="absolute overflow-hidden" style={{ width: '50%' }}>
                  <StarIcon filled className="h-4 w-4 text-amber-400" />
                </div>
              </div>
            );
          }
          return <StarIcon key={i} className="h-4 w-4 text-slate-300" />;
        })}
      </div>
      {count !== undefined && count > 0 && (
        <span className="text-sm font-medium text-slate-500">
          {count} review{count !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-xl bg-slate-200', className)} />;
}

function LoadingSkeleton() {
  return (
    <main data-p-ui="patient-clinician-detail-page" className="min-h-screen bg-slate-50">
      <div className="h-72 bg-slate-200 animate-pulse" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="-mt-20 relative z-10">
          <div className="h-40 w-40 rounded-full bg-slate-300 animate-pulse border-4 border-white" />
        </div>
        <div className="mt-6 space-y-4">
          <SkeletonPulse className="h-8 w-64" />
          <SkeletonPulse className="h-4 w-96" />
          <SkeletonPulse className="h-4 w-48" />
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <SkeletonPulse className="h-48 w-full" />
            <SkeletonPulse className="h-64 w-full" />
            <SkeletonPulse className="h-48 w-full" />
          </div>
          <div className="space-y-6">
            <SkeletonPulse className="h-64 w-full" />
            <SkeletonPulse className="h-48 w-full" />
          </div>
        </div>
      </div>
    </main>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <AwardIcon className="h-6 w-6 text-slate-400" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </section>
  );
}

// ===== MAIN COMPONENT =====
export default function ClinicianBioPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [profile, setProfile] = useState<BookingProfile | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setBusy(true);
        setErr(null);
        const r = await fetch(`/api/clinicians/${encodeURIComponent(params.id)}/booking-profile`, {
          cache: 'no-store',
          headers: { 'x-role': 'patient', 'x-uid': getUid() },
        });
        const j = await readJsonSafe(r);
        if (!r.ok || !j) {
          throw new Error(j?.error || j?.message || `Failed to load clinician profile: HTTP ${r.status}`);
        }
        if (!cancelled) setProfile(j as BookingProfile);
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message || 'Failed to load clinician');
          setProfile(null);
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const c = profile?.clinician;
  const standardFee = profile?.fees?.standard;
  const followUpFee = profile?.fees?.followUp;

  const canBook =
    c?.operational?.canBeBooked !== false &&
    !['disabled', 'archived', 'disciplinary'].includes(String(c?.status || '').toLowerCase());

  const testimonials = useMemo(
    () =>
      Array.isArray(profile?.testimonials)
        ? profile!.testimonials!
            .map((t) => ({ ...t, comment: String(t.comment || '').trim() }))
            .filter((t) => t.comment)
            .slice(0, 6)
        : [],
    [profile],
  );

  const qualifications = useMemo(() => (c ? qualificationList(c) : []), [c]);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(`Check out this clinician on Ambulant+: ${url}`)}`,
        '_blank'
      );
    }
  };

  if (busy) return <LoadingSkeleton />;
  if (err || !profile || !c) {
    return (
      <main data-p-ui="patient-clinician-detail-page" className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
              <svg className="h-6 w-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-rose-900">Unable to load profile</h2>
            <p className="mt-2 text-sm text-rose-700">{err || 'Clinician profile could not be loaded.'}</p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 transition"
              >
                Try again
              </button>
              <button
                onClick={() => router.back()}
                className="rounded-full border border-rose-200 bg-white px-5 py-2.5 text-sm font-semibold text-rose-900 hover:bg-rose-50 transition"
              >
                Go back
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const rating = ratingValue(c);
  const ratingCount = typeof c.ratingCount === 'number' ? c.ratingCount : 0;
  const avatarSrc = c.avatarUrl || c.photoUrl || `/api/clinicians/${encodeURIComponent(c.id || params.id)}/avatar`;
  const visibility = c.publicProfileVisibility;
  const practiceAddress = visibility?.showPracticeAddress
    ? [c.practiceAddress1, c.practiceAddress2, c.practiceCity, c.practiceCountry].filter(Boolean).join(', ')
    : [c.practiceCity, c.practiceCountry].filter(Boolean).join(', ');
  const publicPracticePhone = visibility?.showPracticePhone ? c.practicePhone : undefined;
  const publicPracticeEmail = visibility?.showPracticeEmail ? c.practiceEmail : undefined;
  const schemes = Array.isArray(c.acceptedSchemes) ? c.acceptedSchemes : [];
  const displayLocation = c.location || c.city || c.practiceCity || 'Location available at booking';

  return (
    <main data-p-ui="patient-clinician-detail-page" className="min-h-screen bg-slate-50">
      {/* ===== HERO SECTION ===== */}
      <div className="relative overflow-hidden bg-slate-950 pb-24 pt-8 sm:pb-32 sm:pt-12">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-teal-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(20,184,166,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(99,102,241,0.1),transparent_50%)]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Top navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur-sm transition hover:bg-white/10"
            >
              <ChevronLeftIcon className="h-4 w-4" />
              Back
            </button>
            <Link
              href="/clinicians"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur-sm transition hover:bg-white/10"
            >
              All clinicians
            </Link>
          </div>

          {/* Hero content */}
          <div className="mt-10 sm:mt-14">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              {/* Left: Avatar + Info */}
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
                <div className="relative shrink-0">
                  <div className="h-32 w-32 overflow-hidden rounded-3xl border-4 border-white/20 bg-gradient-to-br from-teal-400 to-indigo-500 shadow-2xl sm:h-40 sm:w-40">
                    <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-white">
                      {initials(c.name)}
                    </div>
                    {avatarSrc && !avatarFailed && (
                      <img
                        src={avatarSrc}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                        onError={() => setAvatarFailed(true)}
                      />
                    )}
                  </div>
                  {c.online && (
                    <span className="absolute -bottom-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-950 bg-emerald-500">
                      <span className="h-2.5 w-2.5 rounded-full bg-white" />
                    </span>
                  )}
                </div>

                <div className="min-w-0 pb-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                    <ShieldCheckIcon className="h-3.5 w-3.5" />
                    Ambulant+ Verified
                  </div>
                  <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                    {c.displayName || c.name}
                  </h1>
                  <p className="mt-2 text-lg text-slate-300">{c.specialty || 'Clinical consultation'}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPinIcon className="h-4 w-4" />
                      {displayLocation}
                    </span>
                    {c.country && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs font-medium">{c.country}</span>
                      </span>
                    )}
                  </div>
                  {rating > 0 && (
                    <div className="mt-4">
                      <StarRating value={rating} count={ratingCount} />
                    </div>
                  )}
                </div>
              </div>

              {/* Right: CTAs */}
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
                <Link
                  href={`/clinicians/${encodeURIComponent(c.id)}/calendar?type=standard&country=${encodeURIComponent(c.country || 'ZA')}&funding=card`}
                  className={cx(
                    'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow-lg transition',
                    canBook ? 'bg-white text-slate-950 hover:bg-slate-100' : 'pointer-events-none bg-white/10 text-white/40'
                  )}
                >
                  <CalendarIcon className="h-4 w-4" />
                  Book consultation
                </Link>
                <button
                  onClick={handleShare}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
                >
                  <ShareIcon className="h-4 w-4" />
                  {copied ? 'Copied!' : 'Share profile'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== STATS BAR ===== */}
      <div className="relative z-10 -mt-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:grid-cols-4">
          {[
            { label: 'Rating', value: rating > 0 ? rating.toFixed(1) : '—' },
            { label: 'Reviews', value: ratingCount > 0 ? String(ratingCount) : '—' },
            { label: 'From', value: formatMoney(standardFee?.priceCents, standardFee?.currency) },
            { label: 'Duration', value: formatDuration(standardFee?.durationMin) },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={cx(
                'flex flex-col items-center justify-center px-2 py-5',
                i < 3 && 'border-r border-slate-100'
              )}
            >
              <div className="text-2xl font-bold text-slate-950">{stat.value}</div>
              <div className="text-xs font-medium text-slate-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Left column */}
          <div className="space-y-8">
            {/* About */}
            <SectionCard title="About" subtitle="Clinical profile and practice approach">
              <div className="prose prose-slate max-w-none">
                <p className="text-sm leading-relaxed text-slate-700">
                  {c.bio ||
                    'This clinician has completed Ambulant+ onboarding and is available for secure contactless clinical consultation through the platform.'}
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                  <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-500" />
                  {statusText(c.status)}
                </span>
                {c.acceptsMedicalAid ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                    <ShieldCheckIcon className="h-3.5 w-3.5" />
                    Medical aid accepted
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                    Private pay only
                  </span>
                )}
                {c.operational?.canPrescribe && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700">
                    <AwardIcon className="h-3.5 w-3.5" />
                    Can prescribe
                  </span>
                )}
              </div>
            </SectionCard>

            {/* Fees */}
            <SectionCard title="Consultation fees" subtitle="Transparent pricing with refund protection">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:border-teal-300 hover:shadow-md">
                  <div className="absolute right-0 top-0 rounded-bl-2xl bg-slate-900 px-3 py-1 text-xs font-medium text-white">
                    New case
                  </div>
                  <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Standard consultation</div>
                  <div className="mt-2 text-3xl font-bold text-slate-950">
                    {formatMoney(standardFee?.priceCents, standardFee?.currency)}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                    <ClockIcon className="h-4 w-4" />
                    {formatDuration(standardFee?.durationMin)}
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:border-teal-300 hover:shadow-md">
                  <div className="absolute right-0 top-0 rounded-bl-2xl bg-teal-600 px-3 py-1 text-xs font-medium text-white">
                    Follow-up
                  </div>
                  <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Follow-up consultation</div>
                  <div className="mt-2 text-3xl font-bold text-slate-950">
                    {formatMoney(followUpFee?.priceCents, followUpFee?.currency)}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                    <ClockIcon className="h-4 w-4" />
                    {formatDuration(followUpFee?.durationMin)}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Booking protection</div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{refundLine(profile.refundPolicy)}</p>
                  </div>
                </div>
              </div>

              {profile.rules?.followUpRequiresOpenCase && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <div>
                      <div className="text-sm font-semibold text-amber-900">Follow-up policy</div>
                      <p className="mt-1 text-xs leading-relaxed text-amber-800">
                        Follow-up consultations require an active case. New patients must book a standard consultation first.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </SectionCard>

            {/* Qualifications */}
            {(qualifications.length > 0 || c.regulatorBody || c.hpcsaRegNo) && (
              <SectionCard title="Qualifications & credentials" subtitle="Published clinical credentials">
                {qualifications.length > 0 && (
                  <div className="space-y-3">
                    {qualifications.map((q, idx) => (
                      <div
                        key={idx}
                        className="group flex gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition hover:border-teal-300 hover:bg-teal-50/30"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                          <AwardIcon className="h-5 w-5 text-teal-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-950">{q.title}</div>
                          <div className="mt-0.5 text-sm text-slate-600">{q.meta}</div>
                          {q.notes && <div className="mt-2 text-xs text-slate-500">{q.notes}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(c.regulatorBody || c.hpcsaRegNo) && (
                  <div className={cx('rounded-xl border border-slate-200 bg-white p-4', qualifications.length > 0 && 'mt-5')}>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <ShieldCheckIcon className="h-4 w-4 text-teal-600" />
                      Regulatory information
                    </div>
                    <div className="mt-2 text-sm text-slate-600">
                      {[c.regulatorBody, c.hpcsaRegNo].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                )}
              </SectionCard>
            )}

            {/* Testimonials */}
            <SectionCard
              title="Patient reviews"
              subtitle="Patient feedback published on Ambulant+"
              action={
                testimonials.length > 0 ? (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                    {ratingCount > testimonials.length
                      ? `Showing ${testimonials.length} of ${ratingCount} reviews`
                      : `${testimonials.length} review${testimonials.length !== 1 ? 's' : ''}`}
                  </span>
                ) : null
              }
            >
              {testimonials.length ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {testimonials.map((t, idx) => (
                    <div key={t.id || idx} className="relative rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                      <QuoteIcon className="absolute right-4 top-4 h-8 w-8 text-slate-200" />
                      <div className="relative">
                        {typeof t.stars === 'number' && t.stars > 0 && (
                          <div className="mb-3">
                            <StarRating value={t.stars} />
                          </div>
                        )}
                        <p className="text-sm leading-relaxed text-slate-700">"{t.comment}"</p>
                        {t.createdAt && (
                          <div className="mt-3 text-xs text-slate-400">
                            {new Date(t.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No reviews yet"
                  description="Public reviews appear after eligible completed consultations are rated."
                />
              )}
            </SectionCard>
          </div>

          {/* Right column - Sticky */}
          <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            {/* Booking CTA Card */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white">
                <div className="text-xs font-medium uppercase tracking-wider text-slate-400">Ready to book?</div>
                <h2 className="mt-2 text-xl font-semibold">Schedule a consultation</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Book a new consultation. Follow-ups are arranged from an active case.
                </p>
              </div>
              <div className="p-6 space-y-3">
                <Link
                  href={`/clinicians/${encodeURIComponent(c.id)}/calendar?type=standard&country=${encodeURIComponent(c.country || 'ZA')}`}
                  className={cx(
                    'flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition',
                    canBook
                      ? 'bg-slate-950 text-white hover:bg-slate-800 shadow-sm'
                      : 'pointer-events-none bg-slate-200 text-slate-400'
                  )}
                >
                  <CalendarIcon className="h-4 w-4" />
                  Book new consultation
                </Link>
                {c.acceptsMedicalAid && canBook && (
                  <Link
                    href={`/clinicians/${encodeURIComponent(c.id)}/calendar?type=standard&country=${encodeURIComponent(c.country || 'ZA')}&funding=medical_aid`}
                    className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                  >
                    <ShieldCheckIcon className="h-4 w-4" />
                    Use Medical Aid or full booking options
                  </Link>
                )}
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
                  <div className="text-sm font-semibold text-slate-700">Follow-up consultation</div>
                  <div className="mt-1 text-xs text-slate-500">Book from the relevant active case in your patient account.</div>
                </div>
                {!canBook && (
                  <p className="text-center text-xs text-amber-600">
                    This clinician is currently not accepting new bookings.
                  </p>
                )}
              </div>
            </div>

            {/* Practice Info */}
            <SectionCard title="Practice details" subtitle={c.practiceName || 'Private practice'}>
              <div className="space-y-4">
                {practiceAddress && (
                  <div className="flex items-start gap-3">
                    <MapPinIcon className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                    <div>
                      <div className="text-xs font-medium text-slate-500">Address</div>
                      <div className="mt-0.5 text-sm text-slate-800">{practiceAddress}</div>
                    </div>
                  </div>
                )}
                {publicPracticePhone && (
                  <div className="flex items-start gap-3">
                    <PhoneIcon className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                    <div>
                      <div className="text-xs font-medium text-slate-500">Phone</div>
                      <a href={`tel:${publicPracticePhone}`} className="mt-0.5 text-sm text-teal-700 hover:underline">
                        {publicPracticePhone}
                      </a>
                    </div>
                  </div>
                )}
                {publicPracticeEmail && (
                  <div className="flex items-start gap-3">
                    <MailIcon className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                    <div>
                      <div className="text-xs font-medium text-slate-500">Email</div>
                      <a href={`mailto:${publicPracticeEmail}`} className="mt-0.5 text-sm text-teal-700 hover:underline break-all">
                        {publicPracticeEmail}
                      </a>
                    </div>
                  </div>
                )}
                {!publicPracticePhone && !publicPracticeEmail && (
                  <p className="text-xs leading-relaxed text-slate-500">
                    Direct contact details are shared through the secure booking pathway when appropriate.
                  </p>
                )}
              </div>
            </SectionCard>

            {/* Insurance */}
            {c.acceptsMedicalAid && schemes.length > 0 && (
              <SectionCard title="Medical aid & insurance" subtitle="Accepted schemes">
                <div className="flex flex-wrap gap-2">
                  {schemes.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Trust indicators */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ShieldCheckIcon className="h-5 w-5 text-teal-600" />
                Why Ambulant+?
              </div>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  Verified clinician credentials
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  Secure, contactless consultations
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  Booking protection & refunds
                </li>
                {c.acceptsMedicalAid && (
                  <li className="flex items-start gap-2">
                    <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    Medical aid accepted by this clinician
                  </li>
                )}
              </ul>
            </div>
          </aside>
        </div>
      </div>

      {/* ===== MOBILE BOTTOM BAR ===== */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur-lg lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-950">{c.name}</div>
            <div className="truncate text-xs text-slate-500">
              From {formatMoney(standardFee?.priceCents, standardFee?.currency)} · {formatDuration(standardFee?.durationMin)}
            </div>
          </div>
          <Link
            href={`/clinicians/${encodeURIComponent(c.id)}/calendar?type=standard&country=${encodeURIComponent(c.country || 'ZA')}`}
            className={cx(
              'shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition',
              canBook ? 'bg-slate-950 hover:bg-slate-800' : 'bg-slate-300 pointer-events-none'
            )}
          >
            Book now
          </Link>
        </div>
      </div>
    </main>
  );
}