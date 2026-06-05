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

type TrainingMaterial = {
  id: string;
  trainingSlotId?: string | null;
  title: string;
  kind?: string | null;
  url?: string | null;
  fileKey?: string | null;
  notes?: string | null;
  uploadedAt?: string | null;
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

function readLocalClinicianId() {
  if (typeof window === 'undefined') return '';

  const keys = [
    'ambulant.clinician.profile',
    'ambulant.profile',
  ];

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const id = parsed?.id || parsed?.clinicianId || parsed?.profile?.id;
      if (id) return String(id);
    } catch {
      // ignore
    }
  }

  return '';
}

function TrainingRoomInner({
  roomId,
  trainingSlotId,
  clinicianId,
}: {
  roomId: string;
  trainingSlotId: string;
  clinicianId: string;
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
  const [materials, setMaterials] = useState<TrainingMaterial[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  async function loadRoomData() {
    if (!clinicianId) {
      setErr('Unable to identify your clinician profile. Please return to the training schedule from your signed-in account.');
      return;
    }

    setErr(null);

    try {
      const contextUrl = `/api/training/context?clinicianId=${encodeURIComponent(clinicianId)}`;

      const [ctxRes, matRes] = await Promise.all([
        fetch(contextUrl, { cache: 'no-store', credentials: 'include' }),
        fetch('/api/training/materials', { cache: 'no-store', credentials: 'include' }),
      ]);

      const c = (await ctxRes.json().catch(() => null)) as TrainingContext | null;
      const m = (await matRes.json().catch(() => null)) as { ok: boolean; items?: TrainingMaterial[]; materials?: TrainingMaterial[] } | null;

      if (!ctxRes.ok || !c?.ok) {
        throw new Error('Unable to load your training context right now.');
      }

      if (!matRes.ok || !m?.ok) {
        throw new Error('Unable to load training materials right now.');
      }

      const list = Array.isArray(m.items)
        ? m.items
        : Array.isArray(m.materials)
          ? m.materials
          : [];

      setCtx(c);
      setMaterials(
        list.filter((x) => !x.trainingSlotId || !trainingSlotId || x.trainingSlotId === trainingSlotId),
      );
    } catch (e: any) {
      setErr(e?.message || 'Unable to load the training room right now.');
    }
  }

  useEffect(() => {
    loadRoomData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicianId, trainingSlotId]);

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
            clinicianId,
            action,
            at: new Date().toISOString(),
          }),
        });
      } catch {
        // attendance is best-effort; do not interrupt the room
      }
    };

    if (status === 'connected') {
      postAttendance('join');
      const id = window.setInterval(() => postAttendance('heartbeat'), 60_000);

      return () => {
        window.clearInterval(id);
        postAttendance('leave');
      };
    }
  }, [status, roomId, trainingSlotId, clinicianId]);

  async function handleConnect() {
    setErr(null);
    setNotice(null);

    try {
      await connect();
      setNotice('Connected to the training room.');
    } catch {
      setErr('Unable to join the training room. Please check your connection and try again.');
    }
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

  const patientName = ctx?.clinician?.name || 'Training participant';

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
                  disabled={status === 'connecting'}
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

          {err || error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {err || error || 'Training room connection issue.'}
            </div>
          ) : null}
        </header>

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
                    disabled={status !== 'connected'}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                    {micOn ? 'Mic on' : 'Mic off'}
                  </button>

                  <button
                    type="button"
                    onClick={toggleCam}
                    disabled={status !== 'connected'}
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
                patientName={patientName}
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
                onToggleRecording={setIsRecording}
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
                <InfoRow label="Clinician" value={ctx?.clinician?.name} />
                <InfoRow label="Email" value={ctx?.clinician?.email} />
                <InfoRow label="Specialty" value={ctx?.clinician?.specialty} />
                <InfoRow label="Stage" value={ctx?.onboarding?.stage} />
                <InfoRow label="Mode" value={ctx?.training?.mode} />
                <InfoRow label="Slot" value={trainingSlotId || ctx?.training?.startAt || '—'} mono />
              </div>
            </Panel>

            <Panel title="Training materials" icon={<FileText className="h-4 w-4" />}>
              {materials.length === 0 ? (
                <div className="text-sm text-slate-600">
                  No materials uploaded yet. The trainer can still conduct the live session.
                </div>
              ) : (
                <div className="space-y-3">
                  {materials.map((m) => (
                    <div key={m.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-sm font-bold text-slate-900">{m.title}</div>
                      {m.notes ? <div className="mt-1 text-xs text-slate-600">{m.notes}</div> : null}

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
              )}
            </Panel>

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
  const [clinicianId, setClinicianId] = useState(clinicianIdFromQuery);

  useEffect(() => {
    if (clinicianIdFromQuery) {
      setClinicianId(clinicianIdFromQuery);
      return;
    }

    const localId = readLocalClinicianId();
    if (localId) setClinicianId(localId);
  }, [clinicianIdFromQuery]);

  const uid = clinicianId
    ? `training-clinician-${clinicianId}`
    : `training-room-${roomId || 'unknown'}`;

  return (
    <SFUClientProvider
      roomId={roomId}
      role="clinician"
      uid={uid}
      tokenEndpoint="/api/rtc/token"
      autoConnect={false}
    >
      <TrainingRoomInner
        roomId={roomId}
        trainingSlotId={trainingSlotId}
        clinicianId={clinicianId}
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
