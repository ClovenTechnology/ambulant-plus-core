/*
File: apps/clinician-app/app/workspaces/ent/page.tsx
Purpose: World-class ENT workspace (POST-only today; optimistic + local “server-truth later” UX)

Upgrades in this version:
- Premium light-mode dashboard header (stats + context)
- Ear “map” panel (quadrant selector) + smarter workflow
- Inline edit panel for selected finding (local-first until PATCH exists)
- Undo-hide (soft delete from UI) for findings/evidence (since DELETE endpoints don’t exist yet)
- Evidence viewer HUD + local pin overlay + “post pin” action (still POST /annotations)
- Search + filters + quick templates
- LocalStorage persistence (so it feels real even before GET endpoints)

Notes:
- Still not integrated with SFU; live_capture fields stay placeholders.
- Still POST-only: edits/hide are local until PATCH/DELETE/GET exist.
*/

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  TogglePills,
  BookmarkModal,
  EvidenceStrip as WorkspaceEvidenceStrip,
  FindingCard,
} from '@/src/components/workspaces/ui';

import type { Evidence, Finding, Location } from '@/src/lib/workspaces/types';
import { postAnnotation, postEvidence, postFinding } from '@/src/lib/workspaces/api';

const FINDING_TYPES = [
  { key: 'cerumen', label: 'Cerumen / wax' },
  { key: 'erythema', label: 'Erythema / redness' },
  { key: 'effusion', label: 'Effusion / fluid suspected' },
  { key: 'perforation_suspected', label: 'Perforation suspected' },
  { key: 'infection_suspected', label: 'Infection suspected' },
  { key: 'foreign_body', label: 'Foreign body suspected' },
  { key: 'other', label: 'Other' },
] as const;

type FindingTypeKey = (typeof FINDING_TYPES)[number]['key'];
type EarSide = 'L' | 'R';

type ENTWorkspaceProps = {
  patientId?: string;
  encounterId?: string;
  clinicianId?: string;
};

type Banner = { kind: 'info' | 'success' | 'error'; text: string } | null;

type Quadrant = 'AS' | 'AI' | 'PS' | 'PI' | 'CANAL' | 'UNKNOWN';
const QUADRANTS: { key: Quadrant; label: string; hint: string }[] = [
  { key: 'AS', label: 'Anterior–Superior', hint: 'Upper-front' },
  { key: 'AI', label: 'Anterior–Inferior', hint: 'Lower-front' },
  { key: 'PS', label: 'Posterior–Superior', hint: 'Upper-back' },
  { key: 'PI', label: 'Posterior–Inferior', hint: 'Lower-back' },
  { key: 'CANAL', label: 'Canal', hint: 'External canal' },
  { key: 'UNKNOWN', label: 'Unspecified', hint: 'Not set' },
];

type LocalPin = {
  id: string;
  evidenceId: string;
  x: number; // 0..1
  y: number; // 0..1
  label: string;
  createdAt: string;
  status: 'pending' | 'saved' | 'failed';
};

function nowISO() {
  return new Date().toISOString();
}

function tmpId(prefix: string) {
  return `tmp_${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function errMsg(e: unknown) {
  if (typeof e === 'string') return e;
  if (!isRecord(e)) return 'Request failed';
  const m = e['message'];
  if (typeof m === 'string' && m.trim()) return m;
  const details = e['details'];
  if (isRecord(details) && typeof details['message'] === 'string') return String(details['message']);
  return 'Request failed';
}

function StatCard(props: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border bg-white px-3 py-2 shadow-sm">
      <div className="text-[11px] text-gray-500">{props.label}</div>
      <div className="text-sm font-semibold text-gray-900">{props.value}</div>
      {props.sub ? <div className="text-[11px] text-gray-500 mt-0.5">{props.sub}</div> : null}
    </div>
  );
}

function PillBtn(props: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  tone?: 'blue' | 'slate';
  title?: string;
}) {
  const tone = props.tone ?? 'slate';
  const active = !!props.active;
  const cls =
    tone === 'blue'
      ? active
        ? 'border-blue-300 bg-blue-50 text-blue-900'
        : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-800'
      : active
      ? 'border-gray-300 bg-gray-100 text-gray-900'
      : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-800';

  return (
    <button
      type="button"
      title={props.title}
      onClick={props.onClick}
      className={'px-3 py-1.5 rounded-full border text-xs ' + cls}
      aria-pressed={active}
    >
      {props.label}
    </button>
  );
}

function severityTone(s?: Finding['severity']) {
  if (s === 'severe') return 'border-rose-200 bg-rose-50 text-rose-900';
  if (s === 'moderate') return 'border-amber-200 bg-amber-50 text-amber-900';
  if (s === 'mild') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  return 'border-gray-200 bg-white text-gray-700';
}

export default function ENTWorkspacePage(props: ENTWorkspaceProps) {
  const patientId = props.patientId ?? 'pat_demo_001';
  const encounterId = props.encounterId ?? 'enc_demo_001';
  const clinicianId = props.clinicianId ?? 'clin_demo_001';

  const storageKey = useMemo(() => `ent-ws-v2:${patientId}:${encounterId}`, [patientId, encounterId]);
  const didLoadRef = useRef(false);

  const [ear, setEar] = useState<EarSide>('R');
  const [quadrant, setQuadrant] = useState<Quadrant>('UNKNOWN');

  // Optimistic local state (until GET exists)
  const [findings, setFindings] = useState<Finding[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);

  // local-only pins (until GET annotations exists)
  const [pins, setPins] = useState<LocalPin[]>([]);

  // local-only “hidden” sets (soft-delete from UI until DELETE exists)
  const [hiddenFindingIds, setHiddenFindingIds] = useState<Set<string>>(() => new Set());
  const [hiddenEvidenceIds, setHiddenEvidenceIds] = useState<Set<string>>(() => new Set());

  // UI state
  const [bookmarkOpen, setBookmarkOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);

  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [showOnlyWithEvidence, setShowOnlyWithEvidence] = useState(false);

  // Undo-hide state (single action, 6s window)
  const undoTimerRef = useRef<number | null>(null);
  const [undoState, setUndoState] = useState<{
    visible: boolean;
    text: string;
    restore?: () => void;
  }>({ visible: false, text: '' });

  // Load persisted (local-first)
  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed)) return;

      const vEar = parsed['ear'];
      if (vEar === 'L' || vEar === 'R') setEar(vEar);

      const vQ = parsed['quadrant'];
      if (typeof vQ === 'string' && QUADRANTS.some((q) => q.key === vQ)) setQuadrant(vQ as Quadrant);

      const f = parsed['findings'];
      if (Array.isArray(f)) setFindings(f as Finding[]);

      const ev = parsed['evidence'];
      if (Array.isArray(ev)) setEvidence(ev as Evidence[]);

      const p = parsed['pins'];
      if (Array.isArray(p)) setPins(p as LocalPin[]);

      const hf = parsed['hiddenFindingIds'];
      if (Array.isArray(hf)) setHiddenFindingIds(new Set(hf.filter((x) => typeof x === 'string') as string[]));

      const he = parsed['hiddenEvidenceIds'];
      if (Array.isArray(he)) setHiddenEvidenceIds(new Set(he.filter((x) => typeof x === 'string') as string[]));

      const sf = parsed['selectedFindingId'];
      if (typeof sf === 'string') setSelectedFindingId(sf);

      const se = parsed['selectedEvidenceId'];
      if (typeof se === 'string') setSelectedEvidenceId(se);

      const s = parsed['search'];
      if (typeof s === 'string') setSearch(s);

      const only = parsed['showOnlyWithEvidence'];
      if (typeof only === 'boolean') setShowOnlyWithEvidence(only);
    } catch {
      // ignore
    }
  }, [storageKey]);

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          ear,
          quadrant,
          findings,
          evidence,
          pins,
          hiddenFindingIds: Array.from(hiddenFindingIds),
          hiddenEvidenceIds: Array.from(hiddenEvidenceIds),
          selectedFindingId,
          selectedEvidenceId,
          search,
          showOnlyWithEvidence,
        })
      );
    } catch {
      // ignore
    }
  }, [
    storageKey,
    ear,
    quadrant,
    findings,
    evidence,
    pins,
    hiddenFindingIds,
    hiddenEvidenceIds,
    selectedFindingId,
    selectedEvidenceId,
    search,
    showOnlyWithEvidence,
  ]);

  const locationForEar = (e: EarSide): Location => ({ kind: 'ent_ear', ear: e });

  const visibleFindings = useMemo(() => findings.filter((f) => !hiddenFindingIds.has(f.id)), [findings, hiddenFindingIds]);
  const visibleEvidence = useMemo(() => evidence.filter((e) => !hiddenEvidenceIds.has(e.id)), [evidence, hiddenEvidenceIds]);

  const selectedEvidence = useMemo(
    () => visibleEvidence.find((e) => e.id === selectedEvidenceId) ?? null,
    [visibleEvidence, selectedEvidenceId]
  );
  const selectedFinding = useMemo(
    () => visibleFindings.find((f) => f.id === selectedFindingId) ?? null,
    [visibleFindings, selectedFindingId]
  );

  const findingsForEar = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleFindings
      .filter((f) => f.location.kind === 'ent_ear' && f.location.ear === ear)
      .filter((f) => {
        if (!q) return true;
        const hay = `${f.title ?? ''} ${f.note ?? ''} ${(f.tags ?? []).join(' ')}`.toLowerCase();
        return hay.includes(q);
      })
      .filter((f) => {
        if (!showOnlyWithEvidence) return true;
        return visibleEvidence.some((ev) => ev.findingId === f.id);
      })
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [visibleFindings, visibleEvidence, ear, search, showOnlyWithEvidence]);

  const evidenceForEar = useMemo(() => {
    return visibleEvidence
      .filter((ev) => ev.location.kind === 'ent_ear' && ev.location.ear === ear)
      .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
  }, [visibleEvidence, ear]);

  const earCounts = useMemo(() => {
    const c = { L: 0, R: 0 } as Record<EarSide, number>;
    for (const f of visibleFindings) {
      if (f.location.kind === 'ent_ear') c[f.location.ear] += 1;
    }
    return c;
  }, [visibleFindings]);

  const evidenceCountsByFinding = useMemo(() => {
    const m = new Map<string, number>();
    for (const ev of visibleEvidence) {
      const fid = ev.findingId;
      if (!fid) continue;
      m.set(fid, (m.get(fid) ?? 0) + 1);
    }
    return m;
  }, [visibleEvidence]);

  const lastCapturedAt = useMemo(() => {
    const ts = evidenceForEar[0]?.capturedAt;
    return ts ? new Date(ts).toLocaleString() : '—';
  }, [evidenceForEar]);

  const totalFindings = visibleFindings.length;
  const totalEvidence = visibleEvidence.length;

  const pinsForSelectedEvidence = useMemo(() => {
    if (!selectedEvidence) return [];
    return pins.filter((p) => p.evidenceId === selectedEvidence.id);
  }, [pins, selectedEvidence]);

  const clearUndoTimer = () => {
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = null;
  };

  const showUndo = (text: string, restore: () => void) => {
    clearUndoTimer();
    setUndoState({ visible: true, text, restore });
    undoTimerRef.current = window.setTimeout(() => {
      setUndoState({ visible: false, text: '' });
      undoTimerRef.current = null;
    }, 6000);
  };

  const hideFindingWithUndo = (id: string) => {
    const victim = visibleFindings.find((f) => f.id === id);
    if (!victim) return;

    setHiddenFindingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    if (selectedFindingId === id) setSelectedFindingId(null);

    showUndo(`Hidden “${victim.title}” from the workspace.`, () => {
      setHiddenFindingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    });
  };

  const hideEvidenceWithUndo = (id: string) => {
    const victim = visibleEvidence.find((e) => e.id === id);
    if (!victim) return;

    setHiddenEvidenceIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    if (selectedEvidenceId === id) setSelectedEvidenceId(null);

    showUndo('Hidden evidence item from the workspace.', () => {
      setHiddenEvidenceIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    });
  };

  const createManualFinding = async (type: FindingTypeKey, severity?: Finding['severity'], note?: string) => {
    const title = FINDING_TYPES.find((x) => x.key === type)?.label ?? 'Finding';
    const location = locationForEar(ear);
    const zoneTag = quadrant !== 'UNKNOWN' ? `zone:${quadrant}` : undefined;

    // optimistic finding
    const optimisticId = tmpId('fd');
    const optimistic: Finding = {
      id: optimisticId,
      patientId,
      encounterId,
      specialty: 'ent',
      status: 'draft',
      title,
      note: note?.trim() ? note.trim() : undefined,
      severity,
      tags: ['ent', ...(zoneTag ? [zoneTag] : [])],
      location,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      createdBy: clinicianId,
      meta: {},
    };

    setBanner(null);
    setFindings((prev) => [optimistic, ...prev]);
    setSelectedFindingId(optimisticId);

    try {
      const created = await postFinding({
        patientId,
        encounterId,
        specialty: 'ent',
        title,
        status: 'draft',
        severity,
        note: note?.trim() ? note.trim() : undefined,
        tags: ['ent', ...(zoneTag ? [zoneTag] : [])],
        location,
        createdBy: clinicianId,
      });

      setFindings((prev) => prev.map((f) => (f.id === optimisticId ? created : f)));
      setSelectedFindingId(created.id);
      setBanner({ kind: 'success', text: 'Finding saved.' });
    } catch (e) {
      setFindings((prev) => prev.filter((f) => f.id !== optimisticId));
      setSelectedFindingId(null);
      setBanner({ kind: 'error', text: `Failed to save finding: ${errMsg(e)}` });
      throw e;
    }
  };

  const handleBookmark = async (payload: { findingTypeKey: string; severity?: Finding['severity']; note?: string }) => {
    const type = payload.findingTypeKey as FindingTypeKey;
    const title = FINDING_TYPES.find((x) => x.key === type)?.label ?? 'Finding';
    const location = locationForEar(ear);
    const zoneTag = quadrant !== 'UNKNOWN' ? `zone:${quadrant}` : undefined;

    setBanner(null);
    setBusy(true);

    try {
      // 1) Create finding
      const createdFinding = await postFinding({
        patientId,
        encounterId,
        specialty: 'ent',
        title,
        status: 'draft',
        severity: payload.severity,
        note: payload.note?.trim() ? payload.note.trim() : undefined,
        tags: ['ent', 'bookmark', ...(zoneTag ? [zoneTag] : [])],
        location,
        createdBy: clinicianId,
      });

      setFindings((prev) => [createdFinding, ...prev]);
      setSelectedFindingId(createdFinding.id);

      // 2) Create snapshot evidence (ready)
      const snapshot = await postEvidence({
        patientId,
        encounterId,
        specialty: 'ent',
        findingId: createdFinding.id,
        location,
        source: {
          type: 'live_capture',
          device: 'otoscope',
          // SFU fields later
          roomId: undefined,
          trackId: undefined,
        },
        media: {
          kind: 'image',
          url: `https://placehold.co/1200x800?text=Otoscope+Snapshot+(${ear})`,
          thumbnailUrl: `https://placehold.co/320x200?text=Snapshot+(${ear})`,
          contentType: 'image/jpeg',
        },
        status: 'ready',
      });

      // 3) Create clip evidence (processing)
      const t = Date.now();
      const clip = await postEvidence({
        patientId,
        encounterId,
        specialty: 'ent',
        findingId: createdFinding.id,
        location,
        source: {
          type: 'live_capture',
          device: 'otoscope',
          roomId: undefined,
          trackId: undefined,
          startTs: t - 4000,
          endTs: t + 6000,
        },
        media: {
          kind: 'video_clip',
          url: 'https://example.invalid/clip.mp4',
          thumbnailUrl: `https://placehold.co/320x200?text=Clip+(${ear})`,
          contentType: 'video/mp4',
          startTs: t - 4000,
          endTs: t + 6000,
        },
        status: 'processing',
      });

      setEvidence((prev) => [snapshot, clip, ...prev]);
      setSelectedEvidenceId(snapshot.id);
      setBanner({ kind: 'success', text: 'Bookmark saved (finding + evidence created).' });
    } catch (e) {
      setBanner({ kind: 'error', text: `Failed to save bookmark: ${errMsg(e)}` });
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const updateSelectedFindingLocal = (patch: Partial<Finding>) => {
    if (!selectedFinding) return;
    setFindings((prev) =>
      prev.map((f) => (f.id === selectedFinding.id ? { ...f, ...patch, updatedAt: nowISO() } : f))
    );
  };

  const addPinToSelectedEvidence = async (x: number, y: number) => {
    if (!selectedEvidence) {
      setBanner({ kind: 'info', text: 'Select an evidence item first.' });
      return;
    }

    const label =
      quadrant !== 'UNKNOWN'
        ? `Concern (${ear}:${quadrant})`
        : `Concern (${ear})`;

    const local: LocalPin = {
      id: tmpId('pin'),
      evidenceId: selectedEvidence.id,
      x,
      y,
      label,
      createdAt: nowISO(),
      status: 'pending',
    };

    setPins((prev) => [local, ...prev]);
    setBanner(null);
    setBusy(true);

    try {
      await postAnnotation({
        patientId,
        encounterId,
        specialty: 'ent',
        evidenceId: selectedEvidence.id,
        findingId: selectedEvidence.findingId ?? null,
        location: selectedEvidence.location,
        type: 'pin',
        payload: { x, y, label },
        createdBy: clinicianId,
      });

      setPins((prev) => prev.map((p) => (p.id === local.id ? { ...p, status: 'saved' } : p)));
      setBanner({ kind: 'success', text: 'Pin saved.' });
    } catch (e) {
      setPins((prev) => prev.map((p) => (p.id === local.id ? { ...p, status: 'failed' } : p)));
      setBanner({ kind: 'error', text: `Failed to save pin: ${errMsg(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const addDemoPinAnnotation = async () => {
    // kept for parity with your old flow: adds a deterministic pin
    await addPinToSelectedEvidence(0.52, 0.41);
  };

  const headerEarLabel = ear === 'L' ? 'Left (L)' : 'Right (R)';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* TOP HEADER (world-class dashboard style) */}
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="text-sm text-gray-500">Ambulant+ Workspace</div>
              <div className="flex items-end gap-3">
                <h1 className="text-lg font-semibold text-gray-900">ENT Workspace</h1>
                <span className="text-xs text-gray-500">Phase 1 (POST-only) · Premium local-first UX</span>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Patient: <span className="font-mono">{patientId}</span> · Encounter:{' '}
                <span className="font-mono">{encounterId}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatCard label="Selected ear" value={headerEarLabel} sub={quadrant === 'UNKNOWN' ? 'Zone: —' : `Zone: ${quadrant}`} />
              <StatCard label="Findings" value={totalFindings} sub={`This ear: ${earCounts[ear]}`} />
              <StatCard label="Evidence" value={totalEvidence} sub={`Last: ${lastCapturedAt}`} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4">
        {/* Banner */}
        {banner ? (
          <div
            className={
              'mb-4 rounded-lg border px-3 py-2 text-sm ' +
              (banner.kind === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : banner.kind === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-900'
                : 'border-gray-200 bg-white text-gray-800')
            }
          >
            {banner.text}
          </div>
        ) : null}

        {/* Undo bar */}
        {undoState.visible ? (
          <div className="mb-4 rounded-lg border bg-white px-3 py-2 text-sm flex items-center justify-between gap-3">
            <div className="text-gray-700">{undoState.text}</div>
            <button
              type="button"
              className="rounded-full border bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-800"
              onClick={() => {
                const r = undoState.restore;
                setUndoState({ visible: false, text: '' });
                clearUndoTimer();
                r?.();
              }}
            >
              Undo
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-[1.12fr_1.72fr_1.16fr] gap-4">
          {/* LEFT: EAR MAP + FINDINGS LIST */}
          <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Ear Map</div>
                  <div className="text-xs text-gray-500">Fast selection + quadrant tagging (premium workflow)</div>
                </div>
                <div className="text-xs text-gray-500">
                  {earCounts.L + earCounts.R === 0 ? 'No findings yet' : `${earCounts[ear]} finding(s) for ${headerEarLabel}`}
                </div>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <TogglePills<EarSide>
                value={ear}
                onChange={(v) => {
                  setEar(v);
                  setSelectedEvidenceId(null);
                  setSelectedFindingId(null);
                  setBanner(null);
                }}
                items={[
                  { key: 'L', label: 'Left (L)' },
                  { key: 'R', label: 'Right (R)' },
                ]}
                counts={earCounts}
              />

              <div className="rounded-xl border bg-gradient-to-b from-slate-50 to-white p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-gray-700">Quadrant</div>
                    <div className="text-[11px] text-gray-500">Used to tag findings/pins (until structured location zones exist).</div>
                  </div>
                  <div className="text-[11px] text-gray-500">Ear: {headerEarLabel}</div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {QUADRANTS.map((q) => (
                    <button
                      key={q.key}
                      type="button"
                      onClick={() => setQuadrant(q.key)}
                      className={
                        'rounded-lg border px-3 py-2 text-left ' +
                        (quadrant === q.key ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50')
                      }
                    >
                      <div className="text-xs font-semibold text-gray-900">{q.label}</div>
                      <div className="text-[11px] text-gray-500">{q.hint}</div>
                    </button>
                  ))}
                </div>

                <div className="mt-3 rounded-lg border bg-white px-3 py-2">
                  <div className="text-xs text-gray-600">
                    Selected: <span className="font-mono font-semibold text-gray-900">{quadrant}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-gray-700">Findings</div>
                  <label className="text-[11px] text-gray-600 flex items-center gap-2 select-none">
                    <input
                      type="checkbox"
                      checked={showOnlyWithEvidence}
                      onChange={() => setShowOnlyWithEvidence((v) => !v)}
                    />
                    Only with evidence
                  </label>
                </div>

                <input
                  className="mt-2 w-full rounded border bg-white px-2.5 py-2 text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search title, note, tags…"
                />

                <div className="mt-3">
                  {findingsForEar.length === 0 ? (
                    <div className="text-sm text-gray-600 italic">No findings for this ear yet.</div>
                  ) : (
                    <ul className="space-y-2">
                      {findingsForEar.map((f) => {
                        const active = f.id === selectedFindingId;
                        const evCount = evidenceCountsByFinding.get(f.id) ?? 0;

                        return (
                          <li key={f.id}>
                            <div
                              className={
                                'rounded-lg border overflow-hidden ' +
                                (active ? 'border-blue-300 ring-4 ring-blue-100 bg-blue-50/30' : 'border-gray-200 bg-white')
                              }
                            >
                              <button
                                type="button"
                                className="w-full text-left"
                                onClick={() => {
                                  setSelectedFindingId(f.id);
                                  setBanner(null);
                                }}
                              >
                                <FindingCard
                                  finding={f}
                                  evidenceCount={evCount}
                                  // PATCH status is not available yet
                                  onToggleFinal={undefined}
                                />
                              </button>

                              <div className="px-3 pb-3 flex items-center justify-between">
                                <div className="text-[11px] text-gray-500">
                                  {f.severity ? (
                                    <span className={'inline-flex items-center rounded-full border px-2 py-0.5 ' + severityTone(f.severity)}>
                                      {f.severity}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">severity: —</span>
                                  )}
                                  {f.tags?.length ? (
                                    <span className="ml-2 text-gray-400">· {f.tags.slice(0, 2).join(', ')}</span>
                                  ) : null}
                                </div>

                                <button
                                  type="button"
                                  className="text-xs rounded-full border bg-white hover:bg-gray-50 px-2.5 py-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    hideFindingWithUndo(f.id);
                                  }}
                                  title="Hide from UI (until DELETE exists)"
                                >
                                  Hide
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="mt-3 text-[11px] text-gray-500">
                  Inline edit below is <span className="font-semibold">local-only</span> until PATCH endpoints are added.
                </div>
              </div>
            </div>
          </section>

          {/* CENTER: EVIDENCE VIEWER (premium HUD + overlay pins) */}
          <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">Otoscope</div>
                <div className="text-xs text-gray-500">Live view + evidence timeline + pin overlay (annotations POST)</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-full border bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-800 disabled:opacity-50"
                  onClick={() => setBookmarkOpen(true)}
                  disabled={busy}
                >
                  Bookmark
                </button>

                <button
                  type="button"
                  className="rounded-full border bg-white hover:bg-gray-50 px-3 py-1.5 text-xs disabled:opacity-50"
                  onClick={addDemoPinAnnotation}
                  disabled={busy}
                  title="Creates a demo pin for the selected evidence"
                >
                  + Demo pin
                </button>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* Viewer */}
              <div className="rounded-xl border bg-gradient-to-b from-slate-50 to-white overflow-hidden">
                <div className="border-b px-3 py-2 flex items-center justify-between gap-3">
                  <div className="text-xs text-gray-600">
                    Ear: <span className="font-semibold text-gray-900">{headerEarLabel}</span>
                    {quadrant !== 'UNKNOWN' ? (
                      <>
                        {' '}
                        · Zone: <span className="font-mono font-semibold text-gray-900">{quadrant}</span>
                      </>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-gray-600">
                    <span className="rounded-full border bg-white px-2 py-0.5">
                      Evidence: <span className="font-mono font-semibold">{evidenceForEar.length}</span>
                    </span>
                    <span className="rounded-full border bg-white px-2 py-0.5">
                      Pins: <span className="font-mono font-semibold">{pinsForSelectedEvidence.length}</span>
                    </span>
                  </div>
                </div>

                <div className="relative h-64 bg-gray-100">
                  {selectedEvidence ? (
                    selectedEvidence.kind === 'image' ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selectedEvidence.url}
                          alt="Selected evidence"
                          className="absolute inset-0 h-full w-full object-contain"
                        />

                        {/* pin overlay */}
                        <div className="absolute inset-0">
                          {pinsForSelectedEvidence.map((p) => (
                            <div
                              key={p.id}
                              className="absolute"
                              style={{
                                left: `${Math.round(p.x * 1000) / 10}%`,
                                top: `${Math.round(p.y * 1000) / 10}%`,
                                transform: 'translate(-50%, -50%)',
                              }}
                              title={p.label}
                            >
                              <div
                                className={
                                  'w-6 h-6 rounded-full grid place-items-center text-[11px] font-semibold shadow ' +
                                  (p.status === 'saved'
                                    ? 'bg-blue-600 text-white'
                                    : p.status === 'pending'
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-rose-600 text-white')
                                }
                              >
                                •
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* click-to-pin */}
                        <button
                          type="button"
                          className="absolute inset-0"
                          onClick={(e) => {
                            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                            const x = (e.clientX - rect.left) / rect.width;
                            const y = (e.clientY - rect.top) / rect.height;
                            // clamp a bit
                            const cx = Math.max(0, Math.min(1, x));
                            const cy = Math.max(0, Math.min(1, y));
                            void addPinToSelectedEvidence(cx, cy);
                          }}
                          title="Click to add a pin (saves via POST /annotations)"
                          style={{ background: 'transparent' }}
                        />

                        {/* bottom HUD */}
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 rounded-lg border bg-white/85 backdrop-blur px-3 py-2 text-xs">
                          <div className="truncate text-gray-700">
                            Selected: <span className="font-semibold">{selectedEvidence.kind}</span>
                            {selectedEvidence.status ? (
                              <>
                                {' '}
                                · <span className="text-gray-500">status:</span>{' '}
                                <span className="font-semibold">{selectedEvidence.status}</span>
                              </>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full border bg-white px-2 py-0.5 text-gray-700">
                              Pins: <span className="font-mono font-semibold">{pinsForSelectedEvidence.length}</span>
                            </span>
                            <button
                              type="button"
                              className="rounded-full border bg-white hover:bg-gray-50 px-2.5 py-1"
                              onClick={() => hideEvidenceWithUndo(selectedEvidence.id)}
                              title="Hide from UI (until DELETE exists)"
                            >
                              Hide
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="h-full w-full grid place-items-center text-gray-700">
                        <div className="text-center px-6">
                          <div className="text-sm font-medium">Clip selected</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Status: {selectedEvidence.status ?? '—'}
                            {selectedEvidence.jobId ? ` · job: ${selectedEvidence.jobId}` : ''}
                          </div>
                          <div className="mt-2 text-xs text-gray-500">(Playback wires in when real clip URLs are returned.)</div>

                          <button
                            type="button"
                            className="mt-3 rounded-full border bg-white hover:bg-gray-50 px-3 py-1.5 text-xs"
                            onClick={() => hideEvidenceWithUndo(selectedEvidence.id)}
                          >
                            Hide clip
                          </button>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="h-full grid place-items-center text-gray-600">
                      <div className="text-center px-6">
                        <div className="text-sm font-medium">Live Otoscope View (placeholder)</div>
                        <div className="text-xs text-gray-500 mt-1">Select evidence below to preview · Click image to pin</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Evidence timeline */}
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-gray-700">Evidence timeline</div>
                <div className="text-[11px] text-gray-500">
                  Tip: click an image to add a pin · Pins save to server (POST) but list is local until GET exists.
                </div>
              </div>

              <WorkspaceEvidenceStrip
                evidence={evidenceForEar}
                onSelect={(ev) => {
                  setSelectedEvidenceId(ev.id);
                  if (ev.findingId) setSelectedFindingId(ev.findingId);
                  setBanner(null);
                }}
              />

              {/* Compare stub */}
              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700">Compare (MVP-2)</div>
                <div className="mt-1 text-sm text-gray-700">Next: current vs prior otoscope captures for the same ear/zone.</div>
                <button
                  type="button"
                  className="mt-2 text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
                  onClick={() => alert('Stub: open compare view')}
                >
                  Open compare
                </button>
              </div>
            </div>
          </section>

          {/* RIGHT: COMPOSER + INLINE EDIT + PLAN */}
          <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b px-4 py-3">
              <div className="text-sm font-semibold text-gray-900">Assessment & Plan</div>
              <div className="text-xs text-gray-500">Fast capture · Premium inline review · Local-first until PATCH exists</div>
            </div>

            <div className="p-4 space-y-4">
              <QuickFindingComposer onCreate={createManualFinding} disabled={busy} />

              {/* Inline edit panel */}
              <div className="rounded-xl border bg-white">
                <div className="border-b px-3 py-2 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-gray-700">Inline edit</div>
                    <div className="text-[11px] text-gray-500">
                      {selectedFinding ? (
                        <>
                          Editing <span className="font-semibold text-gray-900">{selectedFinding.title}</span>
                        </>
                      ) : (
                        'Select a finding to edit.'
                      )}
                    </div>
                  </div>
                  {selectedFinding ? (
                    <button
                      type="button"
                      className="rounded-full border bg-white hover:bg-gray-50 px-2.5 py-1 text-xs"
                      onClick={() => hideFindingWithUndo(selectedFinding.id)}
                      title="Hide from UI (until DELETE exists)"
                    >
                      Hide
                    </button>
                  ) : null}
                </div>

                <div className="p-3 space-y-3">
                  {!selectedFinding ? (
                    <div className="text-sm text-gray-600 italic">Pick a finding from the left panel to edit details.</div>
                  ) : (
                    <>
                      <label className="text-xs text-gray-600 block">
                        Title
                        <input
                          className="mt-1 w-full rounded border px-2.5 py-2 text-sm"
                          value={selectedFinding.title ?? ''}
                          onChange={(e) => updateSelectedFindingLocal({ title: e.target.value })}
                          placeholder="e.g., Erythema / redness"
                        />
                      </label>

                      <div>
                        <div className="text-xs text-gray-600">Severity</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(['mild', 'moderate', 'severe'] as const).map((s) => (
                            <PillBtn
                              key={s}
                              label={s}
                              active={selectedFinding.severity === s}
                              tone="blue"
                              onClick={() => updateSelectedFindingLocal({ severity: s })}
                            />
                          ))}
                          <PillBtn
                            label="—"
                            active={!selectedFinding.severity}
                            onClick={() => updateSelectedFindingLocal({ severity: undefined })}
                          />
                        </div>
                      </div>

                      <label className="text-xs text-gray-600 block">
                        Note
                        <textarea
                          className="mt-1 w-full rounded border px-2.5 py-2 text-sm"
                          rows={3}
                          value={selectedFinding.note ?? ''}
                          onChange={(e) => updateSelectedFindingLocal({ note: e.target.value })}
                          placeholder="Describe what you see…"
                        />
                      </label>

                      <div className="rounded-lg border bg-amber-50 border-amber-200 px-3 py-2 text-[11px] text-amber-900">
                        Local edit only: wire PATCH when ready to make this server-truth.
                      </div>
                    </>
                  )}
                </div>
              </div>

              <SymptomsChecklist />

              <div className="rounded-lg border p-3 bg-gray-50">
                <div className="text-xs font-semibold text-gray-700">Plan (premium stub)</div>
                <div className="mt-1 text-sm text-gray-700">
                  Next: meds/referral/follow-up tasks linked to ear findings + automatic patient instructions.
                </div>
                <button
                  type="button"
                  className="mt-2 text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
                  onClick={() => alert('Stub: add plan item')}
                >
                  + Add plan item
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      <BookmarkModal
        open={bookmarkOpen}
        onClose={() => setBookmarkOpen(false)}
        title={`Bookmark (${ear === 'L' ? 'Left' : 'Right'} ear)`}
        description="Creates a finding + captures snapshot + clip as evidence"
        findingTypes={FINDING_TYPES.map((x) => ({ key: x.key, label: x.label }))}
        defaultTypeKey="erythema"
        onSave={handleBookmark}
      />
    </div>
  );
}

function QuickFindingComposer({
  onCreate,
  disabled,
}: {
  onCreate: (type: FindingTypeKey, severity?: 'mild' | 'moderate' | 'severe', note?: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [type, setType] = useState<FindingTypeKey>('cerumen');
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe' | ''>('moderate');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const templates: { label: string; apply: () => void }[] = [
    {
      label: 'Wax build-up (moderate)',
      apply: () => {
        setType('cerumen');
        setSeverity('moderate');
        setNote('Cerumen partially obscuring view of TM.');
      },
    },
    {
      label: 'Redness (mild)',
      apply: () => {
        setType('erythema');
        setSeverity('mild');
        setNote('Mild erythema observed. No obvious perforation.');
      },
    },
    {
      label: 'Effusion suspected',
      apply: () => {
        setType('effusion');
        setSeverity('moderate');
        setNote('Possible effusion / fluid line suspected behind TM.');
      },
    },
  ];

  return (
    <div className="rounded-xl border p-3 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-gray-700">New Finding</div>
          <div className="text-[11px] text-gray-500">Create a structured finding (POST) in seconds.</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {templates.map((t) => (
          <button
            key={t.label}
            type="button"
            className="rounded-full border bg-gray-50 hover:bg-gray-100 px-3 py-1.5 text-xs text-gray-800"
            onClick={t.apply}
            disabled={disabled || saving}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <label className="text-xs text-gray-600">
          Type
          <select
            className="mt-1 w-full rounded border px-2 py-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as FindingTypeKey)}
            disabled={disabled || saving}
          >
            {FINDING_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-gray-600">
          Severity
          <select
            className="mt-1 w-full rounded border px-2 py-2 text-sm"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as '' | 'mild' | 'moderate' | 'severe')}
            disabled={disabled || saving}
          >
            <option value="">—</option>
            <option value="mild">mild</option>
            <option value="moderate">moderate</option>
            <option value="severe">severe</option>
          </select>
        </label>

        <label className="text-xs text-gray-600">
          Note
          <textarea
            className="mt-1 w-full rounded border px-2 py-2 text-sm"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional details…"
            disabled={disabled || saving}
          />
        </label>

        <button
          type="button"
          className="mt-1 rounded-full border bg-blue-50 hover:bg-blue-100 px-3 py-2 text-sm font-medium text-blue-900 disabled:opacity-50"
          disabled={disabled || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onCreate(type, (severity || undefined) as 'mild' | 'moderate' | 'severe' | undefined, note);
              setNote('');
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? 'Saving…' : 'Create finding'}
        </button>
      </div>
    </div>
  );
}

function SymptomsChecklist() {
  const [symptoms, setSymptoms] = useState({
    pain: false,
    hearingChange: false,
    discharge: false,
    dizziness: false,
    fever: false,
    tinnitus: false,
  });

  const toggle = (k: keyof typeof symptoms) => setSymptoms((s) => ({ ...s, [k]: !s[k] }));

  return (
    <div className="rounded-xl border p-3 bg-white">
      <div className="text-xs font-semibold text-gray-700">Symptoms (MVP-lite)</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(
          [
            ['pain', 'Ear pain'],
            ['hearingChange', 'Hearing change'],
            ['discharge', 'Discharge'],
            ['dizziness', 'Dizziness'],
            ['fever', 'Fever'],
            ['tinnitus', 'Tinnitus'],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={symptoms[k]} onChange={() => toggle(k)} />
            {label}
          </label>
        ))}
      </div>
      <div className="mt-2 text-[11px] text-gray-500">
        Next: persist as structured encounter fields (and auto-suggest findings + plan).
      </div>
    </div>
  );
}
