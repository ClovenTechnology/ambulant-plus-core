// apps/patient-app/app/clinicians/[id]/page.tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

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
  const value = Number(cents ?? 0) / 100;

  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
  } catch {
    return currency === 'ZAR' ? `R ${value.toFixed(2)}` : `${currency} ${value.toFixed(2)}`;
  }
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
  if (s === 'disciplinary') return 'Under governance review';
  if (s === 'pending') return 'Pending activation';

  return 'Verified for patient bookings';
}

function normalizeQualification(q: Qualification): { title: string; meta: string; notes?: string | null } {
  const title = String(q.degree || q.title || q.type || 'Clinical qualification').trim();
  const year = q.year || q.yearOfCompletion;
  const institution = q.institution || 'Institution not specified';
  const cert = q.certificateNumber ? `Certificate ${q.certificateNumber}` : '';

  return {
    title,
    meta: [institution, year, cert].filter(Boolean).join(' - '),
    notes: q.notes,
  };
}

function isPlatformTrainingQualification(q: Qualification, normalized: { title: string; meta: string; notes?: string | null }) {
  const haystack = [
    q.type,
    q.degree,
    q.title,
    q.institution,
    q.notes,
    q.certificateNumber,
    normalized.title,
    normalized.meta,
    normalized.notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Ambulant+/Cloven training is platform-readiness training, not a clinical qualification.
  // It must not be rendered under patient-facing clinical credentials.
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

  return `${policy.within24hPercent}% refund inside 24h, ${policy.noShowPercent}% for no-show, ${policy.clinicianMissPercent}% if clinician misses.`;
}

export default function ClinicianBioPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  const [profile, setProfile] = useState<BookingProfile | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

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
            .slice(0, 3)
        : [],
    [profile],
  );

  const qualifications = useMemo(() => (c ? qualificationList(c) : []), [c]);

  if (busy) {
    return (
      <main data-p-ui="patient-clinician-detail-page" className="min-w-0 overflow-x-clip min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Loading clinician command profile...
        </div>
      </main>
    );
  }

  if (err || !profile || !c) {
    return (
      <main data-p-ui="patient-clinician-detail-page" className="min-w-0 overflow-x-clip min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900">
          {err || 'Clinician profile could not be loaded.'}
          <div className="mt-4">
            <button
              onClick={() => router.back()}
              className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-900"
            >
              Go back
            </button>
          </div>
        </div>
      </main>
    );
  }

  const rating = ratingValue(c);
  const ratingCount = typeof c.ratingCount === 'number' ? c.ratingCount : 0;
  const avatarSrc = c.avatarUrl || c.photoUrl || `/api/clinicians/${encodeURIComponent(c.id || params.id)}/avatar`;
  const practiceAddress = [c.practiceAddress1, c.practiceAddress2, c.practiceCity, c.practiceCountry].filter(Boolean).join(', ');
  const schemes = Array.isArray(c.acceptedSchemes) ? c.acceptedSchemes : [];

  return (
    <main data-p-ui="patient-clinician-detail-page" className="min-w-0 overflow-x-clip min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5 pb-28 lg:pb-8">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => router.back()}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-teal-700 shadow-sm hover:bg-slate-50"
          >
            Back
          </button>

          <Link href="/clinicians" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-teal-700 shadow-sm">
            All clinicians
          </Link>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="relative bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 px-5 py-6 text-white sm:px-7">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.28),transparent_35%),radial-gradient(circle_at_top_right,rgba(129,140,248,0.25),transparent_35%)]" />

            <div className="relative grid gap-5 lg:grid-cols-[1fr_360px]">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 shadow-2xl">
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-400 to-violet-500 text-3xl font-bold text-white">
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

                <div className="min-w-0">
                  <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-emerald-100">
                    Ambulant+ verified clinician profile
                  </div>
                  <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{c.name}</h1>
                  <p className="mt-1 text-lg text-slate-200">{c.specialty || 'Clinical consultation'}</p>
                  <p className="mt-1 text-sm text-slate-300">{c.location || c.city || 'Location available at booking'}</p>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-emerald-300/30 bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-100">
                      {statusText(c.status)}
                    </span>

                    {c.acceptsMedicalAid ? (
                      <span className="rounded-full border border-cyan-300/30 bg-cyan-400/15 px-3 py-1 text-xs font-medium text-cyan-100">
                        Medical aid / insurance eligible
                      </span>
                    ) : (
                      <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
                        Private pay
                      </span>
                    )}

                    {c.online ? (
                      <span className="rounded-full border border-emerald-300/30 bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-100">
                        Online now
                      </span>
                    ) : (
                      <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
                        Televisit enabled
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-300">Booking command</div>

                <div className="mt-3 grid gap-2">
                  <Link
                    href={`/clinicians/${encodeURIComponent(c.id)}/calendar?type=standard&country=${encodeURIComponent(c.country || 'ZA')}`}
                    className={cx(
                      'rounded-2xl px-4 py-3 text-center text-sm font-semibold shadow-lg',
                      canBook ? 'bg-white text-slate-950 hover:bg-slate-100' : 'pointer-events-none bg-white/20 text-white/60',
                    )}
                  >
                    Book new consultation
                  </Link>

                  <Link
                    href={`/clinicians/${encodeURIComponent(c.id)}/calendar?type=followup&country=${encodeURIComponent(c.country || 'ZA')}`}
                    className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-white/15"
                  >
                    Book follow-up from case
                  </Link>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-slate-300">Rating</div>
                    <div className="mt-1 text-lg font-semibold">{rating.toFixed(1)}</div>
                    <div className="text-slate-300">{ratingCount} rated</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-slate-300">Timezone</div>
                    <div className="mt-1 text-sm font-semibold">{c.timezone || 'Africa/Johannesburg'}</div>
                    <div className="text-slate-300">Local display</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:p-7 lg:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Standard consult</div>
              <div className="mt-1 text-2xl font-semibold text-slate-950">
                {formatMoney(standardFee?.priceCents, standardFee?.currency)}
              </div>
              <div className="text-xs text-slate-600">
                {standardFee?.durationMin ?? 30} min + {standardFee?.bufferMin ?? 0} min buffer
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Follow-up consult</div>
              <div className="mt-1 text-2xl font-semibold text-slate-950">
                {formatMoney(followUpFee?.priceCents, followUpFee?.currency)}
              </div>
              <div className="text-xs text-slate-600">
                {followUpFee?.durationMin ?? 15} min + {followUpFee?.bufferMin ?? 0} min buffer
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Refund protection</div>
              <div className="mt-1 text-sm font-semibold text-slate-950">Policy attached</div>
              <div className="mt-1 text-xs leading-relaxed text-slate-600">{refundLine(profile.refundPolicy)}</div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Booking rule</div>
              <div className="mt-1 text-sm font-semibold text-slate-950">New case first</div>
              <div className="mt-1 text-xs leading-relaxed text-slate-600">
                Follow-ups require an active case context.
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="space-y-5">
            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">Clinical profile</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    A concise patient-facing summary of this clinician's practice profile.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {c.specialty || 'General Practice'}
                </span>
              </div>

              <div className="mt-4 rounded-3xl border border-slate-100 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                {c.bio || 'This clinician has completed Ambulant+ onboarding and is available for secure contactless clinical consultation through the platform.'}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">Credentials and qualifications</h2>

              {qualifications.length ? (
                <ul className="mt-4 space-y-3">
                  {qualifications.map((q, idx) => (
                    <li key={idx} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="font-semibold text-slate-950">{q.title}</div>
                      <div className="mt-1 text-sm text-slate-600">{q.meta}</div>
                      {q.notes ? <div className="mt-2 text-xs text-slate-500">{q.notes}</div> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  Verified qualifications will appear here once published by the onboarding team.
                </div>
              )}
            </section>

            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">Patient comments</h2>

              {testimonials.length ? (
                <ul className="mt-4 space-y-3">
                  {testimonials.map((t, idx) => (
                    <li key={t.id || idx} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm leading-relaxed text-slate-700">"{t.comment}"</p>
                      {typeof t.stars === 'number' ? (
                        <div className="mt-2 text-xs font-medium text-amber-700">
                          Rating {Math.max(0, Math.min(5, t.stars)).toFixed(1)}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  Public comments appear after eligible completed consultations are rated.
                </div>
              )}
            </section>
          </section>

          <aside className="space-y-5 lg:sticky lg:top-5 lg:h-fit">
            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Practice snapshot</div>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">{c.practiceName || 'Private practice'}</h2>

              <div className="mt-4 space-y-3 text-sm">
                {practiceAddress ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Practice address</div>
                    <div className="mt-1 text-slate-800">{practiceAddress}</div>
                  </div>
                ) : null}

                {c.practicePhone ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Practice phone</div>
                    <div className="mt-1 text-slate-800">{c.practicePhone}</div>
                  </div>
                ) : null}

                {c.practiceEmail ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Practice email</div>
                    <div className="mt-1 break-all text-slate-800">{c.practiceEmail}</div>
                  </div>
                ) : null}

                {schemes.length ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                    <div className="text-xs text-emerald-700">Accepted schemes</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {schemes.slice(0, 8).map((s) => (
                        <span key={s} className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[11px] text-emerald-800">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Regulatory profile</div>
                  <div className="mt-1 text-slate-800">
                    {[c.regulatorBody, c.hpcsaRegNo].filter(Boolean).join(' - ') || 'Credentialing managed by Ambulant+'}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="font-semibold text-slate-950">Ready to book?</div>
              <p className="mt-1 text-sm text-slate-600">
                Choose a new consultation or start a follow-up from an active case.
              </p>

              <div className="mt-4 grid gap-2">
                <Link
                  href={`/clinicians/${encodeURIComponent(c.id)}/calendar?type=standard&country=${encodeURIComponent(c.country || 'ZA')}`}
                  className={cx(
                    'rounded-2xl px-4 py-3 text-center text-sm font-semibold',
                    canBook ? 'bg-slate-950 text-white hover:bg-slate-800' : 'pointer-events-none bg-slate-200 text-slate-500',
                  )}
                >
                  Book new consultation
                </Link>

                <Link
                  href={`/clinicians/${encodeURIComponent(c.id)}/calendar?type=followup&country=${encodeURIComponent(c.country || 'ZA')}`}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Book follow-up from case
                </Link>
              </div>
            </section>
          </aside>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-950">{c.name}</div>
            <div className="truncate text-xs text-slate-600">
              {formatMoney(standardFee?.priceCents, standardFee?.currency)} - {standardFee?.durationMin ?? 30} min
            </div>
          </div>

          <Link
            href={`/clinicians/${encodeURIComponent(c.id)}/calendar?type=standard&country=${encodeURIComponent(c.country || 'ZA')}`}
            className="shrink-0 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
          >
            Book
          </Link>
        </div>
      </div>
    </main>
  );
}
