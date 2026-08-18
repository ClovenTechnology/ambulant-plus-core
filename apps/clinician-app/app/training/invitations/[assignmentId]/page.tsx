'use client';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  useParams,
} from 'next/navigation';

type TrainingParticipation = {
  assignmentId?: string | null;
  trainingSlotId?: string | null;
  status?: string | null;
  role?: string | null;
  mandatoryQualification?: boolean | null;
  invitedAt?: string | null;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  expiresAt?: string | null;
  trainingSlot?: {
    id?: string | null;
    title?: string | null;
    summary?: string | null;
    startAt?: string | null;
    endAt?: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
    timezone?: string | null;
    mode?: string | null;
    joinUrl?: string | null;
    roomState?: string | null;
    canJoin?: boolean | null;
    joinOpensAt?: string | null;
    joinClosesAt?: string | null;
  } | null;
};

type TrainingContext = {
  ok?: boolean;
  clinician?: {
    id?: string;
    name?: string | null;
    email?: string | null;
  };
  participations?: TrainingParticipation[];
  error?: unknown;
};

function friendly(
  value: unknown,
  fallback =
    'Unable to load this training invitation.',
) {
  const code =
    String(value || '').trim();

  const known: Record<string, string> = {
    unauthorized:
      'Sign in to the invited clinician account, then reopen this invitation.',
    clinician_identity_required:
      'Sign in to the invited clinician account, then reopen this invitation.',
    training_assignment_identity_mismatch:
      'This invitation belongs to a different clinician account.',
    training_assignment_inactive:
      'This training invitation is no longer active.',
    training_slot_unavailable:
      'This training session is no longer available.',
  };

  return (
    known[code] ||
    code.replace(/_/g, ' ') ||
    fallback
  );
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

export default function ClinicianTrainingInvitationPage() {
  const params = useParams();
  const assignmentId =
    String(
      (params as any)?.assignmentId ||
        '',
    ).trim();

  const [ctx, setCtx] =
    useState<TrainingContext | null>(
      null,
    );
  const [participation, setParticipation] =
    useState<TrainingParticipation | null>(
      null,
    );
  const [loading, setLoading] =
    useState(true);
  const [busy, setBusy] =
    useState(false);
  const [notice, setNotice] =
    useState<string | null>(null);
  const [error, setError] =
    useState<string | null>(null);

  const load = useCallback(async () => {
    if (!assignmentId) {
      setError(
        'This training invitation is missing its assignment reference.',
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response =
        await fetch(
          '/api/training/context',
          {
            cache: 'no-store',
            credentials: 'include',
          },
        );

      const payload =
        (await response
          .json()
          .catch(() => null)) as
          | TrainingContext
          | null;

      if (
        !response.ok ||
        !payload?.ok
      ) {
        throw new Error(
          String(
            (payload as any)?.error ||
              (response.status === 401
                ? 'unauthorized'
                : 'training_context_unavailable'),
          ),
        );
      }

      const match =
        (
          payload.participations ||
          []
        ).find(
          (item) =>
            String(
              item.assignmentId ||
                '',
            ) === assignmentId,
        ) || null;

      if (!match) {
        throw new Error(
          'training_assignment_identity_mismatch',
        );
      }

      setCtx(payload);
      setParticipation(match);
    } catch (reason: any) {
      setError(
        friendly(
          reason?.message || reason,
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function respond(
    action: 'accept' | 'decline',
  ) {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const response =
        await fetch(
          '/api/training/participations/respond',
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'content-type':
                'application/json',
            },
            body:
              JSON.stringify({
                assignmentId,
                action,
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
            'training_invitation_response_failed',
        );
      }

      setNotice(
        action === 'accept'
          ? 'Training invitation accepted.'
          : 'Training invitation declined.',
      );

      await load();
    } catch (reason: any) {
      setError(
        friendly(
          reason?.message || reason,
          'Unable to update this training invitation.',
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  const slot =
    participation?.trainingSlot;
  const status =
    String(
      participation?.status || '',
    ).toLowerCase();
  const startAt =
    slot?.startAt ||
    slot?.startsAt;
  const endAt =
    slot?.endAt ||
    slot?.endsAt;
  const roomAvailable =
    Boolean(slot?.joinUrl) &&
    participation?.trainingSlot
      ?.canJoin === true &&
    ['assigned', 'accepted'].includes(
      status,
    );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="overflow-hidden rounded-[2rem] border border-indigo-100 bg-white shadow-lg shadow-indigo-100/50">
          <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-800 px-6 py-8 text-white sm:px-8">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-200">
              Ambulant+ My Training
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight">
              Training invitation
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-100">
              This invitation is tied to your signed-in clinician identity. The invitation reference itself does not grant room access.
            </p>
          </div>
        </header>

        {loading ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600">
            Loading your training invitation…
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-900"
          >
            {error}
            {error.toLowerCase().includes(
              'sign in',
            ) ? (
              <div className="mt-4">
                <a
                  href="/auth/login"
                  className="inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white"
                >
                  Sign in
                </a>
              </div>
            ) : null}
          </div>
        ) : null}

        {notice ? (
          <div
            role="status"
            className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900"
          >
            {notice}
          </div>
        ) : null}

        {!loading &&
        participation ? (
          <section className="rounded-[2rem] border bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-black uppercase text-indigo-800">
                  {status || 'invited'}
                </div>
                <h2 className="mt-4 text-2xl font-black text-slate-950">
                  {slot?.title ||
                    'Ambulant+ Training'}
                </h2>
                {slot?.summary ? (
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    {slot.summary}
                  </p>
                ) : null}
              </div>
              <div className="text-right text-xs text-slate-500">
                {ctx?.clinician?.name ||
                  ctx?.clinician?.email}
              </div>
            </div>

            <dl className="mt-6 grid gap-4 rounded-2xl border bg-slate-50 p-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-slate-500">
                  Starts
                </dt>
                <dd className="mt-1 font-semibold">
                  {fmt(
                    startAt,
                    slot?.timezone,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500">
                  Ends
                </dt>
                <dd className="mt-1 font-semibold">
                  {fmt(
                    endAt,
                    slot?.timezone,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500">
                  Timezone
                </dt>
                <dd className="mt-1 font-semibold">
                  {slot?.timezone ||
                    'Africa/Johannesburg'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500">
                  Participation
                </dt>
                <dd className="mt-1 font-semibold">
                  {participation
                    .mandatoryQualification
                    ? 'Mandatory qualification'
                    : 'Additional training'}
                </dd>
              </div>
            </dl>

            {status === 'invited' ? (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <div className="font-black text-amber-950">
                  Your response is required
                </div>
                <p className="mt-1 text-sm leading-6 text-amber-900">
                  Accept to add this session to your active training participation, or decline if you cannot attend. Declining additional training does not alter your existing Ambulant+ qualification.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      respond('accept')
                    }
                    disabled={busy}
                    className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {busy
                      ? 'Saving…'
                      : 'Accept invitation'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      respond('decline')
                    }
                    disabled={busy}
                    className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-black text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ) : null}

            {status === 'accepted' ? (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-6 text-emerald-950">
                <div className="font-black">
                  Invitation accepted
                </div>
                <p className="mt-1">
                  Your participation is active. Room admission will still be issued only inside the authorised join window.
                </p>
              </div>
            ) : null}

            {participation?.revokedAt ||
            ['revoked', 'expired'].includes(
              status,
            ) ? (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
                This training participation is no longer active.
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-2">
              {roomAvailable ? (
                <a
                  href={String(
                    slot?.joinUrl,
                  )}
                  className="rounded-xl bg-indigo-700 px-4 py-2 text-sm font-black text-white hover:bg-indigo-800"
                >
                  Open training room
                </a>
              ) : null}

              <a
                href="/training/schedule"
                className="rounded-xl border bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                Open My Training
              </a>
            </div>

            {!roomAvailable &&
            ['assigned', 'accepted'].includes(
              status,
            ) ? (
              <p className="mt-3 text-xs leading-5 text-slate-500">
                The training room will become available according to the configured admission window.
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
