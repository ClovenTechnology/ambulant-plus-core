// apps/patient-app/app/practices/[id]/page.tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { PRACTICES } from '@/mock/practices';

type OperatingHours = {
  kind?: 'physical' | 'virtual' | 'both' | string;
  label?: string; // e.g. 'Mon–Fri'
  opensAt?: string; // '08:00'
  closesAt?: string; // '17:00'
  timezone?: string;
};

type PracticeLocation = {
  id: string;
  label?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  country?: string;
  kind?: 'physical' | 'virtual' | string;
};

type PracticeClinicianSummary = {
  id: string;
  name: string;
  specialty?: string;
  gender?: string;
  priceCents?: number;
  currency?: string;
  rating?: number;
  acceptsMedicalAid?: boolean;
  hasEncounter?: boolean;
};

type PracticeEncounterSummary = {
  id: string;
  startedAt: string;
  clinicianName?: string;
  summary?: string;
  status?: string;
  type?: string;
  ratingScore?: number | null;
};

type YourPracticeRating = {
  score: number;
  comment?: string;
  createdAt?: string;
};

type PracticePatientView = {
  practice: {
    id: string;
    name: string;
    class?: string; // team/clinic/hospital
    subType?: string;
    rating?: number;
    ratingCount?: number;
    logoUrl?: string;
    tagline?: string;
    bio?: string;
    acceptsMedicalAid?: boolean;
    acceptedSchemes?: string[];

    services?: string[];
    specialties?: string[];

    operatingHours?: OperatingHours[];
    locations?: PracticeLocation[];

    hasEncounter?: boolean;
    lastEncounterAt?: string | null;
    encounterCount?: number;

    yourRating?: YourPracticeRating | null;
  };
  clinicians?: PracticeClinicianSummary[];
  encounters?: PracticeEncounterSummary[];
};

const GATEWAY = process.env.NEXT_PUBLIC_APIGW_BASE ?? '';

function formatZarFromCents(cents?: number) {
  if (typeof cents !== 'number') return '';
  const rands = (cents / 100).toFixed(2);
  return `R ${rands}`;
}

function formatDateTime(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function normalizeHours(raw: any): OperatingHours[] {
  if (!raw) return [];
  const arr: any[] = Array.isArray(raw) ? raw : [raw];
  return arr
    .map((h, idx): OperatingHours | null => {
      if (!h) {
        return {
          label: idx === 0 ? 'Hours' : undefined,
          opensAt: undefined,
          closesAt: undefined,
          timezone: undefined,
        };
      }
      const kind =
        h.kind ??
        h.mode ??
        h.channel ??
        h.type ??
        undefined;

      const label =
        h.label ??
        h.days ??
        h.dayRange ??
        h.day ??
        (idx === 0 ? 'Mon–Fri' : 'Hours');

      const opens =
        h.opensAt ??
        h.opens ??
        h.open ??
        h.startTime ??
        undefined;
      const closes =
        h.closesAt ??
        h.closes ??
        h.close ??
        h.endTime ??
        undefined;

      const tz = h.timezone ?? h.tz ?? 'Africa/Johannesburg';

      return {
        kind,
        label,
        opensAt: opens,
        closesAt: closes,
        timezone: tz,
      };
    })
    .filter(Boolean) as OperatingHours[];
}

// Build a minimal patient view from mock PRACTICES as fallback
function buildViewFromMock(id: string): PracticePatientView | null {
  const p = PRACTICES.find((x) => x.id === id);
  if (!p) return null;

  const classLabel =
    p.kind === 'team'
      ? 'Team practice'
      : p.kind === 'clinic'
      ? 'Clinic'
      : 'Hospital';

  const loc: PracticeLocation = {
    id: `${p.id}-loc`,
    label: 'Primary location',
    address1: p.location,
    city: undefined,
    province: undefined,
    country: 'South Africa',
    kind: p.kind === 'team' ? 'virtual' : 'physical',
  };

  const hours: OperatingHours[] = [
    {
      label: 'Mon–Fri',
      opensAt: '08:00',
      closesAt: '17:00',
      timezone: 'Africa/Johannesburg',
      kind: p.kind === 'team' ? 'virtual' : 'physical',
    },
  ];

  return {
    practice: {
      id: p.id,
      name: p.name,
      class: classLabel,
      subType: p.subType,
      rating: p.rating,
      ratingCount: p.ratingCount,
      logoUrl: undefined,
      tagline: undefined,
      bio: undefined,
      acceptsMedicalAid: p.acceptsMedicalAid,
      acceptedSchemes: p.acceptedSchemes ?? [],
      services: [],
      specialties: [],
      operatingHours: hours,
      locations: [loc],
      hasEncounter: p.hasEncounter,
      lastEncounterAt: p.lastEncounterAt ?? null,
      encounterCount: p.encounterCount,
      yourRating: null,
    },
    clinicians: [],
    encounters: [],
  };
}

export default function PracticePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;

  const [view, setView] = useState<PracticePatientView | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setBusy(true);
        setErr(null);

        // If no gateway configured, go straight to mock fallback
        if (!GATEWAY) {
          const mockView = buildViewFromMock(id);
          if (!mockView) {
            throw new Error('Practice not found (demo directory)');
          }
          if (!cancelled) {
            setView(mockView);
            setErr('Showing directory view (demo data, no live bookings).');
          }
          return;
        }

        const res = await fetch(
          `${GATEWAY}/api/practices/${encodeURIComponent(id)}/patient-view`,
          {
            cache: 'no-store',
          },
        );
        const js = await res.json().catch(() => null);
        if (!res.ok || !js || !js.practice) {
          throw new Error(js?.error || `Failed to load practice (HTTP ${res.status})`);
        }

        const normalized: PracticePatientView = {
          practice: {
            id: String(js.practice.id ?? id),
            name: String(js.practice.name ?? 'Practice'),
            class: js.practice.class ?? js.practice.type ?? js.practice.kind ?? undefined,
            subType: js.practice.subType ?? js.practice.segment ?? js.practice.practiceType ?? undefined,
            rating:
              typeof js.practice.rating === 'number'
                ? js.practice.rating
                : typeof js.practice.avgRating === 'number'
                ? js.practice.avgRating
                : undefined,
            ratingCount:
              typeof js.practice.ratingCount === 'number'
                ? js.practice.ratingCount
                : typeof js.practice.ratingsCount === 'number'
                ? js.practice.ratingsCount
                : undefined,
            logoUrl: js.practice.logoUrl ?? js.practice.logo ?? undefined,
            tagline: js.practice.tagline ?? js.practice.header ?? undefined,
            bio: js.practice.bio ?? js.practice.about ?? undefined,
            acceptsMedicalAid:
              typeof js.practice.acceptsMedicalAid === 'boolean'
                ? js.practice.acceptsMedicalAid
                : !!js.practice.medicalAidAccepted,
            acceptedSchemes: Array.isArray(js.practice.acceptedSchemes)
              ? js.practice.acceptedSchemes
              : typeof js.practice.acceptedSchemesCsv === 'string'
              ? String(js.practice.acceptedSchemesCsv)
                  .split(',')
                  .map((s: string) => s.trim())
                  .filter(Boolean)
              : [],
            services: Array.isArray(js.practice.services)
              ? js.practice.services
              : [],
            specialties: Array.isArray(js.practice.specialties)
              ? js.practice.specialties
              : [],
            operatingHours: normalizeHours(js.practice.operatingHours ?? js.practice.hours),
            locations: Array.isArray(js.practice.locations)
              ? js.practice.locations.map((loc: any, idx: number): PracticeLocation => ({
                  id: String(loc.id ?? idx),
                  label: loc.label ?? loc.name ?? undefined,
                  address1:
                    loc.address1 ??
                    loc.addressLine1 ??
                    loc.address ??
                    undefined,
                  address2: loc.address2 ?? loc.addressLine2 ?? undefined,
                  city: loc.city ?? loc.town ?? undefined,
                  province: loc.province ?? loc.state ?? undefined,
                  country: loc.country ?? 'South Africa',
                  kind: loc.kind ?? loc.type ?? undefined,
                }))
              : undefined,

            hasEncounter:
              Boolean(js.practice.hasEncounter) ||
              (typeof js.practice.encounterCount === 'number' && js.practice.encounterCount > 0),
            lastEncounterAt:
              js.practice.lastEncounterAt ??
              js.practice.lastVisitAt ??
              js.practice.lastConsultAt ??
              null,
            encounterCount: js.practice.encounterCount ?? js.practice.visitsCount ?? undefined,

            yourRating: js.practice.yourRating ?? null,
          },
          clinicians: Array.isArray(js.clinicians)
            ? js.clinicians.map(
                (c: any): PracticeClinicianSummary => ({
                  id: String(c.id ?? c.clinicianId),
                  name: String(c.name ?? 'Clinician'),
                  specialty: c.specialty ?? c.discipline ?? undefined,
                  gender: c.gender ?? undefined,
                  priceCents:
                    typeof c.priceCents === 'number'
                      ? c.priceCents
                      : typeof c.feeCents === 'number'
                      ? c.feeCents
                      : undefined,
                  currency: c.currency ?? 'ZAR',
                  rating:
                    typeof c.rating === 'number'
                      ? c.rating
                      : typeof c.avgRating === 'number'
                      ? c.avgRating
                      : undefined,
                  acceptsMedicalAid:
                    typeof c.acceptsMedicalAid === 'boolean'
                      ? c.acceptsMedicalAid
                      : !!c.medicalAidAccepted,
                  hasEncounter: !!c.hasEncounter,
                }),
              )
            : [],
          encounters: Array.isArray(js.encounters)
            ? js.encounters.map(
                (e: any): PracticeEncounterSummary => ({
                  id: String(e.id),
                  startedAt: e.startedAt ?? e.started_at ?? e.started ?? e.createdAt ?? new Date().toISOString(),
                  clinicianName: e.clinicianName ?? e.clinician_name ?? undefined,
                  summary: e.summary ?? e.notes ?? undefined,
                  status: e.status ?? undefined,
                  type: e.type ?? undefined,
                  ratingScore:
                    typeof e.ratingScore === 'number'
                      ? e.ratingScore
                      : typeof e.score === 'number'
                      ? e.score
                      : null,
                }),
              )
            : [],
        };

        if (!cancelled) setView(normalized);
      } catch (e: any) {
        if (!cancelled) {
          // Try mock fallback if gateway call failed
          const mockView = buildViewFromMock(id);
          if (mockView) {
            setView(mockView);
            setErr(
              (e?.message || 'Failed to load live practice view') +
                ' – showing directory view instead (demo data).',
            );
          } else {
            setErr(e?.message || 'Failed to load practice');
            setView(null);
          }
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const practice = view?.practice;
  const clinicians = view?.clinicians ?? [];
  const encounters = view?.encounters ?? [];

  const sortedClinicians = useMemo(() => {
    const arr = clinicians.slice();
    arr.sort((a, b) => {
      const aSeen = a.hasEncounter ? 1 : 0;
      const bSeen = b.hasEncounter ? 1 : 0;
      if (aSeen !== bSeen) return bSeen - aSeen;
      const rA = a.rating ?? 0;
      const rB = b.rating ?? 0;
      if (rA !== rB) return rB - rA;
      return a.name.localeCompare(b.name);
    });
    return arr;
  }, [clinicians]);

  const sortedEncounters = useMemo(() => {
    const arr = encounters.slice();
    arr.sort((a, b) => {
      const tA = Date.parse(a.startedAt);
      const tB = Date.parse(b.startedAt);
      return tB - tA;
    });
    return arr;
  }, [encounters]);

  if (busy && !practice) {
    return (
      <main className="p-6 max-w-5xl mx-auto">
        <div className="rounded-2xl border bg-white p-5 text-sm text-gray-600">
          Loading practice…
        </div>
      </main>
    );
  }

  if (!practice) {
    return (
      <main className="p-6 max-w-5xl mx-auto">
        <div className="text-rose-600">{err ?? 'Practice not found.'}</div>
        <Link href="/practices" className="text-sm underline block mt-2">
          ← Back to practices
        </Link>
      </main>
    );
  }

  const visited = practice.hasEncounter || encounters.length > 0;
  const lastEncounter = practice.lastEncounterAt ?? encounters[0]?.startedAt ?? null;

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="text-sm text-teal-700 hover:underline"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-semibold text-center">{practice.name}</h1>
        <Link href="/practices" className="text-sm text-teal-700 hover:underline">
          All practices
        </Link>
      </header>

      {err && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {err} (showing what we could load)
        </div>
      )}

      <section className="bg-white rounded-2xl border p-5 flex items-start justify-between gap-6">
        {/* LEFT: practice summary */}
        <div className="space-y-3 flex-1">
          <div className="flex items-start gap-3">
            {practice.logoUrl ? (
              <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={practice.logoUrl}
                  alt={practice.name}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="h-12 w-12 rounded-full bg-indigo-600 text-white grid place-items-center font-semibold">
                {practice.name
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((x) => x[0])
                  .join('')
                  .toUpperCase()}
              </div>
            )}

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-medium">{practice.name}</h2>
                {practice.class && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-700 bg-gray-50">
                    {practice.class}
                  </span>
                )}
                {practice.subType && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-600 bg-gray-50">
                    {practice.subType}
                  </span>
                )}
                {visited && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-indigo-200 text-indigo-800 bg-indigo-50">
                    You&apos;ve consulted here
                  </span>
                )}
              </div>

              <div className="mt-1 text-sm text-gray-600">
                ★ {(practice.rating ?? 0).toFixed(1)}
                {practice.ratingCount != null && (
                  <span className="text-xs text-gray-500">
                    {' '}
                    ({practice.ratingCount} rating
                    {practice.ratingCount === 1 ? '' : 's'})
                  </span>
                )}
              </div>

              {practice.tagline && (
                <div className="mt-1 text-sm text-gray-700">{practice.tagline}</div>
              )}

              {visited && (
                <div className="mt-2 text-xs text-gray-600">
                  You&apos;ve had{' '}
                  <b>{practice.encounterCount ?? encounters.length}</b> consultation
                  {practice.encounterCount === 1 || encounters.length === 1 ? '' : 's'} here. Last
                  seen: <b>{formatDateTime(lastEncounter)}</b>.
                </div>
              )}

              {typeof practice.acceptsMedicalAid === 'boolean' && (
                <div className="mt-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${
                      practice.acceptsMedicalAid
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-gray-50 border-gray-200 text-gray-700'
                    }`}
                  >
                    {practice.acceptsMedicalAid
                      ? 'Accepts eligible Medical Aid / insurance claims'
                      : 'Private pay only (no Medical Aid claims via Ambulant+)'}
                  </span>
                </div>
              )}

              {practice.acceptedSchemes && practice.acceptedSchemes.length > 0 && (
                <div className="mt-2">
                  <div className="text-[11px] text-gray-500 mb-1">
                    Selected Medical Aid / insurance schemes accepted
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {practice.acceptedSchemes.map((s) => (
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
            </div>
          </div>

          {practice.bio && (
            <p className="text-sm text-gray-700 mt-2 max-w-2xl whitespace-pre-line">
              {practice.bio}
            </p>
          )}

          {(practice.services?.length || practice.specialties?.length) && (
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              {practice.services && practice.services.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-1">
                    Services
                  </div>
                  <div className="flex flex-wrap gap-1 text-[11px] text-gray-700">
                    {practice.services.map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 rounded-full bg-gray-50 border border-gray-200"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {practice.specialties && practice.specialties.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-1">
                    Specialties
                  </div>
                  <div className="flex flex-wrap gap-1 text-[11px] text-gray-700">
                    {practice.specialties.map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 rounded-full bg-gray-50 border border-gray-200"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {practice.operatingHours && practice.operatingHours.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-semibold text-gray-600 mb-1">
                Operating hours
              </div>
              <ul className="space-y-1 text-xs text-gray-700">
                {practice.operatingHours.map((h, idx) => (
                  <li key={`${h.label}-${idx}`} className="flex flex-wrap gap-2">
                    <span className="font-medium">{h.label ?? 'Hours'}:</span>
                    {h.opensAt && h.closesAt ? (
                      <span>
                        {h.opensAt} – {h.closesAt}{' '}
                        {h.timezone && (
                          <span className="text-[11px] text-gray-500">({h.timezone})</span>
                        )}
                      </span>
                    ) : (
                      <span>See calendar for specific availability</span>
                    )}
                    {h.kind && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50">
                        {h.kind}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {practice.locations && practice.locations.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-semibold text-gray-600 mb-1">
                Locations
              </div>
              <ul className="space-y-1 text-xs text-gray-700">
                {practice.locations.map((loc) => (
                  <li
                    key={loc.id}
                    className="border rounded-lg px-3 py-2 bg-gray-50"
                  >
                    {loc.label && (
                      <div className="font-medium text-sm mb-0.5">{loc.label}</div>
                    )}
                    <div className="text-xs text-gray-600">
                      {[loc.address1, loc.address2, loc.city, loc.province, loc.country]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                    {loc.kind && (
                      <div className="mt-0.5 text-[11px] text-gray-500">
                        {loc.kind === 'virtual'
                          ? 'Virtual / telehealth'
                          : 'Physical location'}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {practice.yourRating && (
            <div className="mt-3 border rounded-lg bg-emerald-50 border-emerald-200 px-3 py-2 text-xs text-emerald-900">
              <div className="font-semibold text-[11px] uppercase tracking-wide mb-1">
                Your rating
              </div>
              <div>
                ★ {practice.yourRating.score.toFixed(1)}{' '}
                {practice.yourRating.createdAt && (
                  <span className="text-[11px] text-emerald-700">
                    on {formatDate(practice.yourRating.createdAt)}
                  </span>
                )}
              </div>
              {practice.yourRating.comment && (
                <div className="mt-1 text-[11px]">
                  “{practice.yourRating.comment}”
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-gray-500 mt-3 max-w-2xl">
            Bookings from this practice page are for a{' '}
            <b>first consultation or a new case</b> with any available clinician in the
            practice, or with a specific clinician you choose.
            <br />
            Follow-ups can only be booked from your <b>Case / Encounter</b> context (active,
            undischarged case).
          </p>
        </div>

        {/* RIGHT: actions */}
        <aside className="shrink-0 flex flex-col gap-2 w-full max-w-xs">
          <Link
            href={`/practices/${encodeURIComponent(practice.id)}/calendar`}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 text-center"
          >
            Book with any available clinician
          </Link>

          <a
            href="#practice-clinicians"
            className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50 text-center"
          >
            Choose a specific clinician in this practice
          </a>

          {visited && (
            <div className="mt-2 text-[11px] text-gray-500">
              You can also book follow-ups directly from your{' '}
              <Link href="/encounters" className="underline">
                Cases &amp; Encounters
              </Link>{' '}
              page.
            </div>
          )}
        </aside>
      </section>

      {/* Clinicians in this practice */}
      {sortedClinicians.length > 0 && (
        <section
          id="practice-clinicians"
          className="bg-white rounded-2xl border p-5"
        >
          <h2 className="text-lg font-semibold mb-3">
            Clinicians in this practice
          </h2>
          <p className="text-xs text-gray-600 mb-3">
            You can book a new consultation with any of the clinicians below. If a clinician
            isn&apos;t available at your chosen time, the calendar will suggest alternatives
            from this practice.
          </p>

          <ul className="divide-y">
            {sortedClinicians.map((c) => (
              <li
                key={c.id}
                className="py-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-indigo-600 text-white grid place-items-center text-xs font-semibold">
                    {c.name
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((x) => x[0])
                      .join('')
                      .toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-sm">{c.name}</div>
                      {c.hasEncounter && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-indigo-200 text-indigo-800 bg-indigo-50">
                          You&apos;ve consulted with this clinician
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600">
                      {c.specialty ?? 'Clinician'}{' '}
                      {c.gender && <span>• {c.gender}</span>}
                    </div>
                    <div className="text-xs text-amber-700 mt-0.5">
                      ★ {(c.rating ?? 0).toFixed(1)}
                    </div>
                    {c.priceCents != null && (
                      <div className="text-[11px] text-gray-700 mt-0.5">
                        From{' '}
                        <b>
                          {formatZarFromCents(c.priceCents)}{' '}
                          {c.currency ?? 'ZAR'}
                        </b>{' '}
                        / consult
                      </div>
                    )}
                    {typeof c.acceptsMedicalAid === 'boolean' && (
                      <div className="mt-0.5 text-[11px]">
                        {c.acceptsMedicalAid ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-800">
                            Accepts Medical Aid / insurance
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-gray-700">
                            Private pay only
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Link
                    href={`/clinicians/${encodeURIComponent(c.id)}`}
                    className="px-3 py-1.5 rounded border text-xs bg-white hover:bg-gray-50 text-center"
                  >
                    View clinician
                  </Link>
                  <Link
                    href={`/practices/${encodeURIComponent(
                      practice.id,
                    )}/calendar?clinicianId=${encodeURIComponent(c.id)}`}
                    className="px-3 py-1.5 rounded bg-indigo-600 text-white text-xs text-center hover:bg-indigo-700"
                  >
                    Book with {c.name.split(' ')[0]}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Encounters at this practice */}
      <section className="bg-white rounded-2xl border p-5">
        <h2 className="text-lg font-semibold mb-3">Your encounters at this practice</h2>
        {sortedEncounters.length === 0 ? (
          <p className="text-sm text-gray-600">
            You haven&apos;t had any consultations at this practice via Ambulant+ yet.
          </p>
        ) : (
          <ul className="space-y-2 text-sm text-gray-700">
            {sortedEncounters.map((e) => (
              <li
                key={e.id}
                className="border rounded-lg px-3 py-2 bg-gray-50"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">
                    {e.clinicianName ?? 'Clinician'}
                    {e.type && (
                      <span className="text-[11px] ml-2 px-2 py-0.5 rounded-full border border-gray-200 bg-white text-gray-700">
                        {e.type}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDateTime(e.startedAt)}
                  </div>
                </div>
                {e.summary && (
                  <div className="text-xs text-gray-700 mt-1">
                    {e.summary}
                  </div>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-gray-600">
                  {e.status && (
                    <span className="capitalize">
                      Status: <b>{e.status}</b>
                    </span>
                  )}
                  {typeof e.ratingScore === 'number' && (
                    <span>
                      Your rating: <b>★ {e.ratingScore.toFixed(1)}</b>
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
