'use client';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

type GuestTrainingStatus = {
  participant?: {
    assignmentId?: string;
    name?: string | null;
    email?: string | null;
    organisation?: string | null;
    designation?: string | null;
    role?: string | null;
    status?: string | null;
  };
  training?: {
    id?: string;
    title?: string | null;
    summary?: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
    timezone?: string | null;
    mode?: string | null;
    status?: string | null;
    roomId?: string | null;
  };
};

function inviteFromHash() {
  if (typeof window === 'undefined') {
    return '';
  }

  const raw =
    window.location.hash.replace(/^#/, '');
  const params =
    new URLSearchParams(raw);

  return String(
    params.get('invite') || '',
  ).trim();
}

function fmt(
  value?: string | null,
  timezone?: string | null,
) {
  if (!value) return 'To be confirmed';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return 'To be confirmed';
  }

  try {
    return new Intl.DateTimeFormat(
      'en-ZA',
      {
        dateStyle: 'full',
        timeStyle: 'short',
        timeZone:
          timezone ||
          undefined,
      },
    ).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function friendlyError(
  value: unknown,
) {
  const code =
    String(value || '').trim();

  const known: Record<string, string> = {
    invalid_or_expired_training_invitation:
      'This training invitation is invalid, expired, already used, or has been revoked. Ask the Ambulant+ training administrator to issue a new invitation.',
    training_guest_session_required:
      'Your secure training invitation session has expired. Ask the training administrator for a new invitation link.',
    invalid_training_guest_session:
      'Your secure training invitation session is no longer valid. Ask the training administrator for a new invitation link.',
    training_guest_session_inactive:
      'This observer participation is no longer active.',
    training_slot_cancelled:
      'This training session has been cancelled.',
    training_room_not_open:
      'Your invitation is valid, but the training room is not open yet.',
    training_room_closed:
      'This training room has closed.',
  };

  return (
    known[code] ||
    code.replace(/_/g, ' ') ||
    'Unable to continue with this training invitation.'
  );
}

export default function GuestTrainingJoinClient() {
  const [status, setStatus] =
    useState<GuestTrainingStatus | null>(
      null,
    );
  const [loading, setLoading] =
    useState(true);
  const [joining, setJoining] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);

  const loadStatus =
    useCallback(async () => {
      const response =
        await fetch(
          '/api/training/guest/status',
          {
            cache: 'no-store',
            credentials: 'include',
          },
        );

      const payload =
        await response
          .json()
          .catch(() => null);

      if (
        !response.ok ||
        !payload?.ok
      ) {
        throw new Error(
          payload?.error ||
            'training_guest_status_unavailable',
        );
      }

      setStatus(payload);
      return payload;
    }, []);

  useEffect(() => {
    let active = true;

    async function boot() {
      setLoading(true);
      setError(null);

      try {
        const invite =
          inviteFromHash();

        if (invite) {
          const response =
            await fetch(
              '/api/training/guest/verify',
              {
                method: 'POST',
                credentials: 'include',
                headers: {
                  'content-type':
                    'application/json',
                },
                body:
                  JSON.stringify({
                    token: invite,
                  }),
              },
            );

          const payload =
            await response
              .json()
              .catch(() => null);

          if (
            !response.ok ||
            !payload?.ok
          ) {
            throw new Error(
              payload?.error ||
                'invalid_or_expired_training_invitation',
            );
          }

          if (
            typeof window !==
            'undefined'
          ) {
            window.history.replaceState(
              {},
              document.title,
              `${window.location.pathname}${window.location.search}`,
            );
          }
        }

        const next =
          await loadStatus();

        if (active) {
          setStatus(next);
        }
      } catch (reason: any) {
        if (active) {
          setError(
            friendlyError(
              reason?.message ||
                reason,
            ),
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    boot();

    return () => {
      active = false;
    };
  }, [loadStatus]);

  async function joinTraining() {
    setJoining(true);
    setError(null);

    try {
      const response =
        await fetch(
          '/api/training/guest/admission',
          {
            method: 'POST',
            credentials: 'include',
          },
        );

      const payload =
        await response
          .json()
          .catch(() => null);

      if (
        !response.ok ||
        !payload?.ok ||
        !payload?.admission?.token ||
        !payload?.admission?.trainingSlotId ||
        !payload?.admission?.role ||
        !payload?.admission?.uid ||
        !payload?.roomUrl
      ) {
        throw new Error(
          payload?.error ||
            'training_guest_admission_unavailable',
        );
      }

      const url =
        new URL(
          String(payload.roomUrl),
        );

      url.searchParams.set(
        'trainingSlotId',
        String(
          payload.admission.trainingSlotId,
        ),
      );

      url.searchParams.set(
        'role',
        String(
          payload.admission.role,
        ),
      );

      url.searchParams.set(
        'uid',
        String(
          payload.admission.uid,
        ),
      );

      url.searchParams.set(
        'joinToken',
        String(
          payload.admission.token,
        ),
      );

      window.location.href =
        url.toString();
    } catch (reason: any) {
      setError(
        friendlyError(
          reason?.message || reason,
        ),
      );
      setJoining(false);
    }
  }

  const training =
    status?.training;
  const participant =
    status?.participant;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-2xl">
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
          <div className="bg-slate-950 px-6 py-8 text-white sm:px-8">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
              Ambulant+ secure training
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight">
              External observer access
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Your invitation is verified before any room admission is issued. The invitation itself is never used as the live-room credential.
            </p>
          </div>

          <div className="space-y-5 p-6 sm:p-8">
            {loading ? (
              <div className="rounded-2xl border bg-slate-50 p-5 text-sm text-slate-600">
                Verifying secure training access…
              </div>
            ) : null}

            {error ? (
              <div
                className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-900"
                role="alert"
              >
                {error}
              </div>
            ) : null}

            {!loading &&
            status?.training ? (
              <>
                <section className="rounded-2xl border border-slate-200 p-5">
                  <div className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Training session
                  </div>
                  <h2 className="mt-2 text-xl font-black text-slate-950">
                    {training?.title ||
                      'Ambulant+ Training'}
                  </h2>
                  {training?.summary ? (
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {training.summary}
                    </p>
                  ) : null}

                  <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-semibold text-slate-500">
                        Starts
                      </dt>
                      <dd className="mt-1 font-semibold">
                        {fmt(
                          training?.startsAt,
                          training?.timezone,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-slate-500">
                        Ends
                      </dt>
                      <dd className="mt-1 font-semibold">
                        {fmt(
                          training?.endsAt,
                          training?.timezone,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-slate-500">
                        Timezone
                      </dt>
                      <dd className="mt-1 font-semibold">
                        {training?.timezone ||
                          'Africa/Johannesburg'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-slate-500">
                        Mode
                      </dt>
                      <dd className="mt-1 font-semibold">
                        {training?.mode ===
                        'in_person'
                          ? 'In person'
                          : 'Virtual'}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
                  <div className="text-xs font-black uppercase tracking-wide text-indigo-700">
                    Your observer identity
                  </div>
                  <div className="mt-2 font-black text-slate-950">
                    {participant?.name ||
                      'External observer'}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {participant?.email}
                  </div>
                  {participant?.organisation ? (
                    <div className="mt-1 text-sm text-slate-600">
                      {participant.organisation}
                    </div>
                  ) : null}
                  <div className="mt-3 inline-flex rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-bold text-indigo-800">
                    Observer · verified
                  </div>
                </section>

                <button
                  type="button"
                  onClick={joinTraining}
                  disabled={
                    joining ||
                    training?.mode ===
                      'in_person'
                  }
                  className="w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {joining
                    ? 'Requesting room admission…'
                    : training?.mode ===
                        'in_person'
                      ? 'In-person session'
                      : 'Join training room'}
                </button>

                <p className="text-xs leading-5 text-slate-500">
                  Room admission is short-lived and remains subject to the scheduled training join window. If the room is not open yet, return here closer to the session.
                </p>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
