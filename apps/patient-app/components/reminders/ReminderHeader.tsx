// components/reminders/ReminderHeader.tsx
import React from 'react';
import MeterDonut from '@/components/charts/AnimatedMeterDonut';
import { hasNotificationSupport } from './shared';

type ReminderHeaderProps = {
  todayLabel: string;
  totalReminders: number;
  totalPending: number;
  totalCompleted: number;
  usedMock: boolean;
  showAlertsInfo: boolean;
  onToggleAlertsInfo: () => void;
  pillStatsPct: number;
  pillTrendAverage: number;
  overallCompletionPct: number;
  loading: boolean;
  notificationsEnabled: boolean;
  onRefresh: () => void;
  onToggleAlerts: () => void;
};

export default function ReminderHeader({
  todayLabel,
  totalReminders,
  totalPending,
  totalCompleted,
  usedMock,
  showAlertsInfo,
  onToggleAlertsInfo,
  pillStatsPct,
  pillTrendAverage,
  overallCompletionPct,
  loading,
  notificationsEnabled,
  onRefresh,
  onToggleAlerts,
}: ReminderHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
            Today · {todayLabel}
          </span>
          {totalReminders > 0 && (
            <span>
              {totalReminders} reminders · {totalPending} active ·{' '}
              {totalCompleted} completed
            </span>
          )}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Reminders</h1>
        <p className="text-sm text-gray-600">
          See today’s medication, hydration, movement, sleep and meditation
          reminders — and keep an easy, accurate record of how you&apos;re
          following your plan.
        </p>
        {usedMock && (
          <p className="text-xs text-amber-600">
            Showing sample data while we reconnect to the server.
          </p>
        )}
        <div className="mt-1 space-y-1">
          <div className="inline-flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
            <span>Alerts work best while this tab is open.</span>
            <button
              type="button"
              onClick={onToggleAlertsInfo}
              className="inline-flex items-center rounded-full border border-transparent bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              How alerts work
            </button>
          </div>
          {showAlertsInfo && (
            <p className="max-w-md text-[11px] text-gray-500">
              Background notifications will use your browser and your NexRing
              smart ring. We&apos;ll guide you through setup so reminders can
              reach you even when this page is closed.
            </p>
          )}
        </div>
      </div>

      <aside className="w-full max-w-xs rounded-xl border bg-white/80 p-3 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-700">
              ⚕️ Medication adherence
            </p>
            <p className="text-[11px] text-gray-500">
              Today: <span className="font-semibold">{pillStatsPct}%</span> ·
              Last 7 days avg:{' '}
              <span className="font-semibold">{pillTrendAverage}%</span>
            </p>
          </div>
          <MeterDonut
            value={pillStatsPct}
            max={100}
            label="Pills"
            unit="%"
            color="#10B981"
          />
        </div>

        {/* Daily completion bar */}
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-gray-500">
            <span>Today&apos;s completion</span>
            <span className="font-medium text-gray-700">
              {overallCompletionPct}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${overallCompletionPct}%` }}
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60"
            disabled={loading}
          >
            <span
              className={loading ? 'animate-spin text-xs' : 'text-xs'}
              aria-hidden="true"
            >
              ⟳
            </span>
            <span>{loading ? 'Refreshing…' : 'Refresh'}</span>
          </button>

          {typeof window !== 'undefined' && hasNotificationSupport() && (
            <button
              type="button"
              onClick={onToggleAlerts}
              className={[
                'inline-flex flex-1 items-center justify-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                notificationsEnabled
                  ? 'border border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
              ].join(' ')}
            >
              <span aria-hidden="true">🔔</span>
              <span>
                {notificationsEnabled ? 'Turn alerts off' : 'Enable alerts'}
              </span>
            </button>
          )}
        </div>
      </aside>
    </header>
  );
}
