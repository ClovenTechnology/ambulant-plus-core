// apps/patient-app/components/ReminderList.tsx
'use client';

import React, { useMemo } from 'react';
import ReminderCard, { ReminderShape } from './ReminderCard';

type Props = {
  reminders?: ReminderShape[] | null;
  onConfirm?: (r: ReminderShape) => Promise<void> | void;
  onSnooze?: (r: ReminderShape, mins?: number) => Promise<void> | void;
  onEdit?: (r: ReminderShape) => void;
  onSyncErx?: (r: ReminderShape) => Promise<void>;
  className?: string;
};

function shortWhen(isoOrTime?: string) {
  if (!isoOrTime) return '';
  // if looks like HH:MM leave as-is
  if (/^\d{1,2}:\d{2}$/.test(isoOrTime)) return isoOrTime;
  try {
    const d = new Date(isoOrTime);
    if (!isNaN(d.getTime())) return d.toLocaleString();
  } catch {}
  return isoOrTime;
}

export default function ReminderList({
  reminders = [],
  onConfirm,
  onSnooze,
  onEdit,
  onSyncErx,
  className = '',
}: Props) {
  // normalize items (avoid accidental undefined)
  const normalized = reminders?.filter(Boolean).map((r) => ({
    ...r,
    dueTime: r?.dueTime ?? r?.meta?.displayTime ?? '',
    title: r?.title ?? 'Untitled reminder',
    type: r?.type ?? 'other',
  })) ?? [];

  // group by type and sort by time (simple)
  const groups = useMemo(() => {
    const g: Record<string, ReminderShape[]> = {};
    normalized.forEach((r) => {
      const k = r.type ?? 'other';
      if (!g[k]) g[k] = [];
      g[k].push(r);
    });
    for (const k of Object.keys(g)) {
      g[k].sort((a, b) => {
        const at = a.dueTime ?? '';
        const bt = b.dueTime ?? '';
        return at.localeCompare(bt);
      });
    }
    return g;
  }, [normalized]);

  // upcoming count/badge
  const upcomingCount = normalized.filter((r) => !r.completed).length;

  if (!normalized.length) {
    return <div className={`text-sm text-gray-500 p-3 ${className}`}>No reminders</div>;
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium">Upcoming ({upcomingCount})</div>
        <div className="text-xs text-gray-400">Grouped by type</div>
      </div>

      <div className="space-y-2">
        {Object.keys(groups).map((type) => (
          <div key={type}>
            <div className="text-xxs text-gray-400 uppercase mb-1">{type}</div>
            <div className="space-y-2">
              {groups[type].map((r) => (
                <ReminderCard
                  key={r.id ?? `${type}-${r.title}-${r.dueTime}`}
                  reminder={r}
                  onConfirm={onConfirm}
                  onSnooze={onSnooze}
                  onEdit={onEdit}
                  onSyncErx={onSyncErx}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
