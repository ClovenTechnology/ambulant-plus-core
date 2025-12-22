// apps/clinician-app/app/workspaces/physio/panels/FindingsPanel.tsx
'use client';

import React, { useMemo, useState } from 'react';
import type { Finding, PhysioMeta, SpecialTestResult } from '../physioModel';
import { fmtDate } from '../physioModel';

export default function FindingsPanel(props: {
  regionLabel: string;
  findings: Finding[];

  onPatchFinding: (id: string, patch: Partial<Finding>) => void;
  onPatchMeta: (id: string, meta: PhysioMeta) => void;

  onToggleFinal: (id: string) => void;
  onToggleResolved: (id: string) => void;

  onDeleteWithUndo: (id: string) => void;

  undoVisible: boolean;
  undoText: string;
  onUndo: () => void;
}) {
  const { findings, regionLabel } = props;

  return (
    <div className="relative">
      <div className="rounded-xl border bg-white p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-gray-800">Findings</div>
            <div className="text-[11px] text-gray-500">
              For {regionLabel} · {findings.length} item(s)
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {findings.length === 0 ? (
            <div className="text-sm text-gray-600 italic">No findings yet for this region.</div>
          ) : (
            findings.map((f) => (
              <FindingCard
                key={f.id}
                finding={f}
                onPatchFinding={props.onPatchFinding}
                onPatchMeta={props.onPatchMeta}
                onToggleFinal={props.onToggleFinal}
                onToggleResolved={props.onToggleResolved}
                onDeleteWithUndo={props.onDeleteWithUndo}
              />
            ))
          )}
        </div>
      </div>

      <UndoSnackbar visible={props.undoVisible} text={props.undoText} onUndo={props.onUndo} />
    </div>
  );
}

function FindingCard(props: {
  finding: Finding;
  onPatchFinding: (id: string, patch: Partial<Finding>) => void;
  onPatchMeta: (id: string, meta: PhysioMeta) => void;
  onToggleFinal: (id: string) => void;
  onToggleResolved: (id: string) => void;
  onDeleteWithUndo: (id: string) => void;
}) {
  const { finding: f } = props;
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-gray-900 truncate">{f.title}</div>
            <span
              className={
                'text-[10px] rounded-full border px-2 py-0.5 ' +
                (f.status === 'final' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-gray-50 text-gray-700')
              }
            >
              {f.status.toUpperCase()}
            </span>
            <span
              className={
                'text-[10px] rounded-full border px-2 py-0.5 ' +
                (f.resolution === 'resolved' ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-amber-200 bg-amber-50 text-amber-800')
              }
            >
              {f.resolution}
            </span>
            {f.severity ? (
              <span className="text-[10px] rounded-full border bg-white px-2 py-0.5 text-gray-700">{f.severity}</span>
            ) : null}
          </div>

          <div className="mt-1 text-[11px] text-gray-500">
            {fmtDate(f.createdAt)} · evidence: {f.evidence.length}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1">
          <button className="text-[11px] px-2 py-1 rounded border bg-white hover:bg-gray-50" onClick={() => setEditing((v) => !v)} type="button">
            {editing ? 'Close' : 'Edit'}
          </button>
          <button className="text-[11px] px-2 py-1 rounded border bg-white hover:bg-gray-50" onClick={() => props.onToggleFinal(f.id)} title="Toggle draft/final" type="button">
            {f.status === 'final' ? 'Unfinal' : 'Final'}
          </button>
          <button className="text-[11px] px-2 py-1 rounded border bg-white hover:bg-gray-50" onClick={() => props.onToggleResolved(f.id)} title="Toggle open/resolved" type="button">
            {f.resolution === 'resolved' ? 'Reopen' : 'Resolve'}
          </button>
          <button className="text-[11px] px-2 py-1 rounded border bg-white hover:bg-gray-50 text-rose-700" onClick={() => props.onDeleteWithUndo(f.id)} title="Delete" type="button">
            Del
          </button>
        </div>
      </div>

      <FindingMetaSummary meta={f.meta} />

      {f.note ? <div className="mt-2 text-sm text-gray-700">{f.note}</div> : null}

      <div className="mt-2 flex flex-wrap gap-1">
        {(f.tags ?? []).slice(0, 4).map((t) => (
          <span key={t} className="text-[10px] rounded-full border bg-gray-50 px-2 py-0.5 text-gray-700">
            {t}
          </span>
        ))}
      </div>

      <div className="mt-2 text-[11px] text-gray-500">
        Location: <span className="font-mono">{f.location.regionId}</span> · view: {f.location.view}
      </div>

      {editing ? <InlineEditor finding={f} onPatchFinding={props.onPatchFinding} onPatchMeta={props.onPatchMeta} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}

function InlineEditor(props: {
  finding: Finding;
  onPatchFinding: (id: string, patch: Partial<Finding>) => void;
  onPatchMeta: (id: string, meta: PhysioMeta) => void;
  onClose: () => void;
}) {
  const f = props.finding;

  const [title, setTitle] = useState(f.title);
  const [note, setNote] = useState(f.note ?? '');

  // type-aware meta editors
  const metaEditor = useMemo(() => {
    const meta = f.meta;

    if (meta.findingType === 'pain') {
      const [score, setScore] = useState<number>(typeof meta.painScore0to10 === 'number' ? meta.painScore0to10 : 0);
      const [hasScore, setHasScore] = useState<boolean>(typeof meta.painScore0to10 === 'number');
      return (
        <div className="rounded-lg border bg-gray-50 p-3">
          <div className="text-xs font-semibold text-gray-700">Pain (edit)</div>
          <div className="mt-2 flex items-center justify-between">
            <label className="text-xs text-gray-600 flex items-center gap-2">
              <input type="checkbox" checked={hasScore} onChange={() => setHasScore((v) => !v)} />
              record score
            </label>
            <span className="text-xs text-gray-500">0–10</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <input type="range" min={0} max={10} value={score} onChange={(e) => setScore(Number(e.target.value))} className="flex-1" disabled={!hasScore} />
            <span className="text-sm font-mono font-semibold w-12 text-right">{hasScore ? score : '—'}</span>
          </div>

          <button
            className="mt-2 text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
            onClick={() => {
              props.onPatchMeta(f.id, { ...meta, painScore0to10: hasScore ? score : undefined });
            }}
            type="button"
          >
            Apply pain edit
          </button>
        </div>
      );
    }

    if (meta.findingType === 'rom') {
      const [active, setActive] = useState<string>(typeof meta.activeDeg === 'number' ? String(meta.activeDeg) : '');
      const [passive, setPassive] = useState<string>(typeof meta.passiveDeg === 'number' ? String(meta.passiveDeg) : '');
      const [wnl, setWnl] = useState<boolean>(!!meta.wnl);
      return (
        <div className="rounded-lg border bg-gray-50 p-3">
          <div className="text-xs font-semibold text-gray-700">ROM (edit)</div>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
            <label className="text-xs text-gray-600 md:col-span-2">
              Active (°)
              <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={active} onChange={(e) => setActive(e.target.value)} disabled={wnl} inputMode="numeric" />
            </label>
            <label className="text-xs text-gray-600 md:col-span-1 flex items-center gap-2 mt-6 md:mt-0">
              <input type="checkbox" checked={wnl} onChange={() => setWnl((v) => !v)} />
              WNL
            </label>
            <label className="text-xs text-gray-600 md:col-span-2">
              Passive (°)
              <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={passive} onChange={(e) => setPassive(e.target.value)} disabled={wnl} inputMode="numeric" />
            </label>
          </div>

          <button
            className="mt-2 text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
            onClick={() => {
              const a = wnl ? null : Number.isFinite(Number(active)) ? Number(active) : null;
              const p = wnl ? null : Number.isFinite(Number(passive)) ? Number(passive) : null;
              props.onPatchMeta(f.id, { ...meta, wnl, activeDeg: a, passiveDeg: p });
            }}
            type="button"
          >
            Apply ROM edit
          </button>
        </div>
      );
    }

    if (meta.findingType === 'strength') {
      const [mmt, setMmt] = useState<number>(typeof meta.mmt0to5 === 'number' ? meta.mmt0to5 : 0);
      const [has, setHas] = useState<boolean>(typeof meta.mmt0to5 === 'number');
      return (
        <div className="rounded-lg border bg-gray-50 p-3">
          <div className="text-xs font-semibold text-gray-700">Strength (edit)</div>
          <div className="mt-2 flex items-center justify-between">
            <label className="text-xs text-gray-600 flex items-center gap-2">
              <input type="checkbox" checked={has} onChange={() => setHas((v) => !v)} />
              record MMT
            </label>
            <span className="text-xs text-gray-500">0–5</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <input type="range" min={0} max={5} value={mmt} onChange={(e) => setMmt(Number(e.target.value))} className="flex-1" disabled={!has} />
            <span className="text-sm font-mono font-semibold w-12 text-right">{has ? mmt : '—'}</span>
          </div>

          <button
            className="mt-2 text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
            onClick={() => {
              const v = has ? (Math.max(0, Math.min(5, Math.round(mmt))) as 0 | 1 | 2 | 3 | 4 | 5) : undefined;
              props.onPatchMeta(f.id, { ...meta, mmt0to5: v });
            }}
            type="button"
          >
            Apply strength edit
          </button>
        </div>
      );
    }

    if (meta.findingType === 'special_test') {
      const [res, setRes] = useState<SpecialTestResult>(meta.result);
      return (
        <div className="rounded-lg border bg-gray-50 p-3">
          <div className="text-xs font-semibold text-gray-700">Special Test (edit)</div>
          <div className="mt-2 grid grid-cols-1 gap-2">
            <label className="text-xs text-gray-600">
              Result
              <select className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={res} onChange={(e) => setRes(e.target.value as SpecialTestResult)}>
                {(['negative', 'positive', 'inconclusive'] as SpecialTestResult[]).map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            className="mt-2 text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
            onClick={() => props.onPatchMeta(f.id, { ...meta, result: res })}
            type="button"
          >
            Apply test edit
          </button>
        </div>
      );
    }

    return (
      <div className="rounded-lg border bg-gray-50 p-3">
        <div className="text-xs font-semibold text-gray-700">Other (edit)</div>
        <div className="text-[11px] text-gray-500 mt-1">No structured editor for this type yet.</div>
      </div>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.id]); // keep stable per item instance

  return (
    <div className="mt-3 rounded-xl border bg-white p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-gray-800">Inline edit</div>
        <button className="text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50" onClick={props.onClose} type="button">
          Close
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <label className="text-xs text-gray-600">
          Title
          <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <label className="text-xs text-gray-600">
          Note
          <textarea className="mt-1 w-full rounded border px-2 py-1.5 text-sm" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <button
          className="rounded border bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-sm text-blue-800"
          onClick={() => {
            props.onPatchFinding(f.id, { title: title.trim() || f.title, note: note.trim() ? note.trim() : undefined });
            props.onClose();
          }}
          type="button"
        >
          Save text edits
        </button>

        {metaEditor}
      </div>
    </div>
  );
}

function FindingMetaSummary({ meta }: { meta: PhysioMeta }) {
  if (meta.findingType === 'pain') {
    return (
      <div className="mt-2 text-sm text-gray-800">
        Pain:{' '}
        <span className="font-mono font-semibold">{typeof meta.painScore0to10 === 'number' ? meta.painScore0to10 : '—'}</span>
        /10
        {meta.quality ? ` · ${meta.quality}` : ''}
        {meta.irritability ? ` · irritability: ${meta.irritability}` : ''}
        {meta.pattern24h ? ` · pattern: ${meta.pattern24h.replace(/_/g, ' ')}` : ''}
      </div>
    );
  }
  if (meta.findingType === 'rom') {
    const a = typeof meta.activeDeg === 'number' ? `${Math.round(meta.activeDeg)}°` : meta.wnl ? 'WNL' : '—';
    const p = typeof meta.passiveDeg === 'number' ? `${Math.round(meta.passiveDeg)}°` : meta.wnl ? 'WNL' : '—';
    return (
      <div className="mt-2 text-sm text-gray-800">
        ROM: <span className="font-medium">{meta.joint ?? '—'}</span>
        {meta.movement ? ` · ${meta.movement}` : ''}
        {' · '}
        A: <span className="font-mono font-semibold">{a}</span> · P: <span className="font-mono font-semibold">{p}</span>
        {meta.endFeel ? ` · end-feel: ${meta.endFeel}` : ''}
        {meta.painfulArc ? ' · painful arc' : ''}
        {meta.painAtEndRange ? ' · pain end-range' : ''}
        {meta.comparableSign ? ' · comparable sign' : ''}
      </div>
    );
  }
  if (meta.findingType === 'strength') {
    return (
      <div className="mt-2 text-sm text-gray-800">
        Strength: <span className="font-medium">{meta.muscleGroup ?? '—'}</span>
        {typeof meta.mmt0to5 === 'number' ? (
          <>
            {' '}
            · MMT: <span className="font-mono font-semibold">{meta.mmt0to5}</span>/5
          </>
        ) : null}
        {meta.painWithResistance ? ' · pain with resistance' : ''}
        {meta.inhibition ? ' · inhibition/guarding' : ''}
      </div>
    );
  }
  if (meta.findingType === 'special_test') {
    return (
      <div className="mt-2 text-sm text-gray-800">
        Test: <span className="font-medium">{meta.testName}</span> · <span className="font-semibold">{meta.result}</span>
      </div>
    );
  }
  return (
    <div className="mt-2 text-sm text-gray-800">
      Other: <span className="font-medium">{meta.kind ?? '—'}</span>
    </div>
  );
}

function UndoSnackbar(props: { visible: boolean; text: string; onUndo: () => void }) {
  if (!props.visible) return null;
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50">
      <div className="rounded-xl border bg-white shadow-lg px-4 py-3 flex items-center gap-3">
        <div className="text-sm text-gray-800">{props.text}</div>
        <button className="text-sm font-semibold text-blue-700 hover:text-blue-900" onClick={props.onUndo} type="button">
          Undo
        </button>
      </div>
    </div>
  );
}
