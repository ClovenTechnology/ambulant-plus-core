// apps/patient-app/app/myCare/devices/stethoscope/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  Bluetooth,
  Circle,
  Download,
  ExternalLink,
  Info,
  Loader2,
  Mic,
  Play,
  RefreshCw,
  Square,
  Stethoscope,
  Trash2,
  UploadCloud,
  Volume2,
  X,
  CheckCircle2,
  Ban,
  RotateCw,
  Copy,
  ShieldCheck,
  EyeOff,
} from 'lucide-react';

import { StethoscopeNUS, type StethoscopeTelemetry } from '@/src/devices/decoders/stethoscopeNUS';
import { WavRecorder, type PcmChunk } from '@/src/devices/decoders/wav';

// ✅ A) Placement diagram import (pure UI)
import AuscultationPlacementDiagram, {
  type AuscTarget,
  type BodySex,
} from '@/components/stethoscope/AuscultationPlacementDiagram';

// ✅ A) Add import
import PlacementCameraPane from '@/components/stethoscope/PlacementCameraPane';

type SiteKey =
  | 'chest-apex'
  | 'chest-base'
  | 'chest-left'
  | 'chest-right'
  | 'back-upper'
  | 'back-lower'
  | 'neck'
  | 'other';

const SITES: Array<{ key: SiteKey; label: string; hint: string }> = [
  { key: 'chest-apex', label: 'Chest (apex)', hint: 'Heart focus' },
  { key: 'chest-base', label: 'Chest (base)', hint: 'Heart/valves' },
  { key: 'chest-left', label: 'Chest (left)', hint: 'Lung fields' },
  { key: 'chest-right', label: 'Chest (right)', hint: 'Lung fields' },
  { key: 'back-upper', label: 'Back (upper)', hint: 'Upper lobes' },
  { key: 'back-lower', label: 'Back (lower)', hint: 'Lower lobes' },
  { key: 'neck', label: 'Neck', hint: 'Upper airway' },
  { key: 'other', label: 'Other', hint: 'Custom' },
];

const GUIDED_STEPS: Array<{ site: SiteKey; label: string }> = [
  { site: 'chest-apex', label: 'Apex' },
  { site: 'chest-base', label: 'Base' },
  { site: 'chest-left', label: 'Chest Left' },
  { site: 'chest-right', label: 'Chest Right' },
  { site: 'back-upper', label: 'Back Upper' },
  { site: 'back-lower', label: 'Back Lower' },
  { site: 'neck', label: 'Neck' },
];

type RecordingStatus = 'queued' | 'uploading' | 'uploaded' | 'failed';
type QualityTag = 'unknown' | 'good' | 'noise';

type QuickAnalysis = {
  rms: number; // 0..1
  peak: number; // 0..1
  clipPct: number; // %
  dc: number;
  zcrPerSec: number;
};

type RecordingMeta = {
  id: string;
  patientId: string;

  createdAt: string; // ISO
  durationMs: number;
  sizeBytes: number;
  sampleRate: number;

  site: SiteKey;
  note?: string;

  quality?: QualityTag;
  peaks?: number[];
  analysis?: QuickAnalysis;

  sessionId?: string;
  stepIndex?: number;

  // attach targets
  visitId?: string;
  roomId?: string;
  appointmentId?: string;

  // consent/audit (local shadow; server stores in meta)
  consent?: {
    recorded: boolean;
    source: 'manual' | 'televisit';
    consentId?: string;
    acceptedAt?: string;
    consentVersion?: string;
  };
  audit?: {
    recordedByUid?: string;
    recordedByRole?: 'patient' | 'clinician' | 'staff' | 'observer' | 'admin';
    deviceId?: string;
    deviceName?: string;
    manufacturer?: string;
    model?: string;
    firmware?: string;
  };

  status: RecordingStatus;
  attempts: number;
  lastError?: string;

  uploadedAt?: string;
  serverRef?: string; // server row id
  serverUrl?: string; // fileUrl
};

type SessionBundle = {
  id: string;
  patientId: string;
  createdAt: string;
  durationSec: number;
  steps: Array<{ site: SiteKey; clipId?: string }>;
  summaryNote?: string;
  status: 'in_progress' | 'complete';
};

type PatientCtx = {
  patientId: string;
  name?: string;
  mrn?: string;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v.toFixed(u === 0 ? 0 : 1)} ${units[u]}`;
}

function formatMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function shortErr(e: unknown) {
  const msg = (e as any)?.message ? String((e as any).message) : String(e ?? 'Unknown error');
  return msg.length > 180 ? `${msg.slice(0, 180)}…` : msg;
}

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `rec_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

function classifyBtError(e: unknown): { title: string; detail: string } {
  const name = String((e as any)?.name || '');
  const msg = String((e as any)?.message || e || '');
  if (name === 'NotAllowedError')
    return { title: 'Permission blocked', detail: 'Bluetooth permission was denied or blocked by the browser/OS.' };
  if (name === 'NotFoundError')
    return { title: 'Device not found', detail: 'No device was selected, or the device is unavailable/off.' };
  if (name === 'SecurityError')
    return { title: 'Security restriction', detail: 'Web Bluetooth requires HTTPS and compatible browser settings.' };
  if (name === 'NetworkError' || /gatt|GATT/i.test(msg))
    return { title: 'GATT connection error', detail: msg || 'The device could not be reached or the GATT session failed.' };
  return { title: 'Bluetooth error', detail: msg || 'Unknown Bluetooth failure.' };
}

/* =========================
   Persistent storage (IDB)
========================= */
const DB_NAME = 'ambulant_steth_v1';
const DB_STORE = 'recordings';

function idbSupported() {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function idbPutBlob(id: string, blob: Blob) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
    tx.objectStore(DB_STORE).put(blob, id);
  });
}

async function idbGetBlob(id: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(id);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
  });
}

async function idbDelete(id: string) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
    tx.objectStore(DB_STORE).delete(id);
  });
}

async function idbClearAll() {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
    tx.objectStore(DB_STORE).clear();
  });
}

function lsKey(patientId: string) {
  return `steth:history:${patientId}`;
}
function lsSessionKey(patientId: string) {
  return `steth:sessions:${patientId}`;
}
function lsPrefsKey(patientId: string) {
  return `steth:prefs:${patientId}`;
}

function loadMeta(patientId: string): RecordingMeta[] {
  try {
    const raw = localStorage.getItem(lsKey(patientId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const list = parsed.filter(Boolean) as RecordingMeta[];
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch {
    return [];
  }
}

function saveMeta(patientId: string, list: RecordingMeta[]) {
  try {
    localStorage.setItem(lsKey(patientId), JSON.stringify(list));
  } catch {}
}

function loadSessions(patientId: string): SessionBundle[] {
  try {
    const raw = localStorage.getItem(lsSessionKey(patientId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as SessionBundle[]).filter(Boolean).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch {
    return [];
  }
}

function saveSessions(patientId: string, sessions: SessionBundle[]) {
  try {
    localStorage.setItem(lsSessionKey(patientId), JSON.stringify(sessions));
  } catch {}
}

type UploadResp = { ok?: boolean; item?: any };

async function uploadAuscultation(patientId: string, blob: Blob, meta: Record<string, any>): Promise<UploadResp> {
  const form = new FormData();
  form.append('file', blob, `steth_${Date.now()}.wav`);
  form.append('meta', new Blob([JSON.stringify(meta)], { type: 'application/json' }));

  const r = await fetch(`/api/v1/patients/${encodeURIComponent(patientId)}/auscultations`, {
    method: 'POST',
    body: form,
    cache: 'no-store',
    credentials: 'include',
  });

  if (!r.ok) throw new Error(`upload failed ${r.status}`);
  return r.json().catch(() => ({}));
}

function Badge({ status }: { status: RecordingStatus }) {
  const cls =
    status === 'uploaded'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : status === 'uploading'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : status === 'failed'
      ? 'border-rose-200 bg-rose-50 text-rose-900'
      : 'border-slate-200 bg-white text-slate-700';

  const label =
    status === 'uploaded' ? 'Uploaded' : status === 'uploading' ? 'Uploading' : status === 'failed' ? 'Failed' : 'Queued';

  return (
    <span className={cx('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold', cls)}>
      <Circle
        className={cx(
          'h-2.5 w-2.5',
          status === 'uploaded'
            ? 'fill-emerald-500 text-emerald-500'
            : status === 'uploading'
            ? 'fill-amber-500 text-amber-500'
            : status === 'failed'
            ? 'fill-rose-500 text-rose-500'
            : 'fill-slate-300 text-slate-300'
        )}
      />
      {label}
    </span>
  );
}

function QualityPill({ q }: { q?: QualityTag }) {
  const v = q || 'unknown';
  const cls =
    v === 'good'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : v === 'noise'
      ? 'border-rose-200 bg-rose-50 text-rose-900'
      : 'border-slate-200 bg-white text-slate-700';
  const label = v === 'good' ? 'Good' : v === 'noise' ? 'Noise' : 'Unmarked';
  return <span className={cx('inline-flex rounded-full border px-3 py-1 text-xs font-semibold', cls)}>{label}</span>;
}

function MiniWave({ peaks, muted }: { peaks?: number[]; muted?: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 140;
    const cssH = canvas.clientHeight || 32;
    const w = Math.floor(cssW * dpr);
    const h = Math.floor(cssH * dpr);

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    const p = peaks && peaks.length ? peaks : null;
    const mid = Math.floor(h / 2);

    ctx.strokeStyle = muted ? '#94a3b8' : '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, mid);

    if (!p) {
      ctx.lineTo(w, mid);
      ctx.stroke();
      return;
    }

    const n = p.length;
    for (let x = 0; x < w; x++) {
      const idx = Math.min(n - 1, Math.floor((x / (w - 1)) * (n - 1)));
      const amp = Math.max(0, Math.min(1, p[idx] || 0));
      const y = mid - amp * (mid - 4);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [peaks, muted]);

  return <canvas ref={ref} className="h-8 w-[140px] rounded-lg" style={{ background: '#fff' }} />;
}

function maskId(s?: string) {
  if (!s) return '—';
  if (s.length <= 6) return '••••';
  return `${s.slice(0, 2)}•••${s.slice(-2)}`;
}

export default function StethoscopeConsole() {
  const sp = useSearchParams();
  const SAMPLE_RATE = 8000;

  // Keep site state early so UI-only placement helpers can stay minimal & safe
  const [site, setSite] = useState<SiteKey>('chest-apex');

  // -------- Placement diagram preferences (pure UI) --------
  const sexFromUrlRaw = (sp.get('sex') || sp.get('gender') || '').trim().toLowerCase();
  const sexFromUrl: BodySex | null =
    sexFromUrlRaw.startsWith('f') ? 'female' : sexFromUrlRaw.startsWith('m') ? 'male' : null;

  const [bodySex, setBodySex] = useState<BodySex>(() => sexFromUrl || 'unisex');

  const inferTargetFromSite = useCallback(
    (s: SiteKey): AuscTarget => (s === 'chest-apex' || s === 'chest-base' ? 'heart' : s === 'other' ? 'mixed' : 'lungs'),
    []
  );

  const [auscTarget, setAuscTarget] = useState<AuscTarget>(() => inferTargetFromSite('chest-apex'));

  // Keep toggle aligned with current site (so guided steps also reflect correctly)
  useEffect(() => {
    const next = inferTargetFromSite(site);
    if (next !== auscTarget) setAuscTarget(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site]);

  // --- Step ribbon "Saved" acknowledgement ---
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);

  // --- Camera overlay controls (pure UI) ---
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(0.35);
  const [overlayAuto, setOverlayAuto] = useState(true);
  const [overlayView, setOverlayView] = useState<'front' | 'back'>('front');
  const [mirrorVideo, setMirrorVideo] = useState(true);

  useEffect(() => {
    if (!overlayAuto) return;
    const isBack = site === 'back-upper' || site === 'back-lower';
    setOverlayView(isBack ? 'back' : 'front');
  }, [site, overlayAuto]);

  const overlaySrc = useMemo(() => {
    const base = '/diagrams/auscultation';
    const female = bodySex === 'female';
    if (female) {
      return overlayView === 'front'
        ? `${base}/female_thorax_front.png`
        : `${base}/female_thorax_back.png`;
    }
    return overlayView === 'front'
      ? `${base}/thorax_front_731x1024.png`
      : `${base}/thorax_back_731x1024.png`;
  }, [bodySex, overlayView]);

  // Patient context (non-breaking):
  // - Prefer URL params: ?patientId=&patientName=&mrn=
  // - Fallback to demo id (until you wire real auth/session)
  const patientIdFromUrl = (sp.get('patientId') || sp.get('pid') || '').trim();
  const patientNameFromUrl = (sp.get('patientName') || sp.get('name') || '').trim();
  const mrnFromUrl = (sp.get('mrn') || sp.get('mrnId') || sp.get('patientMrn') || '').trim();

  const [patient, setPatient] = useState<PatientCtx>(() => ({
    patientId: patientIdFromUrl || 'patient-1111',
    name: patientNameFromUrl || undefined,
    mrn: mrnFromUrl || undefined,
  }));

  // Attach targets (optional)
  const [visitId, setVisitId] = useState<string>(() => (sp.get('visitId') || '').trim());
  const [roomId, setRoomId] = useState<string>(() => (sp.get('roomId') || '').trim());
  const [appointmentId, setAppointmentId] = useState<string>(() => (sp.get('appointmentId') || '').trim());

  // Discreet mode (UI privacy)
  const [discreet, setDiscreet] = useState(false);
  const [hideSensitive, setHideSensitive] = useState(false);

  // Consent state (manual toggle or inherited check)
  const [consentRecorded, setConsentRecorded] = useState(false);
  const [consentInherited, setConsentInherited] = useState<{
    ok: boolean;
    consentId?: string;
    acceptedAt?: string;
    consentVersion?: string;
  } | null>(null);

  const supportsBluetooth = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return typeof navigator !== 'undefined' && !!(navigator as any).bluetooth;
  }, []);

  const supportsIdb = useMemo(() => idbSupported(), []);

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const [packets, setPackets] = useState(0);
  const packetsRef = useRef(0);

  const [recording, setRecording] = useState(false);
  const recordingRef = useRef(false);

  const [uploadingAny, setUploadingAny] = useState(false);
  const [autoUpload, setAutoUpload] = useState(true);

  const [autoReconnect, setAutoReconnect] = useState(true);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);

  const [note, setNote] = useState('');

  const [recordStartedAt, setRecordStartedAt] = useState<number | null>(null);
  const recordStartedRef = useRef<number | null>(null);
  const [nowTick, setNowTick] = useState<number>(Date.now());

  const recorderRef = useRef<WavRecorder | null>(null);
  const stethRef = useRef<StethoscopeNUS | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const latestRef = useRef<Float32Array | null>(null);
  const rafRef = useRef<number | null>(null);
  const gainRef = useRef<number>(1);

  const [telemetry, setTelemetry] = useState<StethoscopeTelemetry>({ updatedAt: Date.now() });
  const [lastSeenAt, setLastSeenAt] = useState<number | null>(null);

  // Stream + dropout detector (expected chunk duration based)
  const streamStatsRef = useRef({
    windowStart: Date.now(),
    chunks: 0,
    gapMs: 0,

    lastChunkAt: 0,
    expectedMsEma: 0, // learned
    dropouts: 0,
    lastLen: 0,
  });
  const [pps, setPps] = useState(0);
  const [gapPct, setGapPct] = useState(0);
  const [dropoutPct, setDropoutPct] = useState(0);

  // Live quality indicators
  const liveQRef = useRef({ rms: 0, peak: 0, clipPct: 0, updatedAt: 0 });
  const [liveRms, setLiveRms] = useState(0);
  const [livePeak, setLivePeak] = useState(0);
  const [liveClipPct, setLiveClipPct] = useState(0);

  const recMetricsRef = useRef<{
    peaks: number[];
    sumSq: number;
    n: number;
    maxAbs: number;
    clipCount: number;
    dcSum: number;
    zc: number;
    lastSign: number;
  } | null>(null);

  const [mode, setMode] = useState<'quick' | 'guided'>('quick');
  const [guidedDurationSec, setGuidedDurationSec] = useState(15);
  const [guidedAutoAdvance, setGuidedAutoAdvance] = useState(true);

  const [sessions, setSessions] = useState<SessionBundle[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionSummaryNote, setSessionSummaryNote] = useState('');
  const [guidedStepIdx, setGuidedStepIdx] = useState(0);
  const [guidedCountdown, setGuidedCountdown] = useState<number | null>(null);
  const stepTimerRef = useRef<number | null>(null);
  const moveTimerRef = useRef<number | null>(null);

  const [history, setHistory] = useState<RecordingMeta[]>([]);
  const historyRef = useRef<RecordingMeta[]>([]);

  const [activePlayId, setActivePlayId] = useState<string | null>(null);
  const [activePlayUrl, setActivePlayUrl] = useState<string | null>(null);
  const activePlayUrlRef = useRef<string | null>(null);
  useEffect(() => {
    activePlayUrlRef.current = activePlayUrl;
  }, [activePlayUrl]);

  // Object URL cache + TTL
  const urlCacheRef = useRef<Map<string, string>>(new Map());
  const urlTimersRef = useRef<Map<string, number>>(new Map());
  const URL_TTL_MS = 10 * 60 * 1000;

  function rememberUrl(id: string, url: string) {
    urlCacheRef.current.set(id, url);
    const old = urlTimersRef.current.get(id);
    if (old) window.clearTimeout(old);

    const t = window.setTimeout(() => {
      const u = urlCacheRef.current.get(id);
      if (u) {
        try {
          URL.revokeObjectURL(u);
        } catch {}
      }
      urlCacheRef.current.delete(id);
      urlTimersRef.current.delete(id);

      if (activePlayId === id) {
        setActivePlayId(null);
        setActivePlayUrl(null);
      }
    }, URL_TTL_MS);

    urlTimersRef.current.set(id, t);
  }

  const processingRef = useRef(false);

  // Load patient prefs (discreet/hideSensitive/autoUpload/autoReconnect)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(lsPrefsKey(patient.patientId));
      if (!raw) return;
      const p = JSON.parse(raw);
      if (typeof p?.discreet === 'boolean') setDiscreet(p.discreet);
      if (typeof p?.hideSensitive === 'boolean') setHideSensitive(p.hideSensitive);
      if (typeof p?.autoUpload === 'boolean') setAutoUpload(p.autoUpload);
      if (typeof p?.autoReconnect === 'boolean') setAutoReconnect(p.autoReconnect);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.patientId]);

  useEffect(() => {
    try {
      localStorage.setItem(lsPrefsKey(patient.patientId), JSON.stringify({ discreet, hideSensitive, autoUpload, autoReconnect }));
    } catch {}
  }, [patient.patientId, discreet, hideSensitive, autoUpload, autoReconnect]);

  // Update patient ctx when URL changes (non-breaking)
  useEffect(() => {
    const pid = (patientIdFromUrl || '').trim();
    const nm = (patientNameFromUrl || '').trim();
    const mrn = (mrnFromUrl || '').trim();

    if (!pid && patient.patientId !== 'patient-1111') return;
    if (!pid) return;

    setPatient((prev) => ({
      patientId: pid || prev.patientId,
      name: nm || prev.name,
      mrn: mrn || prev.mrn,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientIdFromUrl, patientNameFromUrl, mrnFromUrl]);

  const counts = useMemo(() => {
    const queued = history.filter((h) => h.status === 'queued').length;
    const uploading = history.filter((h) => h.status === 'uploading').length;
    const failed = history.filter((h) => h.status === 'failed').length;
    const uploaded = history.filter((h) => h.status === 'uploaded').length;
    return { queued, uploading, failed, uploaded, total: history.length };
  }, [history]);

  const recordingElapsed = useMemo(() => {
    if (!recordStartedAt) return '0:00';
    return formatMs(nowTick - recordStartedAt);
  }, [nowTick, recordStartedAt]);

  const activeClip = useMemo(() => {
    if (!activePlayId) return null;
    return history.find((h) => h.id === activePlayId) || null;
  }, [activePlayId, history]);

  // Load history + sessions whenever patient changes
  useEffect(() => {
    try {
      setWarn(null);
      if (!supportsIdb) setWarn('IndexedDB is not available. Recordings will not persist after refresh on this browser.');

      // cleanup urls from previous patient context
      try {
        for (const t of urlTimersRef.current.values()) window.clearTimeout(t);
        urlTimersRef.current.clear();
      } catch {}
      try {
        for (const u of urlCacheRef.current.values()) URL.revokeObjectURL(u);
        urlCacheRef.current.clear();
      } catch {}

      const list = loadMeta(patient.patientId);
      setHistory(list);
      historyRef.current = list;

      const sess = loadSessions(patient.patientId);
      setSessions(sess);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.patientId]);

  useEffect(() => {
    historyRef.current = history;
    saveMeta(patient.patientId, history);
    setUploadingAny(history.some((h) => h.status === 'uploading'));
  }, [history, patient.patientId]);

  useEffect(() => {
    saveSessions(patient.patientId, sessions);
  }, [sessions, patient.patientId]);

  // Consent inheritance check (ONLY if visitId/roomId present)
  useEffect(() => {
    let cancelled = false;

    async function check() {
      const v = (visitId || '').trim();
      const r = (roomId || '').trim();
      if (!v && !r) {
        setConsentInherited(null);
        return;
      }
      try {
        const qs = new URLSearchParams();
        if (v) qs.set('visitId', v);
        if (r) qs.set('roomId', r);
        const res = await fetch(`/api/televisit/consent?${qs.toString()}`, {
          method: 'GET',
          headers: {
            'x-uid': patient.patientId, // dev-safe default; replace with real session UID when wired
            'x-role': 'patient',
          },
          cache: 'no-store',
          credentials: 'include',
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;

        if (!res.ok || !data?.ok) {
          setConsentInherited({ ok: false });
          return;
        }
        if (data?.consent?.id) {
          setConsentInherited({
            ok: true,
            consentId: String(data.consent.id),
            acceptedAt: String(data.consent.acceptedAt),
            consentVersion: String(data.consent.consentVersion || ''),
          });
          // if consent is present, we can treat consentRecorded as true by inheritance
          setConsentRecorded(true);
        } else {
          setConsentInherited({ ok: true });
        }
      } catch {
        if (!cancelled) setConsentInherited({ ok: false });
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [visitId, roomId, patient.patientId]);

  // Online auto-retry uploads + reconnect assist
  useEffect(() => {
    const onOnline = () => {
      if (autoUpload) void processQueue();
      if (!connected && autoReconnect && stethRef.current) scheduleReconnect('network_online');
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoUpload, autoReconnect, connected]);

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [recording]);

  // Stream stats tick (pps/gaps/dropouts)
  useEffect(() => {
    const id = window.setInterval(() => {
      const s = streamStatsRef.current;
      const now = Date.now();
      const elapsed = Math.max(1, now - s.windowStart);

      const ppsNow = s.chunks / (elapsed / 1000);
      const gapPctNow = Math.max(0, Math.min(100, (s.gapMs / elapsed) * 100));
      const dropoutPctNow = s.chunks > 0 ? Math.max(0, Math.min(100, (s.dropouts / s.chunks) * 100)) : 0;

      if (elapsed > 4000) {
        streamStatsRef.current = {
          ...s,
          windowStart: now,
          chunks: 0,
          gapMs: 0,
          dropouts: 0,
        };
      }

      setPps(Math.round(ppsNow));
      setGapPct(Math.round(gapPctNow));
      setDropoutPct(Math.round(dropoutPctNow));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 1024;
    const cssH = canvas.clientHeight || 240;
    const targetW = Math.floor(cssW * dpr);
    const targetH = Math.floor(cssH * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const y = Math.round((h * i) / 6);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    for (let i = 1; i < 10; i++) {
      const x = Math.round((w * i) / 10);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    ctx.restore();

    const mid = Math.floor(h / 2);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();

    const f = latestRef.current;
    ctx.strokeStyle = connected ? '#0f172a' : '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, mid);

    if (f && f.length > 0) {
      const step = Math.max(1, Math.floor(f.length / w));
      const amp = mid - 8;
      for (let x = 0; x < w; x++) {
        const i = x * step;
        const sample = (f[i] ?? 0) * gainRef.current;
        const y = mid - sample * amp;
        ctx.lineTo(x, y);
      }
    } else {
      ctx.lineTo(w, mid);
    }
    ctx.stroke();

    rafRef.current = requestAnimationFrame(draw);
  };

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  // UI chunk listener: waveform + live quality + dropout detection + recording metrics
  useEffect(() => {
    const onUiChunk = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { float32: Float32Array; ts: number; sampleRate: number };
      latestRef.current = detail.float32;
      setLastSeenAt(detail.ts);

      // Stream stats with expected chunk duration
      const st = streamStatsRef.current;
      const now = detail.ts;

      const len = detail.float32?.length || 0;
      st.lastLen = len;

      // expectedMs based on sampleRate+len (learned EMA)
      const expectedMsRaw = len > 0 ? (len / detail.sampleRate) * 1000 : 0;
      if (expectedMsRaw > 0) {
        const prev = st.expectedMsEma || expectedMsRaw;
        st.expectedMsEma = prev * 0.8 + expectedMsRaw * 0.2;
      }

      if (st.lastChunkAt > 0) {
        const delta = now - st.lastChunkAt;

        // "gap time" bucket (legacy)
        if (delta > 250) st.gapMs += delta;

        // dropout detector: compare to expected
        const exp = st.expectedMsEma || expectedMsRaw || 0;
        if (exp > 0 && delta > exp * 1.8) {
          st.dropouts += 1;
        }
      }
      st.lastChunkAt = now;
      st.chunks += 1;

      // Live quality per chunk (smoothed)
      const f = detail.float32;
      let sumSq = 0;
      let maxAbs = 0;
      let clipCount = 0;
      for (let i = 0; i < f.length; i++) {
        const x = f[i] || 0;
        sumSq += x * x;
        const ax = Math.abs(x);
        if (ax > maxAbs) maxAbs = ax;
        if (ax >= 0.98) clipCount += 1;
      }
      const rms = f.length ? Math.sqrt(sumSq / f.length) : 0;
      const clipPct = f.length ? (clipCount / f.length) * 100 : 0;

      const prev = liveQRef.current;
      const ema = 0.25;
      const next = {
        rms: prev.rms * (1 - ema) + rms * ema,
        peak: prev.peak * (1 - ema) + maxAbs * ema,
        clipPct: prev.clipPct * (1 - ema) + clipPct * ema,
        updatedAt: Date.now(),
      };
      liveQRef.current = next;

      // throttle state updates
      if (Date.now() - (prev.updatedAt || 0) > 180) {
        setLiveRms(next.rms);
        setLivePeak(next.peak);
        setLiveClipPct(next.clipPct);
      }

      // Recording metrics accumulation (for saved clip analysis)
      if (recordingRef.current && recMetricsRef.current) {
        const m = recMetricsRef.current;

        let dcSum = 0;
        let zc = 0;
        let lastSign = m.lastSign;

        for (let i = 0; i < f.length; i++) {
          const x = f[i] || 0;
          dcSum += x;

          const sign = x >= 0 ? 1 : -1;
          if (lastSign !== 0 && sign !== lastSign) zc += 1;
          lastSign = sign;
        }

        m.peaks.push(Math.max(0, Math.min(1, maxAbs)));
        if (m.peaks.length > 260) m.peaks = m.peaks.filter((_, idx) => idx % 2 === 0);

        m.sumSq += sumSq;
        m.dcSum += dcSum;
        m.n += f.length;
        m.clipCount += clipCount;
        m.zc += zc;
        m.lastSign = lastSign;
        m.maxAbs = Math.max(m.maxAbs, maxAbs);
      }
    };

    window.addEventListener('stethoscope:chunk', onUiChunk as EventListener);
    return () => window.removeEventListener('stethoscope:chunk', onUiChunk as EventListener);
  }, []);

  // Telemetry listener (decoder already emits this in your setup)
  useEffect(() => {
    const onTel = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as StethoscopeTelemetry;
      setTelemetry(detail);
    };
    window.addEventListener('stethoscope:telemetry', onTel as EventListener);
    return () => window.removeEventListener('stethoscope:telemetry', onTel as EventListener);
  }, []);

  // Cleanup on unmount (NO stale closure)
  useEffect(() => {
    return () => {
      try {
        stethRef.current?.stop();
      } catch {}

      const ap = activePlayUrlRef.current;
      if (ap) {
        try {
          URL.revokeObjectURL(ap);
        } catch {}
      }

      try {
        for (const t of urlTimersRef.current.values()) window.clearTimeout(t);
        urlTimersRef.current.clear();
      } catch {}
      try {
        for (const u of urlCacheRef.current.values()) URL.revokeObjectURL(u);
        urlCacheRef.current.clear();
      } catch {}

      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (stepTimerRef.current) window.clearTimeout(stepTimerRef.current);
      if (moveTimerRef.current) window.clearTimeout(moveTimerRef.current);
    };
  }, []);

  const upsertHistory = (updater: (prev: RecordingMeta[]) => RecordingMeta[]) => {
    setHistory((prev) => updater(prev).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
  };

  const setStatus = (id: string, patch: Partial<RecordingMeta>) => {
    upsertHistory((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  };

  function cancelGuidedTimers() {
    if (stepTimerRef.current) window.clearTimeout(stepTimerRef.current);
    stepTimerRef.current = null;
    if (moveTimerRef.current) window.clearTimeout(moveTimerRef.current);
    moveTimerRef.current = null;
    setGuidedCountdown(null);
  }

  function scheduleReconnect(reason: string) {
    if (!autoReconnect) return;
    if (!stethRef.current) return;
    if (connecting) return;
    if (connected) return;

    if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);

    const attempt = Math.min(3, reconnectAttemptsRef.current);
    const delays = [1200, 3000, 7000, 12000];
    const delay = delays[attempt] ?? 12000;

    reconnectTimerRef.current = window.setTimeout(() => {
      void reconnect(reason);
    }, delay);
  }

  const handleDisconnected = async (reason: string) => {
    setConnected(false);

    if (recordingRef.current) {
      try {
        await stopAndSave({ interrupted: true, noteOverride: 'Interrupted: device disconnected' });
      } catch {}
    }

    if (autoReconnect) {
      scheduleReconnect(reason);
      setWarn('Device disconnected. Auto-reconnect will attempt shortly (if allowed).');
    } else {
      setWarn('Device disconnected.');
    }
  };

  const disconnect = async () => {
    setError(null);
    try {
      cancelGuidedTimers();
      setRecording(false);
      recordingRef.current = false;
      setRecordStartedAt(null);
      recordStartedRef.current = null;
      await stethRef.current?.stop();
    } catch {
      // ok
    } finally {
      setConnected(false);
    }
  };

  const connect = async () => {
    setError(null);
    setWarn(null);

    if (!supportsBluetooth) {
      setError('Web Bluetooth is not supported on this browser. Try Chrome/Edge on desktop or Android.');
      return;
    }

    setConnecting(true);
    try {
      recorderRef.current = new WavRecorder(SAMPLE_RATE);
      recordingRef.current = false;

      const st = new StethoscopeNUS({
        sampleRate: SAMPLE_RATE,
        playToSpeaker: false,
        onChunk: (c: PcmChunk) => {
          packetsRef.current += 1;
          if (packetsRef.current % 8 === 0) setPackets(packetsRef.current);
          if (recordingRef.current) recorderRef.current?.push(c);
        },
        onDisconnected: ({ reason }) => {
          void handleDisconnected(reason);
        },
        onTelemetry: (t) => {
          setTelemetry(t);
        },
      } as any);

      stethRef.current = st;
      await st.requestAndConnect();

      reconnectAttemptsRef.current = 0;
      packetsRef.current = 0;
      setPackets(0);
      setConnected(true);

      if (autoUpload && typeof navigator !== 'undefined' && navigator.onLine) void processQueue();
    } catch (e) {
      setConnected(false);
      const c = classifyBtError(e);
      setError(`${c.title}: ${c.detail}`);
    } finally {
      setConnecting(false);
    }
  };

  const reconnect = async (reason?: string) => {
    setError(null);
    setWarn(null);

    if (!supportsBluetooth) {
      setError('Web Bluetooth is not supported on this browser.');
      return;
    }
    if (!stethRef.current) {
      return connect();
    }

    setConnecting(true);
    try {
      await (stethRef.current as any).reconnect?.();
      reconnectAttemptsRef.current = 0;

      packetsRef.current = 0;
      setPackets(0);
      setConnected(true);

      if (autoUpload && typeof navigator !== 'undefined' && navigator.onLine) void processQueue();
    } catch (e) {
      reconnectAttemptsRef.current += 1;
      const c = classifyBtError(e);
      setError(`Reconnect failed (${reason || 'drop'}): ${c.title}: ${c.detail}`);

      if (autoReconnect && reconnectAttemptsRef.current <= 3) {
        scheduleReconnect('reconnect_failed');
      } else {
        setWarn('Auto-reconnect stopped. Use Reconnect to try again.');
      }
    } finally {
      setConnecting(false);
    }
  };

  // Consent
  const effectiveConsent = useMemo(() => {
    if (consentInherited?.ok && consentInherited?.consentId) {
      return {
        recorded: true,
        source: 'televisit' as const,
        consentId: consentInherited.consentId,
        acceptedAt: consentInherited.acceptedAt,
        consentVersion: consentInherited.consentVersion,
      };
    }
    return {
      recorded: !!consentRecorded,
      source: 'manual' as const,
    };
  }, [consentInherited, consentRecorded]);

  const startRecording = (opts?: { siteOverride?: SiteKey }) => {
    setError(null);
    if (!connected) return;

    if (!effectiveConsent.recorded) {
      setWarn('Consent is not recorded yet. Toggle “Consent recorded” (or attach to a Televisit with consent).');
      return;
    }

    recMetricsRef.current = {
      peaks: [],
      sumSq: 0,
      n: 0,
      maxAbs: 0,
      clipCount: 0,
      dcSum: 0,
      zc: 0,
      lastSign: 0,
    };

    if (opts?.siteOverride) setSite(opts.siteOverride);

    recorderRef.current = new WavRecorder(SAMPLE_RATE);
    recordingRef.current = true;

    const t0 = Date.now();
    recordStartedRef.current = t0;
    setRecordStartedAt(t0);
    setRecording(true);
  };

  const stopAndSave = async (opts?: {
    interrupted?: boolean;
    siteOverride?: SiteKey;
    noteOverride?: string;
    sessionId?: string;
    stepIndex?: number;
  }) => {
    setError(null);

    recordingRef.current = false;
    setRecording(false);

    const startedAt = recordStartedRef.current ?? recordStartedAt ?? Date.now();
    recordStartedRef.current = null;
    setRecordStartedAt(null);

    const stoppedAt = Date.now();
    const durationMs = Math.max(0, stoppedAt - startedAt);

    try {
      const blob = recorderRef.current?.flush();
      if (!blob) return;

      if (opts?.interrupted && durationMs < 1000) return;

      const id = newId();
      const createdAt = new Date().toISOString();

      const m = recMetricsRef.current;
      const analysis: QuickAnalysis | undefined =
        m && m.n > 0
          ? {
              rms: Math.sqrt(m.sumSq / m.n),
              peak: m.maxAbs,
              clipPct: (m.clipCount / m.n) * 100,
              dc: m.dcSum / m.n,
              zcrPerSec: durationMs > 0 ? m.zc / (durationMs / 1000) : 0,
            }
          : undefined;

      const peaks = m?.peaks?.length ? m.peaks.slice(0, 240) : undefined;

      const finalSite = (opts?.siteOverride ?? site) as SiteKey;
      const baseNote = (opts?.noteOverride ?? note)?.trim();

      const combinedNote = opts?.interrupted ? [baseNote, 'Interrupted capture'].filter(Boolean).join(' · ') : baseNote || undefined;

      const meta: RecordingMeta = {
        id,
        patientId: patient.patientId,
        createdAt,
        durationMs,
        sizeBytes: blob.size ?? 0,
        sampleRate: SAMPLE_RATE,
        site: finalSite,
        note: combinedNote,

        quality: 'unknown',
        peaks,
        analysis,

        sessionId: opts?.sessionId,
        stepIndex: opts?.stepIndex,

        visitId: visitId || undefined,
        roomId: roomId || undefined,
        appointmentId: appointmentId || undefined,

        consent: effectiveConsent.recorded
          ? {
              recorded: true,
              source: effectiveConsent.source,
              consentId: (effectiveConsent as any).consentId,
              acceptedAt: (effectiveConsent as any).acceptedAt,
              consentVersion: (effectiveConsent as any).consentVersion,
            }
          : { recorded: false, source: 'manual' },

        audit: {
          recordedByUid: patient.patientId,
          recordedByRole: 'patient',
          deviceName: telemetry.deviceName,
          manufacturer: telemetry.manufacturer,
          model: telemetry.model,
          firmware: telemetry.firmware,
          deviceId: telemetry.deviceId,
        },

        status: 'queued',
        attempts: 0,
      };

      if (supportsIdb) {
        await idbPutBlob(id, blob);
      } else {
        setWarn('IndexedDB is not available. Recordings will not persist after refresh on this browser.');
        const url = URL.createObjectURL(blob);
        rememberUrl(id, url);
      }

      // ✅ C) Mark “saved” inside stopAndSave()
      setLastSavedAt(Date.now());
      setLastSavedId(id);

      upsertHistory((prev) => [meta, ...prev]);

      if (opts?.sessionId && typeof opts.stepIndex === 'number') {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== opts.sessionId) return s;
            const steps = s.steps.map((st, idx) => (idx === opts.stepIndex ? { ...st, clipId: id } : st));
            const done = steps.every((x) => !!x.clipId);
            return { ...s, steps, status: done ? 'complete' : 'in_progress' };
          })
        );
      }

      if (autoUpload) void processQueue({ preferredId: id });

      if (mode === 'guided' && activeSessionId && typeof opts?.stepIndex === 'number') {
        const nextIdx = opts.stepIndex + 1;
        if (nextIdx < GUIDED_STEPS.length) {
          setGuidedStepIdx(nextIdx);

          if (guidedAutoAdvance && connected) {
            cancelGuidedTimers();
            setGuidedCountdown(2);
            moveTimerRef.current = window.setInterval(() => {
              setGuidedCountdown((v) => {
                const nv = (v ?? 0) - 1;
                return nv <= 0 ? 0 : nv;
              });
            }, 1000);

            stepTimerRef.current = window.setTimeout(() => {
              if (moveTimerRef.current) window.clearInterval(moveTimerRef.current);
              moveTimerRef.current = null;
              setGuidedCountdown(null);

              const nextSite = GUIDED_STEPS[nextIdx]?.site;
              if (nextSite) {
                setSite(nextSite);
                startRecording({ siteOverride: nextSite });
                armAutoStopForGuided(nextIdx);
              }
            }, 2000);
          }
        } else {
          setWarn('Guided session complete. You can add a summary note and upload/share as needed.');
        }
      }
    } catch (e) {
      setError(shortErr(e));
    } finally {
      recMetricsRef.current = null;
    }
  };

  function armAutoStopForGuided(stepIndex: number) {
    cancelGuidedTimers();
    let remaining = guidedDurationSec;
    setGuidedCountdown(remaining);

    moveTimerRef.current = window.setInterval(() => {
      remaining -= 1;
      setGuidedCountdown(remaining);
      if (remaining <= 0 && moveTimerRef.current) {
        window.clearInterval(moveTimerRef.current);
        moveTimerRef.current = null;
      }
    }, 1000);

    stepTimerRef.current = window.setTimeout(() => {
      void stopAndSave({
        sessionId: activeSessionId || undefined,
        stepIndex,
        siteOverride: GUIDED_STEPS[stepIndex]?.site,
      });
    }, guidedDurationSec * 1000);
  }

  async function ensureUrlFor(id: string): Promise<string | null> {
    const cached = urlCacheRef.current.get(id);
    if (cached) return cached;

    try {
      const blob = supportsIdb ? await idbGetBlob(id) : null;
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      rememberUrl(id, url);
      return url;
    } catch {
      return null;
    }
  }

  const openPlayer = async (id: string) => {
    try {
      if (activePlayUrl) {
        try {
          URL.revokeObjectURL(activePlayUrl);
        } catch {}
        setActivePlayUrl(null);
      }
      setActivePlayId(id);
      const url = await ensureUrlFor(id);
      if (!url) {
        setError('Audio file not available locally. It may have been cleared or storage is unavailable.');
        setActivePlayId(null);
        return;
      }
      setActivePlayUrl(url);
    } catch (e) {
      setError(shortErr(e));
    }
  };

  const closePlayer = () => {
    setActivePlayId(null);
    if (activePlayUrl) {
      try {
        URL.revokeObjectURL(activePlayUrl);
      } catch {}
    }
    setActivePlayUrl(null);
  };

  const downloadClip = async (h: RecordingMeta) => {
    const url = await ensureUrlFor(h.id);
    if (!url) {
      setError('Audio file not available locally. It may have been cleared or storage is unavailable.');
      return;
    }
    const a = document.createElement('a');
    a.href = url;

    const safePatient = discreet ? 'patient' : h.patientId;
    a.download = `steth_${safePatient}_${h.site}_${new Date(h.createdAt).toISOString().slice(0, 19).replace(/[:T]/g, '-')}.wav`;
    a.click();
  };

  const deleteClip = async (h: RecordingMeta) => {
    if (activePlayId === h.id) closePlayer();

    const u = urlCacheRef.current.get(h.id);
    if (u) {
      try {
        URL.revokeObjectURL(u);
      } catch {}
      urlCacheRef.current.delete(h.id);
    }
    const t = urlTimersRef.current.get(h.id);
    if (t) {
      try {
        window.clearTimeout(t);
      } catch {}
      urlTimersRef.current.delete(h.id);
    }

    if (supportsIdb) {
      try {
        await idbDelete(h.id);
      } catch {}
    }

    upsertHistory((prev) => prev.filter((x) => x.id !== h.id));

    setSessions((prev) =>
      prev.map((s) => ({
        ...s,
        steps: s.steps.map((st) => (st.clipId === h.id ? { ...st, clipId: undefined } : st)),
        status: s.steps.every((st) => (st.clipId === h.id ? false : !!st.clipId)) ? s.status : 'in_progress',
      }))
    );

    // ✅ C) deleteClip safety
    if (lastSavedId === h.id) {
      setLastSavedId(null);
      setLastSavedAt(null);
    }
  };

  const setQuality = (id: string, q: QualityTag) => {
    setStatus(id, { quality: q });
  };

  async function processQueue(opts?: { preferredId?: string; onlyId?: string }) {
    if (!autoUpload) return;
    if (typeof navigator === 'undefined' || !navigator.onLine) return;
    if (processingRef.current) return;

    processingRef.current = true;
    try {
      let list = historyRef.current ?? [];
      const order = (a: RecordingMeta, b: RecordingMeta) => {
        const pa = opts?.preferredId && a.id === opts.preferredId ? 1 : 0;
        const pb = opts?.preferredId && b.id === opts.preferredId ? 1 : 0;
        if (pa !== pb) return pb - pa;
        return (a.createdAt || '').localeCompare(b.createdAt || '');
      };

      const candidates = [...list]
        .filter((h) => (opts?.onlyId ? h.id === opts.onlyId : true))
        .filter((h) => h.status === 'queued' || h.status === 'failed')
        .sort(order);

      for (const h of candidates) {
        setStatus(h.id, { status: 'uploading', lastError: undefined });

        try {
          const blob = supportsIdb ? await idbGetBlob(h.id) : null;
          const cachedUrl = urlCacheRef.current.get(h.id);
          let blob2 = blob;

          if (!blob2 && cachedUrl) {
            try {
              const res = await fetch(cachedUrl, { cache: 'no-store' });
              blob2 = await res.blob();
            } catch {
              blob2 = null;
            }
          }

          if (!blob2) throw new Error('Local audio blob missing (cleared or storage unavailable).');

          const resp = await uploadAuscultation(h.patientId, blob2, {
            site: h.site,
            note: hideSensitive ? undefined : h.note,
            noteRedacted: hideSensitive ? true : undefined,
            t: h.createdAt,
            mode: h.sessionId ? 'guided-session' : 'quick-clip',
            durationMs: h.durationMs,
            sampleRate: h.sampleRate,
            quality: h.quality || 'unknown',
            peaks: h.peaks,
            analysis: h.analysis,
            sessionId: h.sessionId,
            stepIndex: h.stepIndex,
            attach: {
              visitId: h.visitId,
              roomId: h.roomId,
              appointmentId: h.appointmentId,
            },
            consent: h.consent,
            audit: h.audit,
            device: {
              deviceName: telemetry.deviceName,
              manufacturer: telemetry.manufacturer,
              model: telemetry.model,
              firmware: telemetry.firmware,
              batteryPct: telemetry.batteryPct,
              deviceId: telemetry.deviceId,
            },
          });

          const serverId = resp?.item?.id ? String(resp.item.id) : (resp as any)?.id ? String((resp as any).id) : undefined;
          const serverUrl = resp?.item?.fileUrl ? String(resp.item.fileUrl) : undefined;

          setStatus(h.id, {
            status: 'uploaded',
            uploadedAt: new Date().toISOString(),
            serverRef: serverId,
            serverUrl,
            attempts: h.attempts ?? 0,
            lastError: undefined,
          });
        } catch (e) {
          const prevAttempts = h.attempts ?? 0;
          setStatus(h.id, {
            status: 'failed',
            attempts: prevAttempts + 1,
            lastError: shortErr(e),
          });
        } finally {
          list = historyRef.current ?? list;
        }
      }
    } finally {
      processingRef.current = false;
    }
  }

  const retryOne = async (id: string) => {
    setError(null);
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('You are offline. Connect to the internet to upload.');
      return;
    }
    await processQueue({ onlyId: id, preferredId: id });
  };

  const retryFailed = async () => {
    setError(null);
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('You are offline. Connect to the internet to upload.');
      return;
    }
    await processQueue();
  };

  const primaryAction = useCallback(async () => {
    if (!connected) return connect();

    if (mode === 'guided') {
      if (!recording) {
        startRecording({ siteOverride: GUIDED_STEPS[guidedStepIdx]?.site });
        armAutoStopForGuided(guidedStepIdx);
        return;
      }
      cancelGuidedTimers();
      return stopAndSave({
        sessionId: activeSessionId || undefined,
        stepIndex: guidedStepIdx,
        siteOverride: GUIDED_STEPS[guidedStepIdx]?.site,
      });
    }

    if (!recording) return startRecording();
    return stopAndSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, mode, recording, guidedStepIdx, activeSessionId, site, note, effectiveConsent.recorded]);

  const primaryActionRef = useRef(primaryAction);
  useEffect(() => {
    primaryActionRef.current = primaryAction;
  }, [primaryAction]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase() || '';
      const typing = tag === 'input' || tag === 'textarea' || (target as any)?.isContentEditable;
      if (typing) return;

      if (e.code === 'Space') {
        e.preventDefault();
        void primaryActionRef.current();
      } else if (e.code === 'Escape') {
        if (recordingRef.current) {
          e.preventDefault();
          void primaryActionRef.current();
        } else if (activePlayId) {
          e.preventDefault();
          closePlayer();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activePlayId]);

  const startGuidedSession = () => {
    setError(null);
    setWarn(null);

    const id = newId();
    const s: SessionBundle = {
      id,
      patientId: patient.patientId,
      createdAt: new Date().toISOString(),
      durationSec: guidedDurationSec,
      steps: GUIDED_STEPS.map((x) => ({ site: x.site })),
      summaryNote: sessionSummaryNote?.trim() || undefined,
      status: 'in_progress',
    };

    setSessions((prev) => [s, ...prev]);
    setActiveSessionId(id);
    setGuidedStepIdx(0);

    const firstSite = GUIDED_STEPS[0]?.site || 'chest-apex';
    setSite(firstSite);
    setMode('guided');
    setWarn('Guided session started. Press Start Recording to begin Step 1 (or enable auto-advance).');
  };

  const endGuidedSession = () => {
    cancelGuidedTimers();
    setActiveSessionId(null);
    setGuidedStepIdx(0);
    setMode('quick');
    setWarn('Guided session ended.');
  };

  const updateSessionSummary = (sessionId: string, note2: string) => {
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, summaryNote: note2?.trim() || undefined } : s)));
  };

  const clearLocalData = async () => {
    const ok = window.confirm('This will delete ALL local stethoscope recordings and sessions for this patient on this browser. Continue?');
    if (!ok) return;

    try {
      closePlayer();

      for (const t of urlTimersRef.current.values()) window.clearTimeout(t);
      urlTimersRef.current.clear();

      for (const u of urlCacheRef.current.values()) URL.revokeObjectURL(u);
      urlCacheRef.current.clear();

      if (supportsIdb) {
        await idbClearAll();
      }

      try {
        localStorage.removeItem(lsKey(patient.patientId));
        localStorage.removeItem(lsSessionKey(patient.patientId));
      } catch {}

      setHistory([]);
      setSessions([]);
      setWarn('Local data cleared.');
    } catch (e) {
      setError(shortErr(e));
    }
  };

  const copyShare = async (h: RecordingMeta) => {
    try {
      const url =
        h.serverUrl
          ? `${window.location.origin}${h.serverUrl}`
          : h.serverRef
          ? `${window.location.origin}/myCare/auscultations/${encodeURIComponent(h.serverRef)}`
          : '';

      if (!url) {
        setWarn('No server link available yet. Upload the recording first.');
        return;
      }
      await navigator.clipboard.writeText(url);
      setWarn('Link copied.');
      window.setTimeout(() => setWarn(null), 1500);
    } catch {
      setWarn('Could not copy link (clipboard blocked).');
    }
  };

  const qualityGuidance = useMemo(() => {
    if (!connected) return { level: 'neutral' as const, text: 'Not connected' };
    if (!effectiveConsent.recorded) return { level: 'warn' as const, text: 'Consent not recorded' };
    if (liveClipPct >= 1 || livePeak >= 0.98) return { level: 'bad' as const, text: 'Too loud / clipping' };
    if (liveRms <= 0.02) return { level: 'warn' as const, text: 'Too quiet' };
    return { level: 'good' as const, text: 'Signal OK' };
  }, [connected, effectiveConsent.recorded, liveClipPct, livePeak, liveRms]);

  const guidancePill = (
    <span
      className={cx(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold',
        qualityGuidance.level === 'good'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : qualityGuidance.level === 'bad'
          ? 'border-rose-200 bg-rose-50 text-rose-800'
          : qualityGuidance.level === 'warn'
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-slate-200 bg-white text-slate-700'
      )}
      title="Non-diagnostic signal guidance"
    >
      {qualityGuidance.level === 'good' ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : qualityGuidance.level === 'bad' ? (
        <Ban className="h-3.5 w-3.5" />
      ) : (
        <Info className="h-3.5 w-3.5" />
      )}
      {qualityGuidance.text}
    </span>
  );

  const statusPills = (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={cx(
          'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
          connected ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-700'
        )}
      >
        <Circle className={cx('h-2.5 w-2.5', connected ? 'fill-emerald-500 text-emerald-500' : 'fill-slate-300 text-slate-300')} />
        {connected ? 'Connected' : 'Disconnected'}
      </span>

      <span
        className={cx(
          'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
          recording ? 'border-indigo-200 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-700'
        )}
      >
        <Activity className="h-3.5 w-3.5" />
        {recording ? `Recording · ${recordingElapsed}` : 'Idle'}
      </span>

      {guidancePill}

      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
        Packets: <span className="tabular-nums">{packets}</span>
      </span>

      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
        Stream: <span className="tabular-nums">{pps}</span> pps · gaps <span className="tabular-nums">{gapPct}%</span> · dropouts{' '}
        <span className="tabular-nums">{dropoutPct}%</span>
      </span>

      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
        <UploadCloud className={cx('h-3.5 w-3.5', uploadingAny ? 'text-amber-600' : 'text-slate-500')} />
        {counts.queued} queued · {counts.failed} failed · {counts.uploaded} uploaded
      </span>
    </div>
  );

  const deviceTelemetryCard = (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-900">Device telemetry</div>
        <button
          type="button"
          onClick={() => void (stethRef.current as any)?.refreshTelemetry?.()}
          className={cx(
            'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold',
            connected ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50' : 'border-slate-200 bg-white text-slate-400'
          )}
          disabled={!connected}
          title="Refresh"
          aria-label="Refresh device telemetry"
        >
          <RotateCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <div className="mt-3 grid gap-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Battery</span>
          <span className="font-semibold text-slate-900 tabular-nums">
            {Number.isFinite(telemetry.batteryPct) ? `${telemetry.batteryPct}%` : '—'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-500">Firmware</span>
          <span className="font-semibold text-slate-900">{telemetry.firmware || '—'}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-500">Model</span>
          <span className="font-semibold text-slate-900">{telemetry.model || '—'}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-500">Manufacturer</span>
          <span className="font-semibold text-slate-900">{telemetry.manufacturer || '—'}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-500">Last seen</span>
          <span className="font-semibold text-slate-900">{lastSeenAt ? new Date(lastSeenAt).toLocaleTimeString() : '—'}</span>
        </div>

        <div className="text-xs text-slate-500">Dropouts are estimated from expected chunk timing. RSSI is not reliably exposed in Web Bluetooth.</div>
      </div>
    </div>
  );

  const displayPatient = useMemo(() => {
    if (discreet) {
      return {
        name: 'Hidden',
        mrn: 'Hidden',
        patientId: maskId(patient.patientId),
      };
    }
    return {
      name: patient.name || '—',
      mrn: patient.mrn || '—',
      patientId: patient.patientId,
    };
  }, [discreet, patient]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 space-y-6">
        {/* Header */}
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-slate-500" />
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Digital Stethoscope</h1>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-700">
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
                  Recording for: <span className="font-semibold text-slate-900">{displayPatient.name}</span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
                  MRN/ID: <span className="font-semibold text-slate-900">{displayPatient.mrn}</span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
                  Patient: <span className="font-mono text-xs">{displayPatient.patientId}</span>
                </span>
              </div>

              <p className="mt-2 text-sm text-slate-600 max-w-2xl">
                Connect via Bluetooth, view live waveform, save audio clips, and bundle guided capture sessions. Signal guidance is non-diagnostic.
              </p>

              <div className="mt-3">{statusPills}</div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={discreet}
                    onChange={(e) => setDiscreet(e.target.checked)}
                    className="h-4 w-4"
                    aria-label="Toggle discreet mode"
                  />
                  <EyeOff className="h-4 w-4 text-slate-500" />
                  Discreet mode
                </label>

                <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={hideSensitive}
                    onChange={(e) => setHideSensitive(e.target.checked)}
                    className="h-4 w-4"
                    aria-label="Hide sensitive info"
                  />
                  Hide sensitive (notes/IDs)
                </label>

                <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={consentRecorded}
                    onChange={(e) => setConsentRecorded(e.target.checked)}
                    className="h-4 w-4"
                    aria-label="Consent recorded"
                  />
                  <ShieldCheck className="h-4 w-4 text-slate-500" />
                  Consent recorded
                </label>

                {visitId || roomId ? (
                  <span
                    className={cx(
                      'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm',
                      consentInherited?.ok && consentInherited?.consentId
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : consentInherited?.ok
                        ? 'border-amber-200 bg-amber-50 text-amber-900'
                        : 'border-slate-200 bg-white text-slate-700'
                    )}
                    title="Televisit consent inheritance"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {consentInherited?.ok && consentInherited?.consentId
                      ? `Televisit consent on file (${(consentInherited.consentVersion || '').toString() || 'v?'})`
                      : consentInherited?.ok
                      ? 'Televisit consent not found'
                      : 'Televisit consent status unknown'}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void reconnect('manual')}
                disabled={connected || connecting || !stethRef.current}
                className={cx(
                  'inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium',
                  !connected && stethRef.current
                    ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    : 'border-slate-200 bg-white text-slate-400'
                )}
                title="Reconnect using last paired device (in-session)"
                aria-label="Reconnect"
              >
                <RotateCw className="h-4 w-4" />
                Reconnect
              </button>

              <button
                type="button"
                onClick={disconnect}
                disabled={!connected || connecting}
                className={cx(
                  'inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium',
                  connected ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50' : 'border-slate-200 bg-white text-slate-400'
                )}
                aria-label="Disconnect"
              >
                <RefreshCw className="h-4 w-4" />
                Disconnect
              </button>

              <button
                type="button"
                onClick={primaryAction}
                disabled={connecting}
                className={cx(
                  'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10',
                  !connected
                    ? 'bg-slate-900 text-white hover:bg-slate-800'
                    : recording
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700',
                  connecting && 'opacity-50'
                )}
                aria-label={!connected ? 'Connect' : recording ? 'Stop and save recording' : 'Start recording'}
              >
                {connecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : !connected ? (
                  <Bluetooth className="h-4 w-4" />
                ) : recording ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
                {!connected ? 'Connect' : recording ? 'Stop & Save' : 'Start Recording'}
              </button>
            </div>
          </div>

          {!supportsBluetooth ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <div>
                  <div className="font-semibold">Web Bluetooth not available</div>
                  <div className="mt-1 text-amber-800">Use Chrome/Edge on desktop or Android.</div>
                </div>
              </div>
            </div>
          ) : null}

          {warn ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4" />
                <div>
                  <div className="font-semibold">Note</div>
                  <div className="mt-1 text-amber-800">{warn}</div>
                </div>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <div>
                  <div className="font-semibold">Issue</div>
                  <div className="mt-1 text-rose-800">{error}</div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 text-slate-400" />
              <div className="w-full">
                <div className="text-sm font-semibold text-slate-900">Capture workflow</div>
                <ul className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                  <li className="rounded-xl border border-slate-200 bg-white px-3 py-2">Quick clip: 10–20 seconds per site.</li>
                  <li className="rounded-xl border border-slate-200 bg-white px-3 py-2">Guided session: {guidedDurationSec}s per step.</li>
                  <li className="rounded-xl border border-slate-200 bg-white px-3 py-2">Space toggles Start/Stop, Esc stops.</li>
                  <li className="rounded-xl border border-slate-200 bg-white px-3 py-2">This tool supports review; it does not diagnose.</li>
                </ul>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    <input type="checkbox" checked={autoUpload} onChange={(e) => setAutoUpload(e.target.checked)} className="h-4 w-4" />
                    Auto-upload
                  </label>

                  <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={autoReconnect}
                      onChange={(e) => setAutoReconnect(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Auto-reconnect
                  </label>

                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1 text-sm">
                    <button
                      type="button"
                      onClick={() => setMode('quick')}
                      className={cx('rounded-full px-3 py-1 font-semibold', mode === 'quick' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50')}
                      aria-label="Quick mode"
                    >
                      Quick
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('guided')}
                      className={cx('rounded-full px-3 py-1 font-semibold', mode === 'guided' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50')}
                      aria-label="Guided mode"
                    >
                      Guided
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => void processQueue()}
                    disabled={!autoUpload || counts.queued + counts.failed === 0}
                    className={cx(
                      'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold',
                      counts.queued + counts.failed > 0 ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-200 text-slate-500'
                    )}
                    aria-label="Upload queued and retry failed"
                  >
                    <UploadCloud className="h-4 w-4" />
                    Upload queued / retry failed
                  </button>

                  <button
                    type="button"
                    onClick={clearLocalData}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                    aria-label="Clear local data"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear local data
                  </button>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <label>
                    <div className="text-xs font-semibold text-slate-600">Attach visitId (optional)</div>
                    <input
                      value={visitId}
                      onChange={(e) => setVisitId(e.target.value)}
                      placeholder="visit_..."
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                  </label>
                  <label>
                    <div className="text-xs font-semibold text-slate-600">Attach roomId (optional)</div>
                    <input
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      placeholder="room_..."
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                  </label>
                  <label>
                    <div className="text-xs font-semibold text-slate-600">Attach appointmentId (optional)</div>
                    <input
                      value={appointmentId}
                      onChange={(e) => setAppointmentId(e.target.value)}
                      placeholder="appt_..."
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {mode === 'guided' ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Guided session</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Step {guidedStepIdx + 1} / {GUIDED_STEPS.length}: <span className="font-semibold">{GUIDED_STEPS[guidedStepIdx]?.label}</span>
                    {guidedCountdown !== null ? <span className="ml-2 text-slate-500">(in {guidedCountdown}s)</span> : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={guidedAutoAdvance}
                      onChange={(e) => setGuidedAutoAdvance(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Auto-advance
                  </label>

                  <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    Duration
                    <input
                      type="number"
                      min={10}
                      max={30}
                      value={guidedDurationSec}
                      onChange={(e) => setGuidedDurationSec(Math.max(10, Math.min(30, parseInt(e.target.value || '15', 10))))}
                      className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                      aria-label="Guided step duration seconds"
                    />
                    s
                  </label>

                  {!activeSessionId ? (
                    <button
                      type="button"
                      onClick={startGuidedSession}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      Start session
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={endGuidedSession}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      End session
                    </button>
                  )}
                </div>
              </div>

              {!activeSessionId ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="sm:col-span-2">
                    <div className="text-xs font-semibold text-slate-600">Session summary note (optional)</div>
                    <input
                      value={sessionSummaryNote}
                      onChange={(e) => setSessionSummaryNote(e.target.value)}
                      placeholder="Optional session summary for clinician review"
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                  </label>
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-700">
                  Active session ID: <span className="font-mono text-xs">{activeSessionId}</span>
                </div>
              )}
            </div>
          ) : null}
        </header>

        {/* Main grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Waveform + config */}
          <section className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Live Waveform</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Sample rate: <span className="font-semibold">{SAMPLE_RATE} Hz</span> · Visual gain scales display only.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
                  RMS <span className="font-semibold tabular-nums">{liveRms.toFixed(3)}</span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
                  Peak <span className="font-semibold tabular-nums">{livePeak.toFixed(3)}</span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
                  Clip <span className="font-semibold tabular-nums">{liveClipPct.toFixed(2)}%</span>
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <canvas ref={canvasRef} style={{ width: '100%', height: 240, display: 'block', borderRadius: 16, background: '#fff' }} />
            </div>

            {/* Placement + step ribbon + camera (UI only) */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {/* Step ribbon */}
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-sm font-semibold text-slate-900">Checklist</div>

                <div className="mt-2 grid gap-2 sm:grid-cols-5">
                  <div
                    className={cx(
                      'rounded-xl border px-3 py-2 text-xs',
                      connected ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700'
                    )}
                  >
                    <div className="font-semibold">1) Connect</div>
                    <div className="mt-0.5">{connected ? 'Connected' : 'Not connected'}</div>
                  </div>

                  <div
                    className={cx(
                      'rounded-xl border px-3 py-2 text-xs',
                      effectiveConsent.recorded ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'
                    )}
                  >
                    <div className="font-semibold">2) Consent</div>
                    <div className="mt-0.5">{effectiveConsent.recorded ? 'Recorded' : 'Required'}</div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                    <div className="font-semibold">3) Target</div>
                    <div className="mt-0.5">{auscTarget === 'heart' ? 'Heart sounds' : auscTarget === 'lungs' ? 'Lung sounds' : 'Mixed'}</div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                    <div className="font-semibold">4) Place</div>
                    <div className="mt-0.5">
                      {mode === 'guided'
                        ? `Guided: ${GUIDED_STEPS[guidedStepIdx]?.label || '—'}`
                        : `${SITES.find((s) => s.key === site)?.label ?? site}`}
                    </div>
                  </div>

                  <div
                    className={cx(
                      'rounded-xl border px-3 py-2 text-xs',
                      recording
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-900'
                        : lastSavedAt
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-slate-200 bg-white text-slate-700'
                    )}
                  >
                    <div className="font-semibold">5) Capture</div>
                    <div className="mt-0.5">
                      {recording ? `Recording (${recordingElapsed})` : lastSavedAt ? `Saved at ${new Date(lastSavedAt).toLocaleTimeString()}` : 'Ready'}
                    </div>
                  </div>
                </div>

                {mode === 'guided' && guidedCountdown !== null ? (
                  <div className="mt-2 text-xs text-slate-600">
                    Next move in <span className="font-semibold tabular-nums">{guidedCountdown}s</span> (guided auto-advance)
                  </div>
                ) : null}
              </div>

              {/* Heart/Lungs toggle */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Auscultation mode</div>
                  <div className="mt-1 text-xs text-slate-600">Pick Heart vs Lungs, then use diagram or camera overlay.</div>
                </div>

                <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setAuscTarget('heart');
                      if (mode !== 'guided' && site !== 'chest-apex' && site !== 'chest-base') setSite('chest-apex');
                    }}
                    className={cx('rounded-full px-3 py-1 font-semibold', auscTarget === 'heart' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50')}
                  >
                    Heart sounds
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuscTarget('lungs');
                      if (mode !== 'guided' && (site === 'chest-apex' || site === 'chest-base')) setSite('chest-left');
                    }}
                    className={cx('rounded-full px-3 py-1 font-semibold', auscTarget === 'lungs' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50')}
                  >
                    Lung sounds
                  </button>
                </div>
              </div>

              {/* Diagram + Video side-by-side */}
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <AuscultationPlacementDiagram
                  value={site}
                  onChange={(v) => {
                    if (mode === 'guided') return;
                    setSite(v);
                  }}
                  disabled={mode === 'guided'}
                  mode={auscTarget}
                  highlightLabel={site}
                  sex={bodySex}
                  onSexChange={setBodySex}
                />

                <PlacementCameraPane
                  overlaySrc={overlaySrc}
                  overlayEnabled={overlayEnabled}
                  setOverlayEnabled={setOverlayEnabled}
                  overlayOpacity={overlayOpacity}
                  setOverlayOpacity={setOverlayOpacity}
                  overlayView={overlayView}
                  setOverlayView={setOverlayView}
                  overlayAuto={overlayAuto}
                  setOverlayAuto={setOverlayAuto}
                  mirror={mirrorVideo}
                  setMirror={setMirrorVideo}
                />
              </div>

              {mode === 'guided' ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Guided mode selects the site automatically — diagram selection is locked, but camera overlay can still help you place correctly.
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">Site</div>
                  <span className="text-xs text-slate-500">Saved into meta</span>
                </div>
                <select
                  value={site}
                  onChange={(e) => setSite(e.target.value as SiteKey)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10"
                >
                  {SITES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label} — {s.hint}
                    </option>
                  ))}
                </select>
                {mode === 'guided' ? <div className="mt-2 text-xs text-slate-500">Guided mode uses step site automatically.</div> : null}
              </label>

              <label className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">Input gain</div>
                  <span className="text-xs text-slate-500">Visual scale</span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Volume2 className="h-4 w-4 text-slate-500" />
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.01}
                    defaultValue={1}
                    onChange={(e) => (gainRef.current = parseFloat(e.target.value))}
                    className="w-full"
                    aria-label="Visual gain"
                  />
                </div>
                <div className="mt-2 text-xs text-slate-500">Does not change device sampling; only the waveform view.</div>
              </label>

              <label className="sm:col-span-2 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">Clinical note (optional)</div>
                  <span className="text-xs text-slate-500">Stored locally; upload may redact</span>
                </div>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note for clinician review"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10"
                />
                {hideSensitive ? <div className="mt-2 text-xs text-slate-500">Hide sensitive is ON: notes are redacted during upload.</div> : null}
              </label>
            </div>

            {!connected ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    Click <span className="font-semibold">Connect</span>, select the device, then press <span className="font-semibold">Start Recording</span>. Press{' '}
                    <span className="font-semibold">Stop &amp; Save</span> to queue upload.
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          {/* Right column */}
          <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Uploads</h2>
              <p className="mt-1 text-sm text-slate-600">Each recording tracks its own status.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Queued</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">{counts.queued}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Failed</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">{counts.failed}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Uploaded</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">{counts.uploaded}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={retryFailed}
              disabled={!autoUpload || counts.queued + counts.failed === 0}
              className={cx(
                'inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold',
                counts.queued + counts.failed > 0 ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-200 text-slate-500'
              )}
            >
              <UploadCloud className="h-4 w-4" />
              Upload queued / retry failed
            </button>

            {deviceTelemetryCard}

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <div>
                  <div className="font-semibold">Clinical boundary</div>
                  <div className="mt-1 text-amber-800">Audio capture supports clinician review; it does not diagnose.</div>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* History */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Saved recordings</h2>
              <p className="mt-1 text-sm text-slate-600">
                Stored locally (IndexedDB) and uploaded when online. Each clip stores duration, sample rate, file size, waveform preview, and quick stats.
              </p>
            </div>
          </div>

          {/* Inline player */}
          {activePlayId && activePlayUrl && activeClip ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Play className="h-4 w-4 text-slate-600" />
                    <div className="text-sm font-semibold text-slate-900">Playback</div>
                    <QualityPill q={activeClip.quality} />
                    {activeClip.serverRef || activeClip.serverUrl ? (
                      <button
                        type="button"
                        onClick={() => void copyShare(activeClip)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        title="Copy share link"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy link
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-1 text-xs text-slate-600">
                    {SITES.find((s) => s.key === activeClip.site)?.label ?? activeClip.site} · {formatMs(activeClip.durationMs)} · {activeClip.sampleRate} Hz ·{' '}
                    {formatBytes(activeClip.sizeBytes)}
                    {activeClip.sessionId ? (
                      <span className="ml-2">
                        · Session <span className="font-mono">{activeClip.sessionId.slice(0, 8)}</span> step{' '}
                        {Number.isFinite(activeClip.stepIndex) ? (activeClip.stepIndex as number) + 1 : '—'}
                      </span>
                    ) : null}
                  </div>

                  {!discreet ? (
                    <div className="mt-1 text-xs text-slate-500">
                      Consent: {activeClip.consent?.recorded ? `${activeClip.consent.source}` : 'not recorded'} · Attach:{' '}
                      {activeClip.visitId
                        ? `visit:${activeClip.visitId}`
                        : activeClip.roomId
                        ? `room:${activeClip.roomId}`
                        : activeClip.appointmentId
                        ? `appt:${activeClip.appointmentId}`
                        : '—'}
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={closePlayer}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white p-2 hover:bg-slate-50"
                  aria-label="Close player"
                >
                  <X className="h-4 w-4 text-slate-700" />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <MiniWave peaks={activeClip.peaks} muted={false} />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuality(activeClip.id, 'good')}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                    title="Mark as good capture"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Good
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuality(activeClip.id, 'noise')}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100"
                    title="Mark as noisy"
                  >
                    <Ban className="h-4 w-4" />
                    Noise
                  </button>
                </div>
              </div>

              {activeClip.analysis ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <div className="text-xs text-slate-500">RMS</div>
                    <div className="font-semibold text-slate-900 tabular-nums">{activeClip.analysis.rms.toFixed(3)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <div className="text-xs text-slate-500">Peak</div>
                    <div className="font-semibold text-slate-900 tabular-nums">{activeClip.analysis.peak.toFixed(3)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <div className="text-xs text-slate-500">Clipping</div>
                    <div className="font-semibold text-slate-900 tabular-nums">{activeClip.analysis.clipPct.toFixed(2)}%</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <div className="text-xs text-slate-500">ZCR/s</div>
                    <div className="font-semibold text-slate-900 tabular-nums">{activeClip.analysis.zcrPerSec.toFixed(1)}</div>
                  </div>
                </div>
              ) : null}

              <audio className="mt-3 w-full" controls src={activePlayUrl} />
            </div>
          ) : null}

          {history.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              No recordings yet. Capture a clip and press <span className="font-semibold">Stop &amp; Save</span>.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">When</th>
                    <th className="px-4 py-3 text-left font-semibold">Site</th>
                    <th className="px-4 py-3 text-left font-semibold">Wave</th>
                    <th className="px-4 py-3 text-left font-semibold">Duration</th>
                    <th className="px-4 py-3 text-left font-semibold">Rate</th>
                    <th className="px-4 py-3 text-left font-semibold">Size</th>
                    <th className="px-4 py-3 text-left font-semibold">Quality</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Note</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-t border-slate-200">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-800">{new Date(h.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-800">{SITES.find((s) => s.key === h.site)?.label ?? h.site}</td>
                      <td className="px-4 py-3">
                        <MiniWave peaks={h.peaks} muted={h.quality === 'noise'} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-800 tabular-nums">{formatMs(h.durationMs)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-800 tabular-nums">{h.sampleRate} Hz</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-800">{formatBytes(h.sizeBytes)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <QualityPill q={h.quality} />
                          <button
                            type="button"
                            onClick={() => setQuality(h.id, 'good')}
                            className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 p-2 hover:bg-emerald-100"
                            title="Mark good"
                          >
                            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuality(h.id, 'noise')}
                            className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 p-2 hover:bg-rose-100"
                            title="Mark noise"
                          >
                            <Ban className="h-4 w-4 text-rose-700" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <Badge status={h.status} />
                          {h.status === 'failed' && h.lastError ? (
                            <div className="text-xs text-rose-700">
                              {h.lastError} {Number.isFinite(h.attempts) ? `(attempts: ${h.attempts})` : ''}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-[22rem]">
                        <div className="line-clamp-2">{hideSensitive ? <span className="text-slate-400">Hidden</span> : h.note || <span className="text-slate-400">—</span>}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openPlayer(h.id)}
                            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white p-2 hover:bg-slate-50"
                            title="Play"
                          >
                            <Play className="h-4 w-4 text-slate-700" />
                          </button>

                          <button
                            type="button"
                            onClick={() => downloadClip(h)}
                            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white p-2 hover:bg-slate-50"
                            title="Download WAV"
                          >
                            <Download className="h-4 w-4 text-slate-700" />
                          </button>

                          {h.status === 'failed' || h.status === 'queued' ? (
                            <button
                              type="button"
                              onClick={() => retryOne(h.id)}
                              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white p-2 hover:bg-slate-50"
                              title="Retry upload"
                            >
                              <UploadCloud className="h-4 w-4 text-slate-700" />
                            </button>
                          ) : null}

                          {h.serverRef || h.serverUrl ? (
                            <button
                              type="button"
                              onClick={() => void copyShare(h)}
                              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white p-2 hover:bg-slate-50"
                              title="Copy link"
                            >
                              <Copy className="h-4 w-4 text-slate-700" />
                            </button>
                          ) : null}

                          {h.status === 'uploaded' && (h.serverRef || h.serverUrl) ? (
                            <span
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
                              title="Server reference"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              linked
                            </span>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => deleteClip(h)}
                            className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 p-2 hover:bg-rose-100"
                            title="Delete local recording"
                          >
                            <Trash2 className="h-4 w-4 text-rose-700" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Sessions */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">Sessions</div>
              <div className="text-xs text-slate-500">{sessions.length} total</div>
            </div>

            {sessions.length === 0 ? (
              <div className="mt-2 text-sm text-slate-600">No sessions yet. Switch to Guided and start one.</div>
            ) : (
              <div className="mt-3 space-y-3">
                {sessions.slice(0, 5).map((s) => {
                  const done = s.steps.filter((x) => x.clipId).length;
                  return (
                    <div key={s.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {new Date(s.createdAt).toLocaleString()} · {done}/{s.steps.length} clips · {s.status === 'complete' ? 'Complete' : 'In progress'}
                          </div>
                          <div className="mt-1 text-xs text-slate-600 font-mono">{discreet ? maskId(s.id) : s.id}</div>
                        </div>
                      </div>

                      <label className="mt-3 block">
                        <div className="text-xs font-semibold text-slate-600">Summary note</div>
                        <input
                          defaultValue={s.summaryNote || ''}
                          onBlur={(e) => updateSessionSummary(s.id, e.target.value)}
                          placeholder="Optional session summary"
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10"
                        />
                      </label>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {s.steps.map((st, idx) => {
                          const label = SITES.find((x) => x.key === st.site)?.label || st.site;
                          const has = !!st.clipId;
                          return (
                            <span
                              key={`${s.id}-${idx}`}
                              className={cx(
                                'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold',
                                has ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-700'
                              )}
                              title={has ? `Clip saved` : `Missing`}
                            >
                              <Circle className={cx('h-2.5 w-2.5', has ? 'fill-emerald-500 text-emerald-500' : 'fill-slate-300 text-slate-300')} />
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ✅ SSR-safe online indicator */}
          <footer className="text-xs text-slate-500">
            Storage: {supportsIdb ? 'IndexedDB (persistent)' : 'Session-only'} · Auto-upload: {autoUpload ? 'On' : 'Off'} · Network:{' '}
            {typeof navigator !== 'undefined' && navigator.onLine ? 'Online' : 'Offline'}
          </footer>
        </section>
      </div>
    </main>
  );
}
