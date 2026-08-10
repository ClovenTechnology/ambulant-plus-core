'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, MessageSquare, PhoneMissed, X } from 'lucide-react';
import { useStaffCommunications } from '@/components/StaffCommunicationsProvider';

function when(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return 'now';
  if (diff < 60 * 60_000) return `${Math.max(1, Math.floor(diff / 60_000))}m`;
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / (60 * 60_000))}h`;
  return date.toLocaleDateString('en-ZA');
}

export default function InboxBell(_props: {
  patientId?: string;
  clinicianId?: string;
  admin?: boolean;
}) {
  const router = useRouter();
  const {
    unreadMessages,
    unreadNotifications,
    notifications,
    callHistory,
    markNotificationsRead,
    dismissNotification,
  } = useStaffCommunications();

  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const total = unreadMessages + unreadNotifications;

  const recentMissed = useMemo(
    () => callHistory.filter((call) => call.outcome === 'MISSED').slice(0, 5),
    [callHistory],
  );

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onPointer);
    return () => window.removeEventListener('pointerdown', onPointer);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        void Notification.requestPermission().catch(() => undefined);
      }
      const unreadIds = notifications
        .filter((item) => !item.readAt)
        .map((item) => item.id);
      if (unreadIds.length) void markNotificationsRead(unreadIds);
    }
  }

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        className="relative grid h-9 w-9 place-items-center rounded-xl border bg-white text-slate-700 hover:bg-slate-50"
        onClick={toggle}
        title="Messages, calls and notifications"
        aria-label="Messages, calls and notifications"
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {total > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-rose-600 px-1 text-center text-[10px] font-semibold leading-5 text-white">
            {total > 99 ? '99+' : total}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-[110] w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-2xl border bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <div className="font-semibold text-slate-950">Notifications</div>
              <div className="mt-0.5 text-xs text-slate-500">
                {unreadMessages} unread {unreadMessages === 1 ? 'message' : 'messages'}
              </div>
            </div>
          </div>

          <div className="max-h-[520px] overflow-y-auto">
            {notifications.length === 0 && recentMissed.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                You are all caught up.
              </div>
            ) : null}

            {notifications.slice(0, 30).map((item) => (
              <div key={item.id} className="flex gap-3 border-b p-4">
                <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100">
                  {item.type.includes('CALL') ? (
                    <PhoneMissed className="h-4 w-4 text-slate-600" />
                  ) : (
                    <MessageSquare className="h-4 w-4 text-slate-600" />
                  )}
                </div>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    setOpen(false);
                    const actorId = item.actorProfile?.id;
                    router.push(actorId ? `/admin/communications?staffId=${encodeURIComponent(actorId)}` : '/admin/communications');
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="truncate text-sm font-semibold text-slate-900">{item.title}</div>
                    <span className="shrink-0 text-[10px] text-slate-400">{when(item.createdAt)}</span>
                  </div>
                  {item.body ? <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.body}</div> : null}
                </button>
                <button
                  type="button"
                  onClick={() => void dismissNotification(item.id)}
                  className="self-start rounded-lg p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Dismiss notification"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
