// apps/clinician-app/app/workspaces/physio/panels/ProgressPanel.tsx
'use client';

import React, { useMemo, useState } from 'react';
import type { Goal, GoalDirection, GoalMetric } from '../physioModel';
import { clamp, nowISO, uid } from '../physioModel';

export default function ProgressPanel(props: {
  regionLabel: string;
  regionId: string;

  points: Array<{ encounterId: string; at: string; painScore?: number; romActiveDeg?: number }>;
  latestPain?: number;
  latestRomActive?: number;

  goals: Array<Goal & { _status: 'done' | 'no-data' | 'on-track' | 'off-track'; _current?: number }>;
  onAddGoal: (g: Goal) => void;
  onMarkGoalDone: (id: string) => void;
  onDeleteGoal: (id: string) => void;
}) {
  const { points, goals, regionLabel, latestPain, latestRomActive } = props;

  const painSeries = useMemo(() => points.filter((p) => typeof p.painScore === 'number').map((p) => ({ x: p.at, y: p.painScore as number })), [points]);
  const romSeries = useMemo(() => points.filter((p) => typeof p.romActiveDeg === 'number').map((p) => ({ x: p.at, y: p.romActiveDeg as number })), [points]);

  const painBaseline = painSeries.length ? painSeries[0]!.y : undefined;
  const painLatest = painSeries.length ? painSeries[painSeries.length - 1]!.y : undefined;
  const painDelta = typeof painBaseline === 'number' && typeof painLatest === 'number' ? painLatest - painBaseline : undefined;

  const romBaseline = romSeries.length ? romSeries[0]!.y : undefined;
  const romLatest = romSeries.length ? romSeries[romSeries.length - 1]!.y : undefined;
  const romDelta = typeof romBaseline === 'number' && typeof romLatest === 'number' ? romLatest - romBaseline : undefined;

  const activePainGoal = useMemo(() => goals.find((g) => !g.done && g.metric === 'pain') ?? null, [goals]);
  const activeRomGoal = useMemo(() => goals.find((g) => !g.done && g.metric === 'rom_active') ?? null, [goals]);

  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-gray-800">Progress</div>
          <div className="text-[11px] text-gray-500">Region: {regionLabel} · charts + goals</div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full border bg-rose-50 border-rose-200 px-2 py-0.5 text-rose-800">
            Pain: <span className="font-mono font-semibold">{typeof latestPain === 'number' ? latestPain : '—'}</span>/10
            {typeof painDelta === 'number' ? (
              <span className="ml-2 text-rose-900/80">
                Δ <span className="font-mono">{fmtDelta(painDelta)}</span>
              </span>
            ) : null}
          </span>
          <span className="rounded-full border bg-sky-50 border-sky-200 px-2 py-0.5 text-sky-800">
            ROM A:{' '}
            <span className="font-mono font-semibold">{typeof latestRomActive === 'number' ? `${Math.round(latestRomActive)}°` : '—'}</span>
            {typeof romDelta === 'number' ? (
              <span className="ml-2 text-sky-900/80">
                Δ <span className="font-mono">{fmtDelta(romDelta, true)}°</span>
              </span>
            ) : null}
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3">
        <div className="rounded-lg border bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-gray-700">Pain score over time</div>
            {activePainGoal ? (
              <span className="text-[11px] rounded-full border bg-white px-2 py-0.5 text-gray-700">
                goal: {activePainGoal.direction === 'lte' ? '≤' : '≥'} <span className="font-mono">{activePainGoal.target}</span>
              </span>
            ) : null}
          </div>
          <MiniLineChart
            series={painSeries}
            yMin={0}
            yMax={10}
            yLabel="0–10"
            goalY={activePainGoal?.target}
          />
        </div>

        <div className="rounded-lg border bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-gray-700">Active ROM over time</div>
            {activeRomGoal ? (
              <span className="text-[11px] rounded-full border bg-white px-2 py-0.5 text-gray-700">
                goal: {activeRomGoal.direction === 'lte' ? '≤' : '≥'} <span className="font-mono">{activeRomGoal.target}</span>°
              </span>
            ) : null}
          </div>
          <MiniLineChart
            series={romSeries}
            yMin={0}
            yMax={180}
            yLabel="°"
            goalY={activeRomGoal?.target}
          />
        </div>

        <GoalsPanel
          regionId={props.regionId}
          goals={goals}
          onAddGoal={props.onAddGoal}
          onMarkDone={props.onMarkGoalDone}
          onDelete={props.onDeleteGoal}
        />
      </div>

      <div className="mt-2 text-[11px] text-gray-500">Later: replace seeded points with server-backed outcomes across encounters + standardized PROMs.</div>
    </div>
  );
}

function fmtDelta(d: number, allowPlus = false) {
  const r = Math.round(d * 10) / 10;
  if (r > 0) return allowPlus ? `+${r}` : `${r}`;
  return `${r}`;
}

function MiniLineChart(props: {
  series: Array<{ x: string; y: number }>;
  yMin: number;
  yMax: number;
  yLabel: string;
  goalY?: number;
}) {
  const { series, yMin, yMax, yLabel, goalY } = props;

  const w = 320;
  const h = 120;
  const pad = 18;

  const xs = useMemo(() => series.map((s) => new Date(s.x).getTime()), [series]);
  const minX = xs.length ? Math.min(...xs) : 0;
  const maxX = xs.length ? Math.max(...xs) : 1;
  const dx = Math.max(1, maxX - minX);

  const toX = (t: number) => pad + ((t - minX) / dx) * (w - pad * 2);
  const toY = (v: number) => {
    const cl = clamp(v, yMin, yMax);
    const p = (cl - yMin) / Math.max(1e-6, yMax - yMin);
    return h - pad - p * (h - pad * 2);
  };

  const points = useMemo(() => {
    if (!series.length) return '';
    return series.map((s) => `${toX(new Date(s.x).getTime()).toFixed(1)},${toY(s.y).toFixed(1)}`).join(' ');
  }, [series, minX, dx]);

  const last = series.length ? series[series.length - 1] : undefined;

  const goalLineY = typeof goalY === 'number' ? toY(goalY) : null;

  return (
    <div className="mt-2">
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="rounded border bg-white">
        {/* grid */}
        {[0.25, 0.5, 0.75].map((p) => (
          <line
            key={p}
            x1={pad}
            x2={w - pad}
            y1={pad + p * (h - pad * 2)}
            y2={pad + p * (h - pad * 2)}
            stroke="rgba(148,163,184,0.35)"
            strokeWidth="1"
          />
        ))}
        <line x1={pad} x2={pad} y1={pad} y2={h - pad} stroke="rgba(148,163,184,0.55)" strokeWidth="1" />
        <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} stroke="rgba(148,163,184,0.55)" strokeWidth="1" />

        {/* goal line */}
        {goalLineY != null ? (
          <>
            <line
              x1={pad}
              x2={w - pad}
              y1={goalLineY}
              y2={goalLineY}
              stroke="rgba(16,185,129,0.9)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <text x={w - pad} y={goalLineY - 4} textAnchor="end" fontSize="10" fill="rgba(16,185,129,0.9)">
              goal
            </text>
          </>
        ) : null}

        {/* series */}
        {series.length ? (
          <>
            <polyline points={points} fill="none" stroke="rgba(37,99,235,0.9)" strokeWidth="2" />
            <circle
              cx={Number(points.split(' ').slice(-1)[0].split(',')[0])}
              cy={Number(points.split(' ').slice(-1)[0].split(',')[1])}
              r="3.5"
              fill="rgba(37,99,235,0.9)"
            />
          </>
        ) : null}

        {/* label */}
        <text x={6} y={12} fontSize="10" fill="rgba(71,85,105,0.9)">
          {yLabel}
        </text>
      </svg>

      <div className="mt-1 text-[11px] text-gray-600">
        {series.length ? (
          <>
            Latest: <span className="font-mono font-semibold">{Math.round(last!.y * 10) / 10}</span> · points:{' '}
            <span className="font-mono">{series.length}</span>
          </>
        ) : (
          <span className="italic text-gray-500">No data points yet.</span>
        )}
      </div>
    </div>
  );
}

function GoalsPanel(props: {
  regionId: string;
  goals: Array<Goal & { _status: 'done' | 'no-data' | 'on-track' | 'off-track'; _current?: number }>;
  onAddGoal: (g: Goal) => void;
  onMarkDone: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { goals, onAddGoal } = props;

  const [title, setTitle] = useState('');
  const [metric, setMetric] = useState<GoalMetric>('pain');
  const [direction, setDirection] = useState<GoalDirection>('lte');
  const [target, setTarget] = useState('3');

  return (
    <div className="rounded-lg border bg-gray-50 p-3">
      <div className="text-xs font-semibold text-gray-700">Goals</div>
      <div className="text-[11px] text-gray-500">Target lines appear on charts for active goals.</div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <label className="text-xs text-gray-600">
          Goal title
          <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Reduce pain with stairs" />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <label className="text-xs text-gray-600">
            Metric
            <select className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={metric} onChange={(e) => setMetric(e.target.value as GoalMetric)}>
              <option value="pain">Pain</option>
              <option value="rom_active">ROM Active</option>
            </select>
          </label>

          <label className="text-xs text-gray-600">
            Direction
            <select className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={direction} onChange={(e) => setDirection(e.target.value as GoalDirection)}>
              <option value="lte">≤</option>
              <option value="gte">≥</option>
            </select>
          </label>

          <label className="text-xs text-gray-600">
            Target
            <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={target} onChange={(e) => setTarget(e.target.value)} inputMode="numeric" placeholder={metric === 'pain' ? 'e.g., 2' : 'e.g., 150'} />
          </label>
        </div>

        <button
          className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
          onClick={() => {
            const t = title.trim();
            const n = Number(target);
            if (!t) return;
            if (!Number.isFinite(n)) return;

            const g: Goal = {
              id: uid('goal'),
              regionId: props.regionId,
              title: t,
              metric,
              direction,
              target: n,
              createdAt: nowISO(),
            };
            onAddGoal(g);
            setTitle('');
          }}
          type="button"
        >
          Add goal
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {goals.length === 0 ? (
          <div className="text-sm text-gray-600 italic">No goals yet.</div>
        ) : (
          goals.map((g) => (
            <div key={g.id} className="rounded border bg-white p-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{g.title}</div>
                <div className="text-[11px] text-gray-600">
                  {g.metric === 'pain' ? 'Pain' : 'ROM Active'} {g.direction === 'lte' ? '≤' : '≥'}{' '}
                  <span className="font-mono font-semibold">{g.target}</span>
                  {g.metric === 'pain' ? ' /10' : '°'}
                  {typeof g._current === 'number' ? (
                    <>
                      {' '}
                      · current: <span className="font-mono">{Math.round(g._current)}</span>
                      {g.metric === 'pain' ? '' : '°'}
                    </>
                  ) : null}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <span
                    className={
                      'text-[10px] rounded-full border px-2 py-0.5 ' +
                      (g._status === 'done'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : g._status === 'on-track'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : g._status === 'off-track'
                        ? 'border-rose-200 bg-rose-50 text-rose-800'
                        : 'border-gray-200 bg-gray-50 text-gray-700')
                    }
                  >
                    {g._status === 'no-data' ? 'no data' : g._status.replace('-', ' ')}
                  </span>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1">
                {!g.done ? (
                  <button className="text-[11px] px-2 py-1 rounded border bg-white hover:bg-gray-50" onClick={() => props.onMarkDone(g.id)} type="button">
                    Done
                  </button>
                ) : null}
                <button className="text-[11px] px-2 py-1 rounded border bg-white hover:bg-gray-50 text-rose-700" onClick={() => props.onDelete(g.id)} type="button">
                  Del
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
