// apps/patient-app/app/sfu/[roomId]/useLiveKitRoom.ts
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ConnectionQuality,
  RemoteParticipant,
  Room,
  RoomEvent,
} from 'livekit-client';
import { connectRoom, getOrCreateUid, mintRtcToken } from '@ambulant/rtc';

type SearchLike = { get(k: string): string | null };

export type LKConnState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';
export type Toast = { id: string; text: string; kind: ToastKind };

type JoinTokenClaims = {
  uid?: string;
  sub?: string;
  userId?: string;
  u?: string;
  role?: string;
  televisitRole?: string;
  roomId?: string;
  rid?: string;
  room?: string;
  r?: string;
  visitId?: string;
  vid?: string;
  visit?: string;
  v?: string;
};

function ssSet(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage failures, for example private browsing restrictions.
  }
}

function ssGet(key: string) {
  try {
    return sessionStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function lsGet(key: string) {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function lsRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

function joinKeys(visitId: string, roomId: string) {
  const visit = String(visitId || '').trim();
  const room = String(roomId || '').trim();

  const keys = [
    visit ? `televisit_join_${visit}` : '',
    room ? `televisit_join_${room}` : '',
    visit ? `ambulant_join_${visit}` : '',
    room ? `ambulant_join_${room}` : '',
    visit ? `ambulant_join_token_${visit}` : '',
    room ? `ambulant_join_token_${room}` : '',
    'ambulant_join_token',
  ].filter(Boolean);

  return Array.from(new Set(keys));
}

function storeJoinJwt(visitId: string, roomId: string, jwt: string) {
  if (typeof window === 'undefined') return;

  const token = String(jwt || '').trim();
  if (!token) return;

  const keys = joinKeys(visitId, roomId);

  for (const key of keys) {
    ssSet(key, token);
  }

  // Remove legacy persistent copies. Join tickets should be tab/session-scoped.
  for (const key of keys) {
    lsRemove(key);
  }
}

function readJoinJwt(visitId: string, roomId: string) {
  if (typeof window === 'undefined') return '';

  const keys = joinKeys(visitId, roomId);

  for (const key of keys) {
    const value = ssGet(key);
    if (value && value.trim()) return value.trim();
  }

  // Migrate from legacy localStorage if present, then scrub persistent copies.
  for (const key of keys) {
    const value = lsGet(key);

    if (value && value.trim()) {
      const jwt = value.trim();

      for (const sessionKey of keys) {
        ssSet(sessionKey, jwt);
      }

      for (const localKey of keys) {
        lsRemove(localKey);
      }

      return jwt;
    }
  }

  return '';
}

function getJoinToken(search: SearchLike, visitId: string, roomId: string) {
  const direct =
    search.get('joinToken') ||
    search.get('jt') ||
    search.get('join') ||
    '';

  if (direct) {
    const token = direct.trim();
    storeJoinJwt(visitId, roomId, token);
    return token;
  }

  return readJoinJwt(visitId, roomId);
}

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '=',
  );

  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    return window.atob(padded);
  }

  return '';
}

function decodeJoinTokenClaims(jwt: string): JoinTokenClaims | null {
  try {
    const [, payload] = String(jwt || '').split('.');
    if (!payload) return null;

    const json = base64UrlDecode(payload);
    if (!json) return null;

    const parsed = JSON.parse(json);

    return parsed && typeof parsed === 'object'
      ? (parsed as JoinTokenClaims)
      : null;
  } catch {
    return null;
  }
}

function pickClaim(
  claims: JoinTokenClaims | null,
  keys: Array<keyof JoinTokenClaims>,
) {
  if (!claims) return '';

  for (const key of keys) {
    const value = claims[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function firstRemote(room: Room): RemoteParticipant | undefined {
  const anyRoom = room as any;

  if (typeof anyRoom.getParticipants === 'function') {
    const participants = anyRoom.getParticipants();

    if (Array.isArray(participants) && participants.length > 0) {
      return participants[0] as RemoteParticipant;
    }
  }

  const participantMaps = [anyRoom.remoteParticipants, anyRoom.participants];

  for (const participantMap of participantMaps) {
    if (participantMap && typeof participantMap.values === 'function') {
      const iterator = participantMap.values();
      const next = iterator.next();

      if (!next.done) {
        return next.value as RemoteParticipant;
      }
    }
  }

  return undefined;
}

function normaliseLiveKitState(value: unknown): LKConnState {
  const state = String(value || '').toLowerCase();

  if (state === 'connected') return 'connected';
  if (state === 'connecting') return 'connecting';
  if (state === 'reconnecting') return 'reconnecting';

  return 'disconnected';
}

function extractLiveKitUrl(rtc: unknown, fallback?: string) {
  const data = rtc as
    | {
        wsUrl?: string;
        livekitUrl?: string;
        url?: string;
        serverUrl?: string;
      }
    | null
    | undefined;

  return String(
    data?.wsUrl ||
      data?.livekitUrl ||
      data?.url ||
      data?.serverUrl ||
      fallback ||
      '',
  ).trim();
}

function extractLiveKitToken(rtc: unknown) {
  const data = rtc as { token?: string } | null | undefined;
  return String(data?.token || '').trim();
}

export function useLiveKitRoom(opts: {
  roomId: string;
  wsUrl?: string;
  search: SearchLike;
  onConnected?: () => void;
  onDisconnected?: () => void;
}) {
  const { roomId, wsUrl, search, onConnected, onDisconnected } = opts;

  /*
   * Browser-local fallback identity.
   * The actual LiveKit identity is replaced with the join-ticket uid when
   * the patient joins, because the API gateway validates the join ticket as
   * the source of truth.
   */
  const browserUid = useMemo(() => getOrCreateUid('patient'), []);
  const [identity, setIdentity] = useState(browserUid);

  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioSinkRef = useRef<HTMLAudioElement | null>(null);

  const roomRef = useRef<Room | null>(null);

  const [room, setRoom] = useState<Room | null>(null);
  const [state, setState] = useState<LKConnState>('disconnected');
  const [quality, setQuality] = useState<ConnectionQuality | undefined>(
    undefined,
  );

  const qualityLabel =
    quality !== undefined ? ConnectionQuality[quality] : 'Unknown';

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
  const [recordingToast, setRecordingToast] = useState<string | null>(null);

  const isRecordingRef = useRef(false);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const pushToast = useCallback((text: string, kind: ToastKind = 'info') => {
    const id =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `${Date.now().toString(36)}_${performance
            .now()
            .toString(36)
            .replace('.', '')}`;

    setToasts((items) => [...items, { id, text, kind }]);

    window.setTimeout(() => {
      setToasts((items) => items.filter((item) => item.id !== id));
    }, 4500);
  }, []);

  const attachToRoom = useCallback((currentRoom: Room) => {
    const remoteParticipant = firstRemote(currentRoom);

    if (remoteParticipant) {
      const remoteVideoPublication = [
        ...remoteParticipant.videoTrackPublications.values(),
      ].find(
        (publication) => publication.isSubscribed && publication.videoTrack,
      );

      if (remoteVideoPublication?.videoTrack && remoteVideoRef.current) {
        remoteVideoPublication.videoTrack.attach(remoteVideoRef.current);
      }

      const remoteAudioPublication = [
        ...remoteParticipant.audioTrackPublications.values(),
      ].find(
        (publication) => publication.isSubscribed && publication.audioTrack,
      );

      if (remoteAudioPublication?.audioTrack && audioSinkRef.current) {
        remoteAudioPublication.audioTrack.attach(audioSinkRef.current);
      }
    }

    const localVideoPublication = [
      ...currentRoom.localParticipant.videoTrackPublications.values(),
    ].find((publication) => publication.track);

    if (localVideoPublication?.videoTrack && localVideoRef.current) {
      localVideoPublication.videoTrack.attach(localVideoRef.current);
    }
  }, []);

  const publishControl = useCallback(async (type: string, value: unknown) => {
    const currentRoom = roomRef.current;
    if (!currentRoom) return;

    try {
      await currentRoom.localParticipant.publishData(
        new TextEncoder().encode(
          JSON.stringify({
            type,
            value,
            from: 'patient',
            ts: new Date().toISOString(),
          }),
        ),
        {
          reliable: true,
          topic: 'control',
        },
      );
    } catch (error) {
      console.warn('[control] publish error', error);
    }
  }, []);

  const sendChat = useCallback(async (text: string) => {
    const currentRoom = roomRef.current;
    const cleanText = String(text || '').trim();

    if (!currentRoom || !cleanText) return;

    await currentRoom.localParticipant.publishData(
      new TextEncoder().encode(
        JSON.stringify({
          from: 'patient',
          text: cleanText,
          ts: new Date().toISOString(),
        }),
      ),
      {
        reliable: true,
        topic: 'chat',
      },
    );
  }, []);

  const wireRoomEvents = useCallback(
    (currentRoom: Room) => {
      const attachNow = () => attachToRoom(currentRoom);

      currentRoom
        .on(RoomEvent.TrackSubscribed, attachNow)
        .on(RoomEvent.TrackUnsubscribed, attachNow)
        .on(RoomEvent.LocalTrackPublished, attachNow)
        .on(RoomEvent.ParticipantConnected, () => {
          attachNow();
          pushToast('Clinician joined', 'success');
        })
        .on(RoomEvent.ParticipantDisconnected, () => {
          attachNow();
          pushToast('Clinician left', 'warning');
        })
        .on(RoomEvent.ConnectionStateChanged, () => {
          setState(normaliseLiveKitState(currentRoom.state));
        })
        .on(RoomEvent.ConnectionQualityChanged, (nextQuality) => {
          setQuality(nextQuality);
        })
        .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          setActiveSpeaking(Boolean(speakers && speakers.length > 0));
        })
        .on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
          try {
            const text = new TextDecoder().decode(payload);
            const msg = JSON.parse(text);

            if (topic !== 'control') return;

            if (msg?.type === 'vitals') setShowVitals(Boolean(msg.value));
            if (msg?.type === 'captions') setCaptionsOn(Boolean(msg.value));
            if (msg?.type === 'overlay') setShowOverlay(Boolean(msg.value));

            if (msg?.type === 'recording') {
              const nextRecording = Boolean(msg.value);

              if (nextRecording && !isRecordingRef.current) {
                setRecordingToast(
                  'Clinician started recording. You are being recorded.',
                );

                window.setTimeout(() => {
                  setRecordingToast(null);
                }, 6000);
              }

              isRecordingRef.current = nextRecording;
              setIsRecording(nextRecording);
            }

            if (msg?.type === 'screenshare' && msg.value === true) {
              pushToast('Screen share started', 'info');
            }
          } catch {
            // Ignore malformed room data packets.
          }
        });

      attachNow();
    },
    [attachToRoom, pushToast],
  );

  const join = useCallback(async () => {
    if (state !== 'disconnected') return;

    setState('connecting');

    try {
      const visitId =
        search.get('visitId') ||
        search.get('visit') ||
        search.get('v') ||
        roomId;

      const joinToken = getJoinToken(search, visitId, roomId);

      if (!joinToken) {
        setState('disconnected');

        throw new Error(
          [
            'Missing Televisit join token.',
            'Expected query ?jt=... OR sessionStorage key televisit_join_<visitId>.',
            'Open via Appointments → Join so the join ticket is issued and stored.',
          ].join(' '),
        );
      }

      const claims = decodeJoinTokenClaims(joinToken);

      const ticketUid =
        pickClaim(claims, ['uid', 'sub', 'userId', 'u']) || browserUid;

      const ticketRoomId =
        pickClaim(claims, ['roomId', 'rid', 'room', 'r']) || roomId;

      const ticketVisitId =
        pickClaim(claims, ['visitId', 'vid', 'visit', 'v']) || visitId;

      setIdentity(ticketUid);

      const rtc = await mintRtcToken({
        endpoint: '/api/rtc/token',
        roomId: ticketRoomId,
        visitId: ticketVisitId,
        uid: ticketUid,
        role: 'patient',
        joinToken,
        identity: ticketUid,
      });

      const livekitUrl = extractLiveKitUrl(rtc, wsUrl);

      if (!livekitUrl) {
        setState('disconnected');

        throw new Error(
          'Missing LiveKit wsUrl. Set NEXT_PUBLIC_LIVEKIT_URL or return wsUrl from /api/rtc/token.',
        );
      }

      const token = extractLiveKitToken(rtc);

      if (!token) {
        setState('disconnected');
        throw new Error('RTC token endpoint returned no LiveKit token.');
      }

      const nextRoom = await connectRoom(livekitUrl, token, {
        autoSubscribe: true,
      });

      roomRef.current = nextRoom;
      setRoom(nextRoom);
      wireRoomEvents(nextRoom);

      setState('connected');

      await nextRoom.localParticipant.setMicrophoneEnabled(true);
      await nextRoom.localParticipant.setCameraEnabled(true);

      setMicOn(true);
      setCamOn(true);
      setQuality(nextRoom.localParticipant.connectionQuality);

      attachToRoom(nextRoom);
      pushToast('Connected', 'success');

      onConnected?.();
    } catch (error) {
      console.error('[join] failed', error);
      setState('disconnected');
      throw error;
    }
  }, [
    attachToRoom,
    browserUid,
    onConnected,
    pushToast,
    roomId,
    search,
    state,
    wireRoomEvents,
    wsUrl,
  ]);

  const leave = useCallback(async () => {
    try {
      await roomRef.current?.disconnect();
    } catch {
      // Ignore disconnect errors during cleanup.
    }

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
    setActiveSpeaking(false);

    onDisconnected?.();
  }, [onDisconnected]);

  useEffect(() => {
    return () => {
      try {
        roomRef.current?.disconnect();
      } catch {
        // Ignore cleanup errors.
      }

      roomRef.current = null;
    };
  }, []);

  const toggleMic = useCallback(() => {
    const next = !micOn;

    setMicOn(next);
    roomRef.current?.localParticipant
      .setMicrophoneEnabled(next)
      .catch(() => {});
  }, [micOn]);

  const toggleCam = useCallback(() => {
    const next = !camOn;

    setCamOn(next);
    roomRef.current?.localParticipant
      .setCameraEnabled(next)
      .catch(() => {});

    const currentRoom = roomRef.current;
    if (currentRoom) attachToRoom(currentRoom);
  }, [attachToRoom, camOn]);

  const toggleAndBroadcast = useCallback(
    (key: 'vitals' | 'captions' | 'overlay' | 'recording', val: boolean) => {
      if (key === 'vitals') setShowVitals(val);
      if (key === 'captions') setCaptionsOn(val);
      if (key === 'overlay') setShowOverlay(val);

      if (key === 'recording') {
        isRecordingRef.current = val;
        setIsRecording(val);
      }

      void publishControl(key, val);
    },
    [publishControl],
  );

  const toggleScreenShare = useCallback(async () => {
    const currentRoom = roomRef.current;
    if (!currentRoom) return;

    try {
      const next = !screenOn;

      await currentRoom.localParticipant.setScreenShareEnabled(next);

      setScreenOn(next);
      void publishControl('screenshare', next);
      pushToast(next ? 'Screen sharing on' : 'Screen sharing off', 'info');
    } catch {
      pushToast('Screen share failed', 'error');
    }
  }, [publishControl, pushToast, screenOn]);

  const toggleRaiseHand = useCallback(() => {
    const next = !raised;

    setRaised(next);
    void publishControl('raise_hand', next);
    pushToast(next ? 'Hand raised' : 'Hand lowered', 'info');
  }, [publishControl, pushToast, raised]);

  const toggleBlur = useCallback(() => {
    const next = !blurOn;

    setBlurOn(next);
    pushToast(next ? 'Blur on' : 'Blur off', 'info');
  }, [blurOn, pushToast]);

  useEffect(() => {
    if (quality === ConnectionQuality.Poor) {
      pushToast('Network unstable', 'warning');
    }
  }, [quality, pushToast]);

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