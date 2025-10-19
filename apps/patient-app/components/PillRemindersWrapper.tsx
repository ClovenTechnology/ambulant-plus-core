// apps/patient-app/components/PillRemindersWrapper.tsx
'use client';

import React, { useEffect, useState } from 'react';
import PillReminderCard from './PillReminderCard';
import type { Pill } from '@/types';

type Reminder = {
  id: string;
  name: string;
  dose?: string;
  time?: string;
  status: 'Pending' | 'Taken' | 'Missed';
  snoozedUntil?: string | null;
};

export default function PillRemindersWrapper({ pills: initialPills }: { pills?: { id?: string; name: string; dose?: string; time?: string; status?: string }[] }) {
  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/reminders', { cache: 'no-store' });
      const data = await res.json();
      setReminders(data?.reminders ?? []);
    } catch (err) {
      console.error(err);
      // fall back to initial pills passed from server
      setReminders((initialPills ?? []).map(p => ({
        id: p.id ?? `${p.name}-${p.time ?? '0'}`,
        name: p.name,
        dose: p.dose,
        time: p.time,
        status: (p.status as any) ?? 'Pending',
      })));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function confirmTaken(id: string) {
    try {
      const res = await fetch('/api/reminders/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', id }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        // update UI
        setReminders(prev => prev ? prev.map(r => (r.id === id ? { ...r, status: 'Taken', snoozedUntil: null } : r)) : prev);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function snooze(id: string, minutes = 15) {
    try {
      const res = await fetch('/api/reminders/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'snooze', id, snoozeMinutes: minutes }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setReminders(prev =>
          prev
            ? prev.map(r => (r.id === id ? { ...r, snoozedUntil: data?.results?.[id]?.reminder?.snoozedUntil ?? r.snoozedUntil } : r))
            : prev
        );
      }
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="space-y-2">
      {loading && <div className="text-sm text-gray-500">Loading reminders…</div>}
      {!loading && (!reminders || reminders.length === 0) && <div className="text-sm text-gray-500">No reminders for today.</div>}

      <ul className="space-y-2 text-sm">
        {reminders?.map(r => (
          <li key={r.id} className="border rounded p-2 bg-white flex items-start justify-between">
            <div>
              <div className="font-medium">{r.name} {r.dose ? `• ${r.dose}` : ''}</div>
              <div className="text-xs text-gray-500">{r.time ?? ''}{r.snoozedUntil ? ` • snoozed until ${new Date(r.snoozedUntil).toLocaleTimeString()}` : ''}</div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="text-xs">{r.status}</div>
              <div className="flex gap-1">
                <button onClick={() => confirmTaken(r.id)} className="px-2 py-1 text-xs rounded border">Confirm</button>
                <button onClick={() => snooze(r.id, 15)} className="px-2 py-1 text-xs rounded border">Snooze 15m</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
