/*
File: apps/clinician-app/app/workspaces/physio/page.tsx
Purpose: Phase 1 “world-class” standalone Physio workspace (NOT integrated with SFU yet).

What’s included (refactored, single-file page implementation):
- Uses new BodyMapPanel (modern 3D, rotatable drag) from ./_components/BodyMapPanel
- Fixes SpecialTestComposer (no shared state collision between testName and note)
- Findings list with inline edit + Undo delete (6s)
- Progress charts with goal target lines + baseline deltas (pain + ROM active)
- No (meta as any): all meta reads use discriminated unions + guards
- Still uses local state + localStorage persistence with basic validation

Note:
- This page assumes you already saved:
  - ./_components/types.ts (exports REGIONS + types)
  - ./_components/guards.ts (type guards)
  - ./_components/BodyMapPanel.tsx (which uses BodyMap3D)
*/

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

import BodyMapPanel from './_components/BodyMapPanel';

import type { BodyView, EvidenceRef, Finding, Goal, PhysioMeta, RegionDef } from './_components/types';
import { REGIONS } from './_components/types';
import { isPainMeta, isRomMeta, isSpecialTestMeta, isStrengthMeta, safeNum } from './_components/guards';

type PhysioWorkspaceProps = {
  patientId?: string;
  encounterId?: string;
  clinicianId?: string;
};

/* --------------------
   small helpers
-------------------- */
function nowISO() {
  return new Date().toISOString();
}

function uid(prefix: string) {
  const r = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + '';
  return `${prefix}_${r}`;
}

function severityFromPain(p?: number | null) {
  if (typeof p !== 'number') return undefined;
  if (p >= 7) return 'severe' as const;
  if (p >= 4) return 'moderate' as const;
  if (p >= 1) return 'mild' as const;
  return undefined;
}

function pickRegion(regionId: string): RegionDef {
  return REGIONS.find((r) => r.id === regionId) ?? REGIONS[0];
}

function getPainScore(meta: PhysioMeta): number | undefined {
  if (!isPainMeta(meta)) return undefined;
  return safeNum(meta.painScore0to10);
}

function getRomActive(meta: PhysioMeta): number | undefined {
  if (!isRomMeta(meta)) return undefined;
  return safeNum(meta.activeDeg);
}

/* --------------------
   persistence validation (lightweight)
-------------------- */
function isBodyView(v: unknown): v is BodyView {
  return v === 'front' || v === 'back' || v === 'left' || v === 'right';
}

function coerceEvidence(x: any): EvidenceRef | null {
  if (!x || typeof x !== 'object') return null;
  if (x.kind !== 'video_clip') return null;
  if (typeof x.url !== 'string') return null;
  const startTs = typeof x.startTs === 'number' ? x.startTs : Date.now();
  const endTs = typeof x.endTs === 'number' ? x.endTs : startTs + 5000;
  return {
    kind: 'video_clip',
    device: x.device === 'camera' || x.device === 'upload' || x.device === 'other' ? x.device : 'other',
    startTs,
    endTs,
    url: x.url,
    thumbnailUrl: typeof x.thumbnailUrl === 'string' ? x.thumbnailUrl : undefined,
    status: x.status === 'ready' || x.status === 'processing' || x.status === 'failed' ? x.status : undefined,
    jobId: typeof x.jobId === 'string' ? x.jobId : undefined,
    label: typeof x.label === 'string' ? x.label : undefined,
    tags: Array.isArray(x.tags) ? x.tags.filter((t: any) => typeof t === 'string').slice(0, 12) : undefined,
  };
}

function coerceMeta(x: any): PhysioMeta | null {
  if (!x || typeof x !== 'object' || typeof x.findingType !== 'string') return null;

  if (x.findingType === 'pain') {
    return {
      findingType: 'pain',
      painScore0to10: safeNum(x.painScore0to10),
      quality: typeof x.quality === 'string' ? x.quality : undefined,
      irritability: typeof x.irritability === 'string' ? x.irritability : undefined,
      pattern24h: typeof x.pattern24h === 'string' ? x.pattern24h : undefined,
      aggravators: typeof x.aggravators === 'string' ? x.aggravators : undefined,
      relievers: typeof x.relievers === 'string' ? x.relievers : undefined,
      distribution: typeof x.distribution === 'string' ? x.distribution : undefined,
    };
  }

  if (x.findingType === 'rom') {
    return {
      findingType: 'rom',
      joint: typeof x.joint === 'string' ? x.joint : undefined,
      movement: typeof x.movement === 'string' ? x.movement : undefined,
      activeDeg: typeof x.activeDeg === 'number' ? x.activeDeg : null,
      passiveDeg: typeof x.passiveDeg === 'number' ? x.passiveDeg : null,
      wnl: typeof x.wnl === 'boolean' ? x.wnl : undefined,
      endFeel: typeof x.endFeel === 'string' ? x.endFeel : undefined,
      painfulArc: typeof x.painfulArc === 'boolean' ? x.painfulArc : undefined,
      painAtEndRange: typeof x.painAtEndRange === 'boolean' ? x.painAtEndRange : undefined,
      comparableSign: typeof x.comparableSign === 'boolean' ? x.comparableSign : undefined,
    };
  }

  if (x.findingType === 'strength') {
    return {
      findingType: 'strength',
      muscleGroup: typeof x.muscleGroup === 'string' ? x.muscleGroup : undefined,
      test: typeof x.test === 'string' ? x.test : undefined,
      mmt0to5: [0, 1, 2, 3, 4, 5].includes(x.mmt0to5) ? x.mmt0to5 : undefined,
      painWithResistance: typeof x.painWithResistance === 'boolean' ? x.painWithResistance : undefined,
      inhibition: typeof x.inhibition === 'boolean' ? x.inhibition : undefined,
    };
  }

  if (x.findingType === 'special_test') {
    if (typeof x.testName !== 'string') return null;
    if (x.result !== 'positive' && x.result !== 'negative' && x.result !== 'inconclusive') return null;
    return { findingType: 'special_test', testName: x.testName, result: x.result };
  }

  if (x.findingType === 'other') {
    return { findingType: 'other', kind: typeof x.kind === 'string' ? x.kind : undefined };
  }

  return null;
}

function coerceFinding(x: any): Finding | null {
  if (!x || typeof x !== 'object') return null;
  if (typeof x.id !== 'string') return null;
  if (typeof x.patientId !== 'string') return null;
  if (typeof x.encounterId !== 'string') return null;
  if (x.specialty !== 'physio') return null;
  if (x.status !== 'draft' && x.status !== 'final') return null;
  if (x.resolution !== 'open' && x.resolution !== 'resolved') return null;
  if (typeof x.title !== 'string') return null;
  if (!x.location || typeof x.location !== 'object') return null;
  if (x.location.kind !== 'physio_body') return null;
  if (typeof x.location.regionId !== 'string') return null;
  if (!isBodyView(x.location.view)) return null;

  const meta = coerceMeta(x.meta);
  if (!meta) return null;

  const evidence = Array.isArray(x.evidence) ? x.evidence.map(coerceEvidence).filter(Boolean) : [];

  return {
    id: x.id,
    patientId: x.patientId,
    encounterId: x.encounterId,
    specialty: 'physio',
    status: x.status,
    resolution: x.resolution,
    title: x.title,
    note: typeof x.note === 'string' ? x.note : undefined,
    severity: x.severity === 'mild' || x.severity === 'moderate' || x.severity === 'severe' ? x.severity : undefined,
    tags: Array.isArray(x.tags) ? x.tags.filter((t: any) => typeof t === 'string').slice(0, 12) : undefined,
    location: {
      kind: 'physio_body',
      regionId: x.location.regionId,
      side: x.location.side === 'L' || x.location.side === 'R' || x.location.side === 'midline' ? x.location.side : undefined,
      view: x.location.view,
    },
    evidence: evidence as EvidenceRef[],
    meta,
    createdAt: typeof x.createdAt === 'string' ? x.createdAt : nowISO(),
    updatedAt: typeof x.updatedAt === 'string' ? x.updatedAt : nowISO(),
    createdBy: typeof x.createdBy === 'string' ? x.createdBy : 'clin_demo_001',
  };
}

function coerceGoal(x: any): Goal | null {
  if (!x || typeof x !== 'object') return null;
  if (typeof x.id !== 'string') return null;
  if (typeof x.regionId !== 'string') return null;
  if (typeof x.title !== 'string') return null;
  if (x.metric !== 'pain' && x.metric !== 'rom_active') return null;
  if (x.direction !== 'lte' && x.direction !== 'gte') return null;
  if (typeof x.target !== 'number') return null;
  return {
    id: x.id,
    regionId: x.regionId,
    title: x.title,
    metric: x.metric,
    direction: x.direction,
    target: x.target,
    createdAt: typeof x.createdAt === 'string' ? x.createdAt : nowISO(),
    done: typeof x.done === 'boolean' ? x.done : undefined,
  };
}

/* --------------------
   Mock clip capture (still Phase 1 standalone)
-------------------- */
function mockMovementClip(label: string): EvidenceRef {
  const t = Date.now();
  return {
    kind: 'video_clip',
    device: 'camera',
    startTs: t - 4000,
    endTs: t + 9000,
    url: 'https://example.invalid/movement.mp4',
    thumbnailUrl: `https://placehold.co/320x200?text=${encodeURIComponent(label)}`,
    status: 'processing',
    jobId: uid('job'),
    label,
    tags: ['movement'],
  };
}

/* --------------------
   Page
-------------------- */
export default function PhysioWorkspacePage(props: PhysioWorkspaceProps) {
  const patientId = props.patientId ?? 'pat_demo_001';
  const encounterId = props.encounterId ?? 'enc_demo_001';
  const clinicianId = props.clinicianId ?? 'clin_demo_001';

  const storageKey = useMemo(() => `physio-ws-v2:${patientId}:${encounterId}`, [patientId, encounterId]);

  const [view, setView] = useState<BodyView>('front');
  const [regionId, setRegionId] = useState<string>('left_shoulder');

  const didLoadRef = useRef(false);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  // Undo delete state
  const undoTimerRef = useRef<number | null>(null);
  const [undoState, setUndoState] = useState<{ visible: boolean; finding: Finding | null; text: string }>({
    visible: false,
    finding: null,
    text: '',
  });

  // load persisted (validated)
  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;

      const parsed = JSON.parse(raw) as any;

      if (Array.isArray(parsed?.findings)) {
        const safe = parsed.findings.map(coerceFinding).filter(Boolean) as Finding[];
        setFindings(safe);
      }
      if (Array.isArray(parsed?.goals)) {
        const safe = parsed.goals.map(coerceGoal).filter(Boolean) as Goal[];
        setGoals(safe);
      }
      if (isBodyView(parsed?.view)) setView(parsed.view);
      if (typeof parsed?.regionId === 'string') setRegionId(parsed.regionId);
    } catch {
      // ignore
    }
  }, [storageKey]);

  // persist
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ findings, goals, view, regionId }));
    } catch {
      // ignore
    }
  }, [storageKey, findings, goals, view, regionId]);

  const region: RegionDef = useMemo(() => pickRegion(regionId), [regionId]);

  const findingsForRegion = useMemo(() => {
    return findings
      .filter((f) => f.location.regionId === regionId)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [findings, regionId]);

  const regionCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of findings) m.set(f.location.regionId, (m.get(f.location.regionId) ?? 0) + 1);
    return m;
  }, [findings]);

  const evidenceForRegion = useMemo(() => {
    const items: EvidenceRef[] = [];
    for (const f of findingsForRegion) items.push(...(Array.isArray(f.evidence) ? f.evidence : []));
    return items.sort((a, b) => (b.startTs ?? 0) - (a.startTs ?? 0));
  }, [findingsForRegion]);

  const latestPainForRegion = useMemo(() => {
    const pain = findings
      .filter((f) => f.location.regionId === regionId)
      .map((f) => ({ at: f.updatedAt, score: getPainScore(f.meta) }))
      .filter((x) => typeof x.score === 'number')
      .sort((a, b) => (a.at < b.at ? 1 : -1));
    return pain[0]?.score;
  }, [findings, regionId]);

  const latestPainByRegion = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of REGIONS) {
      const latest = findings
        .filter((f) => f.location.regionId === r.id)
        .map((f) => ({ at: f.updatedAt, score: getPainScore(f.meta) }))
        .filter((x) => typeof x.score === 'number')
        .sort((a, b) => (a.at < b.at ? 1 : -1))[0]?.score;

      if (typeof latest === 'number') m.set(r.id, latest);
    }
    return m;
  }, [findings]);

  const latestRomActiveForRegion = useMemo(() => {
    const rom = findings
      .filter((f) => f.location.regionId === regionId)
      .map((f) => ({ at: f.updatedAt, v: getRomActive(f.meta) }))
      .filter((x) => typeof x.v === 'number')
      .sort((a, b) => (a.at < b.at ? 1 : -1));
    return rom[0]?.v;
  }, [findings, regionId]);

  // Progress demo seed + merge real findings (pain + ROM active)
  type ProgressPoint = { encounterId: string; at: string; painScore?: number; romActiveDeg?: number };
  const progress: ProgressPoint[] = useMemo(() => {
    const base: ProgressPoint[] = [
      {
        encounterId: 'enc_prev_001',
        at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
        painScore: 7,
        romActiveDeg: regionId.includes('shoulder') ? 95 : regionId.includes('knee') ? 110 : undefined,
      },
      {
        encounterId: 'enc_prev_002',
        at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
        painScore: 5,
        romActiveDeg: regionId.includes('shoulder') ? 120 : regionId.includes('knee') ? 125 : undefined,
      },
    ];

    const painFindings = findings
      .filter((f) => f.location.regionId === regionId)
      .map((f) => ({ f, score: getPainScore(f.meta) }))
      .filter((x) => typeof x.score === 'number')
      .map((x) => ({ at: x.f.createdAt, score: x.score as number }))
      .sort((a, b) => (a.at < b.at ? -1 : 1));

    const romFindings = findings
      .filter((f) => f.location.regionId === regionId)
      .map((f) => ({ f, v: getRomActive(f.meta) }))
      .filter((x) => typeof x.v === 'number')
      .map((x) => ({ at: x.f.createdAt, v: x.v as number }))
      .sort((a, b) => (a.at < b.at ? -1 : 1));

    const lastPain = painFindings.length ? painFindings[painFindings.length - 1] : undefined;
    const lastRom = romFindings.length ? romFindings[romFindings.length - 1] : undefined;

    if (lastPain || lastRom) {
      base.push({
        encounterId,
        at: lastPain?.at ?? lastRom!.at,
        painScore: lastPain?.score,
        romActiveDeg: lastRom?.v,
      });
    }

    return base.sort((a, b) => (a.at < b.at ? -1 : 1));
  }, [findings, regionId, encounterId]);

  // Goals status
  const goalsForRegion = useMemo(() => goals.filter((g) => g.regionId === regionId), [goals, regionId]);

  const computedGoals = useMemo(() => {
    const pain = latestPainForRegion;
    const rom = latestRomActiveForRegion;

    return goalsForRegion.map((g) => {
      if (g.done) return { ...g, _status: 'done' as const };
      const cur = g.metric === 'pain' ? pain : rom;
      if (typeof cur !== 'number') return { ...g, _status: 'no-data' as const };
      const ok = g.direction === 'lte' ? cur <= g.target : cur >= g.target;
      return { ...g, _status: ok ? ('on-track' as const) : ('off-track' as const), _current: cur };
    });
  }, [goalsForRegion, latestPainForRegion, latestRomActiveForRegion]);

  // Common location builder
  const makeLoc = () => ({
    kind: 'physio_body' as const,
    regionId,
    side: region.side,
    view,
  });

  // Create finding helpers
  const addFinding = (partial: Omit<Finding, 'id' | 'createdAt' | 'updatedAt'>) => {
    const f: Finding = { ...partial, id: uid('fd'), createdAt: nowISO(), updatedAt: nowISO() };
    setFindings((prev) => [f, ...prev]);
  };

  const updateFinding = (id: string, patch: Partial<Finding>) => {
    setFindings((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch, updatedAt: nowISO() } : f)));
  };

  const updateMeta = (id: string, meta: PhysioMeta) => {
    setFindings((prev) => prev.map((f) => (f.id === id ? { ...f, meta, updatedAt: nowISO() } : f)));
  };

  // Delete with undo (6s)
  const deleteWithUndo = (id: string) => {
    const victim = findings.find((x) => x.id === id);
    if (!victim) return;

    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);

    setFindings((prev) => prev.filter((f) => f.id !== id));
    setUndoState({ visible: true, finding: victim, text: `Deleted “${victim.title}”.` });

    undoTimerRef.current = window.setTimeout(() => {
      setUndoState({ visible: false, finding: null, text: '' });
      undoTimerRef.current = null;
    }, 6000);
  };

  const undoDelete = () => {
    if (!undoState.finding) return;
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    setFindings((prev) => [undoState.finding!, ...prev]);
    setUndoState({ visible: false, finding: null, text: '' });
    undoTimerRef.current = null;
  };

  const bookmarkMovement = (note?: string) => {
    const clip = mockMovementClip(`${region.label} (${view})`);
    addFinding({
      patientId,
      encounterId,
      specialty: 'physio',
      status: 'draft',
      resolution: 'open',
      title: 'Movement clip',
      note: note?.trim() ? note.trim() : undefined,
      severity: undefined,
      tags: ['physio', 'movement'],
      location: makeLoc(),
      evidence: [clip],
      meta: { findingType: 'other', kind: 'movement_clip' },
      createdBy: clinicianId,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm text-gray-500">Ambulant+ Workspace</div>
            <h1 className="text-lg font-semibold">Physio Workspace</h1>
            <div className="mt-1 text-xs text-gray-500">
              Phase 1 (standalone) · Modern 3D map · Structured exam · Inline edit + undo · Goals + baseline deltas
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border bg-white px-2 py-1 text-gray-700">
              Patient: <span className="font-mono">{patientId}</span>
            </span>
            <span className="rounded-full border bg-white px-2 py-1 text-gray-700">
              Encounter: <span className="font-mono">{encounterId}</span>
            </span>
            <span className="rounded-full border bg-white px-2 py-1 text-gray-700">
              Region: <span className="font-semibold">{region.label}</span>
            </span>
            {typeof latestPainForRegion === 'number' ? (
              <span className="rounded-full border bg-rose-50 border-rose-200 px-2 py-1 text-rose-800">
                Latest pain: <span className="font-mono font-semibold">{latestPainForRegion}</span>/10
              </span>
            ) : (
              <span className="rounded-full border bg-gray-50 px-2 py-1 text-gray-600">No pain score yet</span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.6fr_1.2fr] gap-4">
          {/* LEFT: Body map (3D) */}
          <BodyMapPanel
            view={view}
            onChangeView={setView}
            regions={REGIONS}
            regionId={regionId}
            onChangeRegion={setRegionId}
            counts={regionCounts}
            latestPainByRegion={latestPainByRegion}
            evidenceCount={evidenceForRegion.length}
          />

          {/* CENTER: Capture + Evidence */}
          <section className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Capture</div>
                <div className="text-xs text-gray-500">Standalone mode (SFU integration later)</div>
              </div>
              <BookmarkMovementButton onBookmark={bookmarkMovement} />
            </div>

            <div className="p-4 space-y-4">
              <div className="rounded-xl border bg-gray-100 h-64 grid place-items-center text-gray-600 relative overflow-hidden">
                <div className="text-center px-6">
                  <div className="text-sm font-medium">Patient Video View (placeholder)</div>
                  <div className="text-xs text-gray-500 mt-1">Later: mount SFU remote track here + record/stop → /evidence live_capture</div>
                </div>

                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 rounded-lg border bg-white/85 backdrop-blur px-3 py-2 text-xs">
                  <div className="truncate">
                    Region: <span className="font-semibold">{region.label}</span> · View: {view}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border bg-white px-2 py-0.5 text-gray-700">
                      Pain: <span className="font-mono">{typeof latestPainForRegion === 'number' ? latestPainForRegion : '—'}</span>
                    </span>
                    <span className="rounded-full border bg-white px-2 py-0.5 text-gray-700">
                      ROM A:{' '}
                      <span className="font-mono">
                        {typeof latestRomActiveForRegion === 'number' ? `${Math.round(latestRomActiveForRegion)}°` : '—'}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-700">Evidence for selected region</div>
                <EvidenceStrip evidence={evidenceForRegion} />
              </div>

              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700">Annotations</div>
                <div className="mt-1 text-sm text-gray-700">
                  Phase 1: lightweight markers (stub). Phase 2: draw/angle overlays + time markers on clips.
                </div>
                <button
                  className="mt-2 text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
                  onClick={() => alert('Stub: add annotation')}
                  type="button"
                >
                  + Add annotation
                </button>
              </div>
            </div>
          </section>

          {/* RIGHT: Exam + Findings + Progress */}
          <section className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-4 py-3">
              <div className="text-sm font-semibold">Exam, Findings & Progress</div>
              <div className="text-xs text-gray-500">Structured inputs · Inline edit · Undo delete · Goals + baseline deltas</div>
            </div>

            <div className="p-4 space-y-4">
              <ExamPanel
                region={region}
                onCreatePain={(p) => {
                  addFinding({
                    patientId,
                    encounterId,
                    specialty: 'physio',
                    status: 'draft',
                    resolution: 'open',
                    title: 'Pain',
                    note: p.note?.trim() ? p.note.trim() : undefined,
                    severity: severityFromPain(p.painScore0to10),
                    tags: ['physio', 'pain'],
                    location: makeLoc(),
                    evidence: [],
                    meta: {
                      findingType: 'pain',
                      painScore0to10: p.painScore0to10,
                      quality: p.quality,
                      irritability: p.irritability,
                      pattern24h: p.pattern24h,
                      aggravators: p.aggravators,
                      relievers: p.relievers,
                      distribution: p.distribution,
                    },
                    createdBy: clinicianId,
                  });
                }}
                onCreateRom={(r) => {
                  addFinding({
                    patientId,
                    encounterId,
                    specialty: 'physio',
                    status: 'draft',
                    resolution: 'open',
                    title: 'Range of Motion',
                    note: r.note?.trim() ? r.note.trim() : undefined,
                    severity: undefined,
                    tags: ['physio', 'rom'],
                    location: makeLoc(),
                    evidence: [],
                    meta: {
                      findingType: 'rom',
                      joint: r.joint,
                      movement: r.movement,
                      activeDeg: r.activeDeg,
                      passiveDeg: r.passiveDeg,
                      wnl: r.wnl,
                      endFeel: r.endFeel,
                      painfulArc: r.painfulArc,
                      painAtEndRange: r.painAtEndRange,
                      comparableSign: r.comparableSign,
                    },
                    createdBy: clinicianId,
                  });
                }}
                onCreateStrength={(s) => {
                  addFinding({
                    patientId,
                    encounterId,
                    specialty: 'physio',
                    status: 'draft',
                    resolution: 'open',
                    title: 'Strength',
                    note: s.note?.trim() ? s.note.trim() : undefined,
                    severity: undefined,
                    tags: ['physio', 'strength'],
                    location: makeLoc(),
                    evidence: [],
                    meta: {
                      findingType: 'strength',
                      muscleGroup: s.muscleGroup,
                      test: s.test,
                      mmt0to5: s.mmt0to5,
                      painWithResistance: s.painWithResistance,
                      inhibition: s.inhibition,
                    },
                    createdBy: clinicianId,
                  });
                }}
                onCreateSpecialTest={(t) => {
                  addFinding({
                    patientId,
                    encounterId,
                    specialty: 'physio',
                    status: 'draft',
                    resolution: 'open',
                    title: 'Special Test',
                    note: t.note?.trim() ? t.note.trim() : undefined,
                    severity: undefined,
                    tags: ['physio', 'special-test'],
                    location: makeLoc(),
                    evidence: [],
                    meta: {
                      findingType: 'special_test',
                      testName: t.testName,
                      result: t.result,
                    },
                    createdBy: clinicianId,
                  });
                }}
              />

              <FindingsPanel
                regionLabel={region.label}
                findings={findingsForRegion}
                onPatchFinding={updateFinding}
                onPatchMeta={updateMeta}
                onToggleFinal={(id) => {
                  const f = findings.find((x) => x.id === id);
                  if (!f) return;
                  updateFinding(id, { status: f.status === 'final' ? 'draft' : 'final' });
                }}
                onToggleResolved={(id) => {
                  const f = findings.find((x) => x.id === id);
                  if (!f) return;
                  updateFinding(id, { resolution: f.resolution === 'resolved' ? 'open' : 'resolved' });
                }}
                onDeleteWithUndo={deleteWithUndo}
                undoVisible={undoState.visible}
                undoText={undoState.text}
                onUndo={undoDelete}
              />

              <ProgressPanel
                regionLabel={region.label}
                regionId={regionId}
                points={progress}
                latestPain={latestPainForRegion}
                latestRomActive={latestRomActiveForRegion}
                goals={computedGoals}
                onAddGoal={(g) => setGoals((prev) => [g, ...prev])}
                onMarkGoalDone={(goalId) => setGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, done: true } : g)))}
                onDeleteGoal={(goalId) => setGoals((prev) => prev.filter((g) => g.id !== goalId))}
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

/* =======================================================================================
   Components: ExamPanel, FindingsPanel, ProgressPanel
   (kept here so page.tsx is truly paste-ready without relying on old ./panels/* files)
======================================================================================= */

function Field(props: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="text-xs font-semibold text-gray-700">{props.label}</div>
      {props.hint ? <div className="text-[11px] text-gray-500">{props.hint}</div> : null}
      <div className="mt-1">{props.children}</div>
    </label>
  );
}

function ToggleChip(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={
        'px-3 py-1.5 rounded-full border text-xs ' +
        (props.active ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700')
      }
      onClick={props.onClick}
      aria-pressed={props.active}
    >
      {props.children}
    </button>
  );
}

/* --------------------
   ExamPanel (includes fixed SpecialTestComposer)
-------------------- */
function ExamPanel(props: {
  region: RegionDef;
  onCreatePain: (p: {
    painScore0to10: number;
    quality?: any;
    irritability?: any;
    pattern24h?: any;
    aggravators?: string;
    relievers?: string;
    distribution?: string;
    note?: string;
  }) => void;
  onCreateRom: (r: {
    joint?: string;
    movement?: string;
    activeDeg: number | null;
    passiveDeg: number | null;
    wnl: boolean;
    endFeel?: any;
    painfulArc: boolean;
    painAtEndRange: boolean;
    comparableSign: boolean;
    note?: string;
  }) => void;
  onCreateStrength: (s: {
    muscleGroup?: string;
    test?: string;
    mmt0to5?: 0 | 1 | 2 | 3 | 4 | 5;
    painWithResistance: boolean;
    inhibition: boolean;
    note?: string;
  }) => void;
  onCreateSpecialTest: (t: { testName: string; result: 'positive' | 'negative' | 'inconclusive'; note?: string }) => void;
}) {
  const { region } = props;

  const [tab, setTab] = useState<'pain' | 'rom' | 'strength' | 'special'>('pain');

  // Pain
  const [painScore, setPainScore] = useState(5);
  const [painNote, setPainNote] = useState('');

  // ROM
  const [romJoint, setRomJoint] = useState(region.jointHint ?? '');
  const [romMove, setRomMove] = useState(region.defaultMovementHint ?? '');
  const [romA, setRomA] = useState<number | null>(null);
  const [romP, setRomP] = useState<number | null>(null);
  const [romWnl, setRomWnl] = useState(false);
  const [romPainArc, setRomPainArc] = useState(false);
  const [romPainEnd, setRomPainEnd] = useState(false);
  const [romComp, setRomComp] = useState(false);
  const [romNote, setRomNote] = useState('');

  // Strength
  const [strGroup, setStrGroup] = useState('');
  const [strTest, setStrTest] = useState('');
  const [mmt, setMmt] = useState<0 | 1 | 2 | 3 | 4 | 5>(4);
  const [strPainRes, setStrPainRes] = useState(false);
  const [strInhib, setStrInhib] = useState(false);
  const [strNote, setStrNote] = useState('');

  // Special Test (FIX: separate state for name vs note)
  const tests = region.specialTests ?? [];
  const [testPick, setTestPick] = useState(tests[0] ?? '');
  const [customName, setCustomName] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [testResult, setTestResult] = useState<'positive' | 'negative' | 'inconclusive'>('negative');
  const [testNote, setTestNote] = useState('');

  useEffect(() => {
    // keep joint/movement hints in sync when region changes (without clobbering user edits too aggressively)
    setRomJoint((v) => (v ? v : region.jointHint ?? ''));
    setRomMove((v) => (v ? v : region.defaultMovementHint ?? ''));
    if (tests.length && !testPick) setTestPick(tests[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region.id]);

  return (
    <section className="rounded-xl border bg-white">
      <div className="border-b px-3 py-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-xs text-gray-500">Quick compose</div>
          <div className="text-sm font-semibold text-gray-900">Exam inputs</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ToggleChip active={tab === 'pain'} onClick={() => setTab('pain')}>Pain</ToggleChip>
          <ToggleChip active={tab === 'rom'} onClick={() => setTab('rom')}>ROM</ToggleChip>
          <ToggleChip active={tab === 'strength'} onClick={() => setTab('strength')}>Strength</ToggleChip>
          <ToggleChip active={tab === 'special'} onClick={() => setTab('special')}>Special</ToggleChip>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {tab === 'pain' ? (
          <>
            <Field label="Pain score (0–10)">
              <input
                type="range"
                min={0}
                max={10}
                value={painScore}
                onChange={(e) => setPainScore(parseInt(e.target.value, 10))}
                className="w-full"
              />
              <div className="mt-1 text-xs text-gray-600">
                Score: <span className="font-mono font-semibold">{painScore}</span>/10
              </div>
            </Field>

            <Field label="Note (optional)">
              <textarea
                className="w-full rounded border px-2 py-1.5 text-sm"
                rows={2}
                value={painNote}
                onChange={(e) => setPainNote(e.target.value)}
                placeholder="e.g., pain with overhead reach"
              />
            </Field>

            <div className="flex justify-end">
              <button
                type="button"
                className="rounded border bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-sm"
                onClick={() => {
                  props.onCreatePain({ painScore0to10: painScore, note: painNote });
                  setPainNote('');
                }}
              >
                + Add pain finding
              </button>
            </div>
          </>
        ) : null}

        {tab === 'rom' ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Joint">
                <input className="w-full rounded border px-2 py-1.5 text-sm" value={romJoint} onChange={(e) => setRomJoint(e.target.value)} />
              </Field>
              <Field label="Movement">
                <input className="w-full rounded border px-2 py-1.5 text-sm" value={romMove} onChange={(e) => setRomMove(e.target.value)} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Active (deg)">
                <input
                  className="w-full rounded border px-2 py-1.5 text-sm"
                  type="number"
                  value={romA ?? ''}
                  onChange={(e) => setRomA(e.target.value === '' ? null : parseFloat(e.target.value))}
                />
              </Field>
              <Field label="Passive (deg)">
                <input
                  className="w-full rounded border px-2 py-1.5 text-sm"
                  type="number"
                  value={romP ?? ''}
                  onChange={(e) => setRomP(e.target.value === '' ? null : parseFloat(e.target.value))}
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-2">
              <ToggleChip active={romWnl} onClick={() => setRomWnl((v) => !v)}>WNL</ToggleChip>
              <ToggleChip active={romPainArc} onClick={() => setRomPainArc((v) => !v)}>Painful arc</ToggleChip>
              <ToggleChip active={romPainEnd} onClick={() => setRomPainEnd((v) => !v)}>Pain end-range</ToggleChip>
              <ToggleChip active={romComp} onClick={() => setRomComp((v) => !v)}>Comparable sign</ToggleChip>
            </div>

            <Field label="Note (optional)">
              <textarea className="w-full rounded border px-2 py-1.5 text-sm" rows={2} value={romNote} onChange={(e) => setRomNote(e.target.value)} />
            </Field>

            <div className="flex justify-end">
              <button
                type="button"
                className="rounded border bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-sm"
                onClick={() => {
                  props.onCreateRom({
                    joint: romJoint || undefined,
                    movement: romMove || undefined,
                    activeDeg: romA,
                    passiveDeg: romP,
                    wnl: romWnl,
                    painfulArc: romPainArc,
                    painAtEndRange: romPainEnd,
                    comparableSign: romComp,
                    note: romNote,
                  });
                  setRomNote('');
                }}
              >
                + Add ROM finding
              </button>
            </div>
          </>
        ) : null}

        {tab === 'strength' ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Muscle group">
                <input className="w-full rounded border px-2 py-1.5 text-sm" value={strGroup} onChange={(e) => setStrGroup(e.target.value)} placeholder="e.g., Rotator cuff" />
              </Field>
              <Field label="Test">
                <input className="w-full rounded border px-2 py-1.5 text-sm" value={strTest} onChange={(e) => setStrTest(e.target.value)} placeholder="e.g., ER at 0°" />
              </Field>
            </div>

            <Field label="MMT (0–5)">
              <input type="range" min={0} max={5} value={mmt} onChange={(e) => setMmt(parseInt(e.target.value, 10) as any)} className="w-full" />
              <div className="mt-1 text-xs text-gray-600">
                MMT: <span className="font-mono font-semibold">{mmt}</span>/5
              </div>
            </Field>

            <div className="flex flex-wrap gap-2">
              <ToggleChip active={strPainRes} onClick={() => setStrPainRes((v) => !v)}>Pain w/ resistance</ToggleChip>
              <ToggleChip active={strInhib} onClick={() => setStrInhib((v) => !v)}>Inhibition</ToggleChip>
            </div>

            <Field label="Note (optional)">
              <textarea className="w-full rounded border px-2 py-1.5 text-sm" rows={2} value={strNote} onChange={(e) => setStrNote(e.target.value)} />
            </Field>

            <div className="flex justify-end">
              <button
                type="button"
                className="rounded border bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-sm"
                onClick={() => {
                  props.onCreateStrength({
                    muscleGroup: strGroup || undefined,
                    test: strTest || undefined,
                    mmt0to5: mmt,
                    painWithResistance: strPainRes,
                    inhibition: strInhib,
                    note: strNote,
                  });
                  setStrNote('');
                }}
              >
                + Add strength finding
              </button>
            </div>
          </>
        ) : null}

        {tab === 'special' ? (
          <>
            <div className="rounded-lg border bg-gray-50 p-3">
              <div className="text-xs font-semibold text-gray-700">Pick test</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <ToggleChip active={!useCustom} onClick={() => setUseCustom(false)}>From list</ToggleChip>
                <ToggleChip active={useCustom} onClick={() => setUseCustom(true)}>Custom</ToggleChip>
              </div>

              {!useCustom ? (
                <div className="mt-2">
                  <select className="w-full rounded border px-2 py-1.5 text-sm" value={testPick} onChange={(e) => setTestPick(e.target.value)}>
                    {tests.length ? null : <option value="">No suggested tests for this region</option>}
                    {tests.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="mt-2">
                  <input
                    className="w-full rounded border px-2 py-1.5 text-sm"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Type custom test name…"
                  />
                </div>
              )}
            </div>

            <Field label="Result">
              <div className="flex flex-wrap gap-2">
                <ToggleChip active={testResult === 'negative'} onClick={() => setTestResult('negative')}>Negative</ToggleChip>
                <ToggleChip active={testResult === 'positive'} onClick={() => setTestResult('positive')}>Positive</ToggleChip>
                <ToggleChip active={testResult === 'inconclusive'} onClick={() => setTestResult('inconclusive')}>Inconclusive</ToggleChip>
              </div>
            </Field>

            <Field label="Note (optional)">
              <textarea className="w-full rounded border px-2 py-1.5 text-sm" rows={2} value={testNote} onChange={(e) => setTestNote(e.target.value)} />
            </Field>

            <div className="flex justify-end">
              <button
                type="button"
                className="rounded border bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-sm"
                onClick={() => {
                  const name = (useCustom ? customName : testPick).trim();
                  if (!name) return alert('Pick a test name first.');
                  props.onCreateSpecialTest({ testName: name, result: testResult, note: testNote });
                  setTestNote('');
                }}
              >
                + Add special test
              </button>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

/* --------------------
   FindingsPanel (inline edit + undo delete)
-------------------- */
function FindingsPanel(props: {
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
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <section className="rounded-xl border bg-white">
      <div className="border-b px-3 py-2 flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">Selected region</div>
          <div className="text-sm font-semibold text-gray-900">Findings · {props.regionLabel}</div>
        </div>
        <div className="text-xs text-gray-500">{props.findings.length} item(s)</div>
      </div>

      <div className="p-3 space-y-3">
        {props.undoVisible ? (
          <div className="rounded-lg border bg-amber-50 border-amber-200 px-3 py-2 flex items-center justify-between gap-2">
            <div className="text-sm text-amber-900">{props.undoText}</div>
            <button className="text-sm rounded border bg-white hover:bg-amber-100 px-3 py-1.5" type="button" onClick={props.onUndo}>
              Undo
            </button>
          </div>
        ) : null}

        {props.findings.length === 0 ? (
          <div className="text-sm text-gray-600 italic">No findings yet for this region.</div>
        ) : (
          <div className="space-y-2">
            {props.findings.map((f) => (
              <FindingCard
                key={f.id}
                finding={f}
                editing={editingId === f.id}
                onStartEdit={() => setEditingId(f.id)}
                onStopEdit={() => setEditingId((cur) => (cur === f.id ? null : cur))}
                onPatchFinding={props.onPatchFinding}
                onPatchMeta={props.onPatchMeta}
                onToggleFinal={props.onToggleFinal}
                onToggleResolved={props.onToggleResolved}
                onDeleteWithUndo={props.onDeleteWithUndo}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function FindingCard(props: {
  finding: Finding;
  editing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onPatchFinding: (id: string, patch: Partial<Finding>) => void;
  onPatchMeta: (id: string, meta: PhysioMeta) => void;
  onToggleFinal: (id: string) => void;
  onToggleResolved: (id: string) => void;
  onDeleteWithUndo: (id: string) => void;
}) {
  const f = props.finding;

  const metaSummary = useMemo(() => {
    if (isPainMeta(f.meta)) return `Pain: ${typeof f.meta.painScore0to10 === 'number' ? f.meta.painScore0to10 : '—'}/10`;
    if (isRomMeta(f.meta)) return `ROM A: ${typeof f.meta.activeDeg === 'number' ? `${Math.round(f.meta.activeDeg)}°` : '—'}`;
    if (isStrengthMeta(f.meta)) return `MMT: ${typeof f.meta.mmt0to5 === 'number' ? f.meta.mmt0to5 : '—'}/5`;
    if (isSpecialTestMeta(f.meta)) return `${f.meta.testName} · ${f.meta.result}`;
    return 'Other';
  }, [f.meta]);

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="px-3 py-2 border-b flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-gray-900 truncate">{f.title}</div>
            {f.status === 'final' ? (
              <span className="text-[11px] rounded-full border bg-emerald-50 border-emerald-200 text-emerald-800 px-2 py-0.5">final</span>
            ) : (
              <span className="text-[11px] rounded-full border bg-gray-50 text-gray-600 px-2 py-0.5">draft</span>
            )}
            {f.resolution === 'resolved' ? (
              <span className="text-[11px] rounded-full border bg-blue-50 border-blue-200 text-blue-800 px-2 py-0.5">resolved</span>
            ) : null}
          </div>
          <div className="mt-1 text-xs text-gray-500 truncate">{metaSummary}</div>
        </div>

        <div className="flex items-center gap-2">
          <button className="text-xs rounded border bg-white hover:bg-gray-50 px-2 py-1" type="button" onClick={() => props.onToggleFinal(f.id)}>
            {f.status === 'final' ? 'Unfinal' : 'Final'}
          </button>
          <button className="text-xs rounded border bg-white hover:bg-gray-50 px-2 py-1" type="button" onClick={() => props.onToggleResolved(f.id)}>
            {f.resolution === 'resolved' ? 'Reopen' : 'Resolve'}
          </button>
          <button
            className="text-xs rounded border bg-white hover:bg-gray-50 px-2 py-1"
            type="button"
            onClick={props.editing ? props.onStopEdit : props.onStartEdit}
          >
            {props.editing ? 'Done' : 'Edit'}
          </button>
          <button className="text-xs rounded border bg-rose-50 hover:bg-rose-100 px-2 py-1 text-rose-800" type="button" onClick={() => props.onDeleteWithUndo(f.id)}>
            Delete
          </button>
        </div>
      </div>

      {!props.editing ? (
        <div className="p-3 space-y-2">
          {f.note ? <div className="text-sm text-gray-700 whitespace-pre-wrap">{f.note}</div> : <div className="text-sm text-gray-500 italic">No note.</div>}
          {f.tags?.length ? (
            <div className="flex flex-wrap gap-1">
              {f.tags.map((t) => (
                <span key={t} className="text-[10px] rounded-full border bg-gray-50 px-2 py-0.5 text-gray-700">
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <FindingEditor
          finding={f}
          onPatchFinding={props.onPatchFinding}
          onPatchMeta={props.onPatchMeta}
        />
      )}
    </div>
  );
}

function FindingEditor(props: {
  finding: Finding;
  onPatchFinding: (id: string, patch: Partial<Finding>) => void;
  onPatchMeta: (id: string, meta: PhysioMeta) => void;
}) {
  const f = props.finding;

  const [title, setTitle] = useState(f.title);
  const [note, setNote] = useState(f.note ?? '');
  const [tags, setTags] = useState((f.tags ?? []).join(', '));

  useEffect(() => {
    setTitle(f.title);
    setNote(f.note ?? '');
    setTags((f.tags ?? []).join(', '));
  }, [f.id]); // switch edits safely

  // meta editors
  const [painScore, setPainScore] = useState<number>(isPainMeta(f.meta) && typeof f.meta.painScore0to10 === 'number' ? f.meta.painScore0to10 : 5);
  const [romA, setRomA] = useState<number | null>(isRomMeta(f.meta) && typeof f.meta.activeDeg === 'number' ? f.meta.activeDeg : null);
  const [romP, setRomP] = useState<number | null>(isRomMeta(f.meta) && typeof f.meta.passiveDeg === 'number' ? f.meta.passiveDeg : null);
  const [mmt, setMmt] = useState<0 | 1 | 2 | 3 | 4 | 5>(isStrengthMeta(f.meta) && typeof f.meta.mmt0to5 === 'number' ? f.meta.mmt0to5 : 4);
  const [stResult, setStResult] = useState<'positive' | 'negative' | 'inconclusive'>(isSpecialTestMeta(f.meta) ? f.meta.result : 'negative');

  const saveBase = () => {
    props.onPatchFinding(f.id, {
      title: title.trim() || f.title,
      note: note.trim() ? note.trim() : undefined,
      tags: tags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 12),
      severity: isPainMeta(f.meta) ? severityFromPain(painScore) : f.severity,
    });
  };

  const saveMeta = () => {
    if (isPainMeta(f.meta)) {
      props.onPatchMeta(f.id, { ...f.meta, painScore0to10: painScore });
      return;
    }
    if (isRomMeta(f.meta)) {
      props.onPatchMeta(f.id, { ...f.meta, activeDeg: romA, passiveDeg: romP });
      return;
    }
    if (isStrengthMeta(f.meta)) {
      props.onPatchMeta(f.id, { ...f.meta, mmt0to5: mmt });
      return;
    }
    if (isSpecialTestMeta(f.meta)) {
      props.onPatchMeta(f.id, { ...f.meta, result: stResult });
      return;
    }
  };

  return (
    <div className="p-3 space-y-3 bg-gray-50">
      <div className="grid grid-cols-1 gap-2">
        <Field label="Title">
          <input className="w-full rounded border px-2 py-1.5 text-sm bg-white" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Note">
          <textarea className="w-full rounded border px-2 py-1.5 text-sm bg-white" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Field label="Tags (comma separated)">
          <input className="w-full rounded border px-2 py-1.5 text-sm bg-white" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="pain, rom, shoulder…" />
        </Field>
      </div>

      {isPainMeta(f.meta) ? (
        <Field label="Pain score (0–10)">
          <input type="range" min={0} max={10} value={painScore} onChange={(e) => setPainScore(parseInt(e.target.value, 10))} className="w-full" />
          <div className="mt-1 text-xs text-gray-600">
            Score: <span className="font-mono font-semibold">{painScore}</span>/10
          </div>
        </Field>
      ) : null}

      {isRomMeta(f.meta) ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Active (deg)">
            <input className="w-full rounded border px-2 py-1.5 text-sm bg-white" type="number" value={romA ?? ''} onChange={(e) => setRomA(e.target.value === '' ? null : parseFloat(e.target.value))} />
          </Field>
          <Field label="Passive (deg)">
            <input className="w-full rounded border px-2 py-1.5 text-sm bg-white" type="number" value={romP ?? ''} onChange={(e) => setRomP(e.target.value === '' ? null : parseFloat(e.target.value))} />
          </Field>
        </div>
      ) : null}

      {isStrengthMeta(f.meta) ? (
        <Field label="MMT (0–5)">
          <input type="range" min={0} max={5} value={mmt} onChange={(e) => setMmt(parseInt(e.target.value, 10) as any)} className="w-full" />
          <div className="mt-1 text-xs text-gray-600">
            MMT: <span className="font-mono font-semibold">{mmt}</span>/5
          </div>
        </Field>
      ) : null}

      {isSpecialTestMeta(f.meta) ? (
        <Field label="Result">
          <div className="flex flex-wrap gap-2">
            <ToggleChip active={stResult === 'negative'} onClick={() => setStResult('negative')}>Negative</ToggleChip>
            <ToggleChip active={stResult === 'positive'} onClick={() => setStResult('positive')}>Positive</ToggleChip>
            <ToggleChip active={stResult === 'inconclusive'} onClick={() => setStResult('inconclusive')}>Inconclusive</ToggleChip>
          </div>
        </Field>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <button className="rounded border bg-white hover:bg-gray-100 px-3 py-1.5 text-sm" type="button" onClick={() => { saveBase(); saveMeta(); }}>
          Save changes
        </button>
      </div>
    </div>
  );
}

/* --------------------
   ProgressPanel (goal lines + baseline deltas)
-------------------- */
function ProgressPanel(props: {
  regionLabel: string;
  regionId: string;
  points: { encounterId: string; at: string; painScore?: number; romActiveDeg?: number }[];
  latestPain?: number;
  latestRomActive?: number;
  goals: (Goal & { _status: 'done' | 'no-data' | 'on-track' | 'off-track'; _current?: number })[];
  onAddGoal: (g: Goal) => void;
  onMarkGoalDone: (goalId: string) => void;
  onDeleteGoal: (goalId: string) => void;
}) {
  const painSeries = useMemo(
    () => props.points.map((p) => ({ at: p.at, v: typeof p.painScore === 'number' ? p.painScore : null })).filter((x) => x.v !== null),
    [props.points]
  );
  const romSeries = useMemo(
    () => props.points.map((p) => ({ at: p.at, v: typeof p.romActiveDeg === 'number' ? p.romActiveDeg : null })).filter((x) => x.v !== null),
    [props.points]
  );

  const painBaseline = painSeries.length ? (painSeries[0].v as number) : undefined;
  const painLatest = typeof props.latestPain === 'number' ? props.latestPain : painSeries.length ? (painSeries[painSeries.length - 1].v as number) : undefined;
  const painDelta = typeof painBaseline === 'number' && typeof painLatest === 'number' ? painLatest - painBaseline : undefined;

  const romBaseline = romSeries.length ? (romSeries[0].v as number) : undefined;
  const romLatest = typeof props.latestRomActive === 'number' ? props.latestRomActive : romSeries.length ? (romSeries[romSeries.length - 1].v as number) : undefined;
  const romDelta = typeof romBaseline === 'number' && typeof romLatest === 'number' ? romLatest - romBaseline : undefined;

  const painGoals = props.goals.filter((g) => g.metric === 'pain');
  const romGoals = props.goals.filter((g) => g.metric === 'rom_active');

  const [goalOpen, setGoalOpen] = useState(false);
  const [goalMetric, setGoalMetric] = useState<'pain' | 'rom_active'>('pain');
  const [goalDirection, setGoalDirection] = useState<'lte' | 'gte'>('lte');
  const [goalTarget, setGoalTarget] = useState<number>(goalMetric === 'pain' ? 2 : 140);
  const [goalTitle, setGoalTitle] = useState('');

  useEffect(() => {
    setGoalTarget(goalMetric === 'pain' ? 2 : 140);
    setGoalDirection(goalMetric === 'pain' ? 'lte' : 'gte');
  }, [goalMetric]);

  return (
    <section className="rounded-xl border bg-white">
      <div className="border-b px-3 py-2 flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">Outcomes</div>
          <div className="text-sm font-semibold text-gray-900">Progress · {props.regionLabel}</div>
        </div>
        <button className="text-xs rounded border bg-white hover:bg-gray-50 px-2 py-1" type="button" onClick={() => setGoalOpen((v) => !v)}>
          + Goal
        </button>
      </div>

      <div className="p-3 space-y-4">
        {/* Pain chart */}
        <div className="rounded-xl border bg-white">
          <div className="px-3 py-2 border-b flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">Pain</div>
            <BaselineDeltaBadge baseline={painBaseline} latest={painLatest} delta={painDelta} betterWhen="down" suffix="/10" />
          </div>
          <div className="p-3">
            <MiniLineChart
              series={painSeries.map((x) => x.v as number)}
              min={0}
              max={10}
              targetLines={painGoals.map((g) => g.target)}
            />
            <GoalList goals={painGoals} onDone={props.onMarkGoalDone} onDelete={props.onDeleteGoal} />
          </div>
        </div>

        {/* ROM chart */}
        <div className="rounded-xl border bg-white">
          <div className="px-3 py-2 border-b flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">ROM (Active)</div>
            <BaselineDeltaBadge baseline={romBaseline} latest={romLatest} delta={romDelta} betterWhen="up" suffix="°" />
          </div>
          <div className="p-3">
            <MiniLineChart
              series={romSeries.map((x) => x.v as number)}
              // auto scale a bit nicer
              min={romSeries.length ? Math.floor(Math.min(...romSeries.map((x) => x.v as number)) / 10) * 10 - 10 : 0}
              max={romSeries.length ? Math.ceil(Math.max(...romSeries.map((x) => x.v as number)) / 10) * 10 + 10 : 180}
              targetLines={romGoals.map((g) => g.target)}
            />
            <GoalList goals={romGoals} onDone={props.onMarkGoalDone} onDelete={props.onDeleteGoal} />
          </div>
        </div>

        {goalOpen ? (
          <div className="rounded-xl border bg-gray-50 p-3 space-y-2">
            <div className="text-sm font-semibold text-gray-900">Add goal</div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Metric">
                <select className="w-full rounded border px-2 py-1.5 text-sm bg-white" value={goalMetric} onChange={(e) => setGoalMetric(e.target.value as any)}>
                  <option value="pain">Pain</option>
                  <option value="rom_active">ROM active</option>
                </select>
              </Field>

              <Field label="Direction">
                <select className="w-full rounded border px-2 py-1.5 text-sm bg-white" value={goalDirection} onChange={(e) => setGoalDirection(e.target.value as any)}>
                  <option value="lte">≤ target</option>
                  <option value="gte">≥ target</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Target">
                <input className="w-full rounded border px-2 py-1.5 text-sm bg-white" type="number" value={goalTarget} onChange={(e) => setGoalTarget(parseFloat(e.target.value))} />
              </Field>
              <Field label="Title (optional)">
                <input className="w-full rounded border px-2 py-1.5 text-sm bg-white" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} placeholder="e.g., Pain ≤ 2/10" />
              </Field>
            </div>

            <div className="flex justify-end gap-2">
              <button className="rounded border bg-white hover:bg-gray-100 px-3 py-1.5 text-sm" type="button" onClick={() => setGoalOpen(false)}>
                Cancel
              </button>
              <button
                className="rounded border bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-sm"
                type="button"
                onClick={() => {
                  const g: Goal = {
                    id: uid('goal'),
                    regionId: props.regionId,
                    title: goalTitle.trim() || (goalMetric === 'pain' ? `Pain ${goalDirection} ${goalTarget}` : `ROM ${goalDirection} ${goalTarget}`),
                    metric: goalMetric,
                    direction: goalDirection,
                    target: goalTarget,
                    createdAt: nowISO(),
                  };
                  props.onAddGoal(g);
                  setGoalTitle('');
                  setGoalOpen(false);
                }}
              >
                Save goal
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function BaselineDeltaBadge(props: {
  baseline?: number;
  latest?: number;
  delta?: number;
  betterWhen: 'up' | 'down';
  suffix: string;
}) {
  if (typeof props.baseline !== 'number' || typeof props.latest !== 'number' || typeof props.delta !== 'number') {
    return <span className="text-xs text-gray-500">No baseline</span>;
  }
  const improved =
    props.betterWhen === 'down' ? props.delta < 0 : props.delta > 0;

  return (
    <span
      className={
        'text-xs rounded-full border px-2 py-1 ' +
        (improved ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800')
      }
      title="Latest vs baseline"
    >
      {props.latest}
      {props.suffix} · Δ {props.delta > 0 ? '+' : ''}
      {props.delta}
      {props.suffix} (from {props.baseline}
      {props.suffix})
    </span>
  );
}

function MiniLineChart(props: {
  series: number[];
  min: number;
  max: number;
  targetLines?: number[];
}) {
  const w = 320;
  const h = 90;
  const pad = 8;

  const pts = useMemo(() => {
    if (!props.series.length) return '';
    const n = props.series.length;
    const xs = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, n - 1);
    const ys = (v: number) => {
      const t = (v - props.min) / Math.max(1e-6, props.max - props.min);
      const y = pad + (1 - t) * (h - pad * 2);
      return Math.max(pad, Math.min(h - pad, y));
    };
    return props.series.map((v, i) => `${xs(i)},${ys(v)}`).join(' ');
  }, [props.series, props.min, props.max]);

  const targets = (props.targetLines ?? []).filter((t) => typeof t === 'number' && Number.isFinite(t));

  const yFor = (v: number) => {
    const t = (v - props.min) / Math.max(1e-6, props.max - props.min);
    const y = pad + (1 - t) * (h - pad * 2);
    return Math.max(pad, Math.min(h - pad, y));
  };

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="block">
        {/* soft grid */}
        <g opacity={0.35}>
          {[0.25, 0.5, 0.75].map((t) => {
            const y = pad + t * (h - pad * 2);
            return <line key={t} x1={pad} x2={w - pad} y1={y} y2={y} stroke="currentColor" />;
          })}
        </g>

        {/* goal/target lines */}
        {targets.map((t, idx) => (
          <g key={`${t}-${idx}`} opacity={0.9}>
            <line x1={pad} x2={w - pad} y1={yFor(t)} y2={yFor(t)} stroke="currentColor" strokeDasharray="4 4" />
            <text x={w - pad} y={yFor(t) - 3} fontSize="9" textAnchor="end" fill="currentColor">
              target {t}
            </text>
          </g>
        ))}

        {/* line */}
        {props.series.length ? <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" /> : null}

        {/* dots */}
        {props.series.map((v, i) => {
          const n = props.series.length;
          const x = pad + (i * (w - pad * 2)) / Math.max(1, n - 1);
          const y = yFor(v);
          return <circle key={i} cx={x} cy={y} r={3} fill="currentColor" />;
        })}
      </svg>

      {!props.series.length ? <div className="p-2 text-xs text-gray-500 italic">No data yet.</div> : null}
    </div>
  );
}

function GoalList(props: {
  goals: (Goal & { _status: any; _current?: number })[];
  onDone: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (!props.goals.length) return <div className="mt-2 text-xs text-gray-500 italic">No goals for this metric.</div>;

  return (
    <div className="mt-2 space-y-2">
      {props.goals.map((g) => (
        <div key={g.id} className="rounded-lg border bg-gray-50 px-3 py-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">{g.title}</div>
            <div className="text-xs text-gray-600">
              Target: <span className="font-mono">{g.direction === 'lte' ? '≤' : '≥'} {g.target}</span>
              {typeof g._current === 'number' ? (
                <> · Current: <span className="font-mono font-semibold">{g._current}</span></>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={
                'text-[11px] rounded-full border px-2 py-0.5 ' +
                (g._status === 'done'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : g._status === 'on-track'
                  ? 'bg-blue-50 border-blue-200 text-blue-800'
                  : g._status === 'off-track'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-gray-50 text-gray-600')
              }
            >
              {g._status}
            </span>
            {!g.done ? (
              <button className="text-xs rounded border bg-white hover:bg-gray-100 px-2 py-1" type="button" onClick={() => props.onDone(g.id)}>
                Mark done
              </button>
            ) : null}
            <button className="text-xs rounded border bg-white hover:bg-gray-100 px-2 py-1" type="button" onClick={() => props.onDelete(g.id)}>
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* =======================================================================================
   Bookmark + Evidence components (kept from your original)
======================================================================================= */

function BookmarkMovementButton({ onBookmark }: { onBookmark: (note?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');

  return (
    <>
      <button
        className="rounded-full border bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-800"
        onClick={() => setOpen(true)}
        type="button"
      >
        Bookmark Movement
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-xl bg-white border shadow">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Bookmark movement</div>
                <div className="text-xs text-gray-500">Creates a clip + attaches to the selected region (mock capture)</div>
              </div>
              <button className="text-xs text-gray-600 hover:text-gray-900" onClick={() => setOpen(false)} type="button">
                Close
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-700">
                Clip window: <span className="text-gray-500">(placeholder; later: record/stop + server jobId + real URL)</span>
              </div>

              <label className="text-xs text-gray-600 block">
                Note
                <textarea
                  className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional… e.g., pain with overhead reach"
                />
              </label>

              <div className="flex items-center justify-end gap-2">
                <button className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50" onClick={() => setOpen(false)} type="button">
                  Cancel
                </button>
                <button
                  className="rounded border bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-sm"
                  onClick={() => {
                    onBookmark(note);
                    setOpen(false);
                    setNote('');
                  }}
                  type="button"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function EvidenceStrip({ evidence }: { evidence: EvidenceRef[] }) {
  if (evidence.length === 0) return <div className="mt-2 text-sm text-gray-600 italic">No movement clips captured yet.</div>;

  return (
    <div className="mt-2 flex gap-2 overflow-auto pb-1">
      {evidence.map((ev, idx) => (
        <div key={idx} className="min-w-[220px] max-w-[220px] rounded-lg border overflow-hidden bg-white">
          <div className="h-24 bg-gray-100 grid place-items-center">
            <span className="text-xs text-gray-500">{ev.label ?? 'Movement clip'}</span>
          </div>
          <div className="p-2 space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-gray-800">{ev.device}</div>
              {ev.status ? (
                <span
                  className={
                    'text-[10px] rounded-full border px-1.5 py-0.5 ' +
                    (ev.status === 'ready'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : ev.status === 'processing'
                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                      : 'border-rose-200 bg-rose-50 text-rose-800')
                  }
                >
                  {ev.status}
                </span>
              ) : null}
            </div>
            <div className="text-[11px] text-gray-500">
              {new Date(ev.startTs).toLocaleTimeString()}–{new Date(ev.endTs).toLocaleTimeString()}
            </div>
            {ev.tags?.length ? (
              <div className="flex flex-wrap gap-1">
                {ev.tags.slice(0, 3).map((t) => (
                  <span key={t} className="text-[10px] rounded-full border bg-gray-50 px-2 py-0.5 text-gray-700">
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
            {ev.jobId && ev.status === 'processing' ? <div className="text-[10px] text-gray-400 font-mono">job: {ev.jobId}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
