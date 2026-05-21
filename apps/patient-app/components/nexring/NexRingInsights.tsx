'use client';

import React, { useMemo, useState } from 'react';
import {
  type Metrics,
  type SleepSession,
  type StressPoint,
  type TempPoint,
  num,
  stressNarrative,
  readinessNarrative,
  sleepNarrative,
  sleepTotalFromStages,
  formatClock,
  formatSigned,
} from '@/src/devices/nexring/nexring-view-model';
import {
  Card,
  MetricCard,
  SummaryPanel,
  InfoTile,
  LineHealthChart,
} from './NexRingPrimitives';

export function NexRingInsights({
  metrics,
  stressHistory,
  tempHistory,
  sleepSessions,
}: {
  metrics: Metrics;
  stressHistory: StressPoint[];
  tempHistory: TempPoint[];
  sleepSessions: SleepSession[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Daytime stress trend" subtitle="Trend surface — this should not be represented as only a static tile.">
          <StressTrendChart points={stressHistory} current={metrics.stress} />
        </Card>

        <Card title="Temperature deviation" subtitle="Deviation from baseline — not body temperature.">
          <TemperatureDeviationChart points={tempHistory} current={metrics.tempC} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Daily overview">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Steps" value={num(metrics.steps)} unit="" tone="emerald" />
            <MetricCard label="Calories" value={num(metrics.calories)} unit="kcal" tone="orange" />
            <MetricCard label="Night SpO₂" value={num(metrics.spo2)} unit="%" tone="cyan" />
            <MetricCard label="Sleep respiratory rate" value={num(metrics.rr)} unit="/min" tone="violet" />
          </div>
        </Card>

        <Card title="Recovery summary">
          <div className="grid gap-4">
            <SummaryPanel
              title="Recovery readiness"
              value={num(metrics.readiness)}
              suffix="/100"
              blurb={readinessNarrative(metrics.readiness)}
            />
            <SummaryPanel
              title="Sleep quality"
              value={num(metrics.sleepScore)}
              suffix="/100"
              blurb={sleepNarrative(metrics.sleepScore, metrics.readiness)}
            />
          </div>
        </Card>
      </div>

      <Card
        title="Sleep sessions"
        subtitle="Each session gets its own stage rail and quality card. Split sleep and naps should not be flattened."
      >
        <SleepSessionsPanel sessions={sleepSessions} fallbackMetrics={metrics} />
      </Card>
    </div>
  );
}

function StressTrendChart({
  points,
  current,
}: {
  points: StressPoint[];
  current?: number;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const active = hoverIndex != null ? points[hoverIndex] ?? null : null;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-3xl font-semibold text-slate-900">
            {num(active?.value ?? current)}
            <span className="ml-1 text-sm font-medium text-slate-500">/100</span>
          </div>
          <div className="text-xs text-slate-500">
            {active ? formatClock(active.ts) : 'Most recent daytime stress signal'}
          </div>
        </div>
        <div className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
          Trend
        </div>
      </div>

      <LineHealthChart
        points={points.map((p) => ({ ts: p.ts, value: p.value }))}
        valueSuffix=""
        lineClassName="stroke-violet-500"
        glowClassName="stroke-violet-300/30"
        fillId="stress-fill"
        hoverIndex={hoverIndex}
        onHoverIndexChange={setHoverIndex}
        minY={0}
        maxY={100}
        gradientFrom="rgba(139,92,246,0.24)"
        gradientTo="rgba(139,92,246,0.03)"
      />

      <p className="text-sm leading-6 text-slate-600">{stressNarrative(current)}</p>
    </div>
  );
}

function TemperatureDeviationChart({
  points,
  current,
}: {
  points: TempPoint[];
  current?: number;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const active = hoverIndex != null ? points[hoverIndex] ?? null : null;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-3xl font-semibold text-slate-900">
            {formatSigned(active?.value ?? current)}
            <span className="ml-1 text-sm font-medium text-slate-500">baseline</span>
          </div>
          <div className="text-xs text-slate-500">
            {active ? formatClock(active.ts) : 'Temperature variation, not direct body temperature'}
          </div>
        </div>
        <div className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-700">
          Deviation
        </div>
      </div>

      <LineHealthChart
        points={points.map((p) => ({ ts: p.ts, value: p.value }))}
        valueSuffix=""
        lineClassName="stroke-cyan-500"
        glowClassName="stroke-cyan-300/30"
        fillId="temp-fill"
        hoverIndex={hoverIndex}
        onHoverIndexChange={setHoverIndex}
        minY={-3}
        maxY={3}
        gradientFrom="rgba(34,211,238,0.22)"
        gradientTo="rgba(34,211,238,0.02)"
      />

      <p className="text-sm leading-6 text-slate-600">
        Use this as a baseline-delta signal. This is the right foundation for cycle and fertility-facing modules later.
      </p>
    </div>
  );
}

function SleepSessionsPanel({
  sessions,
  fallbackMetrics,
}: {
  sessions: SleepSession[];
  fallbackMetrics: Metrics;
}) {
  const derivedSessions = useMemo(() => {
    if (sessions.length > 0) return sessions;

    const total = sleepTotalFromStages(fallbackMetrics.sleepStages);
    if (!total) return [];

    const now = Date.now();
    return [
      {
        id: 'latest',
        startTs: now - total * 60_000,
        endTs: now,
        totalMinutes: total,
        score: fallbackMetrics.sleepScore,
        stages: {
          awake: fallbackMetrics.sleepStages?.awake,
          rem: fallbackMetrics.sleepStages?.rem,
          light: fallbackMetrics.sleepStages?.light,
          deep: fallbackMetrics.sleepStages?.deep,
        },
      },
    ];
  }, [sessions, fallbackMetrics]);

  if (derivedSessions.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        No decoded sleep sessions yet. Once the historical sleep payload is mapped, each session will render with its own futuristic stage timeline.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {derivedSessions.map((session, idx) => (
        <SleepSessionCard key={session.id || idx} session={session} />
      ))}
    </div>
  );
}

function SleepSessionCard({ session }: { session: SleepSession }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Sleep session {session.id === 'latest' ? 'latest' : `#${session.id}`}
          </div>
          <div className="mt-1 text-lg font-semibold text-slate-900">
            {formatClock(session.startTs)} — {formatClock(session.endTs)}
          </div>
          <div className="mt-1 text-sm text-slate-500">Total {session.totalMinutes} min</div>
        </div>

        <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
          Score {num(session.score)}
        </div>
      </div>

      <div className="mt-4">
        <SleepStageTimeline stages={session.stages} total={session.totalMinutes} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <InfoTile label="Awake" value={session.stages.awake != null ? `${Math.round(session.stages.awake)} min` : '—'} />
        <InfoTile label="REM" value={session.stages.rem != null ? `${Math.round(session.stages.rem)} min` : '—'} />
        <InfoTile label="Light" value={session.stages.light != null ? `${Math.round(session.stages.light)} min` : '—'} />
        <InfoTile label="Deep" value={session.stages.deep != null ? `${Math.round(session.stages.deep)} min` : '—'} />
      </div>
    </div>
  );
}

function SleepStageTimeline({
  stages,
  total,
}: {
  stages: SleepSession['stages'];
  total: number;
}) {
  const segments = [
    { label: 'Awake', value: stages.awake ?? 0, className: 'bg-slate-400' },
    { label: 'REM', value: stages.rem ?? 0, className: 'bg-cyan-300' },
    { label: 'Light', value: stages.light ?? 0, className: 'bg-sky-400' },
    { label: 'Deep', value: stages.deep ?? 0, className: 'bg-indigo-500' },
  ].filter((s) => s.value > 0);

  return (
    <div className="space-y-2">
      <div className="h-5 overflow-hidden rounded-full bg-slate-200">
        <div className="flex h-full w-full">
          {segments.length === 0 ? (
            <div className="h-full w-full bg-slate-300" />
          ) : (
            segments.map((seg) => {
              const pct = total > 0 ? (seg.value / total) * 100 : 0;
              return (
                <div
                  key={seg.label}
                  className={`h-full ${seg.className}`}
                  style={{ width: `${pct}%` }}
                  title={`${seg.label}: ${Math.round(seg.value)} min`}
                />
              );
            })
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 sm:grid-cols-4">
        {['Awake', 'REM', 'Light', 'Deep'].map((label) => {
          const value =
            label === 'Awake'
              ? stages.awake
              : label === 'REM'
              ? stages.rem
              : label === 'Light'
              ? stages.light
              : stages.deep;

          return (
            <div key={label} className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
              <span>{label}</span>
              <span className="font-medium text-slate-700">{value != null ? `${Math.round(value)}m` : '—'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}