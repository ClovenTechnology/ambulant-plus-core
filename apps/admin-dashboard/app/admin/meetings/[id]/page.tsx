'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Lock, RefreshCw, ShieldCheck, Unlock, UserPlus } from 'lucide-react';
import { MeetingRoomClient } from './MeetingRoomClient';

export const dynamic = 'force-dynamic';

type Payload = {
  ok: boolean;
  meeting?: any;
  permissions?: any;
  error?: string;
};

function formatMeetingDate(value: string, timezone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  try {
    return `${new Intl.DateTimeFormat('en-ZA', {
      timeZone: timezone,
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(date)} (${timezone})`;
  } catch {
    return date.toISOString();
  }
}

function meetingStateLabel(value: unknown) {
  const state = String(value || '').trim().toUpperCase();
  const labels: Record<string, string> = {
    DRAFT: 'Draft',
    SCHEDULED: 'Scheduled',
    RINGING: 'Calling',
    LIVE: 'Live',
    ENDED: 'Ended',
    CANCELLED: 'Cancelled',
    EXPIRED: 'Expired',
  };
  return labels[state] || state.replaceAll('_', ' ').toLowerCase();
}

function meetingKindLabel(value: unknown) {
  const kind = String(value || '').trim().toUpperCase();
  const labels: Record<string, string> = {
    STANDARD: 'Meeting',
    INTERVIEW: 'Interview',
    TRAINING: 'Training session',
    DIRECT_CALL: 'Staff call',
  };
  return labels[kind] || kind.replaceAll('_', ' ').toLowerCase();
}

export default function AdminMeetingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestMessage, setGuestMessage] = useState('');
  const [requirePin, setRequirePin] = useState(false);
  const [oneTime, setOneTime] = useState<any>(null);

  async function load() {
    setBusy(true);
    setError('');

    try {
      const response = await fetch(
        `/api/admin/meetings/${encodeURIComponent(params.id)}`,
        { cache: 'no-store' },
      );
      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || 'Unable to load meeting');
      }

      setData(json);
    } catch (err: any) {
      setError(err?.message || 'Unable to load meeting');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, [params.id]);

  async function patch(payload: Record<string, unknown>) {
    setBusy(true);
    setError('');

    try {
      const response = await fetch(
        `/api/admin/meetings/${encodeURIComponent(params.id)}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || 'Unable to update meeting');
      }

      await load();
    } catch (err: any) {
      setError(err?.message || 'Unable to update meeting');
      setBusy(false);
    }
  }

  async function inviteGuest(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setOneTime(null);

    try {
      const response = await fetch(
        `/api/admin/meetings/${encodeURIComponent(params.id)}/invitations`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: guestEmail,
            displayName: guestName || null,
            messageOverride: guestMessage || null,
            requirePin,
            sendEmail: true,
            role: data?.meeting?.kind === 'INTERVIEW' ? 'INTERVIEWEE' : 'ATTENDEE',
          }),
        },
      );

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || 'Unable to invite guest');
      }

      setOneTime(json.invitation?.oneTime || null);
      setGuestEmail('');
      setGuestName('');
      setGuestMessage('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Unable to invite guest');
      setBusy(false);
    }
  }

  async function decideLobby(entryId: string, action: 'ADMIT' | 'REJECT') {
    setBusy(true);
    setError('');

    try {
      const response = await fetch(
        `/api/admin/meetings/${encodeURIComponent(params.id)}/lobby/${encodeURIComponent(entryId)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action }),
        },
      );
      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || 'Unable to update lobby');
      }

      await load();
    } catch (err: any) {
      setError(err?.message || 'Unable to update lobby');
      setBusy(false);
    }
  }

  async function endMeeting() {
    if (!window.confirm('End this meeting for all participants?')) return;

    setBusy(true);
    setError('');

    try {
      const response = await fetch(
        `/api/admin/meetings/${encodeURIComponent(params.id)}/end`,
        { method: 'POST' },
      );
      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || 'Unable to end meeting');
      }

      await load();
    } catch (err: any) {
      setError(err?.message || 'Unable to end meeting');
      setBusy(false);
    }
  }

  const meeting = data?.meeting;
  const canModerate = Boolean(data?.permissions?.canModerate);
  const isApplicationInterview = Boolean(
    meeting?.kind === 'INTERVIEW' &&
    meeting?.contextType === 'APPLICATION_INTERVIEW' &&
    meeting?.contextId,
  );

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link
            href="/admin/meetings"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Meetings
          </Link>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {meeting?.title || 'Meeting'}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {meeting ? `${meetingKindLabel(meeting.kind)} · ${meetingStateLabel(meeting.state)}` : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
        >
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {meeting?.kind === 'DIRECT_CALL' ? (
        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Staff call</div>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">Direct calls are managed in Communications</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">This call does not use a meeting lobby or external guest workflow. Open Communications to continue the conversation, view call history, or start a new audio/video call.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/admin/communications" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Open Communications</Link>
            <Link href="/admin/meetings" className="rounded-xl border px-4 py-2 text-sm font-medium">Back to Meetings</Link>
          </div>
        </section>
      ) : meeting ? (
        <>
          <section className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-3xl border bg-white p-5 shadow-sm xl:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
                    {meetingStateLabel(meeting.state)}
                  </div>
                  <div className="mt-2 text-lg font-semibold">{meeting.title}</div>
                  <div className="mt-2 text-sm text-slate-600">
                    {formatMeetingDate(meeting.startsAt, meeting.timezone)} · {meeting.durationMinutes} min
                  </div>
                </div>

                {canModerate ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => patch({ locked: !meeting.lockedAt })}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
                    >
                      {meeting.lockedAt ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      {meeting.lockedAt ? 'Unlock' : 'Lock'}
                    </button>

                    {!['ENDED', 'CANCELLED', 'EXPIRED'].includes(meeting.state) ? (
                      <button
                        type="button"
                        onClick={endMeeting}
                        disabled={busy}
                        className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700"
                      >
                        End for all
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {meeting.agenda ? (
                <div className="mt-5 whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  {meeting.agenda}
                </div>
              ) : null}

              <div className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm text-cyan-900">
                Manage participants, lobby access and the live meeting from this workspace.
              </div>
            </div>

            <div className="rounded-3xl border bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Capabilities</h2>
              <dl className="mt-4 space-y-3 text-sm">
                {[
                  ['Audio', meeting.allowAudio],
                  ['Video', meeting.allowVideo],
                  ['Chat', meeting.allowChat],
                  ['Files', meeting.allowFiles],
                  ['Screen share', meeting.allowScreenShare],
                  ['Recording permitted', meeting.allowRecording],
                  ['External lobby', meeting.lobbyRequired],
                ].map(([label, enabled]) => (
                  <div key={String(label)} className="flex items-center justify-between gap-3">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="font-semibold">{enabled ? 'Yes' : 'No'}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <MeetingRoomClient meeting={meeting} onMeetingChanged={load} />

          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Participants</h2>
            <div className="mt-4 overflow-hidden rounded-2xl border">
              {(meeting.participants || []).map((participant: any) => (
                <div
                  key={participant.id}
                  className="grid gap-2 border-b px-4 py-3 text-sm last:border-b-0 md:grid-cols-[1.3fr_0.8fr_0.8fr]"
                >
                  <div>
                    <div className="font-semibold">{participant.displayName}</div>
                    <div className="text-xs text-slate-500">
                      {participant.staffProfile?.email || participant.emailNormalized || participant.participantType}
                    </div>
                  </div>
                  <div>{String(participant.role || '').replaceAll('_', ' ').toLowerCase()}</div>
                  <div>{meetingStateLabel(participant.state)}</div>
                </div>
              ))}
            </div>
          </section>

          {canModerate ? (
            <section className="grid gap-4 xl:grid-cols-2">
              {isApplicationInterview ? (
                <div className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5 text-sm text-cyan-950 shadow-sm">
                  <div className="font-semibold">Application interview governance</div>
                  <p className="mt-2 leading-6">
                    Interview scheduling, applicant invitation, rescheduling and cancellation are
                    managed from the Application workspace. This meeting room is used for the live interview session.
                  </p>
                  <Link
                    href={`/admin/applications/${encodeURIComponent(meeting.contextId)}`}
                    className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Open application interview
                  </Link>
                </div>
              ) : (
                <form
                  onSubmit={inviteGuest}
                  className="space-y-4 rounded-3xl border bg-white p-5 shadow-sm"
                >
                <div className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">Invite external guest</h2>
                </div>

                <input
                  type="email"
                  value={guestEmail}
                  onChange={(event) => setGuestEmail(event.target.value)}
                  placeholder="guest@example.com"
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  required
                />

                <input
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  placeholder="Display name (optional)"
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                />

                <textarea
                  value={guestMessage}
                  onChange={(event) => setGuestMessage(event.target.value)}
                  placeholder="Custom invitation message override"
                  className="min-h-24 w-full rounded-xl border p-3 text-sm"
                />

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={requirePin}
                    onChange={(event) => setRequirePin(event.target.checked)}
                  />
                  Generate a unique invitation PIN
                </label>

                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Send secure invitation
                </button>

                {oneTime ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                    <div className="font-semibold">One-time organiser copy</div>
                    <div className="mt-2 break-all">Link: {oneTime.link}</div>
                    {oneTime.pin ? (
                      <div className="mt-2 font-mono text-sm">PIN: {oneTime.pin}</div>
                    ) : null}
                    <div className="mt-2">
                      For security, the PIN will not be shown again.
                    </div>
                  </div>
                ) : null}
                </form>
              )}

              <div className="rounded-3xl border bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold">Lobby</h2>

                <div className="mt-4 space-y-3">
                  {(meeting.lobbyEntries || []).length === 0 ? (
                    <div className="text-sm text-slate-500">No guests waiting.</div>
                  ) : null}

                  {(meeting.lobbyEntries || []).map((entry: any) => (
                    <div key={entry.id} className="rounded-2xl border p-4">
                      <div className="font-semibold">
                        {entry.participant?.displayName || entry.participantId}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{entry.state}</div>

                      {entry.state === 'WAITING' ? (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => decideLobby(entry.id, 'ADMIT')}
                            className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
                          >
                            Admit
                          </button>
                          <button
                            type="button"
                            onClick={() => decideLobby(entry.id, 'REJECT')}
                            className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700"
                          >
                            Reject
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
