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
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
} from '@livekit/components-react';
import {
  Bell,
  Mic,
  Phone,
  PhoneOff,
  Video,
  X,
} from 'lucide-react';
import { errorText, userFacingApiError } from '@/lib/admin-error';

type CallMode = 'AUDIO' | 'VIDEO';

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

const StaffCommunicationsContext =
  createContext<StaffCommunicationsContextValue | null>(null);

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

function callLabel(call: StaffCall | null) {
  if (!call) return 'Call';
  return call.mode === 'VIDEO' ? 'Video call' : 'Audio call';
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
  const [rtc, setRtc] = useState<RtcCredentials | null>(null);
  const [notice, setNotice] = useState('');
  const [callBusy, setCallBusy] = useState(false);
  const lastIncomingId = useRef('');
  const seenNotificationIds = useRef<Set<string> | null>(null);
  const reconnecting = useRef(false);
  const ringTimer = useRef<number | null>(null);
  const authPage = pathname.startsWith('/auth/');

  const clearNotice = useCallback(() => setNotice(''), []);

  const refreshCommunications = useCallback(async () => {
    if (authPage) return;

    try {
      const response = await fetch('/api/admin/communications/summary', {
        cache: 'no-store',
      });

      if (response.status === 401 || response.status === 403) return;

      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) return;

      const next = json as Summary;
      setSummary(next);

      const nextCurrentCall = next.currentCall;
      if (nextCurrentCall) {
        setCall((current) =>
          current?.id === nextCurrentCall.id
            ? { ...current, ...nextCurrentCall }
            : nextCurrentCall,
        );
      } else {
        setCall(null);
        setRtc(null);
      }
    } catch {
      // Background communications polling is deliberately silent.
    }
  }, [authPage]);

  const reconnectCall = useCallback(async (meetingId: string) => {
    if (reconnecting.current) return;
    reconnecting.current = true;
    try {
      const response = await fetch(
        `/api/admin/communications/calls/${encodeURIComponent(meetingId)}/token`,
        { method: 'POST' },
      );
      const json = await response.json().catch(() => null);
      if (response.ok && json?.ok && json?.rtc?.token && json?.rtc?.wsUrl) {
        setCall(json.call || null);
        setRtc(json.rtc);
      }
    } finally {
      reconnecting.current = false;
    }
  }, []);

  useEffect(() => {
    if (authPage) return;
    void refreshCommunications();
    const timer = window.setInterval(() => {
      void refreshCommunications();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [authPage, refreshCommunications]);

  useEffect(() => {
    if (
      call &&
      !rtc &&
      ['RINGING', 'LIVE'].includes(call.state) &&
      (call.isCaller || call.participant?.state === 'JOINED')
    ) {
      void reconnectCall(call.id);
    }
  }, [call, rtc, reconnectCall]);

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

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const notification = new Notification(item.title || 'Ambulant+ notification', {
          body: item.body || undefined,
          tag: `ambulant-staff-${item.id}`,
        });
        notification.onclick = () => {
          window.focus();
          if (item.actorProfile?.id) {
            router.push(`/admin/communications?staffId=${encodeURIComponent(item.actorProfile.id)}`);
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
  }, [incomingCall, router]);

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
        // Browsers may require a prior user gesture for audio.
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

  const startCall = useCallback(
    async (conversationId: string, mode: CallMode) => {
      if (callBusy) return;
      setCallBusy(true);
      setNotice('');
      try {
        if (
          typeof Notification !== 'undefined' &&
          Notification.permission === 'default'
        ) {
          void Notification.requestPermission().catch(() => undefined);
        }

        const response = await fetch(
          `/api/admin/communications/conversations/${encodeURIComponent(conversationId)}/call`,
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

        if (json.busy || json.call?.outcome === 'BUSY') {
          setCall(json.call || null);
          setRtc(null);
          setNotice(`${callName(json.call)} is already on another call.`);
          await refreshCommunications();
          return;
        }

        setCall(json.call || null);
        setRtc(json.rtc || null);
        await refreshCommunications();
      } catch (error: any) {
        setNotice(error?.message || 'The call could not be started.');
        throw error;
      } finally {
        setCallBusy(false);
      }
    },
    [callBusy, refreshCommunications],
  );

  const respond = useCallback(
    async (meetingId: string, action: 'ACCEPT' | 'DECLINE') => {
      if (callBusy) return;
      setCallBusy(true);
      setNotice('');
      try {
        const response = await fetch(
          `/api/admin/communications/calls/${encodeURIComponent(meetingId)}/respond`,
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
        setCall(json.call || null);
        setRtc(action === 'ACCEPT' ? json.rtc || null : null);
        await refreshCommunications();
      } catch (error: any) {
        setNotice(error?.message || 'The call response could not be completed.');
        throw error;
      } finally {
        setCallBusy(false);
      }
    },
    [callBusy, refreshCommunications],
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
      try {
        const response = await fetch(
          `/api/admin/communications/calls/${encodeURIComponent(id)}/end`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ reason: 'Call ended by participant' }),
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
        setRtc(null);
        setCall(null);
        await refreshCommunications();
      } catch (error: any) {
        setNotice(error?.message || 'The call could not be ended cleanly.');
        throw error;
      } finally {
        setCallBusy(false);
      }
    },
    [call?.id, callBusy, refreshCommunications],
  );

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
          body: JSON.stringify({ ids: [id], read: true, dismissed: true }),
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

  const connected =
    Boolean(call && rtc && ['RINGING', 'LIVE'].includes(call.state));

  return (
    <StaffCommunicationsContext.Provider value={value}>
      {children}

      {notice ? (
        <div className="fixed bottom-5 right-5 z-[120] flex max-w-md items-start gap-3 rounded-2xl border bg-white p-4 shadow-2xl">
          <Bell className="mt-0.5 h-4 w-4 text-cyan-700" />
          <div className="min-w-0 flex-1 text-sm text-slate-700">{notice}</div>
          <button
            type="button"
            onClick={clearNotice}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {incomingCall ? (
        <div className="fixed inset-x-4 top-20 z-[140] mx-auto max-w-md rounded-3xl border bg-white p-5 shadow-2xl">
          <div className="flex items-center gap-4">
            {avatarUrl(incomingCall.other) ? (
              <img
                src={avatarUrl(incomingCall.other)}
                alt=""
                className="h-14 w-14 rounded-full object-cover"
              />
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-lg font-semibold text-slate-600">
                {callName(incomingCall).slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">
                Incoming {incomingCall.mode === 'VIDEO' ? 'video' : 'audio'} call
              </div>
              <div className="mt-1 truncate text-xl font-semibold text-slate-950">
                {callName(incomingCall)}
              </div>
              <div className="mt-1 text-sm text-slate-500">Ambulant+ staff call</div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={callBusy}
              onClick={() => void declineCall(incomingCall.id)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              <PhoneOff className="h-5 w-5" />
              Decline
            </button>
            <button
              type="button"
              disabled={callBusy}
              onClick={() => void acceptCall(incomingCall.id)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {incomingCall.mode === 'VIDEO' ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
              Accept
            </button>
          </div>
        </div>
      ) : null}

      {call && rtc && connected ? (
        <div
          className={`fixed z-[130] overflow-hidden border border-slate-700 bg-slate-950 text-white shadow-2xl ${
            call.mode === 'VIDEO'
              ? 'bottom-4 right-4 h-[420px] w-[min(620px,calc(100vw-2rem))] rounded-3xl'
              : 'bottom-4 right-4 w-[min(420px,calc(100vw-2rem))] rounded-3xl'
          }`}
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              {call.mode === 'VIDEO' ? (
                <Video className="h-4 w-4 text-cyan-300" />
              ) : (
                <Mic className="h-4 w-4 text-cyan-300" />
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{callName(call)}</div>
                <div className="text-[11px] text-white/60">
                  {call.state === 'RINGING'
                    ? 'Calling…'
                    : `${callLabel(call)} · Connected`}
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={callBusy}
              onClick={() => void endCall(call.id)}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold disabled:opacity-50"
            >
              <PhoneOff className="h-4 w-4" />
              End
            </button>
          </div>

          <div
            className={call.mode === 'VIDEO' ? 'h-[360px]' : 'h-24'}
            data-lk-theme="default"
          >
            <LiveKitRoom
              token={rtc.token}
              serverUrl={rtc.wsUrl}
              connect={true}
              audio={true}
              video={call.mode === 'VIDEO'}
              onDisconnected={() => {
                setRtc(null);
                window.setTimeout(() => {
                  void refreshCommunications();
                }, 750);
              }}
              style={{ height: '100%' }}
            >
              {call.mode === 'VIDEO' ? (
                <VideoConference />
              ) : (
                <div className="grid h-full place-items-center text-center">
                  <div>
                    <div className="text-sm font-semibold">{callName(call)}</div>
                    <div className="mt-1 text-xs text-white/60">
                      {call.state === 'RINGING' ? 'Ringing…' : 'Audio connected'}
                    </div>
                  </div>
                </div>
              )}
              <RoomAudioRenderer />
            </LiveKitRoom>
          </div>
        </div>
      ) : null}

      {call && !connected && ['ENDED', 'CANCELLED', 'EXPIRED'].includes(call.state) ? (
        <div className="fixed bottom-5 right-5 z-[125] rounded-2xl border bg-white p-4 shadow-xl">
          <div className="text-sm font-semibold text-slate-900">
            {humanCallOutcome(call.outcome)}
          </div>
          <div className="mt-1 text-xs text-slate-500">{callName(call)}</div>
        </div>
      ) : null}
    </StaffCommunicationsContext.Provider>
  );
}
