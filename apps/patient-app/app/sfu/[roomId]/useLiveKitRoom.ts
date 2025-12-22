// apps/patient-app/app/sfu/[roomId]/useLiveKitRoom.ts
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ConnectionQuality,
  DataPacket_Kind,
  RemoteParticipant,
  Room,
  RoomEvent,
} from 'livekit-client';
import { connectRoom, getOrCreateUid, mintRtcToken } from '@ambulant/rtc';

type SearchLike = { get(k: string): string | null };

export type LKConnState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
export type ToastKind = 'info' | 'success' | 'warning' | 'error';
export type Toast = { id: string; text: string; kind: ToastKind };

function ssSet(k: string, v: string) {
  try {
    sessionStorage.setItem(k, v);
  } catch {}
}
function ssGet(k: string) {
  try {
    return sessionStorage.getItem(k) || '';
  } catch {
    return '';
  }
}
function ssRemove(k: string) {
  try {
    sessionStorage.removeItem(k);
  } catch {}
}
function lsGet(k: string) {
  try {
    return localStorage.getItem(k) || '';
  } catch {
    return '';
  }
}
function lsRemove(k: string) {
  try {
    localStorage.removeItem(k);
  } catch {}
}

function joinKeys(visitId: string, roomId: string) {
  const v = String(visitId || '').trim();
  const r = String(roomId || '').trim();
  const keys = [
    v ? `televisit_join_${v}` : '',
    r ? `televisit_join_${r}` : '',
    v ? `ambulant_join_${v}` : '',
    r ? `ambulant_join_${r}` : '',
    v ? `ambulant_join_token_${v}` : '',
    r ? `ambulant_join_token_${r}` : '',
    'ambulant_join_token',
  ].filter(Boolean);
  return Array.from(new Set(keys));
}

function storeJoinJwt(visitId: string, roomId: string, jwt: string) {
  if (typeof window === 'undefined') return;
  const t = String(jwt || '').trim();
  if (!t) return;
  const keys = joinKeys(visitId, roomId);
  for (const k of keys) ssSet(k, t);
  // scrub localStorage legacy copies
  for (const k of keys) lsRemove(k);
}

function readJoinJwt(visitId: string, roomId: string) {
  if (typeof window === 'undefined') return '';
  const keys = joinKeys(visitId, roomId);

  for (const k of keys) {
    const v = ssGet(k);
    if (v && v.trim()) return v.trim();
  }

  // migrate from legacy localStorage if present
  for (const k of keys) {
    const v = lsGet(k);
    if (v && v.trim()) {
      const jwt = v.trim();
      for (const kk of keys) ssSet(kk, jwt);
      for (const kk of keys) lsRemove(kk);
      return jwt;
    }
  }

  return '';
}

function getJoinToken(search: SearchLike, visitId: string, roomId: string) {
  const direct = search.get('joinToken') || search.get('jt') || search.get('join') || '';
  if (direct) {
    if (typeof window !== 'undefined') {
      storeJoinJwt(visitId, roomId, direct);
    }
    return direct;
  }
  if (typeof window === 'undefined') return '';
  return readJoinJwt(visitId, roomId);
}

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

export function useLiveKitRoom(opts: {
  roomId: string;
  wsUrl?: string;
  search: SearchLike;
  onConnected?: () => void;
  onDisconnected?: () => void;
}) {
  const { roomId, wsUrl, search, onConnected, onDisconnected } = opts;

  // Stable identity
  const uid = useMemo(() => getOrCreateUid('ambulant_uid'), []);
  const identity = uid;

  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioSinkRef = useRef<HTMLAudioElement | null>(null);

  const roomRef = useRef<Room | null>(null);

  const [room, setRoom] = useState<Room | null>(null);
  const [state, setState] = useState<LKConnState>('disconnected');
  const [quality, setQuality] = useState<ConnectionQuality | undefined>(undefined);
  const qualityLabel = quality !== undefined ? ConnectionQuality[quality] : 'Unknown';

  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [showVitals, setShowVitals] = useState(true);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [isRecording, setIsRecording] = useState(false);

  const [screenOn, setScreenOn] = useState(false);
  const [raised, setRaised] = useState(false);
  const [blurOn, setBlurOn] = useState(false);

  const [activeSpeaking, setActiveSpeaking] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const pushToast = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((t) => [...t, { id, text, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const [recordingToast, setRecordingToast] = useState<string | null>(null);

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

  const publishControl = useCallback(async (type: string, value: any) => {
    const r = roomRef.current;
    if (!r) return;
    try {
      await r.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ type, value, from: 'patient' })),
        DataPacket_Kind.RELIABLE,
        'control',
      );
    } catch (e) {
      console.warn('[control] publish error', e);
    }
  }, []);

  const sendChat = useCallback(async (text: string) => {
    const r = roomRef.current;
    if (!r) return;
    await r.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify({ from: 'patient', text })),
      DataPacket_Kind.RELIABLE,
      'chat',
    );
  }, []);

  const wireRoomEvents = useCallback(
    (r: Room) => {
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
        .on(RoomEvent.ActiveSpeakersChanged, (speakers) => setActiveSpeaking(!!(speakers && speakers.length)))
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
                  window.setTimeout(() => setRecordingToast(null), 6000);
                }
                setIsRecording(next);
              }

              if (msg?.type === 'screenshare' && msg.value === true) pushToast('Screen share started', 'info');
            }
          } catch {
            /* ignore */
          }
        });

      attachNow();
    },
    [attachToRoom, pushToast, isRecording],
  );

  const join = useCallback(async () => {
    if (state !== 'disconnected') return;
    setState('connecting');

    try {
      const visitId = search.get('visitId') || search.get('visit') || search.get('v') || roomId;
      const joinToken = getJoinToken(search, visitId, roomId);

      if (!joinToken) {
        setState('disconnected');
        throw new Error(
          [
            'Missing Televisit join token.',
            'Expected query ?jt=... OR sessionStorage key televisit_join_<visitId>.',
            'Open via Appointments → Join (it should store the token).',
          ].join(' '),
        );
      }

      const rtc = await mintRtcToken({
        roomId,
        visitId,
        uid,
        role: 'patient',
        joinToken,
        identity,
        name: identity,
      });

      const livekitUrl = (rtc as any)?.wsUrl || wsUrl;
      if (!livekitUrl) {
        setState('disconnected');
        throw new Error('Missing LiveKit wsUrl (set NEXT_PUBLIC_LIVEKIT_URL or return wsUrl from /api/rtc/token)');
      }

      const token = rtc.token;

      const r = await connectRoom(livekitUrl, token, { autoSubscribe: true });
      roomRef.current = r;
      setRoom(r);
      wireRoomEvents(r);

      setState('connected');
      await r.localParticipant.setMicrophoneEnabled(true);
      await r.localParticipant.setCameraEnabled(true);

      setMicOn(true);
      setCamOn(true);
      setQuality(r.localParticipant.connectionQuality);

      attachToRoom(r);
      pushToast('Connected', 'success');
      onConnected?.();
    } catch (e: any) {
      console.error('[join] failed', e);
      setState('disconnected');
      throw e;
    }
  }, [state, search, roomId, wsUrl, uid, identity, wireRoomEvents, attachToRoom, pushToast, onConnected]);

  const leave = useCallback(async () => {
    try {
      await roomRef.current?.disconnect();
    } catch {}
    roomRef.current = null;

    setRoom(null);
    setState('disconnected');
    setMicOn(false);
    setCamOn(false);
    setRecordingToast(null);
    setIsRecording(false);
    setScreenOn(false);
    setRaised(false);
    setBlurOn(false);
    onDisconnected?.();
  }, [onDisconnected]);

  useEffect(() => {
    return () => {
      try {
        roomRef.current?.disconnect();
      } catch {}
      roomRef.current = null;
    };
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
    if (r) attachToRoom(r);
  }, [camOn, attachToRoom]);

  const toggleAndBroadcast = useCallback(
    (key: 'vitals' | 'captions' | 'overlay' | 'recording', val: boolean) => {
      if (key === 'vitals') setShowVitals(val);
      if (key === 'captions') setCaptionsOn(val);
      if (key === 'overlay') setShowOverlay(val);
      if (key === 'recording') setIsRecording(val);
      publishControl(key, val);
    },
    [publishControl],
  );

  const toggleScreenShare = useCallback(async () => {
    const r = roomRef.current;
    if (!r) return;
    try {
      const next = !screenOn;
      await r.localParticipant.setScreenShareEnabled(next);
      setScreenOn(next);
      publishControl('screenshare', next);
      pushToast(next ? 'Screen sharing on' : 'Screen sharing off', 'info');
    } catch {
      pushToast('Screen share failed', 'error');
    }
  }, [screenOn, publishControl, pushToast]);

  const toggleRaiseHand = useCallback(() => {
    const next = !raised;
    setRaised(next);
    publishControl('raise_hand', next);
    pushToast(next ? 'Hand raised' : 'Hand lowered', 'info');
  }, [raised, publishControl, pushToast]);

  const toggleBlur = useCallback(() => {
    setBlurOn((b) => !b);
    pushToast(!blurOn ? 'Blur on (stub)' : 'Blur off (stub)', 'info');
  }, [blurOn, pushToast]);

  useEffect(() => {
    if (quality === ConnectionQuality.Poor) pushToast('Network unstable', 'warning');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality]);

  return {
    identity,
    room,
    state,
    quality,
    qualityLabel,

    micOn,
    camOn,
    showVitals,
    captionsOn,
    showOverlay,
    isRecording,

    screenOn,
    raised,
    blurOn,

    activeSpeaking,

    toasts,
    pushToast,
    recordingToast,

    join,
    leave,
    toggleMic,
    toggleCam,
    toggleAndBroadcast,
    toggleScreenShare,
    toggleRaiseHand,
    toggleBlur,

    publishControl,
    sendChat,

    remoteVideoRef,
    localVideoRef,
    audioSinkRef,
  };
}
