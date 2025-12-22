'use client';

import React, { useEffect, useState } from 'react';

export type ReminderType =
  | 'pill'
  | 'hydration'
  | 'exercise'
  | 'sleep'
  | 'meditation'
  | 'other';

export type ReminderShape = {
  id?: string;
  type?: ReminderType;
  title?: string;
  dueTime?: string; // '08:00' or ISO string
  completed?: boolean;
  dose?: string; // for pill
  status?: 'Pending' | 'Taken' | 'Missed';
  erxId?: string | null; // optional eRx link
  notes?: string;
  recurrence?: string; // rrule or simple string for recurrence rules
  meta?: Record<string, any>;
};

interface Props {
  reminder?: ReminderShape | null;
  autoSyncErx?: boolean;
  onConfirm?: (reminder: ReminderShape) => Promise<void> | void;
  onSnooze?: (reminder: ReminderShape, mins?: number) => Promise<void> | void;
  onEdit?: (reminder: ReminderShape) => void;
  onSyncErx?: (reminder: ReminderShape) => Promise<void>;
  className?: string;
}

const statusColor: Record<string, string> = {
  Pending: 'bg-yellow-50 text-yellow-800',
  Taken: 'bg-emerald-50 text-emerald-800',
  Missed: 'bg-red-50 text-red-800',
};

export default function ReminderCard({
  reminder = {},
  autoSyncErx = false,
  onConfirm,
  onSnooze,
  onEdit,
  onSyncErx,
  className = '',
}: Props) {
  // defensive defaults
  const safe: Required<Pick<ReminderShape, 'title' | 'type'>> &
    Partial<ReminderShape> = {
    title: reminder?.title ?? 'Unnamed reminder',
    type: reminder?.type ?? 'other',
    dueTime: reminder?.dueTime,
    dose: reminder?.dose,
    status: reminder?.status,
    completed: reminder?.completed,
    erxId: reminder?.erxId ?? null,
    notes: reminder?.notes,
    recurrence: reminder?.recurrence,
    meta: reminder?.meta,
    id: reminder?.id,
  };

  const [busy, setBusy] = useState(false);
  const initialStatus = safe.status ?? (safe.completed ? 'Taken' : 'Pending');
  const [status, setStatus] = useState<string>(initialStatus);

  useEffect(() => {
    setStatus(safe.status ?? (safe.completed ? 'Taken' : 'Pending'));
  }, [safe.status, safe.completed]);

  // optional auto-sync eRx if pill
  useEffect(() => {
    let mounted = true;
    async function maybeSync() {
      if (!mounted) return;
      if (safe.type === 'pill' && safe.erxId && autoSyncErx) {
        setBusy(true);
        try {
          if (onSyncErx && safe.id)
            await onSyncErx({ ...safe } as ReminderShape);
          else {
            // best-effort fallback: call platform endpoint
            await fetch('/api/erx/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ erxId: safe.erxId }),
            });
          }
        } catch {
        } finally {
          if (mounted) setBusy(false);
        }
      }
    }
    maybeSync();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safe.erxId, safe.type, autoSyncErx]);

  // Icons aligned with getCategoryIcon() used in page.tsx
  const typeIcon = (() => {
    switch (safe.type) {
      case 'pill':
        return '⚕️';
      case 'hydration':
        return '💧';
      case 'exercise':
        return '🏋️';
      case 'sleep':
        return '🌙';
      case 'meditation':
        return '🧘';
      default:
        return '⏰';
    }
  })();

  const displayTime = safe.dueTime ?? safe.meta?.displayTime ?? '';

  async function handleConfirm() {
    if (!safe.id) return;
    setBusy(true);
    setStatus('Taken');
    try {
      await (onConfirm
        ? onConfirm({ ...safe } as ReminderShape)
        : Promise.resolve());
    } catch {}
    setBusy(false);
  }

  async function handleSnooze(mins = 10) {
    setBusy(true);
    try {
      await (onSnooze
        ? onSnooze({ ...safe } as ReminderShape, mins)
        : Promise.resolve());
    } catch {}
    setBusy(false);
  }

  async function handleSyncErx() {
    if (!safe.erxId) return;
    setBusy(true);
    try {
      if (onSyncErx && safe.id) await onSyncErx({ ...safe } as ReminderShape);
      else {
        await fetch('/api/erx/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ erxId: safe.erxId }),
        });
      }
    } catch {}
    setBusy(false);
  }

  return (
    <div
      className={`flex justify-between items-center p-3 border rounded-lg bg-white shadow-sm ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-md flex items-center justify-center text-lg bg-gradient-to-br from-slate-50 to-white">
          <span aria-hidden>{typeIcon}</span>
        </div>

        <div>
          <div className="font-medium">{safe.title}</div>
          <div className="text-xs text-gray-500">
            {safe.dose
              ? `${safe.dose} • ${displayTime}`
              : displayTime || safe.notes ?? ''}
          </div>
          {safe.recurrence ? (
            <div className="text-xxs text-gray-400 mt-1">
              Repeats: {safe.recurrence}
            </div>
          ) : null}
          {safe.erxId ? (
            <div className="text-xxs text-gray-400 mt-1">
              eRx: {safe.erxId}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${
            statusColor[status] ?? 'bg-gray-100 text-gray-700'
          }`}
        >
          {status}
        </span>

        {safe.type === 'pill' && safe.erxId ? (
          <button
            onClick={handleSyncErx}
            disabled={busy}
            className="px-2 py-1 rounded border text-xs"
          >
            ⤴️ Sync
          </button>
        ) : null}

        {status !== 'Taken' ? (
          <>
            <button
              onClick={handleConfirm}
              disabled={busy}
              className="px-2 py-1 rounded bg-emerald-600 text-white text-xs"
            >
              ✅
            </button>
            <button
              onClick={() => handleSnooze(10)}
              disabled={busy}
              className="px-2 py-1 rounded bg-gray-200 text-xs"
            >
              ⏰
            </button>
          </>
        ) : (
          <button
            onClick={() => onEdit?.({ ...safe } as ReminderShape)}
            className="px-2 py-1 rounded border text-xs"
          >
            ✎
          </button>
        )}
      </div>
    </div>
  );
}
