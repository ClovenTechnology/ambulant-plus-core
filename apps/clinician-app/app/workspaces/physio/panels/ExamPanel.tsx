// apps/clinician-app/app/workspaces/physio/panels/ExamPanel.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type {
  EndFeel,
  Irritability,
  PainQuality,
  Pattern24h,
  RegionDef,
  SpecialTestResult,
} from '../physioModel';
import { parseDegLike } from '../physioModel';

export default function ExamPanel(props: {
  region: RegionDef;

  onCreatePain: (p: {
    painScore0to10?: number;
    quality?: PainQuality;
    irritability?: Irritability;
    pattern24h?: Pattern24h;
    aggravators?: string;
    relievers?: string;
    distribution?: string;
    note?: string;
  }) => void;

  onCreateRom: (r: {
    joint?: string;
    movement?: string;
    activeDeg?: number | null;
    passiveDeg?: number | null;
    wnl?: boolean;
    endFeel?: EndFeel;
    painfulArc?: boolean;
    painAtEndRange?: boolean;
    comparableSign?: boolean;
    note?: string;
  }) => void;

  onCreateStrength: (s: {
    muscleGroup?: string;
    test?: string;
    mmt0to5?: 0 | 1 | 2 | 3 | 4 | 5;
    painWithResistance?: boolean;
    inhibition?: boolean;
    note?: string;
  }) => void;

  onCreateSpecialTest: (t: {
    testName: string;
    result: SpecialTestResult;
    note?: string;
  }) => void;
}) {
  const { region } = props;
  const [open, setOpen] = useState<'pain' | 'rom' | 'strength' | 'test' | null>('pain');

  return (
    <div className="rounded-xl border bg-gray-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-gray-700">Quick Exam</div>
          <div className="text-[11px] text-gray-500">Region-focused structured entries (fast + consistent).</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ChipBtn active={open === 'pain'} onClick={() => setOpen(open === 'pain' ? null : 'pain')}>
            Pain
          </ChipBtn>
          <ChipBtn active={open === 'rom'} onClick={() => setOpen(open === 'rom' ? null : 'rom')}>
            ROM
          </ChipBtn>
          <ChipBtn active={open === 'strength'} onClick={() => setOpen(open === 'strength' ? null : 'strength')}>
            Strength
          </ChipBtn>
          <ChipBtn active={open === 'test'} onClick={() => setOpen(open === 'test' ? null : 'test')}>
            Tests
          </ChipBtn>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {open === 'pain' ? <PainComposer region={region} onCreate={props.onCreatePain} /> : null}
        {open === 'rom' ? <ROMComposer region={region} onCreate={props.onCreateRom} /> : null}
        {open === 'strength' ? <StrengthComposer region={region} onCreate={props.onCreateStrength} /> : null}
        {open === 'test' ? <SpecialTestComposer region={region} onCreate={props.onCreateSpecialTest} /> : null}
      </div>
    </div>
  );
}

function ChipBtn(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className={
        'text-xs px-3 py-1.5 rounded-full border ' +
        (props.active ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700')
      }
      onClick={props.onClick}
      aria-pressed={props.active}
      type="button"
    >
      {props.children}
    </button>
  );
}

function PainComposer({
  region,
  onCreate,
}: {
  region: RegionDef;
  onCreate: (p: {
    painScore0to10?: number;
    quality?: PainQuality;
    irritability?: Irritability;
    pattern24h?: Pattern24h;
    aggravators?: string;
    relievers?: string;
    distribution?: string;
    note?: string;
  }) => void;
}) {
  const [score, setScore] = useState<number>(4);
  const [hasScore, setHasScore] = useState<boolean>(false);
  const [quality, setQuality] = useState<PainQuality>('aching');
  const [irritability, setIrritability] = useState<Irritability>('moderate');
  const [pattern24h, setPattern24h] = useState<Pattern24h>('unknown');
  const [aggravators, setAggravators] = useState('');
  const [relievers, setRelievers] = useState('');
  const [distribution, setDistribution] = useState('');
  const [note, setNote] = useState('');

  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-gray-800">Pain</div>
          <div className="text-[11px] text-gray-500">{region.label} · NPRS + behavior</div>
        </div>
        <span className="text-[11px] rounded-full border bg-gray-50 px-2 py-0.5 text-gray-700">structured</span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <div className="rounded-lg border bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-gray-700">Pain score (0–10)</div>
            <label className="text-xs text-gray-600 flex items-center gap-2">
              <input type="checkbox" checked={hasScore} onChange={() => setHasScore((v) => !v)} />
              record score
            </label>
          </div>

          <div className="mt-2 flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={10}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="flex-1"
              disabled={!hasScore}
            />
            <span className="text-sm font-mono font-semibold w-12 text-right">{hasScore ? score : '—'}</span>
          </div>

          <div className="mt-1 text-[11px] text-gray-500">Tip: use behavior fields below to make pain clinically meaningful.</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <label className="text-xs text-gray-600">
            Quality
            <select
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={quality}
              onChange={(e) => setQuality(e.target.value as PainQuality)}
            >
              {(['sharp', 'dull', 'burning', 'tingling', 'aching', 'stiff', 'other'] as PainQuality[]).map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-gray-600">
            Irritability
            <select
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={irritability}
              onChange={(e) => setIrritability(e.target.value as Irritability)}
            >
              {(['low', 'moderate', 'high'] as Irritability[]).map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-gray-600 md:col-span-2">
            24h Pattern
            <select
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={pattern24h}
              onChange={(e) => setPattern24h(e.target.value as Pattern24h)}
            >
              {(['unknown', 'worse_am', 'worse_pm', 'night', 'constant', 'intermittent'] as Pattern24h[]).map((x) => (
                <option key={x} value={x}>
                  {x.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="text-xs text-gray-600">
          Aggravators
          <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={aggravators} onChange={(e) => setAggravators(e.target.value)} placeholder="e.g., overhead reach, stairs, sitting" />
        </label>

        <label className="text-xs text-gray-600">
          Relievers
          <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={relievers} onChange={(e) => setRelievers(e.target.value)} placeholder="e.g., rest, heat, ice, change position" />
        </label>

        <label className="text-xs text-gray-600">
          Distribution / radiation
          <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={distribution} onChange={(e) => setDistribution(e.target.value)} placeholder="e.g., to lateral arm, to calf, local only" />
        </label>

        <label className="text-xs text-gray-600">
          Note
          <textarea className="mt-1 w-full rounded border px-2 py-1.5 text-sm" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional clinical note…" />
        </label>

        <button
          className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
          onClick={() => {
            onCreate({
              painScore0to10: hasScore ? score : undefined,
              quality,
              irritability,
              pattern24h,
              aggravators,
              relievers,
              distribution,
              note,
            });
            setNote('');
          }}
          type="button"
        >
          Save pain finding
        </button>
      </div>
    </div>
  );
}

function ROMComposer({
  region,
  onCreate,
}: {
  region: RegionDef;
  onCreate: (r: {
    joint?: string;
    movement?: string;
    activeDeg?: number | null;
    passiveDeg?: number | null;
    wnl?: boolean;
    endFeel?: EndFeel;
    painfulArc?: boolean;
    painAtEndRange?: boolean;
    comparableSign?: boolean;
    note?: string;
  }) => void;
}) {
  const [joint, setJoint] = useState(region.jointHint ?? 'Joint');
  const [movement, setMovement] = useState(region.defaultMovementHint ?? 'Movement');
  const [active, setActive] = useState('');
  const [passive, setPassive] = useState('');
  const [wnl, setWnl] = useState(false);
  const [endFeel, setEndFeel] = useState<EndFeel>('firm');
  const [painfulArc, setPainfulArc] = useState(false);
  const [painAtEndRange, setPainAtEndRange] = useState(false);
  const [comparableSign, setComparableSign] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    setJoint(region.jointHint ?? 'Joint');
    setMovement(region.defaultMovementHint ?? 'Movement');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region.id]);

  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-gray-800">ROM</div>
          <div className="text-[11px] text-gray-500">{region.label} · Active/Passive + end-feel</div>
        </div>
        <span className="text-[11px] rounded-full border bg-gray-50 px-2 py-0.5 text-gray-700">structured</span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <label className="text-xs text-gray-600">
            Joint
            <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={joint} onChange={(e) => setJoint(e.target.value)} />
          </label>

          <label className="text-xs text-gray-600">
            Movement
            <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={movement} onChange={(e) => setMovement(e.target.value)} />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <label className="text-xs text-gray-600">
            Active ROM (°)
            <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={active} onChange={(e) => setActive(e.target.value)} placeholder="e.g., 120" disabled={wnl} inputMode="numeric" />
          </label>

          <label className="text-xs text-gray-600">
            Passive ROM (°)
            <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={passive} onChange={(e) => setPassive(e.target.value)} placeholder="e.g., 130" disabled={wnl} inputMode="numeric" />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <label className="text-xs text-gray-600">
            End-feel
            <select className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={endFeel} onChange={(e) => setEndFeel(e.target.value as EndFeel)} disabled={wnl}>
              {(['soft', 'firm', 'hard', 'empty', 'springy', 'other'] as EndFeel[]).map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-gray-600 flex items-center gap-2 mt-6 md:mt-0">
            <input type="checkbox" checked={wnl} onChange={() => setWnl((v) => !v)} />
            WNL
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <label className="text-xs text-gray-700 flex items-center gap-2">
            <input type="checkbox" checked={painfulArc} onChange={() => setPainfulArc((v) => !v)} />
            Painful arc
          </label>
          <label className="text-xs text-gray-700 flex items-center gap-2">
            <input type="checkbox" checked={painAtEndRange} onChange={() => setPainAtEndRange((v) => !v)} />
            Pain at end-range
          </label>
          <label className="text-xs text-gray-700 flex items-center gap-2 md:col-span-2">
            <input type="checkbox" checked={comparableSign} onChange={() => setComparableSign((v) => !v)} />
            Comparable sign reproduced
          </label>
        </div>

        <label className="text-xs text-gray-600">
          Note
          <textarea className="mt-1 w-full rounded border px-2 py-1.5 text-sm" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional…" />
        </label>

        <button
          className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
          onClick={() => {
            onCreate({
              joint,
              movement,
              wnl,
              activeDeg: wnl ? null : parseDegLike(active) ?? null,
              passiveDeg: wnl ? null : parseDegLike(passive) ?? null,
              endFeel: wnl ? undefined : endFeel,
              painfulArc,
              painAtEndRange,
              comparableSign,
              note,
            });
            setNote('');
          }}
          type="button"
        >
          Save ROM finding
        </button>
      </div>
    </div>
  );
}

function StrengthComposer({
  region,
  onCreate,
}: {
  region: RegionDef;
  onCreate: (s: {
    muscleGroup?: string;
    test?: string;
    mmt0to5?: 0 | 1 | 2 | 3 | 4 | 5;
    painWithResistance?: boolean;
    inhibition?: boolean;
    note?: string;
  }) => void;
}) {
  const [muscleGroup, setMuscleGroup] = useState(region.jointHint ? `${region.jointHint} group` : 'Muscle group');
  const [test, setTest] = useState('Manual muscle test');
  const [mmt, setMmt] = useState<0 | 1 | 2 | 3 | 4 | 5>(4);
  const [hasMmt, setHasMmt] = useState(false);
  const [painWithResistance, setPainWithResistance] = useState(false);
  const [inhibition, setInhibition] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    setMuscleGroup(region.jointHint ? `${region.jointHint} group` : 'Muscle group');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region.id]);

  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-gray-800">Strength</div>
          <div className="text-[11px] text-gray-500">{region.label} · MMT + resistance pain</div>
        </div>
        <span className="text-[11px] rounded-full border bg-gray-50 px-2 py-0.5 text-gray-700">structured</span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <label className="text-xs text-gray-600">
          Muscle group
          <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value)} />
        </label>

        <label className="text-xs text-gray-600">
          Test / position
          <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={test} onChange={(e) => setTest(e.target.value)} placeholder="e.g., shoulder abduction at 90°" />
        </label>

        <div className="rounded-lg border bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-gray-700">MMT (0–5)</div>
            <label className="text-xs text-gray-600 flex items-center gap-2">
              <input type="checkbox" checked={hasMmt} onChange={() => setHasMmt((v) => !v)} />
              record MMT
            </label>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <input type="range" min={0} max={5} value={mmt} onChange={(e) => setMmt(Number(e.target.value) as any)} className="flex-1" disabled={!hasMmt} />
            <span className="text-sm font-mono font-semibold w-12 text-right">{hasMmt ? mmt : '—'}</span>
          </div>
          <div className="mt-1 text-[11px] text-gray-500">Use 5 = normal strength; 3 = full ROM against gravity.</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <label className="text-xs text-gray-700 flex items-center gap-2">
            <input type="checkbox" checked={painWithResistance} onChange={() => setPainWithResistance((v) => !v)} />
            Pain with resistance
          </label>
          <label className="text-xs text-gray-700 flex items-center gap-2">
            <input type="checkbox" checked={inhibition} onChange={() => setInhibition((v) => !v)} />
            Inhibition / guarding
          </label>
        </div>

        <label className="text-xs text-gray-600">
          Note
          <textarea className="mt-1 w-full rounded border px-2 py-1.5 text-sm" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <button
          className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
          onClick={() => {
            onCreate({
              muscleGroup,
              test,
              mmt0to5: hasMmt ? mmt : undefined,
              painWithResistance,
              inhibition,
              note,
            });
            setNote('');
          }}
          type="button"
        >
          Save strength finding
        </button>
      </div>
    </div>
  );
}

function SpecialTestComposer({
  region,
  onCreate,
}: {
  region: RegionDef;
  onCreate: (t: { testName: string; result: SpecialTestResult; note?: string }) => void;
}) {
  // ✅ Fix: customName and note are separate states (no collision)
  const list = useMemo(() => (region.specialTests?.length ? region.specialTests : ['Test A', 'Test B', 'Test C']), [region.specialTests]);

  const [selected, setSelected] = useState<string>(list[0] ?? 'Test');
  const [customName, setCustomName] = useState<string>('');
  const [result, setResult] = useState<SpecialTestResult>('negative');
  const [note, setNote] = useState<string>('');

  useEffect(() => {
    const nextList = region.specialTests?.length ? region.specialTests : ['Test A', 'Test B'];
    setSelected(nextList[0] ?? 'Test');
    setCustomName('');
    setResult('negative');
    setNote('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region.id]);

  const isCustom = selected === '__custom__';
  const resolvedName = (isCustom ? customName : selected).trim();

  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-gray-800">Special Tests</div>
          <div className="text-[11px] text-gray-500">{region.label} · quick positives/negatives</div>
        </div>
        <span className="text-[11px] rounded-full border bg-gray-50 px-2 py-0.5 text-gray-700">structured</span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <label className="text-xs text-gray-600">
          Test
          <select className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={selected} onChange={(e) => setSelected(e.target.value)}>
            {list.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            <option value="__custom__">Custom…</option>
          </select>
        </label>

        {isCustom ? (
          <label className="text-xs text-gray-600">
            Custom test name
            <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Type test name here…" />
          </label>
        ) : null}

        <label className="text-xs text-gray-600">
          Result
          <select className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={result} onChange={(e) => setResult(e.target.value as SpecialTestResult)}>
            {(['negative', 'positive', 'inconclusive'] as SpecialTestResult[]).map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-gray-600">
          Note
          <textarea className="mt-1 w-full rounded border px-2 py-1.5 text-sm" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional… (symptoms reproduced, side, etc.)" />
        </label>

        <button
          className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
          onClick={() => {
            if (!resolvedName) return;
            onCreate({ testName: resolvedName, result, note: note.trim() ? note.trim() : undefined });
            setNote('');
            if (isCustom) setCustomName('');
          }}
          type="button"
        >
          Save test finding
        </button>
      </div>
    </div>
  );
}
