'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  /** ISO start time of the appointment */
  startISO: string;
  /** Room id if already assigned; falls back to appt id or a deterministic hash */
  roomId?: string;
  /** Optional appt id to use as fallback */
  apptId?: string;
  /** Optional additional query (e.g. clinicianId, encounterId) */
  query?: Record<string, string | number | boolean | undefined>;
  /** Size/style override */
  className?: string;
};

/** “Join Televisit” becomes enabled only within 10 minutes of start time */
export default function JoinTelevisitButton({
  startISO,
  roomId,
  apptId,
  query,
  className,
}: Props) {
  const router = useRouter();

  const { joinable, label, targetRoom, title } = useMemo(() => {
    const start = new Date(startISO).getTime();
    const now = Date.now();

    // safety: bad dates
    if (!Number.isFinite(start)) {
      return { joinable: false, label: 'Not yet available', targetRoom: '', title: 'Invalid start time' };
    }

    // Enable join when we are within 10 minutes to the start (and anytime after)
    const TEN_MIN = 10 * 60 * 1000;
    const diff = start - now;

    let t = '';
    if (diff > 0) {
      const mins = Math.ceil(diff / 60000);
      t = mins > 10 ? `Available ${mins - 10} min later` : `Available in ≤ ${mins} min`;
    } else {
      t = 'Started';
    }

    const target = roomId || apptId || quickHash(startISO);
    return {
      joinable: diff <= TEN_MIN,        // true when ≤ 10 min to start or after start
      label: diff <= TEN_MIN ? 'Join Televisit' : 'Not yet available',
      targetRoom: target,
      title: t,
    };
  }, [startISO, roomId, apptId]);

  const go = () => {
    if (!joinable) return;
    const qs = new URLSearchParams(
      Object.entries(query || {}).reduce<Record<string, string>>((acc, [k, v]) => {
        if (v === undefined) return acc;
        acc[k] = String(v);
        return acc;
      }, {})
    );
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    router.push(`/sfu/${encodeURIComponent(targetRoom)}${suffix}`);
  };

  return (
    <button
      onClick={go}
      disabled={!joinable}
      title={title}
      className={
        className ??
        `inline-flex items-center justify-center px-2.5 py-1.5 rounded text-xs border
         ${joinable
           ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
           : 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed'}`
      }
    >
      {label}
    </button>
  );
}

// Deterministic short id when no roomId/apptId given
function quickHash(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return `room-${Math.abs(h).toString(36)}`;
}
