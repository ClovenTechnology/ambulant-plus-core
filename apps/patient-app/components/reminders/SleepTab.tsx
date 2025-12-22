// components/reminders/SleepTab.tsx
import React, { useRef, useState, useMemo } from 'react';
import Section from '@/components/Section';
import ReminderList, { type ReminderShape } from '@/components/ReminderList';
import MeterDonut from '@/components/charts/AnimatedMeterDonut';
import Sparkline from '@/components/charts/Sparkline';
import { toast } from '../toast';
import {
  MOCK_ADHERENCE_TREND,
  computeWakeTime,
  type Stats,
  type NexRingSleepMetrics,
} from './shared';

type SleepTabProps = {
  stats: Stats;
  reminders: ReminderShape[];
  onListConfirm: (r: ReminderShape) => void;
  onListSnooze: (r: ReminderShape, mins?: number) => void;
  onRemindersCreated: () => Promise<void> | void;
  formRef?: React.RefObject<HTMLFormElement>;
};

type SleepSchedule = 'today' | 'everyday';

export default function SleepTab({
  stats,
  reminders,
  onListConfirm,
  onListSnooze,
  onRemindersCreated,
  formRef,
}: SleepTabProps) {
  const internalFormRef = useRef<HTMLFormElement | null>(null);
  const resolvedFormRef = formRef ?? internalFormRef;

  const [sleepTime, setSleepTime] = useState('22:30');
  const [sleepGoalHours, setSleepGoalHours] = useState('8');
  const [sleepSchedule, setSleepSchedule] =
    useState<SleepSchedule>('everyday');
  const [sleepBusy, setSleepBusy] = useState(false);
  const [sleepError, setSleepError] = useState<string | null>(null);

  const recommendedWakeTime = computeWakeTime(sleepTime, sleepGoalHours);

  const latestNexRingSleep = useMemo(() => {
    const withMetrics = reminders
      .map((r) => {
        const metrics = r.meta?.nexRing?.sleep as
          | NexRingSleepMetrics
          | undefined;
        if (!metrics) return null;
        return { reminder: r, metrics };
      })
      .filter(Boolean) as { reminder: ReminderShape; metrics: NexRingSleepMetrics }[];

    if (!withMetrics.length) return null;
    return withMetrics[0].metrics;
  }, [reminders]);

  async function handleCreateSleep(e: React.FormEvent) {
    e.preventDefault();
    if (!sleepTime) {
      const msg = 'Choose a target sleep time.';
      setSleepError(msg);
      toast(msg, { type: 'error' });
      return;
    }
    setSleepError(null);
    setSleepBusy(true);
    try {
      const goalHours = parseFloat(sleepGoalHours || '0') || null;
      const recommendedWake = computeWakeTime(sleepTime, sleepGoalHours);

      const item = {
        name: 'Sleep time',
        dose: goalHours ? `${goalHours}h goal` : null,
        time: sleepTime,
        status: 'Pending' as const,
        source: 'sleep' as const,
        meta: {
          type: 'sleep',
          goalHours,
          recommendedWake: recommendedWake || null,
          schedule: sleepSchedule,
        },
      };

      const res = await fetch('/api/reminders', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify([item]),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || (data && data.ok === false)) {
        toast(data?.error || 'Could not create sleep reminder.', {
          type: 'error',
        });
      } else {
        toast('Sleep reminder created.', { type: 'success' });
        await onRemindersCreated();
      }
    } catch (err) {
      console.error('Create sleep reminder', err);
      toast('Network error creating sleep reminder.', { type: 'error' });
    } finally {
      setSleepBusy(false);
    }
  }

  return (
    <section
      id="reminders-panel-sleep"
      role="tabpanel"
      aria-labelledby="reminders-tab-sleep"
      className="mt-2 grid gap-4 md:grid-cols-2"
    >
      <Section
        title="🌙 Sleep routine"
        subtitle="Keep a consistent bedtime and wake time."
        defaultOpen
      >
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-4">
            <MeterDonut
              value={stats.pct}
              max={100}
              label="Sleep"
              unit="%"
              color="#6366F1"
            />
            <div className="space-y-1 text-xs text-gray-600">
              <div>
                <span className="font-medium">{stats.pending}</span> upcoming
                night(s)
              </div>
              <div>
                <span className="font-medium">{stats.taken}</span> completed
              </div>
              <div>
                <span className="font-medium">{stats.missed}</span> missed
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-2">
            <div className="mb-1 text-xs text-slate-500">
              Routine consistency (placeholder)
            </div>
            <Sparkline data={MOCK_ADHERENCE_TREND} height={64} />
          </div>

          {latestNexRingSleep && (
            <div className="rounded-xl border bg-slate-50 px-3 py-2 text-xs text-gray-700">
              <div className="flex items-center justify-between">
                <span className="font-medium">Last night (NexRing)</span>
                <span className="text-[11px] text-gray-500">
                  Sleep score {latestNexRingSleep.sleepScore}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-600">
                <span>
                  {(latestNexRingSleep.totalSleepMinutes / 60).toFixed(1)}h
                  {' '}total
                </span>
                {latestNexRingSleep.deepMinutes != null && (
                  <span>
                    {(latestNexRingSleep.deepMinutes / 60).toFixed(1)}h deep
                  </span>
                )}
                {latestNexRingSleep.remMinutes != null && (
                  <span>
                    {(latestNexRingSleep.remMinutes / 60).toFixed(1)}h REM
                  </span>
                )}
                {latestNexRingSleep.efficiencyPct != null && (
                  <span>{latestNexRingSleep.efficiencyPct}% efficiency</span>
                )}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500">
            With your NexRing smart ring connected, we can show sleep
            efficiency, latency, and a nightly sleep score here.
          </p>
        </div>
      </Section>

      {/* ...rest of the file unchanged (form + list) */}
      {/* ... */}
    </section>
  );
}
