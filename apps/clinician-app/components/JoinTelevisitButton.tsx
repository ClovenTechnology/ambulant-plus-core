'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  /** ISO start time of the appointment */
  startISO: string;
  /** Optional ISO end time. Defaults to 30 minutes after start when absent. */
  endISO?: string | null;
  /** Appointment lifecycle status. Closed sessions cannot be joined. */
  status?: string | null;
  /** Room id if already assigned; falls back to appt id or a deterministic hash */
  roomId?: string;
  /** Optional appt id to use as fallback */
  apptId?: string;
  /** Optional additional query, e.g. clinicianId, encounterId */
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Hide the button entirely until the appointment is immediately joinable */
  hideUntilAvailable?: boolean;
  /** Size/style override */
  className?: string;
};

const EARLY_JOIN_MS = 5 * 60 * 1000;
const DEFAULT_SESSION_MS = 30 * 60 * 1000;

function normaliseStatus(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function isClosedStatus(value: unknown) {
  const status = normaliseStatus(value);

  return (
    status === 'cancelled' ||
    status === 'canceled' ||
    status === 'completed' ||
    status === 'complete' ||
    status === 'done' ||
    status === 'closed' ||
    status === 'no-show' ||
    status === 'no_show'
  );
}

function parseMs(value?: string | null) {
  if (!value) return 0;

  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getJoinState({
  startISO,
  endISO,
  status,
  roomId,
  apptId,
}: Pick<Props, 'startISO' | 'endISO' | 'status' | 'roomId' | 'apptId'>) {
  const startMs = parseMs(startISO);

  if (!startMs) {
    return {
      joinable: false,
      label: 'Not yet available',
      targetRoom: '',
      title: 'Appointment start time is unavailable.',
    };
  }

  const endMs = parseMs(endISO) || startMs + DEFAULT_SESSION_MS;

  if (!Number.isFinite(endMs) || endMs <= startMs) {
    return {
      joinable: false,
      label: 'Not yet available',
      targetRoom: '',
      title: 'Appointment end time is unavailable.',
    };
  }

  if (isClosedStatus(status)) {
    return {
      joinable: false,
      label: 'Session closed',
      targetRoom: '',
      title: 'This appointment is closed and cannot be joined.',
    };
  }

  const now = new Date();
  const nowMs = now.getTime();

  if (!sameDay(new Date(startMs), now)) {
    return {
      joinable: false,
      label: 'Not today',
      targetRoom: '',
      title: 'This appointment is not scheduled for today.',
    };
  }

  const targetRoom = roomId || apptId || quickHash(startISO);
  const opensAtMs = startMs - EARLY_JOIN_MS;

  if (nowMs < opensAtMs) {
    const minutes = Math.max(1, Math.ceil((opensAtMs - nowMs) / 60_000));

    return {
      joinable: false,
      label: 'Not yet available',
      targetRoom,
      title: `Join opens in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    };
  }

  if (nowMs > endMs) {
    return {
      joinable: false,
      label: 'Session ended',
      targetRoom,
      title: 'The scheduled session window has ended.',
    };
  }

  return {
    joinable: true,
    label: 'Join Televisit',
    targetRoom,
    title: 'Join this Televisit now.',
  };
}

/** Join Televisit is visible only for immediate sessions when hideUntilAvailable is enabled. */
export default function JoinTelevisitButton({
  startISO,
  endISO,
  status,
  roomId,
  apptId,
  query,
  hideUntilAvailable = false,
  className,
}: Props) {
  const router = useRouter();

  const { joinable, label, targetRoom, title } = useMemo(
    () => getJoinState({ startISO, endISO, status, roomId, apptId }),
    [apptId, endISO, roomId, startISO, status],
  );

  if (hideUntilAvailable && !joinable) return null;

  const go = () => {
    if (!joinable || !targetRoom) return;

    const qs = new URLSearchParams(
      Object.entries(query || {}).reduce<Record<string, string>>((acc, [key, value]) => {
        if (value === undefined || value === null || value === '') return acc;
        acc[key] = String(value);
        return acc;
      }, {}),
    );

    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    router.push(`/sfu/${encodeURIComponent(targetRoom)}${suffix}`);
  };

  return (
    <button
      type="button"
      onClick={go}
      disabled={!joinable}
      title={title}
      aria-disabled={!joinable}
      className={
        className ??
        `inline-flex items-center justify-center rounded-full border px-3 py-2 text-xs font-semibold transition
         ${
           joinable
             ? 'border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700'
             : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
         }`
      }
    >
      {label}
    </button>
  );
}

// Deterministic short id when no roomId/apptId is given.
function quickHash(text: string) {
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (Math.imul(31, hash) + text.charCodeAt(index)) | 0;
  }

  return `room-${Math.abs(hash).toString(36)}`;
}
