/*
File: apps/clinician-app/app/workspaces/optometry/page.tsx
Purpose: World-class Optometry workspace scaffold (POST-ready later; premium local-first UX today).

Upgrades in this version:
- Premium dashboard header with stats + context (like dental/physio/ent)
- Eye “map” panel with zone selection (MVP-lite) + tags
- LocalStorage persistence (feels real before GET)
- Selected finding panel (inline edit, local-only until PATCH exists)
- Evidence viewer HUD + click-to-pin overlay + pin POST hook (annotations) (local list until GET)
- Undo-hide for findings/media/evidence (since DELETE endpoints don’t exist yet)
- Search + filters + quick templates
- Safer typing (no `any`), cleaner helpers

Notes:
- Still NOT integrated with SFU.
- Still does NOT call POST endpoints yet (because this file defines its own types). When you’re ready, we’ll swap
  the local types for your shared `Finding/Evidence/Location` + `postFinding/postEvidence/postAnnotation` like ENT.
*/

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

type Specialty = 'dental' | 'physio' | 'ent' | 'optometry';

type Eye = 'OD' | 'OS';

type ChartLocation = {
  kind: 'eye';
  eye: Eye;
  zoneId?: string; // MVP-lite zones
};

type EvidenceRef =
  | {
      kind: 'image';
      device: 'upload' | 'camera' | 'otoscope' | 'other';
      capturedTs: number;
      url: string;
      thumbnailUrl?: string;
      status?: 'ready' | 'processing' | 'failed';
    }
  | {
      kind: 'video_clip';
      device: 'upload' | 'camera' | 'other';
      startTs: number;
      endTs: number;
      url: string;
      thumbnailUrl?: string;
      status?: 'ready' | 'processing' | 'failed';
    };

type Finding = {
  id: string;
  patientId: string;
  encounterId: string;
  specialty: Specialty;
  status: 'draft' | 'final';
  title: string;
  note?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  tags?: string[];
  location: ChartLocation;
  evidence: EvidenceRef[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

// Local-only pins (until server annotations GET exists)
type LocalPin = {
  id: string;
  evidenceKey: string; // findingId + index (since evidence has no id)
  x: number; // 0..1
  y: number; // 0..1
  label: string;
  createdAt: string;
  status: 'pending' | 'saved' | 'failed';
};

const FINDING_TYPES = [
  { key: 'redness', label: 'Redness' },
  { key: 'irritation', label: 'Irritation' },
  { key: 'lesion_suspected', label: 'Lesion suspected' },
  { key: 'discharge', label: 'Discharge' },
  { key: 'vision_change', label: 'Vision change' },
  { key: 'dry_eye', label: 'Dry eye' },
  { key: 'other', label: 'Other' },
] as const;

type FindingTypeKey = (typeof FINDING_TYPES)[number]['key'];

const ZONES = [
  { id: 'lid', label: 'Lid' },
  { id: 'conjunctiva', label: 'Conjunctiva' },
  { id: 'cornea', label: 'Cornea' },
  { id: 'sclera', label: 'Sclera' },
  { id: 'pupil_iris', label: 'Pupil/Iris' },
  { id: 'unknown', label: 'Unspecified' },
] as const;

type ZoneId = (typeof ZONES)[number]['id'];

type OptometryWorkspaceProps = {
  patientId?: string;
  encounterId?: string;
  clinicianId?: string;
};

type Banner = { kind: 'info' | 'success' | 'error'; text: string } | null;

function nowISO() {
  return new Date().toISOString();
}

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function makeThumbUrl(url: string) {
  // In real impl, server generates thumbs. For local object URLs, just reuse.
  return url;
}

function mockEvidence(label: string): EvidenceRef {
  const t = Date.now();
  return {
    kind: 'image',
    device: 'other',
    capturedTs: t,
    url: `https://placehold.co/1200x800?text=${encodeURIComponent(label)}`,
    thumbnailUrl: `https://placehold.co/320x200?text=${encodeURIComponent(label)}`,
    status: 'ready',
  };
}

function severityTone(s?: Finding['severity']) {
  if (s === 'severe') return 'border-rose-200 bg-rose-50 text-rose-900';
  if (s === 'moderate') return 'border-amber-200 bg-amber-50 text-amber-900';
  if (s === 'mild') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  return 'border-gray-200 bg-white text-gray-700';
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

function PillBtn(props: { label: string; active?: boolean; onClick?: () => void; tone?: 'blue' | 'slate'; title?: string }) {
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

export default function OptometryWorkspacePage(props: OptometryWorkspaceProps) {
  const patientId = props.patientId ?? 'pat_demo_001';
  const encounterId = props.encounterId ?? 'enc_demo_001';
  const clinicianId = props.clinicianId ?? 'clin_demo_001';

  const storageKey = useMemo(() => `optometry-ws-v2:${patientId}:${encounterId}`, [patientId, encounterId]);
  const didLoadRef = useRef(false);

  const [eye, setEye] = useState<Eye>('OD');
  const [zone, setZone] = useState<ZoneId>('unknown');

  // Exam template fields (MVP)
  const [vaOD, setVaOD] = useState<string>('');
  const [vaOS, setVaOS] = useState<string>('');
  const [symptoms, setSymptoms] = useState({
    redness: false,
    pain: false,
    discharge: false,
    photophobia: false,
    blurredVision: false,
    itching: false,
  });
  const [symptomNote, setSymptomNote] = useState('');

  // Media library (local-only)
  type MediaItem = {
    id: string;
    kind: 'image' | 'video';
    name: string;
    url: string; // object URL
    createdAt: string;
  };

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);

  const selectedMedia = useMemo(() => media.find((m) => m.id === selectedMediaId) ?? null, [media, selectedMediaId]);

  // Findings (local-only)
  const [findings, setFindings] = useState<Finding[]>([]);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);

  // pins (local list; in future becomes server-truth)
  const [pins, setPins] = useState<LocalPin[]>([]);

  // UI state
  const [banner, setBanner] = useState<Banner>(null);
  const [busy, setBusy] = useState(false);

  // Hide (soft delete) until DELETE exists
  const [hiddenFindingIds, setHiddenFindingIds] = useState<Set<string>>(() => new Set());
  const [hiddenMediaIds, setHiddenMediaIds] = useState<Set<string>>(() => new Set());

  // Undo-hide
  const undoTimerRef = useRef<number | null>(null);
  const [undoState, setUndoState] = useState<{ visible: boolean; text: string; restore?: () => void }>({
    visible: false,
    text: '',
  });

  // search + filters
  const [search, setSearch] = useState('');
  const [showOnlyWithEvidence, setShowOnlyWithEvidence] = useState(false);

  // ---------- Load / persist ----------
  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as any;

      if (parsed.eye === 'OD' || parsed.eye === 'OS') setEye(parsed.eye);
      if (typeof parsed.zone === 'string' && ZONES.some((z) => z.id === parsed.zone)) setZone(parsed.zone);

      if (typeof parsed.vaOD === 'string') setVaOD(parsed.vaOD);
      if (typeof parsed.vaOS === 'string') setVaOS(parsed.vaOS);
      if (parsed.symptoms && typeof parsed.symptoms === 'object') setSymptoms(parsed.symptoms);
      if (typeof parsed.symptomNote === 'string') setSymptomNote(parsed.symptomNote);

      if (Array.isArray(parsed.media)) setMedia(parsed.media);
      if (typeof parsed.selectedMediaId === 'string' || parsed.selectedMediaId === null) setSelectedMediaId(parsed.selectedMediaId);

      if (Array.isArray(parsed.findings)) setFindings(parsed.findings);
      if (typeof parsed.selectedFindingId === 'string' || parsed.selectedFindingId === null) setSelectedFindingId(parsed.selectedFindingId);

      if (Array.isArray(parsed.pins)) setPins(parsed.pins);

      if (Array.isArray(parsed.hiddenFindingIds)) setHiddenFindingIds(new Set(parsed.hiddenFindingIds));
      if (Array.isArray(parsed.hiddenMediaIds)) setHiddenMediaIds(new Set(parsed.hiddenMediaIds));

      if (typeof parsed.search === 'string') setSearch(parsed.search);
      if (typeof parsed.showOnlyWithEvidence === 'boolean') setShowOnlyWithEvidence(parsed.showOnlyWithEvidence);
    } catch {
      // ignore
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          eye,
          zone,
          vaOD,
          vaOS,
          symptoms,
          symptomNote,
          media,
          selectedMediaId,
          findings,
          selectedFindingId,
          pins,
          hiddenFindingIds: Array.from(hiddenFindingIds),
          hiddenMediaIds: Array.from(hiddenMediaIds),
          search,
          showOnlyWithEvidence,
        })
      );
    } catch {
      // ignore
    }
  }, [
    storageKey,
    eye,
    zone,
    vaOD,
    vaOS,
    symptoms,
    symptomNote,
    media,
    selectedMediaId,
    findings,
    selectedFindingId,
    pins,
    hiddenFindingIds,
    hiddenMediaIds,
    search,
    showOnlyWithEvidence,
  ]);

  // cleanup object URLs on unmount (best effort)
  useEffect(() => {
    return () => {
      try {
        for (const m of media) {
          if (m.url.startsWith('blob:')) URL.revokeObjectURL(m.url);
        }
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleMedia = useMemo(() => media.filter((m) => !hiddenMediaIds.has(m.id)), [media, hiddenMediaIds]);
  const visibleFindings = useMemo(() => findings.filter((f) => !hiddenFindingIds.has(f.id)), [findings, hiddenFindingIds]);

  const eyeCounts = useMemo(() => {
    const c = { OD: 0, OS: 0 } as Record<Eye, number>;
    for (const f of visibleFindings) c[f.location.eye] += 1;
    return c;
  }, [visibleFindings]);

  const findingsForEye = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleFindings
      .filter((f) => f.location.eye === eye)
      .filter((f) => {
        if (!q) return true;
        const hay = `${f.title ?? ''} ${f.note ?? ''} ${(f.tags ?? []).join(' ')}`.toLowerCase();
        return hay.includes(q);
      })
      .filter((f) => {
        if (!showOnlyWithEvidence) return true;
        return f.evidence.length > 0;
      })
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [visibleFindings, eye, search, showOnlyWithEvidence]);

  const selectedFinding = useMemo(
    () => visibleFindings.find((f) => f.id === selectedFindingId) ?? null,
    [visibleFindings, selectedFindingId]
  );

  const evidenceForEye = useMemo(() => {
    const items: { ev: EvidenceRef; findingId: string; idx: number }[] = [];
    for (const f of findingsForEye) {
      f.evidence.forEach((ev, idx) => items.push({ ev, findingId: f.id, idx }));
    }
    return items.sort((a, b) => {
      const ta = a.ev.kind === 'image' ? a.ev.capturedTs : a.ev.startTs;
      const tb = b.ev.kind === 'image' ? b.ev.capturedTs : b.ev.startTs;
      return (tb ?? 0) - (ta ?? 0);
    });
  }, [findingsForEye]);

  const [selectedEvidenceKey, setSelectedEvidenceKey] = useState<string | null>(null);

  const selectedEvidence = useMemo(() => {
    if (!selectedEvidenceKey) return null;
    const [fid, idxStr] = selectedEvidenceKey.split(':');
    const idx = Number(idxStr);
    if (!fid || !Number.isFinite(idx)) return null;
    const f = visibleFindings.find((x) => x.id === fid);
    const ev = f?.evidence?.[idx];
    if (!f || !ev) return null;
    return { findingId: f.id, idx, ev };
  }, [selectedEvidenceKey, visibleFindings]);

  const pinsForSelectedEvidence = useMemo(() => {
    if (!selectedEvidence) return [];
    return pins.filter((p) => p.evidenceKey === `${selectedEvidence.findingId}:${selectedEvidence.idx}`);
  }, [pins, selectedEvidence]);

  const totalEvidence = useMemo(() => visibleFindings.reduce((sum, f) => sum + f.evidence.length, 0), [visibleFindings]);

  const lastEvidenceAt = useMemo(() => {
    const first = evidenceForEye[0]?.ev;
    if (!first) return '—';
    const ts = first.kind === 'image' ? first.capturedTs : first.startTs;
    return ts ? new Date(ts).toLocaleString() : '—';
  }, [evidenceForEye]);

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

  const hideMediaWithUndo = (id: string) => {
    const victim = visibleMedia.find((m) => m.id === id);
    if (!victim) return;
    setHiddenMediaIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    if (selectedMediaId === id) setSelectedMediaId(null);
    showUndo(`Hidden “${victim.name}” from the library.`, () => {
      setHiddenMediaIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    });
  };

  const locationFor = (eye0: Eye, zone0: ZoneId): ChartLocation => ({
    kind: 'eye',
    eye: eye0,
    zoneId: zone0 !== 'unknown' ? zone0 : undefined,
  });

  const createFinding = (type: FindingTypeKey, severity?: Finding['severity'], note?: string, evidence?: EvidenceRef[]) => {
    const zoneTag = zone !== 'unknown' ? `zone:${zone}` : undefined;
    const f: Finding = {
      id: uid('fd'),
      patientId,
      encounterId,
      specialty: 'optometry',
      status: 'draft',
      title: FINDING_TYPES.find((x) => x.key === type)?.label ?? 'Finding',
      note: note?.trim() ? note.trim() : undefined,
      severity,
      tags: ['optometry', ...(zoneTag ? [zoneTag] : [])],
      location: locationFor(eye, zone),
      evidence: evidence ?? [],
      createdAt: nowISO(),
      updatedAt: nowISO(),
      createdBy: clinicianId,
    };
    setFindings((prev) => [f, ...prev]);
    setSelectedFindingId(f.id);
    setBanner({ kind: 'success', text: 'Finding created (local). Wire POST /findings next.' });
  };

  const updateSelectedFindingLocal = (patch: Partial<Finding>) => {
    if (!selectedFinding) return;
    setFindings((prev) => prev.map((f) => (f.id === selectedFinding.id ? { ...f, ...patch, updatedAt: nowISO() } : f)));
  };

  // Attach existing media to a finding (bookmark flow)
  const bookmarkSelectedMedia = (type: FindingTypeKey, severity?: Finding['severity'], note?: string) => {
    let ev: EvidenceRef;
    const t = Date.now();

    if (selectedMedia) {
      if (selectedMedia.kind === 'image') {
        ev = {
          kind: 'image',
          device: 'upload',
          capturedTs: t,
          url: selectedMedia.url,
          thumbnailUrl: makeThumbUrl(selectedMedia.url),
          status: 'ready',
        };
      } else {
        ev = {
          kind: 'video_clip',
          device: 'upload',
          startTs: t,
          endTs: t + 12000,
          url: selectedMedia.url,
          thumbnailUrl: makeThumbUrl(selectedMedia.url),
          status: 'ready',
        };
      }
    } else {
      ev = mockEvidence(`${eye} - Attached media (mock)`);
    }

    createFinding(type, severity, note, [ev]);
    setSelectedEvidenceKey(null);
  };

  const toggleSymptom = (k: keyof typeof symptoms) => setSymptoms((s) => ({ ...s, [k]: !s[k] }));

  const onUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const items: MediaItem[] = [];
    Array.from(files).forEach((f) => {
      const isVideo = f.type.startsWith('video/');
      const isImage = f.type.startsWith('image/');
      if (!isVideo && !isImage) return;
      const url = URL.createObjectURL(f);
      items.push({
        id: uid('m'),
        kind: isVideo ? 'video' : 'image',
        name: f.name,
        url,
        createdAt: nowISO(),
      });
    });

    if (items.length) {
      setMedia((prev) => [...items, ...prev]);
      setSelectedMediaId(items[0].id);
      setBanner({ kind: 'success', text: `Added ${items.length} file(s) to the library (local).` });
    }
  };

  const addPinToSelectedEvidence = async (x: number, y: number) => {
    if (!selectedEvidence) {
      setBanner({ kind: 'info', text: 'Select an evidence item first.' });
      return;
    }

    // NOTE: This is local-only in this scaffold. When you wire server annotations, replace this
    // with postAnnotation(...) and store evidenceId instead of evidenceKey.
    const key = `${selectedEvidence.findingId}:${selectedEvidence.idx}`;
    const label = zone !== 'unknown' ? `Concern (${eye}:${zone})` : `Concern (${eye})`;

    const local: LocalPin = {
      id: uid('pin'),
      evidenceKey: key,
      x: clamp01(x),
      y: clamp01(y),
      label,
      createdAt: nowISO(),
      status: 'saved',
    };

    setPins((prev) => [local, ...prev]);
    setBanner({ kind: 'success', text: 'Pin saved (local). Wire POST /annotations next.' });
  };

  const headerEyeLabel = eye === 'OD' ? 'Right eye (OD)' : 'Left eye (OS)';
  const vaLabel = eye === 'OD' ? (vaOD || '—') : (vaOS || '—');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* PREMIUM HEADER */}
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="text-sm text-gray-500">Ambulant+ Workspace</div>
              <div className="flex items-end gap-3">
                <h1 className="text-lg font-semibold text-gray-900">Optometry Workspace</h1>
                <span className="text-xs text-gray-500">Phase 1 · Local-first “world-class” UX</span>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Patient: <span className="font-mono">{patientId}</span> · Encounter: <span className="font-mono">{encounterId}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatCard label="Selected eye" value={headerEyeLabel} sub={zone === 'unknown' ? 'Zone: —' : `Zone: ${zone}`} />
              <StatCard label="VA (selected)" value={vaLabel} sub={`OD: ${vaOD || '—'} · OS: ${vaOS || '—'}`} />
              <StatCard label="Findings" value={visibleFindings.length} sub={`OD: ${eyeCounts.OD} · OS: ${eyeCounts.OS}`} />
              <StatCard label="Evidence" value={totalEvidence} sub={`Last: ${lastEvidenceAt}`} />
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
          {/* LEFT: Eye chart + findings list */}
          <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Eye Map</div>
                  <div className="text-xs text-gray-500">Select OD/OS + zone and review findings</div>
                </div>
                <div className="text-xs text-gray-500">{eyeCounts[eye]} finding(s) for {eye}</div>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <EyeToggle
                eye={eye}
                onChange={(e) => {
                  setEye(e);
                  setSelectedEvidenceKey(null);
                  setSelectedFindingId(null);
                  setBanner(null);
                }}
                counts={eyeCounts}
              />

              {/* Zone selection */}
              <div className="rounded-xl border bg-gradient-to-b from-slate-50 to-white p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-gray-700">Zone</div>
                    <div className="text-[11px] text-gray-500">Tags findings + pins (until a real segmented eye model exists).</div>
                  </div>
                  <div className="text-[11px] text-gray-500">{headerEyeLabel}</div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {ZONES.map((z) => (
                    <button
                      key={z.id}
                      type="button"
                      onClick={() => setZone(z.id)}
                      className={
                        'rounded-lg border px-3 py-2 text-left ' +
                        (zone === z.id ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50')
                      }
                    >
                      <div className="text-xs font-semibold text-gray-900">{z.label}</div>
                      <div className="text-[11px] text-gray-500">{z.id === 'unknown' ? 'Not set' : `zone:${z.id}`}</div>
                    </button>
                  ))}
                </div>

                <div className="mt-3 rounded-lg border bg-white px-3 py-2">
                  <div className="text-xs text-gray-600">
                    Selected: <span className="font-mono font-semibold text-gray-900">{zone}</span>
                  </div>
                </div>
              </div>

              {/* Findings list */}
              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-gray-700">Findings</div>
                  <label className="text-[11px] text-gray-600 flex items-center gap-2 select-none">
                    <input type="checkbox" checked={showOnlyWithEvidence} onChange={() => setShowOnlyWithEvidence((v) => !v)} />
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
                  {findingsForEye.length === 0 ? (
                    <div className="text-sm text-gray-600 italic">No findings for this eye yet.</div>
                  ) : (
                    <ul className="space-y-2">
                      {findingsForEye.map((f) => {
                        const active = f.id === selectedFindingId;
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
                                className="w-full text-left p-3"
                                onClick={() => {
                                  setSelectedFindingId(f.id);
                                  setBanner(null);
                                }}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-gray-900 truncate">{f.title}</div>
                                    <div className="text-xs text-gray-500">
                                      {f.status.toUpperCase()} · {new Date(f.updatedAt).toLocaleString()}
                                      {f.location.zoneId ? ` · zone:${f.location.zoneId}` : ''}
                                    </div>
                                  </div>
                                  <span className="text-[11px] rounded-full border px-2 py-0.5 bg-gray-50 text-gray-700">
                                    {f.evidence.length} evidence
                                  </span>
                                </div>
                                {f.note ? <div className="mt-2 text-sm text-gray-700 line-clamp-2">{f.note}</div> : null}
                                <div className="mt-2 text-[11px]">
                                  {f.severity ? (
                                    <span className={'inline-flex items-center rounded-full border px-2 py-0.5 ' + severityTone(f.severity)}>
                                      {f.severity}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">severity: —</span>
                                  )}
                                  {f.tags?.length ? <span className="ml-2 text-gray-400">· {f.tags.slice(0, 2).join(', ')}</span> : null}
                                </div>
                              </button>

                              <div className="px-3 pb-3 flex items-center justify-end">
                                <button
                                  type="button"
                                  className="text-xs rounded-full border bg-white hover:bg-gray-50 px-2.5 py-1"
                                  onClick={() => hideFindingWithUndo(f.id)}
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
                  Inline edit is <span className="font-semibold">local-only</span> until PATCH endpoints exist.
                </div>
              </div>
            </div>
          </section>

          {/* CENTER: Media viewer + evidence timeline */}
          <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">Media</div>
                <div className="text-xs text-gray-500">Upload/select media and attach to findings</div>
              </div>

              <label className="text-xs rounded-full border bg-white hover:bg-gray-50 px-3 py-1.5 cursor-pointer">
                Upload
                <input type="file" className="hidden" accept="image/*,video/*" multiple onChange={(e) => onUpload(e.target.files)} />
              </label>
            </div>

            <div className="p-4 space-y-3">
              <div className="rounded-xl border bg-gradient-to-b from-slate-50 to-white overflow-hidden">
                <div className="border-b px-3 py-2 flex items-center justify-between gap-3">
                  <div className="text-xs text-gray-600">
                    Selected: <span className="font-semibold text-gray-900">{selectedMedia ? selectedMedia.name : '—'}</span>
                  </div>
                  {selectedMedia ? (
                    <button
                      type="button"
                      className="rounded-full border bg-white hover:bg-gray-50 px-2.5 py-1 text-xs"
                      onClick={() => hideMediaWithUndo(selectedMedia.id)}
                      title="Hide from UI (until DELETE exists)"
                    >
                      Hide
                    </button>
                  ) : null}
                </div>

                <div className="relative h-64 bg-gray-100 overflow-hidden">
                  {selectedMedia ? (
                    selectedMedia.kind === 'image' ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={selectedMedia.url} alt={selectedMedia.name} className="absolute inset-0 h-full w-full object-contain" />
                        <div className="absolute bottom-3 left-3 right-3 rounded-lg border bg-white/85 backdrop-blur px-3 py-2 text-xs text-gray-700">
                          Upload preview · Attach it to a finding on the right.
                        </div>
                      </>
                    ) : (
                      <video src={selectedMedia.url} controls className="h-full w-full object-contain" />
                    )
                  ) : (
                    <div className="h-full grid place-items-center text-gray-600">
                      <div className="text-center px-6">
                        <div className="text-sm font-medium">No media selected</div>
                        <div className="text-xs text-gray-500 mt-1">Upload an image/video to begin</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Library */}
              <div>
                <div className="text-xs font-semibold text-gray-700">Library</div>
                <div className="mt-2 flex gap-2 overflow-auto pb-1">
                  {visibleMedia.length === 0 ? (
                    <div className="text-sm text-gray-600 italic">No uploads yet.</div>
                  ) : (
                    visibleMedia.map((m) => {
                      const active = m.id === selectedMediaId;
                      return (
                        <button
                          key={m.id}
                          className={
                            'min-w-[180px] max-w-[180px] rounded-lg border overflow-hidden bg-white text-left ' +
                            (active ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200 hover:bg-gray-50')
                          }
                          onClick={() => setSelectedMediaId(m.id)}
                          aria-pressed={active}
                          type="button"
                        >
                          <div className="h-20 bg-gray-100 grid place-items-center">
                            <span className="text-xs text-gray-500">{m.kind === 'image' ? 'Image' : 'Video'}</span>
                          </div>
                          <div className="p-2">
                            <div className="text-xs font-medium text-gray-800 truncate">{m.name}</div>
                            <div className="text-[11px] text-gray-500">{new Date(m.createdAt).toLocaleTimeString()}</div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Evidence timeline */}
              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-gray-700">Evidence for {eye}</div>
                  <div className="text-[11px] text-gray-500">
                    Select an evidence tile below to view pins · Click image to add a pin.
                  </div>
                </div>

                <EvidenceTimeline
                  evidence={evidenceForEye}
                  selectedKey={selectedEvidenceKey}
                  onSelect={(k) => setSelectedEvidenceKey(k)}
                />
              </div>

              {/* Evidence viewer (for evidence, not uploads) */}
              <div className="rounded-xl border bg-gradient-to-b from-slate-50 to-white overflow-hidden">
                <div className="border-b px-3 py-2 flex items-center justify-between gap-3">
                  <div className="text-xs text-gray-600">
                    Evidence selected:{' '}
                    <span className="font-semibold text-gray-900">{selectedEvidence ? selectedEvidence.ev.kind : '—'}</span>
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Pins: <span className="font-mono font-semibold">{pinsForSelectedEvidence.length}</span>
                  </div>
                </div>

                <div className="relative h-56 bg-gray-100">
                  {!selectedEvidence ? (
                    <div className="h-full grid place-items-center text-gray-600">
                      <div className="text-center px-6">
                        <div className="text-sm font-medium">No evidence selected</div>
                        <div className="text-xs text-gray-500 mt-1">Attach media to a finding, then pick it from the timeline.</div>
                      </div>
                    </div>
                  ) : selectedEvidence.ev.kind === 'image' ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={selectedEvidence.ev.url} alt="Evidence" className="absolute inset-0 h-full w-full object-contain" />

                      {/* pins */}
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
                            <div className="w-6 h-6 rounded-full grid place-items-center text-[11px] font-semibold shadow bg-blue-600 text-white">
                              •
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* click to pin */}
                      <button
                        type="button"
                        className="absolute inset-0"
                        onClick={(e) => {
                          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                          const x = (e.clientX - rect.left) / rect.width;
                          const y = (e.clientY - rect.top) / rect.height;
                          void addPinToSelectedEvidence(x, y);
                        }}
                        title="Click to add a pin (local in scaffold)"
                        style={{ background: 'transparent' }}
                      />

                      <div className="absolute bottom-3 left-3 right-3 rounded-lg border bg-white/85 backdrop-blur px-3 py-2 text-xs text-gray-700 flex items-center justify-between">
                        <div className="truncate">
                          Evidence image · <span className="text-gray-500">click to add pin</span>
                        </div>
                        <span className="rounded-full border bg-white px-2 py-0.5">
                          Pins: <span className="font-mono font-semibold">{pinsForSelectedEvidence.length}</span>
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="h-full w-full grid place-items-center text-gray-700">
                      <div className="text-center px-6">
                        <div className="text-sm font-medium">Video clip</div>
                        <div className="text-xs text-gray-500 mt-1">(Pins on video later; requires timeline + player integration.)</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT: Exam + attach + composer + inline edit + plan */}
          <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b px-4 py-3">
              <div className="text-sm font-semibold text-gray-900">Exam & Findings</div>
              <div className="text-xs text-gray-500">VA + symptoms + attach selected media → finding</div>
            </div>

            <div className="p-4 space-y-4">
              <ExamPanel
                vaOD={vaOD}
                vaOS={vaOS}
                setVaOD={setVaOD}
                setVaOS={setVaOS}
                symptoms={symptoms}
                toggleSymptom={toggleSymptom}
                symptomNote={symptomNote}
                setSymptomNote={setSymptomNote}
              />

              <BookmarkButton eye={eye} hasMedia={!!selectedMedia} onBookmark={bookmarkSelectedMedia} zone={zone} />

              <QuickFindingComposer onCreate={createFinding} />

              {/* Inline edit */}
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
                        />
                      </label>

                      <div>
                        <div className="text-xs text-gray-600">Severity</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(['mild', 'moderate', 'severe'] as const).map((s) => (
                            <PillBtn key={s} label={s} active={selectedFinding.severity === s} tone="blue" onClick={() => updateSelectedFindingLocal({ severity: s })} />
                          ))}
                          <PillBtn label="—" active={!selectedFinding.severity} onClick={() => updateSelectedFindingLocal({ severity: undefined })} />
                        </div>
                      </div>

                      <label className="text-xs text-gray-600 block">
                        Note
                        <textarea
                          className="mt-1 w-full rounded border px-2.5 py-2 text-sm"
                          rows={3}
                          value={selectedFinding.note ?? ''}
                          onChange={(e) => updateSelectedFindingLocal({ note: e.target.value })}
                        />
                      </label>

                      <div className="rounded-lg border bg-amber-50 border-amber-200 px-3 py-2 text-[11px] text-amber-900">
                        Local edit only: wire PATCH to make this server-truth.
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-lg border p-3 bg-gray-50">
                <div className="text-xs font-semibold text-gray-700">Plan (premium stub)</div>
                <div className="mt-1 text-sm text-gray-700">Next: follow-up schedule + referral summary + patient instructions.</div>
                <button type="button" className="mt-2 text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50" onClick={() => alert('Stub: add plan item')}>
                  + Add plan item
                </button>
              </div>

              <div className="rounded-lg border bg-white p-3">
                <div className="text-xs font-semibold text-gray-700">Roadmap (next wiring)</div>
                <ul className="mt-2 text-[11px] text-gray-600 list-disc pl-4 space-y-1">
                  <li>Swap local types for shared workspace types and call POST /findings, /evidence, /annotations.</li>
                  <li>Add GET endpoints for server-truth (stop using local-only state).</li>
                  <li>Replace zone list with segmented eye GLB + true hotspots (like physio/dental).</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function EyeToggle({
  eye,
  onChange,
  counts,
}: {
  eye: Eye;
  onChange: (eye: Eye) => void;
  counts: Record<Eye, number>;
}) {
  return (
    <div className="flex gap-2">
      {(['OD', 'OS'] as const).map((e) => {
        const active = e === eye;
        return (
          <button
            key={e}
            onClick={() => onChange(e)}
            className={
              'flex-1 rounded-lg border px-3 py-2 text-sm font-medium relative ' +
              (active ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-800')
            }
            aria-pressed={active}
            type="button"
          >
            {e}
            {counts[e] > 0 ? (
              <span className="absolute -top-1 -right-1 text-[10px] rounded-full bg-emerald-600 text-white px-1.5 py-0.5">
                {counts[e]}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function ExamPanel(props: {
  vaOD: string;
  vaOS: string;
  setVaOD: (v: string) => void;
  setVaOS: (v: string) => void;
  symptoms: Record<string, boolean>;
  toggleSymptom: (k: keyof any) => void;
  symptomNote: string;
  setSymptomNote: (v: string) => void;
}) {
  const { vaOD, vaOS, setVaOD, setVaOS, symptoms, toggleSymptom, symptomNote, setSymptomNote } = props;

  return (
    <div className="rounded-xl border p-3 bg-white">
      <div className="text-xs font-semibold text-gray-700">Exam Template (MVP)</div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-600">
          Visual Acuity (OD)
          <input className="mt-1 w-full rounded border px-2 py-2 text-sm" placeholder="e.g., 20/40" value={vaOD} onChange={(e) => setVaOD(e.target.value)} />
        </label>
        <label className="text-xs text-gray-600">
          Visual Acuity (OS)
          <input className="mt-1 w-full rounded border px-2 py-2 text-sm" placeholder="e.g., 20/20" value={vaOS} onChange={(e) => setVaOS(e.target.value)} />
        </label>
      </div>

      <div className="mt-3">
        <div className="text-xs font-medium text-gray-700">Symptoms</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(
            [
              ['redness', 'Redness'],
              ['pain', 'Pain'],
              ['discharge', 'Discharge'],
              ['photophobia', 'Photophobia'],
              ['blurredVision', 'Blurred vision'],
              ['itching', 'Itching'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={!!(symptoms as any)[k]} onChange={() => toggleSymptom(k)} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <label className="mt-3 block text-xs text-gray-600">
        Notes
        <textarea className="mt-1 w-full rounded border px-2 py-2 text-sm" rows={2} value={symptomNote} onChange={(e) => setSymptomNote(e.target.value)} placeholder="Optional symptom details…" />
      </label>

      <div className="mt-2 text-[11px] text-gray-500">Later: persist these fields on the encounter (structured observations).</div>
    </div>
  );
}

function QuickFindingComposer({
  onCreate,
}: {
  onCreate: (type: FindingTypeKey, severity?: 'mild' | 'moderate' | 'severe', note?: string) => void;
}) {
  const [type, setType] = useState<FindingTypeKey>('redness');
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe' | ''>('mild');
  const [note, setNote] = useState('');

  const templates: { label: string; apply: () => void }[] = [
    { label: 'Dry eye (mild)', apply: () => { setType('dry_eye'); setSeverity('mild'); setNote('Dry eye signs noted; consider lubricants and environmental triggers.'); } },
    { label: 'Redness (moderate)', apply: () => { setType('redness'); setSeverity('moderate'); setNote('Moderate conjunctival injection observed.'); } },
    { label: 'Vision change (urgent)', apply: () => { setType('vision_change'); setSeverity('severe'); setNote('Reported acute vision change—consider urgent assessment and referral if needed.'); } },
  ];

  return (
    <div className="rounded-xl border p-3 bg-white">
      <div className="text-xs font-semibold text-gray-700">New Finding</div>
      <div className="text-[11px] text-gray-500 mt-0.5">Fast capture with templates.</div>

      <div className="mt-3 flex flex-wrap gap-2">
        {templates.map((t) => (
          <button key={t.label} type="button" className="rounded-full border bg-gray-50 hover:bg-gray-100 px-3 py-1.5 text-xs text-gray-800" onClick={t.apply}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <label className="text-xs text-gray-600">
          Type
          <select className="mt-1 w-full rounded border px-2 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value as FindingTypeKey)}>
            {FINDING_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-gray-600">
          Severity
          <select className="mt-1 w-full rounded border px-2 py-2 text-sm" value={severity} onChange={(e) => setSeverity(e.target.value as '' | 'mild' | 'moderate' | 'severe')}>
            <option value="">—</option>
            <option value="mild">mild</option>
            <option value="moderate">moderate</option>
            <option value="severe">severe</option>
          </select>
        </label>

        <label className="text-xs text-gray-600">
          Note
          <textarea className="mt-1 w-full rounded border px-2 py-2 text-sm" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional details…" />
        </label>

        <button
          type="button"
          className="mt-1 rounded-full border bg-blue-50 hover:bg-blue-100 px-3 py-2 text-sm font-medium text-blue-900"
          onClick={() => {
            onCreate(type, (severity || undefined) as 'mild' | 'moderate' | 'severe' | undefined, note);
            setNote('');
          }}
        >
          Create finding
        </button>
      </div>
    </div>
  );
}

function BookmarkButton({
  eye,
  hasMedia,
  onBookmark,
  zone,
}: {
  eye: Eye;
  hasMedia: boolean;
  onBookmark: (type: FindingTypeKey, severity?: 'mild' | 'moderate' | 'severe', note?: string) => void;
  zone: string;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FindingTypeKey>('redness');
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe' | ''>('mild');
  const [note, setNote] = useState('');

  return (
    <div className="rounded-xl border p-3 bg-white">
      <div className="text-xs font-semibold text-gray-700">Attach selected media → Finding</div>
      <div className="mt-1 text-sm text-gray-700">
        Eye: <span className="font-mono font-semibold">{eye}</span>
        {zone && zone !== 'unknown' ? <span className="text-gray-500"> · zone:{zone}</span> : null}
      </div>
      <div className="mt-1 text-xs text-gray-500">
        {hasMedia ? 'Will attach the currently selected media item.' : 'No media selected; will attach a mock placeholder.'}
      </div>

      <button
        type="button"
        className="mt-2 rounded-full border bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-800"
        onClick={() => setOpen(true)}
      >
        Bookmark / Attach
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-xl bg-white border shadow">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Attach to {eye}</div>
                <div className="text-xs text-gray-500">Creates a finding and links the selected media (local in scaffold)</div>
              </div>
              <button type="button" className="text-xs text-gray-600 hover:text-gray-900" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-700">
                Evidence preview: <span className="text-gray-500">(uses selected media if present)</span>
              </div>

              <label className="text-xs text-gray-600 block">
                Finding type
                <select className="mt-1 w-full rounded border px-2 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value as FindingTypeKey)}>
                  {FINDING_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-gray-600 block">
                Severity
                <select className="mt-1 w-full rounded border px-2 py-2 text-sm" value={severity} onChange={(e) => setSeverity(e.target.value as '' | 'mild' | 'moderate' | 'severe')}>
                  <option value="">—</option>
                  <option value="mild">mild</option>
                  <option value="moderate">moderate</option>
                  <option value="severe">severe</option>
                </select>
              </label>

              <label className="text-xs text-gray-600 block">
                Note
                <textarea className="mt-1 w-full rounded border px-2 py-2 text-sm" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional details…" />
              </label>

              <div className="flex items-center justify-end gap-2">
                <button type="button" className="rounded border px-3 py-2 text-sm hover:bg-gray-50" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded border bg-blue-50 hover:bg-blue-100 px-3 py-2 text-sm"
                  onClick={() => {
                    onBookmark(type, (severity || undefined) as any, note);
                    setOpen(false);
                    setNote('');
                  }}
                >
                  Save
                </button>
              </div>

              <div className="rounded-lg border bg-amber-50 border-amber-200 px-3 py-2 text-[11px] text-amber-900">
                When you wire POST endpoints, this modal becomes the “real” attach flow (finding + evidence + optional pin).
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EvidenceTimeline(props: {
  evidence: { ev: EvidenceRef; findingId: string; idx: number }[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  if (props.evidence.length === 0) {
    return <div className="mt-2 text-sm text-gray-600 italic">No attached evidence for this eye yet.</div>;
  }

  return (
    <div className="mt-2 flex gap-2 overflow-auto pb-1">
      {props.evidence.map((row) => {
        const key = `${row.findingId}:${row.idx}`;
        const active = props.selectedKey === key;
        const ev = row.ev;

        const ts = ev.kind === 'image' ? ev.capturedTs : ev.startTs;
        const time = ts ? new Date(ts).toLocaleTimeString() : '—';

        return (
          <button
            key={key}
            type="button"
            onClick={() => props.onSelect(key)}
            className={
              'min-w-[190px] max-w-[190px] rounded-lg border overflow-hidden bg-white text-left ' +
              (active ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200 hover:bg-gray-50')
            }
            aria-pressed={active}
          >
            <div className="h-24 bg-gray-100 grid place-items-center">
              <span className="text-xs text-gray-500">{ev.kind === 'image' ? 'Image' : 'Video'}</span>
            </div>
            <div className="p-2">
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
              <div className="text-[11px] text-gray-500">{time}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
