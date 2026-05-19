// components/reminders/PillsTab.tsx
import React from 'react';
import Link from 'next/link';
import Section from '@/components/Section';
import PillReminderCard from '@/components/PillReminderCard';
import ReminderList, { type ReminderShape } from '@/components/ReminderList';
import MeterDonut from '@/components/charts/AnimatedMeterDonut';
import type { ApiReminder, Stats } from './shared';


function AdherenceTrendBars({ values }: { values: number[] }) {
  const clean = values
    .filter((value) => Number.isFinite(value))
    .slice(-7);

  if (!clean.length) {
    return (
      <div className="flex h-16 items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400">
        No adherence trend available yet.
      </div>
    );
  }

  return (
    <div className="flex h-16 items-end gap-1 rounded-lg bg-slate-50 px-2 py-2" aria-label="Adherence trend">
      {clean.map((value, index) => {
        const height = Math.max(6, Math.min(100, Math.round(value)));

        return (
          <div
            key={`${index}-${value}`}
            className="flex flex-1 flex-col items-center justify-end gap-1"
            title={`${height}%`}
          >
            <div
              className="w-full rounded-t bg-emerald-500"
              style={{ height: `${height}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

type PillsTabProps = {
  todaysPills: ApiReminder[];
  pillShapes: ReminderShape[];
  pillStats: Stats;
  adherenceTrend: number[];
  onOpenConfirm: (rem: ApiReminder) => void;          // primary action (verification-aware)
  onTakenEarlier: (rem: ApiReminder) => void;         // dedicated CTA
  onSnoozeReminder: (id: string, minutes?: number) => void;
  onListConfirm: (r: ReminderShape) => void;
  onListTakenEarlier: (r: ReminderShape) => void;
  onListSnooze: (r: ReminderShape, mins?: number) => void;
};

export default function PillsTab({
  todaysPills,
  pillShapes,
  pillStats,
  adherenceTrend,
  onOpenConfirm,
  onTakenEarlier,
  onSnoozeReminder,
  onListConfirm,
  onListTakenEarlier,
  onListSnooze,
}: PillsTabProps) {
  const pillTrendAverage =
    adherenceTrend.length === 0
      ? 0
      : Math.round(adherenceTrend.reduce((acc, v) => acc + v, 0) / adherenceTrend.length);

  return (
    <section
      id="reminders-panel-pills"
      role="tabpanel"
      aria-labelledby="reminders-tab-pills"
      className="mt-2 space-y-4"
    >
      {/* Adherence Summary */}
      <Section
        title="⚕️ Pill adherence"
        subtitle="Your medication routine today."
        defaultOpen
      >
        <div className="grid items-center gap-4 md:grid-cols-3">
          <div className="flex flex-col items-center">
            <MeterDonut value={pillStats.pct} max={100} label="Pills" unit="%" color="#10B981" />
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
            <AdherenceTrendBars values={adherenceTrend} />
          </div>
        </div>
      </Section>

      {/* Today's Pills */}
      <Section
        title="⚕️ Today&apos;s pills"
        subtitle="Medication reminders only."
        defaultOpen
      >
        {todaysPills.length === 0 ? (
          <div className="text-sm text-gray-500">
            No pill reminders scheduled for today. You can create medication reminders from the{' '}
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
                  verificationRequired: Boolean(
                    r.verificationRequired ?? r.meta?.verificationRequired
                  ),
                  verificationStatus:
                    r.verificationStatus ?? r.meta?.verificationStatus ?? null,
                  takenSource:
                    r.takenSource ?? r.meta?.takenSource ?? null,
                }}
                onConfirm={() => onOpenConfirm(r)}
                onTakenEarlier={() => onTakenEarlier(r)}
                onSnooze={() => onSnoozeReminder(r.id, 15)}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Full Medication List */}
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

            // ✅ list actions now aligned with page.tsx
            onConfirm={onListConfirm}
            onTakenEarlier={onListTakenEarlier}
            onSnooze={onListSnooze}
          />
        )}
      </Section>
    </section>
  );
}