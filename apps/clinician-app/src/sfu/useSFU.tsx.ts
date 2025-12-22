// apps/clinician-app/src/sfu/useSFU.ts
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
import type { Room, ConnectionQuality } from 'livekit-client';

export type SFUVitals = {
  hr?: number;
  spo2?: number;
  tempC?: number;
  rr?: number;
  sys?: number;
  dia?: number;
  glucoseMgDl?: number;
};

export type SFUToastKind = 'info' | 'success' | 'warning' | 'error';
export type SFUToast = {
  id: string;
  title?: string;
  body: string;
  kind?: SFUToastKind;
  ttl?: number;
};

export type SFUChatItem = {
  id: string;
  from: 'me' | string;
  text: string;
  ts: number;
};

export type SFUControls = {
  overlay: boolean;
  captions: boolean;
  vitals: boolean;
  vitalsOverlay: boolean;
  recording: boolean;
  xr: boolean;
};

export type SFUConnState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export type SFUContextValue = {
  roomId: string;
  room: Room | null;

  connState: SFUConnState;
  quality?: ConnectionQuality;

  micOn: boolean;
  camOn: boolean;

  controls: SFUControls;

  vitals: SFUVitals;

  chat: SFUChatItem[];
  unread: number;
  typingNote?: string;

  join: () => Promise<void>;
  leave: () => Promise<void>;

  toggleMic: () => void;
  toggleCam: () => void;

  setControl: (key: keyof SFUControls, next: boolean) => Promise<void>;
  publishControl: (key: keyof SFUControls, payload: any) => void;

  sendChat: (text: string) => Promise<void>;
  sendTyping?: () => void;
  resetUnread: () => void;

  toasts: SFUToast[];
  pushToast: (body: string, kind?: SFUToastKind, title?: string, ttlMs?: number) => void;
  closeToast: (id: string) => void;

  audit: (event: string, payload?: any) => void;
};

const SFUContext = createContext<SFUContextValue | null>(null);

function uid(prefix = 'id') {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

export function SFUClientProvider({
  roomId,
  children,
}: {
  roomId: string;
  children: ReactNode;
}) {
  const [room, setRoom] = useState<Room | null>(null);

  const [connState, setConnState] = useState<SFUConnState>('disconnected');
  const [quality, setQuality] = useState<ConnectionQuality | undefined>(undefined);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const [controls, setControls] = useState<SFUControls>({
    overlay: true,
    captions: false,
    vitals: true,
    vitalsOverlay: true,
    recording: false,
    xr: false,
  });

  const [vitals, setVitals] = useState<SFUVitals>({
    hr: 78,
    spo2: 98,
    tempC: 36.8,
    rr: 16,
    sys: 122,
    dia: 78,
  });

  const [chat, setChat] = useState<SFUChatItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [typingNote, setTypingNote] = useState<string | undefined>(undefined);

  const [toasts, setToasts] = useState<SFUToast[]>([]);
  const toastTimersRef = useRef<Record<string, any>>({});

  const closeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timers = toastTimersRef.current;
    if (timers[id]) {
      clearTimeout(timers[id]);
      delete timers[id];
    }
  }, []);

  const pushToast = useCallback(
    (body: string, kind: SFUToastKind = 'info', title?: string, ttlMs = 4000) => {
      const id = uid('toast');
      const t: SFUToast = { id, body, kind, title, ttl: ttlMs };
      setToasts((prev) => [t, ...prev].slice(0, 5));

      toastTimersRef.current[id] = setTimeout(() => {
        closeToast(id);
      }, ttlMs);
    },
    [closeToast]
  );

  const audit = useCallback((event: string, payload?: any) => {
    // keep it safe for demo runs
    console.log('[SFU AUDIT]', event, payload ?? {});
  }, []);

  const join = useCallback(async () => {
    if (connState === 'connected' || connState === 'connecting') return;

    setConnState('connecting');
    pushToast('Joining room…', 'info', 'SFU');

    // DEMO: we don’t connect LiveKit here yet (token/wss wiring varies per repo).
    // Provider still behaves consistently for UI/flows.
    setRoom(null);
    setQuality(undefined);

    setConnState('connected');
    pushToast('Connected.', 'success', 'SFU');
    audit('sfu.join', { roomId });
  }, [audit, connState, pushToast, roomId]);

  const leave = useCallback(async () => {
    if (connState === 'disconnected') return;

    setConnState('disconnected');
    setQuality(undefined);
    setRoom(null);
    pushToast('Disconnected.', 'info', 'SFU');
    audit('sfu.leave', { roomId });
  }, [audit, connState, pushToast, roomId]);

  const toggleMic = useCallback(() => setMicOn((v) => !v), []);
  const toggleCam = useCallback(() => setCamOn((v) => !v), []);

  const setControl = useCallback(async (key: keyof SFUControls, next: boolean) => {
    setControls((prev) => ({ ...prev, [key]: next }));
  }, []);

  const publishControl = useCallback((key: keyof SFUControls, payload: any) => {
    // in a real LiveKit wiring, this would publish a data message
    console.log('[SFU publishControl]', key, payload);
  }, []);

  const sendChat = useCallback(
    async (text: string) => {
      const item: SFUChatItem = { id: uid('chat'), from: 'me', text, ts: Date.now() };
      setChat((prev) => [...prev, item]);
      // “me” messages shouldn’t increment unread
      audit('sfu.chat.send', { roomId, len: text.length });
    },
    [audit, roomId]
  );

  const resetUnread = useCallback(() => setUnread(0), []);

  const sendTyping = useCallback(() => {
    setTypingNote('Typing…');
    window.setTimeout(() => setTypingNote(undefined), 900);
  }, []);

  // DEMO vitals tick (only when connected + vitals enabled)
  useEffect(() => {
    if (connState !== 'connected') return;
    if (!controls.vitals) return;

    const id = window.setInterval(() => {
      setVitals((v) => {
        const n = (x: number, d: number) => Math.round((x + (Math.random() - 0.5) * d) * 10) / 10;
        return {
          ...v,
          hr: n(v.hr ?? 78, 2),
          spo2: n(v.spo2 ?? 98, 0.4),
          tempC: n(v.tempC ?? 36.8, 0.05),
          rr: n(v.rr ?? 16, 0.6),
          sys: n(v.sys ?? 122, 1.5),
          dia: n(v.dia ?? 78, 1.2),
        };
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [connState, controls.vitals]);

  const value: SFUContextValue = useMemo(
    () => ({
      roomId,
      room,

      connState,
      quality,

      micOn,
      camOn,

      controls,

      vitals,

      chat,
      unread,
      typingNote,

      join,
      leave,

      toggleMic,
      toggleCam,

      setControl,
      publishControl,

      sendChat,
      sendTyping,
      resetUnread,

      toasts,
      pushToast,
      closeToast,

      audit,
    }),
    [
      roomId,
      room,
      connState,
      quality,
      micOn,
      camOn,
      controls,
      vitals,
      chat,
      unread,
      typingNote,
      join,
      leave,
      toggleMic,
      toggleCam,
      setControl,
      publishControl,
      sendChat,
      sendTyping,
      resetUnread,
      toasts,
      pushToast,
      closeToast,
      audit,
    ]
  );

  return <SFUContext.Provider value={value}>{children}</SFUContext.Provider>;
}

export default SFUClientProvider;

export function useSFU() {
  const ctx = useContext(SFUContext);
  if (!ctx)
    throw new Error(
      'useSFU must be used inside <SFUClientProvider /> (sfu/[roomId]/layout.tsx)'
    );
  return ctx;
}
