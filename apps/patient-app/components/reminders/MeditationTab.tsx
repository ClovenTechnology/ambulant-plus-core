// components/reminders/MeditationTab.tsx
import React, { useRef, useState } from 'react';
import Section from '@/components/Section';
import ReminderList, { type ReminderShape } from '@/components/ReminderList';
import MeterDonut from '@/components/charts/AnimatedMeterDonut';
import Sparkline from '@/components/charts/Sparkline';
import { toast } from '../toast';
import {
  MOCK_ADHERENCE_TREND,
  type Stats,
} from './shared';

type MeditationTabProps = {
  stats: Stats;
  reminders: ReminderShape[];
  onListConfirm: (r: ReminderShape) => void;
  onListSnooze: (r: ReminderShape, mins?: number) => void;
  onRemindersCreated: () => Promise<void> | void;
  formRef?: React.RefObject<HTMLFormElement>;
};

type MeditationSchedule = 'today' | 'thisWeek' | 'everyday';

export default function MeditationTab({
  stats,
  reminders,
  onListConfirm,
  onListSnooze,
  onRemindersCreated,
  formRef,
}: MeditationTabProps) {
  const internalFormRef = useRef<HTMLFormElement | null>(null);
  const resolvedFormRef = formRef ?? internalFormRef;

  const [meditationType, setMeditationType] = useState('Mindfulness');
  const [meditationDuration, setMeditationDuration] = useState('10');
  const [meditationTime, setMeditationTime] = useState('08:00');
  const [meditationSchedule, setMeditationSchedule] =
    useState<MeditationSchedule>('everyday');
  const [meditationBusy, setMeditationBusy] = useState(false);
  const [meditationError, setMeditationError] = useState<string | null>(null);

  async function handleCreateMeditation(e: React.FormEvent) {
    e.preventDefault();
    const durationVal = meditationDuration.trim();

    if (!durationVal) {
      const msg = 'Enter a target duration for meditation.';
      setMeditationError(msg);
      toast(msg, { type: 'error' });
      return;
    }
    if (!meditationTime) {
      const msg = 'Choose a reminder time.';
      setMeditationError(msg);
      toast(msg, { type: 'error' });
      return;
    }
    setMeditationError(null);
    setMeditationBusy(true);
    try {
      const item = {
        name: meditationType,
        dose: `${durationVal} min`,
        time: meditationTime,
        status: 'Pending' as const,
        source: 'meditation' as const,
        meta: {
          type: 'meditation',
          durationMinutes: parseInt(durationVal, 10) || durationVal,
          schedule: meditationSchedule,
        },
      };

      const res = await fetch('/api/reminders', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify([item]),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || (data && data.ok === false)) {
        toast(data?.error || 'Could not create meditation reminder.', {
          type: 'error',
        });
      } else {
        toast('Meditation reminder created.', { type: 'success' });
        await onRemindersCreated();
      }
    } catch (err) {
      console.error('Create meditation reminder', err);
      toast('Network error creating meditation reminder.', { type: 'error' });
    } finally {
      setMeditationBusy(false);
    }
  }

  return (
    <section
      id="reminders-panel-meditation"
      role="tabpanel"
      aria-labelledby="reminders-tab-meditation"
      className="mt-2 grid gap-4 md:grid-cols-2"
    >
      <Section
        title="🧘 Mind & meditation"
        subtitle="Short pauses to reset, breathe, and unwind."
        defaultOpen
      >
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-4">
            <MeterDonut
              value={stats.pct}
              max={100}
              label="Meditation"
              unit="%"
              color="#8B5CF6"
            />
            <div className="space-y-1 text-xs text-gray-600">
              <div>
                <span className="font-medium">{stats.pending}</span> upcoming
                session(s)
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
              Mindfulness trend (placeholder)
            </div>
            <Sparkline data={MOCK_ADHERENCE_TREND} height={64} />
          </div>
          <p className="text-xs text-gray-500">
            You can use meditation reminders for breathing exercises,
            mindfulness, gratitude, or short yoga stretches.
          </p>
        </div>
      </Section>

      <Section
        title="🧘 Create meditation reminder"
        subtitle="Choose practice, duration, and schedule."
        defaultOpen
      >
        <form
          ref={resolvedFormRef}
          onSubmit={handleCreateMeditation}
          className="space-y-4 text-sm"
        >
          {/* Practice */}
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Practice
            </p>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Meditation type
            </label>
            <select
              value={meditationType}
              onChange={(e) => setMeditationType(e.target.value)}
              className="w-full rounded-md border px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
            >
              <option>Mindfulness</option>
              <option>Breathing exercise</option>
              <option>Body scan</option>
              <option>Gratitude reflection</option>
              <option>Calm music break</option>
            </select>
            <p className="mt-1 text-[11px] text-gray-500">
              Keep it simple (&quot;Breathing exercise&quot;) or describe a
              specific routine.
            </p>
          </div>

          {/* Duration & time */}
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Duration & timing
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Duration (minutes)
                </label>
                <input
                  value={meditationDuration}
                  onChange={(e) => setMeditationDuration(e.target.value)}
                  type="number"
                  min={3}
                  className={[
                    'w-full rounded-md border px-2 py-1 text-sm shadow-sm',
                    meditationError?.includes('duration')
                      ? 'border-rose-400 focus-visible:ring-rose-400'
                      : 'focus-visible:ring-emerald-500 focus-visible:border-emerald-500',
                  ].join(' ')}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Time
                </label>
                <input
                  type="time"
                  value={meditationTime}
                  onChange={(e) => setMeditationTime(e.target.value)}
                  className={[
                    'w-full rounded-md border px-2 py-1 text-xs shadow-sm',
                    meditationError?.includes('time')
                      ? 'border-rose-400 focus-visible:ring-rose-400'
                      : 'focus-visible:ring-emerald-500 focus-visible:border-emerald-500',
                  ].join(' ')}
                />
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Schedule
            </p>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              How often?
            </label>
            <select
              value={meditationSchedule}
              onChange={(e) =>
                setMeditationSchedule(e.target.value as any)
              }
              className="w-full rounded-md border px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
            >
              <option value="today">Today only</option>
              <option value="thisWeek">This week</option>
              <option value="everyday">All days</option>
            </select>
          </div>

          {meditationError && (
            <p className="text-[11px] text-rose-600">{meditationError}</p>
          )}

          <button
            type="submit"
            disabled={meditationBusy}
            className="w-full rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            {meditationBusy
              ? 'Creating meditation reminder…'
              : 'Save meditation reminder'}
          </button>
        </form>
      </Section>

      <Section
        title="🧘 Meditation reminders"
        subtitle="Mindfulness / breathing / yoga reminders only."
        defaultOpen
      >
        {reminders.length === 0 ? (
          <div className="text-sm text-gray-500">
            No meditation reminders yet.
          </div>
        ) : (
          <ReminderList
            reminders={reminders}
            onConfirm={onListConfirm}
            onSnooze={onListSnooze}
          />
        )}
      </Section>
    </section>
  );
}
