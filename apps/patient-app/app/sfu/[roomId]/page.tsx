// apps/patient-app/app/sfu/[roomId]/page.tsx
'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Room, RoomEvent, RemoteParticipant, DataPacket_Kind, ConnectionQuality } from 'livekit-client';

import { connectRoom } from '@ambulant/rtc';

// Charts already in patient app
import MeterDonut from '../../../components/charts/MeterDonut';
import Sparkline from '../../../components/charts/Sparkline';
import BpChart, { type BpPoint } from '../../../components/charts/BpChart';

/* ------------------------------
   Join token helpers
--------------------------------*/
type SearchLike = { get(k: string): string | null };

function getUid() {
  if (typeof window === 'undefined') return 'server-user';
  const key = 'ambulant_uid';
  let v = localStorage.getItem(key);
  if (!v) {
    v = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + '-u';
    localStorage.setItem(key, v);
  }
  return v;
}

function getJoinToken(search: SearchLike, visitId: string, roomId: string) {
  const direct = search.get('joinToken') || search.get('jt') || search.get('join') || '';
  if (direct) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`televisit_join_${visitId}`, direct);
        localStorage.setItem(`televisit_join_${roomId}`, direct);
      } catch {}
    }
    return direct;
  }

  if (typeof window === 'undefined') return '';
  const keys = [
    `televisit_join_${visitId}`,
    `televisit_join_${roomId}`,
    `ambulant_join_${visitId}`,
    `ambulant_join_${roomId}`,
    `ambulant_join_token_${visitId}`,
    `ambulant_join_token_${roomId}`,
    'ambulant_join_token',
  ];

  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v && v.trim()) return v.trim();
  }
  return '';
}

/* ------------------------------
   Minimal local UI helpers
--------------------------------*/
function Card({
  title,
  toolbar,
  children,
  dense,
}: {
  title?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  dense?: boolean;
}) {
  return (
    <section className={`rounded-2xl border border-gray-200 bg-white shadow-sm ${dense ? '' : ''}`}>
      {(title || toolbar) && (
        <header className="flex items-center justify-between px-3 py-2 border-b bg-gradient-to-r from-gray-50 to-white rounded-t-2xl">
          <div className="text-sm font-semibold">{title}</div>
          <div className="flex items-center gap-2">{toolbar}</div>
        </header>
      )}
      <div className={dense ? 'p-2' : 'p-3'}>{children}</div>
    </section>
  );
}

function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return <>{children}</>;
}

function Badge({
  label,
  active,
  color = 'emerald',
}: {
  label: string;
  active?: boolean;
  color?: 'emerald' | 'indigo' | 'sky' | 'red' | 'gray' | 'amber';
}) {
  const map: Record<string, string> = {
    emerald: 'bg-emerald-600',
    indigo: 'bg-indigo-600',
    sky: 'bg-sky-600',
    red: 'bg-red-600',
    gray: 'bg-gray-600',
    amber: 'bg-amber-600',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full text-white ${active ? map[color] : 'bg-gray-400'}`}>
      {label}
    </span>
  );
}

function IconBtn(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { children, ...rest } = props;
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/90 backdrop-blur shadow ring-1 ring-black/10 hover:bg-white disabled:opacity-50 ${props.className || ''}`}
    >
      {children}
    </button>
  );
}

function CollapseBtn({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
      aria-pressed={open}
      aria-label={open ? 'Collapse' : 'Expand'}
    >
      {open ? 'Collapse' : 'Expand'}
    </button>
  );
}

function Tabs<T extends string>({
  items,
  active,
  onChange,
}: {
  items: { key: T; label: string }[];
  active: T;
  onChange: (k: T) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-full border bg-white p-0.5">
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => onChange(it.key)}
          className={`px-3 py-1.5 text-xs rounded-full ${
            active === it.key ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function Icon({ name, toggledName, toggled }: { name: string; toggledName?: string; toggled?: boolean }) {
  const n = toggled ? toggledName || name : name;
  if (n === 'mic')
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M12 1a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V4a3 3 0 0 1 3-3z" />
        <path d="M5 11a7 7 0 0 0 14 0h-2a5 5 0 0 1-10 0H5z" />
        <path d="M11 19h2v3h-2z" />
      </svg>
    );
  if (n === 'mic-off')
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M15 10V4a3 3 0 0 0-5.23-1.94l8.17 8.17A2.99 2.99 0 0 0 15 10z" />
        <path d="M5 11a7 7 0 0 0 11.31 5.31l1.42 1.42A8.97 8.97 0 0 1 12 20a9 9 0 0 1-9-9h2z" />
        <path d="M3.28 4.22 4.7 2.8l16.5 16.5-1.42 1.42z" />
      </svg>
    );
  if (n === 'video')
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M15 10.25V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3.25L21 17V7l-6 3.25z" />
      </svg>
    );
  if (n === 'video-off')
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M2.81 2.81 1.39 4.22 19.78 22.6l1.41-1.41L2.81 2.81z" />
        <path d="M15 10.25V7a2 2 0 0 0-2-2H7.27L15 12.73z" />
        <path d="M3 6v10a2 2 0 0 0 2 2h10.73L3 6z" />
        <path d="M21 7l-6 3.25V9l6-3z" />
      </svg>
    );
  if (n === 'heart')
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-rose-600" fill="currentColor">
        <path d="M12 21s-8.5-6.36-8.5-11.5A4.5 4.5 0 0 1 8 5a5.64 5.64 0 0 1 4 2 5.64 5.64 0 0 1 4-2 a4.5 4.5 0 0 1 4.5 4.5C20.5 14.64 12 21 12 21z" />
      </svg>
    );
  if (n === 'cc')
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M3 5h18a2 2 0 012 2v10a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2zm3 6a3 3 0 003 3h1v-2H9a1 1 0 010-2h1V8H9a3 3 0 00-3 3zm7 0a3 3 0 003 3h1v-2h-1a1 1 0 010-2h1V8h-1a3 3 0 00-3 3z" />
      </svg>
    );
  if (n === 'layers')
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M12 2l10 6-10 6L2 8l10-6zm0 8l10 6-10 6-10-6 10-6z" />
      </svg>
    );
  if (n === 'rec')
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-red-600" fill="currentColor">
        <circle cx="12" cy="12" r="6" />
      </svg>
    );
  if (n === 'collapse' || n === 'expand')
    return <span className="inline-block w-4 h-4">{n === 'collapse' ? '▾' : '▸'}</span>;
  return <span className="inline-block w-4 h-4">•</span>;
}

/* ------------------------------
   Helpers (sim + vitals)
--------------------------------*/
const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

function broadcastVitals(v: any) {
  const payload = { type: 'vitals', vitals: v };
  try {
    window.postMessage(payload, '*');
  } catch {}
  try {
    window.top && window.top !== window && window.top.postMessage(payload, '*');
  } catch {}
  try {
    window.parent && window.parent !== window && window.parent.postMessage(payload, '*');
  } catch {}
  try {
    window.opener && window.opener.postMessage(payload, '*');
  } catch {}
  try {
    const bc = new BroadcastChannel('ambulant-iomt');
    bc.postMessage(payload);
    setTimeout(() => bc.close(), 50);
  } catch {}
}

type Vitals = {
  ts: number;
  hr: number;
  spo2: number;
  sys: number;
  dia: number;
  map: number;
  rr: number;
  tempC: number;
  glucose: number;
};

function nextSample(prev?: Vitals): Vitals {
  const t = Date.now();
  const base = { hr: 72, spo2: 97.2, sys: 116, dia: 74, map: 88, rr: 16, tempC: 36.8, glucose: 94 };
  const jitter = (m = 0, sd = 1) => (Math.random() - 0.5) * sd * 2 + m;
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

  const v0 = prev ?? ({ ts: t - 1000, ...base } as Vitals);
  const target = {
    hr: clamp(v0.hr + jitter(0, 1.6), 58, 135),
    spo2: clamp(v0.spo2 + jitter(0, 0.25), 93, 100),
    sys: clamp(v0.sys + jitter(0, 2.8), 90, 180),
    dia: clamp(v0.dia + jitter(0, 2.0), 55, 110),
    map: 0,
    rr: clamp(v0.rr + jitter(0, 0.9), 8, 32),
    tempC: clamp(v0.tempC + jitter(0, 0.05), 35.0, 39.8),
    glucose: clamp(v0.glucose + jitter(0, 2.5), 60, 190),
  };
  target.map = Math.round((target.sys + 2 * target.dia) / 3);
  const k = 0.35;

  return {
    ts: t,
    hr: round1(lerp(v0.hr, target.hr, k)),
    spo2: round1(lerp(v0.spo2, target.spo2, k)),
    sys: round1(lerp(v0.sys, target.sys, k)),
    dia: round1(lerp(v0.dia, target.dia, k)),
    map: round1(lerp(v0.map, target.map, k)),
    rr: round1(lerp(v0.rr, target.rr, k)),
    tempC: round1(lerp(v0.tempC, target.tempC, k)),
    glucose: Math.round(lerp(v0.glucose, target.glucose, k)),
  };
}

/* ------------------------------
   Hydration-safe date text
--------------------------------*/
function SafeDate({ iso }: { iso: string | null }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <span suppressHydrationWarning>{mounted && iso ? new Date(iso).toLocaleString() : '—'}</span>;
}

/* ------------------------------
   Page
--------------------------------*/
type HistoryEntry =
  | {
      kind: 'condition';
      name: string;
      diagnosedAt?: string | null;
      clinician?: string;
      facility?: string;
      location?: string;
      confirmTest?: string;
      comment?: string;
    }
  | {
      kind: 'operation';
      name: string;
      opDate?: string | null;
      clinician?: string;
      facility?: string;
      location?: string;
      comment?: string;
    }
  | {
      kind: 'vaccination';
      codeOrName: string;
      vType?: string;
      contents?: string;
      adminAt?: string | null;
      clinician?: string;
      facility?: string;
      location?: string;
      comment?: string;
    };

type UploadKind = 'erx' | 'lab' | 'xray' | 'image' | 'other';
type InboxItem = { id: string; kind: 'pharmacy' | 'lab'; createdAt?: string; title: string; details?: string };

export default function PatientSFU({ params }: { params: { roomId: string } }) {
  const router = useRouter();
  const { roomId } = params;
  const search = useSearchParams();
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL as string | undefined;

  // Encounter ID for post-call summary/rating
  const encounterId = useMemo(() => {
    if (!search) return null;
    return (
      search.get('encounterId') ||
      search.get('encounter') ||
      search.get('enc') ||
      null
    );
  }, [search]);

  // identity stable per page load
  const identity = useMemo(() => `patient-${Math.random().toString(36).slice(2, 7)}`, []);

  // UI prefs
  const [dense, setDense] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [presentation, setPresentation] = useState(false);

  // Connection state
  const [room, setRoom] = useState<Room | null>(null);
  const [state, setState] = useState<'disconnected' | 'connecting' | 'connected' | 'reconnecting'>('disconnected');
  const [quality, setQuality] = useState<ConnectionQuality | undefined>(undefined);
  const qualityLabel = quality !== undefined ? ConnectionQuality[quality] : 'Unknown';

  // AV + overlay toggles
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [showVitals, setShowVitals] = useState(true);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [isRecording, setIsRecording] = useState(false);

  // collab controls
  const [screenOn, setScreenOn] = useState(false);
  const [raised, setRaised] = useState(false);
  const [blurOn, setBlurOn] = useState(false); // stub

  // active speaker highlight
  const [activeSpeaking, setActiveSpeaking] = useState(false);

  // shortcuts help
  const [helpOpen, setHelpOpen] = useState(false);

  // Toasts
  type Toast = { id: string; text: string; kind?: 'info' | 'success' | 'warning' | 'error' };
  const [toasts, setToasts] = useState<Toast[]>([]);
  function pushToast(text: string, kind: Toast['kind'] = 'info') {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }

  // Recording notification
  const [recordingToast, setRecordingToast] = useState<string | null>(null);

  // Video refs
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioSinkRef = useRef<HTMLAudioElement | null>(null);
  const videoCardRef = useRef<HTMLDivElement | null>(null);

  // Floating/docking/lock + PIP
  const [videoFloating, setVideoFloating] = useState(false);
  const [videoFloatLocked, setVideoFloatLocked] = useState(true);
  const [pip, setPip] = useState<{ x: number; y: number }>({ x: 3, y: 3 });
  const [videoPos, setVideoPos] = useState<{ xPct: number; yPct: number }>({ xPct: 10, yPct: 10 });
  const draggingRef = useRef<{ active: boolean } | null>(null);
  const [showVControls, setShowVControls] = useState(false);
  const touchTimerRef = useRef<number | null>(null);

  const touchKick = () => {
    setShowVControls(true);
    if (touchTimerRef.current) window.clearTimeout(touchTimerRef.current);
    touchTimerRef.current = window.setTimeout(() => setShowVControls(false), 2500);
  };
  const hoverOpacity = showVControls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100';

  const toggleFloatLock = () => {
    if (draggingRef.current) draggingRef.current.active = false;
    setVideoFloatLocked((prev) => {
      const next = !prev;
      if (next) setVideoFloating(false);
      else setVideoFloating(true);
      return next;
    });
  };

  const startDragVideo = (_clientX: number, _clientY: number) => {
    if (videoFloatLocked) return;
    setVideoFloating(true);
    draggingRef.current = { active: true };
  };

  const moveDragVideo = (clientX: number, clientY: number) => {
    if (!draggingRef.current?.active || videoFloatLocked) return;
    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    const w = Math.min(vw, 960);
    const h = (w * 9) / 16;

    const x = ((clientX - w * 0.5) / vw) * 100;
    const y = ((clientY - h * 0.5) / vh) * 100;
    const clamp01 = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    setVideoPos({ xPct: clamp01(x, 0, 100), yPct: clamp01(y, 0, 100) });
  };

  const endDragVideo = () => {
    if (draggingRef.current) draggingRef.current.active = false;
  };

  useEffect(() => {
    const up = () => endDragVideo();
    const leave = () => endDragVideo();
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    window.addEventListener('mouseleave', leave);
    return () => {
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchend', up);
      window.removeEventListener('mouseleave', leave);
    };
  }, []);

  // Session meta + timer
  const [whenIso, setWhenIso] = useState<string | null>(null);
  useEffect(() => {
    setWhenIso(new Date().toISOString());
  }, [roomId]);

  const appt = useMemo(
    () => ({
      id: `sfu-${roomId}`,
      when: whenIso,
      patientId: 'pt-dev',
      patientName: 'Demo Patient',
      clinicianName: 'Demo Clinician',
      reason: 'Acute bronchitis (demo)',
      status: 'In progress',
    }),
    [roomId, whenIso],
  );

  const [startTime, setStartTime] = useState<number | null>(null);
  const startRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState<string>('00:00');
  useEffect(() => {
    if (!startTime) return;
    const t = setInterval(() => {
      const s = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
      const hh = Math.floor(s / 3600).toString().padStart(2, '0');
      const mm = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
      const ss = (s % 60).toString().padStart(2, '0');
      setElapsed(hh === '00' ? `${mm}:${ss}` : `${hh}:${mm}:${ss}`);
    }, 1000);
    return () => clearInterval(t);
  }, [startTime]);

  // Left collapses
  const [infoOpen, setInfoOpen] = useState(true);
  const [monitorOpen, setMonitorOpen] = useState(true);
  const [allergiesOpen, setAllergiesOpen] = useState(true);

  // Right tabs
  type RightTab = 'records' | 'history' | 'inbox' | 'uploads';
  const [rightTab, setRightTab] = useState<RightTab>('records');
  const [rightPanelsOpen, setRightPanelsOpen] = useState(true);

  // Allergies
  type Allergy = {
    name?: string;
    status: 'Active' | 'Resolved';
    note?: string;
    severity?: 'mild' | 'moderate' | 'severe';
  };
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [allergyLoading, setAllergyLoading] = useState(false);

  async function loadAllergies() {
    setAllergyLoading(true);
    try {
      const r = await fetch('/api/allergies', { cache: 'no-store' });
      const d: Allergy[] = await r.json().catch(() => []);
      setAllergies(Array.isArray(d) ? d : []);
    } catch {
      setAllergies([]);
    } finally {
      setAllergyLoading(false);
    }
  }

  useEffect(() => {
    loadAllergies();
    const t = setInterval(loadAllergies, 20000);
    return () => clearInterval(t);
  }, []);

  // Current meds + adherence demo
  const [currentMeds] = useState<string[]>(['Metformin 500 mg PO BID', 'Atorvastatin 20 mg PO QHS']);
  const [adherencePct, setAdherencePct] = useState<number>(88);
  const [adherenceSeries, setAdherenceSeries] = useState<Array<{ t: number; y: number }>>(() => {
    const now = Date.now();
    return Array.from({ length: 30 }).map((_, i) => ({ t: now - (30 - i) * 86400000, y: 70 + Math.random() * 30 }));
  });

  useEffect(() => {
    const t = setInterval(() => {
      setAdherenceSeries((old) => {
        const now = Date.now();
        const next = [
          ...old,
          { t: now, y: Math.max(50, Math.min(100, (old.at(-1)?.y ?? 85) + (Math.random() - 0.5) * 8)) },
        ];
        if (next.length > 60) next.shift();
        setAdherencePct(Math.round(next.at(-1)!.y));
        return next;
      });
    }, 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // Inbox (eRx/Lab orders) fetch
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  async function loadInbox() {
    try {
      const r = await fetch('/api/erx/orders', { cache: 'no-store' });
      const js = await r.json().catch(() => ({}));
      const list: any[] = js?.orders ?? js ?? [];
      const rows: InboxItem[] = (Array.isArray(list) ? list : []).map((o: any) => ({
        id: o.id || o?.order?.id || `rx-${Math.random().toString(36).slice(2, 8)}`,
        kind: (o.kind || (o?.eRx ? 'pharmacy' : 'lab')) as 'pharmacy' | 'lab',
        createdAt: o.createdAt || undefined,
        title: o.title || o?.items?.[0]?.drugName || (o.panel || 'Order'),
        details: o.details || (o?.items?.map((i: any) => i.drugName).join(', ') || ''),
      }));
      setInbox(rows);
    } catch {
      /* noop */
    }
  }
  useEffect(() => {
    loadInbox();
  }, []);

  // Uploads
  type Upload = { id: string; kind: UploadKind; name: string; size: number; at: number; by: string; url?: string };
  const [uploads, setUploads] = useState<Upload[]>([]);
  const onUploadFiles = async (files: FileList | null, kind: UploadKind) => {
    if (!files?.length) return;
    const arr = Array.from(files);
    for (const f of arr) {
      const url = URL.createObjectURL(f);
      setUploads((u) => [
        ...u,
        {
          id: `upl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          kind,
          name: f.name,
          size: f.size,
          at: Date.now(),
          by: identity,
          url,
        },
      ]);
    }
    alert('Upload queued (demo)');
  };

  /* ------------------------------
     Room helpers
  --------------------------------*/
  function firstRemote(r: Room): RemoteParticipant | undefined {
    const anyRoom = r as any;
    if (typeof anyRoom.getParticipants === 'function') {
      const arr = anyRoom.getParticipants();
      if (Array.isArray(arr) && arr.length) return arr[0] as RemoteParticipant;
    }
    const maps = [anyRoom.remoteParticipants, anyRoom.participants];
    for (const m of maps) {
      if (m && typeof m.values === 'function') {
        const it = m.values();
        const n = it.next();
        if (!n.done) return n.value as RemoteParticipant;
      }
    }
    return undefined;
  }

  const attachToRoom = useCallback((r: Room) => {
    const rp = firstRemote(r);
    if (rp) {
      const rvpub = [...rp.videoTrackPublications.values()].find((p) => p.isSubscribed && p.videoTrack);
      if (rvpub && remoteVideoRef.current) rvpub.videoTrack?.attach(remoteVideoRef.current);

      const rapub = [...rp.audioTrackPublications.values()].find((p) => p.isSubscribed && p.audioTrack);
      if (rapub && audioSinkRef.current) rapub.audioTrack?.attach(audioSinkRef.current);
    }

    const localPubV = [...r.localParticipant.videoTrackPublications.values()].find((p) => p.track);
    if (localPubV && localVideoRef.current) localPubV.videoTrack?.attach(localVideoRef.current);
  }, []);

  const publishControl = async (type: string, value: boolean | string | any) => {
    if (!room) return;
    try {
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ type, value, from: 'patient' })),
        DataPacket_Kind.RELIABLE,
        'control',
      );
    } catch (e) {
      console.warn('[control] publish error', e);
    }
  };

  const wireRoomEvents = (r: Room) => {
    const attachNow = () => attachToRoom(r);

    r.on(RoomEvent.TrackSubscribed, attachNow)
      .on(RoomEvent.TrackUnsubscribed, attachNow)
      .on(RoomEvent.LocalTrackPublished, attachNow)
      .on(RoomEvent.ParticipantConnected, (p) => {
        attachNow();
        if ((p as any).isPublisher === false) pushToast('Clinician joined', 'success');
      })
      .on(RoomEvent.ParticipantDisconnected, () => {
        attachNow();
        pushToast('Clinician left', 'warning');
      })
      .on(RoomEvent.ConnectionStateChanged, () => setState(r.state as any))
      .on(RoomEvent.ConnectionQualityChanged, (_p, q) => setQuality(q))
      .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        setActiveSpeaking(!!(speakers && speakers.length));
      })
      .on(RoomEvent.DataReceived, (payload, _p, _kind, topic) => {
        try {
          const text = new TextDecoder().decode(payload);
          const msg = JSON.parse(text);

          if (topic === 'control') {
            if (msg?.type === 'vitals') setShowVitals(!!msg.value);
            if (msg?.type === 'captions') setCaptionsOn(!!msg.value);
            if (msg?.type === 'overlay') setShowOverlay(!!msg.value);

            if (msg?.type === 'recording') {
              const next = !!msg.value;
              if (next && !isRecording) {
                setRecordingToast('Clinician started recording. You are being recorded.');
                setTimeout(() => setRecordingToast(null), 6000);
              }
              setIsRecording(next);
            }

            if (msg?.type === 'screenshare' && msg.value === true) {
              pushToast('Screen share started', 'info');
            }

            // XR is intentionally DISABLED on the patient SFU page.
            // If clinician sends {type:"xr"}, we ignore it here.
          }
        } catch {
          /* ignore */
        }
      });

    attachNow();
  };

  // Consent guard
  const [consentGiven, setConsentGiven] = useState(false);
  const policyUrl = '/policy/televisit.pdf'; // place in /public/policy/televisit.pdf

  // Join / leave
  const [wrapUp, setWrapUp] = useState<{ show: boolean; seconds: number }>({ show: false, seconds: 0 });

  const join = async () => {
    if (!wsUrl) return alert('Missing NEXT_PUBLIC_LIVEKIT_URL');
    if (state !== 'disconnected') return;

    setState('connecting');

    try {
      const uid = getUid();
      const visitId = search.get('visitId') || search.get('visit') || search.get('v') || roomId;
      const joinToken = getJoinToken(search, visitId, roomId);

      if (!joinToken) {
        throw new Error(
          [
            'Missing Televisit join token.',
            'Expected query ?jt=... OR localStorage key televisit_join_<visitId>.',
            'Open the SFU page via Appointments → Join (it should pass/store the token).',
          ].join(' '),
        );
      }

      // Mint LiveKit token via your Next API route (server validates joinToken against appointment)
      const token = await fetch('/api/rtc/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-uid': uid, 'x-role': 'patient' },
        body: JSON.stringify({
          roomId,
          room: roomId,
          identity,
          user: identity,
          who: { role: 'patient', uid },
          visitId,
          joinToken,
        }),
      })
        .then((r) => {
          if (!r.ok) throw new Error(`token fetch HTTP ${r.status}`);
          return r.json();
        })
        .then((j) => j.token as string);

      const r = await connectRoom(wsUrl, token, { autoSubscribe: true });
      wireRoomEvents(r);

      setRoom(r);
      setState('connected');

      await r.localParticipant.setMicrophoneEnabled(true);
      await r.localParticipant.setCameraEnabled(true);

      setMicOn(true);
      setCamOn(true);

      setQuality(r.localParticipant.connectionQuality);
      const nowTs = Date.now();
      setStartTime(nowTs);
      startRef.current = nowTs;
      attachToRoom(r);

      pushToast('Connected', 'success');
    } catch (err: any) {
      console.error('[Join] error', err);
      setState('disconnected');
      alert(`Failed to join room: ${err?.message || err}`);
    }
  };

  const leave = async () => {
    const secs =
      startRef.current != null
        ? Math.max(0, Math.floor((Date.now() - startRef.current) / 1000))
        : startTime
        ? Math.max(0, Math.floor((Date.now() - startTime) / 1000))
        : 0;

    try {
      await room?.disconnect();
    } catch {}
    setRoom(null);
    setState('disconnected');
    setMicOn(false);
    setCamOn(false);
    setStartTime(null);
    startRef.current = null;
    setElapsed('00:00');
    setRecordingToast(null);

    // If we know the encounterId, send the patient straight to the visit summary + rating
    if (encounterId) {
      router.push(`/encounters/${encodeURIComponent(encounterId)}?rate=1`);
    } else {
      // Fallback to the existing wrap-up modal if no encounterId was provided
      setWrapUp({ show: true, seconds: secs });
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        room?.disconnect();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AV toggles
  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    room?.localParticipant.setMicrophoneEnabled(next).catch(() => {});
  };
  const toggleCam = () => {
    const next = !camOn;
    setCamOn(next);
    room?.localParticipant.setCameraEnabled(next).catch(() => {});
    if (room) attachToRoom(room);
  };

  // Overlay toggles (broadcast to clinician)
  const toggleAndBroadcast = (key: 'vitals' | 'captions' | 'overlay' | 'recording', val: boolean) => {
    if (key === 'vitals') setShowVitals(val);
    if (key === 'captions') setCaptionsOn(val);
    if (key === 'overlay') setShowOverlay(val);
    if (key === 'recording') setIsRecording(val);
    publishControl(key, val);
  };

  // PIP bump
  const bumpPip = () => setPip((p) => ({ x: (p.x + 22) % 70, y: (p.y + 18) % 60 }));

  // Grid layout
  const gridCols = presentation
    ? 'grid-cols-1'
    : leftCollapsed && rightCollapsed
      ? 'grid-cols-1'
      : leftCollapsed
        ? 'lg:grid-cols-[2fr_1.2fr]'
        : rightCollapsed
          ? 'lg:grid-cols-[1.2fr_2fr]'
          : 'lg:grid-cols-[1.2fr_2fr_1.2fr]';

  /* ------------------------------
     Export: Allergies & Meds
  --------------------------------*/
  const exportAllergiesToClinician = async () => {
    if (!room) return alert('Join the room first');
    const active = allergies.filter((a) => a.status === 'Active');
    const lines = active.length
      ? active
          .map((a) => `• ${a.name || 'Allergy'}${a.severity ? ` (${a.severity})` : ''}${a.note ? ` — ${a.note}` : ''}`)
          .join('\n')
      : 'No active allergies.';
    const text = `Allergies (Patient → SOAP, read-only):\n${lines}`;
    try {
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ from: 'patient', text })),
        DataPacket_Kind.RELIABLE,
        'chat',
      );
      await publishControl('allergies_export', { lines: active, at: Date.now() });
      await fetch('/api/events/emit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'patient.allergies.export', roomId, payload: active }),
      }).catch(() => {});
      alert('Allergies sent.');
    } catch {
      alert('Failed to send allergies');
    }
  };

  const exportMedsToClinician = async () => {
    if (!room) return alert('Join the room first');
    const lines = currentMeds.length ? currentMeds.map((m) => `• ${m}`).join('\n') : 'No current medications.';
    const text = `Current Medication (Patient):\n${lines}\nAdherence: ${adherencePct}%`;
    try {
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ from: 'patient', text })),
        DataPacket_Kind.RELIABLE,
        'chat',
      );
      await publishControl('meds_export', { meds: currentMeds, adherencePct, series: adherenceSeries, at: Date.now() });
      await fetch('/api/events/emit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'patient.meds.export', roomId, payload: { meds: currentMeds, adherencePct } }),
      }).catch(() => {});
      alert('Medication shared.');
    } catch {
      alert('Failed to share meds');
    }
  };

  /* ------------------------------
     History Editor
  --------------------------------*/
  const [historyEntries, setHistoryEntries] = useState<Array<HistoryEntry & { id: string; by: string; at: number }>>([]);
  type HEKind = 'condition' | 'operation' | 'vaccination';
  const [heKind, setHeKind] = useState<HEKind>('condition');

  const [heName, setHeName] = useState('');
  const [heFacility, setHeFacility] = useState('');
  const [heLocation, setHeLocation] = useState('');
  const [heClinician, setHeClinician] = useState('');
  const [heComment, setHeComment] = useState('');
  const [heDxAt, setHeDxAt] = useState<string>('');
  const [heConfirmTest, setHeConfirmTest] = useState('');
  const [heOpAt, setHeOpAt] = useState<string>('');
  const [heVacCodeOrName, setHeVacCodeOrName] = useState('');
  const [heVacType, setHeVacType] = useState('');
  const [heVacContents, setHeVacContents] = useState('');
  const [heVacAt, setHeVacAt] = useState<string>('');

  function ageAt(dateISO?: string | null) {
    if (!dateISO) return '—';
    try {
      const dobStr = search.get('patientDob') || '';
      if (!dobStr) return '—';
      const dob = new Date(dobStr).getTime();
      const at = new Date(dateISO).getTime();
      if (!Number.isFinite(dob) || !Number.isFinite(at)) return '—';
      const years = Math.floor((at - dob) / (365.25 * 86400000));
      return `${years}y`;
    } catch {
      return '—';
    }
  }

  const addHistoryEntry = async () => {
    let payload: HistoryEntry;
    if (heKind === 'condition') {
      payload = {
        kind: 'condition',
        name: heName.trim(),
        diagnosedAt: heDxAt || null,
        clinician: heClinician || undefined,
        facility: heFacility || undefined,
        location: heLocation || undefined,
        confirmTest: heConfirmTest || undefined,
        comment: heComment || undefined,
      };
    } else if (heKind === 'operation') {
      payload = {
        kind: 'operation',
        name: heName.trim(),
        opDate: heOpAt || null,
        clinician: heClinician || undefined,
        facility: heFacility || undefined,
        location: heLocation || undefined,
        comment: heComment || undefined,
      };
    } else {
      payload = {
        kind: 'vaccination',
        codeOrName: heVacCodeOrName.trim() || heName.trim(),
        vType: heVacType || undefined,
        contents: heVacContents || undefined,
        adminAt: heVacAt || null,
        clinician: heClinician || undefined,
        facility: heFacility || undefined,
        location: heLocation || undefined,
        comment: heComment || undefined,
      };
    }

    const entry = {
      ...payload,
      id: `he_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      by: identity,
      at: Date.now(),
    };
    setHistoryEntries((e) => [entry, ...e]);

    try {
      await fetch('/api/events/emit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'patient.history.add', roomId, payload: entry }),
      });
    } catch {}

    setHeName('');
    setHeFacility('');
    setHeLocation('');
    setHeClinician('');
    setHeComment('');
    setHeDxAt('');
    setHeConfirmTest('');
    setHeOpAt('');
    setHeVacCodeOrName('');
    setHeVacType('');
    setHeVacContents('');
    setHeVacAt('');
  };

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target &&
        (((e.target as HTMLElement).tagName === 'INPUT') || (e.target as HTMLElement).tagName === 'TEXTAREA')
      )
        return;
      if (e.key === 'm') {
        e.preventDefault();
        toggleMic();
      }
      if (e.key === 'v') {
        e.preventDefault();
        toggleCam();
      }
      if (e.key === 'j') {
        e.preventDefault();
        state !== 'connected' ? consentGiven && join() : leave();
      }
      if (e.key === '?') {
        e.preventDefault();
        setHelpOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, consentGiven, micOn, camOn, room]);

  // unstable network toast
  useEffect(() => {
    if (quality === ConnectionQuality.Poor) {
      pushToast('Network unstable', 'warning');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality]);

  /* ------------------------------
     Render
  --------------------------------*/
  const showTop = (
    <header className="sticky top-0 z-40 flex items-center justify-between p-4 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Patient Console — Room {roomId}</h1>
        <span className="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-full border">
          <span
            className={`h-2 w-2 rounded-full ${
              state === 'connected' ? 'bg-emerald-500' : state === 'connecting' ? 'bg-amber-500' : 'bg-slate-400'
            }`}
          />
          {state}
        </span>
        {quality !== undefined && <span className="text-xs text-gray-600">QoS: {ConnectionQuality[quality]}</span>}
        <span
          className={`text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
            quality === ConnectionQuality.Poor
              ? 'border-amber-300 bg-amber-50 text-amber-800'
              : 'border-gray-200 bg-white text-gray-700'
          }`}
        >
          Net: {qualityLabel}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setLeftCollapsed((v) => !v)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-xs"
          aria-pressed={leftCollapsed}
          aria-label={leftCollapsed ? 'Show left pane' : 'Hide left pane'}
          title={leftCollapsed ? 'Show Left' : 'Hide Left'}
        >
          <Icon name={leftCollapsed ? 'expand' : 'collapse'} /> {leftCollapsed ? 'Show Left' : 'Hide Left'}
        </button>

        <button
          onClick={() => setDense((v) => !v)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-xs"
          aria-pressed={dense}
          aria-label={dense ? 'Use comfortable density' : 'Use compact density'}
          title="Toggle density"
        >
          {dense ? 'Comfort' : 'Compact'}
        </button>

        <button
          onClick={() => {
            const next = !presentation;
            setPresentation(next);
            if (next) {
              try {
                (videoCardRef.current as any)?.requestFullscreen?.();
              } catch {}
            } else {
              try {
                document.exitFullscreen?.();
              } catch {}
            }
          }}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-xs"
          aria-pressed={presentation}
          aria-label={presentation ? 'Exit full screen mode' : 'Enter full screen mode'}
          title={presentation ? 'Exit Full Screen' : 'Enter Full Screen'}
        >
          <Icon name={presentation ? 'collapse' : 'expand'} /> {presentation ? 'Exit Full Screen' : 'Full Screen'}
        </button>

        <button
          onClick={() => setRightCollapsed((v) => !v)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-xs"
          aria-pressed={rightCollapsed}
          aria-label={rightCollapsed ? 'Show right pane' : 'Hide right pane'}
          title={rightCollapsed ? 'Show Right' : 'Hide Right'}
        >
          <Icon name={rightCollapsed ? 'expand' : 'collapse'} /> {rightCollapsed ? 'Show Right' : 'Hide Right'}
        </button>

        {/* consent + policy link */}
        <div className="hidden md:flex items-center gap-2 mr-2 text-xs">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={consentGiven} onChange={(e) => setConsentGiven(e.target.checked)} />
            <span>I consent to this Televisit and recording (if enabled).</span>
          </label>
          <a href={policyUrl} target="_blank" className="text-blue-700 underline">
            Policy (PDF)
          </a>
        </div>

        {state !== 'connected' ? (
          <button
            onClick={join}
            disabled={!consentGiven}
            className="px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 shadow-sm hover:bg-blue-100 text-sm disabled:opacity-50"
            title={consentGiven ? 'Join' : 'Please check consent first'}
          >
            Join
          </button>
        ) : (
          <button
            onClick={leave}
            className="px-3 py-1.5 rounded-full border border-red-200 bg-red-50 shadow-sm hover:bg-red-100 text-sm"
          >
            Leave
          </button>
        )}

        <Link href="/appointments" className="text-sm text-blue-600 hover:underline">
          Back
        </Link>
      </div>
    </header>
  );

  return (
    <div className="min-h-screen bg-gray-50" data-density={dense ? 'compact' : 'comfort'}>
      {showTop}

      {/* Toasts */}
      <div className="fixed top-16 right-4 z-[80] space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-3 py-2 rounded shadow text-sm ${
              t.kind === 'error'
                ? 'bg-rose-600 text-white'
                : t.kind === 'warning'
                  ? 'bg-amber-600 text-white'
                  : t.kind === 'success'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-900 text-white'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>

      {state === 'reconnecting' && (
        <div className="sticky top-14 z-40 mx-4 my-2 rounded border bg-amber-50 text-amber-900 px-3 py-2 flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
          Reconnecting…
        </div>
      )}

      {recordingToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-full bg-red-600 text-white shadow">
          {recordingToast}
        </div>
      )}

      {/* FLOATING VIDEO */}
      {videoFloating && (
        <div
          className={`fixed z-50 rounded-lg overflow-hidden bg-black ${
            activeSpeaking ? 'ring-2 ring-emerald-400' : 'ring-1 ring-gray-200'
          } shadow-2xl group select-none`}
          style={{
            left: `${videoPos.xPct}%`,
            top: `${videoPos.yPct}%`,
            width: 'min(90vw, 960px)',
            aspectRatio: '16/9',
            transform: 'translate(-10%, -10%)',
            cursor: videoFloatLocked ? 'not-allowed' : 'grab',
          }}
          onMouseDown={(e) => {
            if (videoFloatLocked) return;
            const nd = (e.target as HTMLElement).closest('[data-no-drag="true"]');
            if (!nd) startDragVideo(e.clientX, e.clientY);
          }}
          onMouseMove={(e) => {
            if (videoFloatLocked) return;
            moveDragVideo(e.clientX, e.clientY);
          }}
          onTouchStart={(e) => {
            touchKick();
            if (videoFloatLocked) return;
            const t = e.touches[0];
            const nd = (e.target as HTMLElement).closest('[data-no-drag="true"]');
            if (!nd) startDragVideo(t.clientX, t.clientY);
          }}
          onTouchMove={(e) => {
            if (videoFloatLocked) return;
            moveDragVideo(e.touches[0].clientX, e.touches[0].clientY);
          }}
          onDoubleClick={() => setPresentation((p) => !p)}
          title={videoFloatLocked ? 'Floating locked — click lock to unlock' : 'Drag anywhere; double-click for full screen'}
        >
          {/* Lock */}
          <div className={`absolute top-3 left-3 z-10 ${hoverOpacity} transition-opacity duration-200`} data-no-drag="true">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFloatLock();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              title={videoFloatLocked ? 'Floating is LOCKED (click to unlock)' : 'UNLOCKED (click to lock + dock)'}
              aria-pressed={videoFloatLocked}
              className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/85 backdrop-blur shadow ring-1 ring-black/10"
              data-no-drag="true"
            >
              <svg
                viewBox="0 0 24 24"
                className={`w-5 h-5 ${videoFloatLocked ? 'text-emerald-600' : 'text-rose-600'}`}
                fill="currentColor"
                aria-hidden="true"
              >
                {videoFloatLocked ? (
                  <path d="M12 1.5a4.5 4.5 0 00-4.5 4.5v3H6A2.25 2.25 0 003.75 11.25v7.5A2.25 2.25 0 006 21h12a2.25 2.25 0 002.25-2.25v-7.5A2.25 2.25 0 0018 9H16.5V6A4.5 4.5 0 0012 1.5zm0 3a1.5 1.5 0 011.5 1.5v3h-3V6A1.5 1.5 0 0112 4.5z" />
                ) : (
                  <path d="M7.5 6A4.5 4.5 0 0116.5 6v.75a.75.75 0 001.5 0V6a6 6 0 10-12 0v3h-0.75A2.25 2.25 0 003 11.25v7.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75v-7.5A2.25 2.25 0 0015.75 9H7.5V6z" />
                )}
              </svg>
            </button>
          </div>

          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover ring-1 ring-black/10" />
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute rounded border border-white/80 shadow-lg object-cover w-40 h-28 left-3 top-12"
            title="Local preview"
          />
          <audio ref={audioSinkRef} autoPlay />

          {/* controls */}
          <div
            className={`absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 bg-white/85 backdrop-blur rounded-full px-2 py-2 shadow ${hoverOpacity} transition-opacity duration-200`}
            data-no-drag="true"
          >
            <IconBtn onClick={toggleMic} aria-label={micOn ? 'Mute mic' : 'Unmute mic'} aria-pressed={micOn}>
              <Icon name="mic" toggledName="mic-off" toggled={!micOn} />
            </IconBtn>
            <IconBtn onClick={toggleCam} aria-label={camOn ? 'Stop camera' : 'Start camera'} aria-pressed={camOn}>
              <Icon name="video" toggledName="video-off" toggled={!camOn} />
            </IconBtn>
            <IconBtn
              title={showVitals ? 'Hide vitals' : 'Show vitals'}
              aria-pressed={showVitals}
              onClick={() => toggleAndBroadcast('vitals', !showVitals)}
            >
              <Icon name="heart" />
            </IconBtn>
            <IconBtn
              title={captionsOn ? 'Disable captions' : 'Enable captions'}
              aria-pressed={captionsOn}
              onClick={() => toggleAndBroadcast('captions', !captionsOn)}
            >
              <Icon name="cc" />
            </IconBtn>
            <IconBtn
              title={showOverlay ? 'Disable overlay' : 'Enable overlay'}
              aria-pressed={showOverlay}
              onClick={() => toggleAndBroadcast('overlay', !showOverlay)}
            >
              <Icon name="layers" />
            </IconBtn>
            <IconBtn
              title={isRecording ? 'Stop recording' : 'Start recording'}
              aria-pressed={isRecording}
              onClick={() => toggleAndBroadcast('recording', !isRecording)}
            >
              <Icon name="rec" />
            </IconBtn>

            {/* screen share / raise / blur */}
            <IconBtn
              title={screenOn ? 'Stop screen share' : 'Share screen'}
              aria-pressed={screenOn}
              onClick={async () => {
                if (!room) return;
                try {
                  const next = !screenOn;
                  await room.localParticipant.setScreenShareEnabled(next);
                  setScreenOn(next);
                  publishControl('screenshare', next);
                  pushToast(next ? 'Screen sharing on' : 'Screen sharing off', 'info');
                } catch {
                  pushToast('Screen share failed', 'error');
                }
              }}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                <path d="M4 5h16v10H4z" />
                <path d="M8 19h8v2H8z" />
              </svg>
            </IconBtn>

            <IconBtn
              title={raised ? 'Lower hand' : 'Raise hand'}
              aria-pressed={raised}
              onClick={() => {
                const next = !raised;
                setRaised(next);
                publishControl('raise_hand', next);
                pushToast(next ? 'Hand raised' : 'Hand lowered', 'info');
              }}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                <path d="M7 11V3h2v8h1V5h2v6h1V7h2v10a4 4 0 11-8 0v-6z" />
              </svg>
            </IconBtn>

            <IconBtn
              title={blurOn ? 'Disable background blur' : 'Enable background blur'}
              aria-pressed={blurOn}
              onClick={() => {
                setBlurOn((b) => !b);
                pushToast(blurOn ? 'Blur off (stub)' : 'Blur on (stub)', 'info');
              }}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                <circle cx="12" cy="12" r="9" />
              </svg>
            </IconBtn>

            <button
              className="ml-1 px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50"
              title="Dock back into layout"
              onClick={() => setVideoFloating(false)}
            >
              Dock
            </button>
          </div>

          {/* badges */}
          <div className="absolute top-3 right-3 flex gap-1 drop-shadow-sm pointer-events-none">
            <Badge label="Vitals" active={showVitals} color="emerald" />
            <Badge label="Captions" active={captionsOn} color="indigo" />
            <Badge label="Overlay" active={showOverlay} color="sky" />
            {isRecording && <Badge label="● Recording" active color="red" />}
          </div>

          {raised && (
            <span className="absolute top-3 left-14 text-xs px-2 py-0.5 rounded-full bg-amber-500 text-white shadow">
              ✋ Raised
            </span>
          )}
        </div>
      )}

      <div
        className={`transition-all duration-300 container mx-auto ${dense ? 'px-3 py-3' : 'px-4 py-6'} ${
          presentation ? 'max-w-[1400px]' : ''
        }`}
      >
        <div className={`grid md:gap-6 gap-3 transition-[grid-template-columns] duration-300 ${gridCols}`}>
          {/* LEFT */}
          {!presentation && !leftCollapsed && (
            <div className="flex flex-col gap-4">
              <SessionInfoCard open={infoOpen} setOpen={setInfoOpen} appt={appt} />

              <Card
                title="Bedside Monitor (live)"
                toolbar={<CollapseBtn open={monitorOpen} onClick={() => setMonitorOpen((v) => !v)} />}
                dense={dense}
              >
                <Collapse open={monitorOpen}>
                  <BedsideDeck vitalsEnabled={showVitals} />
                  <div className="mt-2 text-xs text-gray-500">
                    Streams via <code className="px-1 rounded bg-gray-100">BroadcastChannel('ambulant-iomt')</code>;
                    forwarded to clinician when “Vitals” is on.
                  </div>
                </Collapse>
              </Card>

              <Card
                title="Allergies"
                toolbar={<CollapseBtn open={allergiesOpen} onClick={() => setAllergiesOpen((v) => !v)} />}
                dense={dense}
              >
                <Collapse open={allergiesOpen}>
                  <AllergiesBlock
                    allergies={allergies}
                    loading={allergyLoading}
                    onRefresh={loadAllergies}
                    onExport={exportAllergiesToClinician}
                  />
                </Collapse>
              </Card>

              <Card
                title="Current Medication"
                dense={dense}
                toolbar={
                  <button
                    className="px-2 py-1 text-xs border rounded bg-blue-600 text-white hover:bg-blue-700"
                    onClick={exportMedsToClinician}
                  >
                    Export to Clinician
                  </button>
                }
              >
                <ul className="list-disc pl-5 text-sm text-gray-800">
                  {currentMeds.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <MeterDonut value={adherencePct} max={100} label="Adherence" color="#10B981" unit="%" />
                  <div className="col-span-2 rounded-xl border bg-white p-2">
                    <div className="text-xs text-slate-500 mb-1">Adherence trend</div>
                    <Sparkline data={adherenceSeries} height={64} />
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* CENTER (video, docked) */}
          <div className="flex flex-col gap-4">
            {!videoFloating && (
              <div className="sticky top-4 z-20">
                <Card
                  title={
                    <div className="flex items-center gap-3">
                      <span>Consultation</span>
                      <Badge label="Vitals" active={showVitals} color="emerald" />
                      {isRecording && <Badge label="● Recording" active color="red" />}
                    </div>
                  }
                  dense={dense}
                >
                  <div
                    ref={videoCardRef}
                    className={`relative aspect-video w-full rounded-lg overflow-hidden bg-black ${
                      activeSpeaking ? 'ring-2 ring-emerald-400' : 'ring-1 ring-gray-200'
                    } group ${presentation ? 'cursor-zoom-out' : videoFloatLocked ? 'cursor-default' : 'cursor-zoom-in'}`}
                    title={videoFloatLocked ? 'Floating locked — click lock to unlock' : 'Double-click to full screen; drag to undock'}
                    onDoubleClick={() => setPresentation((p) => !p)}
                    onMouseDown={(e) => {
                      if (videoFloatLocked) return;
                      const nd = (e.target as HTMLElement).closest('[data-no-drag="true"]');
                      if (!nd) startDragVideo(e.clientX, e.clientY);
                    }}
                    onMouseMove={(e) => {
                      if (videoFloatLocked) return;
                      moveDragVideo(e.clientX, e.clientY);
                    }}
                    onTouchStart={(e) => {
                      touchKick();
                      if (videoFloatLocked) return;
                      const t = e.touches[0];
                      const nd = (e.target as HTMLElement).closest('[data-no-drag="true"]');
                      if (!nd) startDragVideo(t.clientX, t.clientY);
                    }}
                    onTouchMove={(e) => {
                      if (videoFloatLocked) return;
                      moveDragVideo(e.touches[0].clientX, e.touches[0].clientY);
                    }}
                  >
                    {/* Lock (docked) */}
                    <div className={`absolute top-3 left-3 z-10 ${hoverOpacity} transition-opacity duration-200`} data-no-drag="true">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFloatLock();
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        title={videoFloatLocked ? 'Floating is LOCKED (click to unlock)' : 'UNLOCKED (click to lock + dock)'}
                        aria-pressed={videoFloatLocked}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/85 backdrop-blur shadow ring-1 ring-black/10"
                        data-no-drag="true"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className={`w-5 h-5 ${videoFloatLocked ? 'text-emerald-600' : 'text-rose-600'}`}
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          {videoFloatLocked ? (
                            <path d="M12 1.5a4.5 4.5 0 00-4.5 4.5v3H6A2.25 2.25 0 003.75 11.25v7.5A2.25 2.25 0 006 21h12a2.25 2.25 0 002.25-2.25v-7.5A2.25 2.25 0 0018 9H16.5V6A4.5 4.5 0 0012 1.5zm0 3a1.5 1.5 0 011.5 1.5v3h-3V6A1.5 1.5 0 0112 4.5z" />
                          ) : (
                            <path d="M7.5 6A4.5 4.5 0 0116.5 6v.75a.75.75 0 001.5 0V6a6 6 0 10-12 0v3h-0.75A2.25 2.25 0 003 11.25v7.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75v-7.5A2.25 2.25 0 0015.75 9H7.5V6z" />
                          )}
                        </svg>
                      </button>
                    </div>

                    <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover ring-1 ring-black/10" />
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="absolute rounded border border-white/80 shadow-lg object-cover w-40 h-28"
                      style={{ left: `${pip.x}%`, top: `${pip.y}%` }}
                      title="Local preview"
                      onClick={bumpPip}
                    />
                    <audio ref={audioSinkRef} autoPlay />

                    {/* badges */}
                    <div className="absolute top-3 right-3 flex gap-1 drop-shadow-sm pointer-events-none">
                      <Badge label="Vitals" active={showVitals} color="emerald" />
                      <Badge label="Captions" active={captionsOn} color="indigo" />
                      <Badge label="Overlay" active={showOverlay} color="sky" />
                      {isRecording && <Badge label="● Recording" active color="red" />}
                    </div>

                    {/* controls */}
                    <div
                      className={`absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-white/85 backdrop-blur rounded-full px-2 py-2 shadow ${hoverOpacity} transition-opacity duration-200`}
                      data-no-drag="true"
                    >
                      <IconBtn onClick={toggleMic} aria-label={micOn ? 'Mute mic' : 'Unmute mic'} aria-pressed={micOn}>
                        <Icon name="mic" toggledName="mic-off" toggled={!micOn} />
                      </IconBtn>
                      <IconBtn onClick={toggleCam} aria-label={camOn ? 'Stop camera' : 'Start camera'} aria-pressed={camOn}>
                        <Icon name="video" toggledName="video-off" toggled={!camOn} />
                      </IconBtn>
                      <IconBtn
                        title={showVitals ? 'Hide vitals' : 'Show vitals'}
                        aria-pressed={showVitals}
                        onClick={() => toggleAndBroadcast('vitals', !showVitals)}
                      >
                        <Icon name="heart" />
                      </IconBtn>
                      <IconBtn
                        title={captionsOn ? 'Disable captions' : 'Enable captions'}
                        aria-pressed={captionsOn}
                        onClick={() => toggleAndBroadcast('captions', !captionsOn)}
                      >
                        <Icon name="cc" />
                      </IconBtn>
                      <IconBtn
                        title={showOverlay ? 'Disable overlay' : 'Enable overlay'}
                        aria-pressed={showOverlay}
                        onClick={() => toggleAndBroadcast('overlay', !showOverlay)}
                      >
                        <Icon name="layers" />
                      </IconBtn>
                      <IconBtn
                        title={isRecording ? 'Stop recording' : 'Start recording'}
                        aria-pressed={isRecording}
                        onClick={() => toggleAndBroadcast('recording', !isRecording)}
                      >
                        <Icon name="rec" />
                      </IconBtn>

                      {/* PATCH 6 controls */}
                      <IconBtn
                        title={screenOn ? 'Stop screen share' : 'Share screen'}
                        aria-pressed={screenOn}
                        onClick={async () => {
                          if (!room) return;
                          try {
                            const next = !screenOn;
                            await room.localParticipant.setScreenShareEnabled(next);
                            setScreenOn(next);
                            publishControl('screenshare', next);
                            pushToast(next ? 'Screen sharing on' : 'Screen sharing off', 'info');
                          } catch {
                            pushToast('Screen share failed', 'error');
                          }
                        }}
                      >
                        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                          <path d="M4 5h16v10H4z" />
                          <path d="M8 19h8v2H8z" />
                        </svg>
                      </IconBtn>

                      <IconBtn
                        title={raised ? 'Lower hand' : 'Raise hand'}
                        aria-pressed={raised}
                        onClick={() => {
                          const next = !raised;
                          setRaised(next);
                          publishControl('raise_hand', next);
                          pushToast(next ? 'Hand raised' : 'Hand lowered', 'info');
                        }}
                      >
                        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                          <path d="M7 11V3h2v8h1V5h2v6h1V7h2v10a4 4 0 11-8 0v-6z" />
                        </svg>
                      </IconBtn>

                      <IconBtn
                        title={blurOn ? 'Disable background blur' : 'Enable background blur'}
                        aria-pressed={blurOn}
                        onClick={() => {
                          setBlurOn((b) => !b);
                          pushToast(blurOn ? 'Blur off (stub)' : 'Blur on (stub)', 'info');
                        }}
                      >
                        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                          <circle cx="12" cy="12" r="9" />
                        </svg>
                      </IconBtn>

                      <button
                        className="ml-1 px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50"
                        title="Undock to float"
                        onClick={() => {
                          if (!videoFloatLocked) setVideoFloating(true);
                          else toggleFloatLock();
                        }}
                      >
                        {videoFloatLocked ? 'Unlock' : 'Float'}
                      </button>
                    </div>

                    {raised && (
                      <span className="absolute top-3 left-14 text-xs px-2 py-0.5 rounded-full bg-amber-500 text-white shadow">
                        ✋ Raised
                      </span>
                    )}
                  </div>

                  <div className="mt-2 text-xs text-gray-600">
                    Session time: <span className="font-mono">{elapsed}</span>
                  </div>
                </Card>
              </div>
            )}
          </div>

          {/* RIGHT */}
          {!presentation && !rightCollapsed && (
            <div className="flex flex-col gap-4">
              <div className="shadow-sm bg-white rounded">
                <div className="flex items-center justify-between p-1">
                  <Tabs<RightTab>
                    active={rightTab}
                    onChange={setRightTab}
                    items={[
                      { key: 'records', label: 'Records' },
                      { key: 'history', label: 'History Editor' },
                      { key: 'inbox', label: 'eRx / Lab' },
                      { key: 'uploads', label: 'Uploads' },
                    ]}
                  />
                  <button
                    className="ml-2 px-2 py-1 text-xs border rounded"
                    onClick={() => setRightPanelsOpen((v) => !v)}
                    aria-pressed={rightPanelsOpen}
                    aria-label={rightPanelsOpen ? 'Collapse right panels' : 'Expand right panels'}
                  >
                    {rightPanelsOpen ? 'Collapse' : 'Expand'}
                  </button>
                </div>
              </div>

              <Collapse open={rightPanelsOpen}>
                {rightTab === 'records' && <RecordsCard dense={dense} />}

                {rightTab === 'history' && (
                  <Card title="History Editor" dense={dense}>
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2 items-center">
                        <Tabs<'condition' | 'operation' | 'vaccination'>
                          items={[
                            { key: 'condition', label: 'Condition' },
                            { key: 'operation', label: 'Operation' },
                            { key: 'vaccination', label: 'Vaccination' },
                          ]}
                          active={heKind}
                          onChange={(k) => setHeKind(k)}
                        />
                      </div>

                      <div className="grid md:grid-cols-2 gap-2">
                        {heKind !== 'vaccination' ? (
                          <input
                            className="border rounded px-2 py-1"
                            placeholder={heKind === 'operation' ? 'Operation (e.g., Triple Bypass)' : 'Condition (e.g., Hypertension)'}
                            value={heName}
                            onChange={(e) => setHeName(e.target.value)}
                          />
                        ) : (
                          <>
                            <input
                              className="border rounded px-2 py-1"
                              placeholder="Vaccine name / code (e.g., MMR, CVX:03)"
                              value={heVacCodeOrName}
                              onChange={(e) => setHeVacCodeOrName(e.target.value)}
                            />
                            <input
                              className="border rounded px-2 py-1"
                              placeholder="Vaccine type (if known)"
                              value={heVacType}
                              onChange={(e) => setHeVacType(e.target.value)}
                            />
                          </>
                        )}
                        <input
                          className="border rounded px-2 py-1"
                          placeholder="Facility name"
                          value={heFacility}
                          onChange={(e) => setHeFacility(e.target.value)}
                        />
                        <input
                          className="border rounded px-2 py-1"
                          placeholder="Location (City, Country)"
                          value={heLocation}
                          onChange={(e) => setHeLocation(e.target.value)}
                        />
                        <input
                          className="border rounded px-2 py-1"
                          placeholder="Clinician"
                          value={heClinician}
                          onChange={(e) => setHeClinician(e.target.value)}
                        />
                      </div>

                      {heKind === 'condition' && (
                        <div className="grid md:grid-cols-2 gap-2">
                          <label className="text-xs text-gray-600 flex items-center gap-2">
                            <span>Date diagnosed</span>
                            <input
                              type="date"
                              className="border rounded px-2 py-1"
                              value={heDxAt}
                              onChange={(e) => setHeDxAt(e.target.value)}
                            />
                          </label>
                          <input
                            className="border rounded px-2 py-1"
                            placeholder="Confirmation test (e.g., PCR, biopsy)"
                            value={heConfirmTest}
                            onChange={(e) => setHeConfirmTest(e.target.value)}
                          />
                        </div>
                      )}

                      {heKind === 'operation' && (
                        <label className="text-xs text-gray-600 inline-flex items-center gap-2">
                          <span>Operation date</span>
                          <input
                            type="date"
                            className="border rounded px-2 py-1"
                            value={heOpAt}
                            onChange={(e) => setHeOpAt(e.target.value)}
                          />
                        </label>
                      )}

                      {heKind === 'vaccination' && (
                        <div className="grid md:grid-cols-2 gap-2">
                          <input
                            className="border rounded px-2 py-1"
                            placeholder="Contents / ingredient (if known)"
                            value={heVacContents}
                            onChange={(e) => setHeVacContents(e.target.value)}
                          />
                          <label className="text-xs text-gray-600 flex items-center gap-2">
                            <span>Date of administration</span>
                            <input
                              type="date"
                              className="border rounded px-2 py-1"
                              value={heVacAt}
                              onChange={(e) => setHeVacAt(e.target.value)}
                            />
                          </label>
                        </div>
                      )}

                      <textarea
                        className="border rounded px-2 py-1 w-full min-h-[70px]"
                        placeholder="Other comments"
                        value={heComment}
                        onChange={(e) => setHeComment(e.target.value)}
                      />

                      <div className="flex justify-end">
                        <button
                          onClick={addHistoryEntry}
                          className="px-3 py-1.5 rounded border bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                          disabled={
                            (heKind === 'condition' && !heName.trim()) ||
                            (heKind === 'operation' && !heName.trim()) ||
                            (heKind === 'vaccination' && !heVacCodeOrName.trim())
                          }
                          title="Saves locally and posts to stubbed /api/events/emit"
                        >
                          Add
                        </button>
                      </div>

                      <div className="mt-3 space-y-2">
                        {historyEntries.length === 0 ? (
                          <div className="text-sm text-gray-500">No entries yet.</div>
                        ) : (
                          historyEntries.map((h) => (
                            <div key={h.id} className="border rounded p-2 bg-white text-sm">
                              <div className="flex items-center justify-between">
                                <div className="font-medium">
                                  {h.kind === 'condition' && `Condition: ${(h as any).name}`}
                                  {h.kind === 'operation' && `Operation: ${(h as any).name}`}
                                  {h.kind === 'vaccination' && `Vaccination: ${(h as any).codeOrName}`}
                                </div>
                                <div className="text-[11px] text-gray-500">
                                  By <span className="font-mono">{h.by}</span> · {new Date(h.at).toLocaleString()}
                                </div>
                              </div>
                              <div className="grid md:grid-cols-3 gap-2 mt-1">
                                {'diagnosedAt' in h && h.diagnosedAt && (
                                  <div>
                                    <b>Dx Date: </b>
                                    {new Date(h.diagnosedAt).toLocaleDateString()}
                                  </div>
                                )}
                                {'opDate' in h && h.opDate && (
                                  <div>
                                    <b>Date: </b>
                                    {new Date(h.opDate).toLocaleDateString()}
                                  </div>
                                )}
                                {'adminAt' in h && h.adminAt && (
                                  <div>
                                    <b>Admin: </b>
                                    {new Date(h.adminAt).toLocaleDateString()}{' '}
                                    <span className="text-xs text-gray-500">({ageAt(h.adminAt)})</span>
                                  </div>
                                )}
                                {h.clinician && (
                                  <div>
                                    <b>Clinician: </b>
                                    {h.clinician}
                                  </div>
                                )}
                                {h.facility && (
                                  <div>
                                    <b>Facility: </b>
                                    {h.facility}
                                  </div>
                                )}
                                {h.location && (
                                  <div>
                                    <b>Location: </b>
                                    {h.location}
                                  </div>
                                )}
                                {'confirmTest' in h && h.confirmTest && (
                                  <div className="md:col-span-3">
                                    <b>Confirmation: </b>
                                    {h.confirmTest}
                                  </div>
                                )}
                                {'contents' in h && (h as any).contents && (
                                  <div className="md:col-span-3">
                                    <b>Contents: </b>
                                    {(h as any).contents}
                                  </div>
                                )}
                                {h.comment && (
                                  <div className="md:col-span-3">
                                    <b>Comments: </b>
                                    {h.comment}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </Card>
                )}

                {rightTab === 'inbox' && (
                  <Card
                    title="Prescriptions & Lab Orders"
                    dense={dense}
                    toolbar={
                      <button
                        onClick={loadInbox}
                        className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50"
                      >
                        Refresh
                      </button>
                    }
                  >
                    {inbox.length === 0 ? (
                      <div className="text-sm text-gray-500">No items yet.</div>
                    ) : (
                      <ul className="divide-y bg-white border rounded">
                        {inbox.map((it) => (
                          <li key={it.id} className="p-2 text-sm">
                            <div className="flex items-center justify-between">
                              <div className="font-medium">{it.title}</div>
                              <div className="text-[11px] text-gray-500">
                                {it.createdAt ? new Date(it.createdAt).toLocaleString() : '—'}
                              </div>
                            </div>
                            <div className="text-xs text-gray-600">
                              {it.kind === 'pharmacy' ? 'Pharmacy eRx' : 'Lab Order'}
                              {it.details ? ` — ${it.details}` : ''}
                            </div>
                            <div className="mt-1 flex gap-2">
                              <button
                                className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50"
                                onClick={() => alert('Open order (demo)')}
                              >
                                View
                              </button>
                              <button
                                className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50"
                                onClick={() => alert('Downloading (demo)')}
                              >
                                Download
                              </button>
                              <button
                                className="px-2 py-1 text-xs border rounded bg-rose-600 text-white hover:bg-rose-700"
                                onClick={async () => {
                                  if (!confirm('Delete this item?')) return;
                                  await fetch('/api/events/emit', {
                                    method: 'POST',
                                    headers: { 'content-type': 'application/json' },
                                    body: JSON.stringify({ type: 'patient.inbox.delete', roomId, id: it.id }),
                                  }).catch(() => {});
                                  setInbox((list) => list.filter((x) => x.id !== it.id));
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                )}

                {rightTab === 'uploads' && (
                  <Card title="Upload Results & Documents" dense={dense}>
                    <div className="grid md:grid-cols-2 gap-3">
                      {(['erx', 'lab', 'xray', 'image', 'other'] as UploadKind[]).map((kind) => (
                        <div key={kind} className="border rounded p-2">
                          <div className="text-sm font-medium mb-1 capitalize">{kind} files</div>
                          <input
                            type="file"
                            multiple
                            onChange={(e) => onUploadFiles(e.target.files, kind)}
                            className="text-xs"
                          />
                          <div className="text-[11px] text-gray-500 mt-1">
                            Supported: JPEG, PNG, PDF, WEBM (demo)
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3">
                      <div className="text-sm font-medium mb-1">Uploaded (session)</div>
                      {uploads.length === 0 ? (
                        <div className="text-sm text-gray-500">No uploads yet.</div>
                      ) : (
                        <ul className="divide-y bg-white border rounded">
                          {uploads.map((u) => (
                            <li key={u.id} className="p-2 text-sm flex items-center justify-between">
                              <div>
                                <div className="font-medium">
                                  {u.name}{' '}
                                  <span className="text-xs text-gray-500">({u.kind})</span>
                                </div>
                                <div className="text-[11px] text-gray-500">
                                  By <span className="font-mono">{u.by}</span> ·{' '}
                                  {new Date(u.at).toLocaleString()}
                                </div>
                              </div>
                              <div className="flex gap-2 items-center">
                                {u.url && (
                                  <a
                                    className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50"
                                    href={u.url}
                                    download
                                  >
                                    Download
                                  </a>
                                )}
                                <button
                                  className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50"
                                  onClick={() => alert('Saved to EHR (demo)')}
                                >
                                  Save to EHR
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </Card>
                )}
              </Collapse>
            </div>
          )}
        </div>
      </div>

      {/* help modal */}
      {helpOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/40 grid place-items-center p-4"
          onClick={() => setHelpOpen(false)}
        >
          <div className="bg-white rounded-xl max-w-md w-full p-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-semibold mb-2">Shortcuts & Help</div>
            <ul className="text-sm space-y-1">
              <li>
                <b>m</b> — Mute/Unmute
              </li>
              <li>
                <b>v</b> — Video On/Off
              </li>
              <li>
                <b>j</b> — Join/Leave
              </li>
              <li>
                <b>?</b> — Toggle this help
              </li>
            </ul>
            <div className="mt-3 text-xs text-gray-500">XR is disabled on the patient SFU page.</div>
            <div className="mt-3 text-right">
              <button
                className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50 text-sm"
                onClick={() => setHelpOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* wrap-up modal (only shown when no encounterId, because otherwise we redirect) */}
      {wrapUp.show && !encounterId && (
        <div
          className="fixed inset-0 z-[70] bg-black/40 grid place-items-center p-4"
          onClick={() => setWrapUp({ show: false, seconds: 0 })}
        >
          <div className="bg-white rounded-xl max-w-lg w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-semibold">Thanks for your Televisit</div>
            <div className="text-sm text-gray-700">
              Time in call:{' '}
              <b>
                {Math.floor(wrapUp.seconds / 60)}m {wrapUp.seconds % 60}s
              </b>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <a href="/myCare" className="px-3 py-2 rounded border bg-white hover:bg-gray-50 text-sm text-center">
                Go to myCare
              </a>
              <a href="/appointments" className="px-3 py-2 rounded bg-indigo-600 text-white text-sm text-center">
                Book follow-up
              </a>
            </div>
            <div className="text-xs text-gray-500">You can download chat/captions/notes later from your visit summary.</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------
   Session Info (left)
--------------------------------*/
function SessionInfoCard({ open, setOpen, appt }: { open: boolean; setOpen: (v: boolean) => void; appt: any }) {
  const Field = ({ label, value, bold = false }: { label: string; value: ReactNode; bold?: boolean }) => (
    <div className="flex items-center justify-between border rounded px-2 py-1 bg-white">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className={`text-sm ${bold ? 'font-semibold' : ''}`}>{value}</div>
    </div>
  );

  return (
    <Card title="Session Information" toolbar={<CollapseBtn open={open} onClick={() => setOpen((v) => !v)} />}>
      <Collapse open={open}>
        <div className="grid grid-cols-1 gap-2">
          <Field label="Patient Name" value={appt.patientName} />
          <Field label="Patient ID" value={appt.patientId} />
          <Field label="Case Name" value={appt.reason} bold />
          <Field label="Session ID" value={<span className="font-mono">{appt.id}</span>} />
          <Field label="Session Date" value={<SafeDate iso={appt.when} />} />
          <Field label="Clinician" value={appt.clinicianName} />

          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center gap-3 border rounded px-2 py-2 bg-white">
              <div className="h-9 w-9 rounded-full bg-indigo-600 text-white grid place-items-center text-xs font-semibold">
                {(appt.clinicianName || 'Clinician')
                  .split(' ')
                  .map((p: string) => p[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
              <div className="text-sm">
                <div className="font-semibold">{appt.clinicianName || 'Clinician'}</div>
                <div className="text-xs text-gray-500">{appt.clinicianSpecialty || 'General Practice'}</div>
              </div>
            </div>

            <div className="flex items-center justify-between border rounded px-2 py-2 bg-white">
              <div className="text-[11px] text-gray-500">Consult Fee</div>
              <div className="text-sm font-semibold">
                {typeof appt.feeZar === 'number' ? `R${appt.feeZar.toFixed(2)}` : '—'}
                {appt.coupon?.applied && (
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Coupon: {appt.coupon.code} ({appt.coupon.percent || 0}%)
                  </span>
                )}
              </div>
            </div>
          </div>

          <Field label="Status" value={appt.status} />
        </div>
      </Collapse>
    </Card>
  );
}

/* ------------------------------
   Allergies block
--------------------------------*/
function AllergiesBlock({
  allergies,
  loading,
  onRefresh,
  onExport,
}: {
  allergies: { name?: string; status: 'Active' | 'Resolved'; note?: string; severity?: 'mild' | 'moderate' | 'severe' }[];
  loading: boolean;
  onRefresh: () => void;
  onExport: () => void;
}) {
  const activeCount = allergies.filter((a) => a.status === 'Active').length;
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-600">
          Active: <b>{activeCount}</b> / Total: <b>{allergies.length}</b>
        </div>
        <div className="flex gap-2">
          <button
            className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50 disabled:opacity-50"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            className="px-2 py-1 text-xs border rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={onExport}
            title="Sends to clinician chat + control channel"
          >
            Export to Clinician SOAP
          </button>
        </div>
      </div>

      {allergies.length === 0 ? (
        <div className="text-sm text-gray-500">No allergies found.</div>
      ) : (
        <ul className="divide-y bg-white border rounded">
          {allergies.map((a, i) => (
            <li key={i} className="p-2 text-sm flex items-start justify-between">
              <div>
                <div className="font-medium">{a.name || 'Allergy'}</div>
                <div className="text-xs text-gray-500">
                  {a.severity ? `Severity: ${a.severity}` : ''} {a.note ? ` · ${a.note}` : ''}
                </div>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  a.status === 'Active' ? 'bg-amber-600 text-white' : 'bg-gray-200'
                }`}
              >
                {a.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ------------------------------
   Records (right)
--------------------------------*/
function RecordsCard({ dense }: { dense?: boolean }) {
  type Tab = 'ehr' | 'labs' | 'erx';
  const [tab, setTab] = useState<Tab>('ehr');
  return (
    <Card
      dense={dense}
      title={
        <div className="flex items-center justify-between w-full">
          <div className="font-medium">Records</div>
          <Tabs<Tab>
            items={[
              { key: 'ehr', label: 'EHR' },
              { key: 'labs', label: 'Labs' },
              { key: 'erx', label: 'eRx' },
            ]}
            active={tab}
            onChange={setTab}
          />
        </div>
      }
    >
      {tab === 'ehr' && (
        <div className="space-y-2">
          <ListBlock title="History" items={['No prior cases in demo.']} />
          <ListBlock title="Conditions" items={['—']} />
          <ListBlock title="Vaccinations" items={['—']} />
        </div>
      )}
      {tab === 'labs' && (
        <div className="space-y-2">
          <ListBlock title="Results" items={['None available in demo.']} />
        </div>
      )}
      {tab === 'erx' && (
        <div className="space-y-2">
          <ListBlock title="Prescriptions" items={['None dispensed in demo.']} />
        </div>
      )}
    </Card>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="border rounded p-2 bg-white">
      <div className="text-sm font-medium mb-1">{title}</div>
      <ul className="list-disc pl-5 text-sm text-gray-800">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------
   Bedside Monitor Deck
--------------------------------*/
type DeviceTab = 'wearable' | 'monitor' | 'stetho' | 'otoscope';

function BedsideDeck({ vitalsEnabled }: { vitalsEnabled: boolean }) {
  const [tab, setTab] = useState<DeviceTab>('wearable');
  const [series, setSeries] = useState<Vitals[]>([]);
  const [ecgOn, setEcgOn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let v = nextSample();
    const tick = () => {
      if (cancelled) return;
      v = nextSample(v);
      if (vitalsEnabled) broadcastVitals(v);
      setSeries((old) => {
        const max = 240;
        const next = [...old, v];
        if (next.length > max) next.shift();
        return next;
      });
      setTimeout(tick, 800);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [vitalsEnabled]);

  const latest = series.at(-1);
  const hrSeries = series.map((s) => ({ t: s.ts, y: s.hr }));
  const bpSeries: BpPoint[] = series.map((s) => ({ ts: s.ts, sys: s.sys, dia: s.dia }));

  const [readingKey, setReadingKey] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, number | string>>({});

  useEffect(() => {
    if (!readingKey) return;
    const t = setTimeout(() => {
      const rand = (a: number, b: number) => Math.round((a + Math.random() * (b - a)) * 10) / 10;
      const dict: Record<string, number> = {
        glucose: rand(80, 160),
        bpSys: rand(100, 140),
        bpDia: rand(65, 90),
        spo2: Math.round(rand(94, 99)),
        tempC: rand(36.2, 37.9),
        hr: rand(60, 120),
      };
      setResult((r) => ({ ...r, [readingKey]: dict[readingKey] ?? '—' }));
      setReadingKey(null);
    }, 2200);
    return () => clearTimeout(t);
  }, [readingKey]);

  const [steps, setSteps] = useState(3421);
  const [cal, setCal] = useState(512);
  const [dist, setDist] = useState(2.6);

  useEffect(() => {
    const t = setInterval(() => {
      setSteps((s) => s + Math.round(Math.random() * 6));
      setCal((c) => c + Math.round(Math.random() * 2));
      setDist((d) => Math.round((d + Math.random() * 0.005) * 100) / 100);
    }, 2500);
    return () => clearInterval(t);
  }, []);

  const [sleep, setSleep] = useState<Array<{ t: number; y: number }>>(() => {
    const now = Date.now();
    const arr: Array<{ t: number; y: number }> = [];
    for (let i = 0; i < 60; i++) {
      const stage = [1, 1, 2, 2, 3, 1, 2, 3, 1, 0][Math.floor(Math.random() * 10)];
      arr.push({ t: now - (60 - i) * 60000, y: stage });
    }
    return arr;
  });

  useEffect(() => {
    const t = setInterval(() => {
      setSleep((old) => {
        const now = Date.now();
        const next = [...old, { t: now, y: [1, 2, 3, 1, 2, 1, 3, 2, 1, 0][Math.floor(Math.random() * 10)] }];
        if (next.length > 120) next.shift();
        return next;
      });
    }, 60000);
    return () => clearInterval(t);
  }, []);

  const [stress, setStress] = useState<Array<{ t: number; y: number }>>(() => {
    const now = Date.now();
    return Array.from({ length: 60 }).map((_, i) => ({ t: now - (60 - i) * 60000, y: 30 + Math.random() * 40 }));
  });

  useEffect(() => {
    const t = setInterval(() => {
      setStress((old) => {
        const now = Date.now();
        const next = [
          ...old,
          { t: now, y: Math.max(5, Math.min(95, (old.at(-1)?.y || 40) + (Math.random() - 0.5) * 8)) },
        ];
        if (next.length > 180) next.shift();
        return next;
      });
    }, 60000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Tabs<DeviceTab>
          items={[
            { key: 'wearable', label: 'Wearable' },
            { key: 'monitor', label: 'Health Monitor' },
            { key: 'stetho', label: 'Stethoscope' },
            { key: 'otoscope', label: 'Otoscope' },
          ]}
          active={tab}
          onChange={setTab}
        />
        <span className="text-xs text-gray-500" suppressHydrationWarning>
          {latest ? new Date(latest.ts).toLocaleTimeString() : '—'}
        </span>
      </div>

      {tab === 'wearable' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <MeterDonut value={steps % 10000} max={10000} label="Steps" color="#34D399" unit="" />
            <MeterDonut value={cal % 2000} max={2000} label="Calories" color="#F59E0B" unit="" />
            <MeterDonut value={Math.round((dist % 10) * 100) / 100} max={10} label="Distance (km)" color="#3B82F6" unit="" />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Sleep stages (0 Awake · 1 Light · 2 Deep · 3 REM)</div>
            <div className="rounded-xl border bg-white p-2">
              <Sparkline data={sleep} height={88} fill showAxis />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-xl border bg-white p-2">
              <div className="text-xs text-slate-500 mb-1">Daytime stress</div>
              <Sparkline data={stress} height={64} />
            </div>
            <div className="rounded-xl border bg-white p-2">
              <div className="text-xs text-slate-500 mb-1">Live heart rate</div>
              <Sparkline data={hrSeries} height={64} />
            </div>
          </div>
        </div>
      )}

      {tab === 'monitor' && (
        <div className="space-y-3">
          <div className="grid md:grid-cols-6 gap-2">
            {[
              { key: 'glucose', label: 'Glucose' },
              { key: 'bp', label: 'Blood Pressure' },
              { key: 'spo2', label: 'SpO₂' },
              { key: 'tempC', label: 'Temp' },
              { key: 'hr', label: 'Heart Rate' },
              { key: 'ecg', label: 'ECG' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => {
                  if (f.key === 'bp') {
                    setReadingKey('bpSys');
                    setTimeout(() => setReadingKey('bpDia'), 200);
                  } else if (f.key !== 'ecg') setReadingKey(f.key);
                  if (f.key === 'ecg') setEcgOn((v) => !v);
                }}
                className="relative rounded-xl border bg-white hover:bg-slate-50 p-2 text-xs"
                title={f.label}
              >
                <div className="font-medium">{f.label}</div>
                {(readingKey &&
                  (readingKey.startsWith(f.key) ||
                    (f.key === 'bp' && (readingKey === 'bpSys' || readingKey === 'bpDia')))) && (
                  <div className="absolute -right-1 -top-1 h-4 w-4">
                    <div className="h-4 w-4 rounded-full border-2 border-sky-500 animate-[spin_1s_linear_infinite]" />
                    <div className="absolute inset-0 grid place-items-center">
                      <div className="h-2 w-2 rounded-full bg-sky-500" />
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="rounded-xl border bg-white p-3">
            <div className="text-sm font-medium mb-2">Results</div>
            <div className="grid md:grid-cols-3 gap-2 text-sm">
              <Result label="Glucose" value={fmt(result.glucose)} unit="mg/dL" />
              <Result label="SpO₂" value={fmt(result.spo2)} unit="%" />
              <Result label="Temp" value={fmt(result.tempC)} unit="°C" />
              <Result label="HR" value={fmt(result.hr)} unit="bpm" />
              <Result label="BP SYS" value={fmt(result.bpSys)} unit="mmHg" />
              <Result label="BP DIA" value={fmt(result.bpDia)} unit="mmHg" />
            </div>

            <div className="mt-3">
              <BpChart data={bpSeries} />
            </div>

            <div className="mt-3 rounded-xl border bg-[#0b1020] p-2">
              <div className="flex items-center justify-between">
                <div className="text-slate-200 text-sm font-medium inline-flex items-center gap-2">
                  <Icon name="heart" /> ECG {ecgOn ? '(live)' : '(stopped)'}
                </div>
                <button
                  onClick={() => setEcgOn((v) => !v)}
                  className={`px-2 py-1 rounded text-xs ${ecgOn ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}
                >
                  {ecgOn ? 'Stop' : 'Start'}
                </button>
              </div>
              <div className="h-36 mt-2">
                <ECGCanvas running={ecgOn} />
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'stetho' && <StethoscopePane />}
      {tab === 'otoscope' && <OtoscopePane />}
    </div>
  );
}

function Result({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded border p-2 bg-white flex items-baseline justify-between">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-semibold">
        {value}
        {unit ? ` ${unit}` : ''}
      </div>
    </div>
  );
}

const fmt = (x?: number | string) => (x === undefined || x === null || Number.isNaN(Number(x)) ? '—' : String(x));

/* ------------------------------
   ECG Canvas
--------------------------------*/
function ECGCanvas({ running }: { running: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let t = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.parentElement?.clientWidth || 600;
      const h = canvas.parentElement?.clientHeight || 140;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    function spike(p: number) {
      const mod = p % (Math.PI * 2);
      return mod > 0.15 && mod < 0.22 ? 1 : 0;
    }

    const draw = () => {
      if (!ctx) return;
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);

      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(148,163,184,0.15)';
      for (let x = 0; x < w; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const phase = (t + x) / 24;
        const y = h / 2 + Math.sin(phase) * 8 + Math.sin(phase * 0.5 + 1.2) * 3 + spike(phase) * -22;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      t += running ? 3 : 0.5;
      raf.current = requestAnimationFrame(draw);
    };

    raf.current = requestAnimationFrame(draw);
    return () => {
      ro.disconnect();
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [running]);

  return <canvas ref={ref} className="w-full h-full block rounded" />;
}

/* ------------------------------
   Stethoscope (demo)
--------------------------------*/
function StethoscopePane() {
  type SM = 'heart' | 'lung';
  const [tab, setTab] = useState<SM>('heart');
  const [rec, setRec] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  async function synthWav(seconds = 5, hz = 220) {
    const sr = 44100;
    const n = seconds * sr;
    const buf = new Float32Array(n);
    for (let i = 0; i < n; i++) buf[i] = Math.sin((2 * Math.PI * hz * i) / sr) * (tab === 'lung' ? 0.2 : 0.5);
    const wav = pcm16Wav(buf, sr);
    return URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
  }

  const toggle = async () => {
    if (rec) {
      setRec(false);
      const url = await synthWav(5, tab === 'heart' ? 80 : 220);
      setAudioUrl(url);
    } else {
      setAudioUrl(null);
      setRec(true);
    }
  };

  return (
    <div className="space-y-3">
      <Tabs<'heart' | 'lung'> items={[{ key: 'heart', label: 'Heart' }, { key: 'lung', label: 'Lungs' }]} active={tab} onChange={setTab} />
      <div className="rounded-xl border bg-white p-3">
        <div className="text-sm text-gray-600 mb-1">Audio waveform</div>
        <WaveStrip active={rec} />
        <div className="mt-2 flex items-center gap-2">
          <button onClick={toggle} className={`px-3 py-1.5 rounded ${rec ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
            {rec ? 'Stop Rec' : 'Start Rec'}
          </button>
          {audioUrl && (
            <>
              <audio src={audioUrl} controls className="h-9" />
              <a href={audioUrl} download={`stetho-${tab}.wav`} className="px-2 py-1 rounded border text-xs bg-white hover:bg-gray-50">
                Download
              </a>
              <button onClick={() => alert('Saved to session (demo)')} className="px-2 py-1 rounded border text-xs bg-white hover:bg-gray-50">
                Save to Session
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function WaveStrip({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    let t = 0;
    let raf: number;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = (c.width = c.clientWidth * dpr);
      const h = (c.height = 80 * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < w / dpr; x++) {
        const y = 40 + Math.sin((x + t) / 8) * (active ? 16 : 6) + Math.sin((x + t) / 1.8) * (active ? 4 : 2);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      t += active ? 2 : 0.5;
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return <canvas ref={ref} className="w-full h-20 block" />;
}

function pcm16Wav(float32: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + float32.length * 2);
  const view = new DataView(buffer);
  const write = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };

  write(0, 'RIFF');
  view.setUint32(4, 36 + float32.length * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, float32.length * 2, true);

  let offset = 44;
  for (let i = 0; i < float32.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return view;
}

/* ------------------------------
   Otoscope (demo)
--------------------------------*/
function OtoscopePane() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [rec, setRec] = useState(false);
  const chunksRef = useRef<Blob[]>([]);
  const recRef = useRef<MediaRecorder | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (!alive) return;
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch {
        /* fallback */
      }
    })();
    return () => {
      alive = false;
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {}
    };
  }, []);

  const snap = () => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const c = document.createElement('canvas');
    c.width = v.videoWidth || 1280;
    c.height = v.videoHeight || 720;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(v, 0, 0);
    const url = c.toDataURL('image/png');
    setPhotoUrl(url);
  };

  const toggleRec = () => {
    const s = streamRef.current;
    if (!s) return;
    if (!rec) {
      chunksRef.current = [];
      const mr = new MediaRecorder(s, { mimeType: 'video/webm;codecs=vp9' });
      recRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setMediaUrl(URL.createObjectURL(blob));
      };
      mr.start();
      setRec(true);
    } else {
      recRef.current?.stop();
      setRec(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-white p-2">
        <div className="relative aspect-video w-full bg-black rounded">
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover rounded" />
          {!streamRef.current && <div className="absolute inset-0 grid place-items-center text-white/70 text-sm">Camera unavailable</div>}
        </div>
        <div className="mt-2 flex gap-2">
          <button onClick={snap} className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50">
            Snap
          </button>
          <button onClick={toggleRec} className={`px-3 py-1.5 rounded ${rec ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
            {rec ? 'Stop Rec' : 'Start Rec'}
          </button>
          <button onClick={() => recRef.current?.pause()} className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50" disabled={!rec}>
            Pause
          </button>
          <button onClick={() => recRef.current?.resume()} className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50" disabled={!rec}>
            Resume
          </button>
        </div>
      </div>

      {(photoUrl || mediaUrl) && (
        <div className="rounded-xl border bg-white p-2">
          <div className="text-sm font-medium mb-2">Captured</div>
          {photoUrl && (
            <div className="mb-2">
              <img src={photoUrl} alt="Snapshot" className="rounded border" />
              <div className="mt-1 flex gap-2">
                <a href={photoUrl} download="otoscope-photo.png" className="px-2 py-1 rounded border text-xs bg-white hover:bg-gray-50">
                  Download
                </a>
                <button onClick={() => alert('Saved photo to session (demo)')} className="px-2 py-1 rounded border text-xs bg-white hover:bg-gray-50">
                  Save to Session
                </button>
              </div>
            </div>
          )}
          {mediaUrl && (
            <div>
              <video controls src={mediaUrl} className="w-full rounded border" />
              <div className="mt-1 flex gap-2">
                <a href={mediaUrl} download="otoscope-video.webm" className="px-2 py-1 rounded border text-xs bg-white hover:bg-gray-50">
                  Download
                </a>
                <button onClick={() => alert('Saved video to session (demo)')} className="px-2 py-1 rounded border text-xs bg-white hover:bg-gray-50">
                  Save to Session
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
