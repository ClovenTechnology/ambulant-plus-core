'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ConnectionQuality,
  Room,
  RoomEvent,
  type ConnectionState,
  type Participant,
  type RemoteParticipant,
} from 'livekit-client';

import { connectRoom } from '@ambulant/rtc';

import { ToastProvider, useToast } from '@/components/ToastMount';
import useVitalsSSE from '@/components/useVitalsSSE';
import IoMTPane from '@/components/iomt/Pane';
import {
  TOPIC_CHAT,
  TOPIC_CONTROL,
  TOPIC_ROSTER,
  type RosterEnvelope,
  type RoomParty,
  type UnifiedControlEnvelope,
  type UnifiedControlKey,
  isRosterEnvelope,
  isUnifiedControlKey,
} from '@/src/lib/rtc/roster-contract';
import { applyRosterEvent } from '@/src/lib/rtc/roster-state';
import { readRoomSessionContext } from '@/src/lib/televisit/room-session-context';
import { bootstrapRosterFromAppointment } from '@/src/lib/televisit/roster-bootstrap';
import {
  reconcileParticipantConnected,
  reconcileParticipantDisconnected,
} from '@/src/lib/televisit/roster-live-reconcile';
import usePaymentApproval from '@/src/hooks/usePaymentApproval';

import PatientLeftPane from './PatientLeftPane';
import PatientRightPane, {
  type Allergy,
  type HistoryEntry,
  type InboxItem,
  type PatientRightTab,
  type UploadItem,
} from './PatientRightPane';
import PatientSfuHeader from './PatientSfuHeader';
import PatientVideoStage from './PatientVideoStage';
import PatientApprovalSheet from './PatientApprovalSheet';

type Props = {
  params: { roomId: string };
};

type AppointmentMeta = {
  id: string;
  when: string | null;
  patientId: string;
  patientName: string;
  clinicianName: string;
  clinicianSpecialty?: string;
  reason: string;
  status: string;
  feeZar?: number;
  coupon?: { applied: boolean; code: string; percent?: number };
};

type PatientChatMessage = {
  id: string;
  from: 'patient' | 'clinician' | 'system';
  text: string;
  ts: number;
};

function chatSenderLabel(from: PatientChatMessage['from']) {
  if (from === 'patient') return 'You';
  if (from === 'clinician') return 'Clinician';
  return 'System';
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function safeJsonParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function getUid(): string {
  if (typeof window === 'undefined') return 'server-user';
  const key = 'ambulant_uid';
  try {
    let v = localStorage.getItem(key);
    if (!v) {
      v = `${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}-u`;
      localStorage.setItem(key, v);
    }
    return v;
  } catch {
    return `tab-${Math.random().toString(36).slice(2)}-u`;
  }
}

function getJoinToken(search: URLSearchParams, visitId: string, roomId: string) {
  const direct =
    search.get('joinToken') ||
    search.get('jt') ||
    search.get('join') ||
    '';

  if (direct) {
    try {
      sessionStorage.setItem(`televisit_join_${visitId}`, direct);
      sessionStorage.setItem(`televisit_join_${roomId}`, direct);
    } catch {
      // ignore
    }
    return direct;
  }

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
      const v = sessionStorage.getItem(k) || localStorage.getItem(k);
      if (v && v.trim()) return v.trim();
    } catch {
      // ignore
    }
  }

  return '';
}

function toUiConnState(
  s: ConnectionState | string | undefined | null,
): 'disconnected' | 'connecting' | 'connected' | 'reconnecting' {
  const t = String(s ?? '').toLowerCase();
  if (t.includes('reconnect')) return 'reconnecting';
  if (t.includes('connect') && !t.includes('dis')) return 'connected';
  if (t.includes('connect')) return 'connecting';
  return 'disconnected';
}

function firstRemote(r: Room): RemoteParticipant | undefined {
  const it = r.remoteParticipants.values();
  const next = it.next();
  return next.done ? undefined : next.value;
}

function safeDetachRemote(
  r: Room,
  remoteVideoEl: HTMLVideoElement | null,
  audioEl: HTMLAudioElement | null,
) {
  try {
    const rp = firstRemote(r);
    if (!rp) return;
    if (remoteVideoEl) {
      for (const pub of rp.videoTrackPublications.values()) {
        pub.videoTrack?.detach(remoteVideoEl);
      }
    }
    if (audioEl) {
      for (const pub of rp.audioTrackPublications.values()) {
        pub.audioTrack?.detach(audioEl);
      }
    }
  } catch {
    // ignore
  }
}

function safeDetachLocal(r: Room, localVideoEl: HTMLVideoElement | null) {
  try {
    if (!localVideoEl) return;
    for (const pub of r.localParticipant.videoTrackPublications.values()) {
      pub.videoTrack?.detach(localVideoEl);
    }
  } catch {
    // ignore
  }
}

function InnerPatientSfuShell({ params }: Props) {
  const { roomId } = params;
  const router = useRouter();
  const rawSearch = useSearchParams();
  const search = useMemo(() => new URLSearchParams(rawSearch?.toString() ?? ''), [rawSearch]);
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL as string | undefined;
  const toast = useToast();
  const sessionCtx = useMemo(
    () => readRoomSessionContext(search, roomId),
    [search, roomId],
  );

  const encounterId = useMemo(
    () => search.get('encounterId') || search.get('encounter') || search.get('enc') || null,
    [search],
  );
  const appointmentId = useMemo(
    () => search.get('appointmentId') || search.get('appointment') || search.get('appt') || null,
    [search],
  );
  const scheduledStartAt = useMemo(
    () => search.get('startsAt') || search.get('scheduledStartAt') || null,
    [search],
  );
  const durationMin = useMemo(() => {
    const raw = search.get('durationMin') || search.get('sessionDurationMin') || '';
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [search]);

  const identity = useMemo(() => `patient-${getUid()}`, []);
  const [consentGiven, setConsentGiven] = useState(false);
  const policyUrl = '/policy/televisit.pdf';

  const [dense, setDense] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [presentation, setPresentation] = useState(false);

  const [room, setRoom] = useState<Room | null>(null);
  const roomRef = useRef<Room | null>(null);
  const [roster, setRoster] = useState<RoomParty[]>([]);

  useEffect(() => {
    let alive = true;

    async function hydrateRoster() {
      const next = await bootstrapRosterFromAppointment({
        appointmentId: appointmentId ?? sessionCtx.appointmentId ?? null,
        existingRoster: [],
      });
      if (!alive) return;
      setRoster(next);
    }

    void hydrateRoster();
    return () => {
      alive = false;
    };
  }, [appointmentId, sessionCtx.appointmentId]);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  const [state, setState] = useState<'disconnected' | 'connecting' | 'connected' | 'reconnecting'>('disconnected');
  const [quality, setQuality] = useState<ConnectionQuality | undefined>(undefined);
  const qualityLabel = quality !== undefined ? String(ConnectionQuality[quality] ?? quality) : 'Unknown';

  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [showVitals, setShowVitals] = useState(true);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [blurOn, setBlurOn] = useState(false);
  const [activeSpeaking, setActiveSpeaking] = useState(false);

  const [actualStartAt, setActualStartAt] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState('00:00');

  const [videoFloating, setVideoFloating] = useState(false);
  const [videoFloatLocked, setVideoFloatLocked] = useState(true);
  const [pip] = useState({ x: 3, y: 3 });
  const [videoPos, setVideoPos] = useState({ xPct: 10, yPct: 10 });
  const [showControls, setShowControls] = useState(false);
  const draggingRef = useRef<{ active: boolean } | null>(null);
  const touchTimerRef = useRef<number | null>(null);

  const [rightTab, setRightTab] = useState<PatientRightTab>('overview');
  const [rightOpen, setRightOpen] = useState(true);

  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioSinkRef = useRef<HTMLAudioElement | null>(null);
  const videoCardRef = useRef<HTMLDivElement | null>(null);

  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [allergiesLoading, setAllergiesLoading] = useState(false);

  const [currentMeds] = useState<string[]>([
    'Metformin 500 mg PO BID',
    'Atorvastatin 20 mg PO QHS',
  ]);
  const [adherencePct] = useState(88);

  const [historyEntries] = useState<HistoryEntry[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  const objectUrlsRef = useRef<string[]>([]);
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          // ignore
        }
      });
      objectUrlsRef.current = [];
    };
  }, []);

  const appt = useMemo<AppointmentMeta>(
    () => ({
      id: appointmentId || `sfu-${roomId}`,
      when: scheduledStartAt || new Date().toISOString(),
      patientId: search.get('patientId') || search.get('patient') || 'simulation-patient',
      patientName: search.get('patientName') || 'Simulation Patient',
      clinicianName: search.get('clinicianName') || 'Simulation Clinician',
      clinicianSpecialty: search.get('clinicianSpecialty') || 'General Practice',
      reason: search.get('reason') || 'Consultation',
      status: state === 'connected' ? 'In progress' : 'Waiting',
      feeZar: search.get('feeZar') ? Number(search.get('feeZar')) : undefined,
      coupon: search.get('couponCode')
        ? {
            applied: true,
            code: search.get('couponCode') || '',
            percent: search.get('couponPercent')
              ? Number(search.get('couponPercent'))
              : undefined,
          }
        : undefined,
    }),
    [appointmentId, roomId, scheduledStartAt, search, state],
  );

  const { samples } = useVitalsSSE(roomId, 240);

  const hudVitals = useMemo(
    () =>
      samples.slice(-12).map((s) => ({
        t: new Date(s.t).toISOString(),
        type: s.type,
        value: s.value,
        unit:
          s.type === 'hr'
            ? 'bpm'
            : s.type === 'spo2'
              ? '%'
              : s.type === 'temp' || s.type === 'tempC'
                ? '°C'
                : s.type.startsWith('bp_')
                  ? 'mmHg'
                  : s.type === 'glucose'
                    ? 'mg/dL'
                    : undefined,
      })),
    [samples],
  );

  const hudDevices = useMemo(
    () => [
      {
        id: 'rtc-room',
        vendor: 'Ambulant+',
        model: room ? 'Televisit' : 'Standby',
        lastSeenAt: room ? new Date().toISOString() : undefined,
      },
    ],
    [room],
  );

  const loadAllergies = useCallback(async () => {
    setAllergiesLoading(true);
    try {
      const r = await fetch('/api/allergies', { cache: 'no-store' });
      const data = (await r.json().catch(() => [])) as unknown;
      setAllergies(Array.isArray(data) ? (data as Allergy[]) : []);
    } catch {
      setAllergies([]);
    } finally {
      setAllergiesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAllergies();
  }, [loadAllergies]);

  const loadInbox = useCallback(async () => {
    try {
      const r = await fetch('/api/erx/orders', { cache: 'no-store' });
      const js = (await r.json().catch(() => ({}))) as unknown;
      const rows = Array.isArray(js)
        ? js
        : isRecord(js) && Array.isArray(js.orders)
          ? js.orders
          : [];
      const next: InboxItem[] = rows.map((o: any) => ({
        id: o?.id || `it-${Math.random().toString(36).slice(2, 8)}`,
        kind: o?.kind === 'lab' ? 'lab' : 'pharmacy',
        createdAt: o?.createdAt,
        title: o?.title || 'Order',
        details: o?.details || undefined,
      }));
      setInbox(next);
    } catch {
      setInbox([]);
    }
  }, []);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  const onUploadFiles = useCallback(
    (files: FileList | null, kind: UploadItem['kind']) => {
      if (!files?.length) return;
      const next = Array.from(files).map((f) => {
        const url = URL.createObjectURL(f);
        objectUrlsRef.current.push(url);
        return {
          id: `upl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          kind,
          name: f.name,
          size: f.size,
          at: Date.now(),
          by: identity,
          url,
        } satisfies UploadItem;
      });

      setUploads((prev) => [...prev, ...next]);
      toast.success?.('Files queued for this session.');
    },
    [identity, toast],
  );

  const enc = useMemo(() => new TextEncoder(), []);
  const dec = useMemo(() => new TextDecoder(), []);

  const attachTracks = useCallback((r: Room) => {
    try {
      const rp = firstRemote(r);

      if (rp && remoteVideoRef.current) {
        const videoPub = [...rp.videoTrackPublications.values()].find(
          (p) => p.isSubscribed && p.videoTrack,
        );
        videoPub?.videoTrack?.attach(remoteVideoRef.current);
      }

      if (rp && audioSinkRef.current) {
        const audioPub = [...rp.audioTrackPublications.values()].find(
          (p) => p.isSubscribed && p.audioTrack,
        );
        audioPub?.audioTrack?.attach(audioSinkRef.current);
      }

      if (localVideoRef.current) {
        const localPub = [...r.localParticipant.videoTrackPublications.values()].find(
          (p) => p.videoTrack,
        );
        localPub?.videoTrack?.attach(localVideoRef.current);
      }
    } catch {
      // ignore
    }
  }, []);

  const detachTracks = useCallback(() => {
    const r = roomRef.current;
    if (!r) return;
    safeDetachRemote(r, remoteVideoRef.current, audioSinkRef.current);
    safeDetachLocal(r, localVideoRef.current);
  }, []);

  const publishJson = useCallback(
    async (topic: string, payload: unknown) => {
      const r = roomRef.current;
      if (!r) return;
      await r.localParticipant.publishData(enc.encode(JSON.stringify(payload)), {
        reliable: true,
        topic,
      });
    },
    [enc],
  );

  const publishControl = useCallback(
    async (type: UnifiedControlKey, value: boolean | string) => {
      const msg: UnifiedControlEnvelope = {
        type,
        value,
        from: 'patient',
        ts: Date.now(),
      };
      await publishJson(TOPIC_CONTROL, msg);
    },
    [publishJson],
  );

  const payment = usePaymentApproval({
    toast,
    sendPaymentResponse: useCallback(
      async ({
        approved,
        quoteId,
        totalZar,
        invitedClinicians,
        ts,
      }) => {
        await publishJson(TOPIC_CHAT, {
          from: 'patient',
          type: 'payment_response',
          approved,
          quoteId,
          totalZar,
          invitedClinicians,
          roomId: sessionCtx.roomId,
          appointmentId: sessionCtx.appointmentId ?? null,
          encounterId: sessionCtx.encounterId ?? null,
          visitId: sessionCtx.visitId ?? null,
          ts,
        });
      },
      [publishJson, sessionCtx],
    ),
  });

  const [patientChatMessages, setPatientChatMessages] = useState<PatientChatMessage[]>([]);
  const [patientChatDraft, setPatientChatDraft] = useState('');
  const [clinicianTyping, setClinicianTyping] = useState(false);
  const patientChatEndRef = useRef<HTMLDivElement | null>(null);
  const clinicianTypingTimerRef = useRef<number | null>(null);

  const appendIncomingChat = useCallback((message: PatientChatMessage) => {
    setPatientChatMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev;
      return [...prev, message].slice(-80);
    });
  }, []);

  const handleIncomingChatPayload = useCallback(
    (parsed: Record<string, unknown>) => {
      const fromRaw = typeof parsed.from === 'string' ? parsed.from : '';
      const from = fromRaw.toLowerCase();

      if (from === 'patient') return true;

      const type = typeof parsed.type === 'string' ? parsed.type : 'message';

      if (type === 'typing') {
        setClinicianTyping(true);

        if (typeof window !== 'undefined') {
          if (clinicianTypingTimerRef.current) {
            window.clearTimeout(clinicianTypingTimerRef.current);
          }

          clinicianTypingTimerRef.current = window.setTimeout(() => {
            setClinicianTyping(false);
            clinicianTypingTimerRef.current = null;
          }, 2200);
        }

        return true;
      }

      const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
      if (!text) return false;

      const ts = typeof parsed.ts === 'number' && Number.isFinite(parsed.ts) ? parsed.ts : Date.now();
      const id =
        typeof parsed.id === 'string' && parsed.id.trim()
          ? parsed.id.trim()
          : `clinician-${ts}-${Math.random().toString(36).slice(2, 8)}`;

      appendIncomingChat({
        id,
        from: 'clinician',
        text,
        ts,
      });

      return true;
    },
    [appendIncomingChat],
  );

  const sendPatientTyping = useCallback(() => {
    void publishJson(TOPIC_CHAT, {
      type: 'typing',
      from: 'patient',
      ts: Date.now(),
    });
  }, [publishJson]);

  const sendPatientChat = useCallback(async () => {
    const clean = patientChatDraft.trim();
    if (!clean) return;

    const ts = Date.now();
    const message: PatientChatMessage = {
      id: `patient-${ts}-${Math.random().toString(36).slice(2, 8)}`,
      from: 'patient',
      text: clean,
      ts,
    };

    setPatientChatMessages((prev) => [...prev, message].slice(-80));
    setPatientChatDraft('');

    try {
      await publishJson(TOPIC_CHAT, message);
    } catch {
      toast.error?.('Message could not be sent.');
    }
  }, [patientChatDraft, publishJson, toast]);

  useEffect(() => {
    patientChatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [patientChatMessages.length, clinicianTyping]);

  useEffect(() => {
    return () => {
      if (typeof window === 'undefined') return;
      if (clinicianTypingTimerRef.current) {
        window.clearTimeout(clinicianTypingTimerRef.current);
        clinicianTypingTimerRef.current = null;
      }
    };
  }, []);

  const roomCleanupRef = useRef<(() => void) | null>(null);

  const wireRoomEvents = useCallback(
    (r: Room) => {
      const onTrackChange = () => attachTracks(r);

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

      const onParticipantConnected = (p: RemoteParticipant) => {
        attachTracks(r);
        setRoster((prev) =>
          reconcileParticipantConnected({
            prev,
            identity: p.identity,
            metadata: p.metadata,
            joinedAt: Date.now(),
          }),
        );
        const id = (p.identity || '').toLowerCase();
        if (id.includes('clinician')) toast.success?.('Clinician joined.');
      };

      const onParticipantDisconnected = (p: RemoteParticipant) => {
        attachTracks(r);
        setRoster((prev) =>
          reconcileParticipantDisconnected({
            prev,
            identity: p.identity,
            metadata: p.metadata,
            leftAt: Date.now(),
          }),
        );
        const id = (p.identity || '').toLowerCase();
        if (id.includes('clinician')) toast.info?.('Clinician left.');
      };

      const onConnState = (s: ConnectionState) => setState(toUiConnState(s));
      const onQuality = (q: ConnectionQuality, _p: Participant) => setQuality(q);
      const onActiveSpeakers = (speakers: Participant[]) => setActiveSpeaking(speakers.length > 0);

      const onData = (
        payload: Uint8Array,
        _participant?: RemoteParticipant,
        _kind?: unknown,
        topic?: string,
      ) => {
        const parsed = safeJsonParse<unknown>(dec.decode(payload));
        if (!parsed || !isRecord(parsed)) return;

        const t = topic || '';

        if (t === TOPIC_CHAT) {
          if (payment.handleIncomingChatPayload(parsed)) return;
          if (handleIncomingChatPayload(parsed)) return;
          return;
        }

        if (t === TOPIC_CONTROL) {
          const type = parsed.type;
          const value = parsed.value;

          if (!isUnifiedControlKey(type)) return;

          if (type === 'overlay') setShowOverlay(Boolean(value));
          if (type === 'captions') setCaptionsOn(Boolean(value));
          if (type === 'vitals') setShowVitals(Boolean(value));
          if (type === 'recording') {
            setIsRecording(Boolean(value));
            if (Boolean(value)) toast.info?.('Clinician started recording.');
          }
          if (type === 'screenshare') setScreenOn(Boolean(value));
          if (type === 'hand') setHandRaised(Boolean(value));
        }

        if (t === TOPIC_ROSTER) {
          if (!isRosterEnvelope(parsed)) return;
          setRoster((prev) => applyRosterEvent(prev, parsed));
        }
      };

      r.on(RoomEvent.TrackSubscribed, onTrackChange);
      r.on(RoomEvent.TrackUnsubscribed, onTrackChange);
      r.on(RoomEvent.LocalTrackPublished, onTrackChange);
      r.on(RoomEvent.ParticipantConnected, onParticipantConnected);
      r.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      r.on(RoomEvent.ConnectionStateChanged, onConnState);
      r.on(RoomEvent.ConnectionQualityChanged, onQuality);
      r.on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers);
      r.on(RoomEvent.DataReceived, onData);

      attachTracks(r);
      setState(toUiConnState(r.state));
      setQuality(r.localParticipant.connectionQuality);
      onLocalParticipantConnected();

      return () => {
        r.off(RoomEvent.TrackSubscribed, onTrackChange);
        r.off(RoomEvent.TrackUnsubscribed, onTrackChange);
        r.off(RoomEvent.LocalTrackPublished, onTrackChange);
        r.off(RoomEvent.ParticipantConnected, onParticipantConnected);
        r.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
        r.off(RoomEvent.ConnectionStateChanged, onConnState);
        r.off(RoomEvent.ConnectionQualityChanged, onQuality);
        r.off(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers);
        r.off(RoomEvent.DataReceived, onData);
      };
    },
    [attachTracks, dec, handleIncomingChatPayload, payment, toast],
  );

  const join = useCallback(async () => {
    if (!wsUrl) {
      toast.error?.('Missing NEXT_PUBLIC_LIVEKIT_URL');
      return;
    }
    if (state !== 'disconnected') return;

    setState('connecting');

    try {
      const visitId =
        search.get('visitId') ||
        search.get('visit') ||
        search.get('v') ||
        roomId;
      const joinToken = getJoinToken(search, visitId, roomId);
      const participantId =
        search.get('participantId') ||
        search.get('personId') ||
        null;

      if (!joinToken) {
        throw new Error('Missing Televisit join token.');
      }
      if (!participantId) {
        throw new Error('Missing participantId for participant-scoped room admission.');
      }

      const tokenRes = await fetch('/api/rtc/token', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-role': 'patient',
          'x-join-token': joinToken,
        },
        body: JSON.stringify({
          roomId,
          room: roomId,
          visitId,
          appointmentId: appointmentId ?? sessionCtx.appointmentId ?? null,
          participantId,
        }),
      });

      if (!tokenRes.ok) {
        throw new Error(`Token fetch failed (${tokenRes.status})`);
      }

      const tokenJson = (await tokenRes.json()) as { token: string };
      const nextRoom = await connectRoom(wsUrl, tokenJson.token, { autoSubscribe: true });

      roomCleanupRef.current?.();
      roomCleanupRef.current = wireRoomEvents(nextRoom);

      setRoom(nextRoom);
      setState('connected');

      await nextRoom.localParticipant.setMicrophoneEnabled(true);
      await nextRoom.localParticipant.setCameraEnabled(true);
      setMicOn(true);
      setCamOn(true);

      const started = new Date().toISOString();
      setActualStartAt(started);
      toast.success?.('Connected.');
    } catch (err: unknown) {
      console.error('[PatientSFU join] failed', err);
      setState('disconnected');
      toast.error?.(err instanceof Error ? err.message : 'Failed to join room.');
    }
  }, [appointmentId, roomId, search, sessionCtx.appointmentId, state, toast, wireRoomEvents, wsUrl]);

  const leave = useCallback(async () => {
    try {
      roomCleanupRef.current?.();
      roomCleanupRef.current = null;
      detachTracks();
      await roomRef.current?.disconnect();
    } catch {
      // ignore
    }

    setRoom(null);
    setState('disconnected');
    setMicOn(false);
    setCamOn(false);
    setScreenOn(false);
    setHandRaised(false);
    setIsRecording(false);

    if (encounterId) {
      router.push(`/encounters/${encodeURIComponent(encounterId)}?rate=1`);
      return;
    }

    router.push('/appointments');
  }, [detachTracks, encounterId, router]);

  useEffect(() => {
    if (!actualStartAt) {
      setElapsed('00:00');
      return;
    }

    const t = window.setInterval(() => {
      const started = Date.parse(actualStartAt);
      const secs = Math.max(0, Math.floor((Date.now() - started) / 1000));
      const hh = Math.floor(secs / 3600).toString().padStart(2, '0');
      const mm = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
      const ss = (secs % 60).toString().padStart(2, '0');
      setElapsed(hh === '00' ? `${mm}:${ss}` : `${hh}:${mm}:${ss}`);
    }, 1000);

    return () => window.clearInterval(t);
  }, [actualStartAt]);

  useEffect(() => {
    return () => {
      roomCleanupRef.current?.();
      roomRef.current?.disconnect().catch(() => {});
      if (touchTimerRef.current) window.clearTimeout(touchTimerRef.current);
    };
  }, []);

  const kickTouchUi = useCallback(() => {
    setShowControls(true);
    if (touchTimerRef.current) window.clearTimeout(touchTimerRef.current);
    touchTimerRef.current = window.setTimeout(() => setShowControls(false), 2500);
  }, []);

  const toggleFloatLock = useCallback(() => {
    setVideoFloatLocked((prev) => {
      const next = !prev;
      if (next) setVideoFloating(false);
      else setVideoFloating(true);
      return next;
    });
  }, []);

  const startDragVideo = useCallback((clientX: number, clientY: number) => {
    if (videoFloatLocked) return;
    draggingRef.current = { active: true };
    setVideoFloating(true);
    void clientX;
    void clientY;
  }, [videoFloatLocked]);

  const moveDragVideo = useCallback((clientX: number, clientY: number) => {
    if (!draggingRef.current?.active || videoFloatLocked) return;
    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    const w = Math.min(vw, 960);
    const h = (w * 9) / 16;

    const x = ((clientX - w * 0.5) / vw) * 100;
    const y = ((clientY - h * 0.5) / vh) * 100;
    const clamp01 = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    setVideoPos({
      xPct: clamp01(x, 0, 100),
      yPct: clamp01(y, 0, 100),
    });
  }, [videoFloatLocked]);

  const endDragVideo = useCallback(() => {
    if (draggingRef.current) draggingRef.current.active = false;
  }, []);

  const toggleMic = useCallback(() => {
    const next = !micOn;
    setMicOn(next);
    roomRef.current?.localParticipant.setMicrophoneEnabled(next).catch(() => {});
  }, [micOn]);

  const toggleCam = useCallback(() => {
    const next = !camOn;
    setCamOn(next);
    roomRef.current?.localParticipant.setCameraEnabled(next).catch(() => {});
    const r = roomRef.current;
    if (r) attachTracks(r);
  }, [attachTracks, camOn]);

  const toggleVitals = useCallback(async () => {
    const next = !showVitals;
    setShowVitals(next);
    await publishControl('vitals', next);
  }, [publishControl, showVitals]);

  const toggleCaptions = useCallback(async () => {
    const next = !captionsOn;
    setCaptionsOn(next);
    await publishControl('captions', next);
  }, [captionsOn, publishControl]);

  const toggleOverlay = useCallback(async () => {
    const next = !showOverlay;
    setShowOverlay(next);
    await publishControl('overlay', next);
  }, [publishControl, showOverlay]);

  const toggleRecording = useCallback(async () => {
    const next = !isRecording;
    setIsRecording(next);
    await publishControl('recording', next);
  }, [isRecording, publishControl]);

  const toggleScreenShare = useCallback(async () => {
    const r = roomRef.current;
    if (!r) return;
    const next = !screenOn;
    try {
      await r.localParticipant.setScreenShareEnabled(next);
      setScreenOn(next);
      await publishControl('screenshare', next);
    } catch {
      toast.error?.('Screen share failed.');
    }
  }, [publishControl, screenOn, toast]);

  const toggleHand = useCallback(async () => {
    const next = !handRaised;
    setHandRaised(next);
    await publishControl('hand', next);
  }, [handRaised, publishControl]);

  const toggleBlur = useCallback(() => {
    setBlurOn((prev) => !prev);
    toast.info?.('Background blur remains a staged client-side enhancement.');
  }, [toast]);

  const exportAllergies = useCallback(async () => {
    const active = allergies.filter((a) => a.status === 'Active');
    const text = active.length
      ? active
          .map((a) => `• ${a.name || 'Allergy'}${a.severity ? ` (${a.severity})` : ''}${a.note ? ` — ${a.note}` : ''}`)
          .join('\n')
      : 'No active allergies.';

    await publishJson(TOPIC_CHAT, {
      from: 'patient',
      text: `Allergies:\n${text}`,
      ts: Date.now(),
    });

    await publishControl('export', 'allergies');
    toast.success?.('Allergies shared with clinician.');
  }, [allergies, publishControl, publishJson, toast]);

  const gridCols = presentation
    ? 'grid-cols-1'
    : leftCollapsed && rightCollapsed
      ? 'grid-cols-1'
      : leftCollapsed
        ? 'lg:grid-cols-[2fr_1.15fr]'
        : rightCollapsed
          ? 'lg:grid-cols-[1.15fr_2fr]'
          : 'lg:grid-cols-[1.1fr_1.9fr_1.2fr]';

  return (
    <div className="min-h-screen bg-slate-50">
      <PatientSfuHeader
        roomId={roomId}
        state={state}
        quality={quality}
        qualityLabel={qualityLabel}
        consentGiven={consentGiven}
        onConsentChange={setConsentGiven}
        policyUrl={policyUrl}
        dense={dense}
        leftCollapsed={leftCollapsed}
        rightCollapsed={rightCollapsed}
        presentation={presentation}
        scheduledStartAt={scheduledStartAt}
        actualStartAt={actualStartAt}
        durationMin={durationMin}
        roster={roster}
        onToggleDense={() => setDense((v) => !v)}
        onToggleLeft={() => setLeftCollapsed((v) => !v)}
        onToggleRight={() => setRightCollapsed((v) => !v)}
        onTogglePresentation={() => {
          const next = !presentation;
          setPresentation(next);
          if (next) {
            videoCardRef.current?.requestFullscreen?.().catch?.(() => {});
          } else {
            document.exitFullscreen?.().catch?.(() => {});
          }
        }}
        onJoin={join}
        onLeave={leave}
      />

      {videoFloating ? (
        <PatientVideoStage
          floating
          presentation={presentation}
          activeSpeaking={activeSpeaking}
          remoteVideoRef={remoteVideoRef}
          localVideoRef={localVideoRef}
          audioSinkRef={audioSinkRef}
          micOn={micOn}
          camOn={camOn}
          showVitals={showVitals}
          captionsOn={captionsOn}
          showOverlay={showOverlay}
          isRecording={isRecording}
          screenOn={screenOn}
          handRaised={handRaised}
          blurOn={blurOn}
          elapsed={elapsed}
          pip={pip}
          floatingPos={videoPos}
          floatingLocked={videoFloatLocked}
          showControls={showControls}
          hudVitals={hudVitals}
          hudDevices={hudDevices}
          onKickTouchUi={kickTouchUi}
          onToggleMic={toggleMic}
          onToggleCam={toggleCam}
          onToggleVitals={toggleVitals}
          onToggleCaptions={toggleCaptions}
          onToggleOverlay={toggleOverlay}
          onToggleRecording={toggleRecording}
          onToggleScreenShare={toggleScreenShare}
          onToggleHand={toggleHand}
          onToggleBlur={toggleBlur}
          onTogglePresentation={() => setPresentation((v) => !v)}
          onToggleFloatLock={toggleFloatLock}
          onDock={() => setVideoFloating(false)}
          onStartDrag={startDragVideo}
          onMoveDrag={moveDragVideo}
          onEndDrag={endDragVideo}
        />
      ) : null}

      <div className={`mx-auto w-full max-w-[1600px] px-4 ${dense ? 'py-3' : 'py-5'}`}>
        <div className={`grid gap-4 ${gridCols}`}>
          {!presentation && !leftCollapsed ? (
            <PatientLeftPane
              appt={appt}
              roomId={roomId}
              encounterId={encounterId}
              dense={dense}
              embeddedIoMT={<IoMTPane />}
            />
          ) : null}

          <div className="flex flex-col gap-4">
            {!videoFloating ? (
              <div className="sticky top-4 z-20">
                <PatientVideoStage
                  presentation={presentation}
                  activeSpeaking={activeSpeaking}
                  remoteVideoRef={remoteVideoRef}
                  localVideoRef={localVideoRef}
                  audioSinkRef={audioSinkRef}
                  videoCardRef={videoCardRef}
                  micOn={micOn}
                  camOn={camOn}
                  showVitals={showVitals}
                  captionsOn={captionsOn}
                  showOverlay={showOverlay}
                  isRecording={isRecording}
                  screenOn={screenOn}
                  handRaised={handRaised}
                  blurOn={blurOn}
                  elapsed={elapsed}
                  pip={pip}
                  showControls={showControls}
                  hudVitals={hudVitals}
                  hudDevices={hudDevices}
                  onKickTouchUi={kickTouchUi}
                  onToggleMic={toggleMic}
                  onToggleCam={toggleCam}
                  onToggleVitals={toggleVitals}
                  onToggleCaptions={toggleCaptions}
                  onToggleOverlay={toggleOverlay}
                  onToggleRecording={toggleRecording}
                  onToggleScreenShare={toggleScreenShare}
                  onToggleHand={toggleHand}
                  onToggleBlur={toggleBlur}
                  onTogglePresentation={() => setPresentation((v) => !v)}
                  onToggleFloatLock={toggleFloatLock}
                  onDock={() => setVideoFloating(false)}
                  onStartDrag={startDragVideo}
                  onMoveDrag={moveDragVideo}
                  onEndDrag={endDragVideo}
                />
              </div>
            ) : null}
          {!presentation ? (
            <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Consultation chat</div>
                  <div className="text-xs text-slate-500">
                    Secure in-room messages between patient and clinician.
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                  {state === 'connected' ? 'Live' : state}
                </span>
              </div>

              <div className="max-h-72 space-y-3 overflow-y-auto px-4 py-3">
                {patientChatMessages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                    No chat messages yet. Messages from the clinician will appear here.
                  </div>
                ) : (
                  patientChatMessages.map((message) => {
                    const mine = message.from === 'patient';
                    return (
                      <div
                        key={message.id}
                        className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                            mine
                              ? 'bg-slate-900 text-white'
                              : 'border border-slate-200 bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div
                            className={`mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                              mine ? 'text-white/70' : 'text-slate-400'
                            }`}
                          >
                            {chatSenderLabel(message.from)}
                          </div>
                          <div className="whitespace-pre-wrap break-words">{message.text}</div>
                        </div>
                      </div>
                    );
                  })
                )}

                {clinicianTyping ? (
                  <div className="text-xs text-slate-500">Clinician is typing…</div>
                ) : null}

                <div ref={patientChatEndRef} />
              </div>

              <div className="border-t border-slate-100 p-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <textarea
                    className="min-h-[44px] flex-1 resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                    placeholder="Type a message to the clinician…"
                    value={patientChatDraft}
                    rows={2}
                    onChange={(e) => {
                      setPatientChatDraft(e.target.value);
                      sendPatientTyping();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void sendPatientChat();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void sendPatientChat()}
                    disabled={!patientChatDraft.trim() || state !== 'connected'}
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300 sm:self-end"
                  >
                    Send
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          </div>

          {!presentation && !rightCollapsed ? (
            <PatientRightPane
              dense={dense}
              tab={rightTab}
              onChangeTab={setRightTab}
              open={rightOpen}
              onToggleOpen={() => setRightOpen((v) => !v)}
              roster={roster}
              allergies={allergies}
              allergiesLoading={allergiesLoading}
              onRefreshAllergies={loadAllergies}
              onExportAllergies={exportAllergies}
              currentMeds={currentMeds}
              adherencePct={adherencePct}
              historyEntries={historyEntries}
              inbox={inbox}
              onRefreshInbox={loadInbox}
              uploads={uploads}
              onUploadFiles={onUploadFiles}
            />
          ) : null}
        </div>
      </div>

      <PatientApprovalSheet
        open={payment.paymentApprovalOpen}
        quoteId={payment.pendingPaymentRequest?.quoteId || null}
        totalZar={payment.pendingPaymentRequest?.totalZar || null}
        invitedClinicians={payment.pendingPaymentRequest?.invitedClinicians || []}
        onApprove={payment.approve}
        onDecline={payment.decline}
        onClose={payment.dismissPaymentSheet}
        busy={payment.paymentApprovalBusy}
      />
    </div>
  );
}

export default function PatientSfuShell(props: Props) {
  return (
    <ToastProvider>
      <InnerPatientSfuShell {...props} />
    </ToastProvider>
  );
}