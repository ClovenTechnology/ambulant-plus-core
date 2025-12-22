// components/reminders/PillsTab.tsx
import React from 'react';
import Link from 'next/link';
import Section from '@/components/Section';
import PillReminderCard from '@/components/PillReminderCard';
import ReminderList, { type ReminderShape } from '@/components/ReminderList';
import MeterDonut from '@/components/charts/AnimatedMeterDonut';
import Sparkline from '@/components/charts/Sparkline';
import type { ApiReminder, Stats } from './shared';

type PillsTabProps = {
  todaysPills: ApiReminder[];
  pillShapes: ReminderShape[];
  pillStats: Stats;
  adherenceTrend: number[];
  onOpenConfirm: (rem: ApiReminder) => void;
  onSnoozeReminder: (id: string, minutes?: number) => void;
  onListConfirm: (r: ReminderShape) => void;
  onListSnooze: (r: ReminderShape, mins?: number) => void;
};

export default function PillsTab({
  todaysPills,
  pillShapes,
  pillStats,
  adherenceTrend,
  onOpenConfirm,
  onSnoozeReminder,
  onListConfirm,
  onListSnooze,
}: PillsTabProps) {
  const pillTrendAverage =
    adherenceTrend.length === 0
      ? 0
      : Math.round(
          adherenceTrend.reduce((acc, v) => acc + v, 0) / adherenceTrend.length
        );

  return (
    <section
      id="reminders-panel-pills"
      role="tabpanel"
      aria-labelledby="reminders-tab-pills"
      className="mt-2 space-y-4"
    >
      <Section
        title="⚕️ Pill adherence"
        subtitle="Your medication routine today."
        defaultOpen
      >
        <div className="grid items-center gap-4 md:grid-cols-3">
          <div className="flex flex-col items-center">
            <MeterDonut
              value={pillStats.pct}
              max={100}
              label="Pills"
              unit="%"
              color="#10B981"
            />
            <div className="mt-2 text-center text-xs text-gray-500">
              {pillStats.taken} completed · {pillStats.missed} missed
            </div>
            <div className="mt-1 text-[11px] text-gray-500">
              7-day average: {pillTrendAverage}%
            </div>
          </div>
          <div className="md:col-span-2 rounded-xl border bg-white p-2">
            <div className="mb-1 text-xs text-slate-500">
              Adherence trend (last 7 days)
            </div>
            <Sparkline data={adherenceTrend} height={64} />
          </div>
        </div>
      </Section>

      <Section
        title="⚕️ Today&apos;s pills"
        subtitle="Medication reminders only."
        defaultOpen
      >
        {todaysPills.length === 0 ? (
          <div className="text-sm text-gray-500">
            No pill reminders scheduled for today. You can create medication
            reminders from the{' '}
            <Link
              href="/medications"
              className="text-emerald-700 underline underline-offset-2"
            >
              Medications
            </Link>{' '}
            page.
          </div>
        ) : (
          <div className="space-y-2">
            {todaysPills.map((r) => (
              <PillReminderCard
                key={r.id}
                med={{
                  name: r.name,
                  dose: r.dose ?? '',
                  time: r.time ?? '',
                  status: r.status,
                }}
                onConfirm={() => onOpenConfirm(r)}
                onSnooze={() => onSnoozeReminder(r.id, 15)}
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="⚕️ Pill reminder list"
        subtitle="All medication-type reminders."
        defaultOpen
      >
        {pillShapes.length === 0 ? (
          <div className="text-sm text-gray-500">
            No pill reminders. Create them from the Medications page.
          </div>
        ) : (
          <ReminderList
            reminders={pillShapes}
            onConfirm={onListConfirm}
            onSnooze={onListSnooze}
          />
        )}
      </Section>
    </section>
  );
}
