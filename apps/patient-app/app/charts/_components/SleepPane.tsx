'use client';

import React, { useMemo, useState } from 'react';

type SleepPaneProps = {
  sleep: any;
  discreet: boolean;
};

type SleepStages = {
  awake?: number | null;
  rem?: number | null;
  light?: number | null;
  deep?: number | null;
};

type SleepSession = {
  id: string;
  startTs?: number | null;
  endTs?: number | null;
  totalMinutes: number;
  score?: number | null;
  efficiency?: number | null;
  stages: SleepStages;
};

export default function SleepPane(props: SleepPaneProps) {
  const { sleep, discreet } = props;

  const sessions = useMemo(() => normalizeSleepSessions(sleep), [sleep]);
  const hero = sessions[0] ?? null;

  const [index, setIndex] = useState(0);
  const safeIndex = Math.min(index, Math.max(0, sessions.length - 1));
  const active = sessions[safeIndex] ?? null;

  if (discreet) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div className="font-medium">Discreet mode</div>
          <p className="mt-1 text-xs text-slate-500">
            Sleep details are hidden while Discreet is enabled.
          </p>
        </div>
      </div>
    );
  }

  if (!hero) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <div className="text-sm font-semibold text-slate-800">No sleep sessions yet</div>
          <div className="mt-1 text-xs text-slate-500">
            Once NexRing sleep sessions or fallback sleep stages are available, they will render here.
          </div>
        </div>
      </div>
    );
  }

  const total = hero.totalMinutes;
  const heroScore = safeNum(hero.score);
  const heroEfficiency = safeNum(hero.efficiency);

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
          <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Sleep score
            </div>

            <div className="mt-3 flex items-end gap-2">
              <div className="text-5xl font-semibold tracking-tight text-slate-900">
                {heroScore != null ? Math.round(heroScore) : '—'}
              </div>
              <div className="pb-1 text-sm text-slate-500">/100</div>
            </div>

            <div className="mt-2 text-sm text-slate-600">
              {heroScore == null
                ? 'Sleep score not available yet.'
                : heroScore >= 80
                ? 'Recovery looks strong.'
                : heroScore >= 60
                ? 'Moderate recovery.'
                : 'Recovery may need attention.'}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <InfoChip
                label="Total sleep"
                value={total > 0 ? `${formatMinutes(total)}` : '—'}
              />
              <InfoChip
                label="Efficiency"
                value={heroEfficiency != null ? `${Math.round(heroEfficiency)}%` : '—'}
              />
              <InfoChip
                label="Start"
                value={hero.startTs ? formatClock(hero.startTs) : '—'}
              />
              <InfoChip
                label="End"
                value={hero.endTs ? formatClock(hero.endTs) : '—'}
              />
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Stage balance
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Latest sleep composition from the active session.
                </div>
              </div>

              <div className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                {sessions.length} session{sessions.length === 1 ? '' : 's'}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <StageBar
                label="Light"
                value={hero.stages.light}
                total={total}
                colorClass="bg-sky-400"
              />
              <StageBar
                label="Deep"
                value={hero.stages.deep}
                total={total}
                colorClass="bg-indigo-500"
              />
              <StageBar
                label="REM"
                value={hero.stages.rem}
                total={total}
                colorClass="bg-cyan-300"
              />
              <StageBar
                label="Awake"
                value={hero.stages.awake}
                total={total}
                colorClass="bg-slate-400"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Sleep sessions</div>
            <div className="mt-1 text-xs text-slate-500">
              Session-by-session timeline for wearable sleep reporting.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={safeIndex === 0}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              type="button"
            >
              ← Previous
            </button>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
              {safeIndex + 1} / {sessions.length}
            </span>

            <button
              onClick={() => setIndex((i) => Math.min(sessions.length - 1, i + 1))}
              disabled={safeIndex >= sessions.length - 1}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              type="button"
            >
              Next →
            </button>
          </div>
        </div>

        {active ? (
          <div className="mt-4 rounded-[28px] border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Session {safeIndex + 1}
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {active.startTs ? formatClock(active.startTs) : '—'} —{' '}
                  {active.endTs ? formatClock(active.endTs) : '—'}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Total {active.totalMinutes ? `${active.totalMinutes} min` : '—'}
                </div>
              </div>

              <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                Score {active.score != null ? Math.round(active.score) : '—'}
              </div>
            </div>

            <div className="mt-4">
              <SleepStageTimeline stages={active.stages} total={active.totalMinutes} />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <SessionStat label="Awake" value={minutesLabel(active.stages.awake)} />
              <SessionStat label="REM" value={minutesLabel(active.stages.rem)} />
              <SessionStat label="Light" value={minutesLabel(active.stages.light)} />
              <SessionStat label="Deep" value={minutesLabel(active.stages.deep)} />
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function StageBar(props: {
  label: string;
  value?: number | null;
  total: number;
  colorClass: string;
}) {
  const { label, value, total, colorClass } = props;
  const pct =
    typeof value === 'number' && total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-500">{minutesLabel(value)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SleepStageTimeline(props: { stages: SleepStages; total: number }) {
  const { stages, total } = props;

  const segments = [
    { label: 'Awake', value: stages.awake ?? 0, className: 'bg-slate-400' },
    { label: 'REM', value: stages.rem ?? 0, className: 'bg-cyan-300' },
    { label: 'Light', value: stages.light ?? 0, className: 'bg-sky-400' },
    { label: 'Deep', value: stages.deep ?? 0, className: 'bg-indigo-500' },
  ].filter((x) => x.value > 0);

  if (!segments.length || total <= 0) {
    return <div className="h-14 rounded-2xl border border-dashed border-slate-200 bg-white" />;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex h-14 overflow-hidden rounded-2xl bg-slate-100">
        {segments.map((seg) => {
          const width = `${Math.max(8, (seg.value / total) * 100)}%`;
          return (
            <div
              key={seg.label}
              className={`flex h-full items-center justify-center text-[11px] font-semibold text-slate-900 ${seg.className}`}
              style={{ width }}
              title={`${seg.label}: ${seg.value} min`}
            >
              <span className="rounded-full bg-white/70 px-2 py-0.5 backdrop-blur">
                {seg.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SessionStat(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3">
      <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{props.label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{props.value}</div>
    </div>
  );
}

function InfoChip(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3">
      <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{props.label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{props.value}</div>
    </div>
  );
}

function normalizeSleepSessions(sleep: any): SleepSession[] {
  const rawSessions = Array.isArray(sleep?.sessions)
    ? sleep.sessions
    : Array.isArray(sleep?.data?.sessions)
    ? sleep.data.sessions
    : [];

  const normalized = rawSessions
    .map((s: any, idx: number) => normalizeSession(s, idx))
    .filter((s: SleepSession | null): s is SleepSession => !!s)
    .sort((a, b) => (b.startTs ?? 0) - (a.startTs ?? 0));

  if (normalized.length > 0) return normalized;

  const fallbackStages = normalizeStages(
    sleep?.stages ??
      sleep?.sleepStages ??
      sleep?.summary?.stages ??
      sleep?.data?.stages ??
      null,
  );

  const fallbackTotal =
    safeNum(
      sleep?.totalMinutes ??
        sleep?.summary?.totalMinutes ??
        sleep?.summary?.durationMinutes ??
        sleep?.totalSleepMinutes ??
        null,
    ) ?? totalFromStages(fallbackStages);

  const fallbackScore = safeNum(
    sleep?.score ?? sleep?.sleepScore ?? sleep?.summary?.score ?? null,
  );

  const fallbackEfficiency = safeNum(
    sleep?.efficiency ?? sleep?.summary?.efficiency ?? null,
  );

  if (!fallbackTotal) return [];

  const now = Date.now();
  return [
    {
      id: 'latest',
      startTs: now - fallbackTotal * 60_000,
      endTs: now,
      totalMinutes: fallbackTotal,
      score: fallbackScore,
      efficiency: fallbackEfficiency,
      stages: fallbackStages,
    },
  ];
}

function normalizeSession(s: any, idx: number): SleepSession | null {
  if (!s || typeof s !== 'object') return null;

  const stages = normalizeStages(
    s.stages ?? {
      awake: s.awake ?? s.wakeTime,
      rem: s.rem ?? s.remTime,
      light: s.light ?? s.lightTime,
      deep: s.deep ?? s.deepSleep,
    },
  );

  const totalMinutes =
    safeNum(s.totalMinutes ?? s.durationMinutes ?? s.sleepMinutes ?? null) ??
    totalFromStages(stages);

  if (!totalMinutes) return null;

  const startTs = toMs(
    s.startTs ?? s.startTime ?? s.start ?? s.bedTime ?? null,
  );
  const endTs = toMs(
    s.endTs ?? s.endTime ?? s.end ?? s.wakeTimeTs ?? null,
  );

  return {
    id: String(s.id ?? idx),
    startTs,
    endTs: endTs ?? (startTs != null ? startTs + totalMinutes * 60_000 : null),
    totalMinutes,
    score: safeNum(s.score ?? s.sleepScore ?? null),
    efficiency: safeNum(s.efficiency ?? null),
    stages,
  };
}

function normalizeStages(input: any): SleepStages {
  if (!input || typeof input !== 'object') {
    return {};
  }

  return {
    awake: safeNum(input.awake ?? input.wake ?? input.wakeTime ?? null),
    rem: safeNum(input.rem ?? input.remTime ?? null),
    light: safeNum(input.light ?? input.lightTime ?? null),
    deep: safeNum(input.deep ?? input.deepSleep ?? null),
  };
}

function totalFromStages(stages: SleepStages) {
  return ['awake', 'rem', 'light', 'deep'].reduce((acc, key) => {
    const v = (stages as any)[key];
    return typeof v === 'number' && Number.isFinite(v) ? acc + v : acc;
  }, 0);
}

function safeNum(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function toMs(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Date.parse(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatClock(ms: number) {
  return new Date(ms).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0) return `${h} h ${m} m`;
  return `${m} m`;
}

function minutesLabel(v?: number | null) {
  return typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v)} min` : '—';
}