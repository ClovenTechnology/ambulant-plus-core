//apps/patient-app/components/nexring/NexRingHero.tsx
'use client';

import React, { useState } from 'react';
import type { RingCommandResult } from '@/src/devices/nexring/nexring-types';
import {
  type HrPoint,
  type Metrics,
  num,
  rangeMin,
  rangeMax,
  inferHeroModeLabel,
  readinessNarrative,
  sleepNarrative,
  sleepTotalFromStages,
  relativeTime,
  formatClock,
  capitalize,
  preferredRecoveryHr,
  preferredSleepRespiratoryRate,
  preferredNightSpo2,
} from '@/src/devices/nexring/nexring-view-model';
import {
  StatusPill,
  MetricHint,
  MiniStatGrid,
  SleepBar,
  InfoChip,
  LineHealthChart,
} from './NexRingPrimitives';

export function NexRingHero({
  title,
  phase,
  lastCmd,
  metrics,
  hrHistory,
  historyCount,
  lastSeenTs,
  mtu,
  patientBound,
  sleepCount,
  compact = false,
}: {
  title: string;
  phase?: string;
  lastCmd?: RingCommandResult | null;
  metrics: Metrics;
  hrHistory: HrPoint[];
  historyCount: number;
  lastSeenTs?: number | null;
  mtu?: number | null;
  patientBound: boolean;
  sleepCount?: number;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_26%),linear-gradient(135deg,_#020617_0%,_#0f172a_52%,_#111827_100%)] text-white shadow-sm">
        <div className="grid gap-4 p-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-300/80">
                  Smart Ring
                </div>
                <h2 className="mt-1 text-2xl font-semibold">{title}</h2>
                <p className="mt-1 text-sm text-slate-300">
                  Compact wearable stream and recovery summary for quick switching.
                </p>
              </div>

              <StatusPill
                label={
                  phase === 'ready' || phase === 'connected'
                    ? 'Connected'
                    : capitalize(phase)
                }
                tone={
                  phase === 'ready' || phase === 'connected'
                    ? 'good'
                    : phase === 'error'
                      ? 'bad'
                      : 'muted'
                }
              />
            </div>

            <CompactHeartRateHero
              currentHr={metrics.hr}
              points={hrHistory}
              modeLabel={inferHeroModeLabel(phase, lastCmd)}
            />

            <MiniStatGrid
              stats={[
                { label: 'Readiness', value: num(metrics.readiness), unit: '/100' },
                { label: 'Battery', value: num(metrics.batteryPct), unit: '%' },
                { label: 'Resting HR', value: num(preferredRecoveryHr(metrics)), unit: 'bpm' },
                { label: 'Last seen', value: relativeTime(lastSeenTs), unit: '' },
              ]}
            />
          </div>

          <CompactSleepHero
            score={metrics.sleepScore}
            stages={metrics.sleepStages}
            metrics={metrics}
            historyCount={historyCount}
            lastSeenTs={lastSeenTs}
            mtu={mtu}
            patientBound={patientBound}
            sleepCount={sleepCount}
            readiness={metrics.readiness}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_26%),linear-gradient(135deg,_#020617_0%,_#0f172a_52%,_#111827_100%)] text-white">
      <div className="grid gap-4 p-5 xl:grid-cols-[1.45fr_0.55fr]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.26em] text-cyan-300/80">
                Smart Ring
              </div>
              <h2 className="mt-1 text-3xl font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-slate-300">
                Live wearable stream, sleep recovery, daytime stress, readiness and
                historical sync.
              </p>
            </div>

            <StatusPill
              label={
                phase === 'ready' || phase === 'connected'
                  ? 'Connected'
                  : capitalize(phase)
              }
              tone={
                phase === 'ready' || phase === 'connected'
                  ? 'good'
                  : phase === 'error'
                    ? 'bad'
                    : 'muted'
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <HeartRateHero
              currentHr={metrics.hr}
              points={hrHistory}
              modeLabel={inferHeroModeLabel(phase, lastCmd)}
            />

            <div className="grid gap-3">
              <ReadinessGauge value={metrics.readiness} />
              <MiniStatGrid
                stats={[
                  { label: 'Sleep avg HR', value: num(metrics.sleepAvgHr), unit: 'bpm' },
                  { label: 'Battery', value: num(metrics.batteryPct), unit: '%' },
                  { label: 'Resting HR', value: num(preferredRecoveryHr(metrics)), unit: 'bpm' },
                  { label: 'Last seen', value: relativeTime(lastSeenTs), unit: '' },
                ]}
              />
            </div>
          </div>
        </div>

        <SleepHero
          score={metrics.sleepScore}
          stages={metrics.sleepStages}
          metrics={metrics}
          historyCount={historyCount}
          lastSeenTs={lastSeenTs}
          mtu={mtu}
          patientBound={patientBound}
          sleepCount={sleepCount}
        />
      </div>
    </section>
  );
}

function CompactHeartRateHero({
  currentHr,
  points,
  modeLabel,
}: {
  currentHr?: number;
  points: HrPoint[];
  modeLabel: string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const activePoint = hoverIndex != null ? points[hoverIndex] ?? null : null;
  const displayValue = activePoint?.value ?? currentHr;

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/80">
            Heart rate
          </div>
          <div className="mt-2 flex items-end gap-2">
            <div className="text-4xl font-semibold leading-none">{num(displayValue)}</div>
            <div className="pb-1 text-sm text-slate-300">bpm</div>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {activePoint
              ? `${formatClock(activePoint.ts)} • ${activePoint.mode || 'sample'}`
              : modeLabel}
          </div>
        </div>

        <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
          {points.length > 0 ? 'Trend visible' : 'Awaiting samples'}
        </div>
      </div>

      <div className="mt-4">
        <LineHealthChart
          points={points}
          valueSuffix=" bpm"
          lineClassName="stroke-emerald-300"
          glowClassName="stroke-emerald-400/20"
          fillId="hr-fill-compact"
          hoverIndex={hoverIndex}
          onHoverIndexChange={setHoverIndex}
          minY={40}
          maxY={160}
          gradientFrom="rgba(16,185,129,0.22)"
          gradientTo="rgba(16,185,129,0.02)"
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-400">
        <MetricHint label="Visible min" value={rangeMin(points)} />
        <MetricHint label="Visible max" value={rangeMax(points)} />
        <MetricHint label="Samples" value={String(points.length)} />
      </div>
    </div>
  );
}

function CompactSleepHero({
  score,
  stages,
  metrics,
  historyCount,
  lastSeenTs,
  mtu,
  patientBound,
  sleepCount,
  readiness,
}: {
  score?: number;
  stages?: Metrics['sleepStages'];
  metrics: Metrics;
  historyCount: number;
  lastSeenTs?: number | null;
  mtu?: number | null;
  patientBound: boolean;
  sleepCount?: number;
  readiness?: number;
}) {
  const totalSleep = sleepTotalFromStages(stages);

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">
            Sleep
          </div>
          <div className="mt-2 flex items-end gap-1">
            <div className="text-3xl font-semibold">{num(score)}</div>
            <div className="pb-1 text-sm text-slate-300">/100</div>
          </div>
          <div className="mt-1 text-sm text-slate-300">
            {sleepNarrative(score, readiness)}
          </div>
        </div>

        <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
          {totalSleep ? `${totalSleep} min` : 'No sleep data'}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <SleepBar
          label="Light"
          value={stages?.light}
          total={sleepTotalFromStages(stages)}
          color="bg-sky-400"
        />
        <SleepBar
          label="Deep"
          value={stages?.deep}
          total={sleepTotalFromStages(stages)}
          color="bg-indigo-500"
        />
        <SleepBar
          label="REM"
          value={stages?.rem}
          total={sleepTotalFromStages(stages)}
          color="bg-cyan-300"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-300">
        <InfoChip label="History" value={String(historyCount)} />
        <InfoChip label="Last seen" value={relativeTime(lastSeenTs)} />
        <InfoChip label="MTU" value={mtu ? String(mtu) : '—'} />
        <InfoChip label="Bound" value={patientBound ? 'Yes' : 'No'} />
        <InfoChip label="Sessions" value={sleepCount ? String(sleepCount) : '—'} />
        <InfoChip label="Total sleep" value={totalSleep ? `${totalSleep} min` : '—'} />
        <InfoChip
          label="Night SpO₂"
          value={
            typeof preferredNightSpo2(metrics) === 'number'
              ? `${num(preferredNightSpo2(metrics))}%`
              : '—'
          }
        />
        <InfoChip
          label="Sleep respiratory"
          value={
            typeof preferredSleepRespiratoryRate(metrics) === 'number'
              ? `${num(preferredSleepRespiratoryRate(metrics))}/min`
              : '—'
          }
        />
      </div>
    </div>
  );
}

function HeartRateHero({
  currentHr,
  points,
  modeLabel,
}: {
  currentHr?: number;
  points: HrPoint[];
  modeLabel: string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const activePoint = hoverIndex != null ? points[hoverIndex] ?? null : null;
  const displayValue = activePoint?.value ?? currentHr;
  const subtitle = activePoint
    ? `${formatClock(activePoint.ts)} • ${activePoint.mode || 'sample'}`
    : modeLabel;

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-emerald-300/80">
            Heart rate
          </div>
          <div className="mt-2 flex items-end gap-2">
            <div className="text-5xl font-semibold leading-none">{num(displayValue)}</div>
            <div className="pb-1 text-base text-slate-300">bpm</div>
          </div>
          <div className="mt-2 text-xs text-slate-400">{subtitle}</div>
        </div>

        <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
          {points.length > 0 ? 'Trend visible' : 'Awaiting samples'}
        </div>
      </div>

      <div className="mt-4">
        <LineHealthChart
          points={points}
          valueSuffix=" bpm"
          lineClassName="stroke-emerald-300"
          glowClassName="stroke-emerald-400/20"
          fillId="hr-fill"
          hoverIndex={hoverIndex}
          onHoverIndexChange={setHoverIndex}
          minY={40}
          maxY={160}
          gradientFrom="rgba(16,185,129,0.28)"
          gradientTo="rgba(16,185,129,0.02)"
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-400">
        <MetricHint label="Visible min" value={rangeMin(points)} />
        <MetricHint label="Visible max" value={rangeMax(points)} />
        <MetricHint label="Samples" value={String(points.length)} />
      </div>
    </div>
  );
}

function ReadinessGauge({ value }: { value?: number }) {
  const safeValue =
    typeof value === 'number' && Number.isFinite(value)
      ? Math.max(0, Math.min(100, value))
      : null;
  const angle = safeValue == null ? 0 : (safeValue / 100) * 180;
  const grade =
    safeValue == null
      ? 'Pending'
      : safeValue >= 85
        ? 'Excellent'
        : safeValue >= 70
          ? 'Good'
          : safeValue >= 50
            ? 'Moderate'
            : 'Low';

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="text-xs uppercase tracking-[0.2em] text-amber-300/80">
        Recovery readiness
      </div>

      <div className="mt-4 flex items-center justify-center">
        <div className="relative h-40 w-72 overflow-hidden">
          <div
            className="absolute inset-x-0 top-4 mx-auto h-64 w-64 rounded-full border-[16px] border-white/10"
            style={{ clipPath: 'inset(0 0 50% 0)' }}
          />
          <div
            className="absolute inset-x-0 top-4 mx-auto h-64 w-64 rounded-full border-[16px] border-transparent"
            style={{
              clipPath: 'inset(0 0 50% 0)',
              borderTopColor: '#f59e0b',
              borderRightColor: angle > 90 ? '#f59e0b' : 'transparent',
              transform: `rotate(${Math.max(-90, Math.min(90, angle - 90))}deg)`,
              transformOrigin: '50% 50%',
            }}
          />
          <div
            className="absolute left-1/2 top-[118px] h-1.5 w-20 -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-amber-300 to-transparent"
            style={{
              transform: `translateX(-50%) rotate(${angle - 90}deg)`,
              transformOrigin: '50% 50%',
            }}
          />
          <div className="absolute inset-x-0 top-16 text-center">
            <div className="text-5xl font-semibold">{num(safeValue)}</div>
            <div className="mt-1 text-sm text-amber-200">{grade}</div>
          </div>
        </div>
      </div>

      <p className="mt-1 text-sm leading-6 text-slate-300">{readinessNarrative(value)}</p>
    </div>
  );
}

function SleepHero({
  score,
  stages,
  metrics,
  historyCount,
  lastSeenTs,
  mtu,
  patientBound,
  sleepCount,
}: {
  score?: number;
  stages?: Metrics['sleepStages'];
  metrics: Metrics;
  historyCount: number;
  lastSeenTs?: number | null;
  mtu?: number | null;
  patientBound: boolean;
  sleepCount?: number;
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-300">Sleep</div>
      <div className="mt-2 flex items-end gap-1">
        <div className="text-4xl font-semibold">{num(score)}</div>
        <div className="pb-1 text-base text-slate-300">/100</div>
      </div>
      <div className="mt-1 text-sm text-slate-300">{sleepNarrative(score, metrics.readiness)}</div>

      <div className="mt-4 space-y-3">
        <SleepBar
          label="Light"
          value={stages?.light}
          total={sleepTotalFromStages(stages)}
          color="bg-sky-400"
        />
        <SleepBar
          label="Deep"
          value={stages?.deep}
          total={sleepTotalFromStages(stages)}
          color="bg-indigo-500"
        />
        <SleepBar
          label="REM"
          value={stages?.rem}
          total={sleepTotalFromStages(stages)}
          color="bg-cyan-300"
        />
        <SleepBar
          label="Awake"
          value={stages?.awake}
          total={sleepTotalFromStages(stages)}
          color="bg-slate-400"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-300">
        <InfoChip label="Synced history" value={String(historyCount)} />
        <InfoChip label="Last seen" value={relativeTime(lastSeenTs)} />
        <InfoChip label="MTU" value={mtu ? String(mtu) : '—'} />
        <InfoChip label="Sleep count" value={sleepCount ? String(sleepCount) : '—'} />
        <InfoChip label="Patient bound" value={patientBound ? 'Yes' : 'No'} />
        <InfoChip
          label="Total sleep"
          value={sleepTotalFromStages(stages) ? `${sleepTotalFromStages(stages)} min` : '—'}
        />
        <InfoChip
          label="Night SpO₂"
          value={
            typeof preferredNightSpo2(metrics) === 'number'
              ? `${num(preferredNightSpo2(metrics))}%`
              : '—'
          }
        />
        <InfoChip
          label="Sleep respiratory"
          value={
            typeof preferredSleepRespiratoryRate(metrics) === 'number'
              ? `${num(preferredSleepRespiratoryRate(metrics))}/min`
              : '—'
          }
        />
      </div>
    </div>
  );
}