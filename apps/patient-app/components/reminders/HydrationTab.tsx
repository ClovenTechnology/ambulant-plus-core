// components/reminders/HydrationTab.tsx
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

type HydrationTabProps = {
  stats: Stats;
  reminders: ReminderShape[];
  onListConfirm: (r: ReminderShape) => void;
  onListSnooze: (r: ReminderShape, mins?: number) => void;
  onRemindersCreated: () => Promise<void> | void;
  formRef?: React.RefObject<HTMLFormElement>;
};

type Schedule =
  | 'today'
  | 'dateRange'
  | 'thisWeek'
  | 'everyday';

export default function HydrationTab({
  stats,
  reminders,
  onListConfirm,
  onListSnooze,
  onRemindersCreated,
  formRef,
}: HydrationTabProps) {
  const internalFormRef = useRef<HTMLFormElement | null>(null);
  const resolvedFormRef = formRef ?? internalFormRef;

  const [hydrationAmount, setHydrationAmount] = useState('');
  const [hydrationUnit, setHydrationUnit] = useState<'ml' | 'L' | 'oz' | 'cups'>(
    'ml'
  );
  const [hydrationTimes, setHydrationTimes] = useState<string[]>([
    '09:00',
    '12:00',
    '15:00',
    '18:00',
  ]);
  const [hydrationSchedule, setHydrationSchedule] =
    useState<Schedule>('everyday');
  const [hydrationStartDate, setHydrationStartDate] = useState('');
  const [hydrationEndDate, setHydrationEndDate] = useState('');
  const [hydrationBusy, setHydrationBusy] = useState(false);
  const [hydrationError, setHydrationError] = useState<string | null>(null);

  function updateHydrationTime(idx: number, val: string) {
    setHydrationTimes((prev) => prev.map((t, i) => (i === idx ? val : t)));
  }
  function addHydrationTime() {
    setHydrationTimes((prev) => [...prev, '']);
  }
  function removeHydrationTime(idx: number) {
    setHydrationTimes((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleCreateHydration(e: React.FormEvent) {
    e.preventDefault();
    const amountVal = hydrationAmount.trim();
    const activeTimes = hydrationTimes.filter(Boolean);

    if (!amountVal) {
      const msg = 'Enter a target amount for hydration.';
      setHydrationError(msg);
      toast(msg, { type: 'error' });
      return;
    }
    if (!activeTimes.length) {
      const msg = 'Add at least one reminder time for hydration.';
      setHydrationError(msg);
      toast(msg, { type: 'error' });
      return;
    }
    setHydrationError(null);
    setHydrationBusy(true);
    try {
      const items = activeTimes.map((time) => ({
        name: 'Hydration',
        dose: `${amountVal} ${hydrationUnit}`,
        time,
        status: 'Pending' as const,
        source: 'hydration' as const,
        meta: {
          type: 'hydration',
          unit: hydrationUnit,
          amount: parseFloat(amountVal) || amountVal,
          schedule: hydrationSchedule,
          startDate: hydrationStartDate || null,
          endDate: hydrationEndDate || null,
        },
      }));

      const res = await fetch('/api/reminders', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(items),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || (data && data.ok === false)) {
        toast(data?.error || 'Could not create hydration reminders.', {
          type: 'error',
        });
      } else {
        toast('Hydration reminders created.', { type: 'success' });
        await onRemindersCreated();
      }
    } catch (err) {
      console.error('Create hydration reminders', err);
      toast('Network error creating hydration reminders.', { type: 'error' });
    } finally {
      setHydrationBusy(false);
    }
  }

  return (
    <section
      id="reminders-panel-hydration"
      role="tabpanel"
      aria-labelledby="reminders-tab-hydration"
      className="mt-2 grid gap-4 md:grid-cols-2"
    >
      <Section
        title="💧 Hydration adherence"
        subtitle="How often you’re meeting your water goals."
        defaultOpen
      >
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-4">
            <MeterDonut
              value={stats.pct}
              max={100}
              label="Hydration"
              unit="%"
              color="#0EA5E9"
            />
            <div className="space-y-1 text-xs text-gray-600">
              <div>
                <span className="font-medium">{stats.pending}</span> active
                reminders
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
              Hydration trend (placeholder)
            </div>
            <Sparkline data={MOCK_ADHERENCE_TREND} height={64} />
          </div>
        </div>
      </Section>

      <Section
        title="💧 Create hydration reminders"
        subtitle="Set a goal, choose times, and schedule."
        defaultOpen
      >
        <form
          ref={resolvedFormRef}
          onSubmit={handleCreateHydration}
          className="space-y-4 text-sm"
        >
          {/* Goal */}
          <div>
            <p className="mb-1 text[11px] font-semibold uppercase tracking-wide text-gray-400">
              Goal
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Target amount
                </label>
                <input
                  value={hydrationAmount}
                  onChange={(e) => setHydrationAmount(e.target.value)}
                  placeholder="e.g. 250"
                  className={[
                    'w-full rounded-md border px-2 py-1 text-sm shadow-sm',
                    hydrationError?.includes('amount')
                      ? 'border-rose-400 focus-visible:ring-rose-400'
                      : 'focus-visible:ring-emerald-500 focus-visible:border-emerald-500',
                  ].join(' ')}
                />
                <p className="mt-1 text-[11px] text-gray-500">
                  This is the amount for each reminder, not for the entire day.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Unit
                </label>
                <select
                  value={hydrationUnit}
                  onChange={(e) =>
                    setHydrationUnit(e.target.value as any)
                  }
                  className="w-full rounded-md border px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
                >
                  <option value="ml">ml</option>
                  <option value="L">L</option>
                  <option value="oz">oz</option>
                  <option value="cups">cups</option>
                </select>
              </div>
            </div>
          </div>

          {/* Times */}
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Times
            </p>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Reminder times
            </label>
            <div className="space-y-1">
              {hydrationTimes.map((t, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <input
                    type="time"
                    value={t}
                    onChange={(e) =>
                      updateHydrationTime(idx, e.target.value)
                    }
                    className="rounded-md border px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
                  />
                  {hydrationTimes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeHydrationTime(idx)}
                      className="text-xs text-gray-400 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addHydrationTime}
              className="mt-1 text-xs font-medium text-emerald-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
            >
              + Add another time
            </button>
          </div>

          {/* Schedule */}
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Schedule
            </p>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              When should we repeat these reminders?
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  className="h-3 w-3"
                  checked={hydrationSchedule === 'today'}
                  onChange={() => setHydrationSchedule('today')}
                />
                Today only
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  className="h-3 w-3"
                  checked={hydrationSchedule === 'everyday'}
                  onChange={() => setHydrationSchedule('everyday')}
                />
                All days
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  className="h-3 w-3"
                  checked={hydrationSchedule === 'thisWeek'}
                  onChange={() => setHydrationSchedule('thisWeek')}
                />
                This week
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  className="h-3 w-3"
                  checked={hydrationSchedule === 'dateRange'}
                  onChange={() => setHydrationSchedule('dateRange')}
                />
                Date range
              </label>
            </div>

            {hydrationSchedule === 'dateRange' && (
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="mb-1 block text-xs font-medium">
                    Start
                  </label>
                  <input
                    type="date"
                    value={hydrationStartDate}
                    onChange={(e) =>
                      setHydrationStartDate(e.target.value)
                    }
                    className="w-full rounded-md border px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">
                    End
                  </label>
                  <input
                    type="date"
                    value={hydrationEndDate}
                    onChange={(e) =>
                      setHydrationEndDate(e.target.value)
                    }
                    className="w-full rounded-md border px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>

          {hydrationError && (
            <p className="text-[11px] text-rose-600">{hydrationError}</p>
          )}

          <button
            type="submit"
            disabled={hydrationBusy}
            className="w-full rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            {hydrationBusy
              ? 'Creating hydration reminders…'
              : 'Save hydration reminders'}
          </button>
        </form>
      </Section>

      <Section
        title="💧 Hydration reminders"
        subtitle="Water-intake reminders only."
        defaultOpen
      >
        {reminders.length === 0 ? (
          <div className="text-sm text-gray-500">
            No hydration reminders yet.
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
