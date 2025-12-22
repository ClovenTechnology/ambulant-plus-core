// apps/clinician-app/app/sfu/[roomId]/page.tsx
'use client';

import type React from 'react';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Room, RoomEvent, DataPacket_Kind, ConnectionQuality } from 'livekit-client';

import { connectRoom, getOrCreateUid, mintRtcToken } from '@ambulant/rtc';

// Shared atoms
import { Field } from '@/components/shared/Field';
import { Tile } from '@/components/shared/Tile';
import { TextBlock } from '@/components/shared/TextBlock';

// Shared UI / layout bits
import { Card, Tabs, Collapse, Icon, Skeleton } from '@/components/ui';
import { CollapseBtn } from '@/components/ui/CollapseBtn';

import RecordingBanner from '@/components/RecordingBanner';

import { useAutocomplete, icdSearch } from '@/src/hooks/useAutocomplete';
import type { ICD10Hit } from '@/src/hooks/useAutocomplete';
import { useUiPrefs } from '@/hooks/useUiPrefs';

import { normalizeVitals } from '@/lib/sfu/vitals';
import AllergiesPanel, { type NewAllergyDraft } from '@/components/AllergiesPanel';

// New local modules
import VideoDock from './VideoDock';
import ErxComposer, { type ErxSummary, type SoapState } from './ErxComposer';
import InsightPane from './InsightPane';
import ReferralPanel from './ReferralPanel';
import { usePatientContext, type PatientAllergyBrief } from './patientContext';

// History sections
import CasesHistory from '@/components/cases';
import ConditionsHistory from '@/components/conditions';
import MedicationsHistory from '@/components/medications';
import AllergiesHistory from '@/components/allergies';
import OperationsHistory from '@/components/operations';
import VaccinationsHistory from '@/components/vaccinations';
import LabsHistory from '@/components/labs';

/* ---------------------------
   Small Toast system (local)
-----------------------------*/
type ToastKind = 'info' | 'success' | 'warning' | 'error';

type Toast = {
  id: string;
  title?: string;
  body: string;
  kind?: ToastKind;
  ttl?: number;
};

function ToastViewport({
  toasts,
  onClose,
}: {
  toasts: Toast[];
  onClose: (id: string) => void;
}) {
  return (
    <div className="fixed z-[1000] bottom-4 right-4 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={[
            'min-w-[240px] max-w-[360px] rounded-lg border shadow bg-white px-3 py-2',
            t.kind === 'success'
              ? 'border-emerald-200'
              : t.kind === 'warning'
              ? 'border-amber-200'
              : t.kind === 'error'
              ? 'border-rose-200'
              : 'border-gray-200',
          ].join(' ')}
          role="status"
          aria-live="polite"
        >
          {t.title && <div className="text-sm font-semibold mb-0.5">{t.title}</div>}
          <div className="text-sm text-gray-700">{t.body}</div>
          <div className="mt-2 text-right">
            <button
              className="text-xs text-gray-500 hover:text-gray-800"
              onClick={() => onClose(t.id)}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// =========================
/* Types & small utilities */
// =========================

type RightTab = 'soap' | 'erx' | 'conclusions' | 'insight' | 'history';
type SpecialistTab = 'dental' | 'physio' | 'xray' | 'ent' | 'optometry';

type Vitals = {
  ts?: number;
  hr?: number;
  spo2?: number;
  tempC?: number;
  rr?: number;
  sys?: number;
  dia?: number;
};

const ICD10_SUGGESTIONS: string[] = [
  'J20.9 — Acute bronchitis, unspecified',
  'R50.9 — Fever, unspecified',
  'R05.9 — Cough, unspecified',
  'I10 — Essential (primary) hypertension',
  'E11.9 — Type 2 diabetes mellitus without complications',
];

function num2(x?: number) {
  return typeof x === 'number' && Number.isFinite(x) ? Number(x).toFixed(2) : '—';
}
function fmtBP(sys?: number, dia?: number) {
  const ok = Number.isFinite(sys as number) && Number.isFinite(dia as number);
  return ok ? `${Math.round(sys!)} / ${Math.round(dia!)} mmHg` : '—/— mmHg';
}
function normalize(s: string) {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

// Helper: read join JWT from session (visitId/roomId variants)
function readJoinJwtFromSession(visitId: string, roomId: string) {
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
    try {
      const v = sessionStorage.getItem(k);
      if (v && v.trim()) return v.trim();
    } catch {}
  }
  return '';
}

// Dynamic DeviceSettings (with safe fallback)
function SafeDeviceSettings() {
  return <div className="text-sm text-gray-600">Safe device settings (fallback)</div>;
}
const DeviceSettings = dynamic(
  async () => {
    try {
      const m = await import('@ambulant/rtc');
      return { default: m.DeviceSettings };
    } catch {
      return { default: SafeDeviceSettings };
    }
  },
  { ssr: false }
);

// Lazy-loaded heavy panels
const SessionConclusions = dynamic(() => import('@/components/SessionConclusions'), {
  ssr: false,
});

const IntegratedIoMTs = dynamic(() => import('@/components/IntegratedIoMTs'), {
  ssr: false,
});

const SmartWearablesPanel = dynamic(() => import('@/components/SmartWearablesPanel'), {
  ssr: false,
});

const ClinicianVitalsPanel = dynamic(() => import('../../../components/ClinicianVitalsPanel'), {
  ssr: false,
  loading: () => <Skeleton height="h-40" />,
});

/* -----------------------------
   Specialist Workspaces (SFU)
   Mounted inside the SFU page
------------------------------ */
const DentalWorkspaceSFU = dynamic(() => import('../../workspaces/dental/sfu/page'), {
  ssr: false,
  loading: () => <Skeleton height="h-40" />,
});

const PhysioWorkspaceSFU = dynamic(() => import('../../workspaces/physio/sfu/page'), {
  ssr: false,
  loading: () => <Skeleton height="h-40" />,
});

const XrayWorkspaceSFU = dynamic(() => import('../../workspaces/x-ray/sfu/page'), {
  ssr: false,
  loading: () => <Skeleton height="h-40" />,
});

const EntWorkspaceSFU = dynamic(() => import('../../workspaces/ent/sfu/page'), {
  ssr: false,
  loading: () => <Skeleton height="h-40" />,
});

const OptometryWorkspaceSFU = dynamic(() => import('../../workspaces/optometry/sfu/page'), {
  ssr: false,
  loading: () => <Skeleton height="h-40" />,
});

// =========================
/* Video Docking (page-level) */
// =========================
type VideoDockMode = 'docked' | 'undocked';
type VideoDockSide = 'center' | 'left';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// =========================
/* Page Component */
// =========================

export default function SFURoomClinician({ params }: { params: { roomId: string } }) {
  const { roomId } = params;
  const searchParams = useSearchParams();
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL as string | undefined;

  // Centralized patient context (profile / meds / allergies)
  const {
    profile,
    patientProfile,
    patientProfileError,
    patientMeds,
    medsError,
    patientAllergies,
    allergiesError,
    allergiesLoading,
    allergiesFromLive,
    patientId,
    patientName,
    encounterId,
    refreshAllergies,
    setPatientAllergies,
  } = usePatientContext(roomId, searchParams);

  // Other URL params
  const clinicianIdParam = searchParams.get('clinicianId') || 'clinician-local-001';
  const clinicNameParam = searchParams.get('clinicName') || undefined;
  const clinicAddressParam = searchParams.get('clinicAddress') || undefined;

  // Fake appt meta (patient-aware; profile can override labels)
  const appt = useMemo(
    () => ({
      id: `sfu-${roomId}`,
      when: new Date().toISOString(),
      patientId,
      patientName,
      clinicianName: searchParams.get('clinicianName') || 'Demo Clinician',
      reason: searchParams.get('reason') || 'Acute bronchitis (demo)',
      status: 'In progress',
      roomId,
    }),
    [roomId, patientId, patientName, searchParams]
  );

  // Derived allergy views
  const allergySummary = useMemo(() => {
    if (!patientAllergies || patientAllergies.length === 0) return 'No allergies recorded';
    const top = patientAllergies
      .filter((a) => (a.status ?? '').toLowerCase() !== 'entered-in-error')
      .slice(0, 3)
      .map((a) => {
        const sev = a.severity ? ` (${a.severity})` : '';
        const rxn = a.reaction ? ` — ${a.reaction}` : '';
        return `${a.substance}${sev}${rxn}`;
      });
    const base = top.join(', ');
    const more =
      patientAllergies.length > top.length ? ` +${patientAllergies.length - top.length} more` : '';
    return base + more;
  }, [patientAllergies]);

  const allergyCounts = useMemo(() => {
    const list = patientAllergies || [];
    const total = list.length;
    const active = list.filter((a) => (a.status ?? '').toLowerCase() === 'active').length;
    const resolved = list.filter((a) => {
      const s = (a.status ?? '').toLowerCase();
      return s.startsWith('resolv') || s === 'inactive';
    }).length;
    return { total, active, resolved };
  }, [patientAllergies]);

  const activeMeds = useMemo(
    () => (patientMeds || []).filter((m) => (m.status || '').toLowerCase() === 'active' || !m.status),
    [patientMeds]
  );

  // ------------------ Room & connection state ------------------
  const [room, setRoom] = useState<Room | null>(null);
  const [state, setState] = useState<'disconnected' | 'connecting' | 'connected' | 'reconnecting'>(
    'disconnected'
  );
  const [quality, setQuality] = useState<ConnectionQuality | undefined>(undefined);

  // Auto-reconnect tracking
  const manualLeaveRef = useRef(false);
  const hasEverConnectedRef = useRef(false);
  const reconnectTimerRef = useRef<number | null>(null);

  // Audit helper (PII-light)
  const audit = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      try {
        const payload = {
          action,
          ts: new Date().toISOString(),
          roomId,
          patientId,
          clinicianId: clinicianIdParam,
          ...extra,
        };
        await fetch('/api/audit-log', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        // best-effort only
      }
    },
    [roomId, patientId, clinicianIdParam]
  );

  // Toaster
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pushToast = useCallback(
    (body: string, kind: ToastKind = 'info', title?: string, ttl = 4200) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const t: Toast = { id, body, kind, title, ttl };
      setToasts((prev) => [...prev, t]);
      if (ttl && typeof window !== 'undefined') {
        window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), ttl);
      }
    },
    []
  );
  const closeToast = (id: string) => setToasts((prev) => prev.filter((x) => x.id !== id));

  // Media toggles
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);

  // In-call toggles
  const [showOverlay, setShowOverlay] = useState(true);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [showVitals, setShowVitals] = useState(true);
  const [showVitalsOverlay, setShowVitalsOverlay] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [xrEnabled, setXrEnabled] = useState(false);

  // Raised hand
  const [handRaised, setHandRaised] = useState(false);
  const handTimerRef = useRef<number | null>(null);

  // UI prefs
  const { state: ui, set: setUi } = useUiPrefs();
  const { presentation, dense, leftCollapsed, rightCollapsed, chatVisible, rightTab, pip, rightPanelsOpen } =
    ui;

  // NEW: narrow video / wider notes toggle
  const [videoNarrow, setVideoNarrow] = useState(false);

  // Local collapse states
  const [leftInfoOpen, setLeftInfoOpen] = useState(true);
  const [rightIomtOpen, setRightIomtOpen] = useState(true);
  const [currentMedsOpen, setCurrentMedsOpen] = useState(true);
  const [allergiesOpen, setAllergiesOpen] = useState(true);

  // NEW: Specialist Workspaces
  const [specialistOpen, setSpecialistOpen] = useState(true);
  const [specialistTab, setSpecialistTab] = useState<SpecialistTab>('dental');

  // Refs
  const videoCardRef = useRef<HTMLDivElement | null>(null);
  const chatBoxRef = useRef<HTMLDivElement | null>(null);

  // Chat
  const [chat, setChat] = useState<{ from: string; text: string }[]>([]);
  const [msg, setMsg] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [typingNote, setTypingNote] = useState<string | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const typingThrottledRef = useRef<number>(0);

  // Vitals
  const [vitals, setVitals] = useState<Vitals>({});

  // SOAP / meds / education
  const [soap, setSoap] = useState<SoapState>({ s: '', o: '', a: '', p: '', icd10Code: undefined });
  const [currentMeds, setCurrentMeds] = useState<string>('');
  const [patientEducation, setPatientEducation] = useState<string>('');

  // eRx summary (meds + labs) from ErxComposer
  const [erxSummary, setErxSummary] = useState<ErxSummary>({ meds: [], labs: [] });

  // =========================
  // VIDEO DOCK / UNDOCK (no new routes; least invasive)
  // =========================
  const VIDEO_DOCK_KEY = useMemo(() => `sfu-video-dock-v1-${roomId}`, [roomId]);
  const [videoDockMode, setVideoDockMode] = useState<VideoDockMode>('docked');
  const [videoDockSide, setVideoDockSide] = useState<VideoDockSide>('center');

  const [floatPos, setFloatPos] = useState<{ xPct: number; yPct: number }>({ xPct: 78, yPct: 70 });
  const floatDragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startXPct: number;
    startYPct: number;
  } | null>(null);

  // Load dock prefs
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const raw = localStorage.getItem(VIDEO_DOCK_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as any;
      const mode: VideoDockMode = parsed?.mode === 'undocked' ? 'undocked' : 'docked';
      const side: VideoDockSide = parsed?.side === 'left' ? 'left' : 'center';
      const xPct = typeof parsed?.xPct === 'number' ? parsed.xPct : undefined;
      const yPct = typeof parsed?.yPct === 'number' ? parsed.yPct : undefined;

      setVideoDockMode(mode);
      setVideoDockSide(side);
      if (typeof xPct === 'number' && typeof yPct === 'number') {
        setFloatPos({ xPct: clamp(xPct, 5, 95), yPct: clamp(yPct, 8, 95) });
      }
    } catch {
      // ignore
    }
  }, [VIDEO_DOCK_KEY]);

  // Persist dock prefs
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(
        VIDEO_DOCK_KEY,
        JSON.stringify({
          mode: videoDockMode,
          side: videoDockSide,
          xPct: floatPos.xPct,
          yPct: floatPos.yPct,
        })
      );
    } catch {
      // ignore
    }
  }, [VIDEO_DOCK_KEY, videoDockMode, videoDockSide, floatPos]);

  // If entering presentation, force docked-center (fullscreen expects non-floating)
  useEffect(() => {
    if (!presentation) return;
    setVideoDockMode('docked');
    setVideoDockSide('center');
  }, [presentation]);

  const dockCenter = () => {
    setVideoDockMode('docked');
    setVideoDockSide('center');
    pushToast('Video docked (center).', 'info', 'Video Dock');
  };
  const dockLeft = () => {
    setVideoDockMode('docked');
    setVideoDockSide('left');
    pushToast('Video docked (left).', 'info', 'Video Dock');
  };
  const undockVideo = () => {
    if (presentation) return;
    setVideoDockMode('undocked');
    pushToast('Video undocked (floating).', 'info', 'Video Dock');
  };

  const startFloatDrag = (clientX: number, clientY: number) => {
    if (typeof window === 'undefined') return;
    floatDragRef.current = {
      active: true,
      startX: clientX,
      startY: clientY,
      startXPct: floatPos.xPct,
      startYPct: floatPos.yPct,
    };
  };

  const moveFloatDrag = (clientX: number, clientY: number) => {
    if (!floatDragRef.current?.active) return;
    if (typeof window === 'undefined') return;

    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

    const dx = clientX - floatDragRef.current.startX;
    const dy = clientY - floatDragRef.current.startY;

    const nextX = floatDragRef.current.startXPct + (dx / vw) * 100;
    const nextY = floatDragRef.current.startYPct + (dy / vh) * 100;

    setFloatPos({ xPct: clamp(nextX, 5, 95), yPct: clamp(nextY, 8, 95) });
  };

  const endFloatDrag = () => {
    if (floatDragRef.current) floatDragRef.current.active = false;
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onMove = (e: MouseEvent) => moveFloatDrag(e.clientX, e.clientY);
    const onUp = () => endFloatDrag();
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches?.[0];
      if (!t) return;
      moveFloatDrag(t.clientX, t.clientY);
    };
    const onTouchEnd = () => endFloatDrag();

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('mouseleave', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove as any);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('mouseleave', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floatPos.xPct, floatPos.yPct]);

  // Persist SOAP + meds per-room (fallback / notes)
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const saved = localStorage.getItem(`sfu-soap-v2-${roomId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSoap(parsed?.soap ?? parsed);
        if (parsed?.currentMeds !== undefined) setCurrentMeds(parsed.currentMeds);
        if (parsed?.patientEducation !== undefined) setPatientEducation(parsed.patientEducation);
      }
    } catch {
      // ignore
    }
  }, [roomId]);

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(
        `sfu-soap-v2-${roomId}`,
        JSON.stringify({
          soap,
          currentMeds,
          patientEducation,
        })
      );
    } catch {
      // ignore
    }
  }, [soap, currentMeds, patientEducation, roomId]);

  // Pre-populate Allergies text in SOAP from patient allergies
  useEffect(() => {
    if (!patientAllergies || patientAllergies.length === 0) return;
    setSoap((prev) => {
      if (prev.o) return prev;
      const text = patientAllergies
        .map((a) => {
          const sev = a.severity ? ` [${a.severity}]` : '';
          const rxn = a.reaction ? ` — ${a.reaction}` : '';
          return `${a.substance}${sev}${rxn}`;
        })
        .join('\n');
      return { ...prev, o: text };
    });
  }, [patientAllergies]);

  // Symptoms ICD-10 autocomplete (SOAP S)
  const icdSympAuto = useAutocomplete<ICD10Hit>(icdSearch);
  const [sympCode, setSympCode] = useState<string>('');
  const icdSympOptions = icdSympAuto.opts.map((h) => ({
    code: h.code,
    text: `${h.code} — ${h.title}`,
  }));
  const icdSympOptionsFinal = icdSympOptions.length
    ? icdSympOptions
    : ICD10_SUGGESTIONS.map((t, i) => ({ code: t.split(' ')[0] || `SUG-${i}`, text: t }));
  const [sympOpen, setSympOpen] = useState(false);
  const [sympActive, setSympActive] = useState(-1);

  // Current meds list fallback
  const currentMedsList = useMemo(
    () =>
      (currentMeds || '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    [currentMeds]
  );

  // Vitals graph lazy mount
  function useDeferredMount<T extends HTMLElement>(onceInView = true) {
    const ref = useRef<T | null>(null);
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
      if (typeof window === 'undefined') return;
      if (!ref.current) return;
      const el = ref.current;
      const io = new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting) {
            setMounted(true);
            if (onceInView) io.disconnect();
          }
        },
        { rootMargin: '200px' }
      );
      io.observe(el);
      return () => io.disconnect();
    }, [onceInView]);
    return { ref, mounted } as const;
  }
  const vitalsGraphHolder = useDeferredMount<HTMLDivElement>();

  // Poor network → toast
  const prevQualityRef = useRef<ConnectionQuality | undefined>(undefined);
  useEffect(() => {
    if (quality === ConnectionQuality.Poor && prevQualityRef.current !== ConnectionQuality.Poor) {
      pushToast('Network quality is poor. Video/audio may be degraded.', 'warning', 'Poor Network');
    }
    prevQualityRef.current = quality;
  }, [quality, pushToast]);

  // Publish data controls
  const publishControl = async (type: string, value: boolean | string) => {
    if (!room) return;
    try {
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ type, value, from: 'clinician' })),
        DataPacket_Kind.RELIABLE,
        type === 'typing' ? 'chat' : 'control'
      );
    } catch (e) {
      console.warn('[control] publish error', e);
    }
  };

  const wireRoomEvents = (r: Room) => {
    r.on(RoomEvent.ConnectionStateChanged, () => setState(r.state as any))
      .on(RoomEvent.ConnectionQualityChanged, (_p, q) => setQuality(q))
      .on(RoomEvent.DataReceived, (payload, _p, _kind, topic) => {
        try {
          const text = new TextDecoder().decode(payload);
          const data = JSON.parse(text);

          if (topic === 'vitals') {
            const v = normalizeVitals(data);
            setVitals(v);
            return;
          }

          if (topic === 'chat') {
            if (data?.type === 'typing') {
              setTypingNote('Patient is typing…');
              if (typingTimerRef.current && typeof window !== 'undefined') window.clearTimeout(typingTimerRef.current);
              if (typeof window !== 'undefined') {
                typingTimerRef.current = window.setTimeout(() => setTypingNote(null), 3000);
              }
              return;
            }
            if (typeof data?.text === 'string') {
              setChat((c) => [...c, { from: data.from || 'remote', text: data.text }]);
              const atBottom = chatBoxRef.current
                ? chatBoxRef.current.scrollHeight - chatBoxRef.current.scrollTop - chatBoxRef.current.clientHeight < 8
                : true;
              if (!chatVisible || !atBottom) setUnread((u) => u + 1);
              return;
            }
          }

          if (topic === 'control') {
            const v = data?.value;
            if (data?.type === 'overlay') {
              setShowOverlay(!!v);
              pushToast(`Patient ${v ? 'enabled' : 'disabled'} overlay.`, 'info');
            }
            if (data?.type === 'captions') {
              setCaptionsOn(!!v);
              pushToast(`Patient ${v ? 'enabled' : 'disabled'} captions.`, 'info');
            }
            if (data?.type === 'vitals') {
              setShowVitals(!!v);
              pushToast(`Patient ${v ? 'showed' : 'hid'} vitals.`, 'info');
            }
            if (data?.type === 'vitalsOverlay') {
              setShowVitalsOverlay(!!v);
              pushToast(`Patient ${v ? 'enabled' : 'disabled'} stream vitals overlay.`, 'info');
            }
            if (data?.type === 'recording') {
              setIsRecording(!!v);
              pushToast(`Patient ${v ? 'started' : 'stopped'} recording.`, v ? 'warning' : 'info');
            }
            if (data?.type === 'xr') {
              setXrEnabled(!!v);
              pushToast(`Patient ${v ? 'enabled' : 'disabled'} XR broadcast.`, 'info');
            }
            if (data?.type === 'screenshare') {
              pushToast(`Patient ${v ? 'started' : 'stopped'} screen sharing.`, 'info');
            }
            if (data?.type === 'hand') {
              if (handTimerRef.current && typeof window !== 'undefined') window.clearTimeout(handTimerRef.current);
              setHandRaised(!!v);
              if (v) {
                pushToast('Patient raised their hand.', 'info');
                if (typeof window !== 'undefined') {
                  handTimerRef.current = window.setTimeout(() => setHandRaised(false), 5000);
                }
              } else {
                pushToast('Patient lowered their hand.', 'info');
              }
            }
            if (data?.type === 'export' && typeof v === 'string') {
              pushToast(`Patient exported ${v}.`, 'success');
            }
          }
        } catch (err) {
          console.warn('[DataReceived] parse error:', err);
        }
      });
  };

  // Join/leave
  const join = async () => {
    if (!wsUrl) return pushToast('Missing NEXT_PUBLIC_LIVEKIT_URL', 'error');
    if (state === 'connecting' || state === 'connected') return;

    manualLeaveRef.current = false;
    setState('connecting');

    try {
      const uid = getOrCreateUid('ambulant_uid');
      const visitId =
        searchParams.get('visitId') || searchParams.get('visit') || searchParams.get('v') || roomId;

      // allow query token, else sessionStorage
      const direct = searchParams.get('joinToken') || searchParams.get('jt') || '';
      const joinToken = (direct || readJoinJwtFromSession(visitId, roomId)).trim();

      if (!joinToken) {
        setState('disconnected');
        pushToast('Missing join token (open via Televisit Join so it stores sessionStorage).', 'error');
        return;
      }

      const rtc = await mintRtcToken({
        roomId,
        visitId,
        uid,
        role: 'clinician',
        joinToken,
        identity: uid,
        name: uid,
      });

      const livekitUrl = (rtc as any)?.wsUrl || wsUrl;
      const token = rtc.token;

      const r = await connectRoom(livekitUrl, token, { autoSubscribe: true });
      wireRoomEvents(r);
      setRoom(r);
      setState('connected');

      await r.localParticipant.setMicrophoneEnabled(true);
      await r.localParticipant.setCameraEnabled(true);

      setMicOn(true);
      setCamOn(true);
      setQuality(r.localParticipant.connectionQuality);

      hasEverConnectedRef.current = true;
      pushToast('Connected to room.', 'success');
      audit('room.join', { netQuality: r.localParticipant.connectionQuality });
    } catch (err: any) {
      console.error('[Join] error', err);
      setState('disconnected');
      pushToast(`Failed to join room: ${err?.message || err}`, 'error');
      audit('room.join.error', { message: err?.message || String(err) });
    }
  };

  const leave = async () => {
    manualLeaveRef.current = true;
    audit('room.leave', { reason: 'manual' });
    try {
      await room?.disconnect();
    } catch {
      // ignore
    }
    setRoom(null);
    setState('disconnected');
    setMicOn(false);
    setCamOn(false);
    pushToast('Left the room.', 'info');
  };

  const toggleAndBroadcast = (
    key: 'overlay' | 'captions' | 'vitals' | 'vitalsOverlay' | 'recording' | 'xr',
    next: boolean,
    setter: (v: boolean) => void
  ) => {
    setter(next);
    publishControl(key, next);

    const label =
      key === 'overlay'
        ? 'overlay'
        : key === 'captions'
        ? 'captions'
        : key === 'vitals'
        ? 'vitals'
        : key === 'vitalsOverlay'
        ? 'vitals stream overlay'
        : key === 'recording'
        ? 'recording'
        : 'XR broadcast';

    pushToast(
      `${next ? 'Enabled' : 'Disabled'} ${label}.`,
      key === 'recording' ? (next ? 'warning' : 'info') : 'info'
    );

    if (key === 'recording') {
      audit(next ? 'recording.start' : 'recording.stop');
    }
  };

  const sendMsg = async () => {
    if (!room || !msg.trim()) return;
    setMsgSending(true);
    const text = msg.trim();
    try {
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ from: 'clinician', text })),
        DataPacket_Kind.RELIABLE,
        'chat'
      );
      setChat((c) => [...c, { from: 'me', text }]);
      setMsg('');
      if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    } catch (e) {
      console.warn('chat publish error', e);
      pushToast('Failed to send message.', 'error');
    } finally {
      setMsgSending(false);
    }
  };

  const onChatKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMsg();
      return;
    }
    const now = Date.now();
    if (now - typingThrottledRef.current > 1200) {
      typingThrottledRef.current = now;
      publishControl('typing', true);
    }
  };

  const enterPresentation = async () => {
    setUi('presentation', true);
    setVideoDockMode('docked');
    setVideoDockSide('center');

    if (videoCardRef.current && !document.fullscreenElement) {
      try {
        await (videoCardRef.current as any).requestFullscreen?.();
      } catch {
        // ignore
      }
    }
  };
  const exitPresentation = async () => {
    setUi('presentation', false);
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // ignore
      }
    }
  };

  // Mic/cam toggles
  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    room?.localParticipant.setMicrophoneEnabled(next).catch(() => {});
    pushToast(next ? 'Microphone on.' : 'Microphone off.', 'info');
  };
  const toggleCam = () => {
    const next = !camOn;
    setCamOn(next);
    room?.localParticipant.setCameraEnabled(next).catch(() => {});
    pushToast(next ? 'Camera on.' : 'Camera off.', 'info');
  };

  // =========================
  // Layout grid calc (supports dock-left and undocked)
  // =========================
  const videoIsDocked = videoDockMode === 'docked' || presentation;
  const videoIsUndocked = !presentation && videoDockMode === 'undocked';
  const dockToLeft = videoIsDocked && videoDockSide === 'left' && !presentation;

  const showLeftInfo = !presentation && !leftCollapsed;
  const showRightPane = !presentation && !rightCollapsed;

  // If dock-left, we keep a left column even when leftCollapsed (video column still exists).
  const showLeftColumn = !presentation && (showLeftInfo || dockToLeft);

  // Column template
  const gridCols = presentation
    ? 'grid-cols-1'
    : showLeftColumn && showRightPane
    ? dockToLeft
      ? // left(video+optional info), main(workspaces), right(notes)
        'lg:grid-cols-[1.05fr_2.15fr_1.2fr]'
      : // original-ish
        'lg:grid-cols-[1.2fr_2fr_1.2fr]'
    : showLeftColumn && !showRightPane
    ? dockToLeft
      ? // left(video), main(workspaces) -> maximize workspace
        'lg:grid-cols-[1.0fr_3.0fr]'
      : // left(info), main(video+workspaces)
      videoNarrow
      ? 'lg:grid-cols-[0.9fr_2.6fr]'
      : 'lg:grid-cols-[1.2fr_2fr]'
    : !showLeftColumn && showRightPane
    ? // main + right
      videoNarrow
      ? 'lg:grid-cols-[2.6fr_0.9fr]'
      : 'lg:grid-cols-[2fr_1.2fr]'
    : 'grid-cols-1';

  // Auto-reconnect on unexpected drop
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (state !== 'disconnected') return;
    if (!hasEverConnectedRef.current) return;
    if (manualLeaveRef.current) return;

    if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = window.setTimeout(() => {
      setState('reconnecting');
      join();
    }, 5000);

    return () => {
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Keyboard shortcuts + help modal
  const [helpOpen, setHelpOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea';

      if (e.key === 'Escape') {
        if (helpOpen) {
          setHelpOpen(false);
          e.preventDefault();
        }
        return;
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
          setHelpOpen((v) => !v);
          e.preventDefault();
          return;
        }
        if (isTyping) return;
        const lower = e.key.toLowerCase();
        if (lower === 'm') {
          toggleMic();
          e.preventDefault();
        }
        if (lower === 'v') {
          toggleCam();
          e.preventDefault();
        }
        if (lower === 'c') {
          toggleAndBroadcast('captions', !captionsOn, setCaptionsOn);
          e.preventDefault();
        }
        if (lower === 'o') {
          toggleAndBroadcast('overlay', !showOverlay, setShowOverlay);
          e.preventDefault();
        }
        if (lower === 'h') {
          toggleAndBroadcast('vitals', !showVitals, setShowVitals);
          e.preventDefault();
        }
        if (lower === 's') {
          toggleAndBroadcast('vitalsOverlay', !showVitalsOverlay, setShowVitalsOverlay);
          e.preventDefault();
        }
        if (lower === 'r') {
          toggleAndBroadcast('recording', !isRecording, setIsRecording);
          e.preventDefault();
        }
        if (lower === 'x') {
          toggleAndBroadcast('xr', !xrEnabled, setXrEnabled);
          e.preventDefault();
        }
        if (lower === 'f') {
          presentation ? exitPresentation() : enterPresentation();
          e.preventDefault();
        }
        if (lower === 'l') {
          setUi('leftCollapsed', !leftCollapsed);
          e.preventDefault();
        }
        if (lower === 'k') {
          setUi('rightCollapsed', !rightCollapsed);
          e.preventDefault();
        }
      }
    };
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    captionsOn,
    showOverlay,
    showVitals,
    showVitalsOverlay,
    isRecording,
    xrEnabled,
    presentation,
    leftCollapsed,
    rightCollapsed,
    helpOpen,
    setUi,
  ]);

  // =========================
  // Helpers for allergies (refresh / export / status / create)
  // =========================

  const handleRefreshAllergies = async () => {
    try {
      await refreshAllergies();
      pushToast('Allergies refreshed.', 'success');
    } catch {
      pushToast('Failed to refresh allergies.', 'error');
    }
  };

  const handleExportAllergies = () => {
    publishControl('export', 'allergies');
    pushToast('Allergies exported (demo).', 'success');
  };

  const handleMarkAllergyStatus = async (id: string, status: 'Active' | 'Resolved') => {
    try {
      const res = await fetch(`/api/allergies/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json().catch(() => null);
      setPatientAllergies((prev) =>
        (prev || []).map((a) =>
          a.id === id
            ? {
                ...a,
                status: updated?.status ?? status,
                severity: updated?.severity ?? a.severity,
                reaction: updated?.reaction ?? a.reaction,
              }
            : a
        )
      );
      pushToast(`Allergy marked ${status.toLowerCase()}.`, 'success');
    } catch (err) {
      console.error('[handleMarkAllergyStatus] failed', err);
      pushToast('Failed to update allergy status.', 'error');
    }
  };

  const handleCreateAllergy = async (draft: NewAllergyDraft) => {
    try {
      const payload = {
        patientId: profile.id,
        substance: draft.substance.trim(),
        reaction: draft.reaction.trim() || null,
        severity: draft.severity,
        status: draft.status || 'Active',
      };

      const res = await fetch('/api/allergies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json().catch(() => null);

      const newBrief: PatientAllergyBrief = {
        id: String(created?.id ?? created?.allergyId ?? `alg-${Date.now()}`),
        substance: created?.substance ?? payload.substance,
        reaction: created?.reaction ?? payload.reaction,
        severity: created?.severity ?? payload.severity,
        criticality: created?.criticality ?? null,
        status: created?.status ?? payload.status,
        recordedAt: created?.recordedAt ?? new Date().toISOString(),
      };

      setPatientAllergies((prev) => [...(prev || []), newBrief]);
      pushToast('Allergy added.', 'success');
    } catch (err) {
      console.error('[handleCreateAllergy] failed', err);
      pushToast('Failed to add allergy.', 'error');
      throw err;
    }
  };

  // -------------------------
  // Encounter summary (used in referral email/SMS)
  // -------------------------
  const encounterSummary = useMemo(() => {
    const lines: string[] = [];
    lines.push(`Reason for visit: ${appt.reason || '—'}`);
    if (soap.s) lines.push(`Subjective / Symptoms:\n${soap.s}`);
    if (soap.a) lines.push(`Assessment:\n${soap.a}`);
    if (soap.p) lines.push(`Plan / Treatment:\n${soap.p}`);
    if (patientEducation) lines.push(`Patient Education:\n${patientEducation}`);

    const medsOrdered = erxSummary.meds;
    if (medsOrdered.length) {
      lines.push(
        'Medications prescribed:\n' +
          medsOrdered
            .map((r) => {
              const parts = [r.drug, r.dose, r.route, r.freq, r.duration].filter(Boolean).join(' · ');
              return `• ${parts}`;
            })
            .join('\n')
      );
    }

    const labsOrdered = erxSummary.labs;
    if (labsOrdered.length) {
      lines.push(
        'Lab tests ordered:\n' +
          labsOrdered
            .map((l) => {
              const parts = [l.test, l.priority, l.specimen, l.icd].filter(Boolean).join(' · ');
              return `• ${parts}`;
            })
            .join('\n')
      );
    }

    if (patientAllergies && patientAllergies.length) {
      const algs = patientAllergies
        .filter((a) => (a.status ?? '').toLowerCase() !== 'entered-in-error')
        .map((a) => {
          const sev = a.severity ? ` [${a.severity}]` : '';
          const rxn = a.reaction ? ` — ${a.reaction}` : '';
          return `• ${a.substance}${sev}${rxn}`;
        });
      lines.push('Recorded allergies:\n' + algs.join('\n'));
    }

    return lines.join('\n\n');
  }, [appt.reason, soap.s, soap.a, soap.p, patientEducation, erxSummary, patientAllergies]);

  // -------------------------
  // End Session -> callback from SessionConclusions
  // -------------------------
  const handleSessionEnd = useCallback(() => {
    if (!encounterId) {
      pushToast(
        'Session ended. Draft kept locally, but no encounterId was provided so the server was not updated.',
        'info',
        'Session ended'
      );
      audit('encounter.end.local-only', {});
      return;
    }

    pushToast('Session ended and encounter marked complete.', 'success', 'Encounter closed');
    audit('encounter.end', { encounterId });
  }, [encounterId, audit, pushToast]);

  // =========================
  // Render helpers
  // =========================
  const VideoDockNode = (
    <VideoDock
      room={room}
      vitals={vitals}
      dense={dense}
      presentation={presentation}
      patientName={profile.name}
      micOn={micOn}
      camOn={camOn}
      showOverlay={showOverlay}
      showVitals={showVitals}
      showVitalsOverlay={showVitalsOverlay}
      captionsOn={captionsOn}
      isRecording={isRecording}
      xrEnabled={xrEnabled}
      pip={pip}
      onToggleMic={toggleMic}
      onToggleCam={toggleCam}
      onToggleOverlay={(next) => toggleAndBroadcast('overlay', next, setShowOverlay)}
      onToggleVitals={(next) => toggleAndBroadcast('vitals', next, setShowVitals)}
      onToggleVitalsOverlay={(next) => toggleAndBroadcast('vitalsOverlay', next, setShowVitalsOverlay)}
      onToggleCaptions={(next) => toggleAndBroadcast('captions', next, setCaptionsOn)}
      onToggleRecording={(next) => toggleAndBroadcast('recording', next, setIsRecording)}
      onToggleXr={(next) => toggleAndBroadcast('xr', next, setXrEnabled)}
      onEnterPresentation={enterPresentation}
      onExitPresentation={exitPresentation}
    />
  );

  // =========================
  // Render
  // =========================

  return (
    <div className="min-h-screen bg-gray-50" data-density={dense ? 'compact' : 'comfort'}>
      <header className="sticky top-0 z-40 flex items-center justify-between p-4 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">SFU Televisit — Room {roomId}</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Status / QoS pills */}
          <span className="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-full border">
            <span
              className={`h-2 w-2 rounded-full ${
                state === 'connected'
                  ? 'bg-emerald-500'
                  : state === 'connecting'
                  ? 'bg-amber-500'
                  : 'bg-slate-400'
              }`}
            />
            {state}
          </span>

          {quality !== undefined && (
            <span
              className={`text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                quality === ConnectionQuality.Poor
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              Net: {ConnectionQuality[quality]}
            </span>
          )}

          {/* Video dock controls */}
          {!presentation && (
            <>
              {videoIsUndocked ? (
                <>
                  <button
                    onClick={dockCenter}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-xs"
                    title="Dock video (center)"
                  >
                    <Icon name="collapse" />
                    Dock
                  </button>
                  <button
                    onClick={dockLeft}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-xs"
                    title="Dock video to left column"
                  >
                    <Icon name="collapse" />
                    Dock Left
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={undockVideo}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-xs"
                    title="Undock video (floating)"
                  >
                    <Icon name="expand" />
                    Undock
                  </button>

                  <button
                    onClick={() => (videoDockSide === 'left' ? dockCenter() : dockLeft())}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-xs"
                    title={videoDockSide === 'left' ? 'Dock video to center column' : 'Dock video to left column'}
                  >
                    <Icon name={videoDockSide === 'left' ? 'expand' : 'collapse'} />
                    {videoDockSide === 'left' ? 'Dock Center' : 'Dock Left'}
                  </button>
                </>
              )}
            </>
          )}

          <button
            onClick={() => setUi('leftCollapsed', !leftCollapsed)}
            aria-pressed={leftCollapsed}
            aria-label={leftCollapsed ? 'Show left pane' : 'Hide left pane'}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-xs"
            title={leftCollapsed ? 'Show left pane (L)' : 'Hide left pane (L)'}
          >
            <Icon name={leftCollapsed ? 'expand' : 'collapse'} />
            {leftCollapsed ? 'Show Left' : 'Hide Left'}
          </button>

          <button
            onClick={() => setUi('dense', !dense)}
            aria-pressed={dense}
            aria-label={dense ? 'Use comfortable density' : 'Use compact density'}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-xs"
            title="Toggle density"
          >
            {dense ? 'Comfort' : 'Compact'}
          </button>

          {/* Wider notes / narrow video toggle */}
          <button
            onClick={() => setVideoNarrow((v) => !v)}
            aria-pressed={videoNarrow}
            aria-label={videoNarrow ? 'Use normal layout' : 'Narrow side column(s)'}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-xs"
            title={videoNarrow ? 'Normal columns' : 'Wider center'}
          >
            <Icon name={videoNarrow ? 'collapse' : 'expand'} />
            {videoNarrow ? 'Normal Layout' : 'Wider Center'}
          </button>

          <button
            onClick={() => (presentation ? exitPresentation() : enterPresentation())}
            aria-pressed={presentation}
            aria-label={presentation ? 'Exit full screen mode' : 'Enter full screen mode'}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-xs"
            title={presentation ? 'Exit Full Screen (F)' : 'Enter Full Screen (F)'}
          >
            <Icon name={presentation ? 'collapse' : 'expand'} />
            <span className="text-xs">{presentation ? 'Exit Full Screen' : 'Full Screen'}</span>
          </button>

          <button
            onClick={() => setUi('rightCollapsed', !rightCollapsed)}
            aria-pressed={rightCollapsed}
            aria-label={rightCollapsed ? 'Show right pane' : 'Hide right pane'}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-xs"
            title={rightCollapsed ? 'Show right pane (R)' : 'Hide right pane (R)'}
          >
            <Icon name={rightCollapsed ? 'expand' : 'collapse'} />
            {rightCollapsed ? 'Show Right' : 'Hide Right'}
          </button>

          <Link href="/appointments" className="text-sm text-blue-600 hover:underline">
            Back
          </Link>

          {state !== 'connected' ? (
            <button
              onClick={join}
              className="px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 shadow-sm hover:bg-blue-100 text-sm"
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
        </div>
      </header>

      {state === 'reconnecting' && (
        <div className="sticky top-14 z-40 mx-4 my-2 rounded border bg-amber-50 text-amber-900 px-3 py-2 flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
          Reconnecting…
        </div>
      )}

      <RecordingBanner
        active={isRecording}
        onDismiss={() => {
          setIsRecording(false);
          publishControl('recording', false);
        }}
      />

      <div
        className={`transition-all duration-300 container mx-auto ${dense ? 'px-3 py-3' : 'px-4 py-6'} ${
          presentation ? 'max-w-[1400px]' : ''
        }`}
      >
        <div className={`grid md:gap-6 gap-3 transition-[grid-template-columns] duration-300 ${gridCols}`}>
          {/* LEFT COLUMN */}
          {!presentation && showLeftColumn && (
            <div className="flex flex-col space-y-4">
              {/* If dock-left, video lives here (fixed column; never overlays content) */}
              {!videoIsUndocked && dockToLeft && (
                <div className="sticky top-4 z-20" ref={videoCardRef}>
                  {VideoDockNode}
                </div>
              )}

              {/* Left info content remains optional */}
              {!presentation && !leftCollapsed && (
                <>
                  <Card
                    title="Session Information"
                    dense={dense}
                    gradient
                    toolbar={<CollapseBtn open={leftInfoOpen} onClick={() => setLeftInfoOpen((v) => !v)} />}
                  >
                    <Collapse open={leftInfoOpen}>
                      {(patientProfileError || medsError || allergiesError) && (
                        <div className="mb-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 space-y-0.5">
                          {patientProfileError && <div>{patientProfileError}</div>}
                          {medsError && <div>{medsError}</div>}
                          {allergiesError && <div>{allergiesError}</div>}
                        </div>
                      )}

                      <Field label="Patient Name" value={profile.name} />
                      <Field label="Patient ID" value={profile.id} />
                      {profile.mrn && <Field label="MRN" value={profile.mrn} />}

                      <Field
                        label="Demographics"
                        value={
                          [
                            profile.dob ? `DOB: ${new Date(profile.dob).toLocaleDateString()}` : null,
                            profile.gender ? `Sex: ${profile.gender}` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ') || '—'
                        }
                      />

                      <Field
                        label="Allergies"
                        value={
                          !patientAllergies || patientAllergies.length === 0
                            ? 'No allergies recorded'
                            : `${allergySummary} · ${allergyCounts.total} total, ${allergyCounts.active} active, ${allergyCounts.resolved} resolved`
                        }
                      />

                      <Field
                        label="Active Medications"
                        value={activeMeds.length ? `${activeMeds.length} active on file` : 'None recorded'}
                      />

                      <Field label="Case Name" value={appt.reason} bold />
                      <Field label="Session ID" value={<span className="font-mono">{appt.id}</span>} />
                      <Field label="Session Date" value={new Date(appt.when).toLocaleString()} />
                      <Field label="Clinician" value={appt.clinicianName} />
                      <Field label="Status" value={appt.status} />

                      {(profile.phone || profile.email) && (
                        <Field
                          label="Contact"
                          value={[
                            profile.phone ? `Tel: ${profile.phone}` : null,
                            profile.email ? `Email: ${profile.email}` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        />
                      )}
                    </Collapse>
                  </Card>

                  {showVitals && (
                    <Card
                      title="Live Monitor (via SFU)"
                      dense={dense}
                      gradient
                      toolbar={<CollapseBtn open={true} onClick={() => setShowVitals((v) => !v)} />}
                    >
                      <Collapse open={true}>
                        <div
                          className={`grid grid-cols-2 ${dense ? 'gap-2' : 'gap-3'}`}
                          role="group"
                          aria-label="Live vital signs from connected devices"
                        >
                          <Tile label="HR" value={`${num2(vitals.hr)} bpm`} />
                          <Tile label="SpO₂" value={`${num2(vitals.spo2)} %`} />
                          <Tile label="Temp" value={`${num2(vitals.tempC)} °C`} />
                          <Tile label="RR" value={`${num2(vitals.rr)} /min`} />
                          <Tile label="BP" value={fmtBP(vitals.sys, vitals.dia)} />
                        </div>
                      </Collapse>
                    </Card>
                  )}

                  <Card title="Integrated IoMTs" dense={dense} gradient>
                    <IntegratedIoMTs roomId={roomId} patientId={profile.id} dense={dense} defaultOpen />
                  </Card>

                  <SmartWearablesPanel roomId={roomId} dense={dense} defaultOpen patientId={profile.id} />
                </>
              )}
            </div>
          )}

          {/* MAIN COLUMN (Video in center if docked-center; Specialist Workspaces always here) */}
          <div className="flex flex-col space-y-4">
            {/* Docked-center video lives here (fixed split layout; never overlays content) */}
            {!presentation && !videoIsUndocked && !dockToLeft && (
              <div className="sticky top-4 z-20" ref={videoCardRef}>
                {VideoDockNode}
              </div>
            )}

            {/* Presentation always shows video in-flow */}
            {presentation && (
              <div className="sticky top-4 z-20" ref={videoCardRef}>
                {VideoDockNode}
              </div>
            )}

            {/* Specialist Workspaces pane */}
            {!presentation && (
              <Card
                title="Specialist Workspaces"
                dense={dense}
                gradient
                toolbar={<CollapseBtn open={specialistOpen} onClick={() => setSpecialistOpen((v) => !v)} />}
              >
                <Collapse open={specialistOpen}>
                  <div className={dense ? 'p-2' : 'p-3'}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs text-gray-500">
                          One SFU session, multiple specialty stations. Same patient + encounter context.
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] px-2 py-0.5 rounded-full border bg-white text-gray-700">
                            Room: <span className="font-mono">{roomId}</span>
                          </span>
                          {encounterId ? (
                            <span className="text-[11px] px-2 py-0.5 rounded-full border bg-white text-gray-700">
                              Encounter: <span className="font-mono">{encounterId}</span>
                            </span>
                          ) : (
                            <span className="text-[11px] px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-800">
                              No encounterId in URL (workspace may run in demo mode)
                            </span>
                          )}
                          <span className="text-[11px] px-2 py-0.5 rounded-full border bg-white text-gray-700">
                            Patient: <span className="font-medium">{profile.name}</span>
                          </span>
                          {videoIsUndocked && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full border border-sky-200 bg-sky-50 text-sky-800">
                              Video: Floating (undocked)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
                          onClick={() => {
                            pushToast(
                              'Specialist workspaces are mounted inside this SFU session. Use the tabs to switch stations.',
                              'info',
                              'Specialist Workspaces'
                            );
                          }}
                          title="What is this?"
                        >
                          Help
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 rounded border bg-white shadow-sm">
                      <div className="flex items-center justify-between p-1">
                        <Tabs<SpecialistTab>
                          active={specialistTab}
                          onChange={(k) => setSpecialistTab(k)}
                          items={[
                            { key: 'dental', label: 'Dental' },
                            { key: 'physio', label: 'Physio' },
                            { key: 'xray', label: 'X-Ray' },
                            { key: 'ent', label: 'ENT' },
                            { key: 'optometry', label: 'Optometry' },
                          ]}
                        />
                      </div>
                      <div className={dense ? 'p-2' : 'p-3'}>
                        {specialistTab === 'dental' && <DentalWorkspaceSFU />}
                        {specialistTab === 'physio' && <PhysioWorkspaceSFU />}
                        {specialistTab === 'xray' && <XrayWorkspaceSFU />}
                        {specialistTab === 'ent' && <EntWorkspaceSFU />}
                        {specialistTab === 'optometry' && <OptometryWorkspaceSFU />}
                      </div>
                    </div>
                  </div>
                </Collapse>
              </Card>
            )}
          </div>

          {/* RIGHT COLUMN */}
          {!presentation && !rightCollapsed && (
            <div className="flex flex-col space-y-4">
              <div className="px-2">
                <div className="text-sm font-semibold text-gray-800">SOAP, Insights, History</div>
              </div>

              <div className="shadow-sm bg-white rounded">
                <div className="flex items-center justify-between p-1">
                  <Tabs<RightTab>
                    active={rightTab}
                    onChange={(key) => setUi('rightTab', key)}
                    items={[
                      { key: 'soap', label: 'Sub' },
                      { key: 'erx', label: 'eRx' },
                      { key: 'conclusions', label: 'Conclusions' },
                      { key: 'insight', label: 'Insight' },
                      { key: 'history', label: 'History' },
                    ]}
                  />
                  <button
                    className="ml-2 px-2 py-1 text-xs border rounded"
                    onClick={() => setUi('rightPanelsOpen', !rightPanelsOpen)}
                    aria-pressed={rightPanelsOpen}
                    aria-label={rightPanelsOpen ? 'Collapse right panels' : 'Expand right panels'}
                    title={rightPanelsOpen ? 'Collapse' : 'Expand'}
                  >
                    {rightPanelsOpen ? 'Collapse' : 'Expand'}
                  </button>
                </div>
              </div>

              <Collapse open={rightPanelsOpen}>
                <>
                  {rightTab === 'soap' && (
                    <Card title="Clerk Desk" dense={dense} gradient>
                      <div className="text-xs text-gray-500 mb-2">
                        Quickly capture symptoms, allergies, HPI and codes. Free text always allowed.
                      </div>

                      {/* Current Medication */}
                      <div className="mb-2 border rounded bg-white">
                        <div className="flex items-center justify-between px-2 py-1">
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-gray-700">Current Medication</span>
                            <span className="text-[11px] text-gray-500">From patient profile</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {medsError && (
                              <span className="text-[10px] text-amber-700 border border-amber-200 bg-amber-50 rounded-full px-2 py-0.5">
                                Demo
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setCurrentMedsOpen((v) => !v)}
                              className="text-[11px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100"
                              aria-expanded={currentMedsOpen}
                            >
                              {currentMedsOpen ? 'Hide' : 'Show'}
                              <Icon name={currentMedsOpen ? 'collapse' : 'expand'} />
                            </button>
                          </div>
                        </div>
                        <Collapse open={currentMedsOpen}>
                          <div className="border-t px-3 py-2">
                            {activeMeds.length > 0 ? (
                              <ul className="list-disc pl-5 text-sm text-gray-800 space-y-0.5">
                                {activeMeds.map((m) => (
                                  <li key={m.id}>
                                    <span className="font-medium">{m.name}</span>
                                    {m.dose && <span className="text-gray-700"> · {m.dose}</span>}
                                    {m.frequency && <span className="text-gray-700"> · {m.frequency}</span>}
                                    {m.route && <span className="text-gray-500"> · {m.route}</span>}
                                    {m.status && m.status.toLowerCase() !== 'active' && (
                                      <span className="ml-1 text-[11px] text-gray-500">({m.status})</span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            ) : currentMedsList.length === 0 ? (
                              <div className="text-sm text-gray-600 italic">No medications recorded yet.</div>
                            ) : (
                              <ul className="list-disc pl-5 text-sm text-gray-800">
                                {currentMedsList.map((m, i) => (
                                  <li key={`${m}-${i}`}>{m}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </Collapse>
                      </div>

                      {/* Allergies structured panel */}
                      <div className="mt-2 border rounded bg-white">
                        <div className="flex items-center justify-between px-2 py-1">
                          <div className="text-xs font-medium text-gray-700">Allergies</div>
                          <div className="flex items-center gap-2">
                            {allergiesFromLive ? (
                              <span className="text-[10px] text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-full px-2 py-0.5">
                                Live
                              </span>
                            ) : allergiesError ? (
                              <span className="text-[10px] text-amber-700 border border-amber-200 bg-amber-50 rounded-full px-2 py-0.5">
                                Demo
                              </span>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => setAllergiesOpen((v) => !v)}
                              className="text-[11px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100"
                              aria-expanded={allergiesOpen}
                            >
                              {allergiesOpen ? 'Hide' : 'Show'}
                              <Icon name={allergiesOpen ? 'collapse' : 'expand'} />
                            </button>
                          </div>
                        </div>
                        <Collapse open={allergiesOpen}>
                          <div className="border-t px-2 py-2">
                            <AllergiesPanel
                              allergies={patientAllergies || []}
                              loading={allergiesLoading}
                              error={allergiesError ?? undefined}
                              onRefresh={handleRefreshAllergies}
                              onExport={handleExportAllergies}
                              onMarkStatus={handleMarkAllergyStatus}
                              onCreate={handleCreateAllergy}
                            />
                          </div>
                        </Collapse>
                      </div>

                      {/* Symptoms ICD-10 combobox */}
                      <div className="mt-3 space-y-1">
                        <div className="text-xs text-gray-500">Symptoms (ICD-10 autocomplete; free text allowed)</div>
                        <div className="relative">
                          <input
                            className="w-full border rounded px-2 py-1 text-sm"
                            role="combobox"
                            aria-expanded={sympOpen}
                            aria-controls="icd10-symptoms-listbox"
                            aria-autocomplete="list"
                            value={icdSympAuto.q || soap.s}
                            onChange={(e) => {
                              const v = e.target.value;
                              icdSympAuto.setQ(v);
                              setSympCode('');
                              setSympOpen(true);
                              setSympActive(-1);
                              setSoap((s) => ({ ...s, s: v }));
                            }}
                            onFocus={(e) => {
                              const v = e.currentTarget.value;
                              if (v) icdSympAuto.setQ(v);
                              if (icdSympOptionsFinal.length) setSympOpen(true);
                            }}
                            onKeyDown={(e) => {
                              if (!icdSympOptionsFinal.length) return;
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setSympOpen(true);
                                setSympActive((a) => {
                                  const next = a + 1;
                                  return next >= icdSympOptionsFinal.length ? icdSympOptionsFinal.length - 1 : next;
                                });
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setSympOpen(true);
                                setSympActive((a) => (a <= 0 ? 0 : a - 1));
                              } else if (e.key === 'Enter') {
                                if (sympOpen && sympActive >= 0 && sympActive < icdSympOptionsFinal.length) {
                                  e.preventDefault();
                                  const o = icdSympOptionsFinal[sympActive];
                                  icdSympAuto.setQ(o.text);
                                  setSoap((s) => ({ ...s, s: o.text, icd10Code: o.code }));
                                  setSympCode(o.code);
                                  setSympOpen(false);
                                }
                              } else if (e.key === 'Escape') {
                                setSympOpen(false);
                              }
                            }}
                            onBlur={(e) => {
                              setTimeout(() => setSympOpen(false), 120);
                              const v = e.currentTarget.value.trim();
                              if (!v) return;
                              const direct = v.split(/\s+/)[0];
                              const norm = v.toLowerCase();

                              const opt =
                                icdSympOptionsFinal.find((o) => o.code.toLowerCase() === norm) ||
                                icdSympOptionsFinal.find((o) => o.code.toLowerCase() === direct.toLowerCase()) ||
                                icdSympOptionsFinal.find(
                                  (o) =>
                                    o.text.toLowerCase().startsWith(norm) || o.text.toLowerCase().includes(norm)
                                );

                              if (opt) {
                                setSympCode(opt.code);
                                setSoap((s) => ({ ...s, icd10Code: opt.code }));
                              }
                            }}
                            placeholder="Type to search ICD-10 (free text allowed)"
                            aria-label="Symptoms"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                          />

                          {sympOpen && icdSympOptionsFinal.length > 0 && (
                            <ul
                              id="icd10-symptoms-listbox"
                              role="listbox"
                              className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded border bg-white shadow text-sm"
                            >
                              {icdSympOptionsFinal.map((o, idx) => (
                                <li
                                  key={o.code + idx}
                                  id={`icd10-symp-${idx}`}
                                  role="option"
                                  aria-selected={idx === sympActive}
                                  className={`px-2 py-1 cursor-pointer ${
                                    idx === sympActive ? 'bg-blue-50' : 'hover:bg-gray-50'
                                  }`}
                                  onMouseDown={(ev) => ev.preventDefault()}
                                  onClick={() => {
                                    icdSympAuto.setQ(o.text);
                                    setSoap((s) => ({ ...s, s: o.text, icd10Code: o.code }));
                                    setSympCode(o.code);
                                    setSympOpen(false);
                                  }}
                                >
                                  <span className="font-mono text-xs mr-1">{o.code}</span>
                                  <span>{o.text.replace(/^([A-Z0-9.]+)\s+—\s*/, '')}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {sympCode && (
                          <div className="text-[11px] text-gray-600">
                            Selected ICD-10 code: <span className="font-mono">{sympCode}</span>
                          </div>
                        )}
                      </div>

                      <TextBlock
                        label="Presenting Complaints"
                        value={soap.a}
                        onChange={(v) => setSoap({ ...soap, a: v })}
                      />
                      <TextBlock
                        label="History of Present Illness (HPI)"
                        value={soap.p}
                        onChange={(v) => setSoap({ ...soap, p: v })}
                        multiline
                      />
                      <TextBlock
                        label="Patient Education"
                        value={patientEducation}
                        onChange={setPatientEducation}
                        multiline
                      />
                    </Card>
                  )}

                  {rightTab === 'erx' && (
                    <ErxComposer
                      dense={dense}
                      soap={soap}
                      profile={profile}
                      appt={appt}
                      encounterId={encounterId}
                      patientId={patientId}
                      clinicianId={clinicianIdParam}
                      patientAllergies={patientAllergies}
                      allergiesFromLive={allergiesFromLive}
                      icd10Suggestions={ICD10_SUGGESTIONS}
                      onToast={pushToast}
                      onAudit={audit}
                      onSummaryChange={setErxSummary}
                    />
                  )}

                  {rightTab === 'conclusions' && (
                    <Card title="Conclusions" dense={dense} gradient>
                      <div className="text-xs text-gray-500 mb-2">
                        Summarize and finalize. You can also prepare referrals below.
                      </div>
                      <SessionConclusions
                        clinicianId={clinicianIdParam}
                        clinicianName={appt.clinicianName}
                        encounterId={encounterId || ''}
                        apptStartISO={appt.when}
                        referralSlot={
                          <ReferralPanel
                            encounterId={encounterId || undefined}
                            patient={{ id: profile.id, name: profile.name }}
                            clinician={{ id: clinicianIdParam, name: appt.clinicianName }}
                            summary={encounterSummary}
                            onNotify={(body, kind, title) => pushToast(body, kind, title)}
                            onAudit={audit}
                          />
                        }
                        patientId={profile.id}
                        patientName={profile.name}
                        clinicName={clinicNameParam}
                        clinicLogoUrl="/logo.png"
                        clinicAddress={clinicAddressParam}
                        onEnd={handleSessionEnd}
                      />
                    </Card>
                  )}

                  {rightTab === 'insight' && (
                    <InsightPane
                      dense={dense}
                      soap={soap}
                      patientEducation={patientEducation}
                      profile={profile}
                      appt={{ reason: appt.reason, clinicianName: appt.clinicianName, patientName: appt.patientName }}
                      patientAllergies={patientAllergies}
                      onChangeSoap={(next) => setSoap(next)}
                      onChangePatientEducation={setPatientEducation}
                      onToast={pushToast}
                      onShowSoapTab={() => setUi('rightTab', 'soap')}
                    />
                  )}

                  {rightTab === 'history' && (
                    <Card title="History" dense={dense} gradient>
                      <div className="text-xs text-gray-500 mb-2">
                        Longitudinal view of the patient: cases, chronic conditions, medications, allergies, labs,
                        vaccinations and procedures.
                      </div>
                      <div className="space-y-3">
                        <CasesHistory patientId={profile.id} defaultOpen />
                        <ConditionsHistory patientId={profile.id} defaultOpen />
                        <MedicationsHistory patientId={profile.id} defaultOpen />
                        <AllergiesHistory patientId={profile.id} />
                        <LabsHistory patientId={profile.id} />
                        <OperationsHistory patientId={profile.id} />
                        <VaccinationsHistory patientId={profile.id} />
                      </div>
                    </Card>
                  )}
                </>
              </Collapse>

              {/* Room Chat */}
              <Card
                title={
                  <span>
                    Room Chat{' '}
                    {unread > 0 ? (
                      <span className="ml-1 inline-flex items-center justify-center text-[11px] leading-none px-1.5 py-0.5 rounded-full bg-red-600 text-white">
                        {unread}
                      </span>
                    ) : null}
                  </span>
                }
                dense={dense}
                gradient
                toolbar={
                  <CollapseBtn
                    open={chatVisible}
                    onClick={() => {
                      setUi('chatVisible', !chatVisible);
                      if (!chatVisible) setUnread(0);
                    }}
                  />
                }
              >
                <Collapse open={chatVisible}>
                  <div
                    ref={chatBoxRef}
                    className="h-40 overflow-auto border rounded p-2 text-sm bg-white"
                    role="log"
                    aria-live="polite"
                    aria-relevant="additions"
                    onFocus={() => setUnread(0)}
                  >
                    {chat.map((c, i) => (
                      <div key={i} className="mb-1 flex items-baseline gap-2">
                        <span className="text-gray-500 font-mono">{c.from}:</span>
                        <span>{c.text}</span>
                        <span className="ml-auto text-[11px] text-gray-400">{new Date().toLocaleTimeString()}</span>
                      </div>
                    ))}
                    {chat.length === 0 && (
                      <div className="text-gray-400 text-sm italic flex items-center gap-2">
                        <span aria-hidden>💬</span>
                        No messages yet
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex gap-2 items-start">
                    <textarea
                      value={msg}
                      onChange={(e) => setMsg(e.target.value)}
                      onKeyDown={onChatKey}
                      rows={2}
                      className="border rounded px-2 py-1 text-sm flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 resize-y"
                      placeholder={
                        state === 'connected'
                          ? 'Type message… (Enter to send, Shift+Enter for newline)'
                          : 'Join the room to send messages'
                      }
                      aria-label="Type chat message"
                      disabled={state !== 'connected'}
                    />
                    <button
                      onClick={() => {
                        if (!msgSending) sendMsg();
                      }}
                      disabled={msgSending || state !== 'connected' || !msg.trim()}
                      title={state === 'connected' ? 'Send message' : 'Join to send messages'}
                      className="px-3 py-1.5 border rounded bg-blue-50 hover:bg-blue-100 disabled:opacity-50"
                    >
                      Send
                    </button>
                  </div>
                  {typingNote && <div className="mt-1 text-xs text-gray-600">{typingNote}</div>}
                </Collapse>
              </Card>

              {/* Bedside Monitor */}
              <section ref={vitalsGraphHolder.ref}>
                <Card
                  title="Bedside Monitor (live)"
                  dense={dense}
                  gradient
                  toolbar={<CollapseBtn open={rightIomtOpen} onClick={() => setRightIomtOpen((v) => !v)} />}
                >
                  <Collapse open={rightIomtOpen}>
                    {vitalsGraphHolder.mounted ? (
                      <ClinicianVitalsPanel room={room} defaultCollapsed={false} maxPoints={240} showDockBadge={false} />
                    ) : (
                      <Skeleton height="h-40" />
                    )}
                  </Collapse>
                </Card>
              </section>
            </div>
          )}
        </div>
      </div>

      {/* Floating (Undocked) video pane — overlays by design */}
      {videoIsUndocked && (
        <div
          className="fixed z-[900] w-[min(520px,92vw)]"
          style={{
            left: `${floatPos.xPct}%`,
            top: `${floatPos.yPct}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="rounded-xl shadow-2xl">
            {/* Drag handle */}
            <div
              className="flex items-center justify-between px-3 py-2 rounded-t-xl border border-gray-200 bg-white cursor-move select-none"
              onMouseDown={(e) => startFloatDrag(e.clientX, e.clientY)}
              onTouchStart={(e) => {
                const t = e.touches?.[0];
                if (!t) return;
                startFloatDrag(t.clientX, t.clientY);
              }}
              title="Drag to move floating video"
            >
              <div className="text-xs text-gray-600">
                Floating Video <span className="text-gray-400">· drag to move</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
                  onClick={dockCenter}
                  title="Dock to center"
                >
                  Dock
                </button>
                <button
                  className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
                  onClick={dockLeft}
                  title="Dock to left"
                >
                  Dock Left
                </button>
              </div>
            </div>

            {/* Content */}
            <div ref={videoCardRef} className="rounded-b-xl overflow-hidden">
              {VideoDockNode}
            </div>
          </div>
        </div>
      )}

      {/* Help modal */}
      {helpOpen && (
        <div
          className="fixed inset-0 z-[1000] grid place-items-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
        >
          <div className="w-full max-w-md rounded-lg bg-white shadow border p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">Keyboard Shortcuts</div>
              <button className="text-xs text-gray-500 hover:text-gray-800" onClick={() => setHelpOpen(false)}>
                Close
              </button>
            </div>
            <ul className="text-sm space-y-1">
              <li>
                <b>M</b> — Toggle mic
              </li>
              <li>
                <b>V</b> — Toggle camera
              </li>
              <li>
                <b>C</b> — Toggle captions
              </li>
              <li>
                <b>O</b> — Toggle overlay
              </li>
              <li>
                <b>H</b> — Toggle vitals
              </li>
              <li>
                <b>S</b> — Toggle vitals stream overlay
              </li>
              <li>
                <b>R</b> — Toggle recording
              </li>
              <li>
                <b>X</b> — Toggle XR broadcast
              </li>
              <li>
                <b>F</b> — Full screen
              </li>
              <li>
                <b>L</b> — Toggle left pane
              </li>
              <li>
                <b>K</b> — Toggle right pane
              </li>
              <li>
                <b>?</b> — Show this help
              </li>
              <li>
                <b>Esc</b> — Close this help
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Toasts */}
      <ToastViewport toasts={toasts} onClose={closeToast} />
    </div>
  );
}
