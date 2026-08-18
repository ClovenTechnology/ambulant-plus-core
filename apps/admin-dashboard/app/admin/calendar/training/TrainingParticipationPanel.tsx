'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

type QualifiedClinician = {
  clinicianId: string;
  onboardingId: string;
  label: string;
};

type TrainingParticipant = {
  assignmentId: string;
  trainingSlotId: string;
  sessionKey: string;
  principalType: string;
  principalId?: string | null;
  email?: string | null;
  name: string;
  organisation?: string | null;
  department?: string | null;
  designation?: string | null;
  role: string;
  status: string;
  effectiveStatus: string;
  mandatoryQualification: boolean;
  onboardingId?: string | null;
  invitedAt?: string | null;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  expiresAt?: string | null;
  lastNotifiedAt?: string | null;
  canCopyCommonRoom?: boolean;
  invitationKind?: string | null;
};

type ParticipationPayload = {
  ok: boolean;
  trainingSlot?: {
    id: string;
    title?: string | null;
    startsAt: string;
    endsAt: string;
    timezone?: string | null;
    mode?: string | null;
    status?: string | null;
    cancelledAt?: string | null;
    meetingUrl?: string | null;
    capacity?: number;
    usedCount?: number;
  };
  participants?: TrainingParticipant[];
  error?: string;
};

function fmt(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString();
}

function statusTone(status: string) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'accepted' || normalized === 'assigned') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }
  if (normalized === 'invited') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

async function readJson(response: Response) {
  const text = await response.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: text };
  }
}

export default function TrainingParticipationPanel({
  trainingSlotId,
  commonRoomUrl,
  qualifiedClinicians,
  onChanged,
}: {
  trainingSlotId: string;
  commonRoomUrl?: string | null;
  qualifiedClinicians: QualifiedClinician[];
  onChanged?: () => void;
}) {
  const [payload, setPayload] =
    useState<ParticipationPayload | null>(
      null,
    );
  const [busy, setBusy] =
    useState(false);
  const [notice, setNotice] =
    useState<string | null>(null);
  const [error, setError] =
    useState<string | null>(null);
  const [oneTimeLink, setOneTimeLink] =
    useState<string | null>(null);

  const [clinicianId, setClinicianId] =
    useState('');
  const [observerEmail, setObserverEmail] =
    useState('');
  const [observerName, setObserverName] =
    useState('');
  const [
    observerOrganisation,
    setObserverOrganisation,
  ] = useState('');
  const [
    observerDesignation,
    setObserverDesignation,
  ] = useState('');

  const load = useCallback(async () => {
    if (!trainingSlotId) return;

    setError(null);

    const response =
      await fetch(
        `/api/admin/training/participations?trainingSlotId=${encodeURIComponent(trainingSlotId)}`,
        {
          cache: 'no-store',
          credentials: 'include',
        },
      );

    const data =
      (await readJson(
        response,
      )) as ParticipationPayload | null;

    if (
      !response.ok ||
      !data?.ok
    ) {
      throw new Error(
        data?.error ||
          'Unable to load training participation.',
      );
    }

    setPayload(data);
  }, [trainingSlotId]);

  useEffect(() => {
    load().catch((reason) => {
      setError(
        reason?.message ||
          'Unable to load training participation.',
      );
    });
  }, [load]);

  const participants =
    payload?.participants || [];

  const clinicians = useMemo(
    () =>
      participants.filter(
        (participant) =>
          participant.principalType ===
          'clinician',
      ),
    [participants],
  );

  const externalObservers = useMemo(
    () =>
      participants.filter(
        (participant) =>
          participant.principalType ===
            'external_guest' &&
          participant.role === 'observer',
      ),
    [participants],
  );

  const liveRoomUrl =
    payload?.trainingSlot?.meetingUrl ||
    commonRoomUrl ||
    '';

  async function copy(
    value: string,
    message = 'Copied.',
  ) {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(
        value,
      );
      setNotice(message);
    } catch {
      setError(
        'Could not copy automatically. Select the displayed link and copy it manually.',
      );
    }
  }

  async function action(
    body: Record<string, unknown>,
  ) {
    setBusy(true);
    setError(null);
    setNotice(null);
    setOneTimeLink(null);

    try {
      const response =
        await fetch(
          '/api/admin/training/participations',
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'content-type':
                'application/json',
            },
            body:
              JSON.stringify(body),
          },
        );

      const result =
        await readJson(response);

      if (
        !response.ok ||
        !result?.ok
      ) {
        throw new Error(
          result?.error ||
            'Training participation action failed.',
        );
      }

      const link =
        result?.oneTime?.link ||
        result?.invitation?.link ||
        '';

      if (link) {
        setOneTimeLink(
          String(link),
        );
      }

      await load();
      return result;
    } catch (reason: any) {
      setError(
        String(
          reason?.message ||
            reason ||
            'Training participation action failed.',
        ).replace(/_/g, ' '),
      );
      throw reason;
    } finally {
      setBusy(false);
    }
  }

  async function inviteClinician() {
    if (!clinicianId) {
      setError(
        'Select a qualified clinician.',
      );
      return;
    }

    try {
      const result =
        await action({
          action: 'invite_clinician',
          trainingSlotId,
          clinicianId,
        });
      setNotice(
        result?.notification?.status ===
          'sent'
          ? 'Clinician invitation created and emailed.'
          : 'Clinician invitation created. Email delivery was not confirmed; copy the invitation link below.',
      );
      setClinicianId('');
    } catch {
      // action() already surfaces the error.
    }
  }

  async function inviteObserver() {
    if (!observerEmail.trim()) {
      setError(
        'Enter the external observer email.',
      );
      return;
    }

    try {
      const result =
        await action({
          action: 'invite_observer',
          trainingSlotId,
          email: observerEmail,
          name: observerName,
          organisation:
            observerOrganisation,
          designation:
            observerDesignation,
          sendEmail: true,
        });

      setNotice(
        result?.notification?.status ===
          'sent'
          ? 'Observer invitation created and emailed. The secure link is also available below for manual delivery.'
          : 'Observer invitation created. Email delivery was not confirmed; use the secure link below for manual delivery.',
      );

      setObserverEmail('');
      setObserverName('');
      setObserverOrganisation('');
      setObserverDesignation('');
    } catch {
      // action() already surfaces the error.
    }
  }

  async function issueCopyLink(
    assignmentId: string,
  ) {
    try {
      const result =
        await action({
          action: 'issue_copy_link',
          assignmentId,
        });
      const link =
        String(
          result?.oneTime?.link ||
            '',
        );

      if (link) {
        await copy(
          link,
          'Invitation link copied. For external observers this newly issued link replaces any previous unverified link.',
        );
      }
    } catch {
      // surfaced by action
    }
  }

  async function resend(
    assignmentId: string,
  ) {
    try {
      const result =
        await action({
          action: 'resend_invitation',
          assignmentId,
        });

      setNotice(
        result?.notification?.status ===
          'sent'
          ? 'Invitation resent successfully.'
          : 'Invitation was reissued, but email delivery was not confirmed. Copy the returned link manually.',
      );
    } catch {
      // surfaced by action
    }
  }

  async function revoke(
    participant: TrainingParticipant,
  ) {
    if (
      !confirm(
        `Revoke training participation for ${participant.name}?`,
      )
    ) {
      return;
    }

    try {
      await action({
        action: 'revoke_participation',
        assignmentId:
          participant.assignmentId,
      });
      setNotice(
        'Training participation revoked.',
      );
    } catch {
      // surfaced by action
    }
  }

  async function removeMandatoryClinician(
    participant: TrainingParticipant,
  ) {
    if (
      !participant.principalId ||
      !participant.onboardingId
    ) {
      setError(
        'This mandatory clinician booking is missing its onboarding identity.',
      );
      return;
    }

    if (
      !confirm(
        `Remove ${participant.name} from this mandatory training session? Other participants will remain scheduled.`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response =
        await fetch(
          '/api/admin/clinicians/onboarding/cancel-training',
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'content-type':
                'application/json',
            },
            body:
              JSON.stringify({
                clinicianId:
                  participant.principalId,
                onboardingId:
                  participant.onboardingId,
                trainingSlotId,
              }),
          },
        );

      const result =
        await readJson(response);

      if (
        !response.ok ||
        !result?.ok
      ) {
        throw new Error(
          result?.error ||
            'Unable to remove clinician.',
        );
      }

      setNotice(
        'Clinician removed from this session. Other participants were not cancelled.',
      );
      await load();
      onChanged?.();
    } catch (reason: any) {
      setError(
        String(
          reason?.message ||
            'Unable to remove clinician.',
        ).replace(/_/g, ' '),
      );
    } finally {
      setBusy(false);
    }
  }

  async function markComplete(
    participant: TrainingParticipant,
  ) {
    if (
      !participant.principalId ||
      !participant.onboardingId
    ) {
      setError(
        'This clinician is missing its mandatory onboarding identity.',
      );
      return;
    }

    if (
      !confirm(
        `Mark mandatory training completed for ${participant.name}?`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response =
        await fetch(
          '/api/admin/clinicians/onboarding/mark-training-complete',
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'content-type':
                'application/json',
            },
            body:
              JSON.stringify({
                clinicianId:
                  participant.principalId,
                onboardingId:
                  participant.onboardingId,
                trainingSlotId,
              }),
          },
        );

      const result =
        await readJson(response);

      if (
        !response.ok ||
        !result?.ok
      ) {
        throw new Error(
          result?.error ||
            'Unable to mark training complete.',
        );
      }

      setNotice(
        `Training completed for ${participant.name}.`,
      );
      await load();
      onChanged?.();
    } catch (reason: any) {
      setError(
        String(
          reason?.message ||
            'Unable to mark training complete.',
        ).replace(/_/g, ' '),
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancelSession() {
    if (
      !confirm(
        'Cancel the ENTIRE training session for every participant and observer? This is different from removing one clinician.',
      )
    ) {
      return;
    }

    if (
      !confirm(
        'Final confirmation: cancel this whole training session and revoke all active access?',
      )
    ) {
      return;
    }

    try {
      await action({
        action: 'cancel_session',
        trainingSlotId,
      });
      setNotice(
        'Entire training session cancelled.',
      );
      onChanged?.();
    } catch {
      // surfaced by action
    }
  }

  const slotCancelled =
    String(
      payload?.trainingSlot?.status ||
        '',
    ).toLowerCase() === 'cancelled' ||
    Boolean(
      payload?.trainingSlot
        ?.cancelledAt,
    );

  return (
    <div className="space-y-4">
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-900"
        >
          {error}
        </div>
      ) : null}

      {notice ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900"
        >
          {notice}
        </div>
      ) : null}

      {oneTimeLink ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="text-[11px] font-black uppercase tracking-wide text-amber-800">
            Secure invitation link
          </div>
          <div className="mt-2 break-all font-mono text-[11px] text-amber-950">
            {oneTimeLink}
          </div>
          <button
            type="button"
            onClick={() =>
              copy(
                oneTimeLink,
                'Invitation link copied.',
              )
            }
            className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900"
          >
            Copy link
          </button>
          <p className="mt-2 text-[10px] leading-4 text-amber-800">
            External-observer links are secure one-time invitations. Generating or resending another external link invalidates the previous unverified link.
          </p>
        </div>
      ) : null}

      <section className="rounded-xl border bg-white p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-black text-gray-900">
              Clinician room link
            </div>
            <p className="mt-1 text-[11px] leading-4 text-gray-500">
              ASSIGNED and ACCEPTED clinicians may use the same room URL. Possession of this URL is not authorization; the signed-in clinician assignment is still verified before admission.
            </p>
          </div>
          {liveRoomUrl ? (
            <button
              type="button"
              onClick={() =>
                copy(
                  liveRoomUrl,
                  'Clinician room link copied.',
                )
              }
              className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-gray-50"
            >
              Copy room link
            </button>
          ) : null}
        </div>
        <div className="mt-2 break-all font-mono text-[11px] text-blue-700">
          {liveRoomUrl ||
            'No virtual room URL is configured for this session.'}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-black text-gray-900">
            Clinician participants
          </div>
          <div className="text-[10px] text-gray-500">
            {clinicians.length}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {!clinicians.length ? (
            <div className="text-xs text-gray-500">
              No clinician assignments were found for this session.
            </div>
          ) : (
            clinicians.map(
              (participant) => (
                <div
                  key={
                    participant.assignmentId
                  }
                  className="rounded-xl border bg-slate-50 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-black text-gray-900">
                        {participant.name}
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-500">
                        {participant.email ||
                          participant.principalId}
                      </div>
                      <div className="mt-1 text-[10px] text-gray-500">
                        {participant
                          .mandatoryQualification
                          ? 'Mandatory onboarding qualification'
                          : 'Additional training participation'}
                      </div>
                    </div>

                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${statusTone(participant.effectiveStatus)}`}
                    >
                      {
                        participant.effectiveStatus
                      }
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {participant.status ===
                    'invited' ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            issueCopyLink(
                              participant.assignmentId,
                            )
                          }
                          className="rounded-lg border bg-white px-2.5 py-1.5 text-[11px] font-semibold hover:bg-gray-50 disabled:opacity-50"
                        >
                          Copy invitation
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            resend(
                              participant.assignmentId,
                            )
                          }
                          className="rounded-lg border bg-white px-2.5 py-1.5 text-[11px] font-semibold hover:bg-gray-50 disabled:opacity-50"
                        >
                          Resend
                        </button>
                      </>
                    ) : null}

                    {participant
                      .mandatoryQualification &&
                    ['assigned', 'accepted'].includes(
                      participant.status,
                    ) ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            markComplete(
                              participant,
                            )
                          }
                          className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Mark completed
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            removeMandatoryClinician(
                              participant,
                            )
                          }
                          className="rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                        >
                          Remove clinician
                        </button>
                      </>
                    ) : null}

                    {!participant
                      .mandatoryQualification &&
                    !['revoked', 'expired'].includes(
                      participant
                        .effectiveStatus,
                    ) ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          revoke(
                            participant,
                          )
                        }
                        className="rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        Revoke participation
                      </button>
                    ) : null}
                  </div>
                </div>
              ),
            )
          )}
        </div>

        {!slotCancelled ? (
          <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
            <div className="text-[11px] font-black text-indigo-950">
              Invite qualified clinician
            </div>
            <p className="mt-1 text-[10px] leading-4 text-indigo-800">
              Optional invitations do not replace or regress an already-completed mandatory training qualification.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <select
                value={clinicianId}
                onChange={(event) =>
                  setClinicianId(
                    event.target.value,
                  )
                }
                className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-xs"
              >
                <option value="">
                  Select qualified clinician
                </option>
                {qualifiedClinicians.map(
                  (clinician) => (
                    <option
                      key={
                        clinician.clinicianId
                      }
                      value={
                        clinician.clinicianId
                      }
                    >
                      {clinician.label}
                    </option>
                  ),
                )}
              </select>
              <button
                type="button"
                disabled={
                  busy ||
                  !clinicianId
                }
                onClick={inviteClinician}
                className="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
              >
                Invite clinician
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border bg-white p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-black text-gray-900">
              External observers
            </div>
            <p className="mt-1 text-[10px] leading-4 text-gray-500">
              These are external guests with unique secure invitations. The separate “Open as observer” control above remains for the authenticated Admin/staff member.
            </p>
          </div>
          <div className="text-[10px] text-gray-500">
            {externalObservers.length}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {externalObservers.map(
            (participant) => (
              <div
                key={
                  participant.assignmentId
                }
                className="rounded-xl border bg-slate-50 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-black text-gray-900">
                      {participant.name}
                    </div>
                    <div className="mt-0.5 text-[11px] text-gray-500">
                      {participant.email}
                    </div>
                    {participant.organisation ? (
                      <div className="mt-0.5 text-[10px] text-gray-500">
                        {
                          participant.organisation
                        }
                        {participant.designation
                          ? ` · ${participant.designation}`
                          : ''}
                      </div>
                    ) : null}
                    {participant.expiresAt ? (
                      <div className="mt-1 text-[10px] text-gray-500">
                        Access expires{' '}
                        {fmt(
                          participant.expiresAt,
                        )}
                      </div>
                    ) : null}
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${statusTone(participant.effectiveStatus)}`}
                  >
                    {
                      participant.effectiveStatus
                    }
                  </span>
                </div>

                {!['revoked', 'expired'].includes(
                  participant.effectiveStatus,
                ) ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        issueCopyLink(
                          participant.assignmentId,
                        )
                      }
                      className="rounded-lg border bg-white px-2.5 py-1.5 text-[11px] font-semibold hover:bg-gray-50 disabled:opacity-50"
                    >
                      Generate & copy link
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        resend(
                          participant.assignmentId,
                        )
                      }
                      className="rounded-lg border bg-white px-2.5 py-1.5 text-[11px] font-semibold hover:bg-gray-50 disabled:opacity-50"
                    >
                      Resend / rotate
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        revoke(
                          participant,
                        )
                      }
                      className="rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  </div>
                ) : null}
              </div>
            ),
          )}

          {!externalObservers.length ? (
            <div className="text-xs text-gray-500">
              No external observers have been invited.
            </div>
          ) : null}
        </div>

        {!slotCancelled ? (
          <div className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
            <input
              value={observerEmail}
              onChange={(event) =>
                setObserverEmail(
                  event.target.value,
                )
              }
              placeholder="Observer email *"
              type="email"
              className="rounded-lg border bg-white px-3 py-2 text-xs"
            />
            <input
              value={observerName}
              onChange={(event) =>
                setObserverName(
                  event.target.value,
                )
              }
              placeholder="Observer name"
              className="rounded-lg border bg-white px-3 py-2 text-xs"
            />
            <input
              value={
                observerOrganisation
              }
              onChange={(event) =>
                setObserverOrganisation(
                  event.target.value,
                )
              }
              placeholder="Organisation"
              className="rounded-lg border bg-white px-3 py-2 text-xs"
            />
            <input
              value={
                observerDesignation
              }
              onChange={(event) =>
                setObserverDesignation(
                  event.target.value,
                )
              }
              placeholder="Designation"
              className="rounded-lg border bg-white px-3 py-2 text-xs"
            />
            <button
              type="button"
              disabled={
                busy ||
                !observerEmail.trim()
              }
              onClick={inviteObserver}
              className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:opacity-50 sm:col-span-2"
            >
              Invite external observer
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-rose-200 bg-rose-50 p-3">
        <div className="text-xs font-black text-rose-950">
          Entire session
        </div>
        <p className="mt-1 text-[10px] leading-4 text-rose-800">
          This action is intentionally separate from removing one clinician or revoking one invitation. It closes the whole training slot and revokes active participant access.
        </p>
        <button
          type="button"
          disabled={
            busy || slotCancelled
          }
          onClick={cancelSession}
          className="mt-3 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100 disabled:opacity-50"
        >
          {slotCancelled
            ? 'Session cancelled'
            : 'Cancel entire training session'}
        </button>
      </section>
    </div>
  );
}
