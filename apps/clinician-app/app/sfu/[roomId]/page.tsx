// apps/clinician-app/app/sfu/[roomId]/page.tsx
'use client';

import type * as React from 'react';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import {
  Room,
  RoomEvent,
  DataPacket_Kind,
  ConnectionQuality,
  ConnectionState,
  type Participant,
} from 'livekit-client';

import {
  connectRoom,
  getOrCreateUid,
  RTC_TOPIC_CAPTIONS,
  coerceCaptionEvent,
  formatRtcParticipantLabel,
  normalizeRtcParticipantRole,
  type CaptionEvent,
  type RtcChatMessage,
  type RtcParticipantRole,
} from '@ambulant/rtc';

// Shared atoms
import { Field } from '@/components/shared/Field';
import { Tile } from '@/components/shared/Tile';
import { TextBlock } from '@/components/shared/TextBlock';

// Shared UI / layout bits
import { Card, Tabs, Collapse, Icon, Skeleton } from '@/components/ui';
import { CollapseBtn } from '@/components/ui/CollapseBtn';

import { useAutocomplete, icdSearch } from '@/src/hooks/useAutocomplete';
import type { ICD10Hit } from '@/src/hooks/useAutocomplete';
import { useUiPrefs } from '@/hooks/useUiPrefs';
import useInviteSpecialistApproval from '@/src/hooks/useInviteSpecialistApproval';

import { normalizeVitals } from '@/lib/sfu/vitals';
import AllergiesPanel, { type NewAllergyDraft } from '@/components/AllergiesPanel';
import {
  getSessionByAppointment,
  clinicianCheckIn,
  startConsultationSession,
  completeConsultationSession,
  type ConsultationSession,
} from '@/src/lib/consultation-session';

// New local modules
import VideoDock from './VideoDock';
import ErxComposer, { type ErxSummary, type SoapState } from './ErxComposer';
import InsightPane from './InsightPane';
import ReferralPanel from './ReferralPanel';
import { usePatientContext, type PatientAllergyBrief } from './patientContext';
import ClinicianRosterChips from './ClinicianRosterChips';
import InviteSpecialistDrawer from './InviteSpecialistDrawer';

// History sections
import CasesHistory from '@/components/cases';
import ConditionsHistory from '@/components/conditions';
import MedicationsHistory from '@/components/medications';
import AllergiesHistory from '@/components/allergies';
import OperationsHistory from '@/components/operations';
import VaccinationsHistory from '@/components/vaccinations';
import LabsHistory from '@/components/labs';

import {
  TOPIC_ROSTER,
  isRosterEnvelope,
  type RoomParty,
} from '@/src/lib/rtc/roster-contract';

import {
  computeRosterAvailability,
  type ClinicianPlanTier,
  type PatientPlanTier,
  type MultipartyParticipant,
} from '@/src/lib/televisit/multiparty';
import { bootstrapRosterFromAppointment } from '@/src/lib/televisit/roster-bootstrap';
import {
  reconcileParticipantConnected,
  reconcileParticipantDisconnected,
} from '@/src/lib/televisit/roster-live-reconcile';

/* ---------------------------------
   LiveKit topics + codec utilities
---------------------------------- */
const TOPIC_VITALS = 'vitals' as const;
const TOPIC_CHAT = 'chat' as const;
const TOPIC_CONTROL = 'control' as const;

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

function safeJsonParse(raw: string): unknown | null {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

type ControlKey =
  | 'overlay'
  | 'captions'
  | 'vitals'
  | 'vitalsOverlay'
  | 'recording'
  | 'xr'
  | 'screenshare'
  | 'hand'
  | 'export';

type ControlValue = boolean | string;

type CaptionTranscriptEvent = CaptionEvent & { receivedAt: number };

type TranscriptNoteSection =
  | 'symptoms'
  | 'history'
  | 'assessment'
  | 'plan'
  | 'safetyNetting'
  | 'followUp';

type TranscriptNoteSuggestion = {
  id: string;
  section: TranscriptNoteSection | string;
  suggestedText: string;
  source?: string;
  confidence?: number | null;
  duplicateOf?: string[];
  action?: string;
  createdAt?: string;
  applied?: boolean;
};

type ClinicianRoomChatMessage = RtcChatMessage & {
  from: string;
  text: string;
  ts?: number;
};

function chatMessageLabel(message: ClinicianRoomChatMessage | Partial<RtcChatMessage>) {
  if (typeof message.senderDisplay === 'string' && message.senderDisplay.trim()) {
    return message.senderDisplay.trim();
  }

  return formatRtcParticipantLabel({
    role: message.senderRole || message.participantRole || message.from || 'guest',
    senderName: message.senderName,
    displayName: typeof message.from === 'string' ? message.from : null,
  });
}

function chatPayloadLabel(parsed: Record<string, unknown>, fallbackFrom = 'guest') {
  const from = typeof parsed.from === 'string' ? parsed.from : fallbackFrom;
  return formatRtcParticipantLabel({
    role:
      parsed.senderRole ||
      parsed.participantRole ||
      parsed.relationshipToPatient ||
      from ||
      fallbackFrom,
    senderDisplay: typeof parsed.senderDisplay === 'string' ? parsed.senderDisplay : null,
    senderName: typeof parsed.senderName === 'string' ? parsed.senderName : null,
    displayName: typeof parsed.displayName === 'string' ? parsed.displayName : null,
  });
}

function isControlKey(v: unknown): v is ControlKey {
  return (
    v === 'overlay' ||
    v === 'captions' ||
    v === 'vitals' ||
    v === 'vitalsOverlay' ||
    v === 'recording' ||
    v === 'xr' ||
    v === 'screenshare' ||
    v === 'hand' ||
    v === 'export'
  );
}

type CallState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

function mapConnectionState(s: ConnectionState): CallState {
  switch (s) {
    case ConnectionState.Connected:
      return 'connected';
    case ConnectionState.Connecting:
      return 'connecting';
    case ConnectionState.Reconnecting:
      return 'reconnecting';
    case ConnectionState.Disconnected:
    default:
      return 'disconnected';
  }
}

function extractMintedRtc(
  resp: unknown,
  fallbackWsUrl: string
): { wsUrl: string; token: string } | null {
  if (!isRecord(resp)) return null;
  const token = typeof resp.token === 'string' ? resp.token : null;
  if (!token) return null;
  const wsUrl = typeof resp.wsUrl === 'string' ? resp.wsUrl : fallbackWsUrl;
  return { wsUrl, token };
}

type ClinicianRtcMintArgs = {
  roomId: string;
  visitId: string;
  uid: string;
  role: 'clinician' | 'observer';
  joinToken: string;
  identity: string;
};

async function mintClinicianRtcToken(args: ClinicianRtcMintArgs): Promise<unknown> {
  const res = await fetch('/api/rtc/token', {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      'x-join-token': args.joinToken,
      'x-role': args.role,
      'x-uid': args.uid,
    },
    body: JSON.stringify({
      roomId: args.roomId,
      room: args.roomId,
      visitId: args.visitId,
      uid: args.uid,
      identity: args.identity || args.uid,
      role: args.role,
      joinToken: args.joinToken,
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      isRecord(data) && typeof data.message === 'string'
        ? data.message
        : isRecord(data) && typeof data.error === 'string'
          ? data.error
          : `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

function rememberJoinTokenForRoom(visitId: string, roomId: string, joinToken: string) {
  if (typeof window === 'undefined' || !joinToken) return;

  const keys = [
    `televisit:join:${visitId}`,
    `televisit:join:${roomId}`,
    `televisitJoin:${visitId}`,
    `televisitJoin:${roomId}`,
    `rtc:join:${visitId}`,
    `rtc:join:${roomId}`,
    `joinJwt:${visitId}`,
    `joinJwt:${roomId}`,
    `ambulant.televisit.join.${visitId}`,
    `ambulant.televisit.join.${roomId}`,
  ];

  for (const key of keys) {
    try {
      window.sessionStorage.setItem(key, joinToken);
    } catch {
      // ignore storage failures
    }
  }
}

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
  'J20.9 - Acute bronchitis, unspecified',
  'R50.9 - Fever, unspecified',
  'R05.9 - Cough, unspecified',
  'I10 - Essential (primary) hypertension',
  'E11.9 - Type 2 diabetes mellitus without complications',
];

function num2(x?: number) {
  return typeof x === 'number' && Number.isFinite(x) ? Number(x).toFixed(2) : '-';
}
function fmtBP(sys?: number, dia?: number) {
  const ok = Number.isFinite(sys as number) && Number.isFinite(dia as number);
  return ok ? `${Math.round(sys!)} / ${Math.round(dia!)} mmHg` : '-/- mmHg';
}

// Helper: read join JWT from session (visitId/roomId variants)
function isCompactJws(value: unknown) {
  const s = String(value ?? '').trim();
  if (!s) return false;
  const parts = s.split('.');
  return parts.length === 3 && parts.every(Boolean);
}

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
    } catch {
      // ignore
    }
  }
  return '';
}

// Dynamic DeviceSettings with a polished runtime placeholder.
function SafeDeviceSettings() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      Device settings are unavailable in this browser session. Continue with the current microphone and camera defaults.
    </div>
  );
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
  const searchParams = useSearchParams() as any;
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL as string | undefined;
  const simulationParticipantRole =
    String(searchParams.get('participantRole') || searchParams.get('role') || 'clinician')
      .trim()
      .toLowerCase() === 'observer'
      ? 'observer'
      : 'clinician';
  const isSimulationObserver = simulationParticipantRole === 'observer';
  const simulationSupervisorMode =
    String(searchParams.get('supervisorMode') || '').trim().toUpperCase() === 'COACH'
      ? 'COACH'
      : 'OBSERVE';

  const isSimulationSession = searchParams.get('simulation') === '1' || roomId.startsWith('simulation-');

  // Centralized patient context (profile / meds / allergies)
  const {
    profile,
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
  const clinicianIdParam = searchParams.get('clinicianId') || searchParams.get('clinician') || '';
  const clinicNameParam = searchParams.get('clinicName') || undefined;
  const clinicAddressParam = searchParams.get('clinicAddress') || undefined;
  const appointmentId =
    searchParams.get('appointmentId') ||
    searchParams.get('appointment') ||
    searchParams.get('appt') ||
    null;

  const [consultationSession, setConsultationSession] = useState<ConsultationSession | null>(null);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Appointment/session metadata from URL context. Simulation links are generated by Admin.
  const appt = useMemo(
    () => ({
      id: searchParams.get('appointmentId') || searchParams.get('appointment') || searchParams.get('appt') || `sfu-${roomId}`,
      when:
        searchParams.get('scheduledStartAt') ||
        searchParams.get('startsAt') ||
        new Date().toISOString(),
      patientId,
      patientName,
      clinicianName: searchParams.get('clinicianName') || 'Clinician',
      clinicianSpecialty: searchParams.get('clinicianSpecialty') || undefined,
      reason: searchParams.get('reason') || 'Consultation',
      status: 'In progress',
      roomId,
    }),
    [roomId, patientId, patientName, searchParams]
  );

  const clinicianChatIdentity = useMemo(
    () => `clinician-${clinicianIdParam || 'local'}`,
    [clinicianIdParam],
  );

  const clinicianChatDisplay = useMemo(() => {
    const name = appt.clinicianName || 'Clinician';
    return formatRtcParticipantLabel({
      role: 'clinician',
      displayName: name,
    });
  }, [appt.clinicianName]);

  // Derived allergy views
  const allergySummary = useMemo(() => {
    if (!patientAllergies || patientAllergies.length === 0) return 'No allergies recorded';
    const top = patientAllergies
      .filter((a) => (a.status ?? '').toLowerCase() !== 'entered-in-error')
      .slice(0, 3)
      .map((a) => {
        const sev = a.severity ? ` (${a.severity})` : '';
        const rxn = a.reaction ? ` - ${a.reaction}` : '';
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
  const roomRef = useRef<Room | null>(null);

  const [state, setState] = useState<CallState>('disconnected');
  const stateRef = useRef<CallState>('disconnected');

  const [quality, setQuality] = useState<ConnectionQuality | undefined>(undefined);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Auto-reconnect tracking
  const manualLeaveRef = useRef(false);
  const hasEverConnectedRef = useRef(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const joinInFlightRef = useRef(false);

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

  // Toaster (tracks timers to avoid leaks)
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimersRef = useRef<Record<string, number>>({});

  const closeToast = useCallback((id: string) => {
    const t = toastTimersRef.current[id];
    if (typeof window !== 'undefined' && typeof t === 'number') window.clearTimeout(t);
    delete toastTimersRef.current[id];
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const pushToast = useCallback(
    (body: string, kind: ToastKind = 'info', title?: string, ttl = 4200) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const t: Toast = { id, body, kind, title, ttl };
      setToasts((prev) => [...prev, t]);

      if (ttl && typeof window !== 'undefined') {
        const timer = window.setTimeout(() => {
          closeToast(id);
        }, ttl);
        toastTimersRef.current[id] = timer;
      }
    },
    [closeToast]
  );

  useEffect(() => {
    return () => {
      if (typeof window === 'undefined') return;
      Object.values(toastTimersRef.current).forEach((t) => window.clearTimeout(t));
      toastTimersRef.current = {};
    };
  }, []);

  // Media toggles
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);

  // In-call toggles
  const [showOverlay, setShowOverlay] = useState(true);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [captionTranscript, setCaptionTranscript] = useState<CaptionTranscriptEvent[]>([]);
  const [showVitals, setShowVitals] = useState(true);
  const [showVitalsOverlay, setShowVitalsOverlay] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [xrEnabled, setXrEnabled] = useState(false);

  // Raised hand
  const [handRaised, setHandRaised] = useState(false);
  const handTimerRef = useRef<number | null>(null);

  // UI prefs
  const { state: ui, set: setUi } = useUiPrefs();
  const uiRef = useRef(ui);
  useEffect(() => {
    uiRef.current = ui;
  }, [ui]);

  const { presentation, dense, leftCollapsed, rightCollapsed, chatVisible, rightTab, pip } =
    ui;
  const [rightPanelsOpen, setRightPanelsOpen] = useState(true);
  const rightWorkspaceScrollRef = useRef<HTMLDivElement | null>(null);

  // keep latest toggles in a ref for clean control handling (prevents duplicate toasts)
  const togglesRef = useRef({
    showOverlay,
    captionsOn,
    showVitals,
    showVitalsOverlay,
    isRecording,
    xrEnabled,
    chatVisible,
  });
  useEffect(() => {
    togglesRef.current = {
      showOverlay,
      captionsOn,
      showVitals,
      showVitalsOverlay,
      isRecording,
      xrEnabled,
      chatVisible,
    };
  }, [showOverlay, captionsOn, showVitals, showVitalsOverlay, isRecording, xrEnabled, chatVisible]);

  // NEW: narrow video / wider notes toggle
  const [videoNarrow, setVideoNarrow] = useState(false);

  // Local collapse states
  const [leftInfoOpen, setLeftInfoOpen] = useState(true);
  const [rightIomtOpen, setRightIomtOpen] = useState(true);
  const [currentMedsOpen, setCurrentMedsOpen] = useState(true);
  const [allergiesOpen, setAllergiesOpen] = useState(true);

  // Roster / multiparty state
  const [roster, setRoster] = useState<RoomParty[]>([]);

  useEffect(() => {
    let alive = true;

    async function hydrateRoster() {
      const appointmentIdFromSearch =
        searchParams.get('appointmentId') ||
        searchParams.get('appointment') ||
        searchParams.get('appt') ||
        null;

      const next = await bootstrapRosterFromAppointment({
        appointmentId: appointmentIdFromSearch,
        existingRoster: [],
      });

      if (!alive) return;
      setRoster(next);
    }

    void hydrateRoster();
    return () => {
      alive = false;
    };
  }, [searchParams]);

  const patientPlan = (searchParams.get('patientPlan') || 'plus') as PatientPlanTier;
  const leadClinicianPlan = (searchParams.get('clinicianPlan') || 'group') as ClinicianPlanTier;
  const leadClinicianFeeZar = Number(searchParams.get('feeZar') || 1200);

  const remotePatientParticipants = useMemo(() => {
    const patientLike = roster.filter(
      (p) =>
        p.role === 'lead_patient' ||
        p.role === 'dependent_patient' ||
        p.role === 'second_patient_participant',
    );
    return Math.max(1, patientLike.length || 1);
  }, [roster]);

  const remoteObservers = useMemo(() => {
    return roster.filter((p) => p.role === 'observer' || p.role === 'care_ally').length;
  }, [roster]);

  const rosterAvailability = useMemo(() => {
    const requiredParticipants: MultipartyParticipant[] = roster
      .filter((p) => p.required)
      .map((p) => ({
        id: p.partyId,
        role: p.role as any,
        displayName: p.displayName,
        attendanceMode: p.required ? 'required' : 'optional',
        patientId: p.patientId ?? null,
        clinicianId: p.clinicianId ?? null,
        accepted: p.state === 'accepted' || p.state === 'joined',
        calendarFree: true,
        preflightReady: p.state === 'joined' || p.state === 'accepted',
        paymentReady: p.state === 'joined' || p.state === 'accepted',
      }));

    const optionalParticipants: MultipartyParticipant[] = roster
      .filter((p) => !p.required)
      .map((p) => ({
        id: p.partyId,
        role: p.role as any,
        displayName: p.displayName,
        attendanceMode: 'optional',
        patientId: p.patientId ?? null,
        clinicianId: p.clinicianId ?? null,
        accepted: p.state === 'accepted' || p.state === 'joined',
        calendarFree: true,
        preflightReady: p.state === 'joined' || p.state === 'accepted',
        paymentReady: p.state === 'joined' || p.state === 'accepted',
      }));

    return computeRosterAvailability({
      requiredParticipants,
      optionalParticipants,
    });
  }, [roster]);

  // Refs
  const videoCardRef = useRef<HTMLDivElement | null>(null);
  const chatBoxRef = useRef<HTMLDivElement | null>(null);

  // Chat
  const [chat, setChat] = useState<ClinicianRoomChatMessage[]>([]);
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
  const [transcriptNoteSuggestions, setTranscriptNoteSuggestions] = useState<TranscriptNoteSuggestion[]>([]);
  const [transcriptDraftLoading, setTranscriptDraftLoading] = useState(false);
  const [transcriptDraftError, setTranscriptDraftError] = useState<string | null>(null);

  // eRx summary (meds + labs) from ErxComposer
  const [erxSummary, setErxSummary] = useState<ErxSummary>({ meds: [], labs: [] });

  // =========================
  // VIDEO DOCK / UNDOCK (no new routes; least invasive)
  // =========================
  const VIDEO_DOCK_KEY = useMemo(() => `sfu-video-dock-v1-${roomId}`, [roomId]);
  const [videoDockMode, setVideoDockMode] = useState<VideoDockMode>('docked');
  const [videoDockSide, setVideoDockSide] = useState<VideoDockSide>('center');

  const [floatPos, setFloatPos] = useState<{ xPct: number; yPct: number }>({ xPct: 78, yPct: 70 });
  const floatPosRef = useRef(floatPos);
  useEffect(() => {
    floatPosRef.current = floatPos;
  }, [floatPos]);

  const floatDragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startXPct: number;
    startYPct: number;
  } | null>(null);

  const ensureClinicianSession = useCallback(async () => {
    if (!appointmentId) return null;

    setSessionBusy(true);
    setSessionError(null);

    try {
      const session = await getSessionByAppointment(appointmentId);
      setConsultationSession(session);
      return session;
    } catch (err: any) {
      const msg = err?.message || 'Failed to resolve consultation session';
      setSessionError(msg);
      return null;
    } finally {
      setSessionBusy(false);
    }
  }, [appointmentId]);

  const checkInAndStartSession = useCallback(
    async (roomIdForSession: string) => {
      const base = consultationSession || (await ensureClinicianSession());
      if (!base?.id) return null;

      try {
        const checkedIn = await clinicianCheckIn(base.id);
        setConsultationSession(checkedIn);

        const started = await startConsultationSession(checkedIn.id, {
          mediaConnected: true,
          roomId: roomIdForSession || null,
        });

        setConsultationSession(started);
        return started;
      } catch (err: any) {
        setSessionError(err?.message || 'Failed to start consultation session');
        return null;
      }
    },
    [consultationSession, ensureClinicianSession]
  );

  useEffect(() => {
    if (!appointmentId) return;
    ensureClinicianSession();
  }, [appointmentId, ensureClinicianSession]);

  // Load dock prefs (no `any`)
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const raw = localStorage.getItem(VIDEO_DOCK_KEY);
      if (!raw) return;

      const parsed = safeJsonParse(raw);
      if (!isRecord(parsed)) return;

      const mode: VideoDockMode = parsed.mode === 'undocked' ? 'undocked' : 'docked';
      const side: VideoDockSide = parsed.side === 'left' ? 'left' : 'center';

      const xPct = typeof parsed.xPct === 'number' ? parsed.xPct : null;
      const yPct = typeof parsed.yPct === 'number' ? parsed.yPct : null;

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

  const startFloatDrag = useCallback((clientX: number, clientY: number) => {
    if (typeof window === 'undefined') return;
    const p = floatPosRef.current;
    floatDragRef.current = {
      active: true,
      startX: clientX,
      startY: clientY,
      startXPct: p.xPct,
      startYPct: p.yPct,
    };
  }, []);

  const moveFloatDrag = useCallback((clientX: number, clientY: number) => {
    if (!floatDragRef.current?.active) return;
    if (typeof window === 'undefined') return;

    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

    const dx = clientX - floatDragRef.current.startX;
    const dy = clientY - floatDragRef.current.startY;

    const nextX = floatDragRef.current.startXPct + (dx / vw) * 100;
    const nextY = floatDragRef.current.startYPct + (dy / vh) * 100;

    setFloatPos({ xPct: clamp(nextX, 5, 95), yPct: clamp(nextY, 8, 95) });
  }, []);

  const endFloatDrag = useCallback(() => {
    if (floatDragRef.current) floatDragRef.current.active = false;
  }, []);

  // Register drag listeners once (no re-bind per move; no `any`)
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
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('mouseleave', onUp);
    };
  }, [moveFloatDrag, endFloatDrag]);

  // Persist SOAP + meds per-room as a local draft cache.
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const saved = localStorage.getItem(`sfu-soap-v2-${roomId}`);
      if (saved) {
        const parsed = safeJsonParse(saved);
        if (isRecord(parsed)) {
          const p = parsed as Record<string, unknown>;
          const soapCandidate = p.soap ?? parsed;
          if (isRecord(soapCandidate)) setSoap(soapCandidate as SoapState);
          if (typeof p.currentMeds === 'string') setCurrentMeds(p.currentMeds);
          if (typeof p.patientEducation === 'string') setPatientEducation(p.patientEducation);
        }
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
          const rxn = a.reaction ? ` - ${a.reaction}` : '';
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
    text: `${h.code} \u2014 ${h.title}`,
  }));
  const icdSympOptionsFinal = icdSympOptions.length
    ? icdSympOptions
    : ICD10_SUGGESTIONS.map((t, i) => ({ code: t.split(' ')[0] || `SUG-${i}`, text: t }));
  const [sympOpen, setSympOpen] = useState(false);
  const [sympActive, setSympActive] = useState(-1);

  // Current medications entered during this room session.
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

  /* ---------------------------------
     Clean publish helpers (no mixing)
  ---------------------------------- */
  const publishTopic = useCallback(
    async (topic: string, payload: unknown, kind: DataPacket_Kind = DataPacket_Kind.RELIABLE) => {
      const r = roomRef.current;
      if (!r) return;
      try {
        const bytes = TEXT_ENCODER.encode(JSON.stringify(payload));
        await r.localParticipant.publishData(bytes, { reliable: kind === DataPacket_Kind.RELIABLE, topic });
      } catch (e) {
        console.warn('[publish] error', e);
      }
    },
    []
  );

  const publishControl = useCallback(
    async (type: ControlKey, value: ControlValue) => {
      await publishTopic(
        TOPIC_CONTROL,
        { type, value, from: 'clinician' },
        DataPacket_Kind.RELIABLE
      );
    },
    [publishTopic]
  );

  const publishTyping = useCallback(async () => {
    await publishTopic(
      TOPIC_CHAT,
      {
        type: 'typing',
        from: 'clinician',
        senderRole: 'clinician',
        senderIdentity: clinicianChatIdentity,
        senderDisplay: clinicianChatDisplay,
        ts: Date.now(),
      },
      DataPacket_Kind.RELIABLE,
    );
  }, [publishTopic]);

  const publishChat = useCallback(
    async (text: string) => {
      await publishTopic(
        TOPIC_CHAT,
        {
          id: `clinician-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          from: 'clinician',
          senderRole: 'clinician',
          senderIdentity: clinicianChatIdentity,
          senderDisplay: clinicianChatDisplay,
          text,
          ts: Date.now(),
        },
        DataPacket_Kind.RELIABLE,
      );
    },
    [publishTopic]
  );

  const publishRoster = useCallback(
    async (payload: unknown) => {
      await publishTopic(TOPIC_ROSTER, payload, DataPacket_Kind.RELIABLE);
    },
    [publishTopic]
  );

  const specialistInvite = useInviteSpecialistApproval({
    roomId,
    sessionId: consultationSession?.id ?? null,
    appointmentId,
    encounterId,
    publishTopic,
    publishRoster,
    pushToast,
    setRoster,
    topicChat: TOPIC_CHAT,
    reliableKind: DataPacket_Kind.RELIABLE,
  });

  /* ---------------------------------
     Room event wiring (single attach)
     - no duplication on reconnect/join
     - cleanup on leave/unmount
  ---------------------------------- */
    const appendCaptionEvent = useCallback((event: CaptionEvent) => {
    setCaptionTranscript((prev) => {
      const stamped: CaptionTranscriptEvent = { ...event, receivedAt: Date.now() };
      const sameSpeaker = (line: CaptionTranscriptEvent) =>
        (line.speakerIdentity || line.speakerDisplay) === (event.speakerIdentity || event.speakerDisplay);

      if (!event.final) {
        const next = prev.filter((line) => line.final || !sameSpeaker(line));
        return [...next, stamped].slice(-500);
      }

      const next = prev.filter((line) => {
        if (!sameSpeaker(line)) return true;
        if (!line.final) return false;
        return !(line.sequence === event.sequence && line.timestamp === event.timestamp);
      });

      return [...next, stamped].slice(-500);
    });
  }, []);

const detachRoomEventsRef = useRef<null | (() => void)>(null);

  const detachRoomEvents = useCallback(() => {
    try {
      detachRoomEventsRef.current?.();
    } finally {
      detachRoomEventsRef.current = null;
    }
  }, []);

  const attachRoomEvents = useCallback(
    (r: Room) => {
      detachRoomEvents();

      const onLocalParticipantConnected = () => {
        setRoster((prev) =>
          reconcileParticipantConnected({
            prev,
            identity: r.localParticipant.identity,
            metadata: r.localParticipant.metadata,
            joinedAt: Date.now(),
          }),
        );
      };

      const onConn = (st: ConnectionState) => {
        const mapped = mapConnectionState(st);
        setState(mapped);

        if (mapped === 'disconnected') {
          setQuality(undefined);
          setMicOn(false);
          setCamOn(false);
        }
      };

      const onQuality = (q: ConnectionQuality, _p?: Participant) => setQuality(q);

      const onParticipantConnected = (p: Participant) => {
        setRoster((prev) =>
          reconcileParticipantConnected({
            prev,
            identity: p.identity,
            metadata: p.metadata,
            joinedAt: Date.now(),
          }),
        );
      };

      const onParticipantDisconnected = (p: Participant) => {
        setRoster((prev) =>
          reconcileParticipantDisconnected({
            prev,
            identity: p.identity,
            metadata: p.metadata,
            leftAt: Date.now(),
          }),
        );
      };

      const onData = async (payload: Uint8Array, _p?: Participant, _kind?: DataPacket_Kind, topic?: string) => {
        const text = TEXT_DECODER.decode(payload);
        const parsed = safeJsonParse(text) ?? text;
        const t = typeof topic === 'string' ? topic : '';

        const captionEvent = coerceCaptionEvent(parsed, {
          roomId,
          encounterId,
          appointmentId,
          speakerRole: 'patient',
          speakerName: profile.name || 'Patient',
          speakerDisplay: profile.name || 'Patient',
          source: 'unknown',
        });

        if (t === RTC_TOPIC_CAPTIONS || captionEvent) {
          if (captionEvent) {
            appendCaptionEvent(captionEvent);
            if (!togglesRef.current.captionsOn) setCaptionsOn(true);
          }
          return;
        }

        if (t === TOPIC_VITALS) {
          try {
            const input = parsed as Parameters<typeof normalizeVitals>[0];
            const v = normalizeVitals(input);
            setVitals(v as Vitals);
          } catch (err) {
            console.warn('[vitals] normalize error', err);
          }
          return;
        }

        if (t === TOPIC_CHAT) {
          if (isRecord(parsed)) {
            const from = typeof parsed.from === 'string' ? parsed.from : 'remote';

            if (from === 'clinician') return;

            await specialistInvite.handleIncomingChatPayload(parsed);

            if (parsed.type === 'typing') {
              setTypingNote(`${chatPayloadLabel(parsed, 'patient')} is typing...`);
              if (typingTimerRef.current && typeof window !== 'undefined') window.clearTimeout(typingTimerRef.current);
              if (typeof window !== 'undefined') {
                typingTimerRef.current = window.setTimeout(() => setTypingNote(null), 3000);
              }
              return;
            }

            if (typeof parsed.text === 'string') {
              setChat((c) => [...c, { from, text: String((parsed as any).text ?? '') }]);

              const visible = uiRef.current.chatVisible;
              const atBottom = chatBoxRef.current
                ? chatBoxRef.current.scrollHeight -
                    chatBoxRef.current.scrollTop -
                    chatBoxRef.current.clientHeight <
                  8
                : true;

              if (!visible || !atBottom) setUnread((u) => u + 1);
              return;
            }
          }
          return;
        }

        if (t === TOPIC_ROSTER) {
          if (!isRosterEnvelope(parsed)) return;

          if (parsed.type === 'roster.snapshot') {
            setRoster(parsed.parties || []);
            return;
          }

          if (parsed.type === 'roster.party.invited' || parsed.type === 'roster.party.joined') {
            setRoster((prev) => {
              const others = prev.filter((x) => x.partyId !== parsed.party.partyId);
              return [...others, parsed.party];
            });
            return;
          }

          if (parsed.type === 'roster.party.left') {
            setRoster((prev) =>
              prev.map((x) =>
                x.partyId === parsed.partyId ? { ...x, state: 'left', leftAt: parsed.ts } : x
              )
            );
            return;
          }
        }

        if (t === TOPIC_CONTROL || t === '') {
          if (!isRecord(parsed)) return;

          const from = typeof parsed.from === 'string' ? parsed.from : undefined;
          if (from === 'clinician') return;

          const type = parsed.type;
          const value = parsed.value;

          if (!isControlKey(type)) return;

          const asBool = (v: unknown) => !!v;
          const asString = (v: unknown) => (typeof v === 'string' ? v : null);

          if (type === 'overlay') {
            const next = asBool(value);
            const prev = togglesRef.current.showOverlay;
            setShowOverlay(next);
            if (next !== prev) pushToast(`Patient ${next ? 'enabled' : 'disabled'} overlay.`, 'info');
            return;
          }

          if (type === 'captions') {
            const next = asBool(value);
            const prev = togglesRef.current.captionsOn;
            setCaptionsOn(next);
            if (next !== prev) pushToast(`Patient ${next ? 'enabled' : 'disabled'} captions.`, 'info');
            return;
          }

          if (type === 'vitals') {
            const next = asBool(value);
            const prev = togglesRef.current.showVitals;
            setShowVitals(next);
            if (next !== prev) pushToast(`Patient ${next ? 'showed' : 'hid'} vitals.`, 'info');
            return;
          }

          if (type === 'vitalsOverlay') {
            const next = asBool(value);
            const prev = togglesRef.current.showVitalsOverlay;
            setShowVitalsOverlay(next);
            if (next !== prev) pushToast(`Patient ${next ? 'enabled' : 'disabled'} stream vitals overlay.`, 'info');
            return;
          }

          if (type === 'recording') {
            const next = asBool(value);
            const prev = togglesRef.current.isRecording;
            setIsRecording(next);
            if (next !== prev) pushToast(`Patient ${next ? 'started' : 'stopped'} recording.`, next ? 'warning' : 'info');
            return;
          }

          if (type === 'xr') {
            const next = asBool(value);
            const prev = togglesRef.current.xrEnabled;
            setXrEnabled(next);
            if (next !== prev) pushToast(`Patient ${next ? 'enabled' : 'disabled'} XR broadcast.`, 'info');
            return;
          }

          if (type === 'screenshare') {
            const next = asBool(value);
            pushToast(`Patient ${next ? 'started' : 'stopped'} screen sharing.`, 'info');
            return;
          }

          if (type === 'hand') {
            const next = asBool(value);
            if (handTimerRef.current && typeof window !== 'undefined') window.clearTimeout(handTimerRef.current);
            handTimerRef.current = null;
            setHandRaised(next);
            if (next) {
              pushToast('Patient raised their hand.', 'warning', 'Patient needs attention', 10000);
            } else {
              pushToast('Patient lowered their hand.', 'info');
            }
            return;
          }

          if (type === 'export') {
            const v = asString(value);
            if (v) pushToast(`Patient exported ${v}.`, 'success');
            return;
          }
        }
      };

      r.on(RoomEvent.ConnectionStateChanged, onConn);
      r.on(RoomEvent.ConnectionQualityChanged, onQuality);
      r.on(RoomEvent.ParticipantConnected, onLocalParticipantConnected);
      r.on(RoomEvent.ParticipantConnected, onParticipantConnected);
      r.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      r.on(RoomEvent.DataReceived, onData);

      detachRoomEventsRef.current = () => {
        try {
          r.off(RoomEvent.ConnectionStateChanged, onConn);
          r.off(RoomEvent.ConnectionQualityChanged, onQuality);
          r.off(RoomEvent.ParticipantConnected, onLocalParticipantConnected);
          r.off(RoomEvent.ParticipantConnected, onParticipantConnected);
          r.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
          r.off(RoomEvent.DataReceived, onData);
        } catch {
          // ignore
        }
      };
    },
    [detachRoomEvents, pushToast,
    setRoster,
    specialistInvite]
  );

  // Join/leave
  const join = useCallback(async () => {
    if (!wsUrl) return pushToast('Missing NEXT_PUBLIC_LIVEKIT_URL', 'error');
    if (joinInFlightRef.current) return;
    if (stateRef.current === 'connecting' || stateRef.current === 'connected') return;

    manualLeaveRef.current = false;
    joinInFlightRef.current = true;
    setState('connecting');
    setSessionError(null);

    try {
      const requestedParticipantId =
        String(searchParams.get('participantId') || searchParams.get('uid') || '').trim();
      const uid =
        isSimulationObserver && requestedParticipantId
          ? requestedParticipantId
          : getOrCreateUid('clinician');
      const visitId =
        searchParams.get('visitId') || searchParams.get('visit') || searchParams.get('v') || roomId;

      const direct = searchParams.get('joinToken') || searchParams.get('jt') || '';
      const joinToken = (direct || readJoinJwtFromSession(visitId, roomId)).trim();

      if (!joinToken) {
        setState('disconnected');
        pushToast('Missing join token. Re-open the full clinician simulation link from Admin so the signed join token is present.', 'error');
        return;
      }

      if (direct) {
        rememberJoinTokenForRoom(visitId, roomId, direct);
      }

      const minted = await mintClinicianRtcToken({
        roomId,
        visitId,
        uid,
        role: simulationParticipantRole,
        joinToken,
        identity: uid,
});

      const extracted = extractMintedRtc(minted, wsUrl);
      if (!extracted) {
        setState('disconnected');
        pushToast('Failed to mint RTC token (invalid response).', 'error');
        return;
      }

      try {
        detachRoomEvents();
        await roomRef.current?.disconnect();
      } catch {
        // ignore
      }

      const r = await connectRoom(extracted.wsUrl, extracted.token, { autoSubscribe: true });
      attachRoomEvents(r);

      setRoom(r);
      roomRef.current = r;

      setState('connected');

      try {
        if (isSimulationObserver) {
          const coachMic = simulationSupervisorMode === 'COACH';
          await r.localParticipant.setCameraEnabled(false);
          await r.localParticipant.setMicrophoneEnabled(coachMic);
          setCamOn(false);
          setMicOn(coachMic);
        } else {
          await r.localParticipant.setMicrophoneEnabled(true);
          await r.localParticipant.setCameraEnabled(true);
          setMicOn(true);
          setCamOn(true);
        }
      } catch {
        // media may fail; keep connected
      }

      if (!isSimulationObserver) {
        await checkInAndStartSession(roomId);
      }

      setQuality(r.localParticipant.connectionQuality);

      hasEverConnectedRef.current = true;
      pushToast('Connected to room.', 'success');
      audit('room.join', { netQuality: r.localParticipant.connectionQuality });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Join] error', err);
      setState('disconnected');
      pushToast(`Failed to join room: ${message}`, 'error');
      audit('room.join.error', { message });
    } finally {
      joinInFlightRef.current = false;
    }
  }, [wsUrl, pushToast,
    setRoster,
    audit, roomId, searchParams, attachRoomEvents, detachRoomEvents, checkInAndStartSession, isSimulationObserver, simulationParticipantRole, simulationSupervisorMode]);


  // A6-R3-E1G: publish clinician room presence only while LiveKit is connected.
  useEffect(() => {
    if (state !== 'connected' || isSimulationObserver) return;

    const visitId =
      searchParams.get('visitId') ||
      searchParams.get('visit') ||
      searchParams.get('v') ||
      roomId;

    let cancelled = false;

    const publishRoomPresence = async () => {
      try {
        const response = await fetch('/api/televisit/presence', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          credentials: 'same-origin',
          cache: 'no-store',
          body: JSON.stringify({
            surface: 'room',
            roomId,
            visitId,
            appointmentId: appointmentId || '',
          }),
        });

        if (!response.ok && !cancelled) {
          console.warn(
            '[ClinicianSFU presence] heartbeat rejected',
            response.status,
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.warn(
            '[ClinicianSFU presence] heartbeat failed',
            error,
          );
        }
      }
    };

    void publishRoomPresence();

    const timer = window.setInterval(() => {
      void publishRoomPresence();
    }, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [appointmentId, roomId, searchParams, state, isSimulationObserver]);

  const leave = useCallback(async () => {
    manualLeaveRef.current = true;
    audit('room.leave', { reason: 'manual' });

    if (reconnectTimerRef.current && typeof window !== 'undefined') {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    try {
      detachRoomEvents();
      await roomRef.current?.disconnect();
    } catch {
      // ignore
    }

    roomRef.current = null;
    setRoom(null);
    setState('disconnected');
    setMicOn(false);
    setCamOn(false);

    if (typingTimerRef.current && typeof window !== 'undefined') window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = null;

    if (handTimerRef.current && typeof window !== 'undefined') window.clearTimeout(handTimerRef.current);
    handTimerRef.current = null;

    pushToast('Left the room.', 'info');
  }, [audit, detachRoomEvents, pushToast]);

  // Ensure we cleanup on unmount (no leaks)
  useEffect(() => {
    return () => {
      manualLeaveRef.current = true;

      if (typeof window === 'undefined') {
        return;
      }

      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
      if (handTimerRef.current) window.clearTimeout(handTimerRef.current);

      reconnectTimerRef.current = null;
      typingTimerRef.current = null;
      handTimerRef.current = null;

      try {
        detachRoomEventsRef.current?.();
      } catch {
        // ignore
      }

      try {
        roomRef.current?.disconnect();
      } catch {
        // ignore
      }

      roomRef.current = null;
    };
  }, []);

  const toggleAndBroadcast = (
    key: Exclude<ControlKey, 'export'>,
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
                : key === 'xr'
                  ? 'XR broadcast'
                  : key;

    pushToast(
      `${next ? 'Enabled' : 'Disabled'} ${label}.`,
      key === 'recording' ? (next ? 'warning' : 'info') : 'info'
    );

    if (key === 'recording') {
      audit(next ? 'recording.start' : 'recording.stop');
    }
  };

  const sendMsg = useCallback(async () => {
    const r = roomRef.current;
    if (!r || !msg.trim()) return;

    setMsgSending(true);
    const text = msg.trim();

    try {
      await publishChat(text);
      setChat((c) => [...c, { from: 'me', text }]);
      setMsg('');
      if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    } catch (e) {
      console.warn('chat publish error', e);
      pushToast('Failed to send message.', 'error');
    } finally {
      setMsgSending(false);
    }
  }, [msg, publishChat, pushToast]);

  const onChatKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMsg();
      return;
    }
    const now = Date.now();
    if (now - typingThrottledRef.current > 1200) {
      typingThrottledRef.current = now;
      publishTyping();
    }
  };

  const enterPresentation = async () => {
    setUi('presentation', true);
    setVideoDockMode('docked');
    setVideoDockSide('center');

    if (videoCardRef.current && !document.fullscreenElement) {
      try {
        await videoCardRef.current.requestFullscreen?.();
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
    if (isSimulationObserver && simulationSupervisorMode !== 'COACH') {
      pushToast('Observe mode is subscribe-only.', 'info');
      return;
    }
    const next = !micOn;
    setMicOn(next);
    roomRef.current?.localParticipant.setMicrophoneEnabled(next).catch(() => {});
    pushToast(next ? 'Microphone on.' : 'Microphone off.', 'info');
  };
  const toggleCam = () => {
    if (isSimulationObserver) {
      pushToast('Supervisor camera publishing is disabled.', 'info');
      return;
    }
    const next = !camOn;
    setCamOn(next);
    roomRef.current?.localParticipant.setCameraEnabled(next).catch(() => {});
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
  const showLeftColumn = !presentation && (showLeftInfo || dockToLeft);

  const gridCols = presentation
    ? 'grid-cols-1'
    : showLeftColumn && showRightPane
      ? dockToLeft
        ? 'lg:grid-cols-[1.05fr_2.15fr_1.2fr]'
        : 'lg:grid-cols-[1.2fr_2fr_1.2fr]'
      : showLeftColumn && !showRightPane
        ? dockToLeft
          ? 'lg:grid-cols-[1.0fr_3.0fr]'
          : videoNarrow
            ? 'lg:grid-cols-[0.9fr_2.6fr]'
            : 'lg:grid-cols-[1.2fr_2fr]'
        : !showLeftColumn && showRightPane
          ? videoNarrow
            ? 'lg:grid-cols-[2.6fr_0.9fr]'
            : 'lg:grid-cols-[2fr_1.2fr]'
          : 'grid-cols-1';

  // Auto-reconnect on unexpected drop (no duplicate timers)
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
  }, [state, join]);

  // Keyboard shortcuts + help modal
  const [helpOpen, setHelpOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
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
    pushToast('Allergies exported.', 'success');
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
                status: (updated as { status?: string } | null)?.status ?? status,
                severity: (updated as { severity?: string } | null)?.severity ?? a.severity,
                reaction: (updated as { reaction?: string } | null)?.reaction ?? a.reaction,
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

      const c = created as Record<string, unknown> | null;

      const newBrief: PatientAllergyBrief = {
        id: String(c?.id ?? c?.allergyId ?? `alg-${Date.now()}`),
        substance: (typeof c?.substance === 'string' ? c.substance : null) ?? payload.substance,
        reaction:
          (typeof c?.reaction === 'string' ? c.reaction : null) ??
          (typeof payload.reaction === 'string' ? payload.reaction : null),
        severity: (typeof c?.severity === 'string' ? c.severity : null) ?? payload.severity,
        criticality: (typeof c?.criticality === 'string' ? c.criticality : null) ?? null,
        status: (typeof c?.status === 'string' ? c.status : null) ?? payload.status,
        recordedAt:
          (typeof c?.recordedAt === 'string' ? c.recordedAt : null) ?? new Date().toISOString(),
      };

      setPatientAllergies((prev) => [...(prev || []), newBrief]);
      pushToast('Allergy added.', 'success');
    } catch (err) {
      console.error('[handleCreateAllergy] failed', err);
      pushToast('Failed to add allergy.', 'error');
      throw err;
    }
  };

  function appendUniqueSoapText(existing: string | undefined, text: string) {
    const current = String(existing || '').trim();
    const incoming = String(text || '').trim();
    if (!incoming) return current;

    const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();
    if (current && normalize(current).includes(normalize(incoming))) return current;
    return current ? `${current}\n\n${incoming}` : incoming;
  }

  function noteSuggestionLabel(section: string) {
    switch (section) {
      case 'symptoms':
        return 'Symptoms';
      case 'history':
        return 'History / HPI';
      case 'assessment':
        return 'Assessment';
      case 'plan':
        return 'Plan';
      case 'safetyNetting':
        return 'Safety-netting';
      case 'followUp':
        return 'Follow-up';
      default:
        return 'Transcript note';
    }
  }

  function soapKeyForSuggestion(section: string): 's' | 'a' | 'p' {
    switch (section) {
      case 'symptoms':
        return 's';
      case 'assessment':
        return 'a';
      case 'history':
      case 'plan':
      case 'safetyNetting':
      case 'followUp':
      default:
        return 'p';
    }
  }

  function applyTranscriptSuggestion(suggestion: TranscriptNoteSuggestion) {
    const text = String(suggestion.suggestedText || '').trim();
    if (!text) return;

    const key = soapKeyForSuggestion(String(suggestion.section || 'history'));

    setSoap((prev) => ({
      ...prev,
      [key]: appendUniqueSoapText(String(prev[key] || ''), text),
    }));

    setTranscriptNoteSuggestions((prev) =>
      prev.map((item) => (item.id === suggestion.id ? { ...item, applied: true } : item)),
    );

    pushToast(
      `Added transcript suggestion to ${noteSuggestionLabel(String(suggestion.section || 'history'))}.`,
      'success',
      'Transcript reviewed',
    );
  }

  async function generateTranscriptNoteDraft() {
    if (!encounterId) {
      pushToast('No encounter is attached to this call yet.', 'warning', 'Transcript draft unavailable');
      return;
    }

    setTranscriptDraftLoading(true);
    setTranscriptDraftError(null);

    try {
      const res = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/transcript/note-draft`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          soap,
          existingSoap: {
            subjective: soap.s,
            objective: soap.o,
            assessment: soap.a,
            plan: soap.p,
          },
          existingNote: patientEducation,
          localTranscriptSegmentCount: captionTranscript.length,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `note_draft_failed_${res.status}`);
      }

      const suggestions = Array.isArray(json.suggestions) ? json.suggestions : [];
      setTranscriptNoteSuggestions(suggestions);

      if (suggestions.length) {
        pushToast(
          `${suggestions.length} reviewed transcript suggestion${suggestions.length === 1 ? '' : 's'} ready.`,
          'success',
          'Transcript draft ready',
        );
      } else {
        pushToast(
          'No new transcript suggestions were found. Existing SOAP may already contain the content.',
          'info',
          'Transcript reviewed',
        );
      }
    } catch (err: any) {
      const message = err?.message || 'Failed to generate transcript note draft.';
      setTranscriptDraftError(message);
      pushToast(message, 'error', 'Transcript draft failed');
    } finally {
      setTranscriptDraftLoading(false);
    }
  }

  // -------------------------
  // Encounter summary (used in referral email/SMS)
  // -------------------------
  const encounterSummary = useMemo(() => {
    const lines: string[] = [];
    lines.push(`Reason for visit: ${appt.reason || '-'}`);
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
              return `- ${parts}`;
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
              return `- ${parts}`;
            })
            .join('\n')
      );
    }

    if (patientAllergies && patientAllergies.length) {
      const algs = patientAllergies
        .filter((a) => (a.status ?? '').toLowerCase() !== 'entered-in-error')
        .map((a) => {
          const sev = a.severity ? ` [${a.severity}]` : '';
          const rxn = a.reaction ? ` - ${a.reaction}` : '';
          return `- ${a.substance}${sev}${rxn}`;
        });
      lines.push('Recorded allergies:\n' + algs.join('\n'));
    }

    return lines.join('\n\n');
  }, [appt.reason, soap.s, soap.a, soap.p, patientEducation, erxSummary, patientAllergies]);

  // -------------------------
  // End Session -> callback from SessionConclusions
  // -------------------------
  const handleSessionEnd = useCallback(async () => {
    if (!consultationSession?.id) {
      pushToast(
        'Session draft saved locally, but no consultation session is attached to this call.',
        'warning',
        'Session incomplete'
      );
      audit('encounter.end.missing_session', { encounterId: encounterId || null });
      return;
    }

    try {
      const completed = await completeConsultationSession(consultationSession.id, {
        encounterStatus: 'completed',
        encounterReachedClinicalThreshold: true,
        summaryPayload: {
          soap,
          patientEducation,
          erxSummary,
          roomId,
        },
      });

      setConsultationSession(completed);
      pushToast('Session ended and consultation marked complete.', 'success', 'Encounter closed');
      audit('encounter.end', {
        encounterId: encounterId || null,
        sessionId: completed.id,
        outcome: completed.outcome || null,
      });
    } catch (err: any) {
      pushToast(err?.message || 'Failed to complete consultation session.', 'error', 'Completion failed');
      audit('encounter.end.error', {
        encounterId: encounterId || null,
        sessionId: consultationSession.id,
        error: err?.message || 'unknown_error',
      });
    }
  }, [consultationSession, soap, patientEducation, erxSummary, roomId, encounterId, pushToast, audit]);

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
      handRaised={handRaised}
      micOn={micOn}
      camOn={camOn}
      showOverlay={showOverlay}
      showVitals={showVitals}
      showVitalsOverlay={showVitalsOverlay}
      captionsOn={captionsOn}
      captionLines={captionTranscript}
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
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-slate-50" data-density={dense ? 'compact' : 'comfort'}>
      <header className="z-40 flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-black tracking-tight text-slate-950">SFU Televisit <span className="text-slate-400">/</span> Room {roomId}</h1>
            </div>

            <ClinicianRosterChips roster={roster} />
          </div>
        </div>

        <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1">
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

          <span
            className={`text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
              rosterAvailability.status === 'green'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : rosterAvailability.status === 'amber'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            Roster: {rosterAvailability.status}
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

          {consultationSession?.id ? (
            <span className="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-200 bg-white text-slate-700">
              Session: {consultationSession.state}
            </span>
          ) : appointmentId ? (
            <span className="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-800">
              Session pending
            </span>
          ) : null}

          {sessionBusy ? (
            <span className="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-sky-200 bg-sky-50 text-sky-700">
              Resolving session...
            </span>
          ) : null}

          {handRaised ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-black text-amber-900 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              Patient hand raised
            </span>
          ) : null}

          {!presentation && (
            <>
              {videoIsUndocked ? (
                <>
                  <button
                    onClick={dockCenter}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                    title="Dock video (center)"
                  >
                    <Icon name="collapse" />
                    Dock
                  </button>
                  <button
                    onClick={dockLeft}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                    title="Dock video to left column"
                  >
                    <Icon name="collapse" />
                    Dock left
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={undockVideo}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                    title="Undock video (floating)"
                  >
                    <Icon name="expand" />
                    Undock
                  </button>

                  <button
                    onClick={() => (videoDockSide === 'left' ? dockCenter() : dockLeft())}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                    title={videoDockSide === 'left' ? 'Dock video to center column' : 'Dock video to left column'}
                  >
                    <Icon name={videoDockSide === 'left' ? 'expand' : 'collapse'} />
                    {videoDockSide === 'left' ? 'Dock center' : 'Dock left'}
                  </button>
                </>
              )}
            </>
          )}

          <button
            onClick={() => setUi('leftCollapsed', !leftCollapsed)}
            aria-pressed={leftCollapsed}
            aria-label={leftCollapsed ? 'Show left pane' : 'Hide left pane'}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            title={leftCollapsed ? 'Show left pane (L)' : 'Hide left pane (L)'}
          >
            <Icon name={leftCollapsed ? 'expand' : 'collapse'} />
            {leftCollapsed ? 'Show left' : 'Hide left'}
          </button>

          <button
            onClick={() => setUi('dense', !dense)}
            aria-pressed={dense}
            aria-label={dense ? 'Use comfortable density' : 'Use compact density'}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            title="Toggle density"
          >
            {dense ? 'Comfort' : 'Compact'}
          </button>

          <button
            onClick={() => setVideoNarrow((v) => !v)}
            aria-pressed={videoNarrow}
            aria-label={videoNarrow ? 'Use normal layout' : 'Narrow side column(s)'}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            title={videoNarrow ? 'Normal columns' : 'Wider center'}
          >
            <Icon name={videoNarrow ? 'collapse' : 'expand'} />
            {videoNarrow ? 'Normal layout' : 'Wider centre'}
          </button>

          <button
            onClick={() => (presentation ? exitPresentation() : enterPresentation())}
            aria-pressed={presentation}
            aria-label={presentation ? 'Exit full screen mode' : 'Enter full screen mode'}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            title={presentation ? 'Exit full screen (F)' : 'Enter Full screen (F)'}
          >
            <Icon name={presentation ? 'collapse' : 'expand'} />
            <span className="text-xs">{presentation ? 'Exit full screen' : 'Full screen'}</span>
          </button>

          <button
            onClick={() => setUi('rightCollapsed', !rightCollapsed)}
            aria-pressed={rightCollapsed}
            aria-label={rightCollapsed ? 'Show right pane' : 'Hide right pane'}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            title={rightCollapsed ? 'Show right pane (R)' : 'Hide right pane (R)'}
          >
            <Icon name={rightCollapsed ? 'expand' : 'collapse'} />
            {rightCollapsed ? 'Show right' : 'Hide right'}
          </button>

          <button
            onClick={() => specialistInvite.openInviteDrawer()}
            className="px-3 py-1.5 rounded-full border border-violet-200 bg-violet-50 shadow-sm hover:bg-violet-100 text-sm text-violet-700"
          >
            Invite specialist
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
          Reconnecting...
        </div>
      )}

      {sessionError && (
        <div className="mx-4 my-2 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {sessionError}
        </div>
      )}

      {specialistInvite.loadingPersistedQuote && (
        <div className="mx-4 my-2 rounded border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
          Loading persisted specialist invite state...
        </div>
      )}

      {specialistInvite.pendingInviteQuote && (
        <div className="mx-4 my-2 rounded border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium">Specialist invite pending patient approval</div>
              <div className="mt-1 text-xs text-violet-700">
                Quote ID: <span className="font-mono">{specialistInvite.pendingInviteQuote.quoteId}</span>
                {' · '}
                Total: <span className="font-semibold">R{specialistInvite.pendingInviteQuote.totalZar.toFixed(2)}</span>
                {specialistInvite.pendingInviteQuote.sessionId ? (
                  <>
                    {' · '}
                    Session: <span className="font-mono">{specialistInvite.pendingInviteQuote.sessionId}</span>
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => specialistInvite.dismissPendingInviteQuote()}
                className="rounded border border-violet-200 bg-white px-2.5 py-1 text-xs text-violet-700 hover:bg-violet-100"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className={`container mx-auto min-h-0 flex-1 overflow-hidden transition-all duration-300 ${dense ? 'px-3 py-2' : 'px-4 py-3'} ${
          presentation ? 'max-w-[1400px]' : 'max-w-[1800px]'
        }`}
      >
        <div className={`grid h-full min-h-0 md:gap-4 gap-3 transition-[grid-template-columns] duration-300 ${gridCols}`}>
          {!presentation && showLeftColumn && (
            <div className="min-h-0 overflow-y-auto pr-1 flex flex-col space-y-4">
              {!videoIsUndocked && dockToLeft && (
                <div className="z-20 shrink-0" ref={videoCardRef}>
                  {VideoDockNode}
                </div>
              )}

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
                            .join(' \u00b7 ') || '\u2014'
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
                          <Tile label="SpO\u2082" value={`${num2(vitals.spo2)} %`} />
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

          <div className="min-h-0 overflow-hidden flex flex-col space-y-4">
            {!presentation && !videoIsUndocked && !dockToLeft && (
              <div className="z-20 shrink-0" ref={videoCardRef}>
                {VideoDockNode}
              </div>
            )}

            {presentation && (
              <div className="z-20 shrink-0" ref={videoCardRef}>
                {VideoDockNode}
              </div>
            )}
          </div>

          {!presentation && !rightCollapsed && (
            <div className="min-h-0 min-w-0 overflow-hidden pl-1 flex flex-col">
              <div className="shrink-0 space-y-2 pb-2">
                <div className="px-2">
                  <div className="text-sm font-semibold text-gray-800">SOAP, Insights, History</div>
                </div>

                <div className="px-2 text-[11px] text-slate-500">
                  Keep the video dock stationary while this clinical workspace scrolls independently. Room Chat and Bedside Monitor are grouped under Sub.
                </div>

                <div className="overflow-x-auto rounded bg-white shadow-sm">
                  <div className="flex min-w-max items-center justify-between p-1">
                    <Tabs<RightTab>
                      active={rightTab as RightTab}
                      onChange={(key) => {
                        setUi('rightTab', key as any);
                        setRightPanelsOpen(true);
                        window.requestAnimationFrame(() => {
                          rightWorkspaceScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
                        });
                      }}
                      items={[
                        { key: 'soap', label: 'Sub' },
                        { key: 'erx', label: 'eRx' },
                        { key: 'conclusions', label: 'Conclusions' },
                        { key: 'insight', label: 'Insight' },
                        { key: 'history', label: 'History' },
                      ]}
                    />
                    <button
                      className="ml-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                      onClick={() => setRightPanelsOpen((open) => !open)}
                      aria-expanded={rightPanelsOpen}
                      aria-label={rightPanelsOpen ? 'Collapse active workspace' : 'Expand active workspace'}
                      title={rightPanelsOpen ? 'Collapse active workspace' : 'Expand active workspace'}
                    >
                      {rightPanelsOpen ? 'Collapse' : 'Expand'}
                    </button>
                  </div>
                </div>
              </div>

              <div
                ref={rightWorkspaceScrollRef}
                className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-auto overscroll-contain pr-1 pb-4"
              >
                <div className="space-y-4">
                  <Collapse open={rightPanelsOpen}>
                <>
                  {rightTab === 'soap' && (
                    <Card title="Clerk Desk" dense={dense} gradient>
                      <div className="text-xs text-gray-500 mb-2">
                        Capture the core consultation narrative first, then use coding, medicines and transcript assistance as supporting tools.
                      </div>

                      <div className="mb-3 space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Core consultation notes</div>
                      <TextBlock
                        label="Presenting Complaints"
                        value={soap.a}
                        onChange={(v) => setSoap({ ...soap, a: v })}
                        dictation
                      />
                      <TextBlock
                        label="History of Present Illness (HPI)"
                        value={soap.p}
                        onChange={(v) => setSoap({ ...soap, p: v })}
                        multiline
                        dictation
                      />
                      <TextBlock
                        label="Patient Education"
                        value={patientEducation}
                        onChange={setPatientEducation}
                        multiline
                        dictation
                      />
                      </div>

                      <div className="mb-3 rounded-xl border border-sky-100 bg-sky-50/70 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-semibold text-sky-900">Transcript-assisted note draft</div>
                            <div className="mt-0.5 text-[11px] leading-relaxed text-sky-700">
                              Generates append-only suggestions from persisted final transcript segments. Review each item before adding it to SOAP.
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={generateTranscriptNoteDraft}
                            disabled={transcriptDraftLoading || !encounterId}
                            className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                            title="Generate note suggestions from transcript"
                          >
                            {transcriptDraftLoading ? 'Reviewing...' : 'Generate note suggestions from transcript'}
                          </button>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-sky-700">
                          <span className="rounded-full bg-white/80 px-2 py-0.5">Local live segments: {captionTranscript.length}</span>
                          <span className="rounded-full bg-white/80 px-2 py-0.5">Mode: review required</span>
                          <span className="rounded-full bg-white/80 px-2 py-0.5">Action: append only</span>
                        </div>

                        {transcriptDraftError ? (
                          <div className="mt-2 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">
                            {transcriptDraftError}
                          </div>
                        ) : null}

                        {transcriptNoteSuggestions.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {transcriptNoteSuggestions.map((suggestion) => (
                              <div
                                key={suggestion.id}
                                className="rounded-lg border border-sky-100 bg-white p-2 shadow-sm"
                              >
                                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-800">
                                      {noteSuggestionLabel(String(suggestion.section || 'history'))}
                                    </span>
                                    {suggestion.applied ? (
                                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Applied</span>
                                    ) : null}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => applyTranscriptSuggestion(suggestion)}
                                    disabled={!!suggestion.applied}
                                    className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {suggestion.applied ? 'Added' : 'Append to SOAP'}
                                  </button>
                                </div>
                                <div className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                                  {suggestion.suggestedText}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="mb-2 border rounded bg-white">
                        <div className="flex items-center justify-between px-2 py-1">
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-gray-700">Current Medication</span>
                            <span className="text-[11px] text-gray-500">From patient profile</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {medsError && (
                              <span className="text-[10px] text-amber-700 border border-amber-200 bg-amber-50 rounded-full px-2 py-0.5">
                                Source unavailable
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
                                Source unavailable
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
                                  (o) => o.text.toLowerCase().startsWith(norm) || o.text.toLowerCase().includes(norm)
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
                                  <span>{o.text.replace(/^([A-Z0-9.]+)\s+-\s*/, '')}</span>
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
                      simulation={isSimulationSession}
                      currentMedicationNames={activeMeds
                        .map((med: any) =>
                          String(
                            med?.name ||
                            med?.medication ||
                            med?.drug ||
                            med?.display ||
                            med?.medicationName ||
                            ''
                          ).trim()
                        )
                        .filter(Boolean)}
                      icd10Suggestions={ICD10_SUGGESTIONS}
                      onToast={pushToast}
                      onAudit={audit}
                      onSummaryChange={setErxSummary}
                    />
                  )}

                  {(rightTab as string) === 'conclusions' && (
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

                  {(rightTab as string) === 'history' && (
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

              {rightTab === 'soap' && rightPanelsOpen ? (
                <>
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
                            ? 'Type message... (Enter to send, Shift+Enter for newline)'
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
                </>
              ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {videoIsUndocked && (
        <div
          className="fixed z-[900] w-[min(520px,92vw)]"
          style={{
            left: `${floatPos.xPct}%`,
            top: `${floatPos.yPct}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div
              className="flex cursor-move select-none items-center justify-between border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur"
              onMouseDown={(e) => startFloatDrag(e.clientX, e.clientY)}
              onTouchStart={(e) => {
                const t = e.touches?.[0];
                if (!t) return;
                startFloatDrag(t.clientX, t.clientY);
              }}
              title="Drag to move floating video"
            >
              <div className="text-xs text-gray-600">
                Floating video <span className="text-gray-400">- drag to move</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  onClick={dockCenter}
                  title="Dock to center"
                >
                  Dock
                </button>
                <button
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  onClick={dockLeft}
                  title="Dock to left"
                >
                  Dock left
                </button>
              </div>
            </div>

            <div ref={videoCardRef} className="rounded-b-xl overflow-hidden">
              {VideoDockNode}
            </div>
          </div>
        </div>
      )}

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
                <b>M</b> - Toggle mic
              </li>
              <li>
                <b>V</b> - Toggle camera
              </li>
              <li>
                <b>C</b> - Toggle captions
              </li>
              <li>
                <b>O</b> - Toggle overlay
              </li>
              <li>
                <b>H</b> - Toggle vitals
              </li>
              <li>
                <b>S</b> - Toggle vitals stream overlay
              </li>
              <li>
                <b>R</b> - Toggle recording
              </li>
              <li>
                <b>X</b> - Toggle XR broadcast
              </li>
              <li>
                <b>F</b> - Full screen
              </li>
              <li>
                <b>L</b> - Toggle left pane
              </li>
              <li>
                <b>K</b> - Toggle right pane
              </li>
              <li>
                <b>?</b> - Show this help
              </li>
              <li>
                <b>Esc</b> - Close this help
              </li>
            </ul>
          </div>
        </div>
      )}

      <InviteSpecialistDrawer
        open={specialistInvite.inviteDrawerOpen}
        onClose={() => specialistInvite.closeInviteDrawer()}
        patientPlan={patientPlan}
        leadClinicianPlan={leadClinicianPlan}
        leadClinicianId={clinicianIdParam}
        leadClinicianFeeZar={leadClinicianFeeZar}
        remotePatientParticipants={remotePatientParticipants}
        remoteObservers={remoteObservers}
        onConfirm={async ({ invitedClinicians, quote }) => {
          await specialistInvite.confirmInvite({ invitedClinicians, quote });
        }}
      />

      <ToastViewport toasts={toasts} onClose={closeToast} />
    </div>
  );
}








