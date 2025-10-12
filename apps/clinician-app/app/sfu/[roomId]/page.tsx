// apps/clinician-app/app/sfu/[roomId]/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  DataPacket_Kind,
  ConnectionQuality,
  Participant,
} from 'livekit-client';

import { connectRoom } from '@ambulant/rtc';
import ClinicianVitalsPanel from '../../../components/ClinicianVitalsPanel';

// Shared atoms
import { Field } from '@/components/shared/Field';
import { Tile } from '@/components/shared/Tile';
import { TextBlock } from '@/components/shared/TextBlock';

// Shared UI / layout bits
import {
  Card,
  Tabs,
  Collapse,
  Badge,
  Icon,
  IconBtn,
  Skeleton,
} from '@/components/ui';
import { CollapseBtn } from '@/components/ui/CollapseBtn';

import RecordingBanner from '@/components/RecordingBanner';
import SessionConclusions from '@/components/SessionConclusions';

import IntegratedIoMTs from '@/components/IntegratedIoMTs';
import SmartWearablesPanel from '@/components/SmartWearablesPanel';

import { useAutocomplete, icdSearch, rxnormSearch } from '@/src/hooks/useAutocomplete';
import type { ICD10Hit, RxNormHit } from '@/src/hooks/useAutocomplete';
import { InsightPanel, InsightReply } from '@/components/sfu/InsightPanel';
import { useUiPrefs } from '@/hooks/useUiPrefs';

import { normalizeVitals } from '@/lib/sfu/vitals';

/* ---------------------------
   Small Toast system (local)
----------------------------*/
type Toast = {
  id: string;
  title?: string;
  body: string;
  kind?: 'info' | 'success' | 'warning' | 'error';
  ttl?: number;
};
function ToastViewport({ toasts, onClose }: { toasts: Toast[]; onClose: (id: string) => void }) {
  return (
    <div className="fixed z-[1000] bottom-4 right-4 flex flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={[
            'min-w-[240px] max-w-[360px] rounded-lg border shadow bg-white px-3 py-2',
            t.kind === 'success' ? 'border-emerald-200' :
            t.kind === 'warning' ? 'border-amber-200' :
            t.kind === 'error'   ? 'border-rose-200' :
                                   'border-gray-200'
          ].join(' ')}
          role="status"
          aria-live="polite"
        >
          {t.title && <div className="text-sm font-semibold mb-0.5">{t.title}</div>}
          <div className="text-sm text-gray-700">{t.body}</div>
          <div className="mt-2 text-right">
            <button className="text-xs text-gray-500 hover:text-gray-800" onClick={() => onClose(t.id)}>Dismiss</button>
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

const DRUG_SUGGESTIONS: string[] = [
  'Amoxicillin 500 mg capsule',
  'Paracetamol 500 mg tablet',
  'Ibuprofen 200 mg tablet',
  'Azithromycin 250 mg tablet',
  'Metformin 500 mg tablet',
];
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

// Dynamic DeviceSettings (with safe fallback)
function SafeDeviceSettings() {
  return <div className="text-sm text-gray-600">Safe device settings (fallback)</div>;
}
const DeviceSettings = dynamic(async () => {
  try {
    const m = await import('@ambulant/rtc');
    return { default: m.DeviceSettings };
  } catch {
    return { default: SafeDeviceSettings };
  }
}, { ssr: false });

// =========================
/* Page Component */
// =========================

export default function SFURoomClinician({ params }: { params: { roomId: string } }) {
  const { roomId } = params;
  const searchParams = useSearchParams();
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL as string | undefined;
  const identity = useMemo(() => `clinician-${Math.random().toString(36).slice(2, 7)}`, []);

  // Fake appt meta
  const appt = useMemo(() => ({
    id: `sfu-${roomId}`,
    when: new Date().toISOString(),
    patientId: 'pt-dev',
    patientName: 'Demo Patient',
    clinicianName: 'Demo Clinician',
    reason: 'Acute bronchitis (demo)',
    status: 'In progress',
    roomId,
  }), [roomId]);

  // Room & connection state
  const [room, setRoom] = useState<Room | null>(null);
  const [state, setState] = useState<'disconnected' | 'connecting' | 'connected' | 'reconnecting'>('disconnected');
  const [quality, setQuality] = useState<ConnectionQuality | undefined>(undefined);

  // Toaster
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pushToast = useCallback((body: string, kind: Toast['kind'] = 'info', title?: string, ttl = 4200) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    const t: Toast = { id, body, kind, title, ttl };
    setToasts(prev => [...prev, t]);
    if (ttl) {
      window.setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), ttl);
    }
  }, []);
  const closeToast = (id: string) => setToasts(prev => prev.filter(x => x.id !== id));

  // Media toggles
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);

  // In-call toggles
  const [showOverlay, setShowOverlay] = useState(true);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [showVitals, setShowVitals] = useState(true);
  const [showVitalsOverlay, setShowVitalsOverlay] = useState(false); // NEW: Stream overlay toggle
  const [isRecording, setIsRecording] = useState(false);
  const [xrEnabled, setXrEnabled] = useState(false);

  // Active speaker / raised hand
  const [remoteSpeaking, setRemoteSpeaking] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const handTimerRef = useRef<number | null>(null);

  // UI prefs
  const { state: ui, set: setUi } = useUiPrefs();
  const {
    presentation,
    dense,
    leftCollapsed,
    rightCollapsed,
    chatVisible,
    rightTab,
    pip,
    rightPanelsOpen,
  } = ui;

  // Local collapse states
  const [leftInfoOpen, setLeftInfoOpen] = useState(true);
  const [rightIomtOpen, setRightIomtOpen] = useState(true);

  // Refs
  const videoCardRef = useRef<HTMLDivElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioSinkRef = useRef<HTMLAudioElement | null>(null);
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

  // eRx / SOAP / Lab state
  type RxRow = { drug: string; dose: string; route: string; freq: string; duration: string; qty: string; refills: number; notes?: string };
  const [rxRows, setRxRows] = useState<RxRow[]>([{ drug: '', dose: '', route: '', freq: '', duration: '', qty: '', refills: 0 }]);
  const addRxRow = () => setRxRows((r) => [...r, { drug: '', dose: '', route: '', freq: '', duration: '', qty: '', refills: 0 }]);
  const removeRxRow = (i: number) => setRxRows((r) => r.filter((_, j) => j !== i));

  const [soap, setSoap] = useState({ s: '', o: '', a: '', p: '' });
  const [currentMeds, setCurrentMeds] = useState<string>('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`sfu-soap-v2-${roomId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSoap(parsed?.soap ?? parsed);
        if (parsed?.currentMeds !== undefined) setCurrentMeds(parsed.currentMeds);
      }
    } catch {}
  }, [roomId]);
  useEffect(() => {
    try { localStorage.setItem(`sfu-soap-v2-${roomId}`, JSON.stringify({ soap, currentMeds })); } catch {}
  }, [soap, currentMeds, roomId]);

  type LabRow = { test: string; priority: '' | 'Routine' | 'Urgent' | 'Stat'; specimen: string; icd: string; instructions?: string };
  const [labRows, setLabRows] = useState<LabRow[]>([{ test: '', priority: '', specimen: '', icd: '', instructions: '' }]);
  const addLabRow = () => setLabRows((r) => [...r, { test: '', priority: '', specimen: '', icd: '', instructions: '' }]);
  const removeLabRow = (i: number) => setLabRows((r) => r.filter((_, j) => j !== i));

  // eRx results & actions (restored)
  type ErxResult = { id: string; status: string; dispenseCode: string; error?: string };
  const [erxResult, setErxResult] = useState<ErxResult | null>(null);
  const sendErx = async () => {
    try {
      setErxResult({
        id: `rx-${Date.now()}`,
        status: 'Queued',
        dispenseCode: '—',
      });
      pushToast('eRx request queued (demo).', 'success');
    } catch {
      setErxResult({ id: '', status: 'Failed', dispenseCode: '', error: 'Failed to send eRx' });
      pushToast('Failed to send eRx.', 'error');
    }
  };
  const pushOrder = (dest: 'CarePort' | 'MedReach') => {
    pushToast(`Order pushed to ${dest} (demo).`, 'success');
  };

  // Insight
  const [insightBusy, setInsightBusy] = useState(false);
  const [insight, setInsight] = useState<InsightReply | null>(null);

  async function analyzeWithInsight() {
    setInsightBusy(true);
    try {
      const payload = { soap, patient: appt.patientName, clinician: appt.clinicianName, reason: appt.reason, meds: rxRows };
      const res = await fetch('/api/insightcore', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const raw = await res.json().catch(() => ({} as any));
      const data =
        (raw && (raw.summary || raw.goals || raw.notes) && raw) ||
        (raw && raw.data && (raw.data.summary || raw.data.goals || raw.data.notes) && raw.data);
      if (data) setInsight(data as any);
      else {
        setInsight({
          summary: `Suggested plan for ${appt.patientName}: Dx ${soap.a || soap.p || '—'}.`,
          goals: ['Symptom reduction in 7d', 'Adherence ≥85%', 'Follow-up in 10–14d'],
          notes: 'Review red flags, hydration, follow-up, etc.',
        });
      }
    } catch {
      setInsight({
        summary: `Suggested plan for ${appt.patientName}: Dx ${soap.a || soap.p || '—'}.`,
        goals: ['Symptom reduction in 7d', 'Adherence ≥85%', 'Follow-up in 10–14d'],
        notes: 'Insight service unavailable—using fallback plan.',
      });
    } finally {
      setInsightBusy(false);
    }
  }
  function acceptInsight() {
    if (!insight) return;
    const text = [
      insight.summary ? `Summary: ${insight.summary}` : '',
      insight.goals?.length ? `Goals:\n- ${insight.goals.join('\n- ')}` : '',
      insight.notes ? `Notes: ${insight.notes}` : '',
    ].filter(Boolean).join('\n\n');
    setSoap(s => ({ ...s, p: s.p ? `${s.p}\n\n---\n${text}` : text }));
    pushToast('Insight accepted into Plan.', 'success');
  }
  function adjustInsight() {
    if (!insight) return;
    const text = [
      insight.summary ? `Summary: ${insight.summary}` : '',
      insight.goals?.length ? `Goals:\n- ${insight.goals.join('\n- ')}` : '',
      insight.notes ? `Notes: ${insight.notes}` : '',
    ].filter(Boolean).join('\n\n');
    setSoap(s => ({ ...s, p: s.p ? `${s.p}\n\n---\n${text}` : text }));
    setUi('rightTab', 'soap');
    pushToast('Insight copied to Plan. Edit in SOAP tab.', 'info');
  }
  function declineInsight() {
    setInsight(null);
    pushToast('Insight declined.', 'warning');
  }

  // Room helpers
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

  const attach = useCallback(() => {
    if (!room) return;
    const rp = firstRemote(room);
    if (rp) {
      const rvpub = [...rp.videoTrackPublications.values()].find(p => p.isSubscribed && p.videoTrack);
      if (rvpub && remoteVideoRef.current) rvpub.videoTrack?.attach(remoteVideoRef.current);
      const rapub = [...rp.audioTrackPublications.values()].find(p => p.isSubscribed && p.audioTrack);
      if (rapub && audioSinkRef.current) rapub.audioTrack?.attach(audioSinkRef.current);
    }
    const localPubV = [...room.localParticipant.videoTrackPublications.values()].find(p => p.track);
    if (localPubV && localVideoRef.current) localPubV.videoTrack?.attach(localVideoRef.current);
  }, [room]);

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
    r.on(RoomEvent.TrackSubscribed, attach)
     .on(RoomEvent.TrackUnsubscribed, attach)
     .on(RoomEvent.LocalTrackPublished, attach)
     .on(RoomEvent.ParticipantConnected, attach)
     .on(RoomEvent.ParticipantDisconnected, attach)
     .on(RoomEvent.ConnectionStateChanged, () => setState(r.state as any))
     .on(RoomEvent.ConnectionQualityChanged, (_p, q) => setQuality(q))
     .on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
       const someoneRemoteSpeaking = speakers.some(p => p.sid !== r.localParticipant.sid);
       setRemoteSpeaking(someoneRemoteSpeaking);
     })
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
             if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
             typingTimerRef.current = window.setTimeout(() => setTypingNote(null), 3000);
             return;
           }
           if (typeof data?.text === 'string') {
             setChat(c => [...c, { from: data.from || 'remote', text: data.text }]);
             const atBottom = chatBoxRef.current
               ? chatBoxRef.current.scrollHeight - chatBoxRef.current.scrollTop - chatBoxRef.current.clientHeight < 8
               : true;
             if (!chatVisible || !atBottom) setUnread(u => u + 1);
             return;
           }
         }

         if (topic === 'control') {
           const v = data?.value;
           if (data?.type === 'overlay') { setShowOverlay(!!v); pushToast(`Patient ${v ? 'enabled' : 'disabled'} overlay.`, 'info'); }
           if (data?.type === 'captions') { setCaptionsOn(!!v); pushToast(`Patient ${v ? 'enabled' : 'disabled'} captions.`, 'info'); }
           if (data?.type === 'vitals') { setShowVitals(!!v); pushToast(`Patient ${v ? 'showed' : 'hid'} vitals.`, 'info'); }
           if (data?.type === 'vitalsOverlay') { setShowVitalsOverlay(!!v); pushToast(`Patient ${v ? 'enabled' : 'disabled'} stream vitals overlay.`, 'info'); }
           if (data?.type === 'recording') { setIsRecording(!!v); pushToast(`Patient ${v ? 'started' : 'stopped'} recording.`, v ? 'warning' : 'info'); }
           if (data?.type === 'xr') { setXrEnabled(!!v); pushToast(`Patient ${v ? 'enabled' : 'disabled'} XR broadcast.`, 'info'); }
           if (data?.type === 'screenshare') { pushToast(`Patient ${v ? 'started' : 'stopped'} screen sharing.`, 'info'); }
           if (data?.type === 'hand') {
             if (handTimerRef.current) window.clearTimeout(handTimerRef.current);
             setHandRaised(!!v);
             if (v) {
               pushToast('Patient raised their hand.', 'info');
               handTimerRef.current = window.setTimeout(() => setHandRaised(false), 5000);
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
    if (state !== 'disconnected') return;
    setState('connecting');
    try {
      const token = await fetch('/api/rtc/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roomId, identity, room: roomId, user: identity }),
      }).then(r => {
        if (!r.ok) throw new Error(`token fetch HTTP ${r.status}`);
        return r.json();
      }).then(j => j.token as string);

      const r = await connectRoom(wsUrl, token, { autoSubscribe: true });
      wireRoomEvents(r);
      setRoom(r);
      setState('connected');
      await r.localParticipant.setMicrophoneEnabled(true);
      await r.localParticipant.setCameraEnabled(true);
      setMicOn(true);
      setCamOn(true);
      setQuality(r.localParticipant.connectionQuality);
      attach();
      pushToast('Connected to room.', 'success');
    } catch (err: any) {
      console.error('[Join] error', err);
      setState('disconnected');
      pushToast(`Failed to join room: ${err?.message || err}`, 'error');
    }
  };

  const leave = async () => {
    try { await room?.disconnect(); } catch {}
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
      key === 'overlay' ? 'overlay' :
      key === 'captions' ? 'captions' :
      key === 'vitals' ? 'vitals' :
      key === 'vitalsOverlay' ? 'vitals stream overlay' :
      key === 'recording' ? 'recording' : 'XR broadcast';
    pushToast(`${next ? 'Enabled' : 'Disabled'} ${label}.`, key === 'recording' ? (next ? 'warning' : 'info') : 'info');
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
      setChat(c => [...c, { from: 'me', text }]);
      setMsg('');
      if (chatBoxRef.current) {
        chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
      }
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
    if (now - typingThrottledRef.current > 1000) {
      typingThrottledRef.current = now;
      publishControl('typing', true);
    }
  };

  const enterPresentation = async () => {
    setUi('presentation', true);
    if (videoCardRef.current && !document.fullscreenElement) {
      try { await (videoCardRef.current as any).requestFullscreen?.(); } catch {}
    }
  };
  const exitPresentation = async () => {
    setUi('presentation', false);
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch {}
    }
  };

  // Mic/cam toggles (with a11y)
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
    attach();
    pushToast(next ? 'Camera on.' : 'Camera off.', 'info');
  };

  // Draggable video + LOCK
  const [videoFloating, setVideoFloating] = useState(false);
  const [videoFloatLocked, setVideoFloatLocked] = useState(true);
  const [videoPos, setVideoPos] = useState<{ xPct: number; yPct: number }>({ xPct: 10, yPct: 10 });
  const draggingRef = useRef<{ active: boolean; dx: number; dy: number } | null>(null);

  const toggleFloatLock = () => {
    if (draggingRef.current) draggingRef.current.active = false;
    setVideoFloatLocked(prev => {
      const next = !prev;
      if (next) setVideoFloating(false);
      else setVideoFloating(true);
      return next;
    });
  };

  const startDragVideo = (clientX: number, clientY: number) => {
    if (videoFloatLocked) return;
    setVideoFloating(true);
    draggingRef.current = { active: true, dx: clientX, dy: clientY };
  };
  const moveDragVideo = (clientX: number, clientY: number) => {
    if (!draggingRef.current?.active || videoFloatLocked) return;
    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    const w = Math.min(vw, 960);
    const h = (w * 9) / 16;
    const x = ((clientX - w * 0.5) / vw) * 100;
    const y = ((clientY - h * 0.5) / vh) * 100;
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    setVideoPos({ xPct: clamp(x, 0, 100), yPct: clamp(y, 0, 100) });
  };
  const endDragVideo = () => { if (draggingRef.current) draggingRef.current.active = false; };

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

  // Touch hover helper for video controls/padlock
  const [showVControls, setShowVControls] = useState(false);
  const touchTimerRef = useRef<number | null>(null);
  const touchKick = () => {
    setShowVControls(true);
    if (touchTimerRef.current) window.clearTimeout(touchTimerRef.current);
    touchTimerRef.current = window.setTimeout(() => setShowVControls(false), 2500);
  };
  const hoverOpacity = showVControls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100';

  // Deferred mount helper
  function useDeferredMount<T extends HTMLElement>(onceInView = true) {
    const ref = useRef<T | null>(null);
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
      if (!ref.current) return;
      const el = ref.current;
      const io = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) {
          setMounted(true);
          if (onceInView) io.disconnect();
        }
      }, { rootMargin: '200px' });
      io.observe(el);
      return () => io.disconnect();
    }, [onceInView]);
    return { ref, mounted } as const;
  }
  const vitalsGraphHolder = useDeferredMount<HTMLDivElement>();

  // Layout grid calc
  const gridCols = presentation
    ? 'grid-cols-1'
    : leftCollapsed && rightCollapsed
      ? 'grid-cols-1'
      : leftCollapsed
        ? 'lg:grid-cols-[2fr_1.2fr]'
        : rightCollapsed
          ? 'lg:grid-cols-[1.2fr_2fr]'
          : 'lg:grid-cols-[1.2fr_2fr_1.2fr]';

  // Autocomplete wiring (Symptoms for Sub card; Dx moved to conclusions)
  const icdSympAuto = useAutocomplete<ICD10Hit>(icdSearch);
  const [sympCode, setSympCode] = useState<string>('');
  const icdSympOptions = icdSympAuto.opts.map(h => ({ code: h.code, text: `${h.code} — ${h.title}` }));

  const icdSympOptionsFinal = icdSympOptions.length
    ? icdSympOptions
    : ICD10_SUGGESTIONS.map((t, i) => ({ code: t.split(' ')[0] || `SUG-${i}`, text: t }));

  const rxAuto = useAutocomplete<RxNormHit>(rxnormSearch);
  const rxOptionsFinal: { name: string; rxcui?: string }[] =
    rxAuto.opts.length ? (rxAuto.opts as RxNormHit[]) : DRUG_SUGGESTIONS.map((name) => ({ name }));

  // -------- Current Meds list (read-only) ----------
  const currentMedsList = useMemo(
    () => (currentMeds || '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean),
    [currentMeds]
  );

  // Poor network → toast (once per transition into Poor)
  const prevQualityRef = useRef<ConnectionQuality | undefined>(undefined);
  useEffect(() => {
    if (quality === ConnectionQuality.Poor && prevQualityRef.current !== ConnectionQuality.Poor) {
      pushToast('Network quality is poor. Video/audio may be degraded.', 'warning', 'Poor Network');
    }
    prevQualityRef.current = quality;
  }, [quality, pushToast]);

  // Keyboard shortcuts + help modal
  const [helpOpen, setHelpOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea';
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
          setHelpOpen(v => !v);
          e.preventDefault();
          return;
        }
        if (isTyping) return;
        const lower = e.key.toLowerCase();
        if (lower === 'm') { toggleMic(); e.preventDefault(); }
        if (lower === 'v') { toggleCam(); e.preventDefault(); }
        if (lower === 'c') { toggleAndBroadcast('captions', !captionsOn, setCaptionsOn); e.preventDefault(); }
        if (lower === 'o') { toggleAndBroadcast('overlay', !showOverlay, setShowOverlay); e.preventDefault(); }
        if (lower === 'h') { toggleAndBroadcast('vitals', !showVitals, setShowVitals); e.preventDefault(); }
        if (lower === 's') { toggleAndBroadcast('vitalsOverlay', !showVitalsOverlay, setShowVitalsOverlay); e.preventDefault(); }
        if (lower === 'r') { toggleAndBroadcast('recording', !isRecording, setIsRecording); e.preventDefault(); }
        if (lower === 'x') { toggleAndBroadcast('xr', !xrEnabled, setXrEnabled); e.preventDefault(); }
        if (lower === 'f') { (presentation ? exitPresentation() : enterPresentation()); e.preventDefault(); }
        if (lower === 'l') { setUi('leftCollapsed', !leftCollapsed); e.preventDefault(); }
        if (lower === 'k') { setUi('rightCollapsed', !rightCollapsed); e.preventDefault(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [captionsOn, showOverlay, showVitals, showVitalsOverlay, isRecording, xrEnabled, presentation, leftCollapsed, rightCollapsed]);

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
            <span className={`h-2 w-2 rounded-full ${state==='connected'?'bg-emerald-500':state==='connecting'?'bg-amber-500':'bg-slate-400'}`} />
            {state}
          </span>
          {quality !== undefined && (
            <span className={`text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${quality===ConnectionQuality.Poor?'border-amber-300 bg-amber-50 text-amber-800':'border-gray-200 bg-white text-gray-700'}`}>
              Net: {ConnectionQuality[quality]}
            </span>
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

          {state !== 'connected'
            ? <button onClick={join} className="px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 shadow-sm hover:bg-blue-100 text-sm">Join</button>
            : <button onClick={leave} className="px-3 py-1.5 rounded-full border border-red-200 bg-red-50 shadow-sm hover:bg-red-100 text-sm">Leave</button>}
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
        onDismiss={() => { setIsRecording(false); publishControl('recording', false); }}
      />

      <div className={`transition-all duration-300 container mx-auto ${dense ? 'px-3 py-3' : 'px-4 py-6'} ${presentation ? 'max-w-[1400px]' : ''}`}>
        <div className={`grid md:gap-6 gap-3 transition-[grid-template-columns] duration-300 ${gridCols}`}>

          {/* LEFT */}
          {!presentation && !leftCollapsed && (
            <div className="flex flex-col space-y-4">
              <Card
                title="Session Information"
                dense={dense}
                gradient
                toolbar={<CollapseBtn open={leftInfoOpen} onClick={() => setLeftInfoOpen(v => !v)} />}
              >
                <Collapse open={leftInfoOpen}>
                  <Field label="Patient Name" value={appt.patientName} />
                  <Field label="Patient ID" value={appt.patientId} />
                  <Field label="Case Name" value={appt.reason} bold />
                  <Field label="Session ID" value={<span className="font-mono">{appt.id}</span>} />
                  <Field label="Session Date" value={new Date(appt.when).toLocaleString()} />
                  <Field label="Clinician" value={appt.clinicianName} />
                  <Field label="Status" value={appt.status} />
                </Collapse>
              </Card>

              {showVitals && (
                <Card title="Live Monitor (via SFU)" dense={dense} gradient toolbar={<CollapseBtn open={true} onClick={() => setShowVitals(v => !v)} />}>
                  <Collapse open={true}>
                    <div className={`grid grid-cols-2 ${dense ? 'gap-2' : 'gap-3'}`}>
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
                <IntegratedIoMTs roomId={roomId} patientId={appt.patientId} dense={dense} defaultOpen />
              </Card>

              <SmartWearablesPanel roomId={roomId} dense={dense} defaultOpen />
            </div>
          )}

          {/* CENTER (video docked here) */}
          <div className="flex flex-col space-y-4">
            <div className="sticky top-4 z-20">
              <Card title={`Consultation — ${appt.patientName}`} dense={dense} gradient>
                <div
                  ref={videoCardRef}
                  onDoubleClick={() => (presentation ? exitPresentation() : enterPresentation())}
                  className={`relative aspect-video w-full rounded-lg overflow-hidden bg-black ring-1 ring-gray-200 group ${presentation ? 'cursor-zoom-out' : 'cursor-default'}`}
                >
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className={`w-full h-full object-cover ring-1 ring-black/10 ${remoteSpeaking ? 'outline outline-4 outline-emerald-400 outline-offset-0 transition-[outline] duration-200' : ''}`}
                  />
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute rounded border border-white/80 shadow-lg object-cover w-40 h-28"
                    style={{ left: `${pip.x}%`, top: `${pip.y}%` }}
                    title="Local preview"
                  />
                  <audio ref={audioSinkRef} autoPlay />

                  {/* RESTORED: Controls bar */}
                  <div
                    className={`absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-white/85 backdrop-blur rounded-full px-2 py-2 shadow ${hoverOpacity} transition-opacity duration-200`}
                  >
                    <IconBtn onClick={toggleMic} aria-label={micOn ? 'Mute mic' : 'Unmute mic'} aria-pressed={micOn} role="switch" aria-checked={micOn}>
                      <Icon name="mic" toggledName="mic-off" toggled={!micOn} />
                    </IconBtn>
                    <IconBtn onClick={toggleCam} aria-label={camOn ? 'Stop camera' : 'Start camera'} aria-pressed={camOn} role="switch" aria-checked={camOn}>
                      <Icon name="video" toggledName="video-off" toggled={!camOn} />
                    </IconBtn>
                    <IconBtn title={showVitals ? 'Hide vitals' : 'Show vitals'} aria-pressed={showVitals} onClick={() => toggleAndBroadcast('vitals', !showVitals, setShowVitals)}>
                      <Icon name="heart" />
                    </IconBtn>
                    <IconBtn title={captionsOn ? 'Disable captions' : 'Enable captions'} aria-pressed={captionsOn} onClick={() => toggleAndBroadcast('captions', !captionsOn, setCaptionsOn)}>
                      <Icon name="cc" />
                    </IconBtn>
                    <IconBtn title={showOverlay ? 'Disable overlay' : 'Enable overlay'} aria-pressed={showOverlay} onClick={() => toggleAndBroadcast('overlay', !showOverlay, setShowOverlay)}>
                      <Icon name="layers" />
                    </IconBtn>
                    <IconBtn
                      title={showVitalsOverlay ? 'Hide vitals stream overlay' : 'Show vitals stream overlay'}
                      aria-pressed={showVitalsOverlay}
                      onClick={() => toggleAndBroadcast('vitalsOverlay', !showVitalsOverlay, setShowVitalsOverlay)}
                    >
                      <Icon name="vitals-overlay" />
                    </IconBtn>
                    <IconBtn title={isRecording ? 'Stop recording' : 'Start recording'} aria-pressed={isRecording} onClick={() => toggleAndBroadcast('recording', !isRecording, setIsRecording)}>
                      <Icon name="rec" />
                    </IconBtn>
                    <IconBtn title={xrEnabled ? 'Disable XR broadcast' : 'Enable XR broadcast'} aria-pressed={xrEnabled} onClick={() => toggleAndBroadcast('xr', !xrEnabled, setXrEnabled)}>
                      <Icon name="xr" />
                    </IconBtn>
                  </div>

                  {/* RESTORED: Transparent vitals stream overlay */}
                  {showVitalsOverlay && <VitalsStreamOverlay vitals={vitals} />}

                  {/* Badges */}
                  <div className="absolute top-3 right-3 flex gap-1 drop-shadow-sm pointer-events-none">
                    <Badge label="Vitals" active={showVitals} color="emerald" />
                    <Badge label="Captions" active={captionsOn} color="indigo" />
                    <Badge label="Overlay" active={showOverlay} color="sky" />
                    <Badge label="Stream" active={showVitalsOverlay} color="emerald" />
                    {isRecording && <Badge label="● Recording" active color="red" />}
                    <Badge label="XR" active={xrEnabled} color="gray" />
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* RIGHT */}
          {!presentation && !rightCollapsed && (
            <div className="flex flex-col space-y-4">
              {/* Section title */}
              <div className="px-2">
                <div className="text-sm font-semibold text-gray-800">SOAP, Insights, History</div>
              </div>

              {/* Tabs (Sub, eRx, Conclusions, Insight, History) */}
              <div className="shadow-sm bg-white rounded">
                <div className="flex items-center justify-between p-1">
                  <Tabs<RightTab>
                    active={rightTab}
                    onChange={key => setUi('rightTab', key)}
                    items={[
                      { key: 'soap', label: 'Sub' },            // renamed label only
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
                      <div className="text-xs text-gray-500 mb-2">Quickly capture symptoms, allergies, HPI and codes. Free text always allowed.</div>

                      {/* Current Medication — read-only list */}
                      <div className="mb-2">
                        <div className="text-xs text-gray-500 mb-1">Current Medication</div>
                        {currentMedsList.length === 0 ? (
                          <div className="text-sm text-gray-600 italic">No medications recorded yet.</div>
                        ) : (
                          <ul className="list-disc pl-5 text-sm text-gray-800">
                            {currentMedsList.map((m, i) => (<li key={`${m}-${i}`}>{m}</li>))}
                          </ul>
                        )}
                      </div>

                      {/* Symptoms */}
                      <div className="mt-2 space-y-1">
                        <div className="text-xs text-gray-500">Symptoms (ICD-10 autocomplete; free text allowed)</div>
                        <input
                          list="icd10-suggest-symptoms"
                          className="w-full border rounded px-2 py-1 text-sm"
                          value={icdSympAuto.q || soap.s}
                          onChange={(e) => {
                            icdSympAuto.setQ(e.target.value);
                            setSympCode('');
                            setSoap(s => ({ ...s, s: e.target.value }));
                          }}
                          onFocus={(e) => { const v = e.currentTarget.value; if (v) icdSympAuto.setQ(v); }}
                          onBlur={(e) => {
                            const v = e.currentTarget.value.trim();
                            const direct = v.split(' ')[0];
                            if (direct) { setSympCode(direct); return; }
                            const norm = v.toLowerCase();
                            const opt = icdSympOptionsFinal.find(o =>
                              o.text.toLowerCase().startsWith(norm) || o.code.toLowerCase() === norm
                            );
                            if (opt) setSympCode(opt.code);
                          }}
                          placeholder="Type to search ICD-10 (free text allowed)"
                          aria-label="Symptoms"
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                        />
                        <datalist id="icd10-suggest-symptoms">
                          {icdSympOptionsFinal.map(o => <option key={o.code} value={o.text} />)}
                        </datalist>
                        {sympCode && (
                          <div className="text-[11px] text-gray-600">
                            Selected code: <span className="font-mono">{sympCode}</span>
                          </div>
                        )}
                      </div>

                      <TextBlock label="Allergies" value={soap.o} onChange={v => setSoap({ ...soap, o: v })} />
                      <TextBlock label="Presenting Complaints" value={soap.a} onChange={v => setSoap({ ...soap, a: v })} />
                      <TextBlock label="History of Present Illness (HPI)" value={soap.p} onChange={v => setSoap({ ...soap, p: v })} multiline />

                      {/* NOTE: Diagnosis moved to SessionConclusions as requested */}

                      <TextBlock label="Patient Education" value="" onChange={() => {}} multiline />
                    </Card>
                  )}

                  {rightTab === 'erx' && (
                    <Card
                      title="eRx Composer"
                      dense={dense}
                      gradient
                      toolbar={<button className="text-xs px-2 py-1 border rounded" onClick={sendErx}>Send eRx</button>}
                    >
                      <div className="text-xs text-gray-500 mb-2">Add one or more drugs and optional lab tests. We’ll package routing when you send eRx.</div>

                      {/* Legacy datalists kept (safe no-op) */}
                      <datalist id="drug-suggest">
                        {DRUG_SUGGESTIONS.map(d => <option key={d} value={d} />)}
                      </datalist>
                      <datalist id="icd10-suggest">
                        {ICD10_SUGGESTIONS.map(c => <option key={c} value={c} />)}
                      </datalist>

                      {/* RxNorm shared datalist */}
                      <datalist id="rxnorm-suggest">
                        {rxOptionsFinal.map((o, k) => (
                          <option key={`${o.rxcui || k}-${o.name}`} value={o.name || ''} />
                        ))}
                      </datalist>

                      {/* Pharmacy */}
                      {rxRows.map((r, i) => (
                        <div key={i} className="mt-2 space-y-2 border rounded p-2 bg-white">
                          <input
                            className="border rounded px-2 py-1 w-full"
                            placeholder="Drug (start typing…)"
                            list="rxnorm-suggest"
                            value={r.drug}
                            onFocus={(e) => {
                              const v = e.currentTarget.value;
                              if (v) rxAuto.setQ(v);
                            }}
                            onChange={(e) => {
                              const v = e.target.value;
                              rxAuto.setQ(v);
                              setRxRows((x) => x.map((y, j) => j === i ? { ...y, drug: v } : y));
                            }}
                            onBlur={(e) => {
                              const pickedName = normalize(e.currentTarget.value);
                              if (!pickedName) return;
                              const opts = (rxAuto.opts as RxNormHit[]) || [];
                              const picked =
                                opts.find(o => normalize(o.name || '').toLowerCase() === pickedName.toLowerCase()) ||
                                opts.find(o => normalize(o.name || '').toLowerCase().startsWith(pickedName.toLowerCase()));
                              if (picked?.rxcui) {
                                setRxRows(x => x.map((y,j) => j===i ? { ...y, notes: y.notes || `RxCUI:${picked.rxcui}` } : y));
                              }
                            }}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                          />
                          <div className="grid md:grid-cols-6 gap-2">
                            <input className="border rounded px-2 py-1" placeholder="Dose" value={r.dose} onChange={(e)=>setRxRows(x=>x.map((y,j)=>j===i?{...y, dose:e.target.value}:y))} />
                            <input className="border rounded px-2 py-1" placeholder="Route" value={r.route} onChange={(e)=>setRxRows(x=>x.map((y,j)=>j===i?{...y, route:e.target.value}:y))} />
                            <input className="border rounded px-2 py-1" placeholder="Frequency" value={r.freq} onChange={(e)=>setRxRows(x=>x.map((y,j)=>j===i?{...y, freq:e.target.value}:y))} />
                            <input className="border rounded px-2 py-1" placeholder="Duration" value={r.duration} onChange={(e)=>setRxRows(x=>x.map((y,j)=>j===i?{...y, duration:e.target.value}:y))} />
                            <input className="border rounded px-2 py-1" placeholder="Qty" value={r.qty} onChange={(e)=>setRxRows(x=>x.map((y,j)=>j===i?{...y, qty:e.target.value}:y))} />
                            <input className="border rounded px-2 py-1" type="number" placeholder="Refills" value={r.refills} onChange={(e)=>setRxRows(x=>x.map((y,j)=>j===i?{...y, refills:Number(e.target.value)||0}:y))} />
                          </div>
                          <div className="grid grid-cols-12 gap-2 items-center">
                            <input className="border rounded px-2 py-1 col-span-10" placeholder="Notes (optional)" value={r.notes || ''} onChange={(e) => setRxRows((x) => x.map((y, j) => j === i ? { ...y, notes: e.target.value } : y))} />
                            <div className="col-span-2 flex justify-end">
                              <button className="px-2 py-1 border rounded text-xs" onClick={() => removeRxRow(i)}>Remove</button>
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className="pt-2 flex flex-wrap gap-2">
                        <button className="px-2 py-1 border rounded text-xs" onClick={addRxRow}>Add drug</button>
                        <button className="px-2 py-1 border rounded text-xs" onClick={() => pushOrder('CarePort')}>Push to CarePort</button>
                        <button className="px-2 py-1 border rounded text-xs" onClick={() => pushOrder('MedReach')}>Push to MedReach</button>
                      </div>

                      {/* Laboratory */}
                      <div className="text-sm font-semibold mt-4">Laboratory</div>
                      <div className="text-xs text-gray-500 mb-1">Test name on its own line; then Priority, Specimen, ICD-10 on one row; optional instructions below.</div>

                      {labRows.map((r, i) => (
                        <div key={i} className="mt-2 space-y-2 border rounded p-2 bg-white">
                          <input className="border rounded px-2 py-1 w-full" placeholder="Test name (e.g., CBC, CMP, SARS-CoV-2 PCR)" value={r.test} onChange={(e) => setLabRows((x) => x.map((y, j) => j === i ? { ...y, test: e.target.value } : y))} />
                          <div className="grid md:grid-cols-4 gap-2 items-center">
                            <select className="border rounded px-2 py-1" value={r.priority} onChange={(e) => setLabRows((x) => x.map((y, j) => j === i ? { ...y, priority: e.target.value as LabRow['priority'] } : y))}>
                              <option value="">Priority</option>
                              <option value="Routine">Routine</option>
                              <option value="Urgent">Urgent</option>
                              <option value="Stat">Stat</option>
                            </select>
                            <input className="border rounded px-2 py-1" placeholder="Specimen (e.g., blood, urine)" value={r.specimen} onChange={(e) => setLabRows((x) => x.map((y, j) => j === i ? { ...y, specimen: e.target.value } : y))} />
                            <input className="border rounded px-2 py-1" list="icd10-suggest" placeholder="ICD-10 (optional)" value={r.icd} onChange={(e) => setLabRows((x) => x.map((y, j) => j === i ? { ...y, icd: e.target.value } : y))} />
                            <div className="flex justify-end">
                              <button className="px-2 py-1 border rounded text-xs" onClick={() => removeLabRow(i)}>Remove</button>
                            </div>
                          </div>
                          <input className="border rounded px-2 py-1 w-full" placeholder="Instructions / clinical info (optional)" value={r.instructions || ''} onChange={(e) => setLabRows((x) => x.map((y, j) => j === i ? { ...y, instructions: e.target.value } : y))} />
                        </div>
                      ))}

                      <div className="pt-2 flex flex-wrap gap-2">
                        <button className="px-2 py-1 border rounded text-xs" onClick={addLabRow}>Add test</button>
                      </div>

                      {erxResult && (
                        <div className="mt-3 border rounded p-3 bg-white text-sm">
                          {erxResult.error ? <div className="text-red-600">{erxResult.error}</div> : (
                            <>
                              <div>eRx ID: <b>{erxResult.id}</b></div>
                              <div>Status: <b>{erxResult.status}</b></div>
                              <div>Dispense Code: <b>{erxResult.dispenseCode}</b></div>
                            </>
                          )}
                        </div>
                      )}
                    </Card>
                  )}

                  {rightTab === 'conclusions' && (
                    <Card title="Conclusions" dense={dense} gradient>
                      <div className="text-xs text-gray-500 mb-2">Summarize and finalize. You can also prepare referrals below.</div>
                      <SessionConclusions
                        clinicianId={searchParams.get('clinicianId') || 'clinician-local-001'}
                        encounterId={searchParams.get('encounterId') || ''}
                        apptStartISO={appt.when}
                        referralSlot={<ReferralPanel />}
                      />
                    </Card>
                  )}

                  {rightTab === 'insight' && (
                    <Card title="InsightCore" dense={dense} gradient>
                      <div className="text-xs text-gray-500 mb-2">Draft AI assistance. Review suggestions carefully before accepting.</div>
                      <InsightPanel insight={insight} busy={insightBusy} onAnalyze={analyzeWithInsight} />
                      <div className="mt-2 flex gap-2">
                        <button className="px-2 py-1 border rounded text-xs" onClick={acceptInsight} disabled={!insight}>Accept</button>
                        <button className="px-2 py-1 border rounded text-xs" onClick={adjustInsight} disabled={!insight}>Adjust</button>
                        <button className="px-2 py-1 border rounded text-xs" onClick={declineInsight} disabled={!insight}>Decline</button>
                      </div>
                    </Card>
                  )}

                  {/* History tab */}
                  {rightTab === 'history' && (
                    <Card title="History" dense={dense} gradient>
                      <div className="text-xs text-gray-500 mb-2">Past clinical data will appear here when available.</div>
                      <div className="space-y-3">
                        <HistoryPane title="Cases" />
                        <HistoryPane title="Conditions" />
                        <HistoryPane title="Pharm. Prescriptions" />
                        <HistoryPane title="Lab. Investigations" />
                        <HistoryPane title="Operations" />
                        <HistoryPane title="Vaccinations" />
                      </div>
                    </Card>
                  )}
                </>
              </Collapse>

              {/* Room Chat */}
              <Card
                title={<span>Room Chat {unread > 0 ? <span className="ml-1 inline-flex items-center justify-center text-[11px] leading-none px-1.5 py-0.5 rounded-full bg-red-600 text-white">{unread}</span> : null}</span>}
                dense={dense}
                gradient
                toolbar={<CollapseBtn open={chatVisible} onClick={() => { setUi('chatVisible', !chatVisible); if (!chatVisible) setUnread(0); }} />}
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
                      placeholder={state === 'connected' ? 'Type message… (Enter to send, Shift+Enter for newline)' : 'Join the room to send messages'}
                      aria-label="Type chat message"
                      disabled={state !== 'connected'}
                    />
                    <button
                      onClick={() => { if (!msgSending) sendMsg(); }}
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

              {/* Bottom: Bedside Monitor */}
              <section ref={vitalsGraphHolder.ref}>
                <Card
                  title="Bedside Monitor (live)"
                  dense={dense}
                  gradient
                  toolbar={<CollapseBtn open={rightIomtOpen} onClick={() => setRightIomtOpen(v => !v)} />}
                >
                  <Collapse open={rightIomtOpen}>
                    {vitalsGraphHolder.mounted ? (
                      <ClinicianVitalsPanel room={room} defaultCollapsed={false} maxPoints={240} showDockBadge={false} />
                    ) : <Skeleton height="h-40" />}
                  </Collapse>
                </Card>
              </section>
            </div>
          )}
        </div>
      </div>

      {/* Help modal */}
      {helpOpen && (
        <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
          <div className="w-full max-w-md rounded-lg bg-white shadow border p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">Keyboard Shortcuts</div>
              <button className="text-xs text-gray-500 hover:text-gray-800" onClick={() => setHelpOpen(false)}>Close</button>
            </div>
            <ul className="text-sm space-y-1">
              <li><b>M</b> — Toggle mic</li>
              <li><b>V</b> — Toggle camera</li>
              <li><b>C</b> — Toggle captions</li>
              <li><b>O</b> — Toggle overlay</li>
              <li><b>H</b> — Toggle vitals</li>
              <li><b>S</b> — Toggle vitals stream overlay</li>
              <li><b>R</b> — Toggle recording</li>
              <li><b>X</b> — Toggle XR broadcast</li>
              <li><b>F</b> — Full screen</li>
              <li><b>L</b> — Toggle left pane</li>
              <li><b>K</b> — Toggle right pane</li>
              <li><b>?</b> — Show this help</li>
            </ul>
          </div>
        </div>
      )}

      {/* Toasts */}
      <ToastViewport toasts={toasts} onClose={closeToast} />
    </div>
  );
}

/** ---------- Transparent Vitals Stream Overlay (middle-right) ---------- */
function VitalsStreamOverlay({ vitals }: { vitals: Vitals }) {
  const rows: { key: string; label: string; value: string; icon?: JSX.Element }[] = [
    { key: 'BP',   label: 'BP',   value: fmtBP(vitals.sys, vitals.dia) },
    { key: 'SpO2', label: 'SpO₂', value: Number.isFinite(vitals.spo2 as number) ? `${num2(vitals.spo2)} %` : '—' },
    { key: 'Temp', label: 'Temp', value: Number.isFinite(vitals.tempC as number) ? `${num2(vitals.tempC)} °C` : '—' },
    { key: 'HR',   label: 'HR',   value: Number.isFinite(vitals.hr as number) ? `${num2(vitals.hr)} bpm` : '—' },
    { key: 'RR',   label: 'RR',   value: Number.isFinite(vitals.rr as number) ? `${num2(vitals.rr)} /min` : '—' },
  ];

  return (
    <div
      className="absolute right-3 top-1/2 -translate-y-1/2 z-20 pointer-events-none select-none"
      aria-hidden="true"
    >
      <div className="flex flex-col gap-1 text-white drop-shadow">
        {rows.map(r => (
          <div key={r.key} className="flex items-center gap-2">
            <span className="text-[11px] opacity-90">{r.label}</span>
            <span className="text-sm font-semibold">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** ---------- Simple History Pane (placeholder) ---------- */
function HistoryPane({ title }: { title: string }) {
  return (
    <div className="border rounded bg-white p-2">
      <div className="text-sm font-medium mb-1">{title}</div>
      <div className="text-xs text-gray-500 flex items-center gap-2">
        <span aria-hidden>🗂️</span>
        <span className="italic">No records to display.</span>
      </div>
    </div>
  );
}

/** ---------- Referral Panel (Internal + External) ---------- */
function ReferralPanel() {
  type Clin = {
    id: string; name: string; specialty: string; location: string;
    gender?: string; cls?: 'Doctor' | 'Allied Health' | 'Wellness';
    priceZAR?: number; rating?: number; online?: boolean;
  };
  const UI_CLASSES = ['Doctors', 'Allied Health', 'Wellness'] as const;
  type UIClass = typeof UI_CLASSES[number];
  const toDataClass = (tab: UIClass): Clin['cls'] => (tab === 'Doctors' ? 'Doctor' : tab);

  const [rawList, setRawList] = useState<Clin[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Filters
  const [tab, setTab] = useState<UIClass>('Doctors');
  const [filters, setFilters] = useState({ q: '', specialty: '', gender: '', location: '' });

  // Exclusivity: internal vs external
  const [mode, setMode] = useState<'internal' | 'external' | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch('/api/clinicians?limit=500', { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const js = await r.json();
        const items = (js?.items || []) as Clin[];
        if (!Array.isArray(items) || items.length === 0) throw new Error('empty');
        setRawList(
          items.map((c: any) => ({
            id: c.id,
            name: c.name,
            specialty: c.specialty || '',
            location: c.location || '',
            gender: (c.gender || '').trim(),
            cls: c.cls || 'Doctor',
            priceZAR: c.priceZAR,
            rating: c.rating,
            online: c.online,
          }))
        );
      } catch {
        const mock: Clin[] = [
          { id: 'clin-za-001', name: 'Dr Ama Ndlovu', specialty: 'GP', location: 'Johannesburg', gender: 'Female', cls: 'Doctor', priceZAR: 500, rating: 4.7, online: true },
          { id: 'clin-za-002', name: 'Dr Jane Smith', specialty: 'Cardiology', location: 'Cape Town', gender: 'Female', cls: 'Doctor', priceZAR: 850, rating: 4.8, online: true },
          { id: 'clin-za-003', name: 'Dr Adam Lee', specialty: 'ENT', location: 'Johannesburg', gender: 'Male', cls: 'Doctor', priceZAR: 700, rating: 4.6, online: true },
          { id: 'clin-za-101', name: 'RN T. Dube', specialty: 'Nurse', location: 'Durban', gender: 'Male', cls: 'Allied Health', priceZAR: 300, rating: 4.5, online: false },
          { id: 'clin-za-201', name: 'Coach L. Maseko', specialty: 'Therapist', location: 'Pretoria', gender: 'Female', cls: 'Wellness', priceZAR: 400, rating: 4.4, online: true },
        ];
        setRawList(mock);
      } finally { setLoading(false); }
    })();
  }, []);

  const scoped = useMemo(() => rawList.filter(c => c.cls === toDataClass(tab)), [rawList, tab]);

  const specialties = useMemo(
    () => Array.from(new Set(scoped.map(c => c.specialty))).filter(Boolean),
    [scoped]
  );
  const genders = useMemo(() => {
    const set = new Set(scoped.map(c => (c.gender || '').trim()).filter(Boolean));
    const arr = Array.from(set);
    return arr.length ? arr : ['Male', 'Female', 'Other'];
  }, [scoped]);
  const locations = useMemo(
    () => Array.from(new Set(scoped.map(c => c.location))).filter(Boolean),
    [scoped]
  );

  const filtered = useMemo(() => {
    let L = scoped;
    const q = filters.q.trim().toLowerCase();
    if (q) L = L.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.specialty.toLowerCase().includes(q) ||
      c.location.toLowerCase().includes(q)
    );
    if (filters.specialty) L = L.filter(c => c.specialty === filters.specialty);
    if (filters.gender)    L = L.filter(c => (c.gender || '').trim() === filters.gender);
    if (filters.location)  L = L.filter(c => c.location === filters.location);
    L = [...L].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return L;
  }, [scoped, filters]);

  const [selId, setSelId] = useState<string>('');
  const sel = filtered.find(c => c.id === selId) || null;

  // External manual
  const [extName, setExtName] = useState('');
  const [extEmail, setExtEmail] = useState('');
  const [extPhone, setExtPhone] = useState('');

  const emailOk = useMemo(() => {
    if (!extEmail.trim()) return false;
    const re = /^[^\s"<>@]+@[^\s"<>@]+\.[A-Za-z]{2,}$/;
    return re.test(extEmail.trim());
  }, [extEmail]);
  const phoneOk = useMemo(() => /^\d{7,15}$/.test(extPhone), [extPhone]);

  useEffect(() => { if (selId) setMode('internal'); }, [selId]);
  useEffect(() => { if (extName || extEmail || extPhone) setMode('external'); }, [extName, extEmail, extPhone]);

  const disableInternal = mode === 'external';
  const disableExternal = mode === 'internal';

  return (
    <div className="space-y-4">
      {/* Internal referral */}
      <div className={`border rounded p-3 ${disableInternal ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">Refer within Ambulant+</div>
          <div className="flex items-center gap-2">
            {(['Doctors','Allied Health','Wellness'] as const).map(cls => (
              <button
                key={cls}
                onClick={() => { setTab(cls); setSelId(''); setMode('internal'); }}
                className={`px-2 py-1 text-xs rounded-full border ${tab === cls ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-100'}`}
                disabled={disableInternal}
              >
                {cls}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="grid md:grid-cols-4 gap-2 mb-2">
          <input
            type="text"
            placeholder="Search name or specialty"
            value={filters.q}
            onChange={e => { setFilters(f => ({ ...f, q: e.target.value })); setMode('internal'); }}
            className="rounded border p-2 text-sm"
            disabled={disableInternal || loading}
          />
          <select
            value={filters.specialty}
            onChange={e => { setFilters(f => ({ ...f, specialty: e.target.value })); setMode('internal'); }}
            className="rounded border p-2 text-sm"
            disabled={disableInternal || loading}
          >
            <option value="">All Specialties</option>
            {specialties.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filters.gender}
            onChange={e => { setFilters(f => ({ ...f, gender: e.target.value })); setMode('internal'); }}
            className="rounded border p-2 text-sm"
            disabled={disableInternal || loading}
          >
            <option value="">Any Gender</option>
            {genders.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select
            value={filters.location}
            onChange={e => { setFilters(f => ({ ...f, location: e.target.value })); setMode('internal'); }}
            className="rounded border p-2 text-sm"
            disabled={disableInternal || loading}
          >
            <option value="">Any Location</option>
            {locations.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div className="grid md:grid-cols-2 gap-2 items-end">
          <label className="text-xs flex flex-col">
            <span className="text-gray-600 mb-1">Select Clinician</span>
            <select
              className="border rounded px-2 py-1"
              value={selId}
              onChange={(e) => { setSelId(e.target.value); setMode('internal'); }}
              disabled={loading || disableInternal}
              aria-label="Select clinician for internal referral"
            >
              <option value="">{loading ? 'Loading…' : 'Choose a clinician'}</option>
              {filtered.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.specialty || '—'} — {c.location || '—'} ({c.id})
                </option>
              ))}
            </select>
          </label>

        <div className="flex justify-end">
            <button
              className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={!sel || disableInternal}
              onClick={() => {
                if (!sel) return;
                alert(`Internal referral prepared for ${sel.name} (${sel.id})`);
              }}
            >
              Prepare Referral
            </button>
          </div>
        </div>

        {sel && (
          <div className="mt-3 rounded border bg-white p-2 text-sm">
            <div className="grid md:grid-cols-2 gap-2">
              <div><b>Name</b><div>{sel.name}</div></div>
              <div><b>Clinician ID</b><div className="font-mono">{sel.id}</div></div>
              <div><b>Specialty</b><div>{sel.specialty || '—'}</div></div>
              <div><b>Location</b><div>{sel.location || '—'}</div></div>
            </div>
          </div>
        )}
      </div>

      {/* External referral */}
      <div className={`border rounded p-3 ${disableExternal ? 'opacity-60' : ''}`}>
        <div className="text-sm font-medium mb-2">Refer outside Ambulant+</div>
        <div className="grid md:grid-cols-3 gap-2">
          <input
            className="border rounded px-2 py-1"
            placeholder="Clinician name"
            value={extName}
            onChange={(e)=>{ setExtName(e.target.value); setMode('external'); setSelId(''); }}
            disabled={disableExternal}
          />
          <input
            className="border rounded px-2 py-1"
            placeholder="Email"
            type="email"
            value={extEmail}
            onChange={(e)=>{ setExtEmail(e.target.value); setMode('external'); setSelId(''); }}
            disabled={disableExternal}
            aria-invalid={!!extEmail && (!/^[^\s"<>@]+@[^\s"<>@]+\.[A-Za-z]{2,}$/.test(extEmail)).toString()}
          />
          <input
            className="border rounded px-2 py-1"
            placeholder="Mobile (digits only)"
            inputMode="numeric"
            value={extPhone}
            onChange={(e)=>{
              const digitsOnly = e.target.value.replace(/\D+/g,'');
              setExtPhone(digitsOnly);
              setMode('external'); setSelId('');
            }}
            disabled={disableExternal}
          />
        </div>
        <div className="mt-2 flex justify-end">
          <button
            className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={disableExternal || !extName || !/^[^\s"<>@]+@[^\s"<>@]+\.[A-Za-z]{2,}$/.test(extEmail) || (extPhone ? !/^\d{7,15}$/.test(extPhone) : false)}
            onClick={() => {
              alert(`External referral prepared for ${extName} (${extEmail}${extPhone ? `, ${extPhone}` : ''})`);
            }}
          >
            Prepare Referral
          </button>
        </div>
      </div>
    </div>
  );
}
