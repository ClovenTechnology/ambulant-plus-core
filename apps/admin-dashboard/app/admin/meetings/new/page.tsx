'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarPlus, Search, ShieldCheck, X } from 'lucide-react';

export const dynamic = 'force-dynamic';

type StaffRow = {
  kind: 'staff' | 'pending';
  id: string;
  name: string;
  email: string;
  lifecycleState?: string;
};

type CreatedMeeting = {
  meeting?: { id: string; title: string };
  externalInvitations?: Array<{
    id?: string;
    email?: string;
    expiresAt?: string;
    emailDelivery?: { ok?: boolean; error?: string } | null;
    oneTime?: { link?: string; pin?: string | null };
    error?: string;
  }>;
};

function localDefaultStart() {
  const date = new Date(Date.now() + 60 * 60_000);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function NewAdminMeetingPage() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [staffQuery, setStaffQuery] = useState('');
  const [title, setTitle] = useState('Ambulant+ meeting');
  const [agenda, setAgenda] = useState('');
  const [startsAtLocal, setStartsAtLocal] = useState(localDefaultStart());
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [timezone, setTimezone] = useState('Africa/Johannesburg');
  const [kind, setKind] = useState('STANDARD');
  const [externalEmails, setExternalEmails] = useState('');
  const [subjectOverride, setSubjectOverride] = useState('');
  const [messageOverride, setMessageOverride] = useState('');
  const [requireGuestPin, setRequireGuestPin] = useState(false);
  const [lobbyRequired, setLobbyRequired] = useState(true);
  const [allowRecording, setAllowRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CreatedMeeting | null>(null);

  useEffect(() => {
    let requestedStaffId = '';

    try {
      requestedStaffId = new URLSearchParams(window.location.search).get('staffId') || '';
    } catch {
      requestedStaffId = '';
    }

    fetch('/api/admin/staff?pageSize=100&state=ACTIVE', { cache: 'no-store' })
      .then(async (response) => {
        const json = await response.json().catch(() => null);
        if (!response.ok || !json?.ok) {
          throw new Error(json?.error || 'Unable to load staff');
        }
        const rows = (Array.isArray(json.items) ? json.items : [])
          .filter((item: StaffRow) => item.kind === 'staff');
        setStaff(rows);

        if (requestedStaffId && rows.some((item: StaffRow) => item.id === requestedStaffId)) {
          setSelectedStaffIds([requestedStaffId]);
        }
      })
      .catch((err) => setError(err?.message || 'Unable to load staff'));
  }, []);

  const selectedSet = useMemo(() => new Set(selectedStaffIds), [selectedStaffIds]);
  const selectedStaff = useMemo(
    () => staff.filter((item) => selectedSet.has(item.id)),
    [staff, selectedSet],
  );
  const visibleStaff = useMemo(() => {
    const query = staffQuery.trim().toLowerCase();
    if (!query) return staff;
    return staff.filter((item) => `${item.name || ''} ${item.email}`.toLowerCase().includes(query));
  }, [staff, staffQuery]);

  function toggleStaff(id: string) {
    setSelectedStaffIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  async function createMeeting(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setCreated(null);

    try {
      const external = externalEmails
        .split(/[\n,;]+/)
        .map((value) => value.trim())
        .filter(Boolean);

      const response = await fetch('/api/admin/meetings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title,
          agenda,
          startsAtLocal,
          durationMinutes,
          timezone,
          kind,
          staffProfileIds: selectedStaffIds,
          externalEmails: external,
          requireGuestPin,
          lobbyRequired,
          allowRecording,
          subjectOverride: subjectOverride || null,
          messageOverride: messageOverride || null,
          sendEmail: true,
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || 'Unable to create meeting');
      }

      const result = json as CreatedMeeting;
      setCreated(result);

      const hasOneTimePin = (result.externalInvitations || [])
        .some((item) => Boolean(item?.oneTime?.pin));

      // When a generated PIN exists, remain on this page so the organiser can
      // copy the plaintext PIN exactly once. It is not recoverable from storage.
      if (!hasOneTimePin && result.meeting?.id) {
        window.location.href = `/admin/meetings/${encodeURIComponent(result.meeting.id)}`;
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to create meeting');
    } finally {
      setBusy(false);
    }
  }

  if (created?.meeting?.id) {
    return (
      <main className="space-y-6 p-4 lg:p-6">
        <header>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
            Meeting created
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {created.meeting.title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Copy any generated guest PIN now. For security, it will not be shown again.
          </p>
        </header>

        <section className="space-y-3 rounded-3xl border bg-white p-5 shadow-sm">
          {(created.externalInvitations || []).map((invitation, index) => (
            <div key={invitation.id || `${invitation.email}-${index}`} className="rounded-2xl border p-4 text-sm">
              <div className="font-semibold text-slate-900">{invitation.email || 'External guest'}</div>
              {invitation.error ? (
                <div className="mt-2 text-rose-700">Invitation creation failed: {invitation.error}</div>
              ) : (
                <>
                  <div className="mt-2 break-all text-xs text-slate-600">Secure link: {invitation.oneTime?.link || 'Sent by email'}</div>
                  {invitation.oneTime?.pin ? (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">One-time PIN</div>
                      <div className="mt-1 font-mono text-xl font-semibold tracking-[0.2em] text-amber-950">{invitation.oneTime.pin}</div>
                    </div>
                  ) : null}
                  <div className="mt-2 text-xs text-slate-500">
                    Email delivery: {invitation.emailDelivery?.ok ? 'sent' : invitation.emailDelivery?.error || 'not sent'}
                  </div>
                </>
              )}
            </div>
          ))}

          <Link
            href={`/admin/meetings/${encodeURIComponent(created.meeting.id)}`}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
          >
            <ShieldCheck className="h-4 w-4" />
            Open meeting control
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <header>
        <Link
          href="/admin/meetings"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Meetings
        </Link>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Create meeting
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Schedule staff collaboration or an interview and optionally send verified external email invitations.
        </p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <form onSubmit={createMeeting} className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-4 rounded-3xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Meeting details</h2>

          <label className="grid gap-2">
            <span className="text-sm font-medium">Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="rounded-xl border px-3 py-2 text-sm"
              required
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium">Agenda</span>
            <textarea
              value={agenda}
              onChange={(event) => setAgenda(event.target.value)}
              className="min-h-28 rounded-xl border p-3 text-sm"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium">Type</span>
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value)}
                className="rounded-xl border px-3 py-2 text-sm"
              >
                <option value="STANDARD">Standard meeting</option>
                <option value="INTERVIEW">Interview</option>
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium">Timezone</span>
              <input
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                className="rounded-xl border px-3 py-2 text-sm"
                placeholder="Africa/Johannesburg"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium">Start in selected timezone</span>
              <input
                type="datetime-local"
                value={startsAtLocal}
                onChange={(event) => setStartsAtLocal(event.target.value)}
                className="rounded-xl border px-3 py-2 text-sm"
                required
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium">Duration (minutes)</span>
              <input
                type="number"
                min={5}
                max={1440}
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(Number(event.target.value))}
                className="rounded-xl border px-3 py-2 text-sm"
                required
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex items-center gap-2 rounded-xl border p-3 text-sm">
              <input
                type="checkbox"
                checked={lobbyRequired}
                onChange={(event) => setLobbyRequired(event.target.checked)}
              />
              External lobby
            </label>

            <label className="flex items-center gap-2 rounded-xl border p-3 text-sm">
              <input
                type="checkbox"
                checked={requireGuestPin}
                onChange={(event) => setRequireGuestPin(event.target.checked)}
              />
              Require guest PIN
            </label>

            <label className="flex items-center gap-2 rounded-xl border p-3 text-sm">
              <input
                type="checkbox"
                checked={allowRecording}
                onChange={(event) => setAllowRecording(event.target.checked)}
              />
              Permit recording
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-medium">External guest emails</span>
            <textarea
              value={externalEmails}
              onChange={(event) => setExternalEmails(event.target.value)}
              placeholder="candidate@example.com, guest@example.com"
              className="min-h-24 rounded-xl border p-3 text-sm"
            />
            <span className="text-xs text-slate-500">
              Separate multiple addresses with commas, semicolons or new lines.
            </span>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium">Invitation subject (optional)</span>
            <input
              value={subjectOverride}
              onChange={(event) => setSubjectOverride(event.target.value)}
              placeholder="Optional; otherwise the platform meeting default is used"
              className="rounded-xl border px-3 py-2 text-sm"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium">Invitation message (optional)</span>
            <textarea
              value={messageOverride}
              onChange={(event) => setMessageOverride(event.target.value)}
              placeholder="Optional message added to the default invitation email."
              className="min-h-24 rounded-xl border p-3 text-sm"
            />
          </label>
        </section>

        <section className="space-y-4 rounded-3xl border bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">Internal attendees</h2>
            <p className="mt-1 text-sm text-slate-500">Search colleagues and add the people who should receive the meeting invitation.</p>
          </div>

          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={staffQuery}
              onChange={(event) => setStaffQuery(event.target.value)}
              placeholder="Search by name or email"
              className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm"
            />
          </label>

          {selectedStaff.length ? (
            <div className="flex flex-wrap gap-2">
              {selectedStaff.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleStaff(item.id)}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
                  title="Remove attendee"
                >
                  {item.name || item.email}
                  <X className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          ) : null}

          <div className="max-h-[460px] space-y-2 overflow-y-auto">
            {visibleStaff.map((item) => (
              <label
                key={item.id}
                className="flex cursor-pointer items-start gap-3 rounded-2xl border p-3"
              >
                <input
                  type="checkbox"
                  checked={selectedSet.has(item.id)}
                  onChange={() => toggleStaff(item.id)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">
                    {item.name || item.email}
                  </span>
                  <span className="block text-xs text-slate-500">{item.email}</span>
                </span>
              </label>
            ))}

            {visibleStaff.length === 0 ? (
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">{staff.length ? 'No staff match your search.' : 'No active staff loaded.'}</div>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            <CalendarPlus className="h-4 w-4" />
            {busy ? 'Creating…' : 'Create meeting'}
          </button>
        </section>
      </form>
    </main>
  );
}
