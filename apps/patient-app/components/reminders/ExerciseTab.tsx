// components/reminders/ExerciseTab.tsx
import React, { useRef, useState, useMemo } from 'react';
import Section from '@/components/Section';
import ReminderList, { type ReminderShape } from '@/components/ReminderList';
import MeterDonut from '@/components/charts/AnimatedMeterDonut';
import Sparkline from '@/components/charts/Sparkline';
import { toast } from '../toast';
import {
  MOCK_ADHERENCE_TREND,
  type Stats,
  type NexRingExerciseMetrics,
} from './shared';

type ExerciseTabProps = {
  stats: Stats;
  reminders: ReminderShape[];
  onListConfirm: (r: ReminderShape) => void;
  onListSnooze: (r: ReminderShape, mins?: number) => void;
  onRemindersCreated: () => Promise<void> | void;
  formRef?: React.RefObject<HTMLFormElement>;
};

type ExerciseSchedule = 'today' | 'thisWeek' | 'everyday';

export default function ExerciseTab({
  stats,
  reminders,
  onListConfirm,
  onListSnooze,
  onRemindersCreated,
  formRef,
}: ExerciseTabProps) {
  const internalFormRef = useRef<HTMLFormElement | null>(null);
  const resolvedFormRef = formRef ?? internalFormRef;

  const [exerciseType, setExerciseType] = useState('Walking');
  const [exerciseIntensity, setExerciseIntensity] = useState<
    'Easy' | 'Moderate' | 'Hard'
  >('Moderate');
  const [exerciseDuration, setExerciseDuration] = useState('30');
  const [exerciseTime, setExerciseTime] = useState('07:00');
  const [exerciseSchedule, setExerciseSchedule] =
    useState<ExerciseSchedule>('thisWeek');
  const [exerciseBusy, setExerciseBusy] = useState(false);
  const [exerciseError, setExerciseError] = useState<string | null>(null);

  // Pull the most recent reminder with NexRing exercise data
  const latestNexRingExercise = useMemo(() => {
    const withMetrics = reminders
      .map((r) => {
        const metrics = r.meta?.nexRing?.exercise as
          | NexRingExerciseMetrics
          | undefined;
        if (!metrics) return null;
        return { reminder: r, metrics };
      })
      .filter(Boolean) as { reminder: ReminderShape; metrics: NexRingExerciseMetrics }[];

    if (!withMetrics.length) return null;

    // If you later add timestamps, you can sort by startTimeIso/endTimeIso here.
    return withMetrics[0].metrics;
  }, [reminders]);

  async function handleCreateExercise(e: React.FormEvent) {
    e.preventDefault();
    const durationVal = exerciseDuration.trim();

    if (!durationVal) {
      const msg = 'Enter a target duration for exercise.';
      setExerciseError(msg);
      toast(msg, { type: 'error' });
      return;
    }
    if (!exerciseTime) {
      const msg = 'Choose a reminder time.';
      setExerciseError(msg);
      toast(msg, { type: 'error' });
      return;
    }
    setExerciseError(null);
    setExerciseBusy(true);
    try {
      const item = {
        name: exerciseType,
        dose: `${durationVal} min · ${exerciseIntensity}`,
        time: exerciseTime,
        status: 'Pending' as const,
        source: 'exercise' as const,
        meta: {
          type: 'exercise',
          intensity: exerciseIntensity,
          durationMinutes: parseInt(durationVal, 10) || durationVal,
          schedule: exerciseSchedule,
        },
      };

      const res = await fetch('/api/reminders', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify([item]),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || (data && data.ok === false)) {
        toast(data?.error || 'Could not create exercise reminder.', {
          type: 'error',
        });
      } else {
        toast('Exercise reminder created.', { type: 'success' });
        await onRemindersCreated();
      }
    } catch (err) {
      console.error('Create exercise reminder', err);
      toast('Network error creating exercise reminder.', { type: 'error' });
    } finally {
      setExerciseBusy(false);
    }
  }

  return (
    <section
      id="reminders-panel-exercise"
      role="tabpanel"
      aria-labelledby="reminders-tab-exercise"
      className="mt-2 grid gap-4 md:grid-cols-2"
    >
      <Section
        title="🏋️ Exercise adherence"
        subtitle="Sticking to your movement plan."
        defaultOpen
      >
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-4">
            <MeterDonut
              value={stats.pct}
              max={100}
              label="Exercise"
              unit="%"
              color="#F97316"
            />
            <div className="space-y-1 text-xs text-gray-600">
              <div>
                <span className="font-medium">{stats.pending}</span> upcoming
                sessions
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
              Movement trend (placeholder)
            </div>
            <Sparkline data={MOCK_ADHERENCE_TREND} height={64} />
          </div>

          {latestNexRingExercise && (
            <div className="rounded-xl border bg-slate-50 px-3 py-2 text-xs text-gray-700">
              <div className="flex items-center justify-between">
                <span className="font-medium">Latest NexRing session</span>
                <span className="text-[11px] text-gray-500">
                  {latestNexRingExercise.steps.toLocaleString()} steps
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-600">
                <span>Avg HR {latestNexRingExercise.avgHeartRate} bpm</span>
                {latestNexRingExercise.distanceKm != null && (
                  <span>
                    {latestNexRingExercise.distanceKm.toFixed(1)} km
                  </span>
                )}
                {latestNexRingExercise.calories != null && (
                  <span>
                    {Math.round(latestNexRingExercise.calories)} kcal
                  </span>
                )}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500">
            When your NexRing smart ring is connected, we can also show heart
            rate, steps, distance, and calories for each session.
          </p>
        </div>
      </Section>

      {/* ...rest of the file unchanged (form + list) */}
      {/* ... */}
    </section>
  );
}
