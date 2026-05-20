// apps/patient-app/components/TodaysPills.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { toast } from '@/components/toast';

type PillStatus = 'Pending' | 'Taken' | 'Missed' | string;

interface Pill {
  id: string;
  reminderId?: string | null;
  medicationId?: string | null;
  name: string;
  dose?: string | null;
  time?: string | null;
  status: PillStatus;
  verificationRequired?: boolean;
  verificationStatus?: string | null;
  meta?: Record<string, any> | null;
}

interface TodaysPillsProps {
  pills: Pill[];
  onAdherenceUpdate?: (adherencePct: number) => void;
  onRefresh?: () => void | Promise<void>;
}

function computeAdherence(list: Pill[]) {
  const total = list.length;
  if (total === 0) return 100;
  const taken = list.filter((pill) => String(pill.status).toLowerCase().includes('taken')).length;
  return Math.round((taken / total) * 100);
}

function resolveReminderId(pill: Pill) {
  return String(pill.reminderId || pill.id || '').trim();
}

function requiresCamera(pill: Pill) {
  return Boolean(pill.verificationRequired ?? pill.meta?.verificationRequired);
}

function timeToIsoToday(hhmm?: string | null) {
  const now = new Date();
  const raw = String(hhmm || '').trim();
  const [hh, mm] = raw.includes(':') ? raw.split(':').map((item) => Number(item)) : [now.getHours(), now.getMinutes()];
  const target = new Date(now);
  target.setHours(Number.isFinite(hh) ? hh : now.getHours(), Number.isFinite(mm) ? mm : now.getMinutes(), 0, 0);
  return target.toISOString();
}

async function postReminderAction(payload: any) {
  const res = await fetch('/api/reminders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.message || data?.error || `Reminder update failed (${res.status})`);
  }

  return data;
}

async function startVerification(pill: Pill) {
  const reminderId = resolveReminderId(pill);
  if (!reminderId) throw new Error('Reminder ID is missing.');

  if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    stream.getTracks().forEach((track) => track.stop());
  }

  const res = await fetch('/api/medication-verifications/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      reminderId,
      medicationId: pill.medicationId ?? null,
      requiredMode: 'CAMERA_SEQUENCE',
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok || !data?.sessionId) {
    throw new Error(data?.message || data?.error || 'Could not start camera verification.');
  }

  window.location.href = `/reminder/verify?reminderId=${encodeURIComponent(reminderId)}&sessionId=${encodeURIComponent(data.sessionId)}`;
}

export default function TodaysPills({ pills, onAdherenceUpdate, onRefresh }: TodaysPillsProps) {
  const [pillState, setPillState] = useState<Pill[]>(() => Array.isArray(pills) ? pills : []);
  const [busyId, setBusyId] = useState<string | null>(null);

  React.useEffect(() => {
    setPillState(Array.isArray(pills) ? pills : []);
  }, [pills]);

  const pendingCount = useMemo(
    () => pillState.filter((pill) => String(pill.status).toLowerCase().includes('pending')).length,
    [pillState],
  );

  async function handleConfirm(pill: Pill) {
    const reminderId = resolveReminderId(pill);
    if (!reminderId) {
      toast('This pill is missing a reminder ID.', { type: 'error' });
      return;
    }

    setBusyId(reminderId);

    try {
      if (requiresCamera(pill)) {
        await startVerification(pill);
        return;
      }

      const takenAt = new Date().toISOString();
      await postReminderAction({
        action: 'confirm',
        ids: [reminderId],
        id: reminderId,
        takenAt,
        takenSource: 'SELF_REPORTED',
        verificationStatus: 'SELF_REPORTED',
        reason: 'manual_confirmation',
      });

      setPillState((prev) => {
        const next = prev.map((item) =>
          resolveReminderId(item) === reminderId
            ? { ...item, status: 'Taken', verificationStatus: 'SELF_REPORTED' }
            : item,
        );
        onAdherenceUpdate?.(computeAdherence(next));
        return next;
      });

      await onRefresh?.();
      toast('Dose recorded.', { type: 'success' });
    } catch (err: any) {
      toast(err?.message || 'Could not record this dose.', { type: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  async function handleSnooze(pill: Pill, minutes = 15) {
    const reminderId = resolveReminderId(pill);
    if (!reminderId) {
      toast('This pill is missing a reminder ID.', { type: 'error' });
      return;
    }

    setBusyId(reminderId);

    try {
      await postReminderAction({
        action: 'snooze',
        ids: [reminderId],
        id: reminderId,
        snoozeMinutes: minutes,
      });

      await onRefresh?.();
      toast(`Reminder snoozed for ${minutes} minutes.`, { type: 'success' });
    } catch (err: any) {
      toast(err?.message || 'Could not snooze this reminder.', { type: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  if (pillState.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        No pill reminders for today.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>{pendingCount} pending today</span>
        <span>Camera verification follows each reminder policy.</span>
      </div>

      {pillState.map((pill) => {
        const reminderId = resolveReminderId(pill);
        const pending = String(pill.status).toLowerCase().includes('pending');
        const busy = busyId === reminderId;
        const camera = requiresCamera(pill);

        return (
          <div key={reminderId || pill.name} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="min-w-0">
              <div className="truncate font-semibold text-slate-900">{pill.name}</div>
              <div className="mt-1 text-sm text-slate-500">
                {[pill.dose, pill.time].filter(Boolean).join(' · ') || 'Dose details not recorded'}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                pending
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : String(pill.status).toLowerCase().includes('taken')
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}>
                {pill.status}
              </span>

              {camera ? (
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-800">
                  Camera
                </span>
              ) : null}

              {pending ? (
                <>
                  <button
                    type="button"
                    onClick={() => void handleConfirm(pill)}
                    disabled={busy}
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busy ? 'Saving…' : camera ? 'Verify' : 'Taken'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSnooze(pill)}
                    disabled={busy}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Snooze
                  </button>
                </>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
