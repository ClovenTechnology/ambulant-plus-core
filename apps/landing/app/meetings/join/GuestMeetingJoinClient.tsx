'use client';

import { useEffect, useMemo, useState } from 'react';

type GuestStatus = {
  meeting?: {
    id: string;
    title: string;
    agenda?: string | null;
    state: string;
    startsAt: string;
    endsAt: string;
    timezone: string;
    durationMinutes: number;
    locked?: boolean;
  };
  participant?: {
    displayName: string;
    role: string;
    state: string;
  };
  lobby?: {
    id: string;
    state: string;
    requestedAt?: string;
    decidedAt?: string | null;
  } | null;
};

function invitationTokenFromHash() {
  if (typeof window === 'undefined') return '';
  const value = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(value);
  return String(params.get('invite') || '').trim();
}

export default function GuestMeetingJoinClient() {
  const [token, setToken] = useState('');
  const [pin, setPin] = useState('');
  const [verified, setVerified] = useState(false);
  const [status, setStatus] = useState<GuestStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setToken(invitationTokenFromHash());
  }, []);

  const lobbyState = status?.lobby?.state || '';
  const schedule = useMemo(() => {
    if (!status?.meeting?.startsAt) return '';
    try {
      return new Intl.DateTimeFormat('en-ZA', {
        dateStyle: 'full',
        timeStyle: 'short',
        timeZone: status.meeting.timezone || 'Africa/Johannesburg',
      }).format(new Date(status.meeting.startsAt));
    } catch {
      return new Date(status.meeting.startsAt).toLocaleString();
    }
  }, [status?.meeting?.startsAt, status?.meeting?.timezone]);

  async function loadStatus() {
    const response = await fetch('/api/meetings/guest/status', {
      cache: 'no-store',
      credentials: 'include',
    });
    const json = await response.json().catch(() => null);

    if (!response.ok || !json?.ok) {
      if (response.status === 401) setVerified(false);
      throw new Error(json?.error || 'Unable to read meeting status');
    }

    setStatus(json);
    return json as GuestStatus;
  }

  async function enterLobby() {
    const response = await fetch('/api/meetings/guest/lobby', {
      method: 'POST',
      credentials: 'include',
    });
    const json = await response.json().catch(() => null);

    if (!response.ok || !json?.ok) {
      throw new Error(json?.error || 'Unable to enter meeting lobby');
    }

    await loadStatus();
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      if (!token) throw new Error('This invitation link is incomplete or has already been removed from the address bar.');

      const response = await fetch('/api/meetings/guest/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, pin: pin || null }),
      });
      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error('The invitation is invalid, expired, revoked, locked, or the PIN is incorrect.');
      }

      // The opaque invitation bearer never needs to remain in browser history
      // after the server has exchanged it for an HttpOnly guest-session cookie.
      window.history.replaceState({}, '', '/meetings/join');
      setToken('');
      setPin('');
      setVerified(true);
      await enterLobby();
    } catch (err: any) {
      setError(err?.message || 'Unable to verify invitation');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!verified || lobbyState !== 'WAITING') return;

    const timer = window.setInterval(() => {
      loadStatus().catch(() => undefined);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [verified, lobbyState]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:py-20">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-slate-950 px-6 py-7 text-white sm:px-8">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Secure Ambulant+ meeting
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            {status?.meeting?.title || 'Verify your invitation'}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            External guests do not need an Admin account. Your invitation is verified before lobby admission and meeting access.
          </p>
        </div>

        <div className="space-y-6 p-6 sm:p-8">
          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {!verified ? (
            <form onSubmit={verify} className="space-y-4">
              <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm leading-6 text-cyan-950">
                Open this page from your original invitation email. If the organiser supplied a PIN, enter it below.
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-800">Invitation PIN (if required)</span>
                <input
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\s+/g, '').slice(0, 32))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="rounded-xl border border-slate-300 px-3 py-3 text-base"
                  placeholder="Optional PIN"
                />
              </label>

              <button
                type="submit"
                disabled={busy || !token}
                className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Verifying…' : 'Verify invitation'}
              </button>

              {!token ? (
                <p className="text-sm text-amber-700">
                  This invitation link is incomplete. Please reopen the secure link from your invitation email.
                </p>
              ) : null}
            </form>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Schedule</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{schedule || '—'}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {status?.meeting?.durationMinutes || '—'} minutes · {status?.meeting?.timezone || '—'}
                  </div>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Guest</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{status?.participant?.displayName || 'External guest'}</div>
                  <div className="mt-1 text-xs text-slate-500">{status?.participant?.role || 'ATTENDEE'}</div>
                </div>
              </div>

              {status?.meeting?.agenda ? (
                <div className="whitespace-pre-wrap rounded-2xl border p-4 text-sm leading-6 text-slate-700">
                  {status.meeting.agenda}
                </div>
              ) : null}

              {lobbyState === 'WAITING' ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                  <div className="font-semibold">Waiting for the host</div>
                  <p className="mt-2 leading-6">Your invitation is verified. Keep this page open while a host or co-host reviews the lobby.</p>
                </div>
              ) : null}

              {lobbyState === 'REJECTED' ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
                  The host did not admit this guest session.
                </div>
              ) : null}

              {lobbyState === 'ADMITTED' ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
                  <div className="font-semibold">Admitted</div>
                  <p className="mt-2 leading-6">
                    Your guest access has been confirmed. Join the meeting when you are ready.
                  </p>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => loadStatus().catch((err) => setError(err?.message || 'Unable to refresh'))}
                className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Refresh status
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
