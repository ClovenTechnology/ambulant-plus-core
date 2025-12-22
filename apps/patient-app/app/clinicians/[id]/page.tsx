// apps/patient-app/app/clinicians/[id]/page.tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CLINICIANS } from '@/mock/clinicians';

type Qualification = {
  type: string;
  institution: string;
  year?: string;
  notes?: string | null;
};

type RefundPolicy = {
  within24hPercent: number; // e.g. 50
  noShowPercent: number; // e.g. 0
  clinicianMissPercent: number; // e.g. 100
  networkProrate: boolean;
};

type FeeProfile = {
  priceCents: number;
  currency: string; // 'ZAR'
  durationMin: number; // consult duration
  bufferMin: number; // buffer added around consult slots
};

type BookingProfile = {
  clinician: {
    id: string;
    name: string;
    specialty?: string;
    location?: string;
    rating?: number;
    timezone?: string;

    // NEW: profile / practice info (from gateway profile)
    bio?: string;
    acceptsMedicalAid?: boolean;
    acceptedSchemes?: string[];
    practiceName?: string;
    practiceAddress1?: string;
    practiceAddress2?: string;
    practiceCity?: string;
    practiceCountry?: string;
    practicePhone?: string;
    practiceEmail?: string;
    qualifications?: Qualification[];
    verifiedQualifications?: Qualification[];
    additionalQualifications?: Qualification[];

    // NEW: status from clinician profile
    status?: string;
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
};

function formatZar(cents: number) {
  const rands = (cents / 100).toFixed(2);
  return `R ${rands}`;
}

function RefundPolicyPanel({ policy }: { policy: RefundPolicy }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-sm underline text-indigo-700"
        aria-expanded={open}
        aria-controls="refund-policy"
      >
        {open ? 'Hide' : 'View'} clinician’s refund policy
      </button>
      {open && (
        <div
          id="refund-policy"
          className="mt-2 border rounded-lg bg-white p-3 text-sm"
        >
          <ul className="space-y-1">
            <li>
              Cancel &lt; 24h: <b>{policy.within24hPercent}%</b> refund
            </li>
            <li>
              No-show: <b>{policy.noShowPercent}%</b> refund
            </li>
            <li>
              Clinician misses: <b>{policy.clinicianMissPercent}%</b> refund or
              fast rebook
            </li>
            <li>
              Network interrupted:{' '}
              {policy.networkProrate ? (
                <b>prorated by time</b>
              ) : (
                <b>no prorate</b>
              )}
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

function normalizeQualification(raw: any): Qualification {
  if (!raw) {
    return {
      type: 'Qualification',
      institution: 'Unknown institution',
    };
  }
  return {
    type: raw.type ?? raw.degree ?? raw.title ?? 'Qualification',
    institution:
      raw.institution ??
      raw.institutionName ??
      raw.organisation ??
      raw.organization ??
      'Unknown institution',
    year: raw.year ?? raw.yearOfCompletion ?? raw.completionDate ?? undefined,
    notes: raw.notes ?? null,
  };
}

function buildFallbackProfile(id: string): BookingProfile | null {
  const c = CLINICIANS.find((x) => x.id === id);
  if (!c) return null;

  const verifiedSrc =
    (c as any).verifiedQualifications ?? (c as any).qualifications ?? [];
  const additionalSrc =
    (c as any).additionalQualifications ??
    (c as any).otherQualifications ??
    [];
  const verifiedQualifications: Qualification[] = Array.isArray(verifiedSrc)
    ? verifiedSrc.map(normalizeQualification)
    : [];
  const additionalQualifications: Qualification[] = Array.isArray(additionalSrc)
    ? additionalSrc.map(normalizeQualification)
    : [];

  return {
    clinician: {
      id: c.id,
      name: c.name,
      specialty: c.specialty,
      location: c.location,
      rating: c.rating,
      timezone: 'Africa/Johannesburg',

      // NEW
      bio: (c as any).bio ?? (c as any).about ?? undefined,
      acceptsMedicalAid:
        typeof (c as any).acceptsMedicalAid === 'boolean'
          ? (c as any).acceptsMedicalAid
          : !!(c as any).medicalAidAccepted,
      acceptedSchemes: Array.isArray((c as any).acceptedSchemes)
        ? (c as any).acceptedSchemes
        : [],
      practiceName: (c as any).practiceName ?? undefined,
      practiceAddress1:
        (c as any).practiceAddress1 ??
        (c as any).practiceAddressLine1 ??
        (c as any).practiceAddress ??
        undefined,
      practiceAddress2:
        (c as any).practiceAddress2 ??
        (c as any).practiceAddressLine2 ??
        undefined,
      practiceCity: (c as any).practiceCity ?? c.location ?? undefined,
      practiceCountry: (c as any).practiceCountry ?? 'South Africa',
      practicePhone: (c as any).phone ?? undefined,
      practiceEmail: (c as any).email ?? undefined,
      qualifications: [...verifiedQualifications, ...additionalQualifications],
      verifiedQualifications,
      additionalQualifications,

      status: (c as any).status ?? 'active',
    },
    fees: {
      standard: {
        priceCents: (c as any)?.feeCents ?? 60000,
        currency: 'ZAR',
        durationMin: 45,
        bufferMin: 5,
      },
      followUp: {
        priceCents: Math.round(((c as any)?.feeCents ?? 60000) * 0.6),
        currency: 'ZAR',
        durationMin: 25,
        bufferMin: 5,
      },
    },
    refundPolicy: {
      within24hPercent: (c as any)?.policy?.within24hPercent ?? 50,
      noShowPercent: (c as any)?.policy?.noShowPercent ?? 0,
      clinicianMissPercent: (c as any)?.policy?.clinicianMissPercent ?? 100,
      networkProrate: (c as any)?.policy?.networkProrate ?? true,
    },
    rules: {
      followUpRequiresOpenCase: true,
      followUpFromCaseContextOnly: true,
    },
  };
}

export default function ClinicianBioPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const id = params.id;

  const GATEWAY = process.env.NEXT_PUBLIC_APIGW_BASE ?? '';

  const [profile, setProfile] = useState<BookingProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setBusy(true);
        setErr(null);

        // Preferred endpoint: effective booking profile (fees + durations + buffers + refund policy)
        if (GATEWAY) {
          const r = await fetch(
            `${GATEWAY}/api/clinicians/${encodeURIComponent(
              id,
            )}/booking-profile`,
            {
              cache: 'no-store',
            },
          );
          if (r.ok) {
            const j = (await r.json()) as BookingProfile;
            if (!cancelled) setProfile(j);
            return;
          }
        }

        // Fallback to local mock (demo)
        const fb = buildFallbackProfile(id);
        if (!fb) throw new Error('Clinician not found');
        if (!cancelled) setProfile(fb);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || 'Failed to load clinician');
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [GATEWAY, id]);

  const policy = useMemo(() => {
    return (
      profile?.refundPolicy ?? {
        within24hPercent: 50,
        noShowPercent: 0,
        clinicianMissPercent: 100,
        networkProrate: true,
      }
    );
  }, [profile]);

  if (busy && !profile) {
    return (
      <main className="p-6 max-w-5xl mx-auto">
        <div className="rounded-2xl border bg-white p-5 text-sm text-gray-600">
          Loading clinician…
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="p-6 max-w-5xl mx-auto">
        <div className="text-rose-600">{err ?? 'Clinician not found.'}</div>
        <Link href="/clinicians" className="text-sm underline block mt-2">
          ← Back to clinicians
        </Link>
      </main>
    );
  }

  const c = profile.clinician;
  const standard = profile.fees.standard;

  const acceptsMedicalAid = c.acceptsMedicalAid;
  const acceptedSchemes =
    c.acceptedSchemes ??
    (typeof (c as any).acceptedSchemesCsv === 'string'
      ? String((c as any).acceptedSchemesCsv)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []);

  const clinicianStatus = (c.status ?? (c as any).clinicianStatus ?? 'active') as string;
  const isDisabledClinician = clinicianStatus === 'disabled' || clinicianStatus === 'archived';
  const isDisciplinaryClinician = clinicianStatus === 'disciplinary';

  const allQualifications: Qualification[] = (() => {
    const q1 = Array.isArray((c as any).qualifications)
      ? (c as any).qualifications
      : [];
    const q2 = Array.isArray((c as any).verifiedQualifications)
      ? (c as any).verifiedQualifications
      : [];
    const q3 = Array.isArray((c as any).additionalQualifications)
      ? (c as any).additionalQualifications
      : [];
    const combined = [...q1, ...q2, ...q3]
      .filter(Boolean)
      .map(normalizeQualification);
    const seen = new Set<string>();
    return combined.filter((q) => {
      const key = `${q.type}|${q.institution}|${q.year ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="text-sm text-teal-700 hover:underline"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-semibold">{c.name}</h1>
        <Link href="/clinicians" className="text-sm text-teal-700 hover:underline">
          All clinicians
        </Link>
      </header>

      {err && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {err} (showing fallback where needed)
        </div>
      )}

      {/* status-aware banner for patient */}
      {isDisabledClinician && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          This clinician is currently not accepting new bookings via Ambulant+. You can still view your
          past encounters in <b>Cases</b>, but new appointments may be limited.
        </div>
      )}
      {isDisciplinaryClinician && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          This clinician is currently under review by Ambulant+. You can still book a consultation, but
          future visibility or follow-up options may change based on the review outcome.
        </div>
      )}

      <section className="bg-white rounded-2xl border p-5 flex items-start justify-between gap-6">
        {/* ✅ left side replaced per spec */}
        <div>
          <div className="text-lg font-medium">{c.specialty ?? 'Clinician'}</div>
          <div className="text-sm text-gray-600">{c.location ?? '—'}</div>
          <div className="text-xs text-amber-700 mt-1">
            ★ {Number.isFinite(c.rating) ? (c.rating as number).toFixed(1) : '—'}
          </div>

          {typeof acceptsMedicalAid === 'boolean' && (
            <div className="mt-2">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${
                  acceptsMedicalAid
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-gray-50 border-gray-200 text-gray-700'
                }`}
              >
                {acceptsMedicalAid
                  ? 'Accepts eligible Medical Aid / insurance claims'
                  : 'Private pay only (no Medical Aid claims via Ambulant+)'}
              </span>
            </div>
          )}

          {(c.practiceName ||
            c.practiceAddress1 ||
            c.practiceAddress2 ||
            c.practiceCity ||
            c.practiceCountry ||
            c.practicePhone ||
            c.practiceEmail) && (
            <div className="mt-3 text-xs text-gray-700 space-y-1">
              <div className="font-semibold text-[11px] uppercase tracking-wide text-gray-500">
                Private practice
              </div>
              {c.practiceName && <div className="text-sm">{c.practiceName}</div>}
              {(c.practiceAddress1 ||
                c.practiceAddress2 ||
                c.practiceCity ||
                c.practiceCountry) && (
                <div className="text-xs text-gray-600">
                  {[
                    c.practiceAddress1,
                    c.practiceAddress2,
                    c.practiceCity,
                    c.practiceCountry,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </div>
              )}
              {c.practicePhone && (
                <div className="text-xs text-gray-600">Tel: {c.practicePhone}</div>
              )}
              {c.practiceEmail && (
                <div className="text-xs text-gray-600">
                  Practice email: {c.practiceEmail}
                </div>
              )}
            </div>
          )}

          {acceptsMedicalAid && acceptedSchemes.length > 0 && (
            <div className="mt-3">
              <div className="text-[11px] text-gray-500 mb-1">
                Selected Medical Aid / insurance schemes accepted
              </div>
              <div className="flex flex-wrap gap-1">
                {acceptedSchemes.map((s) => (
                  <span
                    key={s}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {c.bio && (
            <p className="text-sm text-gray-700 mt-3 max-w-2xl whitespace-pre-line">
              {c.bio}
            </p>
          )}

          <p className="text-xs text-gray-500 mt-3 max-w-2xl">
            Bookings from this clinician page are for a{' '}
            <b>first consultation for a new case</b>.
            <br />
            <span className="text-gray-500">
              Follow-ups can only be booked from your <b>Case / Encounter</b>{' '}
              context (active, undischarged case).
            </span>
          </p>

          <div className="mt-4 grid sm:grid-cols-3 gap-3">
            {/* existing fee / timezone / rule cards unchanged */}
            <div className="rounded-xl border p-3">
              <div className="text-xs text-gray-500">Standard consult fee</div>
              <div className="text-lg font-semibold">
                {formatZar(standard.priceCents)}
              </div>
              <div className="text-xs text-gray-500">
                {standard.durationMin} min consult + {standard.bufferMin} min buffer
              </div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="text-xs text-gray-500">Timezone</div>
              <div className="text-sm font-medium">
                {c.timezone ?? 'Africa/Johannesburg'}
              </div>
              <div className="text-xs text-gray-500">
                Appointments are shown in your local time.
              </div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="text-xs text-gray-500">Booking rule</div>
              <div className="text-sm font-medium">New case only</div>
              <div className="text-xs text-gray-500">
                Follow-up requires an open case.
              </div>
            </div>
          </div>

          <RefundPolicyPanel policy={policy} />
        </div>

        {/* right side: status-aware booking CTAs */}
        <div className="shrink-0 flex flex-col gap-2">
          <Link
            href={
              isDisabledClinician
                ? '#'
                : `/clinicians/${encodeURIComponent(c.id)}/calendar?type=standard`
            }
            onClick={(e) => {
              if (isDisabledClinician) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            className={`px-4 py-2 rounded-lg text-sm text-center ${
              isDisabledClinician
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
            aria-disabled={isDisabledClinician}
          >
            {isDisabledClinician ? 'Not accepting bookings' : 'Book new consultation'}
          </Link>

          <Link
            href="/encounters"
            className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50 text-center"
          >
            Book a follow-up (from Cases)
          </Link>
        </div>
      </section>

      {/* ✅ Qualifications inserted before Testimonials */}
      {allQualifications.length > 0 && (
        <section className="bg-white rounded-2xl border p-5">
          <h2 className="text-lg font-semibold mb-3">Qualifications</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            {allQualifications.map((q, idx) => (
              <li
                key={`${q.type}-${q.institution}-${q.year ?? ''}-${idx}`}
                className="border rounded-lg px-3 py-2 bg-gray-50"
              >
                <div className="font-medium">
                  {q.type}
                  {q.year && (
                    <span className="text-xs text-gray-500 ml-2">
                      ({q.year})
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-600">{q.institution}</div>
                {q.notes && (
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {q.notes}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="bg-white rounded-2xl border p-5">
        <h2 className="text-lg font-semibold mb-3">Testimonials</h2>
        <ul className="space-y-3 text-sm text-gray-700">
          <li>“Great manners and charisma but still very thorough, made virtual interaction feel physical and indulgingly immersive.”</li>
          <li>“Explained everything clearly. Highly recommended.”</li>
        </ul>
      </section>
    </main>
  );
}
