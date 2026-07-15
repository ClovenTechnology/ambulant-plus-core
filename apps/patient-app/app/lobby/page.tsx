// apps/patient-app/app/lobby/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bluetooth,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Copy,
  HeartPulse,
  Mic,
  Radio,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  Thermometer,
  UserRound,
  Video,
  Waves,
} from 'lucide-react';

import HMPane from '@/components/iomt/HMPane';
import WearablePane from '@/components/iomt/WearablePane';

type Ctx = {
  appointmentId?: string;
  patientId?: string;
  patientName?: string;
  encounterId?: string;
  clinicianId?: string;
  clinicianName?: string;
  clinicName?: string;
  clinicAddress?: string;
  reason?: string;
  startsAt?: string;
  visitMode?: string;
  participantRole?: string;
};

type AppointmentState = {
  ok?: boolean;
  appointmentId?: string;
  status?: string;
  paymentStatus?: string;
  ready?: boolean;
  pending?: boolean;
  failed?: boolean;
  appointment?: any;
  error?: string;
};

type DeviceStatus = {
  cameraPermission: 'unknown' | 'granted' | 'denied';
  microphonePermission: 'unknown' | 'granted' | 'denied';
  hasCamera: boolean;
  hasMicrophone: boolean;
  hasSpeaker: boolean;
  previewReady: boolean;
  micLevel: number;
  network: 'unknown' | 'excellent' | 'good' | 'fair' | 'poor';
  error?: string | null;
};

type SnapshotVitals = {
  ts?: number;
  hr?: number;
  spo2?: number;
  tempC?: number;
  rr?: number;
  sys?: number;
  dia?: number;
  source?: 'manual' | 'health_monitor' | 'nexring' | 'other';
};

type ManualVitalsDraft = {
  hr: string;
  spo2: string;
  tempC: string;
  rr: string;
  sys: string;
  dia: string;
  glucose: string;
  glucoseUnit: 'mg/dL' | 'mmol/L';
};

type DeviceMode = 'manual' | 'health-monitor' | 'nexring';

const MANUAL_SOURCE_PRIORITY = 80;

const ZA_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-ZA', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const ZA_TIME_FORMATTER = new Intl.DateTimeFormat('en-ZA', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function formatZaDateTime(value: Date | string | number) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value || '—');
  return ZA_DATE_TIME_FORMATTER.format(d);
}

function formatZaTime(value: Date = new Date()) {
  if (Number.isNaN(value.getTime())) return '—';
  return ZA_TIME_FORMATTER.format(value);
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function normalizeOrigin(value?: string | null) {
  const v = String(value || '').trim();
  return v ? v.replace(/\/+$/, '') : '';
}

function deriveClinicianOriginFromHere(here: URL) {
  if (here.hostname === 'localhost' || here.hostname === '127.0.0.1') {
    const u = new URL(here.toString());
    u.port = '3001';
    u.pathname = '/';
    u.search = '';
    u.hash = '';
    return u.origin;
  }

  if (here.hostname.startsWith('patient.')) {
    return `${here.protocol}//${here.hostname.replace(/^patient\./, 'clinician.')}`;
  }

  return here.origin;
}

function buildUrl(origin: string, path: string, ctx: Ctx) {
  const u = new URL(origin);
  u.pathname = path;
  u.search = '';
  u.hash = '';

  const sp = u.searchParams;

  (Object.entries(ctx) as Array<[keyof Ctx, string | undefined]>).forEach(
    ([key, value]) => {
      const clean = String(value || '').trim();
      if (clean) sp.set(String(key), clean);
    },
  );

  return u.toString();
}

function makeLinks(roomId: string, ctx: Ctx) {
  const cleanRoomValue = roomId.trim();

  if (!cleanRoomValue) {
    return {
      patientSfu: '',
      carerInvite: '',
      clinicianSfu: '',
    };
  }

  const cleanRoomId = encodeURIComponent(cleanRoomValue);

  if (typeof window === 'undefined') {
    const patientOrigin =
      normalizeOrigin(process.env.NEXT_PUBLIC_PATIENT_APP_ORIGIN) ||
      (process.env.NODE_ENV === 'production' ? 'https://patient.ambulantplus.co.za' : 'http://localhost:3000');

    const clinicianOrigin =
      normalizeOrigin(process.env.NEXT_PUBLIC_CLINICIAN_APP_ORIGIN) ||
      (process.env.NODE_ENV === 'production' ? 'https://clinician.ambulantplus.co.za' : 'http://localhost:3001');

    return {
      patientSfu: buildUrl(patientOrigin, `/sfu/${cleanRoomId}`, {
        ...ctx,
        participantRole: ctx.participantRole || 'patient',
      }),
      carerInvite: buildUrl(patientOrigin, `/sfu/${cleanRoomId}`, {
        ...ctx,
        participantRole: 'carer',
      }),
      clinicianSfu: buildUrl(clinicianOrigin, `/sfu/${cleanRoomId}`, ctx),
    };
  }

  const here = new URL(window.location.href);

  const patientOrigin =
    normalizeOrigin(process.env.NEXT_PUBLIC_PATIENT_APP_ORIGIN) || here.origin;

  const clinicianOrigin =
    normalizeOrigin(process.env.NEXT_PUBLIC_CLINICIAN_APP_ORIGIN) ||
    deriveClinicianOriginFromHere(here);

  return {
    patientSfu: buildUrl(patientOrigin, `/sfu/${cleanRoomId}`, {
      ...ctx,
      participantRole: ctx.participantRole || 'patient',
    }),
    carerInvite: buildUrl(patientOrigin, `/sfu/${cleanRoomId}`, {
      ...ctx,
      participantRole: 'carer',
    }),
    clinicianSfu: buildUrl(clinicianOrigin, `/sfu/${cleanRoomId}`, ctx),
  };
}

function readVitalsSnapshot(roomId: string, patientId?: string) {
  if (typeof window === 'undefined') return null;

  const keys = [
    `latestVitals:${roomId}`,
    `vitals:${roomId}`,
    `patient-lobby-vitals:${roomId}`,
    patientId ? `latestVitals:${patientId}` : '',
    patientId ? `vitals:${patientId}` : '',
  ].filter(Boolean);

  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw) as SnapshotVitals;
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // Ignore malformed local snapshots.
    }
  }

  return null;
}

function writeVitalsSnapshot(args: {
  roomId: string;
  patientId?: string;
  vitals: SnapshotVitals;
}) {
  if (typeof window === 'undefined') return;

  const { roomId, patientId, vitals } = args;
  const payload = JSON.stringify(vitals);

  const keys = [
    `latestVitals:${roomId}`,
    `vitals:${roomId}`,
    `patient-lobby-vitals:${roomId}`,
    patientId ? `latestVitals:${patientId}` : '',
    patientId ? `vitals:${patientId}` : '',
  ].filter(Boolean);

  keys.forEach((key) => {
    try {
      window.localStorage.setItem(key, payload);
    } catch {
      // Storage can fail in restricted/private contexts.
    }
  });
}

function toNumber(value: string) {
  const n = Number(String(value || '').trim());
  return Number.isFinite(n) ? n : undefined;
}

function formatWhen(value?: string) {
  if (!value) return 'Not provided';

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return formatZaDateTime(d);
}

function formatVitals(v: SnapshotVitals | null) {
  if (!v) return 'No pre-visit vitals saved yet';

  const bits = [
    typeof v.hr === 'number' ? `HR ${Math.round(v.hr)} bpm` : null,
    typeof v.spo2 === 'number' ? `SpO₂ ${Math.round(v.spo2)}%` : null,
    typeof v.tempC === 'number' ? `Temp ${v.tempC.toFixed(1)}°C` : null,
    typeof v.rr === 'number' ? `RR ${Math.round(v.rr)}/min` : null,
    typeof v.sys === 'number' && typeof v.dia === 'number'
      ? `BP ${Math.round(v.sys)}/${Math.round(v.dia)}`
      : null,
  ].filter(Boolean);

  return bits.length ? bits.join(' · ') : 'No pre-visit vitals saved yet';
}

function appointmentStatusTone(state: AppointmentState | null) {
  if (!state) return 'default';
  if (state.ready) return 'success';
  if (state.failed) return 'danger';
  if (state.pending) return 'warn';
  return 'default';
}

function networkTone(network: DeviceStatus['network']) {
  switch (network) {
    case 'excellent':
    case 'good':
      return 'success';
    case 'fair':
      return 'warn';
    case 'poor':
      return 'danger';
    default:
      return 'default';
  }
}

function vitalSourceLabel(source?: SnapshotVitals['source']) {
  switch (source) {
    case 'health_monitor':
      return 'Health Monitor';
    case 'nexring':
      return 'NexRing';
    case 'manual':
      return 'Manual entry';
    default:
      return 'Not recorded';
  }
}

function Pill({
  children,
  tone = 'default',
}: {
  children: React.ReactNode;
  tone?: 'default' | 'success' | 'warn' | 'danger' | 'info';
}) {
  const cls =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : tone === 'danger'
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : tone === 'info'
            ? 'border-sky-200 bg-sky-50 text-sky-700'
            : 'border-slate-200 bg-white text-slate-700';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium shadow-sm',
        cls,
      )}
    >
      {children}
    </span>
  );
}

function Card({
  title,
  subtitle,
  children,
  right,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'min-w-0 rounded-[24px] border border-white/70 bg-white/90 p-4 shadow-[0_12px_38px_rgba(15,23,42,0.07)] backdrop-blur-2xl sm:rounded-[30px] sm:p-5',
        className,
      )}
    >
      <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>
          ) : null}
        </div>
        {right}
      </div>

      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warn' | 'danger' | 'info';
}) {
  const cls =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50'
        : tone === 'danger'
          ? 'border-rose-200 bg-rose-50'
          : tone === 'info'
            ? 'border-sky-200 bg-sky-50'
            : 'border-slate-200 bg-slate-50';

  return (
    <div className={cn('min-w-0 rounded-2xl border p-3', cls)}>
      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function DeviceModeButton({
  mode,
  active,
  icon,
  title,
  subtitle,
  onClick,
}: {
  mode: DeviceMode;
  active: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: (mode: DeviceMode) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(mode)}
      className={cn(
        'min-h-11 w-full min-w-0 rounded-[24px] border p-4 text-left transition',
        active
          ? 'border-sky-200 bg-sky-50 shadow-[0_12px_36px_rgba(14,165,233,0.12)]'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={cn(
            'rounded-2xl border p-3',
            active
              ? 'border-sky-200 bg-white text-sky-700'
              : 'border-slate-200 bg-slate-50 text-slate-600',
          )}
        >
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-950">{title}</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</div>
        </div>
      </div>
    </button>
  );
}

async function emitManualVital(args: {
  patientId: string;
  type:
    | 'blood_pressure'
    | 'spo2'
    | 'temperature'
    | 'heart_rate'
    | 'blood_glucose';
  payload: any;
  recordedAt: string;
  roomId: string;
  appointmentId?: string;
}) {
  const res = await fetch(
    `/api/v1/patients/${encodeURIComponent(args.patientId)}/vitals`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: args.type,
        payload: args.payload,
        recorded_at: args.recordedAt,
        meta: {
          source: 'manual',
          device_class: 'manual',
          source_priority: MANUAL_SOURCE_PRIORITY,
          device_id: null,
          capture_surface: 'patient_lobby',
          room_id: args.roomId,
          appointment_id: args.appointmentId ?? null,
        },
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return {
      ok: false,
      status: res.status,
      error: text || `manual_vital_emit_failed_${res.status}`,
    };
  }

  return res.json().catch(() => ({ ok: true }));
}

export default function PatientLobbyPage() {
  const [roomId, setRoomId] = useState('');
  const [ctx, setCtx] = useState<Ctx>({});
  const [appointmentState, setAppointmentState] =
    useState<AppointmentState | null>(null);
  const [appointmentBusy, setAppointmentBusy] = useState(false);
  const [appointmentError, setAppointmentError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<string | null>(null);
  const [actionAudit, setActionAudit] = useState<string[]>([]);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('manual');
  const [vitalsSnapshot, setVitalsSnapshot] = useState<SnapshotVitals | null>(
    null,
  );
  const [manualSaving, setManualSaving] = useState(false);
  const [manualSaveNote, setManualSaveNote] = useState<string | null>(null);
  const [privacyReady, setPrivacyReady] = useState(false);

  const [manualVitals, setManualVitals] = useState<ManualVitalsDraft>({
    hr: '',
    spo2: '',
    tempC: '',
    rr: '',
    sys: '',
    dia: '',
    glucose: '',
    glucoseUnit: 'mmol/L',
  });

  const [device, setDevice] = useState<DeviceStatus>({
    cameraPermission: 'unknown',
    microphonePermission: 'unknown',
    hasCamera: false,
    hasMicrophone: false,
    hasSpeaker: false,
    previewReady: false,
    micLevel: 0,
    network: 'unknown',
    error: null,
  });

  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const sp = url.searchParams;

    const nextCtx: Ctx = {
      appointmentId:
        sp.get('appointmentId') ||
        sp.get('appointment') ||
        sp.get('appt') ||
        undefined,
      patientId:
        sp.get('patientId') ||
        sp.get('subjectPatientId') ||
        sp.get('patient') ||
        undefined,
      patientName: sp.get('patientName') || undefined,
      encounterId: sp.get('encounterId') || undefined,
      clinicianId: sp.get('clinicianId') || undefined,
      clinicianName: sp.get('clinicianName') || undefined,
      clinicName: sp.get('clinicName') || undefined,
      clinicAddress: sp.get('clinicAddress') || undefined,
      reason: sp.get('reason') || undefined,
      startsAt: sp.get('startsAt') || sp.get('start') || undefined,
      visitMode: sp.get('visitMode') || undefined,
      participantRole: sp.get('participantRole') || 'patient',
    };

    const urlRoomId =
      sp.get('roomId') || sp.get('room') || sp.get('visitId') || '';

    if (urlRoomId.trim()) {
      setRoomId(urlRoomId.trim());
    }

    setCtx(nextCtx);

    const snapshot = urlRoomId.trim()
      ? readVitalsSnapshot(urlRoomId.trim(), nextCtx.patientId)
      : null;

    setVitalsSnapshot(snapshot);

    if (snapshot) {
      setManualVitals((prev) => ({
        ...prev,
        hr: typeof snapshot.hr === 'number' ? String(Math.round(snapshot.hr)) : '',
        spo2:
          typeof snapshot.spo2 === 'number'
            ? String(Math.round(snapshot.spo2))
            : '',
        tempC:
          typeof snapshot.tempC === 'number' ? snapshot.tempC.toFixed(1) : '',
        rr: typeof snapshot.rr === 'number' ? String(Math.round(snapshot.rr)) : '',
        sys:
          typeof snapshot.sys === 'number'
            ? String(Math.round(snapshot.sys))
            : '',
        dia:
          typeof snapshot.dia === 'number'
            ? String(Math.round(snapshot.dia))
            : '',
      }));
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadAppointment() {
      if (!ctx.appointmentId) {
        setAppointmentState(null);
        return;
      }

      setAppointmentBusy(true);
      setAppointmentError(null);

      try {
        const res = await fetch(
          `/api/appointments/${encodeURIComponent(ctx.appointmentId)}/payment-state`,
          { cache: 'no-store' },
        );

        const data = await res.json().catch(() => null);

        if (!mounted) return;

        if (!res.ok || data?.ok === false) {
          throw new Error(
            data?.error || data?.message || `Appointment load failed (${res.status})`,
          );
        }

        const appointment = data?.appointment || data?.data?.appointment || data?.data || data;
        setAppointmentState(data);

        setCtx((prev) => ({
          ...prev,
          appointmentId: prev.appointmentId || data?.appointmentId || appointment?.id,
          patientId:
            prev.patientId ||
            appointment?.patientId ||
            appointment?.subjectPatientId ||
            appointment?.patient_id ||
            appointment?.subject_patient_id,
          patientName:
            prev.patientName ||
            appointment?.patientName ||
            appointment?.patient?.name ||
            appointment?.subjectPatient?.name,
          clinicianId:
            prev.clinicianId ||
            appointment?.clinicianId ||
            appointment?.clinician_id ||
            appointment?.clinician?.id,
          clinicianName:
            prev.clinicianName ||
            appointment?.clinicianName ||
            appointment?.clinician?.displayName ||
            appointment?.clinician?.name,
          reason:
            prev.reason ||
            appointment?.reason ||
            appointment?.title ||
            appointment?.notes,
          startsAt:
            prev.startsAt ||
            appointment?.startsAt ||
            appointment?.starts_at ||
            appointment?.start,
          visitMode:
            prev.visitMode ||
            appointment?.visitMode ||
            appointment?.visit_mode ||
            appointment?.location,
        }));

        const nextRoom =
          appointment?.roomId ||
          appointment?.room_id ||
          appointment?.visitId ||
          appointment?.visit_id;

        if (typeof nextRoom === 'string' && nextRoom.trim()) {
          setRoomId((prev) => (prev.trim() ? prev : nextRoom.trim()));
        }
      } catch (err: any) {
        if (!mounted) return;
        setAppointmentError(err?.message || 'Could not load appointment context');
      } finally {
        if (mounted) setAppointmentBusy(false);
      }
    }

    void loadAppointment();

    return () => {
      mounted = false;
    };
  }, [ctx.appointmentId]);

  const links = useMemo(() => makeLinks(roomId, ctx), [roomId, ctx]);

  const readinessScore = useMemo(() => {
    let score = 0;

    if (roomId.trim()) score += 18;
    if (ctx.appointmentId && !appointmentBusy && !appointmentError) score += 14;
    if (ctx.appointmentId && appointmentState?.ready) score += 12;
    if (device.hasCamera) score += 8;
    if (device.hasMicrophone) score += 8;
    if (device.previewReady) score += 20;
    if (privacyReady) score += 10;
    if (vitalsSnapshot) score += 20;

    return Math.max(0, Math.min(100, score));
  }, [
    appointmentState?.ready,
    ctx.appointmentId,
    ctx.patientId,
    ctx.patientName,
    device.hasCamera,
    device.hasMicrophone,
    device.previewReady,
    privacyReady,
    roomId,
    vitalsSnapshot,
  ]);

  const canProceed =
    Boolean(roomId.trim()) &&
    Boolean(ctx.appointmentId) &&
    Boolean(appointmentState?.ready) &&
    privacyReady &&
    !appointmentState?.pending &&
    !appointmentState?.failed &&
    !appointmentBusy;

  const readinessItems = [
    { label: 'Consultation room selected', ok: Boolean(roomId.trim()) },
    {
      label: 'Appointment context loaded',
      ok: Boolean(ctx.appointmentId) && !appointmentBusy && !appointmentError,
    },
    {
      label: 'Payment confirmed or appointment approved',
      ok: Boolean(ctx.appointmentId && appointmentState?.ready),
    },
    { label: 'Camera detected', ok: device.hasCamera },
    { label: 'Microphone detected', ok: device.hasMicrophone },
    { label: 'Media preview completed', ok: device.previewReady },
    { label: 'Consent and privacy check accepted', ok: privacyReady },
    { label: 'Pre-visit vitals available', ok: Boolean(vitalsSnapshot) },
  ];

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyState(`${label} copied`);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      setCopyState(`${label} copied`);
    }

    setActionAudit((prev) =>
      [`${formatZaTime()} · ${label} copied`, ...prev].slice(
        0,
        8,
      ),
    );

    window.setTimeout(() => setCopyState(null), 1400);
  }

  async function testDevices() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setDevice((prev) => ({
        ...prev,
        error: 'Media devices are not available in this browser.',
      }));
      return;
    }

    try {
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = mediaDevices.some((d) => d.kind === 'videoinput');
      const hasMicrophone = mediaDevices.some((d) => d.kind === 'audioinput');
      const hasSpeaker = mediaDevices.some((d) => d.kind === 'audiooutput');

      const conn = (navigator as any).connection;
      const downlink =
        typeof conn?.downlink === 'number' ? Number(conn.downlink) : null;

      let network: DeviceStatus['network'] = 'unknown';

      if (downlink !== null) {
        if (downlink >= 10) network = 'excellent';
        else if (downlink >= 4) network = 'good';
        else if (downlink >= 1.5) network = 'fair';
        else network = 'poor';
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: hasCamera,
        audio: hasMicrophone
          ? {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          : false,
      });

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;

      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
      }

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      setDevice({
        cameraPermission:
          hasCamera && videoTrack ? 'granted' : hasCamera ? 'denied' : 'unknown',
        microphonePermission:
          hasMicrophone && audioTrack
            ? 'granted'
            : hasMicrophone
              ? 'denied'
              : 'unknown',
        hasCamera,
        hasMicrophone,
        hasSpeaker,
        previewReady: Boolean(videoTrack || audioTrack),
        micLevel: 0,
        network,
        error: null,
      });

      setActionAudit((prev) =>
        [`${formatZaTime()} · Device check completed`, ...prev].slice(
          0,
          8,
        ),
      );

      if (audioTrack) {
        try {
          audioCtxRef.current?.close().catch(() => undefined);
        } catch {
          // Ignore cleanup failure.
        }

        const audioCtx = new AudioContext();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;

        const source = audioCtx.createMediaStreamSource(
          new MediaStream([audioTrack]),
        );

        source.connect(analyser);

        audioCtxRef.current = audioCtx;
        analyserRef.current = analyser;

        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (!analyserRef.current) return;

          analyserRef.current.getByteFrequencyData(data);

          const avg =
            data.reduce((total, item) => total + item, 0) /
            Math.max(1, data.length);

          setDevice((prev) => ({
            ...prev,
            micLevel: Math.min(100, Math.round((avg / 160) * 100)),
          }));

          rafRef.current = window.requestAnimationFrame(tick);
        };

        if (rafRef.current) {
          window.cancelAnimationFrame(rafRef.current);
        }

        rafRef.current = window.requestAnimationFrame(tick);
      }
    } catch (err: any) {
      setDevice((prev) => ({
        ...prev,
        previewReady: false,
        cameraPermission: prev.hasCamera ? 'denied' : prev.cameraPermission,
        microphonePermission: prev.hasMicrophone
          ? 'denied'
          : prev.microphonePermission,
        error: err?.message || 'Device test failed',
      }));
    }
  }

  function stopPreview() {
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    try {
      audioCtxRef.current?.close().catch(() => undefined);
    } catch {
      // Ignore cleanup failure.
    }

    audioCtxRef.current = null;
    analyserRef.current = null;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
    }

    setDevice((prev) => ({
      ...prev,
      previewReady: false,
      micLevel: 0,
    }));
  }

  useEffect(() => {
    return () => {
      stopPreview();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveManualVitals() {
    const recordedAt = new Date().toISOString();

    const snapshot: SnapshotVitals = {
      ts: Date.now(),
      hr: toNumber(manualVitals.hr),
      spo2: toNumber(manualVitals.spo2),
      tempC: toNumber(manualVitals.tempC),
      rr: toNumber(manualVitals.rr),
      sys: toNumber(manualVitals.sys),
      dia: toNumber(manualVitals.dia),
      source: 'manual',
    };

    const glucose = toNumber(manualVitals.glucose);

    const hasAny =
      typeof snapshot.hr === 'number' ||
      typeof snapshot.spo2 === 'number' ||
      typeof snapshot.tempC === 'number' ||
      typeof snapshot.rr === 'number' ||
      typeof snapshot.sys === 'number' ||
      typeof snapshot.dia === 'number' ||
      typeof glucose === 'number';

    if (!hasAny) {
      alert('Please enter at least one vital sign before saving.');
      return;
    }

    const cleanRoomId = roomId.trim();

    if (!cleanRoomId) {
      setManualSaveNote('Add the consultation room ID before saving pre-visit vitals.');
      return;
    }

    writeVitalsSnapshot({
      roomId: cleanRoomId,
      patientId: ctx.patientId,
      vitals: snapshot,
    });

    setVitalsSnapshot(snapshot);
    setManualSaveNote('Manual vitals saved locally for this consultation room.');
    setActionAudit((prev) =>
      [`${formatZaTime()} · Manual vitals saved`, ...prev].slice(
        0,
        8,
      ),
    );

    if (!ctx.patientId) {
      setManualSaveNote(
        'Manual vitals were saved locally. Add patientId to the lobby URL to persist them to the patient record.',
      );
      return;
    }

    setManualSaving(true);

    try {
      const writes: Array<Promise<any>> = [];

      if (typeof snapshot.hr === 'number') {
        writes.push(
          emitManualVital({
            patientId: ctx.patientId,
            type: 'heart_rate',
            payload: { bpm: snapshot.hr },
            recordedAt,
            roomId: cleanRoomId,
            appointmentId: ctx.appointmentId,
          }),
        );
      }

      if (typeof snapshot.spo2 === 'number') {
        writes.push(
          emitManualVital({
            patientId: ctx.patientId,
            type: 'spo2',
            payload: { pct: snapshot.spo2 },
            recordedAt,
            roomId: cleanRoomId,
            appointmentId: ctx.appointmentId,
          }),
        );
      }

      if (typeof snapshot.tempC === 'number') {
        writes.push(
          emitManualVital({
            patientId: ctx.patientId,
            type: 'temperature',
            payload: { celsius: snapshot.tempC },
            recordedAt,
            roomId: cleanRoomId,
            appointmentId: ctx.appointmentId,
          }),
        );
      }

      if (typeof snapshot.sys === 'number' || typeof snapshot.dia === 'number') {
        writes.push(
          emitManualVital({
            patientId: ctx.patientId,
            type: 'blood_pressure',
            payload: {
              systolic: snapshot.sys ?? null,
              diastolic: snapshot.dia ?? null,
              pulse: snapshot.hr ?? null,
            },
            recordedAt,
            roomId: cleanRoomId,
            appointmentId: ctx.appointmentId,
          }),
        );
      }

      if (typeof glucose === 'number') {
        writes.push(
          emitManualVital({
            patientId: ctx.patientId,
            type: 'blood_glucose',
            payload: {
              glucose,
              unit: manualVitals.glucoseUnit,
            },
            recordedAt,
            roomId: cleanRoomId,
            appointmentId: ctx.appointmentId,
          }),
        );
      }

      const results = await Promise.all(writes);
      const failed = results.filter((x) => x?.ok === false);

      if (failed.length > 0) {
        setManualSaveNote(
          'Manual vitals were saved locally, but one or more server writes failed. Please retry if needed.',
        );
      } else {
        setManualSaveNote(
          'Manual vitals saved and sent to the patient record.',
        );
      }
    } catch (err: any) {
      setManualSaveNote(
        err?.message ||
          'Manual vitals were saved locally, but could not be sent to the patient record.',
      );
    } finally {
      setManualSaving(false);
    }
  }

  return (
    <main data-p-ui="patient-lobby-page" className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.14),_transparent_26%),linear-gradient(180deg,_#f8fbff_0%,_#eef6ff_55%,_#f8fafc_100%)] p-4 text-slate-900 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="relative overflow-hidden rounded-[36px] border border-white/70 bg-white/88 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.09)] backdrop-blur-2xl md:p-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_30%)]" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                Ambulant+ Patient Lobby
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                Prepare for your consultation
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
                Check your connection, confirm your visit, capture fresh vitals
                manually or from a supported device, and enter the consultation
                room with everything ready for your clinician.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Pill tone="info">Room: {roomId || '—'}</Pill>
              <Pill
                tone={
                  readinessScore >= 80
                    ? 'success'
                    : readinessScore >= 55
                      ? 'warn'
                      : 'danger'
                }
              >
                Readiness: {readinessScore}%
              </Pill>
              <Pill tone={networkTone(device.network)}>
                {device.network === 'unknown'
                  ? 'Network unknown'
                  : `Network ${device.network}`}
              </Pill>
              <Pill tone={appointmentStatusTone(appointmentState)}>
                {appointmentBusy
                  ? 'Checking appointment'
                  : appointmentState?.ready
                    ? 'Visit authorised'
                    : appointmentState?.failed
                      ? 'Visit blocked'
                      : ctx.appointmentId
                        ? 'Appointment linked'
                        : 'Direct room'}
              </Pill>
            </div>
          </div>
        </section>

        {copyState ? (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
            {copyState}
          </div>
        ) : null}

        {appointmentError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {appointmentError}
          </div>
        ) : null}

        {appointmentState?.failed ? (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
            <div>
              This visit is currently blocked by its appointment or payment
              state. Please return to the appointment page or contact support
              before joining.
            </div>
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.25fr_0.9fr]">
          <div className="space-y-5">
            <Card
              title="Appointment snapshot"
              subtitle="Confirm that this is the correct visit before joining."
              right={
                <Pill tone={ctx.patientName || ctx.patientId ? 'success' : 'warn'}>
                  {ctx.patientName || 'Context pending'}
                </Pill>
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Stat label="Patient" value={ctx.patientName || 'Not provided'} />
                <Stat label="Patient ID" value={ctx.patientId || 'Not provided'} />
                <Stat
                  label="Clinician"
                  value={ctx.clinicianName || 'Not provided'}
                />
                <Stat label="Clinic" value={ctx.clinicName || 'Not provided'} />
                <Stat
                  label="Reason"
                  value={ctx.reason || 'Not provided'}
                  tone="info"
                />
                <Stat
                  label="Appointment time"
                  value={formatWhen(ctx.startsAt)}
                />
              </div>

              <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4 text-sm leading-6 text-slate-700">
                Vitals captured in this lobby become your latest pre-visit
                snapshot for the consultation workflow. You may still take more
                readings during the live session.
              </div>
            </Card>

            <Card
              title="Readiness checklist"
              subtitle="These checks reduce delay once the clinician is ready."
              right={
                <Pill tone={readinessScore >= 80 ? 'success' : 'warn'}>
                  {readinessScore >= 80 ? 'Ready' : 'Action recommended'}
                </Pill>
              }
            >
              <div className="grid gap-2">
                {readinessItems.map((item) => (
                  <div
                    key={item.label}
                    className={cn(
                      'flex items-center justify-between rounded-2xl border px-3 py-2 text-sm',
                      item.ok
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-amber-200 bg-amber-50',
                    )}
                  >
                    <span className="text-slate-800">{item.label}</span>
                    <span
                      className={cn(
                        'text-xs font-semibold',
                        item.ok ? 'text-emerald-700' : 'text-amber-700',
                      )}
                    >
                      {item.ok ? 'Done' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <a
                  href={canProceed ? links.patientSfu : undefined}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-sm',
                    canProceed
                      ? 'border border-emerald-200 bg-[linear-gradient(135deg,#ecfeff_0%,#eff6ff_45%,#f0fdf4_100%)] text-emerald-700 hover:brightness-[0.98]'
                      : 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400',
                  )}
                >
                  Proceed to consultation
                  <ArrowRight className="h-4 w-4" />
                </a>

                <button
                  type="button"
                  onClick={() => void testDevices()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700 shadow-sm hover:bg-sky-100"
                >
                  <Video className="h-4 w-4" />
                  Test camera and mic
                </button>
              </div>
            </Card>

            <Card
              title="Room setup"
              subtitle="Only change this if your appointment invite uses another room ID."
            >
              <input
                value={roomId}
                onChange={(e) => {
                  const next = e.target.value;
                  setRoomId(next);
                  setVitalsSnapshot(readVitalsSnapshot(next, ctx.patientId));
                }}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400"
                placeholder="Enter room ID"
              />

              <div className="mt-3 text-xs leading-5 text-slate-500">
                The consultation and invite links update automatically when the
                room ID changes.
              </div>
            </Card>
          </div>

          <div className="space-y-5">
            <Card
              title="Camera and microphone"
              subtitle="Preview your local setup before joining."
              right={
                <Pill tone={device.previewReady ? 'success' : 'warn'}>
                  {device.previewReady ? 'Preview ready' : 'Preview needed'}
                </Pill>
              }
            >
              <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-slate-950">
                <video
                  ref={previewVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="aspect-video w-full object-cover"
                />
              </div>

              {!device.previewReady ? (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                  Start a device test to see your camera preview here.
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Stat
                  label="Camera"
                  value={
                    device.hasCamera ? device.cameraPermission : 'Not detected'
                  }
                  tone={
                    device.cameraPermission === 'granted'
                      ? 'success'
                      : device.hasCamera
                        ? 'warn'
                        : 'danger'
                  }
                />
                <Stat
                  label="Microphone"
                  value={
                    device.hasMicrophone
                      ? device.microphonePermission
                      : 'Not detected'
                  }
                  tone={
                    device.microphonePermission === 'granted'
                      ? 'success'
                      : device.hasMicrophone
                        ? 'warn'
                        : 'danger'
                  }
                />
                <Stat
                  label="Speaker"
                  value={device.hasSpeaker ? 'Detected' : 'Not detected'}
                  tone={device.hasSpeaker ? 'success' : 'warn'}
                />
                <Stat
                  label="Network"
                  value={device.network}
                  tone={networkTone(device.network)}
                />
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    <Mic className="h-3.5 w-3.5" />
                    Mic activity
                  </div>
                  <div className="text-xs text-slate-500">{device.micLevel}%</div>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#38bdf8_0%,#22c55e_100%)] transition-all"
                    style={{ width: `${device.micLevel}%` }}
                  />
                </div>
              </div>

              {device.error ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {device.error}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void testDevices()}
                  className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100"
                >
                  Test again
                </button>
                <button
                  type="button"
                  onClick={stopPreview}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Stop preview
                </button>
              </div>
            </Card>

            <Card
              title="Pre-visit vitals"
              subtitle="Use a connected device where available, or enter readings manually."
              right={
                <Pill tone={vitalsSnapshot ? 'success' : 'warn'}>
                  {vitalsSnapshot ? 'Snapshot ready' : 'No snapshot yet'}
                </Pill>
              }
            >
              <div className="grid gap-3 md:grid-cols-3">
                <DeviceModeButton
                  mode="manual"
                  active={deviceMode === 'manual'}
                  onClick={setDeviceMode}
                  icon={<ClipboardCheck className="h-5 w-5" />}
                  title="Manual entry"
                  subtitle="For users without a Health Monitor or NexRing."
                />
                <DeviceModeButton
                  mode="health-monitor"
                  active={deviceMode === 'health-monitor'}
                  onClick={setDeviceMode}
                  icon={<Stethoscope className="h-5 w-5" />}
                  title="Health Monitor"
                  subtitle="Medical-grade BP, SpO₂, pulse, temp, glucose and ECG."
                />
                <DeviceModeButton
                  mode="nexring"
                  active={deviceMode === 'nexring'}
                  onClick={setDeviceMode}
                  icon={<Smartphone className="h-5 w-5" />}
                  title="NexRing"
                  subtitle="Wearable wellness insight for HR, SpO₂ and recovery trends."
                />
              </div>

              <div className="mt-4 rounded-[26px] border border-slate-200 bg-slate-50/80 p-4">
                {deviceMode === 'manual' ? (
                  <div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="text-xs text-slate-500">
                        Heart rate
                        <input
                          value={manualVitals.hr}
                          onChange={(e) =>
                            setManualVitals((prev) => ({
                              ...prev,
                              hr: e.target.value,
                            }))
                          }
                          inputMode="numeric"
                          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                          placeholder="bpm"
                        />
                      </label>

                      <label className="text-xs text-slate-500">
                        SpO₂
                        <input
                          value={manualVitals.spo2}
                          onChange={(e) =>
                            setManualVitals((prev) => ({
                              ...prev,
                              spo2: e.target.value,
                            }))
                          }
                          inputMode="numeric"
                          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                          placeholder="%"
                        />
                      </label>

                      <label className="text-xs text-slate-500">
                        Temperature
                        <input
                          value={manualVitals.tempC}
                          onChange={(e) =>
                            setManualVitals((prev) => ({
                              ...prev,
                              tempC: e.target.value,
                            }))
                          }
                          inputMode="decimal"
                          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                          placeholder="°C"
                        />
                      </label>

                      <label className="text-xs text-slate-500">
                        Respiratory rate
                        <input
                          value={manualVitals.rr}
                          onChange={(e) =>
                            setManualVitals((prev) => ({
                              ...prev,
                              rr: e.target.value,
                            }))
                          }
                          inputMode="numeric"
                          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                          placeholder="/min"
                        />
                      </label>

                      <label className="text-xs text-slate-500">
                        BP systolic
                        <input
                          value={manualVitals.sys}
                          onChange={(e) =>
                            setManualVitals((prev) => ({
                              ...prev,
                              sys: e.target.value,
                            }))
                          }
                          inputMode="numeric"
                          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                          placeholder="SYS"
                        />
                      </label>

                      <label className="text-xs text-slate-500">
                        BP diastolic
                        <input
                          value={manualVitals.dia}
                          onChange={(e) =>
                            setManualVitals((prev) => ({
                              ...prev,
                              dia: e.target.value,
                            }))
                          }
                          inputMode="numeric"
                          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                          placeholder="DIA"
                        />
                      </label>

                      <label className="text-xs text-slate-500 sm:col-span-2">
                        Blood glucose
                        <input
                          value={manualVitals.glucose}
                          onChange={(e) =>
                            setManualVitals((prev) => ({
                              ...prev,
                              glucose: e.target.value,
                            }))
                          }
                          inputMode="decimal"
                          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                          placeholder="Optional"
                        />
                      </label>

                      <label className="text-xs text-slate-500">
                        Glucose unit
                        <select
                          value={manualVitals.glucoseUnit}
                          onChange={(e) =>
                            setManualVitals((prev) => ({
                              ...prev,
                              glucoseUnit: e.target.value as
                                | 'mg/dL'
                                | 'mmol/L',
                            }))
                          }
                          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                        >
                          <option value="mmol/L">mmol/L</option>
                          <option value="mg/dL">mg/dL</option>
                        </select>
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => void saveManualVitals()}
                      disabled={manualSaving}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {manualSaving
                        ? 'Saving vitals...'
                        : 'Save manual vitals for clinician'}
                    </button>

                    {manualSaveNote ? (
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                        {manualSaveNote}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {deviceMode === 'health-monitor' ? (
                  <div className="rounded-[24px] border border-slate-200 bg-white p-3">
                    <HMPane embedded />
                  </div>
                ) : null}

                {deviceMode === 'nexring' ? (
                  <div className="rounded-[24px] border border-slate-200 bg-white p-3">
                    <WearablePane
                      roomId={roomId}
                      patientId={ctx.patientId}
                      embedded
                    />
                  </div>
                ) : null}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      Latest pre-visit snapshot
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {formatVitals(vitalsSnapshot)}
                    </div>
                  </div>
                  <Pill tone={vitalsSnapshot ? 'success' : 'warn'}>
                    {vitalSourceLabel(vitalsSnapshot?.source)}
                  </Pill>
                </div>

                <div className="mt-2 text-xs text-slate-500">
                  {vitalsSnapshot?.ts
                    ? `Captured ${formatZaDateTime(vitalsSnapshot.ts)}`
                    : 'No pre-visit vitals have been saved for this room yet.'}
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-5">
            <Card
              title="Join consultation"
              subtitle="Your main action appears here once the room is ready."
              right={
                <Pill tone={canProceed ? 'success' : 'danger'}>
                  {canProceed ? 'Room available' : 'Room unavailable'}
                </Pill>
              }
            >
              <a
                href={canProceed ? links.patientSfu : undefined}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-[24px] px-4 py-4 text-sm font-semibold shadow-sm',
                  canProceed
                    ? 'border border-emerald-200 bg-[linear-gradient(135deg,#ecfeff_0%,#eff6ff_45%,#f0fdf4_100%)] text-emerald-700 hover:brightness-[0.98]'
                    : 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400',
                )}
              >
                Proceed to my consultation
                <ArrowRight className="h-4 w-4" />
              </a>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                Keep this page open until you are ready. Your clinician can
                review the latest pre-visit snapshot when the consultation
                begins.
              </div>
            </Card>

            <Card
              title="Invite a carer or dependant"
              subtitle="Only share this with someone authorised to join your consultation."
            >
              <div className="space-y-3">
                <div>
                  <div className="mb-1 text-xs text-slate-500">
                    Your consultation link
                  </div>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={links.patientSfu || 'Room ID required before link is generated'}
                      className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        void copyText(links.patientSfu, 'Consultation link')
                      }
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Copy className="h-4 w-4" />
                      Copy
                    </button>
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-xs text-slate-500">
                    Carer / dependant invite
                  </div>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={links.carerInvite || 'Room ID required before invite link is generated'}
                      className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        void copyText(links.carerInvite, 'Carer invite')
                      }
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Copy className="h-4 w-4" />
                      Copy
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void copyText(
                      `Consultation: ${links.patientSfu}\nCarer invite: ${links.carerInvite}`,
                      'Invite links',
                    )
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Copy all invite links
                </button>
              </div>
            </Card>

            <Card
              title="Consent and privacy"
              subtitle="Confirm this before entering the live consultation room."
            >
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/70 px-3 py-3 text-sm leading-6 text-slate-700">
                <input
                  type="checkbox"
                  checked={privacyReady}
                  onChange={(event) => setPrivacyReady(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600"
                />
                <span>
                  I am in a private place, I understand the live room will ask for clinical consent, and I will only share invite links with authorised people.
                </span>
              </label>
            </Card>

            <Card
              title="Privacy and comfort"
              subtitle="A calm, safe pre-consultation checklist."
            >
              <div className="space-y-2 text-sm text-slate-700">
                <div className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <UserRound className="mt-0.5 h-4 w-4 text-sky-600" />
                  <span>Sit somewhere private, quiet and well lit.</span>
                </div>
                <div className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <Bluetooth className="mt-0.5 h-4 w-4 text-indigo-600" />
                  <span>Keep your monitor, ring or medication list nearby.</span>
                </div>
                <div className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <Radio className="mt-0.5 h-4 w-4 text-emerald-600" />
                  <span>Use headphones where possible to protect privacy.</span>
                </div>
                <div className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <Waves className="mt-0.5 h-4 w-4 text-cyan-600" />
                  <span>Do not share consultation links with unauthorised people.</span>
                </div>
              </div>
            </Card>

            <Card title="Lobby activity" subtitle="Recent actions from this page.">
              <div className="space-y-2">
                {actionAudit.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                    <Clock3 className="h-4 w-4" />
                    No lobby actions yet.
                  </div>
                ) : (
                  actionAudit.map((entry, index) => (
                    <div
                      key={`${entry}-${index}`}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                    >
                      {entry}
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}