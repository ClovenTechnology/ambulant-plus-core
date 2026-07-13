'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

const GATEWAY =
  process.env.NEXT_PUBLIC_APIGW_BASE ?? (process.env.NODE_ENV === 'production' ? 'https://api-gateway.ambulantplus.co.za' : 'http://localhost:3010');

const PAGE_SIZE = 10;

const DEFAULT_ORG_ID =
  process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || 'org-default';

type AppointmentStatus =
  | 'Scheduled'
  | 'Completed'
  | 'Cancelled'
  | 'pending_payment'
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'in_consult'
  | string;

type Appointment = {
  id: string;
  clinicianId: string;
  clinicianName?: string | null;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  reason?: string | null;
  location?: string | null;
  roomId?: string | null;
  patientId?: string | null;
  subjectPatientId?: string | null;
  hostUserId?: string | null;
  familyRelationshipId?: string | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  paymentProvider?: string | null;
  paymentRef?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  patientJoinUrl?: string | null;
  clinicianJoinUrl?: string | null;
  patientParticipantId?: string | null;
  clinicianParticipantId?: string | null;
  clinicianSpecialty?: string | null;
  clinicianAvatarUrl?: string | null;
  clinicianLocation?: string | null;
  patientName?: string | null;
  patientAvatarUrl?: string | null;
};

type Rating = {
  score: 1 | 2 | 3 | 4 | 5;
  comment?: string | null;
  createdAt?: string | null;
};

type PaymentState = {
  ready?: boolean;
  pending?: boolean;
  failed?: boolean;
  paymentStatus?: string;
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

function getIdentityHeaders(me?: AuthMe | null): HeadersInit {
  const uid =
    me?.uid ||
    me?.userId ||
    me?.user?.id ||
    '';

  const actorRefId =
    me?.actorRefId ||
    me?.user?.actorRefId ||
    '';

  const orgId =
    me?.orgId || me?.user?.orgId || DEFAULT_ORG_ID;

  return {
    'x-role': 'patient',
    ...(uid ? { 'x-uid': String(uid), 'x-ambulant-user-id': String(uid) } : {}),
    ...(actorRefId ? { 'x-actor-ref-id': String(actorRefId), 'x-patient-id': String(actorRefId) } : {}),
    ...(orgId ? { 'x-org-id': String(orgId) } : {}),
  };
}

function normalizeStatus(status: string) {
  return String(status || '').trim().toLowerCase();
}

function isCompleted(status: string) {
  const s = normalizeStatus(status);
  return s === 'completed' || s === 'done' || s === 'closed';
}

function paymentStatusOf(a: Appointment, paymentState?: PaymentState | null) {
  return normalizeStatus(
    String(paymentState?.paymentStatus || a.paymentStatus || ''),
  );
}

function paymentIsPending(a: Appointment, paymentState?: PaymentState | null) {
  const status = normalizeStatus(a.status);
  const paymentStatus = paymentStatusOf(a, paymentState);

  return (
    Boolean(paymentState?.pending) ||
    status === 'pending_payment' ||
    status === 'pending' ||
    ['pending', 'initiated', 'init', 'processing', 'authorization'].includes(paymentStatus)
  );
}

function paymentIsFailed(a: Appointment, paymentState?: PaymentState | null) {
  const status = normalizeStatus(a.status);
  const paymentStatus = paymentStatusOf(a, paymentState);

  return (
    Boolean(paymentState?.failed) ||
    ['failed', 'cancelled_payment_timeout', 'payment_expired', 'payment_init_failed'].includes(status) ||
    ['failed', 'abandoned', 'cancelled', 'canceled', 'expired'].includes(paymentStatus)
  );
}

function canJoinAppointment(a: Appointment, paymentState?: PaymentState | null) {
  const status = normalizeStatus(a.status);

  return (
    Boolean(a.patientJoinUrl || a.roomId) &&
    !paymentIsPending(a, paymentState) &&
    !paymentIsFailed(a, paymentState) &&
    [
      'scheduled',
      'confirmed',
      'checked_in',
      'in_consult',
      'in_progress',
      'active',
      'ready',
    ].includes(status)
  );
}

function joinBlockReason(a: Appointment, paymentState?: PaymentState | null) {
  if (!a.patientJoinUrl && !a.roomId) return 'Televisit room is not ready yet.';
  if (paymentIsPending(a, paymentState)) return 'Complete payment before joining the televisit.';
  if (paymentIsFailed(a, paymentState)) return 'Payment failed or expired. Please rebook or retry checkout.';

  const status = normalizeStatus(a.status);
  if (['completed', 'done', 'closed'].includes(status)) return 'This appointment has already been completed.';
  if (['cancelled', 'canceled'].includes(status)) return 'This appointment has been cancelled.';

  return 'This appointment is not ready for televisit entry yet.';
}

function joinHrefForAppointment(a: Appointment) {
  if (!a.roomId && a.patientJoinUrl) return a.patientJoinUrl;
  if (!a.roomId) return '#';

  const qs = new URLSearchParams();
  qs.set('appointmentId', a.id);
  qs.set('roomId', a.roomId);
  if (a.patientId) qs.set('patientId', a.patientId);
  if (a.subjectPatientId) qs.set('subjectPatientId', a.subjectPatientId);
  if (a.reason) qs.set('reason', a.reason);

  return `/lobby?${qs.toString()}`;
}

function statusChipClasses(status: string) {
  const base =
    'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium';

  const s = normalizeStatus(status);

  if (
    s === 'scheduled' ||
    s === 'confirmed' ||
    s === 'checked_in' ||
    s === 'in_consult'
  ) {
    return `${base} border-emerald-200 bg-emerald-50 text-emerald-700`;
  }

  if (s === 'pending_payment' || s === 'pending') {
    return `${base} border-amber-200 bg-amber-50 text-amber-800`;
  }

  if (s === 'completed' || s === 'done' || s === 'closed') {
    return `${base} border-sky-200 bg-sky-50 text-sky-700`;
  }

  if (s === 'cancelled' || s === 'canceled') {
    return `${base} border-rose-200 bg-rose-50 text-rose-700`;
  }

  return `${base} border-slate-200 bg-slate-50 text-slate-700`;
}

function starsText(score: number) {
  const value = Math.max(0, Math.min(5, Math.round(score)));
  return '★'.repeat(value) + '☆'.repeat(5 - value);
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

async function fetchAppointmentRating(
  appointmentId: string,
  me?: AuthMe | null,
): Promise<Rating | null> {
  try {
    const res = await fetch(
      `${GATEWAY}/api/appointments/${encodeURIComponent(
        appointmentId,
      )}/rating`,
      {
        cache: 'no-store',
        headers: getIdentityHeaders(me),
      },
    );

    if (res.status === 404) return null;
    if (!res.ok) return null;

    const raw = await res.json().catch(() => ({} as any));

    const rating =
      raw?.rating ?? raw?.data?.rating ?? raw?.data ?? raw;

    const scoreRaw =
      rating?.score ?? rating?.stars ?? rating?.rating;

    const score =
      typeof scoreRaw === 'number'
        ? scoreRaw
        : Number(scoreRaw);

    if (!Number.isFinite(score) || score < 1 || score > 5) {
      return null;
    }

    return {
      score: score as Rating['score'],
      comment: rating?.comment ?? rating?.text ?? null,
      createdAt:
        rating?.createdAt ?? rating?.created_at ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchPaymentState(
  appointmentId: string,
): Promise<PaymentState | null> {
  try {
    const res = await fetch(
      `/api/appointments/${encodeURIComponent(
        appointmentId,
      )}/payment-state`,
      {
        cache: 'no-store',
        credentials: 'include',
      },
    );

    if (!res.ok) return null;

    const raw = await res.json().catch(() => ({}));

    return {
      ready: Boolean(raw?.ready),
      pending: Boolean(raw?.pending),
      failed: Boolean(raw?.failed),
      paymentStatus: raw?.paymentStatus ?? '',
    };
  } catch {
    return null;
  }
}

function asAppointmentList(raw: any): Appointment[] {
  const source =
    Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.appointments)
        ? raw.appointments
        : Array.isArray(raw?.items)
          ? raw.items
          : Array.isArray(raw?.data?.appointments)
            ? raw.data.appointments
            : Array.isArray(raw?.data?.items)
              ? raw.data.items
              : Array.isArray(raw?.data)
                ? raw.data
                : Array.isArray(raw?.results)
                  ? raw.results
                  : [];

  return source
    .map((item: any) => {
      if (!item || typeof item !== 'object') return null;

      const id = String(item.id || item.appointmentId || item.appointment_id || '').trim();
      if (!id) return null;

      return {
        ...item,
        id,
        clinicianId: String(item.clinicianId || item.clinician_id || item.providerId || item.provider_id || '').trim(),
        clinicianName:
          item.clinicianName ||
          item.clinicianDisplayName ||
          item.clinician?.displayName ||
          item.clinician?.name ||
          item.meta?.clinicianDisplayName ||
          null,
        clinicianSpecialty:
          item.clinicianSpecialty ||
          item.clinician?.specialty ||
          item.meta?.clinicianSpecialty ||
          null,
        clinicianAvatarUrl:
          item.clinicianAvatarUrl ||
          item.clinician?.photoUrl ||
          item.meta?.clinicianAvatarUrl ||
          null,
        clinicianLocation:
          item.clinicianLocation ||
          item.clinician?.practiceName ||
          item.clinician?.city ||
          item.meta?.clinicianLocation ||
          null,
        patientName:
          item.patientName ||
          item.patientDisplayName ||
          item.meta?.patientDisplayName ||
          null,
        patientAvatarUrl:
          item.patientAvatarUrl ||
          item.meta?.patientAvatarUrl ||
          null,
        startsAt: item.startsAt || item.start || item.startTime || item.when || '',
        endsAt: item.endsAt || item.end || item.endTime || '',
        status: item.status || 'scheduled',
        paymentStatus:
          item.paymentStatus ||
          item.payment_status ||
          item.payment?.status ||
          null,
        roomId: item.roomId || item.room_id || item.meta?.roomId || null,
        patientJoinUrl:
          item.patientJoinUrl ||
          item.patient_join_url ||
          item.meta?.patientJoinUrl ||
          null,
        clinicianJoinUrl:
          item.clinicianJoinUrl ||
          item.clinician_join_url ||
          item.meta?.clinicianJoinUrl ||
          null,
      } as Appointment;
    })
    .filter(Boolean) as Appointment[];
}

function AppointmentStatusChip({ status }: { status: string }) {
  return (
    <span className={statusChipClasses(status)}>
      {status}
    </span>
  );
}

function AppointmentPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t bg-slate-50 px-4 py-3">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="rounded-full border bg-white px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
      >
        Previous
      </button>

      <div className="text-xs text-slate-500">
        Page {page} of {totalPages}
      </div>

      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="rounded-full border bg-white px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
}

function AppointmentSkeleton() {
  return (
    <main data-p-ui="patient-appointments-page" className="min-w-0 overflow-x-clip mx-auto max-w-4xl space-y-4 p-6">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div
          key={idx}
          className="animate-pulse rounded-3xl border bg-white p-5"
        >
          <div className="h-4 w-40 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-64 rounded bg-slate-100" />
          <div className="mt-2 h-3 w-52 rounded bg-slate-100" />
        </div>
      ))}
    </main>
  );
}

function EmptyAppointmentsState({
  openBooking,
  subjectPatientId,
  relationshipId,
}: {
  openBooking: () => void;
  subjectPatientId?: string;
  relationshipId?: string;
}) {
  return (
    <div className="rounded-3xl border bg-white p-6 shadow-sm">
      <div className="text-lg font-semibold text-slate-900">
        No appointments yet
      </div>

      <p className="mt-2 text-sm text-slate-600">
        Once you book a consultation, your upcoming and completed
        visits will appear here.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={openBooking}
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Start booking
        </button>

        <Link
          href="/clinicians"
          className="rounded-full border bg-white px-4 py-2 text-sm hover:bg-slate-50"
        >
          Find clinician
        </Link>

        <Link
          href={
            subjectPatientId
              ? `/encounters?subjectPatientId=${encodeURIComponent(
                  subjectPatientId,
                )}${
                  relationshipId
                    ? `&relationshipId=${encodeURIComponent(
                        relationshipId,
                      )}`
                    : ''
                }`
              : '/encounters'
          }
          className="rounded-full border bg-white px-4 py-2 text-sm hover:bg-slate-50"
        >
          View cases
        </Link>
      </div>
    </div>
  );
}

function BookingChoiceModal({
  open,
  onClose,
  withBookingContext,
}: {
  open: boolean;
  onClose: () => void;
  withBookingContext: (path: string) => string;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-3xl border bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              How would you like to book?
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              Choose a clinician directly or start from a practice,
              clinic, or hospital group.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border px-3 py-1 text-xs hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Link
            href={withBookingContext('/clinicians')}
            className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 transition hover:bg-emerald-100"
          >
            <div className="font-semibold text-emerald-950">
              Choose clinician
            </div>

            <p className="mt-2 text-sm leading-6 text-emerald-900">
              Best when you already know the provider or specialist
              you want to consult.
            </p>
          </Link>

          <Link
            href={withBookingContext('/practices')}
            className="rounded-3xl border border-indigo-200 bg-indigo-50 p-5 transition hover:bg-indigo-100"
          >
            <div className="font-semibold text-indigo-950">
              Choose practice
            </div>

            <p className="mt-2 text-sm leading-6 text-indigo-900">
              Best when you want to browse clinics, hospitals, or
              care teams.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}

function UpcomingAppointmentCard({
  appointment,
  detailHref,
  paymentState,
  onCancel,
}: {
  appointment: Appointment;
  detailHref: string;
  paymentState?: PaymentState | null;
  onCancel: (id: string) => void;
}) {
  const start = new Date(appointment.startsAt);
  const end = new Date(appointment.endsAt);

  const relative = formatDistanceToNow(start, {
    addSuffix: true,
  });

  const canJoin = canJoinAppointment(appointment, paymentState);
  const joinReason = joinBlockReason(appointment, paymentState);

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate text-base font-semibold text-slate-900">
              {appointment.reason || 'Consultation'}
            </div>

            <AppointmentStatusChip status={appointment.status} />
          </div>

          <div className="mt-3 text-sm text-slate-600">
            {start.toLocaleString()} – {end.toLocaleTimeString()}
          </div>

          <div className="mt-1 text-xs text-slate-500">
            {relative}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              {appointment.clinicianName || appointment.clinicianId}
            </span>

            {appointment.location && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                {appointment.location}
              </span>
            )}

            {paymentIsPending(appointment, paymentState) && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">
                Awaiting payment
              </span>
            )}

            {paymentIsFailed(appointment, paymentState) && (
              <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-800">
                Payment failed
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Link
            href={detailHref}
            className="rounded-full border px-3 py-2 text-xs font-medium hover:bg-slate-50"
          >
            View details
          </Link>

          <a
            href={`/api/appointments/${appointment.id}/ics`}
            download
            className="rounded-full border px-3 py-2 text-xs font-medium hover:bg-slate-50"
          >
            Add to calendar
          </a>

          <Link
            href={`${detailHref}${
              detailHref.includes('?') ? '&' : '?'
            }reschedule=1`}
            className="rounded-full border px-3 py-2 text-xs font-medium hover:bg-slate-50"
          >
            Reschedule
          </Link>

          <button
            type="button"
            onClick={() => onCancel(appointment.id)}
            className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100"
          >
            Cancel
          </button>

          {canJoin ? (
            <Link
              href={joinHrefForAppointment(appointment)}
              className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Join televisit
            </Link>
          ) : (
            <span
              aria-disabled="true"
              title={joinReason}
              className="cursor-not-allowed rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-400"
            >
              Join locked
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function PastAppointmentCard({
  appointment,
  detailHref,
  rating,
}: {
  appointment: Appointment;
  detailHref: string;
  rating?: Rating | null;
}) {
  const start = new Date(appointment.startsAt);
  const end = new Date(appointment.endsAt);

  const relative = formatDistanceToNow(start, {
    addSuffix: true,
  });

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate text-base font-semibold text-slate-900">
              {appointment.reason || 'Consultation'}
            </div>

            <AppointmentStatusChip status={appointment.status} />
          </div>

          <div className="mt-3 text-sm text-slate-600">
            {start.toLocaleString()} – {end.toLocaleTimeString()}
          </div>

          <div className="mt-1 text-xs text-slate-500">
            {relative}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              {appointment.clinicianName || appointment.clinicianId}
            </span>

            {rating === undefined ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-500">
                Checking rating
              </span>
            ) : rating === null ? (
              <Link
                href={`${detailHref}${
                  detailHref.includes('?') ? '&' : '?'
                }rate=1`}
                className="rounded-full bg-amber-100 px-3 py-1 text-amber-800 hover:bg-amber-200"
              >
                Rate visit
              </Link>
            ) : (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
                Rated {starsText(rating.score)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Link
            href={detailHref}
            className="rounded-full border px-3 py-2 text-xs font-medium hover:bg-slate-50"
          >
            View details
          </Link>

          <Link
            href="/clinicians"
            className="rounded-full border px-3 py-2 text-xs font-medium hover:bg-slate-50"
          >
            Rebook clinician
          </Link>
        </div>
      </div>
    </div>
  );
}

function PatientAppointmentsContent() {
  const searchParams = useSearchParams();

  const subjectPatientId =
    searchParams?.get('subjectPatientId')?.trim() || '';

  const relationshipId =
    searchParams?.get('relationshipId')?.trim() || '';

  const nowRef = useRef(Date.now());

  const [me, setMe] = useState<AuthMe | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingChoiceOpen, setBookingChoiceOpen] =
    useState(false);

  const [upcomingPage, setUpcomingPage] = useState(1);
  const [pastPage, setPastPage] = useState(1);

  const [ratingById, setRatingById] = useState<
    Record<string, Rating | null | undefined>
  >({});

  const [paymentStateById, setPaymentStateById] = useState<
    Record<string, PaymentState | null | undefined>
  >({});

  const withBookingContext = useCallback(
    (path: string) => {
      const qs = new URLSearchParams();

      if (subjectPatientId) {
        qs.set('subjectPatientId', subjectPatientId);
      }

      if (relationshipId) {
        qs.set('relationshipId', relationshipId);
      }

      const suffix = qs.toString();

      return `${path}${suffix ? `?${suffix}` : ''}`;
    },
    [relationshipId, subjectPatientId],
  );

  const detailHref = useCallback(
    (id: string) => {
      const qs = new URLSearchParams();

      if (subjectPatientId) {
        qs.set('subjectPatientId', subjectPatientId);
      }

      if (relationshipId) {
        qs.set('relationshipId', relationshipId);
      }

      return `/appointments/${encodeURIComponent(id)}${
        qs.toString() ? `?${qs.toString()}` : ''
      }`;
    },
    [relationshipId, subjectPatientId],
  );

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const auth = await fetchAuthMe();
      setMe(auth);

      const qs = new URLSearchParams();

      if (subjectPatientId) {
        qs.set('subjectPatientId', subjectPatientId);
      }

      if (relationshipId) {
        qs.set('relationshipId', relationshipId);
      }

      const res = await fetch(
        `/api/appointments${
          qs.toString() ? `?${qs.toString()}` : ''
        }`,
        {
          cache: 'no-store',
          credentials: 'include',
          headers: getIdentityHeaders(auth),
        },
      );

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const raw = await res.json().catch(() => ({}));

      setAppointments(asAppointmentList(raw));
    } catch (e: any) {
      setError(e?.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [relationshipId, subjectPatientId]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const upcoming = useMemo(() => {
    return appointments
      .filter(
        (a) =>
          new Date(a.startsAt).getTime() >= nowRef.current,
      )
      .sort(
        (a, b) =>
          new Date(a.startsAt).getTime() -
          new Date(b.startsAt).getTime(),
      );
  }, [appointments]);

  const past = useMemo(() => {
    return appointments
      .filter(
        (a) =>
          new Date(a.startsAt).getTime() < nowRef.current,
      )
      .sort(
        (a, b) =>
          new Date(b.startsAt).getTime() -
          new Date(a.startsAt).getTime(),
      );
  }, [appointments]);

  const unresolvedRatingIds = useMemo(() => {
    return past
      .filter((a) => isCompleted(a.status))
      .map((a) => a.id)
      .filter((id) => ratingById[id] === undefined);
  }, [past, ratingById]);

  useEffect(() => {
    let cancelled = false;

    if (!unresolvedRatingIds.length) return;

    (async () => {
      const results = await Promise.all(
        unresolvedRatingIds.map((id) =>
          fetchAppointmentRating(id, me),
        ),
      );

      if (cancelled) return;

      setRatingById((prev) => {
        const next = { ...prev };

        unresolvedRatingIds.forEach((id, idx) => {
          next[id] = results[idx];
        });

        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [me, unresolvedRatingIds]);

  const unresolvedPaymentIds = useMemo(() => {
    return upcoming
      .map((a) => a.id)
      .filter((id) => paymentStateById[id] === undefined);
  }, [paymentStateById, upcoming]);

  useEffect(() => {
    let cancelled = false;

    if (!unresolvedPaymentIds.length) return;

    (async () => {
      const results = await Promise.all(
        unresolvedPaymentIds.map((id) =>
          fetchPaymentState(id),
        ),
      );

      if (cancelled) return;

      setPaymentStateById((prev) => {
        const next = { ...prev };

        unresolvedPaymentIds.forEach((id, idx) => {
          next[id] = results[idx];
        });

        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [unresolvedPaymentIds]);

  const pagedUpcoming = useMemo(() => {
    return upcoming.slice(
      (upcomingPage - 1) * PAGE_SIZE,
      upcomingPage * PAGE_SIZE,
    );
  }, [upcoming, upcomingPage]);

  const pagedPast = useMemo(() => {
    return past.slice(
      (pastPage - 1) * PAGE_SIZE,
      pastPage * PAGE_SIZE,
    );
  }, [past, pastPage]);

  const totalUpcomingPages = Math.max(
    1,
    Math.ceil(upcoming.length / PAGE_SIZE),
  );

  const totalPastPages = Math.max(
    1,
    Math.ceil(past.length / PAGE_SIZE),
  );

  const cancelAppointment = useCallback(
    async (appointmentId: string) => {
      const confirmed = window.confirm(
        'Are you sure you want to cancel this appointment?',
      );

      if (!confirmed) return;

      try {
        const res = await fetch(
          `/appointments/${encodeURIComponent(
            appointmentId,
          )}/cancel`,
          {
            method: 'PUT',
            credentials: 'include',
          },
        );

        if (!res.ok) {
          throw new Error('Failed to cancel appointment');
        }

        setAppointments((prev) =>
          prev.map((a) =>
            a.id === appointmentId
              ? {
                  ...a,
                  status: 'Cancelled',
                }
              : a,
          ),
        );
      } catch (e: any) {
        window.alert(
          e?.message || 'Unable to cancel appointment',
        );
      }
    },
    [],
  );

  return (
    <main data-p-ui="patient-appointments-page" className="min-w-0 overflow-x-clip mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            My Appointments
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Track upcoming visits, completed consultations,
            payment state, televisits, and care activity.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setBookingChoiceOpen(true)}
          className="w-fit rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Start booking
        </button>
      </header>

      {subjectPatientId && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Acting for subject patient{' '}
          <span className="font-semibold">
            {subjectPatientId}
          </span>
        </div>
      )}

      {loading && <AppointmentSkeleton />}

      {!loading && error && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
          <div className="font-medium text-rose-900">
            Failed to load appointments
          </div>

          <div className="mt-1 text-sm text-rose-700">
            {error}
          </div>

          <button
            type="button"
            onClick={() => void loadAppointments()}
            className="mt-4 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm text-rose-700 hover:bg-rose-100"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !appointments.length && !error && (
        <EmptyAppointmentsState
          openBooking={() => setBookingChoiceOpen(true)}
          subjectPatientId={subjectPatientId}
          relationshipId={relationshipId}
        />
      )}

      {!!pagedUpcoming.length && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Upcoming appointments
            </h2>

            <div className="text-xs text-slate-400">
              {upcoming.length} total
            </div>
          </div>

          <div className="space-y-4">
            {pagedUpcoming.map((appointment) => (
              <UpcomingAppointmentCard
                key={appointment.id}
                appointment={appointment}
                detailHref={detailHref(appointment.id)}
                paymentState={
                  paymentStateById[appointment.id]
                }
                onCancel={cancelAppointment}
              />
            ))}
          </div>

          <AppointmentPagination
            page={upcomingPage}
            totalPages={totalUpcomingPages}
            onPageChange={setUpcomingPage}
          />
        </section>
      )}

      {!!pagedPast.length && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Past appointments
            </h2>

            <div className="text-xs text-slate-400">
              {past.length} total
            </div>
          </div>

          <div className="space-y-4">
            {pagedPast.map((appointment) => (
              <PastAppointmentCard
                key={appointment.id}
                appointment={appointment}
                detailHref={detailHref(appointment.id)}
                rating={ratingById[appointment.id]}
              />
            ))}
          </div>

          <AppointmentPagination
            page={pastPage}
            totalPages={totalPastPages}
            onPageChange={setPastPage}
          />
        </section>
      )}

      <BookingChoiceModal
        open={bookingChoiceOpen}
        onClose={() => setBookingChoiceOpen(false)}
        withBookingContext={withBookingContext}
      />
    </main>
  );
}

export default function AppointmentsPage() {
  return (
    <Suspense fallback={<AppointmentSkeleton />}>
      <PatientAppointmentsContent />
    </Suspense>
  );
}