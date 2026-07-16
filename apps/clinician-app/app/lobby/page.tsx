// apps/clinician-app/app/lobby/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

type Ctx = {
  appointmentId?: string;
  encounterId?: string;
  visitId?: string;
  patientId?: string;
  patientName?: string;
  clinicianId?: string;
  clinicianName?: string;
  clinicName?: string;
  clinicAddress?: string;
  reason?: string;
  participantId?: string;
  joinToken?: string;
};

type LinkState = {
  clinician: string;
  patient: string;
};

type PresenceSummary = {
  online?: boolean;
  count?: number;
  lastSeenAt?: string | null;
  displayName?: string | null;
  participantId?: string | null;
};

type PresenceSnapshot = {
  ok?: boolean;
  now?: number;
  ttlMs?: number;
  context?: {
    appointmentId?: string | null;
    visitId?: string | null;
    roomId?: string | null;
  };
  patient?: {
    lobby?: PresenceSummary;
    room?: PresenceSummary;
  };
  clinician?: {
    lobby?: PresenceSummary;
    room?: PresenceSummary;
  };
};

type PresenceLoadState =
  | 'checking'
  | 'live'
  | 'unavailable';

const LOBBY_PRESENCE_ENDPOINT =
  '/api/televisit/presence';

const LOBBY_HEARTBEAT_MS = 15_000;
const LOBBY_POLL_MS = 5_000;


function normalizeOrigin(x?: string | null) {
  const v = (x ?? '').trim();
  if (!v) return '';
  return v.replace(/\/+$/, '');
}

function derivePatientOriginFromHere(here: URL) {
  if (here.hostname.startsWith('clinician.')) {
    return here.protocol + '//' + here.hostname.replace(/^clinician\./, 'patient.');
  }

  return here.origin;
}

function buildSfuUrl(origin: string, roomId: string, ctx: Ctx) {
  const base = normalizeOrigin(origin);
  const u = new URL(base + '/sfu/' + encodeURIComponent(roomId));
  const sp = u.searchParams;

  Object.entries(ctx).forEach(([k, v]) => {
    const val = String(v ?? '').trim();
    if (val) sp.set(k, val);
  });

  return u.toString();
}

function makeFallbackLinks(roomId: string, ctx: Ctx, patientParticipantId?: string): LinkState {
  if (typeof window === 'undefined') {
    return { clinician: '', patient: '' };
  }

  const here = new URL(window.location.href);

  const clinicianOrigin =
    normalizeOrigin(process.env.NEXT_PUBLIC_CLINICIAN_APP_ORIGIN) ||
    here.origin;

  const patientOrigin =
    normalizeOrigin(process.env.NEXT_PUBLIC_PATIENT_APP_ORIGIN) ||
    derivePatientOriginFromHere(here);

  return {
    clinician: buildSfuUrl(clinicianOrigin, roomId, ctx),
    patient: buildSfuUrl(patientOrigin, roomId, {
      ...ctx,
      participantId: patientParticipantId || '',
      joinToken: '',
    }),
  };
}

function compactId(value?: string | null) {
  const text = String(value || '').trim();
  if (!text) return '—';
  if (text.length <= 18) return text;
  return `${text.slice(0, 8)}…${text.slice(-6)}`;
}

function displayValue(value?: string | null, fallback = 'Not supplied') {
  const text = String(value || '').trim();
  return text || fallback;
}


function presenceRowClass(online: boolean) {
  return online
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : 'border-slate-200 bg-slate-50 text-slate-700';
}

function presenceStatusText(
  loadState: PresenceLoadState,
  summary: PresenceSummary | null | undefined,
  onlineText: string,
  offlineText: string,
) {
  if (loadState === 'checking') {
    return 'Checking…';
  }

  if (loadState === 'unavailable') {
    return 'Status unavailable';
  }

  return summary?.online
    ? onlineText
    : offlineText;
}

function presenceDetail(
  loadState: PresenceLoadState,
  summary?: PresenceSummary | null,
) {
  if (loadState === 'checking') {
    return 'Waiting for the first live presence update.';
  }

  if (loadState === 'unavailable') {
    return 'Live presence is temporarily unavailable. Consultation entry remains available.';
  }

  if (!summary?.online) {
    return 'No active presence heartbeat is currently detected.';
  }

  const parts: string[] = [];

  const displayName =
    String(summary.displayName || '').trim();

  if (displayName) {
    parts.push(displayName);
  }

  const lastSeenAt =
    String(summary.lastSeenAt || '').trim();

  if (lastSeenAt) {
    const seen = new Date(lastSeenAt);

    if (!Number.isNaN(seen.getTime())) {
      parts.push(
        'Updated ' +
          seen.toLocaleTimeString('en-ZA', {
            hour: '2-digit',
            minute: '2-digit',
          }),
      );
    }
  }

  return parts.length > 0
    ? parts.join(' · ')
    : 'Active now';
}

function presenceLoadLabel(
  loadState: PresenceLoadState,
) {
  if (loadState === 'live') {
    return 'Live';
  }

  if (loadState === 'unavailable') {
    return 'Unavailable';
  }

  return 'Checking';
}

function readinessClass(ok: boolean) {
  return ok
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'border-amber-200 bg-amber-50 text-amber-800';
}

function ReadinessItem({
  label,
  detail,
  ok,
}: {
  label: string;
  detail: string;
  ok: boolean;
}) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${readinessClass(ok)}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">{label}</div>
        <span className="rounded-full bg-white/75 px-2.5 py-1 text-[11px] font-semibold">
          {ok ? 'Ready' : 'Check'}
        </span>
      </div>
      <p className="mt-1 text-xs opacity-80">{detail}</p>
    </div>
  );
}

function ContextCard({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </div>
      <div className={mono ? 'mt-1 font-mono text-sm text-slate-900' : 'mt-1 text-sm font-medium text-slate-900'}>
        {displayValue(value, '—')}
      </div>
    </div>
  );
}

function CopyField({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={value}
          className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700"
        />
        <button
          onClick={() => onCopy(value)}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          type="button"
        >
          Copy
        </button>
      </div>
    </div>
  );
}

export default function Lobby() {
  const [ready, setReady] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [ctx, setCtx] = useState<Ctx>({});
  const [patientJoinUrl, setPatientJoinUrl] = useState('');
  const [clinicianJoinUrl, setClinicianJoinUrl] = useState('');
  const [patientParticipantId, setPatientParticipantId] = useState('');
  const [copiedLabel, setCopiedLabel] = useState('');
  const [presence, setPresence] =
    useState<PresenceSnapshot | null>(null);
  const [presenceLoadState, setPresenceLoadState] =
    useState<PresenceLoadState>('checking');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const sp = new URL(window.location.href).searchParams;

    const nextRoomId =
      sp.get('roomId') ||
      sp.get('room') ||
      sp.get('roomName') ||
      '';

    const nextCtx: Ctx = {
      appointmentId: sp.get('appointmentId') ?? sp.get('appt') ?? undefined,
      encounterId: sp.get('encounterId') ?? undefined,
      visitId: sp.get('visitId') ?? sp.get('televisitId') ?? undefined,
      patientId: sp.get('patientId') ?? sp.get('subjectPatientId') ?? undefined,
      patientName: sp.get('patientName') ?? undefined,
      clinicianId: sp.get('clinicianId') ?? undefined,
      clinicianName: sp.get('clinicianName') ?? undefined,
      clinicName: sp.get('clinicName') ?? undefined,
      clinicAddress: sp.get('clinicAddress') ?? undefined,
      reason: sp.get('reason') ?? undefined,
      participantId: sp.get('participantId') ?? undefined,
      joinToken: sp.get('joinToken') ?? sp.get('jt') ?? undefined,
    };

    setRoomId(nextRoomId);
    setCtx(nextCtx);
    setPatientParticipantId(sp.get('patientParticipantId') || '');
    setPatientJoinUrl(sp.get('patientJoinUrl') || '');
    setClinicianJoinUrl(sp.get('clinicianJoinUrl') || '');
    setReady(true);
  }, []);


  // A6-R3-E2B: publish clinician lobby presence and read patient presence.
  useEffect(() => {
    const appointmentId =
      String(ctx.appointmentId || '').trim();

    const visitId =
      String(ctx.visitId || '').trim();

    const activeRoomId =
      roomId.trim();

    if (
      !appointmentId &&
      !visitId &&
      !activeRoomId
    ) {
      setPresence(null);
      setPresenceLoadState('checking');
      return;
    }

    let cancelled = false;

    const acceptSnapshot = (data: any) => {
      if (
        cancelled ||
        !data ||
        typeof data !== 'object' ||
        data.ok === false
      ) {
        return false;
      }

      setPresence(data as PresenceSnapshot);
      setPresenceLoadState('live');
      return true;
    };

    const contextQuery = () => {
      const query = new URLSearchParams();

      if (appointmentId) {
        query.set(
          'appointmentId',
          appointmentId,
        );
      }

      if (visitId) {
        query.set('visitId', visitId);
      }

      if (activeRoomId) {
        query.set('roomId', activeRoomId);
      }

      return query;
    };

    const publishHeartbeat = async () => {
      try {
        const response = await fetch(
          LOBBY_PRESENCE_ENDPOINT,
          {
            method: 'POST',
            headers: {
              'content-type':
                'application/json',
            },
            credentials: 'same-origin',
            cache: 'no-store',
            body: JSON.stringify({
              surface: 'lobby',
              appointmentId:
                appointmentId || undefined,
              visitId:
                visitId || undefined,
              roomId:
                activeRoomId || undefined,
            }),
          },
        );

        const data = await response
          .json()
          .catch(() => null);

        if (
          !response.ok ||
          !acceptSnapshot(data)
        ) {
          throw new Error(
            'lobby_presence_heartbeat_rejected',
          );
        }
      } catch {
        if (!cancelled) {
          setPresenceLoadState(
            'unavailable',
          );
        }
      }
    };

    const pollSnapshot = async () => {
      try {
        const query = contextQuery();

        const response = await fetch(
          LOBBY_PRESENCE_ENDPOINT +
            '?' +
            query.toString(),
          {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
          },
        );

        const data = await response
          .json()
          .catch(() => null);

        if (
          !response.ok ||
          !acceptSnapshot(data)
        ) {
          throw new Error(
            'lobby_presence_read_rejected',
          );
        }
      } catch {
        if (!cancelled) {
          setPresenceLoadState(
            'unavailable',
          );
        }
      }
    };

    setPresenceLoadState('checking');

    void publishHeartbeat();
    void pollSnapshot();

    const heartbeatTimer =
      window.setInterval(() => {
        void publishHeartbeat();
      }, LOBBY_HEARTBEAT_MS);

    const pollTimer =
      window.setInterval(() => {
        void pollSnapshot();
      }, LOBBY_POLL_MS);

    return () => {
      cancelled = true;

      window.clearInterval(
        heartbeatTimer,
      );

      window.clearInterval(
        pollTimer,
      );
    };
  }, [
    ctx.appointmentId,
    ctx.visitId,
    roomId,
  ]);

  const links = useMemo(() => {
    if (!roomId) return { clinician: '', patient: '' };

    const fallback = makeFallbackLinks(roomId, ctx, patientParticipantId);

    return {
      clinician: clinicianJoinUrl || fallback.clinician,
      patient: patientJoinUrl || fallback.patient,
    };
  }, [roomId, ctx, patientJoinUrl, clinicianJoinUrl, patientParticipantId]);

  const readinessItems = useMemo(
    () => [
      {
        label: 'Room context',
        ok: Boolean(roomId),
        detail: roomId ? `Room ${compactId(roomId)} is attached to this lobby.` : 'No room identifier is available.',
      },
      {
        label: 'Patient context',
        ok: Boolean(ctx.patientName || ctx.patientId),
        detail: ctx.patientName || ctx.patientId
          ? 'Patient identity context is available for handover.'
          : 'Patient name or identifier is missing from the lobby URL.',
      },
      {
        label: 'Secure entry',
        ok: Boolean(links.clinician),
        detail: links.clinician
          ? 'Clinician room link is ready.'
          : 'Clinician room link could not be generated.',
      },
      {
        label: 'Patient invite',
        ok: Boolean(links.patient),
        detail: links.patient
          ? 'Patient invite can be copied when needed.'
          : 'No patient invite link is available.',
      },
    ],
    [ctx.patientId, ctx.patientName, links.clinician, links.patient, roomId],
  );

  const copy = async (txt: string, label = 'Link') => {
    if (!txt) return;

    try {
      await navigator.clipboard.writeText(txt);
      setCopiedLabel(label);
      window.setTimeout(() => setCopiedLabel(''), 2200);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = txt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      setCopiedLabel(label);
      window.setTimeout(() => setCopiedLabel(''), 2200);
    }
  };

  if (!ready) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading clinician lobby…
        </div>
      </main>
    );
  }

  if (!roomId) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
            Clinician lobby
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-amber-950">
            Appointment room missing
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-amber-800">
            No appointment room was supplied. Open the lobby from Today or Appointments so the secure room context can be attached.
          </p>
        </section>

        <div className="flex flex-wrap gap-2">
          <a
            href="/today"
            className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Back to Today
          </a>
          <a
            href="/appointments"
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Open Appointments
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-700">
              Clinician lobby
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Ready the consultation room
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Review room context, confirm patient details, copy the patient invite if needed, then enter the secure Televisit room.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                Room {compactId(roomId)}
              </span>
              <span className="rounded-full border border-white bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                {displayValue(ctx.patientName || ctx.patientId, 'Patient context pending')}
              </span>
              <span className="rounded-full border border-white bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                Secure link ready
              </span>
            </div>
          </div>

          <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-3 lg:min-w-[390px]">
            <div className="rounded-2xl bg-white/85 px-3 py-2 shadow-sm">
              <div className="font-semibold text-slate-900">Preflight</div>
              <div>Room and context check</div>
            </div>
            <div className="rounded-2xl bg-white/85 px-3 py-2 shadow-sm">
              <div className="font-semibold text-slate-900">Privacy</div>
              <div>Confirm private setting</div>
            </div>
            <div className="rounded-2xl bg-white/85 px-3 py-2 shadow-sm">
              <div className="font-semibold text-slate-900">Next step</div>
              <div>Enter secure room</div>
            </div>
          </div>
        </div>
      </section>

      {copiedLabel && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {copiedLabel} copied.
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <div className="space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Appointment context
                </p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">
                  {displayValue(ctx.patientName, 'Patient awaiting context')}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {displayValue(ctx.reason, 'Consultation reason not supplied')}
                </p>
              </div>

              <a
                href={links.clinician}
                className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                Proceed to Consultation Session
              </a>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ContextCard label="Room" value={roomId} mono />
              <ContextCard label="Appointment" value={ctx.appointmentId} mono />
              <ContextCard label="Encounter" value={ctx.encounterId} mono />
              <ContextCard label="Visit" value={ctx.visitId} mono />
              <ContextCard label="Patient ID" value={ctx.patientId} mono />
              <ContextCard label="Clinician" value={ctx.clinicianName || ctx.clinicianId} />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Secure invite links
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">
                  Share only with the intended participant
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Avoid exposing secure links in screenshots, public channels, or non-clinical messages.
                </p>
              </div>

              {links.patient && (
                <button
                  onClick={() => copy(links.patient, 'Patient invite')}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  type="button"
                  title="Copy patient invite link"
                >
                  Copy patient invite
                </button>
              )}
            </div>

            <div className="mt-5 space-y-4">
              <CopyField label="Clinician room link" value={links.clinician} onCopy={(value) => copy(value, 'Clinician link')} />

              {links.patient && (
                <CopyField label="Patient invite link" value={links.patient} onCopy={(value) => copy(value, 'Patient invite')} />
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Readiness checklist
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              Preflight before entry
            </h2>

            <div className="mt-4 space-y-3">
              {readinessItems.map((item) => (
                <ReadinessItem
                  key={item.label}
                  label={item.label}
                  detail={item.detail}
                  ok={item.ok}
                />
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Clinical privacy
            </p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li className="rounded-2xl bg-slate-50 px-3 py-2">
                Confirm you are in a private clinical environment.
              </li>
              <li className="rounded-2xl bg-slate-50 px-3 py-2">
                Check camera, microphone, and speaker defaults inside the room if prompted.
              </li>
              <li className="rounded-2xl bg-slate-50 px-3 py-2">
                Keep patient invite links restricted to the intended participant.
              </li>
            </ul>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
              Room entry
            </p>
            <h2 className="mt-1 text-lg font-semibold">
              Enter when ready
            </h2>

            <p className="mt-2 text-sm text-slate-300">
              Patient lobby and consultation-room presence update automatically. Presence is informative and does not prevent room entry.
            </p>

            <div
              className="mt-4 grid gap-2"
              aria-live="polite"
            >
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Patient presence
                </span>

                <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white">
                  {presenceLoadLabel(
                    presenceLoadState,
                  )}
                </span>
              </div>

              <div
                className={
                  'rounded-2xl border px-3 py-3 ' +
                  presenceRowClass(
                    presenceLoadState ===
                      'live' &&
                      Boolean(
                        presence?.patient?.lobby
                          ?.online,
                      ),
                  )
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">
                    Patient lobby
                  </span>

                  <span className="text-xs font-semibold">
                    {presenceStatusText(
                      presenceLoadState,
                      presence?.patient?.lobby,
                      'In lobby',
                      'Not in lobby',
                    )}
                  </span>
                </div>

                <p className="mt-1 text-xs opacity-75">
                  {presenceDetail(
                    presenceLoadState,
                    presence?.patient?.lobby,
                  )}
                </p>
              </div>

              <div
                className={
                  'rounded-2xl border px-3 py-3 ' +
                  presenceRowClass(
                    presenceLoadState ===
                      'live' &&
                      Boolean(
                        presence?.patient?.room
                          ?.online,
                      ),
                  )
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">
                    Patient consultation room
                  </span>

                  <span className="text-xs font-semibold">
                    {presenceStatusText(
                      presenceLoadState,
                      presence?.patient?.room,
                      'In consultation room',
                      'Not in room',
                    )}
                  </span>
                </div>

                <p className="mt-1 text-xs opacity-75">
                  {presenceDetail(
                    presenceLoadState,
                    presence?.patient?.room,
                  )}
                </p>
              </div>
            </div>

            <a
              href={links.clinician}
              className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-100"
            >
              Proceed to Consultation Session
            </a>
          </section>
        </aside>
      </section>
    </main>
  );
}
