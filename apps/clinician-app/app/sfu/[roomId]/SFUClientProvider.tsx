// apps/clinician-app/app/sfu/[roomId]/SFUClientProvider.tsx
'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Room,
  RoomEvent,
  ConnectionState,
  type LocalTrackPublication,
  type RemoteParticipant,
  type RemoteTrackPublication,
} from 'livekit-client';

type SFURole = 'clinician' | 'patient' | 'admin' | 'guest';

type SFUStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

type SFUClientContextValue = {
  room: Room | null;
  roomId: string;
  uid: string;
  role: SFURole;
  status: SFUStatus;
  connectionState: ConnectionState;
  error: string | null;

  wsUrl: string;
  tokenEndpoint: string;

  connect: () => Promise<void>;
  disconnect: () => Promise<void>;

  setMicEnabled: (enabled: boolean) => Promise<void>;
  setCamEnabled: (enabled: boolean) => Promise<void>;

  remoteParticipants: RemoteParticipant[];
  localPubs: LocalTrackPublication[];
  remotePubs: RemoteTrackPublication[];
};

const SFUClientContext = createContext<SFUClientContextValue | null>(null);

/* ------------------------------
   Local UID helper (shared idea)
--------------------------------*/
function getUid(storageKey = 'ambulant_uid') {
  if (typeof window === 'undefined') return 'server-user';
  let v = localStorage.getItem(storageKey);
  if (!v) {
    v = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + '-u';
    localStorage.setItem(storageKey, v);
  }
  return v;
}

/* ------------------------------
   Env helpers / defaults
--------------------------------*/
function envStr(...keys: Array<string | undefined>) {
  for (const k of keys) {
    if (!k) continue;
    // @ts-expect-error - Next inject
    const v = process?.env?.[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function stripTrailingSlashes(v: string) {
  return String(v || '').replace(/\/+$/, '');
}

function joinUrl(base: string, path: string) {
  const b = stripTrailingSlashes(base);
  const p = String(path || '').startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

/* ------------------------------
   Provider
--------------------------------*/
export default function SFUClientProvider(props: {
  roomId: string;
  children: ReactNode;

  /** Optional overrides */
  role?: SFURole;
  uid?: string;
  wsUrl?: string;
  tokenEndpoint?: string;

  /** If true (default), connect immediately */
  autoConnect?: boolean;
}) {
  const {
    roomId,
    children,
    role = 'clinician',
    uid: uidProp,
    wsUrl: wsUrlProp,
    tokenEndpoint: tokenEndpointProp,
    autoConnect = true,
  } = props;

  const uid = useMemo(() => uidProp ?? getUid('ambulant_uid'), [uidProp]);

  // LiveKit WS URL (supports multiple env naming conventions)
  const wsUrl = useMemo(() => {
    const v =
      wsUrlProp ||
      envStr('NEXT_PUBLIC_LIVEKIT_URL', 'NEXT_PUBLIC_SFU_WS_URL', 'NEXT_PUBLIC_LIVEKIT_WS_URL') ||
      'ws://localhost:7880';
    return v;
  }, [wsUrlProp]);

  // Token endpoint:
  // - Prefer explicit prop
  // - Else prefer explicit env
  // - Else fall back to same-app route (/api/sfu/token)
  // - If APIGW is set and token endpoint is relative, call APIGW instead (common in your repo)
  const tokenEndpoint = useMemo(() => {
    const envEndpoint =
      tokenEndpointProp ||
      envStr('NEXT_PUBLIC_SFU_TOKEN_ENDPOINT', 'NEXT_PUBLIC_LIVEKIT_TOKEN_ENDPOINT') ||
      '/api/sfu/token';

    const apigw = envStr('NEXT_PUBLIC_APIGW_BASE');
    const isAbs = /^https?:\/\//i.test(envEndpoint) || envEndpoint.startsWith('ws://') || envEndpoint.startsWith('wss://');

    if (isAbs) return envEndpoint;

    if (apigw) return joinUrl(apigw, envEndpoint);
    return envEndpoint;
  }, [tokenEndpointProp]);

  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState<SFUStatus>('idle');
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [error, setError] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const connectingRef = useRef(false);
  const disposedRef = useRef(false);

  const cleanupRoom = useCallback(async () => {
    const r = roomRef.current;
    roomRef.current = null;
    setRoom(null);

    if (!r) return;

    try {
      r.removeAllListeners();
    } catch {}

    try {
      if (r.state !== ConnectionState.Disconnected) r.disconnect(true);
    } catch {}
  }, []);

  const fetchToken = useCallback(async () => {
    // Token endpoints commonly accept query or headers; we send both.
    const url = new URL(tokenEndpoint, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    url.searchParams.set('roomId', roomId);
    url.searchParams.set('uid', uid);
    url.searchParams.set('role', role);

    const r = await fetch(url.toString(), {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
        'x-uid': uid,
        'x-role': role,
      },
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error(j?.message || j?.error || `Token request failed (HTTP ${r.status})`);
    }

    // Support a few response shapes:
    const token =
      j?.token ||
      j?.accessToken ||
      j?.data?.token ||
      j?.data?.accessToken ||
      j?.item?.token ||
      j?.item?.accessToken;

    if (!token || typeof token !== 'string') {
      throw new Error('Token endpoint did not return a token');
    }

    // Optional: allow token endpoint to also return wsUrl override
    const ws = j?.wsUrl || j?.url || j?.data?.wsUrl || j?.data?.url;

    return { token, wsUrlOverride: typeof ws === 'string' && ws.trim() ? ws.trim() : null };
  }, [roomId, role, tokenEndpoint, uid]);

  const connect = useCallback(async () => {
    if (connectingRef.current) return;
    if (disposedRef.current) return;

    // If already connected to the same room, no-op.
    if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
      setStatus('connected');
      setConnectionState(roomRef.current.state);
      return;
    }

    connectingRef.current = true;
    setError(null);
    setStatus('connecting');

    try {
      // Always cleanup any previous instance before making a new one
      await cleanupRoom();

      const { token, wsUrlOverride } = await fetchToken();
      const effectiveWsUrl = wsUrlOverride || wsUrl;

      const r = new Room({
        adaptiveStream: true,
        dynacast: true,
        // keep it safe: don't auto-publish until user toggles mic/cam explicitly
        publishDefaults: {
          simulcast: true,
        },
      });

      roomRef.current = r;
      setRoom(r);

      const syncState = () => {
        setConnectionState(r.state);
        if (r.state === ConnectionState.Connected) setStatus('connected');
        if (r.state === ConnectionState.Disconnected) setStatus('disconnected');
      };

      r.on(RoomEvent.ConnectionStateChanged, () => syncState());
      r.on(RoomEvent.Disconnected, () => syncState());

      r.on(RoomEvent.Reconnecting, () => {
        setStatus('connecting');
        setConnectionState(r.state);
      });

      r.on(RoomEvent.Reconnected, () => {
        setStatus('connected');
        setConnectionState(r.state);
      });

      await r.connect(effectiveWsUrl, token);

      // Ensure local devices start off disabled (explicit opt-in)
      try {
        await r.localParticipant.setMicrophoneEnabled(false);
      } catch {}
      try {
        await r.localParticipant.setCameraEnabled(false);
      } catch {}

      syncState();
    } catch (e: any) {
      const msg = e?.message || 'Failed to connect to SFU';
      setError(msg);
      setStatus('error');
      setConnectionState(ConnectionState.Disconnected);
      // cleanup any partial room
      await cleanupRoom();
      throw e;
    } finally {
      connectingRef.current = false;
    }
  }, [cleanupRoom, fetchToken, wsUrl]);

  const disconnect = useCallback(async () => {
    setStatus('disconnected');
    setConnectionState(ConnectionState.Disconnected);
    setError(null);
    await cleanupRoom();
  }, [cleanupRoom]);

  const setMicEnabled = useCallback(async (enabled: boolean) => {
    const r = roomRef.current;
    if (!r) return;
    try {
      await r.localParticipant.setMicrophoneEnabled(!!enabled);
    } catch (e: any) {
      setError(e?.message || 'Failed to toggle microphone');
      throw e;
    }
  }, []);

  const setCamEnabled = useCallback(async (enabled: boolean) => {
    const r = roomRef.current;
    if (!r) return;
    try {
      await r.localParticipant.setCameraEnabled(!!enabled);
    } catch (e: any) {
      setError(e?.message || 'Failed to toggle camera');
      throw e;
    }
  }, []);

  // Auto-connect on mount / roomId change
  useEffect(() => {
    disposedRef.current = false;

    if (!autoConnect) return;

    // In React Strict Mode, effects may run twice; guard connect calls
    connect().catch(() => {});

    return () => {
      // do not disconnect immediately on strict-mode re-run; we only mark disposed here
      disposedRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Hard cleanup on unmount
  useEffect(() => {
    return () => {
      disposedRef.current = true;
      void cleanupRoom();
    };
  }, [cleanupRoom]);

  const remoteParticipants = useMemo(() => {
    const r = room;
    if (!r) return [];
    return Array.from(r.remoteParticipants.values());
  }, [room, connectionState]);

  const localPubs = useMemo(() => {
    const r = room;
    if (!r) return [];
    return Array.from(r.localParticipant.trackPublications.values());
  }, [room, connectionState]);

  const remotePubs = useMemo(() => {
    const r = room;
    if (!r) return [];
    const pubs: RemoteTrackPublication[] = [];
    for (const p of r.remoteParticipants.values()) {
      for (const pub of p.trackPublications.values()) pubs.push(pub);
    }
    return pubs;
  }, [room, connectionState]);

  const value: SFUClientContextValue = useMemo(
    () => ({
      room,
      roomId,
      uid,
      role,
      status,
      connectionState,
      error,

      wsUrl,
      tokenEndpoint,

      connect,
      disconnect,

      setMicEnabled,
      setCamEnabled,

      remoteParticipants,
      localPubs,
      remotePubs,
    }),
    [
      room,
      roomId,
      uid,
      role,
      status,
      connectionState,
      error,
      wsUrl,
      tokenEndpoint,
      connect,
      disconnect,
      setMicEnabled,
      setCamEnabled,
      remoteParticipants,
      localPubs,
      remotePubs,
    ],
  );

  return <SFUClientContext.Provider value={value}>{children}</SFUClientContext.Provider>;
}

/* ------------------------------
   Hook
--------------------------------*/
export function useSFUClient() {
  const ctx = useContext(SFUClientContext);
  if (!ctx) throw new Error('useSFUClient must be used inside <SFUClientProvider>');
  return ctx;
}
