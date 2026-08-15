'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import {
  CalendarDays,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Mic,
  MicOff,
  MonitorPlay,
  Users,
  Video,
  VideoOff,
} from 'lucide-react';

import SFUClientProvider, { useSFUClient } from '@/app/sfu/[roomId]/SFUClientProvider';
import VideoDock from '@/app/sfu/[roomId]/VideoDock';

type TrainingParticipantRole =
  | 'clinician'
  | 'patient'
  | 'trainer'
  | 'observer'
  | 'admin';

type TrainingMaterial = {
  id: string;
  trainingSlotId?: string | null;
  moduleId?: string | null;
  moduleTitle?: string | null;
  assignmentId?: string | null;
  assignmentScope?: 'programme' | 'sessions' | null;
  sessionIds?: string[];
  resourceId?: string | null;
  resourceVersionId?: string | null;
  title: string;
  kind?: string | null;
  url?: string | null;
  fileKey?: string | null;
  hasStoredFile?: boolean;
  fileName?: string | null;
  version?: string | null;
  notes?: string | null;
  required?: boolean;
  uploadedAt?: string | null;
};

type TrainingContentVersion = {
  id: string;
  version: string;
  status: string;
  url?: string | null;
  fileKey?: string | null;
  hasStoredFile?: boolean;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

type TrainingContentResource = {
  id: string;
  title: string;
  kind: string;
  description?: string | null;
  required: boolean;
  currentVersion?: TrainingContentVersion | null;
};

type TrainingContentModule = {
  id: string;
  title: string;
  summary?: string | null;
  assignmentId: string;
  assignmentScope: 'programme' | 'sessions';
  sessionIds: string[];
  resources: TrainingContentResource[];
};

type TrainingSessionRef = {
  id: string;
  dayNumber: number;
  startAt?: string | null;
  endAt?: string | null;
  mode?: string | null;
  trainerName?: string | null;
};

type TrainingMaterialResponse = {
  ok: boolean;
  role?: TrainingParticipantRole;
  identity?: {
    subjectId?: string | null;
    uid?: string | null;
    displayName?: string | null;
  } | null;
  trainingSlotId?: string | null;
  sessions?: TrainingSessionRef[];
  modules?: TrainingContentModule[];
  legacyMaterials?: TrainingMaterial[];
  items?: TrainingMaterial[];
  materials?: TrainingMaterial[];
};

type TrainingContext = {
  ok: boolean;
  clinician?: {
    id: string;
    name?: string | null;
    email?: string | null;
    specialty?: string | null;
    status?: string | null;
  };
  onboarding?: {
    stage?: string | null;
    notes?: string | null;
  } | null;
  training?: {
    status?: string | null;
    startAt?: string | null;
    endAt?: string | null;
    mode?: string | null;
    joinUrl?: string | null;
    certificateAvailable?: boolean | null;
    certificateUrl?: string | null;
    roomState?: 'not_open' | 'open' | 'closed' | null;
    canJoin?: boolean | null;
    joinOpensAt?: string | null;
    joinClosesAt?: string | null;
  } | null;
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function safeText(value: unknown, fallback = '—') {
  const v = String(value ?? '').trim();
  return v || fallback;
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';

  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function sessionContentLabel(
  session: TrainingSessionRef,
) {
  const when =
    session.startAt
      ? fmtDateTime(
          session.startAt,
        )
      : 'Time not set';

  return (
    `Day ${session.dayNumber} - ${when}` +
    (
      session.trainerName
        ? ` - ${session.trainerName}`
        : ''
    )
  );
}

function roomErrorMessage(
  value: unknown,
  training?: TrainingContext['training'],
) {
  const code = String(value || '').trim();

  if (code === 'training_room_not_open') {
    return training?.joinOpensAt
      ? `This room opens ${fmtDateTime(training.joinOpensAt)}. Your booking is valid; please return when the admission window opens.`
      : 'This training room is not open yet. Your booking remains valid.';
  }

  if (code === 'training_room_closed') {
    return 'This training room has closed. Return to your training schedule to choose another available date.';
  }

  if (code === 'training_booking_required') {
    return 'A current training booking is required before you can join this room.';
  }

  if (
    code === 'unauthorized' ||
    code === 'untrusted_clinician_identity' ||
    code === 'clinician_identity_required' ||
    code === 'clinician_not_found'
  ) {
    return 'Your signed-in clinician profile could not be verified. Sign in again from the clinician application, then return to your training schedule.';
  }

  return code || 'Unable to join the training room right now.';
}

function TrainingRoomInner({
  roomId,
  trainingSlotId,
  clinicianId,
  participantRole,
  participantUid,
  joinToken,
}: {
  roomId: string;
  trainingSlotId: string;
  clinicianId: string;
  participantRole: TrainingParticipantRole;
  participantUid: string;
  joinToken: string;
}) {
  const {
    room,
    status,
    error,
    connect,
    disconnect,
    remoteParticipants,
    setMicEnabled,
    setCamEnabled,
  } = useSFUClient();

  const [ctx, setCtx] = useState<TrainingContext | null>(null);
  const [resolvedClinicianId, setResolvedClinicianId] = useState(clinicianId);
  const [materials, setMaterials] = useState<TrainingMaterial[]>([]);
  const [contentModules, setContentModules] = useState<TrainingContentModule[]>([]);
  const [contentSessions, setContentSessions] = useState<TrainingSessionRef[]>([]);
  const [admissionVerified, setAdmissionVerified] = useState(participantRole === 'clinician');
  const [resolvedParticipantName, setResolvedParticipantName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [accessingResourceKey, setAccessingResourceKey] = useState<string | null>(null);
  const [recordingConsentAccepted, setRecordingConsentAccepted] = useState(false);
  const [showRecordingConsent, setShowRecordingConsent] = useState(false);

  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [presentation, setPresentation] = useState(false);

  const [showOverlay, setShowOverlay] = useState(true);
  const [showVitals, setShowVitals] = useState(false);
  const [showVitalsOverlay, setShowVitalsOverlay] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [xrEnabled, setXrEnabled] = useState(false);

  const roomStatusLabel =
    status === 'connected'
      ? 'Connected'
      : status === 'connecting'
        ? 'Connecting'
        : status === 'error'
          ? 'Connection issue'
          : 'Not connected';

  const isStaffJoin =
    participantRole === 'admin' ||
    participantRole === 'trainer' ||
    participantRole === 'observer';

  const isObserver =
    participantRole === 'observer';

  const participantLabel =
    participantRole === 'trainer'
      ? 'Training trainer'
      : participantRole === 'admin'
        ? 'Training administrator'
        : participantRole === 'observer'
          ? 'Training observer'
          : participantRole === 'patient'
            ? 'Training patient'
            : 'Training clinician';

  async function loadRoomData() {
    setErr(null);

    try {
      if (
        participantRole !== 'clinician' &&
        !joinToken
      ) {
        throw new Error(
          'A signed training admission is required for this participant role.',
        );
      }

      const materialParams =
        new URLSearchParams();

      if (trainingSlotId) {
        materialParams.set(
          'trainingSlotId',
          trainingSlotId,
        );
      }

      if (clinicianId) {
        materialParams.set(
          'clinicianId',
          clinicianId,
        );
      }

      if (roomId) {
        materialParams.set(
          'roomId',
          roomId,
        );
      }

      const materialUrl =
        materialParams.toString()
          ? `/api/training/materials?${materialParams.toString()}`
          : '/api/training/materials';

      const materialHeaders =
        new Headers({
          accept:
            'application/json',
        });

      if (joinToken) {
        materialHeaders.set(
          'x-join-token',
          joinToken,
        );
      }

      const matRes =
        await fetch(
          materialUrl,
          {
            cache:
              'no-store',
            credentials:
              'include',
            headers:
              materialHeaders,
          },
        );

      const m =
        (await matRes
          .json()
          .catch(
            () => null,
          )) as
          | TrainingMaterialResponse
          | null;

      if (
        !matRes.ok ||
        !m?.ok
      ) {
        throw new Error(
          'Unable to load role-authorised training materials right now.',
        );
      }

      const canonicalRole =
        String(
          m.role ||
          participantRole,
        ).toLowerCase();

      if (
        joinToken &&
        canonicalRole !==
          participantRole
      ) {
        throw new Error(
          'The signed training admission role does not match this room entry.',
        );
      }

      setAdmissionVerified(
        participantRole ===
          'clinician' ||
        Boolean(
          joinToken,
        ),
      );

      setContentModules(
        Array.isArray(
          m.modules,
        )
          ? m.modules
          : [],
      );

      setContentSessions(
        Array.isArray(
          m.sessions,
        )
          ? m.sessions
          : [],
      );

      setMaterials(
        Array.isArray(
          m.legacyMaterials,
        )
          ? m.legacyMaterials
          : (
              Array.isArray(
                m.items,
              )
                ? m.items.filter(
                    (item) =>
                      !item.moduleId,
                  )
                : []
            ),
      );

      const canonicalName =
        String(
          m.identity
            ?.displayName ||
          participantLabel,
        ).trim();

      setResolvedParticipantName(
        canonicalName,
      );

      let nextCtx:
        | TrainingContext
        | null =
          null;

      if (
        participantRole ===
        'clinician'
      ) {
        const contextUrl =
          clinicianId
            ? `/api/training/context?clinicianId=${encodeURIComponent(clinicianId)}`
            : '/api/training/context';

        const ctxRes =
          await fetch(
            contextUrl,
            {
              cache:
                'no-store',
              credentials:
                'include',
            },
          );

        const c =
          (await ctxRes
            .json()
            .catch(
              () => null,
            )) as
            | TrainingContext
            | null;

        if (
          !ctxRes.ok ||
          !c?.ok
        ) {
          throw new Error(
            'Unable to load your training context right now.',
          );
        }

        nextCtx =
          c;

        const identityId =
          String(
            c.clinician?.id ||
            '',
          ).trim();

        if (!identityId) {
          throw new Error(
            'clinician_not_found',
          );
        }

        setResolvedClinicianId(
          identityId,
        );
      } else {
        nextCtx = {
          ok: true,
          clinician: {
            id:
              String(
                m.identity
                  ?.subjectId ||
                participantUid ||
                participantRole,
              ),
            name:
              canonicalName,
            email: null,
            specialty:
              'Contactless Medicine training',
            status:
              `${participantRole}_join`,
          },
          onboarding: {
            stage:
              `${participantRole}_join`,
            notes: null,
          },
          training: {
            status:
              'training_scheduled',
            startAt: null,
            endAt: null,
            mode:
              'virtual',
            joinUrl: null,
            certificateAvailable:
              false,
            certificateUrl:
              null,
          },
        };

        setResolvedClinicianId(
          '',
        );
      }

      setCtx(
        nextCtx,
      );
    } catch (
      e: any
    ) {
      setAdmissionVerified(
        participantRole ===
          'clinician',
      );

      setErr(
        e?.message ||
        'Unable to load the training room right now.',
      );
    }
  }

  useEffect(() => {
    loadRoomData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    clinicianId,
    trainingSlotId,
    participantRole,
    joinToken,
    roomId,
  ]);

  useEffect(() => {
    const postAttendance = async (action: 'join' | 'heartbeat' | 'leave') => {
      try {
        await fetch('/api/training/attendance', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            trainingSlotId,
            roomId,
            clinicianId: resolvedClinicianId,
            action,
            at: new Date().toISOString(),
          }),
        });
      } catch {
        // attendance is best-effort; do not interrupt the room
      }
    };

    if (status === 'connected' && resolvedClinicianId) {
      postAttendance('join');
      const id = window.setInterval(() => postAttendance('heartbeat'), 60_000);

      return () => {
        window.clearInterval(id);
        postAttendance('leave');
      };
    }
  }, [status, roomId, trainingSlotId, resolvedClinicianId]);

  async function openTrainingResourceFile(
    resource: TrainingContentResource,
    disposition:
      | 'inline'
      | 'attachment',
  ) {
    const version =
      resource.currentVersion;

    if (
      !version?.id ||
      !version
        .hasStoredFile
    ) {
      setErr(
        'This training resource does not have a stored file available.',
      );
      return;
    }

    const accessKey =
      `${resource.id}:${version.id}:${disposition}`;

    setAccessingResourceKey(
      accessKey,
    );
    setErr(null);

    const popup =
      window.open(
        '',
        '_blank',
      );

    try {
      const response =
        await fetch(
          '/api/training/materials',
          {
            method:
              'POST',
            cache:
              'no-store',
            credentials:
              'include',
            headers: {
              accept:
                'application/json',
              'content-type':
                'application/json',
              ...(
                joinToken
                  ? {
                      'x-join-token':
                        joinToken,
                    }
                  : {}
              ),
            },
            body:
              JSON.stringify({
                action:
                  'access_file',
                trainingSlotId,
                roomId,
                clinicianId:
                  resolvedClinicianId ||
                  clinicianId ||
                  null,
                resourceId:
                  resource.id,
                versionId:
                  version.id,
                disposition,
              }),
          },
        );

      const body =
        await response
          .json()
          .catch(
            () => null,
          );

      if (
        !response.ok ||
        !body?.ok ||
        !body
          ?.accessUrl
      ) {
        throw new Error(
          body?.message ||
          body?.error ||
          'Unable to create a secure training-file link.',
        );
      }

      if (popup) {
        popup.opener =
          null;
        popup.location.href =
          String(
            body.accessUrl,
          );
      } else {
        window.location.href =
          String(
            body.accessUrl,
          );
      }
    } catch (
      reason: any
    ) {
      if (
        popup &&
        !popup.closed
      ) {
        popup.close();
      }

      setErr(
        String(
          reason?.message ||
          'Unable to open the secure training file.',
        ),
      );
    } finally {
      setAccessingResourceKey(
        null,
      );
    }
  }

  async function joinLiveRoom() {
    setErr(null);
    setNotice(null);

    try {
      await connect();
      setNotice('Connected to the training room.');
    } catch (joinError: any) {
      setErr(roomErrorMessage(joinError?.message, ctx?.training));
    }
  }

  function handleConnect() {
    if (!recordingConsentAccepted) {
      setShowRecordingConsent(true);
      return;
    }

    void joinLiveRoom();
  }

  async function acceptRecordingConsentAndJoin() {
    setRecordingConsentAccepted(true);
    setShowRecordingConsent(false);
    await joinLiveRoom();
  }

  async function handleDisconnect() {
    try {
      await disconnect();
      setMicOn(false);
      setCamOn(false);
      setNotice('You left the training room.');
    } catch {
      setErr('Unable to leave cleanly. Please refresh the page if the room remains connected.');
    }
  }

  async function toggleMic() {
    if (isObserver) {
      setNotice(
        'Observers join in view-only mode and cannot publish microphone audio.',
      );
      return;
    }

    const next = !micOn;
    setMicOn(next);
    try {
      await setMicEnabled(next);
    } catch {
      setMicOn(!next);
      setErr('Unable to change microphone state.');
    }
  }

  async function toggleCam() {
    if (isObserver) {
      setNotice(
        'Observers join in view-only mode and cannot publish camera video.',
      );
      return;
    }

    const next = !camOn;
    setCamOn(next);
    try {
      await setCamEnabled(next);
    } catch {
      setCamOn(!next);
      setErr('Unable to change camera state.');
    }
  }

  const emptyVitals = useMemo(
    () => ({
      hr: undefined,
      spo2: undefined,
      tempC: undefined,
      rr: undefined,
      sys: undefined,
      dia: undefined,
    }),
    [],
  );

  const participantName =
    resolvedParticipantName ||
    ctx?.clinician?.name ||
    participantLabel;

  const joinPermitted =
    participantRole ===
      'clinician'
      ? ctx?.training
          ?.canJoin === true
      : admissionVerified &&
        Boolean(joinToken);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(79,70,229,0.10),_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_42%,_#ffffff_100%)]">
      <div className="mx-auto max-w-7xl p-4 md:p-6 space-y-5">
        <header className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-extrabold text-indigo-900">
                <MonitorPlay className="h-4 w-4" />
                Ambulant+ mandatory training room
              </div>

              <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
                Contactless Medicine training session
              </h1>

              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
                Join the trainer-led virtual room, review materials, keep attendance active, and complete the certification pathway before workspace access is unlocked.
              </p>

              {ctx?.training?.startAt ? (
                <div className="mt-2 text-xs text-slate-500">
                  Scheduled: {fmtDateTime(ctx.training.startAt)} → {fmtDateTime(ctx.training.endAt)}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cx(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold',
                  status === 'connected'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : status === 'connecting'
                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                      : status === 'error'
                        ? 'border-rose-200 bg-rose-50 text-rose-800'
                        : 'border-slate-200 bg-white text-slate-700',
                )}
              >
                <span
                  className={cx(
                    'h-2 w-2 rounded-full',
                    status === 'connected'
                      ? 'bg-emerald-500'
                      : status === 'connecting'
                        ? 'bg-amber-500'
                        : status === 'error'
                          ? 'bg-rose-500'
                          : 'bg-slate-400',
                  )}
                />
                {roomStatusLabel}
              </span>

              {status !== 'connected' ? (
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={status === 'connecting' || !joinPermitted}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {status === 'connecting' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                  Join room
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
                >
                  Leave room
                </button>
              )}

              <Link
                href="/training/schedule"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Back to training
              </Link>
            </div>
          </div>

          {notice ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              {notice}
            </div>
          ) : null}

          {!isStaffJoin && ctx?.training?.roomState === 'not_open' ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              {roomErrorMessage('training_room_not_open', ctx.training)}
            </div>
          ) : null}

          {!isStaffJoin && ctx?.training?.roomState === 'closed' ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
              {roomErrorMessage('training_room_closed', ctx.training)}
            </div>
          ) : null}

          {err || error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {err || error || 'Training room connection issue.'}
            </div>
          ) : null}
        </header>

        {showRecordingConsent ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-900">
                Recording notice
              </div>

              <h2 className="mt-4 text-xl font-black text-slate-950">
                Training session recording notice
              </h2>

              <p className="mt-3 text-sm leading-relaxed text-slate-700">
                This training session may be recorded for onboarding, attendance, quality assurance, audit, and certification purposes. By joining, you confirm that you understand the session may be recorded. The recording will be stored securely and accessed only by authorised Ambulant+ administrators.
              </p>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Link
                  href="/training/schedule"
                  className="inline-flex justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Back to training
                </Link>

                <button
                  type="button"
                  onClick={acceptRecordingConsentAndJoin}
                  className="inline-flex justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-indigo-700"
                >
                  I understand and join
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
          <div className="space-y-4">
            <div className="rounded-[28px] border border-slate-200 bg-white/90 p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-black text-slate-950">Live training room</div>
                  <div className="text-xs text-slate-500">
                    Room: <span className="font-mono">{roomId || '—'}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={toggleMic}
                    disabled={
                      status !== 'connected' ||
                      isObserver
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                    {micOn ? 'Mic on' : 'Mic off'}
                  </button>

                  <button
                    type="button"
                    onClick={toggleCam}
                    disabled={
                      status !== 'connected' ||
                      isObserver
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                    {camOn ? 'Camera on' : 'Camera off'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPresentation((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    {presentation ? 'Exit focus' : 'Focus mode'}
                  </button>
                </div>
              </div>

              <VideoDock
                room={room}
                vitals={emptyVitals}
                dense={false}
                presentation={presentation}
                patientName={participantName}
                micOn={micOn}
                camOn={camOn}
                showOverlay={showOverlay}
                showVitals={showVitals}
                showVitalsOverlay={showVitalsOverlay}
                captionsOn={captionsOn}
                isRecording={isRecording}
                xrEnabled={xrEnabled}
                pip={{ x: 0, y: 0 }}
                onToggleMic={toggleMic}
                onToggleCam={toggleCam}
                onToggleOverlay={setShowOverlay}
                onToggleVitals={setShowVitals}
                onToggleVitalsOverlay={setShowVitalsOverlay}
                onToggleCaptions={setCaptionsOn}
                onToggleRecording={
                  isObserver
                    ? () =>
                        setNotice(
                          'Observers cannot control training recording.',
                        )
                    : setIsRecording
                }
                onToggleXr={setXrEnabled}
                onEnterPresentation={() => setPresentation(true)}
                onExitPresentation={() => setPresentation(false)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <StatusCard
                title="Attendance"
                value={status === 'connected' ? 'Active heartbeat' : 'Not recording'}
                detail="Attendance is recorded while connected, with a heartbeat every 60 seconds."
                done={status === 'connected'}
              />

              <StatusCard
                title="Participants"
                value={`${remoteParticipants.length} remote`}
                detail="Trainer, admins, and other training participants appear here as they join."
                done={remoteParticipants.length > 0}
              />

              <StatusCard
                title="Certification gate"
                value={safeText(ctx?.onboarding?.stage || ctx?.training?.status)}
                detail="Admin certification is required before full workspace visibility."
                done={ctx?.onboarding?.stage === 'training_completed' || ctx?.training?.status === 'completed'}
              />
            </div>
          </div>

          <aside className="space-y-4">
            <Panel title="Training details">
              <div className="space-y-2 text-sm text-slate-700">
                <InfoRow
                  label={
                    participantRole ===
                    'clinician'
                      ? 'Clinician'
                      : 'Participant'
                  }
                  value={
                    participantName
                  }
                />
                <InfoRow
                  label="Role"
                  value={
                    participantRole
                  }
                />
                {participantRole === 'clinician' ? (
                  <>
                    <InfoRow label="Email" value={ctx?.clinician?.email} />
                    <InfoRow label="Specialty" value={ctx?.clinician?.specialty} />
                  </>
                ) : null}
                <InfoRow label="Stage" value={ctx?.onboarding?.stage} />
                <InfoRow label="Mode" value={ctx?.training?.mode} />
                <InfoRow label="Slot" value={trainingSlotId || ctx?.training?.startAt || '—'} mono />
              </div>
            </Panel>

            <Panel title="Training materials" icon={<FileText className="h-4 w-4" />}>
              {contentModules.length === 0 && materials.length === 0 ? (
                <div className="text-sm text-slate-600">
                  No published materials are currently available for your training role.
                </div>
              ) : (
                <div className="space-y-4">
                  {contentModules.map((module) => {
                    const assignedSessions =
                      module.sessionIds
                        .map(
                          (sessionId) =>
                            contentSessions.find(
                              (session) =>
                                session.id ===
                                sessionId,
                            ),
                        )
                        .filter(
                          (
                            session,
                          ): session is TrainingSessionRef =>
                            Boolean(session),
                        );

                    return (
                      <div
                        key={module.assignmentId}
                        className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-black text-slate-950">
                              {module.title}
                            </div>
                            {module.summary ? (
                              <div className="mt-1 text-xs text-slate-600">
                                {module.summary}
                              </div>
                            ) : null}
                          </div>

                          <span className="rounded-full border border-indigo-100 bg-white px-2 py-1 text-[10px] font-black uppercase text-indigo-700">
                            {module.assignmentScope === 'programme'
                              ? 'Programme-wide'
                              : `${module.sessionIds.length} session(s)`}
                          </span>
                        </div>

                        {module.assignmentScope === 'sessions' ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {assignedSessions.map((session) => (
                              <span
                                key={session.id}
                                title={`Session ID: ${session.id}`}
                                className="rounded-full border bg-white px-2 py-1 text-[10px] font-bold text-slate-600"
                              >
                                {sessionContentLabel(session)}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        <div className="mt-3 space-y-2">
                          {module.resources.map((resource) => {
                            const version =
                              resource.currentVersion;

                            return (
                              <div
                                key={resource.id}
                                className="rounded-xl border border-slate-200 bg-white p-3"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <div className="text-sm font-bold text-slate-900">
                                      {resource.title}
                                    </div>
                                    {resource.description ? (
                                      <div className="mt-1 text-xs text-slate-600">
                                        {resource.description}
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="flex flex-wrap gap-1">
                                    <span className="rounded-full border bg-slate-50 px-2 py-1 text-[10px] font-black uppercase text-slate-500">
                                      {resource.kind}
                                    </span>
                                    <span className="rounded-full border bg-slate-50 px-2 py-1 text-[10px] font-black uppercase text-slate-500">
                                      {resource.required ? 'Required' : 'Optional'}
                                    </span>
                                    {version?.version ? (
                                      <span className="rounded-full border bg-slate-50 px-2 py-1 text-[10px] font-black text-slate-500">
                                        {version.version}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>

                                <div className="mt-2 flex flex-wrap gap-2">
                                  {version?.url ? (
                                    <a
                                      href={version.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                      View resource
                                    </a>
                                  ) : null}

                                  {version?.hasStoredFile ? (
                                    <>
                                      <button
                                        type="button"
                                        disabled={
                                          accessingResourceKey ===
                                          `${resource.id}:${version.id}:inline`
                                        }
                                        onClick={() =>
                                          void openTrainingResourceFile(
                                            resource,
                                            'inline',
                                          )
                                        }
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        {accessingResourceKey ===
                                        `${resource.id}:${version.id}:inline`
                                          ? 'Opening...'
                                          : 'View file'}
                                      </button>

                                      <button
                                        type="button"
                                        disabled={
                                          accessingResourceKey ===
                                          `${resource.id}:${version.id}:attachment`
                                        }
                                        onClick={() =>
                                          void openTrainingResourceFile(
                                            resource,
                                            'attachment',
                                          )
                                        }
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                      >
                                        <Download className="h-3.5 w-3.5" />
                                        {accessingResourceKey ===
                                        `${resource.id}:${version.id}:attachment`
                                          ? 'Preparing...'
                                          : 'Download'}
                                      </button>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {materials.length > 0 ? (
                    <div className="space-y-2 border-t border-slate-200 pt-3">
                      <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                        Existing programme-only materials
                      </div>

                      {materials.map((m) => (
                        <div
                          key={m.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                        >
                          <div className="text-sm font-bold text-slate-900">
                            {m.title}
                          </div>

                          {m.notes ? (
                            <div className="mt-1 text-xs text-slate-600">
                              {m.notes}
                            </div>
                          ) : null}

                          <div className="mt-2 flex flex-wrap gap-2">
                            {m.url ? (
                              <a
                                href={m.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Open
                              </a>
                            ) : null}

                            {m.fileKey ? (
                              <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                                <Download className="h-3.5 w-3.5" />
                                Stored file
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </Panel>

            {participantRole === 'clinician' ? (
              <Panel title="Completion pathway" icon={<CheckCircle2 className="h-4 w-4" />}>
                <ol className="space-y-2 text-sm text-slate-700">
                  <li>1. Join and remain present during trainer-led orientation.</li>
                  <li>2. Complete platform, device, documentation, and safety workflow training.</li>
                  <li>3. Admin confirms attendance and certifies completion.</li>
                  <li>4. Your clinician profile can then be activated for patient visibility.</li>
                </ol>

                {ctx?.training?.certificateAvailable && ctx?.training?.certificateUrl ? (
                  <a
                    href={`${ctx.training.certificateUrl}?download=1`}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900 hover:bg-emerald-100"
                  >
                    <Download className="h-4 w-4" />
                    Download certificate
                  </a>
                ) : (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    Certificate becomes available after admin certification.
                  </div>
                )}
              </Panel>
            ) : (
              <Panel title="Participation identity" icon={<Users className="h-4 w-4" />}>
                <div className="space-y-2 text-sm text-slate-700">
                  <InfoRow label="Participant" value={participantName} />
                  <InfoRow label="Role" value={participantRole} />
                  <InfoRow
                    label="Media"
                    value={isObserver ? 'View-only' : 'Role-authorised'}
                  />
                </div>

                <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs leading-relaxed text-indigo-950">
                  Your signed training admission preserves this participant role through the room and RTC token. Materials are filtered server-side for the same role.
                </div>
              </Panel>
            )}

          </aside>
        </section>
      </div>
    </main>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={cx('text-right font-semibold text-slate-900', mono && 'font-mono text-xs')}>
        {safeText(value)}
      </span>
    </div>
  );
}

function StatusCard({
  title,
  value,
  detail,
  done,
}: {
  title: string;
  value: string;
  detail: string;
  done?: boolean;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-black text-slate-950">{title}</div>
        <span
          className={cx(
            'h-2.5 w-2.5 rounded-full',
            done ? 'bg-emerald-500' : 'bg-slate-300',
          )}
        />
      </div>
      <div className="mt-2 text-lg font-black text-slate-900">{value}</div>
      <div className="mt-1 text-xs leading-relaxed text-slate-500">{detail}</div>
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-lg font-black text-slate-950">
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}

function TrainingRoomPageContent() {
  const params = useParams<{ roomId: string }>();
  const search = useSearchParams() ?? new URLSearchParams();

  const roomId = String(params?.roomId || '');
  const trainingSlotId = search.get('trainingSlotId') || '';
  const clinicianIdFromQuery = search.get('clinicianId') || '';
  const uidFromQuery = search.get('uid') || search.get('identity') || '';
  const joinToken = search.get('joinToken') || '';
  const roleFromQuery = String(search.get('role') || '').toLowerCase();

  const participantRole: TrainingParticipantRole =
    roleFromQuery === 'admin' ||
    roleFromQuery === 'trainer' ||
    roleFromQuery === 'observer' ||
    roleFromQuery === 'patient'
      ? roleFromQuery
      : 'clinician';

  const clinicianId = clinicianIdFromQuery;

  const uid = uidFromQuery || (
    clinicianId
      ? `training-clinician-${clinicianId}`
      : `training-${participantRole}-${roomId || 'unknown'}`
  );

  const providerRole =
    participantRole === 'trainer' ||
    participantRole === 'observer'
      ? 'admin'
      : participantRole;

  return (
    <SFUClientProvider
      roomId={roomId}
      role={providerRole}
      uid={uid}
      tokenEndpoint={typeof window !== 'undefined' ? `${window.location.origin}/api/rtc/token` : '/api/rtc/token'}
      autoConnect={false}
    >
      <TrainingRoomInner
        roomId={roomId}
        trainingSlotId={trainingSlotId}
        clinicianId={clinicianId}
        participantRole={participantRole}
        participantUid={uid}
        joinToken={joinToken}
      />
    </SFUClientProvider>
  );
}

export default function TrainingRoomPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50">
          <div className="mx-auto max-w-7xl p-6">
            <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600">
              Loading training room…
            </div>
          </div>
        </main>
      }
    >
      <TrainingRoomPageContent />
    </Suspense>
  );
}
