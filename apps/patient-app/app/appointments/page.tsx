// apps/patient-app/app/appointments/page.tsx
'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

const GATEWAY = process.env.NEXT_PUBLIC_APIGW_BASE ?? 'http://localhost:3010';

type Appt = {
  id: string;
  clinicianId: string;
  clinicianName?: string;
  startsAt: string;
  endsAt: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | string;
  reason?: string;
  location?: string;
  roomId?: string;
  patientId?: string;
  subjectPatientId?: string | null;
  hostUserId?: string | null;
  familyRelationshipId?: string | null;
};

type Rating = {
  score: 1 | 2 | 3 | 4 | 5;
  comment?: string | null;
  createdAt?: string | null;
};

type AuthMe = {
  ok?: boolean;
  uid?: string | null;
  userId?: string | null;
  actorType?: string | null;
  actorRefId?: string | null;
  orgId?: string | null;
  user?: {
    id?: string | null;
    actorType?: string | null;
    actorRefId?: string | null;
    orgId?: string | null;
  } | null;
};

const DEFAULT_ORG_ID =
  process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || 'org-default';

function getIdentityHeaders(me?: AuthMe | null): HeadersInit {
  const uid =
    me?.uid ||
    me?.userId ||
    me?.user?.id ||
    '';

  const orgId =
    me?.orgId ||
    me?.user?.orgId ||
    DEFAULT_ORG_ID;

  return {
    'x-role': 'patient',
    ...(uid ? { 'x-uid': String(uid) } : {}),
    ...(orgId ? { 'x-org-id': String(orgId) } : {}),
  };
}

function statusChipClasses(status: string) {
  const base = 'px-2 py-0.5 rounded-full text-xs border';
  const s = String(status || '').toLowerCase();

  if (s === 'scheduled' || s === 'confirmed' || s === 'pending_payment') {
    return `${base} bg-emerald-50 border-emerald-200 text-emerald-700`;
  }
  if (s === 'completed' || s === 'done' || s === 'closed') {
    return `${base} bg-sky-50 border-sky-200 text-sky-700`;
  }
  if (s === 'cancelled' || s === 'canceled') {
    return `${base} bg-rose-50 border-rose-200 text-rose-700`;
  }

  return `${base} bg-gray-50 border-gray-200 text-gray-700`;
}

function isCompleted(status: string) {
  const s = String(status || '').toLowerCase();
  return s === 'completed' || s === 'done' || s === 'closed';
}

function starsText(score: number) {
  const s = Math.max(0, Math.min(5, Math.round(score)));
  return '★'.repeat(s) + '☆'.repeat(5 - s);
}

async function fetchAuthMe(): Promise<AuthMe | null> {
  try {
    const r = await fetch('/api/auth/me', {
      cache: 'no-store',
      credentials: 'include',
    });

    if (!r.ok) return null;

    const raw = (await r.json()) as AuthMe;
    const user = raw?.user || null;

    return {
      ...raw,
      uid: raw.uid || raw.userId || user?.id || null,
      userId: raw.userId || user?.id || null,
      actorType: raw.actorType || user?.actorType || null,
      actorRefId: raw.actorRefId || user?.actorRefId || null,
      orgId: raw.orgId || user?.orgId || DEFAULT_ORG_ID,
      user,
    };
  } catch {
    return null;
  }
}

async function fetchAppointmentRating(apptId: string, me?: AuthMe | null): Promise<Rating | null> {
  try {
    const res = await fetch(`${GATEWAY}/api/appointments/${encodeURIComponent(apptId)}/rating`, {
      cache: 'no-store',
      headers: getIdentityHeaders(me),
    });

    if (res.status === 404) return null;
    if (!res.ok) return null;

    const j = await res.json().catch(() => ({} as any));
    const r = j?.rating ?? j?.data?.rating ?? j?.data ?? j;

    const scoreRaw = r?.score ?? r?.stars ?? r?.rating;
    const scoreNum = typeof scoreRaw === 'number' ? scoreRaw : Number(scoreRaw);

    if (!Number.isFinite(scoreNum) || scoreNum < 1 || scoreNum > 5) return null;

    return {
      score: scoreNum as any,
      comment: r?.comment ?? r?.text ?? null,
      createdAt: r?.createdAt ?? r?.created_at ?? null,
    };
  } catch {
    return null;
  }
}

function PatientAppointmentsContent() {
  const sp = useSearchParams();
  const subjectPatientId = sp?.get('subjectPatientId')?.trim() || '';
  const relationshipId = sp?.get('relationshipId')?.trim() || '';

  const [bookingChoiceOpen, setBookingChoiceOpen] = useState(false);

  function withBookingContext(path: string) {
    const qs = new URLSearchParams();

    if (subjectPatientId) qs.set('subjectPatientId', subjectPatientId);
    if (relationshipId) qs.set('relationshipId', relationshipId);

    const suffix = qs.toString();
    return `${path}${suffix ? `?${suffix}` : ''}`;
  }

  const [me, setMe] = useState<AuthMe | null>(null);
  const [items, setItems] = useState<Appt[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [ratingById, setRatingById] = useState<Record<string, Rating | null | undefined>>({});

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!cancelled) {
          setLoading(true);
          setErr(null);
        }

        const auth = await fetchAuthMe();
        if (!cancelled) setMe(auth);

        const qs = new URLSearchParams();
        if (subjectPatientId) qs.set('subjectPatientId', subjectPatientId);
        if (relationshipId) qs.set('relationshipId', relationshipId);

        const r = await fetch(`/api/appointments${qs.toString() ? `?${qs.toString()}` : ''}`, {
          cache: 'no-store',
          credentials: 'include',
          headers: getIdentityHeaders(auth),
        });

        if (!r.ok) throw new Error(await r.text());
        const j = await r.json().catch(() => ({} as any));

        if (!cancelled) {
          setItems(Array.isArray(j?.appointments) ? j.appointments : []);
        }
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message || 'Failed to load appointments');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [subjectPatientId, relationshipId]);

  const now = Date.now();

  const upcoming = useMemo(() => {
    return items
      .filter((a) => new Date(a.startsAt).getTime() >= now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [items, now]);

  const past = useMemo(() => {
    return items
      .filter((a) => new Date(a.startsAt).getTime() < now)
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  }, [items, now]);

  useEffect(() => {
    let cancelled = false;

    const idsToCheck = past
      .filter((a) => isCompleted(a.status))
      .map((a) => a.id)
      .filter((id) => ratingById[id] === undefined);

    if (idsToCheck.length === 0) return;

    (async () => {
      const results = await Promise.all(idsToCheck.map((id) => fetchAppointmentRating(id, me)));
      if (cancelled) return;

      setRatingById((prev) => {
        const next = { ...prev };
        idsToCheck.forEach((id, idx) => {
          next[id] = results[idx];
        });
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [past, me, ratingById]);

  const detailHref = (id: string) => {
    const qs = new URLSearchParams();
    if (subjectPatientId) qs.set('subjectPatientId', subjectPatientId);
    if (relationshipId) qs.set('relationshipId', relationshipId);
    return `/appointments/${encodeURIComponent(id)}${qs.toString() ? `?${qs.toString()}` : ''}`;
  };

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">My Appointments</h1>

          <p className="mt-1 text-xs text-neutral-500">
            These are your upcoming and recent bookings. Completed visits will appear under{' '}
            <span className="font-medium">My Cases</span>.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setBookingChoiceOpen(true)}
          className="w-fit rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
        >
          Start booking
        </button>
      </header>

      {subjectPatientId && (
        <div className="rounded-lg border bg-amber-50 border-amber-200 p-3 text-sm text-amber-900">
          Acting for subject patient <span className="font-medium">{subjectPatientId}</span>
        </div>
      )}

      {loading && (
        <div className="rounded-lg border bg-white p-3 text-sm text-gray-600">
          Loading your appointments…
        </div>
      )}

      {err && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded p-3">
          {err}
        </div>
      )}

      {!loading && items.length === 0 && !err && (
        <div className="bg-white border rounded p-4 text-sm text-gray-700">
          <div className="font-semibold text-gray-900">No appointments yet</div>
          <p className="mt-1">
            When you book a consultation, we&apos;ll show the date, time and clinician here.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setBookingChoiceOpen(true)}
              className="px-3 py-1.5 rounded-full text-xs bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Start booking
            </button>
            <Link
              href="/clinicians"
              className="px-3 py-1.5 rounded-full text-xs border bg-white hover:bg-gray-50"
            >
              Find a clinician
            </Link>
            <Link
              href={subjectPatientId ? `/encounters?subjectPatientId=${encodeURIComponent(subjectPatientId)}${relationshipId ? `&relationshipId=${encodeURIComponent(relationshipId)}` : ''}` : '/encounters'}
              className="px-3 py-1.5 rounded-full text-xs border bg-white hover:bg-gray-50"
            >
              View your cases
            </Link>
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Upcoming</h2>
          <div className="bg-white border rounded divide-y">
            {upcoming.map((a) => {
              const start = new Date(a.startsAt);
              const end = new Date(a.endsAt);
              const rel = formatDistanceToNow(start, { addSuffix: true });
              const status = String(a.status || '').toLowerCase();
              const canJoin =
                (status === 'scheduled' || status === 'confirmed' || status === 'checked_in') &&
                Boolean(a.roomId);

              return (
                <div
                  key={a.id}
                  className="p-3 text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="font-medium">{a.reason || 'Consultation'}</div>
                    <div className="text-gray-600">
                      {start.toLocaleString()} – {end.toLocaleTimeString()}
                      <span className="ml-1 text-xs text-gray-400">({rel})</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {a.clinicianName ? a.clinicianName : `Clinician: ${a.clinicianId}`}
                      {a.location ? ` · ${a.location}` : ''}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 md:flex-row flex-row-reverse">
                    <span className={statusChipClasses(a.status)}>{a.status}</span>

                    <Link
                      href={detailHref(a.id)}
                      className="text-xs text-blue-700 underline underline-offset-2"
                    >
                      View details
                    </Link>

                    <Link
                      href={canJoin ? `/sfu/${a.roomId}` : '#'}
                      className={`text-xs px-2 py-1 rounded border ${
                        canJoin
                          ? 'border-blue-600 text-blue-700 hover:bg-blue-50'
                          : 'border-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                      aria-disabled={!canJoin}
                    >
                      Join Televisit
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Past</h2>
          <div className="bg-white border rounded divide-y">
            {past.map((a) => {
              const start = new Date(a.startsAt);
              const end = new Date(a.endsAt);
              const rel = formatDistanceToNow(start, { addSuffix: true });

              const completed = isCompleted(a.status);
              const rating = ratingById[a.id];

              return (
                <div key={a.id} className="p-3 text-sm flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{a.reason || 'Consultation'}</div>
                    <div className="text-gray-600">
                      {start.toLocaleString()} – {end.toLocaleTimeString()}
                      <span className="ml-1 text-xs text-gray-400">({rel})</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {a.clinicianName ? a.clinicianName : `Clinician: ${a.clinicianId}`}
                    </div>

                    {completed && (
                      <div className="mt-1 text-xs">
                        {rating === undefined ? (
                          <span className="text-gray-400">Checking rating…</span>
                        ) : rating === null ? (
                          <Link
                            href={`${detailHref(a.id)}${detailHref(a.id).includes('?') ? '&' : '?'}rate=1`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                            title="Rate this visit"
                          >
                            ★ Rate visit
                          </Link>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-white text-gray-700">
                            Rated {starsText(rating.score)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className={statusChipClasses(a.status)}>{a.status}</span>

                    <Link
                      href={detailHref(a.id)}
                      className="text-xs text-blue-700 underline underline-offset-2"
                    >
                      View details
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}


      {bookingChoiceOpen && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4"
          onClick={() => setBookingChoiceOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl border bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">How would you like to book?</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Choose a clinician directly, or start from a team, clinic, or hospital.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setBookingChoiceOpen(false)}
                className="rounded-full border px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link
                href={withBookingContext('/clinicians')}
                className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left hover:bg-emerald-100"
              >
                <div className="font-semibold text-emerald-950">Choose a clinician</div>
                <p className="mt-1 text-xs leading-5 text-emerald-900">
                  Best when you already know the doctor, specialist, allied-health provider, or wellness clinician you want.
                </p>
              </Link>

              <Link
                href={withBookingContext('/practices')}
                className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-left hover:bg-indigo-100"
              >
                <div className="font-semibold text-indigo-950">Choose a practice</div>
                <p className="mt-1 text-xs leading-5 text-indigo-900">
                  Best when you want to book through a team, clinic, hospital, or multi-provider facility.
                </p>
              </Link>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              Medical Aid / sponsor cover is checked later during booking, after the provider and patient are confirmed.
            </div>
          </div>
        </div>
      )}

    </main>
  );
}

export default function PatientAppointments() {
  return (
    <Suspense fallback={null}>
      <PatientAppointmentsContent />
    </Suspense>
  );
}

