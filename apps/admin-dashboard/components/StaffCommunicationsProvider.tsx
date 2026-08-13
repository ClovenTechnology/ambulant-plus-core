'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  ControlBar,
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
} from '@livekit/components-react';
import {
  Bell,
  ChevronDown,
  ChevronUp,
  Mic,
  Phone,
  PhoneOff,
  Video,
  X,
} from 'lucide-react';
import { errorText, userFacingApiError } from '@/lib/admin-error';

type CallMode = 'AUDIO' | 'VIDEO';
type MediaPhase =
  | 'idle'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'other-tab'
  | 'failed';

type StaffCall = {
  id: string;
  state: string;
  outcome?: string | null;
  endedReason?: string | null;
  mode: CallMode;
  conversationId?: string | null;
  createdAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  ringExpiresAt?: string | null;
  callerProfileId?: string | null;
  isCaller?: boolean;
  participant?: {
    id?: string;
    state?: string;
  } | null;
  other?: {
    id: string;
    name?: string | null;
    email: string;
    photoUrl?: string | null;
  } | null;
};

type RtcCredentials = {
  token: string;
  wsUrl: string;
  roomId?: string;
  expiresInSeconds?: number;
};

type StaffNotification = {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  readAt?: string | null;
  createdAt: string;
  conversationId?: string | null;
  meetingId?: string | null;
  actorProfile?: {
    id: string;
    name?: string | null;
    email: string;
    photoUrl?: string | null;
  } | null;
};

type Summary = {
  ok: boolean;
  actorProfileId?: string;
  unreadMessages: number;
  unreadNotifications: number;
  incomingCalls: StaffCall[];
  currentCall: StaffCall | null;
  activeCall: StaffCall | null;
  callHistory: StaffCall[];
  notifications: StaffNotification[];
};

type StaffCommunicationsContextValue = {
  summary: Summary | null;
  unreadMessages: number;
  unreadNotifications: number;
  currentCall: StaffCall | null;
  incomingCall: StaffCall | null;
  callHistory: StaffCall[];
  notifications: StaffNotification[];
  callBusy: boolean;
  mediaPhase: MediaPhase;
  startCall: (conversationId: string, mode: CallMode) => Promise<void>;
  acceptCall: (meetingId: string) => Promise<void>;
  declineCall: (meetingId: string) => Promise<void>;
  endCall: (meetingId?: string) => Promise<void>;
  refreshCommunications: () => Promise<void>;
  markNotificationsRead: (ids?: string[]) => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;
  notice: string;
  clearNotice: () => void;
};

type RtcLease = {
  actorProfileId: string;
  callId: string;
  tabId: string;
  expiresAt: number;
};

const StaffCommunicationsContext =
  createContext<StaffCommunicationsContextValue | null>(null);

const RTC_LEASE_TTL_MS = 30_000;
const RTC_LEASE_HEARTBEAT_MS = 5_000;
const RTC_LEASE_CHANNEL = 'ambulant-direct-call-rtc-owner-v1';

function avatarUrl(profile?: StaffCall['other'] | StaffNotification['actorProfile'] | null) {
  if (!profile?.id || !profile.photoUrl) return '';
  return `/api/admin/staff/${encodeURIComponent(profile.id)}/avatar`;
}

function humanCallOutcome(value: unknown) {
  const text = String(value || '').trim().toUpperCase();
  const labels: Record<string, string> = {
    COMPLETED: 'Call ended',
    MISSED: 'Missed call',
    DECLINED: 'Call declined',
    BUSY: 'Busy',
    CANCELLED: 'Call cancelled',
    FAILED: 'Call failed',
  };
  return labels[text] || text.replaceAll('_', ' ').toLowerCase();
}

function callName(call: StaffCall | null) {
  return call?.other?.name || call?.other?.email || 'Staff member';
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutes}:${String(secs).padStart(2, '0')}`;
}

function parseLease(value: string | null): RtcLease | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (
      !parsed ||
      typeof parsed.actorProfileId !== 'string' ||
      typeof parsed.callId !== 'string' ||
      typeof parsed.tabId !== 'string' ||
      typeof parsed.expiresAt !== 'number'
    ) {
      return null;
    }
    return parsed as RtcLease;
  } catch {
    return null;
  }
}

export function useStaffCommunications() {
  const value = useContext(StaffCommunicationsContext);
  if (!value) {
    throw new Error('StaffCommunicationsProvider is missing');
  }
  return value;
}

export function StaffCommunicationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || '';
  const router = useRouter();

  const [summary, setSummary] = useState<Summary | null>(null);
  const [call, setCall] = useState<StaffCall | null>(null);
  const [terminalCall, setTerminalCall] = useState<StaffCall | null>(null);
  const [rtc, setRtc] = useState<RtcCredentials | null>(null);
  const [notice, setNotice] = useState('');
  const [callBusy, setCallBusy] = useState(false);
  const [mediaPhase, setMediaPhase] = useState<MediaPhase>('idle');
  const [mediaError, setMediaError] = useState('');
  const [rtcOwner, setRtcOwner] = useState(false);
  const [rtcOwnedElsewhere, setRtcOwnedElsewhere] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [clockTick, setClockTick] = useState(Date.now());
  const [reconnectTick, setReconnectTick] = useState(0);

  const lastIncomingId = useRef('');
  const seenNotificationIds = useRef<Set<string> | null>(null);
  const reconnecting = useRef(false);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const callRef = useRef<StaffCall | null>(null);
  const summaryRef = useRef<Summary | null>(null);
  const rtcOwnerRef = useRef(false);
  const tabIdRef = useRef('');
  const lastReconnectAttemptAt = useRef<Record<string, number>>({});
  const ringTimer = useRef<number | null>(null);
  const leaseHeartbeat = useRef<number | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const initiatedCallId = useRef('');
  const authPage = pathname.startsWith('/auth/');

  const clearNotice = useCallback(() => setNotice(''), []);

  const ensureTabId = useCallback(() => {
    if (tabIdRef.current) return tabIdRef.current;
    if (typeof window === 'undefined') return '';

    let value = '';
    try {
      value = window.sessionStorage.getItem('ambulant:communications:tab-id') || '';
    } catch {
      // Storage can be unavailable in hardened browser contexts.
    }

    if (!value) {
      value =
        globalThis.crypto?.randomUUID?.() ||
        `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      try {
        window.sessionStorage.setItem('ambulant:communications:tab-id', value);
      } catch {
        // Memory-only ownership remains valid for this page lifetime.
      }
    }

    tabIdRef.current = value;
    return value;
  }, []);

  const storeCall = useCallback((next: StaffCall | null) => {
    callRef.current = next;
    setCall(next);
  }, []);

  const leaseKey = useCallback((callId: string) => {
    const actorProfileId = summaryRef.current?.actorProfileId || '';
    return actorProfileId && callId
      ? `ambulant:direct-call:rtc-owner:${actorProfileId}:${callId}`
      : '';
  }, []);

  const readLease = useCallback(
    (callId: string) => {
      const key = leaseKey(callId);
      if (!key || typeof window === 'undefined') return null;
      try {
        return parseLease(window.localStorage.getItem(key));
      } catch {
        return null;
      }
    },
    [leaseKey],
  );

  const setOwnerState = useCallback((owned: boolean, elsewhere: boolean) => {
    rtcOwnerRef.current = owned;
    setRtcOwner(owned);
    setRtcOwnedElsewhere(elsewhere);
  }, []);

  const publishLeaseEvent = useCallback((callId: string, action: string) => {
    try {
      broadcastRef.current?.postMessage({
        action,
        actorProfileId: summaryRef.current?.actorProfileId || '',
        callId,
        tabId: tabIdRef.current,
      });
    } catch {
      // localStorage remains the fallback cross-tab authority.
    }
  }, []);

  const releaseRtcLease = useCallback(
    (callId: string) => {
      const key = leaseKey(callId);
      const tabId = ensureTabId();

      if (key && tabId && typeof window !== 'undefined') {
        try {
          const current = parseLease(window.localStorage.getItem(key));
          if (current?.tabId === tabId) {
            window.localStorage.removeItem(key);
          }
        } catch {
          // Best effort.
        }
      }

      if (callRef.current?.id === callId || !callRef.current) {
        setOwnerState(false, false);
      }
      publishLeaseEvent(callId, 'release');
    },
    [ensureTabId, leaseKey, publishLeaseEvent, setOwnerState],
  );

  const claimRtcLease = useCallback(
    (callId: string, force = false) => {
      if (typeof window === 'undefined') return false;

      const actorProfileId = summaryRef.current?.actorProfileId || '';
      const tabId = ensureTabId();
      const key = leaseKey(callId);
      if (!actorProfileId || !tabId || !key) return false;

      const now = Date.now();
      const current = readLease(callId);
      const currentIsValid = Boolean(current && current.expiresAt > now);

      if (
        !force &&
        currentIsValid &&
        current?.tabId &&
        current.tabId !== tabId
      ) {
        setOwnerState(false, true);
        return false;
      }

      const next: RtcLease = {
        actorProfileId,
        callId,
        tabId,
        expiresAt: now + RTC_LEASE_TTL_MS,
      };

      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        setOwnerState(true, false);
        return true;
      }

      const verified = readLease(callId);
      const won = verified?.tabId === tabId;
      setOwnerState(
        won,
        !won && Boolean(verified?.expiresAt && verified.expiresAt > now),
      );

      if (won) {
        publishLeaseEvent(callId, force ? 'takeover' : 'claim');
      }

      return won;
    },
    [
      ensureTabId,
      leaseKey,
      publishLeaseEvent,
      readLease,
      setOwnerState,
    ],
  );

  const renewRtcLease = useCallback(
    (callId: string) => {
      if (!rtcOwnerRef.current || typeof window === 'undefined') return;

      const key = leaseKey(callId);
      const tabId = ensureTabId();
      const actorProfileId = summaryRef.current?.actorProfileId || '';
      if (!key || !tabId || !actorProfileId) return;

      try {
        window.localStorage.setItem(
          key,
          JSON.stringify({
            actorProfileId,
            callId,
            tabId,
            expiresAt: Date.now() + RTC_LEASE_TTL_MS,
          } satisfies RtcLease),
        );
      } catch {
        // Keep in-memory ownership if storage is unavailable.
      }
    },
    [ensureTabId, leaseKey],
  );

  const syncActivityPresence = useCallback(async () => {
    if (authPage) return;
    try {
      await fetch('/api/admin/staff/activity', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event: 'heartbeat',
          path: pathname || '/admin/communications',
          activeSeconds: 0,
        }),
        keepalive: true,
      });
    } catch {
      // Presence repair is best-effort.
    }
  }, [authPage, pathname]);

  const refreshCommunications = useCallback(async () => {
    if (authPage) return;

    if (refreshInFlight.current) {
      await refreshInFlight.current;
      return;
    }

    const request = (async () => {
      try {
        const response = await fetch('/api/admin/communications/summary', {
          cache: 'no-store',
        });

        if (response.status === 401 || response.status === 403) return;

        const json = await response.json().catch(() => null);
        if (!response.ok || !json?.ok) return;

        const next = json as Summary;
        summaryRef.current = next;
        setSummary(next);

        const nextCurrentCall = next.currentCall;
        const current = callRef.current;

        if (nextCurrentCall) {
          const merged =
            current?.id === nextCurrentCall.id
              ? { ...current, ...nextCurrentCall }
              : nextCurrentCall;

          if (current?.id && current.id !== nextCurrentCall.id) {
            releaseRtcLease(current.id);
            setRtc(null);
            setMediaPhase('idle');
          }

          storeCall(merged);
          return;
        }

        if (!current) return;

        const terminal = (next.callHistory || []).find(
          (item) =>
            item.id === current.id &&
            ['ENDED', 'CANCELLED', 'EXPIRED'].includes(item.state),
        );

        if (terminal) {
          const finalCall = { ...current, ...terminal };
          releaseRtcLease(current.id);
          setRtc(null);
          setMediaError('');
          setNotice('');
          setMediaPhase('idle');
          setTerminalCall(finalCall);
          storeCall(null);
          void syncActivityPresence();
          return;
        }

        if (!['RINGING', 'LIVE'].includes(current.state)) {
          releaseRtcLease(current.id);
          storeCall(null);
          setRtc(null);
          setMediaError('');
          setMediaPhase('idle');
          void syncActivityPresence();
        }
      } catch {
        // Background polling is deliberately silent.
      }
    })();

    refreshInFlight.current = request;

    try {
      await request;
    } finally {
      if (refreshInFlight.current === request) {
        refreshInFlight.current = null;
      }
    }
  }, [
    authPage,
    releaseRtcLease,
    storeCall,
    syncActivityPresence,
  ]);

  const reconnectCall = useCallback(
    async (meetingId: string) => {
      const current = callRef.current;
      if (
        !current ||
        current.id !== meetingId ||
        current.state !== 'LIVE' ||
        !rtcOwnerRef.current
      ) {
        return;
      }

      const now = Date.now();
      if (reconnecting.current) return;
      if (now - Number(lastReconnectAttemptAt.current[meetingId] || 0) < 2500) {
        return;
      }

      lastReconnectAttemptAt.current[meetingId] = now;
      reconnecting.current = true;
      setMediaPhase((phase) =>
        phase === 'connected' ? 'reconnecting' : 'connecting',
      );

      try {
        const response = await fetch(
          `/api/admin/communications/calls/${encodeURIComponent(meetingId)}/token`,
          { method: 'POST' },
        );
        const json = await response.json().catch(() => null);

        if (
          !response.ok ||
          !json?.ok ||
          !json?.rtc?.token ||
          !json?.rtc?.wsUrl
        ) {
          const facing = userFacingApiError({
            response,
            json,
            fallback: 'Secure media could not be restored yet.',
          });
          setMediaError(errorText(facing));
          setMediaPhase('reconnecting');

          window.setTimeout(() => {
            if (
              callRef.current?.id === meetingId &&
              callRef.current?.state === 'LIVE' &&
              rtcOwnerRef.current
            ) {
              setReconnectTick((value) => value + 1);
            }
          }, 4000);
          return;
        }

        storeCall(json.call || current);
        setRtc(json.rtc);
        setMediaError('');
        setNotice('');
        setMediaPhase('connecting');
        delete lastReconnectAttemptAt.current[meetingId];
      } catch (error: any) {
        setMediaError(
          error?.message || 'Secure media could not be restored yet.',
        );
        setMediaPhase('reconnecting');

        window.setTimeout(() => {
          if (
            callRef.current?.id === meetingId &&
            callRef.current?.state === 'LIVE' &&
            rtcOwnerRef.current
          ) {
            setReconnectTick((value) => value + 1);
          }
        }, 4000);
      } finally {
        reconnecting.current = false;
      }
    },
    [storeCall],
  );

  useEffect(() => {
    if (authPage) return;
    void refreshCommunications();
    const timer = window.setInterval(() => {
      void refreshCommunications();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [authPage, refreshCommunications]);

  useEffect(() => {
    ensureTabId();

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel(RTC_LEASE_CHANNEL);
        broadcastRef.current = channel;
        channel.onmessage = () => {
          const current = callRef.current;
          if (!current || current.state !== 'LIVE') return;

          const lease = readLease(current.id);
          const mine = lease?.tabId === tabIdRef.current;

          if (!mine && lease && lease.expiresAt > Date.now()) {
            setOwnerState(false, true);
            setRtc(null);
            setMediaPhase('other-tab');
          }
        };
      } catch {
        broadcastRef.current = null;
      }
    }

    const onStorage = (event: StorageEvent) => {
      const current = callRef.current;
      if (!current || current.state !== 'LIVE') return;

      const expectedKey = leaseKey(current.id);
      if (!expectedKey || event.key !== expectedKey) return;

      const lease = parseLease(event.newValue);
      const mine = lease?.tabId === tabIdRef.current;

      if (!mine && lease && lease.expiresAt > Date.now()) {
        setOwnerState(false, true);
        setRtc(null);
        setMediaPhase('other-tab');
        return;
      }

      if (!lease || lease.expiresAt <= Date.now()) {
        const won = claimRtcLease(current.id, false);
        if (won) {
          setMediaPhase('connecting');
          setRtc(null);
          setReconnectTick((value) => value + 1);
        }
      }
    };

    const onPageHide = () => {
      const current = callRef.current;
      if (current?.state === 'LIVE') {
        releaseRtcLease(current.id);
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pagehide', onPageHide);
      broadcastRef.current?.close();
      broadcastRef.current = null;

      const current = callRef.current;
      if (current?.state === 'LIVE') {
        releaseRtcLease(current.id);
      }
    };
  }, [
    claimRtcLease,
    ensureTabId,
    leaseKey,
    readLease,
    releaseRtcLease,
    setOwnerState,
  ]);

  useEffect(() => {
    if (leaseHeartbeat.current) {
      window.clearInterval(leaseHeartbeat.current);
      leaseHeartbeat.current = null;
    }

    if (!call || call.state !== 'LIVE' || !summary?.actorProfileId) {
      if (call?.state === 'RINGING') {
        setOwnerState(false, false);
        setRtc(null);
        setMediaError('');
        setMediaPhase('ringing');
      }
      return;
    }

    const force = initiatedCallId.current === call.id;
    if (force) initiatedCallId.current = '';

    const won = claimRtcLease(call.id, force);

    if (!won) {
      setRtc(null);
      setMediaError('');
      setMediaPhase('other-tab');
    } else if (!rtc) {
      setMediaPhase('connecting');
      setReconnectTick((value) => value + 1);
    }

    leaseHeartbeat.current = window.setInterval(() => {
      if (rtcOwnerRef.current) {
        renewRtcLease(call.id);
        return;
      }

      const lease = readLease(call.id);
      if (!lease || lease.expiresAt <= Date.now()) {
        const claimed = claimRtcLease(call.id, false);
        if (claimed) {
          setMediaPhase('connecting');
          setRtc(null);
          setReconnectTick((value) => value + 1);
        }
      }
    }, RTC_LEASE_HEARTBEAT_MS);

    return () => {
      if (leaseHeartbeat.current) {
        window.clearInterval(leaseHeartbeat.current);
        leaseHeartbeat.current = null;
      }
    };
  }, [
    call?.id,
    call?.state,
    claimRtcLease,
    readLease,
    renewRtcLease,
    rtc,
    setOwnerState,
    summary?.actorProfileId,
  ]);

  useEffect(() => {
    if (call && call.state === 'LIVE' && rtcOwner && !rtc) {
      void reconnectCall(call.id);
    }
  }, [call, reconnectCall, reconnectTick, rtc, rtcOwner]);

  const incomingCall =
    summary?.incomingCalls?.find(
      (item) => item.participant?.state === 'INVITED',
    ) || null;

  useEffect(() => {
    const items = summary?.notifications || [];
    if (seenNotificationIds.current === null) {
      seenNotificationIds.current = new Set(items.map((item) => item.id));
      return;
    }

    for (const item of items) {
      if (seenNotificationIds.current.has(item.id)) continue;
      seenNotificationIds.current.add(item.id);
      if (item.readAt || item.type === 'INCOMING_CALL') continue;

      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        const notification = new Notification(
          item.title || 'Ambulant+ notification',
          {
            body: item.body || undefined,
            tag: `ambulant-staff-${item.id}`,
          },
        );
        notification.onclick = () => {
          window.focus();
          if (item.actorProfile?.id) {
            router.push(
              `/admin/communications?staffId=${encodeURIComponent(
                item.actorProfile.id,
              )}`,
            );
          } else {
            router.push('/admin/communications');
          }
          notification.close();
        };
        window.setTimeout(() => notification.close(), 10_000);
      }
    }
  }, [router, summary?.notifications]);

  useEffect(() => {
    if (!incomingCall || incomingCall.id === lastIncomingId.current) return;

    lastIncomingId.current = incomingCall.id;
    void syncActivityPresence();

    if (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    ) {
      const notification = new Notification(
        `Incoming ${incomingCall.mode === 'VIDEO' ? 'video' : 'audio'} call`,
        {
          body: callName(incomingCall),
          tag: `ambulant-call-${incomingCall.id}`,
        },
      );
      notification.onclick = () => {
        window.focus();
        router.push('/admin/communications');
        notification.close();
      };
      window.setTimeout(() => notification.close(), 10_000);
    }
  }, [incomingCall, router, syncActivityPresence]);

  useEffect(() => {
    if (ringTimer.current) {
      window.clearInterval(ringTimer.current);
      ringTimer.current = null;
    }

    if (!incomingCall) return;

    const beep = () => {
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        const context = new AudioContextClass();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 660;
        gain.gain.value = 0.035;
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.12);
        window.setTimeout(() => void context.close(), 250);
      } catch {
        // Browser media policy may require a prior user gesture.
      }
    };

    beep();
    ringTimer.current = window.setInterval(beep, 1400);

    return () => {
      if (ringTimer.current) {
        window.clearInterval(ringTimer.current);
        ringTimer.current = null;
      }
    };
  }, [incomingCall]);

  useEffect(() => {
    if (call?.state !== 'LIVE') return;
    setClockTick(Date.now());
    const timer = window.setInterval(() => setClockTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [call?.id, call?.state]);

  useEffect(() => {
    if (!terminalCall) return;
    const timer = window.setTimeout(() => {
      setTerminalCall(null);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [terminalCall?.id, terminalCall?.state, terminalCall?.outcome]);

  const startCall = useCallback(
    async (conversationId: string, mode: CallMode) => {
      if (callBusy) return;

      setCallBusy(true);
      setNotice('');
      setMediaError('');

      try {
        if (
          typeof Notification !== 'undefined' &&
          Notification.permission === 'default'
        ) {
          void Notification.requestPermission().catch(() => undefined);
        }

        const response = await fetch(
          `/api/admin/communications/conversations/${encodeURIComponent(
            conversationId,
          )}/call`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ mode }),
          },
        );

        const json = await response.json().catch(() => null);

        if (!response.ok || !json?.ok) {
          const facing = userFacingApiError({
            response,
            json,
            fallback: 'The call could not be started.',
          });
          throw new Error(errorText(facing));
        }

        if (json.collision) {
          storeCall(json.call || null);
          setRtc(null);
          setMediaPhase('ringing');
          setNotice(
            `${callName(
              json.call,
            )} is calling you now. Answer the incoming call instead.`,
          );
          await refreshCommunications();
          return;
        }

        if (json.callerBusy) {
          setRtc(null);
          setMediaPhase('idle');
          setNotice(
            'You already have another call ringing or active. End or decline it before starting another call.',
          );
          await refreshCommunications();
          return;
        }

        if (json.busy || json.call?.outcome === 'BUSY') {
          storeCall(null);
          setRtc(null);
          setMediaPhase('idle');
          setNotice(`${callName(json.call)} is busy on another call.`);
          await refreshCommunications();
          return;
        }

        const nextCall = json.call || null;
        storeCall(nextCall);

        if (nextCall?.id) {
          initiatedCallId.current = nextCall.id;
        }

        if (nextCall?.state === 'LIVE' && json.rtc) {
          const won = claimRtcLease(nextCall.id, true);
          setRtc(won ? json.rtc : null);
          setMediaPhase(won ? 'connecting' : 'other-tab');
        } else {
          setRtc(null);
          setMediaPhase('ringing');
        }

        void syncActivityPresence();
        await refreshCommunications();
      } catch (error: any) {
        setNotice(error?.message || 'The call could not be started.');
        throw error;
      } finally {
        setCallBusy(false);
      }
    },
    [
      callBusy,
      claimRtcLease,
      refreshCommunications,
      storeCall,
      syncActivityPresence,
    ],
  );

  const respond = useCallback(
    async (meetingId: string, action: 'ACCEPT' | 'DECLINE') => {
      if (callBusy) return;

      setCallBusy(true);
      setNotice('');
      setMediaError('');

      try {
        const response = await fetch(
          `/api/admin/communications/calls/${encodeURIComponent(
            meetingId,
          )}/respond`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action }),
          },
        );

        const json = await response.json().catch(() => null);
        if (!response.ok || !json?.ok) {
          const facing = userFacingApiError({
            response,
            json,
            fallback: 'The call response could not be completed.',
          });
          throw new Error(errorText(facing));
        }

        if (action === 'ACCEPT' && json.call?.state === 'LIVE') {
          setTerminalCall(null);
          storeCall(json.call || null);
          initiatedCallId.current = meetingId;
          const won = claimRtcLease(meetingId, true);
          setRtc(won ? json.rtc || null : null);
          setMediaPhase(won ? 'connecting' : 'other-tab');
        } else {
          setTerminalCall(json.call || null);
          storeCall(null);
          releaseRtcLease(meetingId);
          setRtc(null);
          setMediaPhase('idle');
        }

        void syncActivityPresence();
        await refreshCommunications();
      } catch (error: any) {
        setNotice(
          error?.message || 'The call response could not be completed.',
        );
        throw error;
      } finally {
        setCallBusy(false);
      }
    },
    [
      callBusy,
      claimRtcLease,
      refreshCommunications,
      releaseRtcLease,
      storeCall,
      syncActivityPresence,
    ],
  );

  const acceptCall = useCallback(
    async (meetingId: string) => respond(meetingId, 'ACCEPT'),
    [respond],
  );

  const declineCall = useCallback(
    async (meetingId: string) => respond(meetingId, 'DECLINE'),
    [respond],
  );

  const endCall = useCallback(
    async (meetingId?: string) => {
      const id = meetingId || call?.id;
      if (!id || callBusy) return;

      setCallBusy(true);
      setNotice('');
      setMediaError('');

      try {
        const response = await fetch(
          `/api/admin/communications/calls/${encodeURIComponent(id)}/end`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              reason: 'Call ended by participant',
            }),
          },
        );

        const json = await response.json().catch(() => null);
        if (!response.ok || !json?.ok) {
          const facing = userFacingApiError({
            response,
            json,
            fallback: 'The call could not be ended cleanly.',
          });
          throw new Error(errorText(facing));
        }

        releaseRtcLease(id);
        setRtc(null);
        setMediaPhase('idle');
        setTerminalCall(json.call || null);
        storeCall(null);
        void syncActivityPresence();
        await refreshCommunications();
      } catch (error: any) {
        setNotice(
          error?.message || 'The call could not be ended cleanly.',
        );
        throw error;
      } finally {
        setCallBusy(false);
      }
    },
    [
      call?.id,
      callBusy,
      refreshCommunications,
      releaseRtcLease,
      storeCall,
      syncActivityPresence,
    ],
  );

  const takeOverCall = useCallback(() => {
    const current = callRef.current;
    if (!current || current.state !== 'LIVE') return;

    const won = claimRtcLease(current.id, true);
    if (!won) return;

    initiatedCallId.current = current.id;
    setNotice('');
    setMediaError('');
    setRtc(null);
    setMediaPhase('connecting');
    setReconnectTick((value) => value + 1);
  }, [claimRtcLease]);

  const markNotificationsRead = useCallback(
    async (ids?: string[]) => {
      try {
        await fetch('/api/admin/communications/notifications', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ids: ids || [], read: true }),
        });
        await refreshCommunications();
      } catch {
        // Non-blocking UI action.
      }
    },
    [refreshCommunications],
  );

  const dismissNotification = useCallback(
    async (id: string) => {
      try {
        await fetch('/api/admin/communications/notifications', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ids: [id],
            read: true,
            dismissed: true,
          }),
        });
        await refreshCommunications();
      } catch {
        // Non-blocking UI action.
      }
    },
    [refreshCommunications],
  );

  const value = useMemo<StaffCommunicationsContextValue>(
    () => ({
      summary,
      unreadMessages: summary?.unreadMessages || 0,
      unreadNotifications: summary?.unreadNotifications || 0,
      currentCall: call,
      incomingCall,
      callHistory: summary?.callHistory || [],
      notifications: summary?.notifications || [],
      callBusy,
      mediaPhase,
      startCall,
      acceptCall,
      declineCall,
      endCall,
      refreshCommunications,
      markNotificationsRead,
      dismissNotification,
      notice,
      clearNotice,
    }),
    [
      summary,
      call,
      incomingCall,
      callBusy,
      mediaPhase,
      startCall,
      acceptCall,
      declineCall,
      endCall,
      refreshCommunications,
      markNotificationsRead,
      dismissNotification,
      notice,
      clearNotice,
    ],
  );

  const callActive = Boolean(
    call && ['RINGING', 'LIVE'].includes(call.state),
  );

  const shouldConnectMedia = Boolean(
    call &&
      call.state === 'LIVE' &&
      rtcOwner &&
      rtc?.token &&
      rtc?.wsUrl,
  );

  const elapsedSeconds =
    call?.state === 'LIVE' && call.startedAt
      ? Math.max(
          0,
          Math.floor(
            (clockTick - new Date(call.startedAt).getTime()) / 1000,
          ),
        )
      : 0;

  const dockStatus = (() => {
    if (!call) return '';
    if (call.state === 'RINGING') {
      return call.isCaller ? 'Ringing' : 'Incoming call';
    }
    if (call.state !== 'LIVE') return humanCallOutcome(call.outcome);
    if (rtcOwnedElsewhere || mediaPhase === 'other-tab') {
      return 'Active in another tab';
    }
    if (mediaPhase === 'connected') {
      return `Connected · ${formatDuration(elapsedSeconds)}`;
    }
    if (mediaPhase === 'reconnecting') return 'Reconnecting secure media';
    if (mediaPhase === 'failed') return 'Media connection needs attention';
    return 'Connecting secure media';
  })();

  return (
    <StaffCommunicationsContext.Provider value={value}>
      {children}

      {notice ? (
        <div className="fixed bottom-5 right-5 z-[160] flex max-w-md items-start gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur-xl">
          <Bell className="mt-0.5 h-4 w-4 text-cyan-700" />
          <div className="min-w-0 flex-1 text-sm text-slate-700">
            {notice}
          </div>
          <button
            type="button"
            onClick={clearNotice}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {incomingCall ? (
        <div className="fixed inset-x-4 top-20 z-[170] mx-auto max-w-md overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_28px_80px_-24px_rgba(15,23,42,0.45)] backdrop-blur-2xl">
          <div className="h-1 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500" />
          <div className="p-5">
            <div className="flex items-center gap-4">
              <div className="relative">
                {avatarUrl(incomingCall.other) ? (
                  <img
                    src={avatarUrl(incomingCall.other)}
                    alt=""
                    className="h-14 w-14 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-950 text-lg font-semibold text-white">
                    {callName(incomingCall).slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-700">
                  Incoming {incomingCall.mode === 'VIDEO' ? 'video' : 'audio'} call
                </div>
                <div className="mt-1 truncate text-xl font-semibold tracking-tight text-slate-950">
                  {callName(incomingCall)}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Ambulant+ staff
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={callBusy}
                onClick={() => void declineCall(incomingCall.id)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
              >
                <PhoneOff className="h-5 w-5" />
                Decline
              </button>
              <button
                type="button"
                disabled={callBusy}
                onClick={() => void acceptCall(incomingCall.id)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {incomingCall.mode === 'VIDEO' ? (
                  <Video className="h-5 w-5" />
                ) : (
                  <Phone className="h-5 w-5" />
                )}
                Accept
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {call && callActive ? (
        <div
          className={`fixed bottom-4 right-4 z-[150] overflow-hidden border border-white/10 bg-slate-950 text-white shadow-[0_30px_100px_-25px_rgba(2,6,23,0.8)] transition-all duration-200 ${
            minimized
              ? 'w-[min(390px,calc(100vw-2rem))] rounded-2xl'
              : call.mode === 'VIDEO'
                ? 'h-[500px] w-[min(680px,calc(100vw-2rem))] rounded-[28px]'
                : 'w-[min(440px,calc(100vw-2rem))] rounded-[28px]'
          }`}
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-xl">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300">
                {call.mode === 'VIDEO' ? (
                  <Video className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  {callName(call)}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/55">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      call.state === 'LIVE' && mediaPhase === 'connected'
                        ? 'bg-emerald-400'
                        : call.state === 'RINGING'
                          ? 'bg-amber-400'
                          : 'bg-cyan-400'
                    }`}
                  />
                  <span>{dockStatus}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMinimized((value) => !value)}
                className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 text-white/65 transition hover:bg-white/10 hover:text-white"
                aria-label={minimized ? 'Expand call' : 'Minimize call'}
              >
                {minimized ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              <button
                type="button"
                disabled={callBusy}
                onClick={() => void endCall(call.id)}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-400 disabled:opacity-50"
              >
                <PhoneOff className="h-4 w-4" />
                End
              </button>
            </div>
          </div>

          <LiveKitRoom
            key={call.id}
            token={rtc?.token}
            serverUrl={rtc?.wsUrl}
            connect={shouldConnectMedia}
            audio={shouldConnectMedia}
            video={shouldConnectMedia && call.mode === 'VIDEO'}
            onConnected={() => {
              setMediaPhase('connected');
              setMediaError('');
              setNotice('');
              void syncActivityPresence();
            }}
            onDisconnected={(reason) => {
              console.warn('[staff communications] LiveKit disconnected', {
                callId: call.id,
                reason,
                rtcOwner: rtcOwnerRef.current,
              });

              if (
                callRef.current?.id !== call.id ||
                callRef.current?.state !== 'LIVE'
              ) {
                setMediaPhase('idle');
                return;
              }

              if (!rtcOwnerRef.current) {
                setMediaPhase('other-tab');
                return;
              }

              setMediaPhase('reconnecting');
              setRtc(null);
              setReconnectTick((value) => value + 1);
            }}
            onError={(error) => {
              console.warn('[staff communications] LiveKit room error', error);
              if (
                callRef.current?.state === 'LIVE' &&
                rtcOwnerRef.current
              ) {
                setMediaError(
                  error?.message || 'Secure media connection error.',
                );
              }
            }}
          >
            <RoomAudioRenderer />

            {!minimized ? (
              <div
                className={
                  call.mode === 'VIDEO'
                    ? 'flex h-[438px] flex-col'
                    : 'flex min-h-[190px] flex-col'
                }
                data-lk-theme="default"
              >
                {call.state === 'RINGING' ? (
                  <div className="grid flex-1 place-items-center px-8 py-8 text-center">
                    <div>
                      <div className="relative mx-auto grid h-20 w-20 place-items-center">
                        <span className="absolute inset-0 animate-ping rounded-full bg-cyan-400/10" />
                        <span className="absolute inset-2 rounded-full bg-white/[0.05]" />
                        <span className="relative grid h-14 w-14 place-items-center rounded-full bg-white/10 text-lg font-semibold">
                          {callName(call).slice(0, 1).toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-5 text-base font-semibold">
                        {call.isCaller
                          ? `Calling ${callName(call)}`
                          : callName(call)}
                      </div>
                      <div className="mt-1 text-sm text-white/45">
                        {call.isCaller
                          ? 'Ringing · secure media starts after the call is answered'
                          : 'Incoming call'}
                      </div>
                    </div>
                  </div>
                ) : rtcOwnedElsewhere || mediaPhase === 'other-tab' ? (
                  <div className="grid flex-1 place-items-center px-8 py-8 text-center">
                    <div className="max-w-sm">
                      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                        <Phone className="h-6 w-6" />
                      </div>
                      <div className="mt-4 text-base font-semibold">
                        Call active in another tab
                      </div>
                      <div className="mt-2 text-sm leading-6 text-white/45">
                        Only one Ambulant+ tab owns microphone, camera and call audio at a time.
                      </div>
                      <button
                        type="button"
                        onClick={takeOverCall}
                        className="mt-5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                      >
                        Take over in this tab
                      </button>
                    </div>
                  </div>
                ) : !shouldConnectMedia || mediaPhase !== 'connected' ? (
                  <div className="grid flex-1 place-items-center px-8 py-8 text-center">
                    <div className="max-w-sm">
                      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-cyan-300" />
                      <div className="mt-4 text-base font-semibold">
                        {mediaPhase === 'reconnecting'
                          ? 'Reconnecting secure media'
                          : 'Connecting secure media'}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-white/45">
                        {mediaError ||
                          'Your call remains active while the encrypted media path is established.'}
                      </div>
                    </div>
                  </div>
                ) : call.mode === 'VIDEO' ? (
                  <div className="min-h-0 flex-1 [&_.lk-control-bar]:hidden">
                    <VideoConference />
                  </div>
                ) : (
                  <div className="grid flex-1 place-items-center px-8 py-7 text-center">
                    <div>
                      <div className="mx-auto grid h-20 w-20 place-items-center rounded-[26px] bg-gradient-to-br from-cyan-400/20 to-teal-300/5 text-2xl font-semibold ring-1 ring-white/10">
                        {callName(call).slice(0, 1).toUpperCase()}
                      </div>
                      <div className="mt-4 text-base font-semibold">
                        {callName(call)}
                      </div>
                      <div className="mt-1 text-sm text-emerald-300/80">
                        Audio connected · {formatDuration(elapsedSeconds)}
                      </div>
                    </div>
                  </div>
                )}

                {call.state === 'LIVE' &&
                rtcOwner &&
                shouldConnectMedia &&
                mediaPhase === 'connected' ? (
                  <div className="border-t border-white/10 bg-white/[0.03] px-3 py-2 [&_.lk-button]:rounded-xl">
                    <ControlBar
                      controls={{
                        microphone: true,
                        camera: call.mode === 'VIDEO',
                        screenShare: false,
                        chat: false,
                        leave: false,
                      } as any}
                      variation="minimal"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </LiveKitRoom>
        </div>
      ) : null}

      {terminalCall ? (
        <div className="fixed bottom-5 right-5 z-[145] rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur-xl">
          <div className="text-sm font-semibold text-slate-900">
            {humanCallOutcome(terminalCall.outcome)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {callName(terminalCall)}
          </div>
        </div>
      ) : null}
    </StaffCommunicationsContext.Provider>
  );
}
