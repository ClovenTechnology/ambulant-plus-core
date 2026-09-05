'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

type Appointment = {
  id: string;
  startsAt?: string | null;
  endsAt?: string | null;
  status?: string | null;
  paymentStatus?: string | null;
  clinicianName?: string | null;
  clinicianSpecialty?: string | null;
  reason?: string | null;
  visitMode?: string | null;
  visitId?: string | null;
  roomId?: string | null;
};

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeAppointment(
  value: any,
): Appointment | null {
  const id = clean(
    value?.id ||
      value?.appointmentId ||
      value?.appointment_id,
  );

  if (!id) return null;

  return {
    id,
    startsAt:
      value?.startsAt ||
      value?.starts_at ||
      value?.startISO ||
      value?.start ||
      null,
    endsAt:
      value?.endsAt ||
      value?.ends_at ||
      value?.endISO ||
      value?.end ||
      null,
    status: value?.status || null,
    paymentStatus:
      value?.paymentStatus ||
      value?.payment_status ||
      value?.payment?.status ||
      null,
    clinicianName:
      value?.clinicianName ||
      value?.clinicianDisplayName ||
      value?.clinician?.displayName ||
      value?.clinician?.name ||
      null,
    clinicianSpecialty:
      value?.clinicianSpecialty ||
      value?.clinician?.specialty ||
      null,
    reason:
      value?.reason ||
      value?.title ||
      value?.notes ||
      null,
    visitMode:
      value?.visitMode ||
      value?.visit_mode ||
      value?.location ||
      null,
    visitId:
      value?.visitId ||
      value?.televisitId ||
      value?.visit_id ||
      null,
    roomId:
      value?.roomId ||
      value?.room_id ||
      value?.meta?.roomId ||
      null,
  };
}

function extractAppointments(
  payload: any,
): Appointment[] {
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.appointments)
      ? payload.appointments
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

  return raw
    .map(normalizeAppointment)
    .filter(
      (
        item: Appointment | null,
      ): item is Appointment =>
        Boolean(item),
    );
}

function dateValue(value?: string | null) {
  const date = new Date(String(value || ''));

  return Number.isFinite(date.getTime())
    ? date
    : null;
}

function formatDateTime(
  value?: string | null,
) {
  const date = dateValue(value);

  if (!date) return 'Time not available';

  return new Intl.DateTimeFormat(
    'en-ZA',
    {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    },
  ).format(date);
}

function patientErrorMessage(
  status: number,
  payload: any,
) {
  if (status === 401) {
    return 'Please sign in to view your upcoming online consultations.';
  }

  if (status === 403) {
    return 'Your account is not authorised to view these consultation details.';
  }

  if (status === 503) {
    return 'Upcoming consultations are temporarily unavailable. Please try again shortly.';
  }

  const code = clean(
    payload?.error ||
      payload?.message,
  ).toLowerCase();

  if (
    code.includes('session') ||
    code.includes('unauthorized')
  ) {
    return 'Please sign in again to view your upcoming online consultations.';
  }

  return 'We could not load your upcoming consultations right now. Please try again.';
}

function statusLabel(
  appointment: Appointment,
) {
  const status = clean(
    appointment.status,
  )
    .toLowerCase()
    .replace(/_/g, ' ');

  const paymentStatus = clean(
    appointment.paymentStatus,
  )
    .toLowerCase()
    .replace(/_/g, ' ');

  if (
    status === 'pending payment' ||
    paymentStatus === 'pending'
  ) {
    return 'Payment pending';
  }

  if (
    status === 'confirmed' ||
    status === 'in consult'
  ) {
    return 'Confirmed';
  }

  return status || 'Scheduled';
}

export default function TelevisitPage() {
  const [appointments, setAppointments] =
    useState<Appointment[]>([]);

  const [busy, setBusy] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const loadAppointments =
    useCallback(async () => {
      setBusy(true);
      setError(null);

      try {
        const response = await fetch(
          '/api/appointments?production=1&excludeSimulation=1',
          {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
            headers: {
              accept: 'application/json',
            },
          },
        );

        const payload = await response
          .json()
          .catch(() => null);

        if (
          !response.ok ||
          payload?.ok === false
        ) {
          throw {
            status: response.status,
            payload,
          };
        }

        setAppointments(
          extractAppointments(payload),
        );
      } catch (failure: any) {
        if (
          typeof navigator !==
            'undefined' &&
          navigator.onLine === false
        ) {
          setError(
            'You appear to be offline. Check your connection and try again.',
          );
        } else {
          setError(
            patientErrorMessage(
              Number(failure?.status || 0),
              failure?.payload,
            ),
          );
        }

        setAppointments([]);
      } finally {
        setBusy(false);
      }
    }, []);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const upcoming =
    useMemo(() => {
      const now =
        Date.now() - 30 * 60 * 1000;

      const closedStatuses =
        new Set([
          'cancelled',
          'canceled',
          'completed',
          'payment_expired',
          'cancelled_payment_timeout',
        ]);

      return appointments
        .filter((appointment) => {
          const status = clean(
            appointment.status,
          ).toLowerCase();

          if (
            closedStatuses.has(status)
          ) {
            return false;
          }

          const end =
            dateValue(
              appointment.endsAt ||
                appointment.startsAt,
            );

          if (
            end &&
            end.getTime() < now
          ) {
            return false;
          }

          const mode = clean(
            appointment.visitMode,
          ).toLowerCase();

          return (
            mode.includes('tele') ||
            Boolean(
              appointment.visitId ||
                appointment.roomId,
            )
          );
        })
        .sort((left, right) => {
          const a =
            dateValue(left.startsAt)
              ?.getTime() ??
            Number.MAX_SAFE_INTEGER;

          const b =
            dateValue(right.startsAt)
              ?.getTime() ??
            Number.MAX_SAFE_INTEGER;

          return a - b;
        });
    }, [appointments]);

  return (
    <main
      data-p-ui="patient-televisit-entry-page"
      className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900"
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-7 text-white shadow-xl sm:p-9">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Ambulant+ online consultations
          </div>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Prepare for your consultation
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
            Open an upcoming appointment to enter the secure
            patient lobby, confirm your visit, test your camera
            and microphone, and prepare any pre-visit readings.
          </p>
        </section>

        {busy ? (
          <section className="rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="text-sm font-medium text-slate-700">
              Loading your upcoming consultations…
            </div>
          </section>
        ) : null}

        {!busy && error ? (
          <section
            aria-live="polite"
            className="rounded-[28px] border border-amber-200 bg-amber-50 p-6"
          >
            <h2 className="font-semibold text-amber-950">
              Consultation details unavailable
            </h2>

            <p className="mt-2 text-sm leading-6 text-amber-800">
              {error}
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  void loadAppointments()
                }
                className="rounded-xl bg-amber-900 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Try again
              </button>

              <Link
                href="/appointments"
                className="rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900"
              >
                View appointments
              </Link>
            </div>
          </section>
        ) : null}

        {!busy &&
        !error &&
        upcoming.length === 0 ? (
          <section className="rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">
              No upcoming online consultation
            </h2>

            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
              You do not currently have an upcoming online
              consultation linked to this account.
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/appointments"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800"
              >
                View appointments
              </Link>

              <Link
                href="/clinicians"
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Find a clinician
              </Link>
            </div>
          </section>
        ) : null}

        {!busy &&
        !error &&
        upcoming.length > 0 ? (
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">
                  Upcoming consultations
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Consultation rooms are assigned securely from
                  the appointment record.
                </p>
              </div>

              <Link
                href="/appointments"
                className="text-sm font-semibold text-cyan-700 hover:underline"
              >
                All appointments
              </Link>
            </div>

            <div className="grid gap-4">
              {upcoming.map(
                (appointment) => {
                  const lobbyHref =
                    `/lobby?appointmentId=${encodeURIComponent(
                      appointment.id,
                    )}`;

                  return (
                    <article
                      key={appointment.id}
                      className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                    >
                      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                              {statusLabel(
                                appointment,
                              )}
                            </span>

                            {appointment.clinicianSpecialty ? (
                              <span className="text-xs text-slate-500">
                                {
                                  appointment.clinicianSpecialty
                                }
                              </span>
                            ) : null}
                          </div>

                          <h3 className="mt-3 text-lg font-semibold text-slate-950">
                            {appointment.clinicianName ||
                              'Online consultation'}
                          </h3>

                          <p className="mt-1 text-sm text-slate-600">
                            {appointment.reason ||
                              'Clinical consultation'}
                          </p>

                          <p className="mt-3 text-sm font-medium text-slate-800">
                            {formatDateTime(
                              appointment.startsAt,
                            )}
                          </p>
                        </div>

                        <Link
                          href={lobbyHref}
                          className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          Open patient lobby
                        </Link>
                      </div>
                    </article>
                  );
                },
              )}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
