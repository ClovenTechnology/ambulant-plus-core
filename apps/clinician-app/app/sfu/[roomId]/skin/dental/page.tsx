// apps/clinician-app/app/sfu/[roomId]/skin/dental/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

/* =========================================================
   Types
========================================================= */
type ToothSystem = 'universal' | 'FDI';
type ToothSurface = 'O' | 'M' | 'D' | 'B' | 'L';

type DentalLocation = {
  kind: 'dental_tooth';
  toothSystem: ToothSystem;
  toothId: string;
  surface?: ToothSurface;
};

type EvidenceKind = 'image' | 'video_clip' | 'scan_3d';
type EvidenceStatus = 'ready' | 'processing' | 'failed';

type DentalEvidence = {
  id: string;
  patientId: string;
  encounterId: string;
  specialty: 'dental';
  findingId?: string | null;
  location: DentalLocation;

  kind: EvidenceKind;
  device: 'intraoral_cam' | 'otoscope' | 'upload' | 'scanner_3d' | 'other';

  url?: string | null;
  thumbnailUrl?: string | null;
  contentType?: string | null;

  status: EvidenceStatus;
  jobId?: string | null;

  capturedAt: string; // ISO
  meta?: any;
};

type DentalFinding = {
  id: string;
  patientId: string;
  encounterId: string;
  specialty: 'dental';
  status: 'draft' | 'final';
  title: string;
  note?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  tags?: string[];
  location: DentalLocation;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  meta?: any;
};

type DentalAnnotation = {
  id: string;
  patientId: string;
  encounterId: string;
  specialty: 'dental';
  evidenceId: string;
  findingId?: string | null;
  location: DentalLocation;
  type: 'pin' | 'comment';
  payload: any; // screen-pin or model-pin
  createdAt: string;
  createdBy: string;
};

type PlanItem = {
  id: string;
  patientId: string;
  encounterId: string;
  specialty: 'dental';
  toothId?: string;
  label: string;
  status: 'planned' | 'done';
  createdAt: string;
  createdBy: string;
};

type LabRevision = {
  id: string;
  patientId: string;
  encounterId: string;
  specialty: 'dental';
  revisionNo: number;
  createdAt: string;
  toothId?: string;
  note?: string;
  evidenceIds: string[];
  annotationCount: number;
  createdBy: string;
  meta?: any;
};

const FINDING_TYPES = [
  { key: 'caries_suspected', label: 'Caries suspected' },
  { key: 'fracture', label: 'Fracture' },
  { key: 'mobility', label: 'Mobility' },
  { key: 'sensitivity', label: 'Sensitivity' },
  { key: 'discoloration', label: 'Discoloration' },
  { key: 'swelling', label: 'Swelling' },
  { key: 'missing_tooth', label: 'Missing tooth' },
  { key: 'other', label: 'Other' },
] as const;

type FindingTypeKey = (typeof FINDING_TYPES)[number]['key'];

/* =========================================================
   Helpers
========================================================= */
function nowISO() {
  return new Date().toISOString();
}
function errMsg(e: any) {
  return e?.message || e?.details?.message || e?.error || 'Request failed';
}
function safeLower(v?: string | null) {
  return String(v || '').toLowerCase();
}
function looksLikeXray(ev: DentalEvidence) {
  const m = ev?.meta || {};
  const ct = safeLower(ev.contentType);
  const url = safeLower(ev.url);
  const tag = safeLower(m?.modality || m?.type || '');
  return (
    tag.includes('xray') ||
    tag.includes('x-ray') ||
    tag.includes('radiograph') ||
    ct.includes('dicom') ||
    url.includes('dicom') ||
    url.includes('xray') ||
    url.includes('x-ray')
  );
}
function extFromUrl(url: string) {
  const u = safeLower(url);
  const q = u.split('?')[0].split('#')[0];
  const m = q.match(/\.([a-z0-9]+)$/i);
  return m ? m[1] : '';
}
function guessContentTypeFromExt(ext: string) {
  if (ext === 'glb') return 'model/gltf-binary';
  if (ext === 'gltf') return 'model/gltf+json';
  if (ext === 'obj') return 'text/plain';
  if (ext === 'stl') return 'model/stl';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'mp4') return 'video/mp4';
  return undefined;
}

/* ---------- Universal <-> FDI mapping (adult dentition) ---------- */
const UNIVERSAL_TO_FDI: Record<string, string> = {
  // Upper right 1..8 => 18..11
  '1': '18',
  '2': '17',
  '3': '16',
  '4': '15',
  '5': '14',
  '6': '13',
  '7': '12',
  '8': '11',
  // Upper left 9..16 => 21..28
  '9': '21',
  '10': '22',
  '11': '23',
  '12': '24',
  '13': '25',
  '14': '26',
  '15': '27',
  '16': '28',
  // Lower left 17..24 => 38..31
  '17': '38',
  '18': '37',
  '19': '36',
  '20': '35',
  '21': '34',
  '22': '33',
  '23': '32',
  '24': '31',
  // Lower right 25..32 => 41..48
  '25': '41',
  '26': '42',
  '27': '43',
  '28': '44',
  '29': '45',
  '30': '46',
  '31': '47',
  '32': '48',
};
const FDI_TO_UNIVERSAL: Record<string, string> = Object.fromEntries(
  Object.entries(UNIVERSAL_TO_FDI).map(([u, f]) => [f, u]),
);

function universalToFdi(universal: string) {
  return UNIVERSAL_TO_FDI[String(universal)] ?? null;
}
function fdiToUniversal(fdi: string) {
  return FDI_TO_UNIVERSAL[String(fdi)] ?? null;
}

// helper for consistent filtering/counts (selection stays universal)
function universalToothIdFromLocation(loc?: DentalLocation | null): string | null {
  if (!loc?.toothId) return null;
  if (loc.toothSystem === 'FDI') return fdiToUniversal(loc.toothId);
  return String(loc.toothId);
}

function toothNodeName(_scheme: 'FDI' | 'universal', toothId: string) {
  return `tooth_${String(toothId)}`;
}
function meshNameToToothId(name: string): { scheme: 'FDI' | 'universal'; toothId: string } | null {
  const n = String(name || '');
  const m = n.match(/tooth[_-]?(\d{1,2})$/i) || n.match(/tooth[_-]?(\d{1,2})\b/i);
  if (!m) return null;
  const id = m[1];
  const num = Number(id);
  if (num >= 11 && num <= 48) return { scheme: 'FDI', toothId: id };
  return { scheme: 'universal', toothId: id };
}

/* ---------- Annotation payloads ---------- */
type ScreenPinPayload = { kind: 'screen'; x: number; y: number; label?: string };
type ModelPinPayload = {
  kind: 'model';
  meshId: string; // node/mesh name (e.g., tooth_11)
  p: [number, number, number]; // hitpoint in mesh local space
  n?: [number, number, number]; // normal in mesh local space (face normal)
  label?: string;
};

/* Default to /api because your clinician-app routes live under app/api/* */
const API_BASE = (process.env.NEXT_PUBLIC_WORKSPACE_API_BASE || '/api').replace(/\/+$/, '');

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
  return ((json?.items ?? json?.data ?? json) as T) ?? (json as T);
}
async function postJson<T>(path: string, body: any): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
  return (json?.item ?? json?.record ?? json?.data ?? json) as T;
}
async function patchJson<T>(path: string, body: any): Promise<T> {
  const res = await fetch(path, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
  return (json?.item ?? json?.record ?? json?.data ?? json) as T;
}

async function postFinding(req: Partial<DentalFinding>): Promise<DentalFinding> {
  return postJson<DentalFinding>(`${API_BASE}/findings`, req);
}
async function postEvidence(req: Partial<DentalEvidence>): Promise<DentalEvidence> {
  return postJson<DentalEvidence>(`${API_BASE}/evidence`, req);
}
async function postAnnotation(req: Partial<DentalAnnotation>): Promise<DentalAnnotation> {
  return postJson<DentalAnnotation>(`${API_BASE}/annotations`, req);
}
async function postRevision(req: Partial<LabRevision>): Promise<LabRevision> {
  return postJson<LabRevision>(`${API_BASE}/revisions`, req);
}
async function postPlanItem(req: Partial<PlanItem>): Promise<PlanItem> {
  return postJson<PlanItem>(`${API_BASE}/plan-items`, req);
}
async function patchPlanItem(req: Partial<PlanItem> & { id: string }): Promise<PlanItem> {
  return patchJson<PlanItem>(`${API_BASE}/plan-items`, req);
}

/* =========================================================
   Page
========================================================= */
export default function DentalWorkspacePage() {
  const params = useParams<{ roomId?: string }>();
  const sp = useSearchParams();

  // Allow query overrides, but keep strong defaults for demo/dev
  const patientId = sp.get('patientId') ?? 'pat_demo_001';
  const encounterId = sp.get('encounterId') ?? 'enc_demo_001';
  const clinicianId = sp.get('clinicianId') ?? 'clin_demo_001';
  const roomId = params?.roomId ? String(params.roomId) : null;

  const [toothSystem, setToothSystem] = useState<ToothSystem>('universal');
  const [selectedTooth, setSelectedTooth] = useState<string>('14');
  const [selectedSurface, setSelectedSurface] = useState<ToothSurface | undefined>(undefined);

  // server-truth caches
  const [findings, setFindings] = useState<DentalFinding[]>([]);
  const [evidence, setEvidence] = useState<DentalEvidence[]>([]);
  const [annotations, setAnnotations] = useState<DentalAnnotation[]>([]);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [revisions, setRevisions] = useState<LabRevision[]>([]);

  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);

  const [bookmarkOpen, setBookmarkOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ kind: 'info' | 'success' | 'error'; text: string } | null>(
    null,
  );

  // Preview tab: show Teeth3D always, but allow switching to evidence
  const [previewMode, setPreviewMode] = useState<'teeth3d' | 'evidence'>('teeth3d');

  const q = useMemo(() => {
    const s = new URLSearchParams();
    s.set('patientId', patientId);
    s.set('encounterId', encounterId);
    s.set('specialty', 'dental');
    return s.toString();
  }, [patientId, encounterId]);

  const refreshAll = async () => {
    const [f, e, a, p, r] = await Promise.all([
      getJson<{ ok: true; items: DentalFinding[] }>(`${API_BASE}/findings?${q}`).then(
        (x: any) => x.items ?? x,
      ),
      getJson<{ ok: true; items: DentalEvidence[] }>(`${API_BASE}/evidence?${q}`).then(
        (x: any) => x.items ?? x,
      ),
      getJson<{ ok: true; items: DentalAnnotation[] }>(`${API_BASE}/annotations?${q}`).then(
        (x: any) => x.items ?? x,
      ),
      getJson<{ ok: true; items: PlanItem[] }>(`${API_BASE}/plan-items?${q}`).then(
        (x: any) => x.items ?? x,
      ),
      getJson<{ ok: true; items: LabRevision[] }>(`${API_BASE}/revisions?${q}`).then(
        (x: any) => x.items ?? x,
      ),
    ]);

    setFindings(Array.isArray(f) ? f : []);
    setEvidence(Array.isArray(e) ? e : []);
    setAnnotations(Array.isArray(a) ? a : []);
    setPlanItems(Array.isArray(p) ? p : []);
    setRevisions(Array.isArray(r) ? r : []);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setBanner(null);
        await refreshAll();
      } catch (e) {
        if (!cancelled) setBanner({ kind: 'error', text: `Failed to load dental data: ${errMsg(e)}` });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const locationForSelection = (): DentalLocation => {
    // UI selection stays universal (1..32). When user has “FDI” selected, store toothId in FDI if possible.
    const toothId =
      toothSystem === 'FDI' ? (universalToFdi(selectedTooth) ?? selectedTooth) : selectedTooth;

    return {
      kind: 'dental_tooth',
      toothSystem,
      toothId: String(toothId),
      surface: selectedSurface,
    };
  };

  const findingsForSelection = useMemo(() => {
    return findings
      .filter((f) => {
        const uni = universalToothIdFromLocation(f.location);
        return f.location.kind === 'dental_tooth' && uni === selectedTooth;
      })
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [findings, selectedTooth]);

  const evidenceForSelection = useMemo(() => {
    return evidence
      .filter((ev) => {
        const uni = universalToothIdFromLocation(ev.location);
        return ev.location.kind === 'dental_tooth' && uni === selectedTooth;
      })
      .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
  }, [evidence, selectedTooth]);

  const toothCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of findings) {
      const uni = universalToothIdFromLocation(f.location);
      if (!uni) continue;
      map.set(uni, (map.get(uni) ?? 0) + 1);
    }
    return map;
  }, [findings]);

  const selectedEvidence = useMemo(() => {
    return evidence.find((e) => e.id === selectedEvidenceId) ?? null;
  }, [evidence, selectedEvidenceId]);

  useEffect(() => {
    if (selectedEvidenceId) setPreviewMode('evidence');
  }, [selectedEvidenceId]);

  // clear selected evidence when switching teeth
  useEffect(() => {
    if (!selectedEvidenceId) return;
    const stillVisible = evidenceForSelection.some((e) => e.id === selectedEvidenceId);
    if (!stillVisible) setSelectedEvidenceId(null);
  }, [selectedTooth, evidenceForSelection, selectedEvidenceId]);

  const evidenceCountForFinding = (findingId: string) =>
    evidence.filter((e) => e.findingId === findingId).length;

  const annotationsForSelectedEvidence = useMemo(() => {
    if (!selectedEvidenceId) return [];
    return annotations.filter((a) => a.evidenceId === selectedEvidenceId);
  }, [annotations, selectedEvidenceId]);

  const createManualFinding = async (
    type: FindingTypeKey,
    severity?: DentalFinding['severity'],
    note?: string,
  ) => {
    const title = FINDING_TYPES.find((x) => x.key === type)?.label ?? 'Finding';
    const loc = locationForSelection();

    setBanner(null);
    setBusy(true);
    try {
      await postFinding({
        patientId,
        encounterId,
        specialty: 'dental',
        status: 'draft',
        title,
        severity,
        note: note?.trim() ? note.trim() : undefined,
        tags: ['dental'],
        location: loc,
        createdBy: clinicianId,
      });
      await refreshAll();
      setBanner({ kind: 'success', text: 'Finding saved.' });
    } catch (e) {
      setBanner({ kind: 'error', text: `Failed to save finding: ${errMsg(e)}` });
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const addDemoPinAnnotation = async () => {
    if (!selectedEvidence) {
      setBanner({ kind: 'info', text: 'Select an evidence item first.' });
      return;
    }

    setBanner(null);
    setBusy(true);
    try {
      await postAnnotation({
        patientId,
        encounterId,
        specialty: 'dental',
        evidenceId: selectedEvidence.id,
        findingId: selectedEvidence.findingId ?? null,
        location: selectedEvidence.location,
        type: 'pin',
        payload: {
          kind: 'screen',
          x: 0.58,
          y: 0.42,
          label: `Adjust here (tooth ${
            universalToothIdFromLocation(selectedEvidence.location) ?? selectedEvidence.location.toothId
          })`,
        } satisfies ScreenPinPayload,
        createdBy: clinicianId,
      });
      await refreshAll();
      setBanner({ kind: 'success', text: 'Annotation created.' });
    } catch (e) {
      setBanner({ kind: 'error', text: `Failed to create annotation: ${errMsg(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const createScreenPinOnSelectedEvidence = async (x01: number, y01: number, label?: string) => {
    if (!selectedEvidence) return;
    setBusy(true);
    setBanner(null);
    try {
      await postAnnotation({
        patientId,
        encounterId,
        specialty: 'dental',
        evidenceId: selectedEvidence.id,
        findingId: selectedEvidence.findingId ?? null,
        location: selectedEvidence.location,
        type: 'pin',
        payload: { kind: 'screen', x: x01, y: y01, label: label || 'Pin' } satisfies ScreenPinPayload,
        createdBy: clinicianId,
      });
      await refreshAll();
      setBanner({ kind: 'success', text: 'Pin added.' });
    } catch (e) {
      setBanner({ kind: 'error', text: `Failed to add pin: ${errMsg(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const createModelPinOnSelectedEvidence = async (payload: ModelPinPayload, overrideToothId?: string) => {
    if (!selectedEvidence) return;
    setBusy(true);
    setBanner(null);

    const loc: DentalLocation = overrideToothId
      ? { ...selectedEvidence.location, toothId: String(overrideToothId) }
      : selectedEvidence.location;

    try {
      await postAnnotation({
        patientId,
        encounterId,
        specialty: 'dental',
        evidenceId: selectedEvidence.id,
        findingId: selectedEvidence.findingId ?? null,
        location: loc,
        type: 'pin',
        payload,
        createdBy: clinicianId,
      });
      await refreshAll();
      setBanner({ kind: 'success', text: '3D pin snapped to mesh.' });
    } catch (e) {
      setBanner({ kind: 'error', text: `Failed to add 3D pin: ${errMsg(e)}` });
    } finally {
      setBusy(false);
    }
  };

  // Bookmark creates live_capture evidence (jobs) — your worker later PATCHes url/jobId/status.
  const handleBookmark = async (payload: {
    toothId: string;
    surface?: ToothSurface;
    findingTypeKey: FindingTypeKey;
    severity?: DentalFinding['severity'];
    note?: string;
    alsoAddPin?: boolean;
  }) => {
    setBanner(null);
    setBusy(true);

    setSelectedTooth(payload.toothId);
    setSelectedSurface(payload.surface);

    const title = FINDING_TYPES.find((x) => x.key === payload.findingTypeKey)?.label ?? 'Finding';

    const storeToothId =
      toothSystem === 'FDI' ? (universalToFdi(payload.toothId) ?? payload.toothId) : payload.toothId;

    const loc: DentalLocation = {
      kind: 'dental_tooth',
      toothSystem,
      toothId: String(storeToothId),
      surface: payload.surface,
    };

    try {
      const createdFinding = await postFinding({
        patientId,
        encounterId,
        specialty: 'dental',
        title,
        status: 'draft',
        severity: payload.severity,
        note: payload.note,
        tags: ['dental', 'bookmark'],
        location: loc,
        createdBy: clinicianId,
      });

      const snapshot = await postEvidence({
        patientId,
        encounterId,
        specialty: 'dental',
        findingId: createdFinding.id,
        location: loc,
        kind: 'image',
        device: 'intraoral_cam',
        url: null,
        thumbnailUrl: null,
        contentType: 'image/jpeg',
        status: 'processing',
        capturedAt: nowISO(),
        meta: {
          source: 'live_capture',
          captureMode: 'snapshot',
          roomId: roomId,
          trackId: null,
        },
      });

      const clip = await postEvidence({
        patientId,
        encounterId,
        specialty: 'dental',
        findingId: createdFinding.id,
        location: loc,
        kind: 'video_clip',
        device: 'intraoral_cam',
        url: null,
        thumbnailUrl: null,
        contentType: 'video/mp4',
        status: 'processing',
        capturedAt: nowISO(),
        meta: {
          source: 'live_capture',
          captureMode: 'clip',
          durationMs: 10_000,
          roomId: roomId,
          trackId: null,
        },
      });

      void clip;

      if (payload.alsoAddPin) {
        try {
          await postAnnotation({
            patientId,
            encounterId,
            specialty: 'dental',
            evidenceId: snapshot.id,
            findingId: createdFinding.id,
            location: loc,
            type: 'pin',
            payload: { kind: 'screen', x: 0.5, y: 0.48, label: 'Mark area' } satisfies ScreenPinPayload,
            createdBy: clinicianId,
          });
        } catch {
          // non-blocking
        }
      }

      await refreshAll();
      setSelectedEvidenceId(snapshot.id);
      setBanner({
        kind: 'success',
        text: `Bookmark saved: tooth ${payload.toothId}${payload.surface ? ' · ' + payload.surface : ''}. Capture jobs created.`,
      });
    } catch (e) {
      setBanner({ kind: 'error', text: `Failed to save bookmark: ${errMsg(e)}` });
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const createPlanItem = async (label: string, toothId?: string) => {
    setBusy(true);
    setBanner(null);
    try {
      await postPlanItem({
        patientId,
        encounterId,
        specialty: 'dental',
        label: label.trim(),
        toothId,
        status: 'planned',
        createdAt: nowISO(),
        createdBy: clinicianId,
      });
      await refreshAll();
    } catch (e) {
      setBanner({ kind: 'error', text: `Failed to add plan item: ${errMsg(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const togglePlanDone = async (id: string) => {
    const cur = planItems.find((p) => p.id === id);
    if (!cur) return;
    setBusy(true);
    setBanner(null);
    try {
      await patchPlanItem({ id, status: cur.status === 'done' ? 'planned' : 'done' });
      await refreshAll();
    } catch (e) {
      setBanner({ kind: 'error', text: `Failed to update plan item: ${errMsg(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const buildLabExportPayload = (opts?: { includeAllEvidenceForTooth?: boolean }) => {
    const toothId = selectedTooth;

    const toothEvidenceIds = evidenceForSelection.map((e) => e.id);
    const selected = selectedEvidenceId ? [selectedEvidenceId] : [];
    const evidenceIds = opts?.includeAllEvidenceForTooth ? toothEvidenceIds : selected;

    const anns = annotations.filter((a) => evidenceIds.includes(a.evidenceId));
    const toothIds = [toothId];

    return {
      kind: 'lab_revision_export',
      patientId,
      encounterId,
      specialty: 'dental',
      toothSystem,
      toothIds,
      evidenceIds,
      annotations: anns.map((a) => ({
        id: a.id,
        evidenceId: a.evidenceId,
        findingId: a.findingId ?? null,
        location: a.location,
        type: a.type,
        payload: a.payload,
        createdAt: a.createdAt,
        createdBy: a.createdBy,
      })),
      createdAt: nowISO(),
      createdBy: clinicianId,
    };
  };

  const makeRevisionPackage = async () => {
    const exportPayload = buildLabExportPayload({ includeAllEvidenceForTooth: false });
    const annCount = exportPayload.annotations.length;

    setBusy(true);
    setBanner(null);
    try {
      await postRevision({
        patientId,
        encounterId,
        specialty: 'dental',
        toothId: selectedTooth,
        note: `Revision package: tooth ${selectedTooth}`,
        evidenceIds: exportPayload.evidenceIds,
        annotationCount: annCount,
        createdAt: nowISO(),
        createdBy: clinicianId,
        meta: { exportPayload },
      });

      await refreshAll();
      setBanner({ kind: 'success', text: 'Revision package created.' });
    } catch (e) {
      setBanner({ kind: 'error', text: `Failed to create revision: ${errMsg(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const sendToLab = async () => {
    const exportPayload = buildLabExportPayload({ includeAllEvidenceForTooth: true });

    setBusy(true);
    setBanner(null);
    try {
      await postJson(`${API_BASE}/labs/send-revision`, exportPayload);

      try {
        await postRevision({
          patientId,
          encounterId,
          specialty: 'dental',
          toothId: selectedTooth,
          note: `Sent to lab: tooth ${selectedTooth}`,
          evidenceIds: exportPayload.evidenceIds,
          annotationCount: exportPayload.annotations.length,
          createdAt: nowISO(),
          createdBy: clinicianId,
          meta: { exportPayload, sentToLab: true },
        });
      } catch {}

      await refreshAll();
      setBanner({ kind: 'success', text: 'Sent to lab (export payload delivered).' });
    } catch (e) {
      try {
        await navigator.clipboard.writeText(JSON.stringify(exportPayload, null, 2));
        setBanner({
          kind: 'info',
          text: `Lab endpoint not available. Export payload copied to clipboard. (${errMsg(e)})`,
        });
      } catch {
        setBanner({
          kind: 'error',
          text: `Failed to send to lab and could not copy payload. (${errMsg(e)})`,
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const addEvidenceFromUrl = async (opts: {
    kind: EvidenceKind;
    url: string;
    contentType?: string;
    modality?: 'xray' | 'photo' | 'other';
    segmentedTeeth?: boolean;
    segmentationScheme?: 'FDI' | 'universal';
  }) => {
    const loc = locationForSelection();
    setBusy(true);
    setBanner(null);
    try {
      const ext = extFromUrl(opts.url);
      const contentType = opts.contentType || guessContentTypeFromExt(ext) || null;

      await postEvidence({
        patientId,
        encounterId,
        specialty: 'dental',
        findingId: null,
        location: loc,
        kind: opts.kind,
        device: opts.kind === 'scan_3d' ? 'scanner_3d' : 'upload',
        url: opts.url,
        thumbnailUrl: null,
        contentType,
        status: 'ready',
        capturedAt: nowISO(),
        meta: {
          source: 'upload_url',
          modality: opts.modality || undefined,
          fileExt: ext || undefined,
          segmentation: opts.segmentedTeeth
            ? {
                perTooth: true,
                scheme: opts.segmentationScheme || 'FDI',
                nodePrefix: 'tooth_',
              }
            : undefined,
        },
      });
      await refreshAll();
      setBanner({ kind: 'success', text: 'Evidence added.' });
      setPreviewMode('evidence');
    } catch (e) {
      setBanner({ kind: 'error', text: `Failed to add evidence: ${errMsg(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const addXrayFromFile = async (file: File) => {
    const loc = locationForSelection();
    setBusy(true);
    setBanner(null);

    try {
      const dataUrl = await readFileAsDataUrl(file);

      await postEvidence({
        patientId,
        encounterId,
        specialty: 'dental',
        findingId: null,
        location: loc,
        kind: 'image',
        device: 'upload',
        url: dataUrl,
        thumbnailUrl: null,
        contentType: file.type || 'image/*',
        status: 'ready',
        capturedAt: nowISO(),
        meta: {
          source: 'upload_file_inline',
          modality: 'xray',
          originalName: file.name,
          size: file.size,
        },
      });

      await refreshAll();
      setBanner({ kind: 'success', text: 'X-ray uploaded (demo inline).' });
      setPreviewMode('evidence');
    } catch (e) {
      setBanner({ kind: 'error', text: `Failed to upload X-ray: ${errMsg(e)}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500">Ambulant+ Workspace</div>
            <h1 className="text-lg font-semibold">Dental Workspace</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:block text-xs text-gray-600">
              Patient: <span className="font-mono">{patientId}</span> · Encounter:{' '}
              <span className="font-mono">{encounterId}</span>
              {roomId ? (
                <>
                  {' '}
                  · Room: <span className="font-mono">{roomId}</span>
                </>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Chart</span>
              <button
                type="button"
                onClick={() => setToothSystem('universal')}
                className={
                  'text-xs rounded-full border px-2 py-1 ' +
                  (toothSystem === 'universal'
                    ? 'border-blue-300 bg-blue-50 text-blue-800'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50')
                }
              >
                Universal
              </button>
              <button
                type="button"
                onClick={() => setToothSystem('FDI')}
                className={
                  'text-xs rounded-full border px-2 py-1 ' +
                  (toothSystem === 'FDI'
                    ? 'border-blue-300 bg-blue-50 text-blue-800'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50')
                }
                title="FDI mapping is supported for segmented models (tooth_11, tooth_12...)"
              >
                FDI
              </button>
            </div>

            <button
              type="button"
              className="text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
              onClick={() => refreshAll().catch(() => {})}
              disabled={busy}
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4">
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

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.6fr_1.1fr] gap-4">
          {/* LEFT */}
          <section className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-4 py-3">
              <div className="text-sm font-semibold">Tooth Chart</div>
              <div className="text-xs text-gray-500">Click a tooth · pick surface · review findings</div>
            </div>

            <div className="p-4">
              <ToothChart selected={selectedTooth} onSelect={setSelectedTooth} counts={toothCounts} />

              <div className="mt-4">
                <div className="text-xs font-semibold text-gray-700">Surface</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(['O', 'M', 'D', 'B', 'L'] as ToothSurface[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={
                        'px-3 py-1.5 rounded-full border text-xs ' +
                        (selectedSurface === s
                          ? 'border-blue-300 bg-blue-50 text-blue-800'
                          : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700')
                      }
                      onClick={() => setSelectedSurface((prev) => (prev === s ? undefined : s))}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700">Selected</div>
                <div className="mt-1 text-sm text-gray-800">
                  Tooth <span className="font-mono font-semibold">{selectedTooth}</span>
                  {selectedSurface ? (
                    <>
                      {' '}
                      · Surface <span className="font-mono font-semibold">{selectedSurface}</span>
                    </>
                  ) : null}
                </div>
                <div className="mt-1 text-[11px] text-gray-500">
                  Segmented 3D scans can snap pins to a tooth mesh (tooth_11, tooth_12…).
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs font-semibold text-gray-700">Findings</div>
                <div className="mt-2">
                  {findingsForSelection.length === 0 ? (
                    <div className="text-sm text-gray-600 italic">No findings for this tooth yet.</div>
                  ) : (
                    <ul className="space-y-2">
                      {findingsForSelection.map((f) => (
                        <li key={f.id} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold">{f.title}</div>
                              <div className="text-xs text-gray-500">
                                {f.status.toUpperCase()} · {f.severity ?? '—'} ·{' '}
                                {new Date(f.createdAt).toLocaleString()}
                              </div>
                            </div>
                            <span className="text-[11px] rounded-full border px-2 py-0.5 bg-gray-50 text-gray-700">
                              {evidenceCountForFinding(f.id)} evidence
                            </span>
                          </div>
                          {f.note ? <div className="mt-2 text-sm text-gray-700">{f.note}</div> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* CENTER */}
          <section className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Live & Media</div>
                <div className="text-xs text-gray-500">3D teeth + evidence strip + scans + x-rays</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
                  onClick={addDemoPinAnnotation}
                  disabled={busy}
                  title="Creates a demo pin annotation on the selected evidence"
                >
                  + Pin
                </button>

                <button
                  type="button"
                  className="rounded-full border bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-800 disabled:opacity-50"
                  onClick={() => setBookmarkOpen(true)}
                  disabled={busy}
                >
                  Bookmark
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Preview */}
              <div className="rounded-lg border bg-white overflow-hidden">
                <div className="border-b bg-gray-50 px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={
                        'text-xs rounded-full border px-2 py-1 ' +
                        (previewMode === 'teeth3d'
                          ? 'border-blue-300 bg-blue-50 text-blue-800'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50')
                      }
                      onClick={() => setPreviewMode('teeth3d')}
                    >
                      3D Teeth
                    </button>
                    <button
                      type="button"
                      className={
                        'text-xs rounded-full border px-2 py-1 ' +
                        (previewMode === 'evidence'
                          ? 'border-blue-300 bg-blue-50 text-blue-800'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50')
                      }
                      onClick={() => setPreviewMode('evidence')}
                    >
                      Evidence
                    </button>
                  </div>

                  <div className="text-[11px] text-gray-600">
                    Tooth <span className="font-mono">{selectedTooth}</span>
                    {selectedSurface ? (
                      <>
                        {' '}
                        · <span className="font-mono">{selectedSurface}</span>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="h-72 bg-gray-100 relative">
                  {previewMode === 'teeth3d' ? (
                    <Teeth3DScene
                      selectedTooth={selectedTooth}
                      counts={toothCounts}
                      onSelectTooth={(id) => {
                        setSelectedTooth(id);
                        setSelectedSurface(undefined);
                      }}
                    />
                  ) : (
                    <EvidencePreview
                      selectedEvidence={selectedEvidence}
                      pins={annotationsForSelectedEvidence.filter((a) => a.type === 'pin')}
                      busy={busy}
                      onAddScreenPin={(x, y) => createScreenPinOnSelectedEvidence(x, y, 'Pin')}
                      onAddModelPin={(payload, overrideToothId) =>
                        createModelPinOnSelectedEvidence(payload, overrideToothId)
                      }
                      selectedTooth={selectedTooth}
                      toothSystem={toothSystem}
                      onSelectTooth={(universalTooth) => {
                        setSelectedTooth(universalTooth);
                        setSelectedSurface(undefined);
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Add media (X-ray / 3D scan / URL) */}
              <AddMediaPanel busy={busy} onAddUrl={addEvidenceFromUrl} onUploadXrayFile={addXrayFromFile} />

              {/* Media strip */}
              <div>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-gray-700">Evidence for tooth {selectedTooth}</div>
                  <div className="text-[11px] text-gray-500">{evidenceForSelection.length} item(s)</div>
                </div>

                {evidenceForSelection.length === 0 ? (
                  <div className="mt-2 text-sm text-gray-600 italic">No evidence yet for this tooth.</div>
                ) : (
                  <div className="mt-2 flex gap-2 overflow-auto pb-1">
                    {evidenceForSelection.map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => setSelectedEvidenceId(ev.id)}
                        className={
                          'min-w-[210px] max-w-[210px] rounded-lg border overflow-hidden bg-white text-left hover:bg-gray-50 ' +
                          (selectedEvidenceId === ev.id ? 'ring-2 ring-blue-200' : '')
                        }
                      >
                        <div className="h-24 bg-gray-100 grid place-items-center">
                          <span className="text-xs text-gray-500">
                            {ev.kind === 'image'
                              ? looksLikeXray(ev)
                                ? 'X-ray'
                                : 'Image'
                              : ev.kind === 'scan_3d'
                                ? '3D Scan'
                                : 'Clip'}
                          </span>
                        </div>

                        <div className="p-2">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-medium text-gray-800">{ev.device}</div>
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
                          </div>
                          <div className="text-[11px] text-gray-500">{new Date(ev.capturedAt).toLocaleString()}</div>
                          {ev.jobId ? (
                            <div className="mt-1 text-[10px] text-gray-400 font-mono">job: {ev.jobId}</div>
                          ) : null}
                          {ev.kind === 'scan_3d' && ev.meta?.segmentation?.perTooth ? (
                            <div className="mt-1 text-[10px] text-blue-700 bg-blue-50 border border-blue-200 inline-block rounded px-1.5 py-0.5">
                              segmented teeth
                            </div>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Revisions (server-truth) */}
              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-gray-700">Lab revisions</div>
                    <div className="text-[11px] text-gray-500">Revision history + export workflow</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
                      onClick={makeRevisionPackage}
                      disabled={busy}
                      title="Creates a revision record (selection-based)"
                    >
                      Create revision
                    </button>
                    <button
                      type="button"
                      className="text-xs px-3 py-1.5 rounded border bg-blue-50 hover:bg-blue-100 text-blue-800 disabled:opacity-50"
                      onClick={sendToLab}
                      disabled={busy}
                      title="Sends evidenceIds + annotations + toothIds"
                    >
                      Send to lab
                    </button>
                  </div>
                </div>

                {revisions.length === 0 ? (
                  <div className="mt-2 text-sm text-gray-600 italic">No revisions yet.</div>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {revisions.map((r) => (
                      <li key={r.id} className="rounded-lg border bg-white p-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold text-gray-800">Revision {r.revisionNo}</div>
                          <div className="text-[11px] text-gray-500">{new Date(r.createdAt).toLocaleString()}</div>
                        </div>
                        <div className="mt-1 text-[11px] text-gray-600">
                          Tooth: {r.toothId ?? '—'} · Evidence: {r.evidenceIds.length} · Pins/comments:{' '}
                          {r.annotationCount}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Annotation list for selected evidence */}
              <div className="rounded-lg border p-3">
                <div className="text-xs font-semibold text-gray-700">Annotations (selected evidence)</div>
                {!selectedEvidenceId ? (
                  <div className="mt-1 text-sm text-gray-600 italic">Select an evidence item.</div>
                ) : annotationsForSelectedEvidence.length === 0 ? (
                  <div className="mt-1 text-sm text-gray-600 italic">No annotations yet.</div>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {annotationsForSelectedEvidence.map((a) => (
                      <li key={a.id} className="rounded border p-2 bg-white">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold text-gray-800">{a.type}</div>
                          <div className="text-[11px] text-gray-500">{new Date(a.createdAt).toLocaleString()}</div>
                        </div>
                        <div className="mt-1 text-[11px] text-gray-600 font-mono">{JSON.stringify(a.payload)}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          {/* RIGHT */}
          <section className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-4 py-3">
              <div className="text-sm font-semibold">Findings & Plan</div>
              <div className="text-xs text-gray-500">Now backed by GET endpoints</div>
            </div>

            <div className="p-4 space-y-4">
              <QuickFindingComposer disabled={busy} onCreate={createManualFinding} />

              <TreatmentPlan
                selectedTooth={selectedTooth}
                items={planItems}
                onAdd={createPlanItem}
                onToggle={togglePlanDone}
                busy={busy}
              />

              <div className="rounded-lg border p-3 bg-gray-50">
                <div className="text-xs font-semibold text-gray-700">Segmentation pipeline (recommended)</div>
                <div className="mt-1 text-sm text-gray-700">
                  Store per-tooth meshes inside a single GLB/GLTF with named nodes like{' '}
                  <span className="font-mono">tooth_11</span>, <span className="font-mono">tooth_12</span>… (FDI).
                  Then the viewer can highlight a tooth and snap pins to that mesh id (true 3D pins).
                </div>
              </div>

              <div className="rounded-lg border p-3 bg-gray-50">
                <div className="text-xs font-semibold text-gray-700">Live capture note</div>
                <div className="mt-1 text-sm text-gray-700">
                  Evidence posts with <span className="font-mono">meta.source: "live_capture"</span>. Your worker should
                  PATCH <span className="font-mono">/api/evidence</span> with final URL + status.
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <DentalBookmarkModal
        open={bookmarkOpen}
        onClose={() => setBookmarkOpen(false)}
        selectedTooth={selectedTooth}
        selectedSurface={selectedSurface}
        onSave={handleBookmark}
        busy={busy}
      />
    </div>
  );
}

/* =========================================================
   Evidence Preview (image / x-ray / scan3d / clip)
========================================================= */
function EvidencePreview({
  selectedEvidence,
  pins,
  onAddScreenPin,
  onAddModelPin,
  busy,
  selectedTooth,
  toothSystem,
  onSelectTooth,
}: {
  selectedEvidence: DentalEvidence | null;
  pins: DentalAnnotation[];
  onAddScreenPin: (x01: number, y01: number) => void;
  onAddModelPin: (payload: ModelPinPayload, overrideToothId?: string) => void;
  busy?: boolean;
  selectedTooth: string;
  toothSystem: ToothSystem;
  onSelectTooth: (universalTooth: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  if (!selectedEvidence) {
    return (
      <div className="h-full grid place-items-center text-gray-600">
        <div className="text-center">
          <div className="text-sm font-medium">No evidence selected</div>
          <div className="text-xs text-gray-500 mt-1">Pick an item below, or stay on 3D Teeth.</div>
        </div>
      </div>
    );
  }

  if (selectedEvidence.kind === 'scan_3d') {
    return (
      <Scan3DViewer
        evidence={selectedEvidence}
        pins={pins}
        disabled={busy}
        selectedToothUniversal={selectedTooth}
        toothSystem={toothSystem}
        onSelectToothUniversal={onSelectTooth}
        onAddModelPin={(payload, overrideToothId) => onAddModelPin(payload, overrideToothId)}
      />
    );
  }

  if (selectedEvidence.kind === 'image') {
    if (looksLikeXray(selectedEvidence)) {
      return <XRayViewer evidence={selectedEvidence} />;
    }

    if (!selectedEvidence.url) {
      return (
        <div className="h-full w-full grid place-items-center text-gray-700">
          <div className="text-center">
            <div className="text-sm font-medium">Snapshot pending</div>
            <div className="text-xs text-gray-500 mt-1">
              status: {selectedEvidence.status}
              {selectedEvidence.jobId ? ` · job: ${selectedEvidence.jobId}` : ''}
            </div>
            <div className="mt-2 text-[11px] text-gray-500">Capture worker will PATCH /api/evidence with the final URL.</div>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={wrapRef}
        className="h-full w-full relative bg-black/5"
        onClick={(ev) => {
          if (busy) return;
          const host = wrapRef.current;
          if (!host) return;
          const rect = host.getBoundingClientRect();
          const x01 = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
          const y01 = Math.min(1, Math.max(0, (ev.clientY - rect.top) / rect.height));
          onAddScreenPin(x01, y01);
        }}
        title={busy ? 'Busy…' : 'Click image to add a pin'}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={selectedEvidence.url} alt="Selected evidence" className="h-full w-full object-contain" />
        {pins
          .filter((p) => p.payload?.kind === 'screen')
          .map((p) => {
            const x = Number(p.payload?.x ?? 0.5);
            const y = Number(p.payload?.y ?? 0.5);
            const label = String(p.payload?.label ?? 'Pin');
            return (
              <div
                key={p.id}
                className="absolute"
                style={{ left: `${x * 100}%`, top: `${y * 100}%`, transform: 'translate(-50%,-50%)' }}
                title={label}
              >
                <div className="h-2.5 w-2.5 rounded-full bg-blue-600 ring-4 ring-blue-200" />
              </div>
            );
          })}
      </div>
    );
  }

  if (selectedEvidence.kind === 'video_clip') {
    if (!selectedEvidence.url) {
      return (
        <div className="h-full w-full grid place-items-center text-gray-700">
          <div className="text-center">
            <div className="text-sm font-medium">Clip pending</div>
            <div className="text-xs text-gray-500 mt-1">
              status: {selectedEvidence.status}
              {selectedEvidence.jobId ? ` · job: ${selectedEvidence.jobId}` : ''}
            </div>
            <div className="mt-2 text-[11px] text-gray-500">Playback appears when the clip URL is ready.</div>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full w-full bg-black grid place-items-center">
        <video controls className="max-h-full max-w-full" src={selectedEvidence.url} />
      </div>
    );
  }

  return (
    <div className="h-full w-full grid place-items-center text-gray-700">
      <div className="text-center">
        <div className="text-sm font-medium">Unsupported evidence</div>
      </div>
    </div>
  );
}

/* =========================================================
   3D Teeth Scene
========================================================= */
function Teeth3DScene({
  selectedTooth,
  counts,
  onSelectTooth,
}: {
  selectedTooth: string;
  counts: Map<string, number>;
  onSelectTooth: (toothId: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<any>(null);

  const countsObj = useMemo(() => {
    const o: Record<string, number> = {};
    counts.forEach((v, k) => (o[k] = v));
    return o;
  }, [counts]);

  const selectedRef = useRef(selectedTooth);
  const countsRef = useRef(countsObj);

  useEffect(() => {
    selectedRef.current = selectedTooth;
  }, [selectedTooth]);

  useEffect(() => {
    countsRef.current = countsObj;
  }, [countsObj]);

  useEffect(() => {
    let disposed = false;

    (async () => {
      if (!hostRef.current) return;

      const THREE = await import('three');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls');

      if (disposed) return;

      const host = hostRef.current;
      host.innerHTML = '';

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf3f4f6);

      const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
      camera.position.set(0, 0.85, 2.45);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      host.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 1.15;
      controls.maxDistance = 4.8;
      controls.target.set(0, 0.16, -0.1);
      controls.update();

      scene.add(new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 0.5));
      scene.add(new THREE.AmbientLight(0xffffff, 0.35));

      const key = new THREE.DirectionalLight(0xffffff, 0.85);
      key.position.set(1.7, 2.4, 1.3);
      key.castShadow = true;
      key.shadow.mapSize.width = 1024;
      key.shadow.mapSize.height = 1024;
      scene.add(key);

      const fill = new THREE.DirectionalLight(0xffffff, 0.35);
      fill.position.set(-1.5, 1.3, 1.0);
      scene.add(fill);

      const rim = new THREE.DirectionalLight(0xffffff, 0.55);
      rim.position.set(-1.2, 1.0, -2.2);
      scene.add(rim);

      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(6, 6),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0.0 }),
      );
      plane.rotation.x = -Math.PI / 2;
      plane.position.y = -0.18;
      plane.receiveShadow = true;
      scene.add(plane);

      const teethGroup = new THREE.Group();
      scene.add(teethGroup);

      const toothRegistry = new Map<string, { root: any; meshes: any[] }>();

      const makeEnamelMaterial = (baseHex: number) => {
        const mat = new (THREE as any).MeshPhysicalMaterial({
          color: baseHex,
          roughness: 0.28,
          metalness: 0.0,
          clearcoat: 0.85,
          clearcoatRoughness: 0.15,
          reflectivity: 0.35,
        });
        try {
          (mat as any).ior = 1.45;
          (mat as any).specularIntensity = 0.95;
          (mat as any).specularColor = new THREE.Color(0xffffff);
        } catch {}
        return mat;
      };

      const latheToothGeometry = (kind: 'incisor' | 'canine' | 'premolar' | 'molar') => {
        const pts: any[] = [];
        const push = (r: number, y: number) => pts.push(new THREE.Vector2(r, y));

        if (kind === 'incisor') {
          push(0.014, -0.12);
          push(0.020, -0.08);
          push(0.028, -0.02);
          push(0.026, 0.0);
          push(0.040, 0.03);
          push(0.048, 0.06);
          push(0.046, 0.095);
          push(0.030, 0.112);
          push(0.006, 0.118);
        } else if (kind === 'canine') {
          push(0.014, -0.13);
          push(0.022, -0.08);
          push(0.030, -0.02);
          push(0.028, 0.0);
          push(0.044, 0.03);
          push(0.052, 0.065);
          push(0.038, 0.105);
          push(0.010, 0.125);
          push(0.004, 0.130);
        } else if (kind === 'premolar') {
          push(0.016, -0.13);
          push(0.026, -0.08);
          push(0.036, -0.02);
          push(0.034, 0.0);
          push(0.052, 0.03);
          push(0.060, 0.065);
          push(0.052, 0.10);
          push(0.020, 0.118);
          push(0.006, 0.122);
        } else {
          push(0.018, -0.13);
          push(0.030, -0.08);
          push(0.042, -0.02);
          push(0.040, 0.0);
          push(0.062, 0.03);
          push(0.070, 0.065);
          push(0.066, 0.085);
          push(0.050, 0.11);
          push(0.020, 0.122);
          push(0.006, 0.126);
        }

        const geo = new THREE.LatheGeometry(pts, 28);
        geo.computeVertexNormals();
        return geo;
      };

      const makeTooth = (id: string, kind: 'incisor' | 'canine' | 'premolar' | 'molar') => {
        const root = new THREE.Group();
        root.userData = { toothId: id };

        const baseMat = makeEnamelMaterial(0xfafafa);

        const geo = latheToothGeometry(kind);
        const mesh = new THREE.Mesh(geo, baseMat.clone());
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { toothId: id };

        const cap = new THREE.Mesh(
          new THREE.SphereGeometry(
            0.036 + (kind === 'molar' ? 0.012 : kind === 'premolar' ? 0.008 : 0.006),
            18,
            18,
          ),
          baseMat.clone() as any,
        );
        cap.scale.set(1.12, 0.6, 1.08);
        cap.position.y = kind === 'incisor' ? 0.088 : kind === 'canine' ? 0.095 : 0.082;
        cap.castShadow = true;
        cap.receiveShadow = true;
        cap.userData = { toothId: id };

        const rimGeo = new THREE.TorusGeometry(
          kind === 'molar' ? 0.038 : kind === 'premolar' ? 0.034 : 0.030,
          0.0032,
          10,
          48,
        );
        const rimMat = makeEnamelMaterial(0xffffff);
        (rimMat as any).roughness = 0.18;
        (rimMat as any).clearcoat = 1.0;
        (rimMat as any).clearcoatRoughness = 0.08;
        const rimRing = new THREE.Mesh(rimGeo, rimMat);
        rimRing.rotation.x = Math.PI / 2;
        rimRing.position.y = kind === 'incisor' ? 0.092 : kind === 'canine' ? 0.098 : 0.088;
        rimRing.castShadow = false;
        rimRing.receiveShadow = false;
        rimRing.userData = { toothId: id };

        root.add(mesh);
        root.add(cap);
        root.add(rimRing);

        root.rotation.z = (Number(id) % 2 === 0 ? 1 : -1) * 0.015;

        return { root, meshes: [mesh, cap, rimRing] };
      };

      const kindForIndex = (i1: number) => {
        if (i1 <= 4 || i1 >= 13) return 'molar' as const;
        if (i1 <= 6 || i1 >= 11) return 'premolar' as const;
        if (i1 === 7 || i1 === 10) return 'canine' as const;
        return 'incisor' as const;
      };

      const placeArc = (ids: string[], y: number, zBend: number, flip: boolean) => {
        const n = ids.length;
        for (let i = 0; i < n; i++) {
          const id = ids[i];
          const t = i / (n - 1);
          const ang = (t - 0.5) * Math.PI * 0.9;
          const r = 0.72;

          const x = Math.sin(ang) * r;
          const z = Math.cos(ang) * r * zBend;

          const idx = i + 1;
          const kind = kindForIndex(idx);
          const { root, meshes } = makeTooth(id, kind);

          root.position.set(x, y, z - 0.36);
          root.rotation.y = -ang;
          root.rotation.x = flip ? Math.PI : 0;

          const scale = idx <= 4 || idx >= 13 ? 1.12 : idx <= 6 || idx >= 11 ? 1.05 : 0.98;
          root.scale.set(scale, scale, scale);

          teethGroup.add(root);
          toothRegistry.set(id, { root, meshes });
        }
      };

      const upper = Array.from({ length: 16 }, (_, i) => String(i + 1));
      const lower = Array.from({ length: 16 }, (_, i) => String(32 - i));

      placeArc(upper, 0.33, 0.92, false);
      placeArc(lower, 0.03, 0.96, true);

      const gumMat = new THREE.MeshStandardMaterial({
        color: 0xf6c6ce,
        roughness: 0.92,
        metalness: 0.0,
        transparent: true,
        opacity: 0.88,
      });

      const gumUpper = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.06, 14, 96), gumMat);
      gumUpper.rotation.x = Math.PI / 2;
      gumUpper.position.set(0, 0.28, -0.46);
      gumUpper.scale.set(1.0, 1.0, 0.58);
      gumUpper.receiveShadow = true;
      scene.add(gumUpper);

      const gumLower = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.055, 14, 96), gumMat.clone());
      gumLower.rotation.x = Math.PI / 2;
      gumLower.position.set(0, 0.07, -0.46);
      gumLower.scale.set(1.0, 1.0, 0.60);
      gumLower.receiveShadow = true;
      scene.add(gumLower);

      const gumLineMat = new THREE.MeshStandardMaterial({
        color: 0xeaa3b2,
        roughness: 0.98,
        metalness: 0.0,
        transparent: true,
        opacity: 0.35,
      });
      const gumLine = new THREE.Mesh(new THREE.TorusGeometry(0.63, 0.012, 10, 96), gumLineMat);
      gumLine.rotation.x = Math.PI / 2;
      gumLine.position.set(0, 0.18, -0.45);
      gumLine.scale.set(1.0, 1.0, 0.58);
      scene.add(gumLine);

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();

      const onPointerDown = (ev: PointerEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
        pointer.set(x, y);

        raycaster.setFromCamera(pointer, camera);
        const roots = Array.from(toothRegistry.values()).map((v) => v.root);
        const hits = raycaster.intersectObjects(roots, true);
        const hit = hits.find((h) => h.object?.userData?.toothId || h.object?.parent?.userData?.toothId);
        const toothId = hit?.object?.userData?.toothId || hit?.object?.parent?.userData?.toothId;
        if (toothId) onSelectTooth(String(toothId));
      };

      renderer.domElement.addEventListener('pointerdown', onPointerDown);

      const resize = () => {
        const w = host.clientWidth || 1;
        const h = host.clientHeight || 1;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };
      resize();

      const ro = new ResizeObserver(resize);
      ro.observe(host);

      const tick = () => {
        if (disposed) return;

        const selTooth = String(selectedRef.current);
        const cObj = countsRef.current || {};

        toothRegistry.forEach((entry, id) => {
          const sel = String(id) === selTooth;
          const c = Number((cObj as any)[id] ?? 0);

          const base = sel ? 0x93c5fd : c > 0 ? 0x86efac : 0xfafafa;

          for (const m of entry.meshes) {
            const mat = m.material as any;
            if (mat?.color) mat.color.setHex(base);
          }

          const root = entry.root;
          root.position.y = root.userData._baseY ?? root.position.y;
          if (!root.userData._baseY) root.userData._baseY = root.position.y;
          if (sel) root.position.y = root.userData._baseY + 0.02;
        });

        controls.update();
        renderer.render(scene, camera);
        requestAnimationFrame(tick);
      };
      tick();

      stateRef.current = { renderer, controls, ro, onPointerDown };
    })();

    return () => {
      disposed = true;
      const st = stateRef.current;
      if (st?.renderer?.domElement && st?.onPointerDown) {
        st.renderer.domElement.removeEventListener('pointerdown', st.onPointerDown);
      }
      try {
        st?.ro?.disconnect?.();
      } catch {}
      try {
        st?.controls?.dispose?.();
      } catch {}
      try {
        st?.renderer?.dispose?.();
      } catch {}
      if (hostRef.current) hostRef.current.innerHTML = '';
      stateRef.current = null;
    };
  }, [onSelectTooth]);

  return (
    <div className="absolute inset-0">
      <div className="absolute left-3 top-3 z-10 rounded-full border bg-white/90 px-3 py-1 text-[11px] text-gray-700">
        Drag to orbit · Click a tooth to select
      </div>
      <div ref={hostRef} className="absolute inset-0" />
    </div>
  );
}

/* =========================================================
   Scan 3D Viewer (GLB/GLTF + OBJ + STL)
========================================================= */
function Scan3DViewer({
  evidence,
  pins,
  disabled,
  selectedToothUniversal,
  toothSystem,
  onSelectToothUniversal,
  onAddModelPin,
}: {
  evidence: DentalEvidence;
  pins: DentalAnnotation[];
  disabled?: boolean;
  selectedToothUniversal: string;
  toothSystem: ToothSystem;
  onSelectToothUniversal: (universalTooth: string) => void;
  onAddModelPin: (payload: ModelPinPayload, overrideToothId?: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<any>(null);
  const [viewerReady, setViewerReady] = useState(false);

  const url = evidence.url ?? '';
  const ext = extFromUrl(url);

  const segmentationScheme: 'FDI' | 'universal' | null =
    evidence.meta?.segmentation?.perTooth ? (evidence.meta?.segmentation?.scheme ?? 'FDI') : null;

  const targetNodeName = useMemo(() => {
    if (!evidence.meta?.segmentation?.perTooth) return null;

    if (segmentationScheme === 'FDI') {
      const fdi = toothSystem === 'FDI' ? selectedToothUniversal : universalToFdi(selectedToothUniversal);
      return fdi ? toothNodeName('FDI', fdi) : null;
    }

    return toothNodeName('universal', selectedToothUniversal);
  }, [evidence.meta, segmentationScheme, selectedToothUniversal, toothSystem]);

  const pinsRef = useRef(pins);
  const targetNodeNameRef = useRef<string | null>(targetNodeName);
  const disabledRef = useRef(!!disabled);
  const onSelectToothRef = useRef(onSelectToothUniversal);
  const onAddModelPinRef = useRef(onAddModelPin);

  useEffect(() => {
    pinsRef.current = pins;
  }, [pins]);
  useEffect(() => {
    targetNodeNameRef.current = targetNodeName;
  }, [targetNodeName]);
  useEffect(() => {
    disabledRef.current = !!disabled;
  }, [disabled]);
  useEffect(() => {
    onSelectToothRef.current = onSelectToothUniversal;
  }, [onSelectToothUniversal]);
  useEffect(() => {
    onAddModelPinRef.current = onAddModelPin;
  }, [onAddModelPin]);

  useEffect(() => {
    let disposed = false;

    (async () => {
      const host = hostRef.current;
      if (!host) return;
      if (!url) return;

      const THREE = await import('three');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader');
      const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader');
      const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader');

      if (disposed) return;

      host.innerHTML = '';
      host.style.position = 'relative';

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xffffff);

      const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 2000);
      camera.position.set(0, 0.1, 1.8);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(host.clientWidth || 1, host.clientHeight || 1, false);
      renderer.shadowMap.enabled = true;

      host.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 0.35;
      controls.maxDistance = 6;
      controls.target.set(0, 0, 0);
      controls.update();

      scene.add(new THREE.AmbientLight(0xffffff, 0.75));
      const key = new THREE.DirectionalLight(0xffffff, 0.85);
      key.position.set(1.2, 2.0, 1.4);
      key.castShadow = true;
      scene.add(key);

      const fill = new THREE.DirectionalLight(0xffffff, 0.35);
      fill.position.set(-1.2, 1.0, -1.0);
      scene.add(fill);

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10),
        new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.95, metalness: 0.0 }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.45;
      ground.receiveShadow = true;
      scene.add(ground);

      let root: any = null;

      if (ext === 'glb' || ext === 'gltf' || evidence.contentType?.includes('gltf')) {
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(url);
        root = gltf.scene || gltf.scenes?.[0];
      } else if (ext === 'obj') {
        const loader = new OBJLoader();
        root = await loader.loadAsync(url);
      } else if (ext === 'stl') {
        const loader = new STLLoader();
        const geo = await loader.loadAsync(url);
        const mat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.55, metalness: 0.05 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'stl_mesh';
        root = new THREE.Group();
        root.add(mesh);
      } else {
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(url);
        root = gltf.scene || gltf.scenes?.[0];
      }

      if (disposed) return;

      const meshList: any[] = [];
      const objByName = new Map<string, any>();
      const toothMeshesByRootName = new Map<string, any[]>();

      const ensureToothMeshBucket = (toothName: string) => {
        let arr = toothMeshesByRootName.get(toothName);
        if (!arr) {
          arr = [];
          toothMeshesByRootName.set(toothName, arr);
        }
        return arr;
      };

      root.traverse((obj: any) => {
        if (obj?.name) objByName.set(String(obj.name), obj);

        if (obj?.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;

          if (!obj.material || Array.isArray(obj.material)) {
            obj.material = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.55, metalness: 0.05 });
          } else {
            obj.material.transparent = false;
          }

          meshList.push(obj);
        }
      });

      const findToothRootForObject = (start: any) => {
        let cur = start;
        while (cur) {
          const meta = meshNameToToothId(cur?.name);
          if (meta) return cur;
          cur = cur.parent;
        }
        return null;
      };

      for (const m of meshList) {
        const rootTooth = findToothRootForObject(m);
        if (rootTooth?.name) ensureToothMeshBucket(String(rootTooth.name)).push(m);
      }

      scene.add(root);

      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const dist = maxDim * 1.6;

      controls.target.copy(center);
      camera.position.set(center.x, center.y + maxDim * 0.12, center.z + dist);
      camera.near = Math.max(0.0005, dist / 5000);
      camera.far = Math.max(50, dist * 10);
      camera.updateProjectionMatrix();
      controls.update();

      const originalColors = new Map<string, any>();
      for (const m of meshList) {
        const key = String(m.uuid);
        const mat = m.material;
        const color = mat?.color ? mat.color.clone() : null;
        originalColors.set(key, color);
      }

      const overlay = document.createElement('div');
      overlay.style.position = 'absolute';
      overlay.style.inset = '0';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '2';
      host.appendChild(overlay);

      const pinEls = new Map<string, HTMLDivElement>();
      const ensurePinEl = (id: string) => {
        let el = pinEls.get(id);
        if (!el) {
          el = document.createElement('div');
          el.style.position = 'absolute';
          el.style.transform = 'translate(-50%,-50%)';
          el.style.width = '10px';
          el.style.height = '10px';
          el.style.borderRadius = '999px';
          el.style.background = '#2563eb';
          el.style.boxShadow = '0 0 0 6px rgba(37, 99, 235, 0.22)';
          el.title = 'Pin';
          overlay.appendChild(el);
          pinEls.set(id, el);
        }
        return el;
      };
      const hideUnusedPins = (keep: Set<string>) => {
        for (const [id, el] of pinEls.entries()) {
          if (!keep.has(id)) el.style.display = 'none';
        }
      };

      const tip = document.createElement('div');
      tip.style.position = 'absolute';
      tip.style.pointerEvents = 'none';
      tip.style.zIndex = '3';
      tip.style.padding = '6px 8px';
      tip.style.borderRadius = '10px';
      tip.style.border = '1px solid rgba(0,0,0,0.10)';
      tip.style.background = 'rgba(255,255,255,0.92)';
      tip.style.backdropFilter = 'blur(6px)';
      tip.style.fontSize = '11px';
      tip.style.color = '#111827';
      tip.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)';
      tip.style.display = 'none';
      overlay.appendChild(tip);

      const formatBothSystems = (meta: { scheme: 'FDI' | 'universal'; toothId: string }) => {
        if (meta.scheme === 'FDI') {
          const fdi = meta.toothId;
          const uni = fdiToUniversal(fdi);
          return { fdi, uni: uni ?? '—', text: `FDI ${fdi} / Universal ${uni ?? '—'}` };
        } else {
          const uni = meta.toothId;
          const fdi = universalToFdi(uni);
          return { fdi: fdi ?? '—', uni, text: `FDI ${fdi ?? '—'} / Universal ${uni}` };
        }
      };

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();

      const pick = (clientX: number, clientY: number) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const x = ((clientX - rect.left) / rect.width) * 2 - 1;
        const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
        pointer.set(x, y);
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(meshList, true);
        return hits?.[0] ?? null;
      };

      const resolveToothNodeFromHit = (hit: any) => {
        if (!hit?.object) return null;
        let cur: any = hit.object;
        while (cur) {
          const meta = meshNameToToothId(cur?.name);
          if (meta) return { node: cur, meta };
          cur = cur.parent;
        }
        return null;
      };

      const hoverRef = { toothNodeName: '' };

      const onPointerMove = (ev: PointerEvent) => {
        if (disposed) return;

        const hit = pick(ev.clientX, ev.clientY);
        const resolved = resolveToothNodeFromHit(hit);

        if (!resolved) {
          hoverRef.toothNodeName = '';
          tip.style.display = 'none';
          return;
        }

        const toothNodeName_ = String(resolved.node?.name || '');
        hoverRef.toothNodeName = toothNodeName_;

        const both = formatBothSystems(resolved.meta);

        tip.textContent = both.text;
        tip.style.display = 'block';

        const rect = renderer.domElement.getBoundingClientRect();
        const x = ev.clientX - rect.left + 12;
        const y = ev.clientY - rect.top + 12;
        tip.style.left = `${Math.max(6, Math.min(rect.width - 6, x))}px`;
        tip.style.top = `${Math.max(6, Math.min(rect.height - 6, y))}px`;
      };

      const onPointerLeave = () => {
        hoverRef.toothNodeName = '';
        tip.style.display = 'none';
      };

      const onPointerDown = (ev: PointerEvent) => {
        if (disabledRef.current) return;

        const hit = pick(ev.clientX, ev.clientY);
        if (!hit || !hit.object) return;

        const resolved = resolveToothNodeFromHit(hit);

        let overrideToothId: string | undefined = undefined;

        if (resolved?.meta) {
          const meta = resolved.meta;
          if (meta.scheme === 'FDI') {
            const uni = fdiToUniversal(meta.toothId);
            if (uni) {
              onSelectToothRef.current(uni);
              overrideToothId = uni;
            }
          } else {
            onSelectToothRef.current(meta.toothId);
            overrideToothId = meta.toothId;
          }
        }

        const pinTargetObj = resolved?.node ?? hit.object;
        const meshId = String(pinTargetObj.name || hit.object.name || hit.object.uuid);

        try {
          pinTargetObj.updateWorldMatrix(true, false);
          hit.object.updateWorldMatrix(true, false);
        } catch {}

        const pWorld = hit.point.clone();
        const pLocal = pinTargetObj.worldToLocal(pWorld.clone());

        let nLocal: [number, number, number] | undefined = undefined;
        if (hit.face?.normal) {
          const n = hit.face.normal.clone().normalize();
          const nWorld = n.applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();

          const inv = pinTargetObj.matrixWorld.clone().invert();
          const nLocVec = nWorld.clone().transformDirection(inv).normalize();

          nLocal = [nLocVec.x, nLocVec.y, nLocVec.z];
        }

        const label =
          resolved?.meta ? formatBothSystems(resolved.meta).text : meshId ? `Mesh ${meshId}` : '3D Pin';

        const payload: ModelPinPayload = {
          kind: 'model',
          meshId,
          p: [pLocal.x, pLocal.y, pLocal.z],
          n: nLocal,
          label,
        };

        onAddModelPinRef.current(payload, overrideToothId);
      };

      renderer.domElement.addEventListener('pointermove', onPointerMove);
      renderer.domElement.addEventListener('pointerleave', onPointerLeave);
      renderer.domElement.addEventListener('pointerdown', onPointerDown);

      const resize = () => {
        const w = host.clientWidth || 1;
        const h = host.clientHeight || 1;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };
      const ro = new ResizeObserver(resize);
      ro.observe(host);
      resize();

      const toScreen = (v: any) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const p = v.clone().project(camera);
        const x = ((p.x + 1) / 2) * rect.width;
        const y = ((-p.y + 1) / 2) * rect.height;
        return { x, y, visible: p.z >= -1 && p.z <= 1 };
      };

      const tick = () => {
        if (disposed) return;

        const selectedToothNodeName = targetNodeNameRef.current ? String(targetNodeNameRef.current) : '';
        const hoveredToothNodeName = hoverRef.toothNodeName ? String(hoverRef.toothNodeName) : '';

        for (const m of meshList) {
          const key = String(m.uuid);
          const orig = originalColors.get(key);
          if (m.material?.color && orig) m.material.color.copy(orig);
        }

        const applyToToothMeshes = (toothName: string, fn: (mesh: any) => void) => {
          const meshes = toothMeshesByRootName.get(toothName);
          if (!meshes) return;
          for (const m of meshes) fn(m);
        };

        if (selectedToothNodeName) {
          applyToToothMeshes(selectedToothNodeName, (m) => {
            if (m.material?.color) m.material.color.setHex(0x93c5fd);
          });
        }

        if (hoveredToothNodeName && hoveredToothNodeName !== selectedToothNodeName) {
          applyToToothMeshes(hoveredToothNodeName, (m) => {
            if (m.material?.color) m.material.color.setHex(0xbfdbfe);
          });
        }

        controls.update();
        renderer.render(scene, camera);

        const keep = new Set<string>();
        for (const a of pinsRef.current || []) {
          if (a.type !== 'pin') continue;
          const payload = a.payload as ScreenPinPayload | ModelPinPayload;
          if (!payload || payload.kind !== 'model') continue;

          const obj = objByName.get(String(payload.meshId));
          if (!obj) continue;

          const pLocal = payload.p;
          const world = obj.localToWorld(new THREE.Vector3(pLocal[0], pLocal[1], pLocal[2]));
          const { x, y, visible } = toScreen(world);

          const el = ensurePinEl(a.id);
          keep.add(a.id);
          el.style.display = visible ? 'block' : 'none';
          el.style.left = `${x}px`;
          el.style.top = `${y}px`;
          el.title = String(payload.label || '3D Pin');
        }
        hideUnusedPins(keep);

        requestAnimationFrame(tick);
      };

      setViewerReady(true);
      tick();

      stateRef.current = {
        renderer,
        controls,
        ro,
        overlay,
        tip,
        onPointerDown,
        onPointerMove,
        onPointerLeave,
        pinEls,
      };
    })();

    return () => {
      disposed = true;
      const st = stateRef.current;

      try {
        st?.renderer?.domElement?.removeEventListener?.('pointerdown', st?.onPointerDown);
        st?.renderer?.domElement?.removeEventListener?.('pointermove', st?.onPointerMove);
        st?.renderer?.domElement?.removeEventListener?.('pointerleave', st?.onPointerLeave);
      } catch {}

      try {
        st?.ro?.disconnect?.();
      } catch {}
      try {
        st?.controls?.dispose?.();
      } catch {}
      try {
        st?.renderer?.dispose?.();
      } catch {}

      try {
        if (st?.overlay?.parentNode) st.overlay.parentNode.removeChild(st.overlay);
      } catch {}
      try {
        st?.pinEls?.clear?.();
      } catch {}

      if (hostRef.current) hostRef.current.innerHTML = '';
      stateRef.current = null;
      setViewerReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return (
    <div className="h-full w-full relative bg-white">
      {!url ? (
        <div className="h-full grid place-items-center text-gray-700">
          <div className="text-center">
            <div className="text-sm font-medium">3D scan pending</div>
            <div className="text-xs text-gray-500 mt-1">
              status: {evidence.status}
              {evidence.jobId ? ` · job: ${evidence.jobId}` : ''}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="absolute left-3 top-3 z-10 rounded-full border bg-white/90 px-3 py-1 text-[11px] text-gray-700">
            Drag to orbit · Hover to identify tooth · Click to select + snap a 3D pin
            {evidence.meta?.segmentation?.perTooth ? ' · segmented teeth' : ''}
          </div>

          <div className="absolute right-3 top-3 z-10 rounded-full border bg-white/90 px-3 py-1 text-[11px] text-gray-700">
            {viewerReady ? (
              <>
                {ext.toUpperCase() || '3D'} ·{' '}
                {evidence.meta?.segmentation?.perTooth ? `Highlight: ${targetNodeName ?? '—'}` : 'Unsegmented'}
              </>
            ) : (
              'Loading…'
            )}
          </div>

          <div ref={hostRef} className="absolute inset-0" />
          {!viewerReady ? <div className="absolute inset-0 bg-white/60" /> : null}
        </>
      )}
    </div>
  );
}

/* =========================================================
   X-ray Viewer
========================================================= */
function XRayViewer({ evidence }: { evidence: DentalEvidence }) {
  const [zoom, setZoom] = useState(1);
  const [invert, setInvert] = useState(true);
  const [contrast, setContrast] = useState(1.25);

  const url = evidence.url || '';
  if (!url) {
    return (
      <div className="h-full w-full grid place-items-center text-gray-700">
        <div className="text-center">
          <div className="text-sm font-medium">X-ray pending</div>
          <div className="text-xs text-gray-500 mt-1">
            status: {evidence.status}
            {evidence.jobId ? ` · job: ${evidence.jobId}` : ''}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative bg-black">
      <div className="absolute left-2 top-2 z-10 rounded-lg border border-white/15 bg-black/40 backdrop-blur px-2 py-2 text-[11px] text-white/90 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">X-ray</span>
          <button
            type="button"
            className="rounded border border-white/20 bg-white/10 px-2 py-1 hover:bg-white/15"
            onClick={() => {
              setZoom(1);
              setInvert(true);
              setContrast(1.25);
            }}
          >
            Reset
          </button>
        </div>

        <label className="block">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-44"
          />
        </label>

        <label className="block">
          Contrast
          <input
            type="range"
            min={0.8}
            max={2.2}
            step={0.05}
            value={contrast}
            onChange={(e) => setContrast(Number(e.target.value))}
            className="w-44"
          />
        </label>

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={invert} onChange={() => setInvert((v) => !v)} />
          Invert
        </label>
      </div>

      <div className="absolute inset-0 grid place-items-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="X-ray"
          className="select-none"
          style={{
            transform: `scale(${zoom})`,
            filter: `${invert ? 'invert(1)' : ''} contrast(${contrast})`,
            maxWidth: '100%',
            maxHeight: '100%',
          }}
        />
      </div>
    </div>
  );
}

/* =========================================================
   Add Media Panel (URL + X-ray upload)
========================================================= */
function AddMediaPanel(props: {
  busy?: boolean;
  onAddUrl: (opts: {
    kind: EvidenceKind;
    url: string;
    contentType?: string;
    modality?: 'xray' | 'photo' | 'other';
    segmentedTeeth?: boolean;
    segmentationScheme?: 'FDI' | 'universal';
  }) => Promise<void>;
  onUploadXrayFile: (file: File) => Promise<void>;
}) {
  const { busy, onAddUrl, onUploadXrayFile } = props;

  const [kind, setKind] = useState<EvidenceKind>('image');
  const [url, setUrl] = useState('');
  const [modality, setModality] = useState<'xray' | 'photo' | 'other'>('photo');

  const [segmentedTeeth, setSegmentedTeeth] = useState(false);
  const [segmentationScheme, setSegmentationScheme] = useState<'FDI' | 'universal'>('FDI');

  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-gray-700">Add imaging / scans</div>
          <div className="text-[11px] text-gray-500">
            Upload X-ray (file) or add URL (X-ray / GLB/OBJ/STL scan). Segmented GLB: nodes tooth_11, tooth_12…
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
        <label className="text-xs text-gray-600">
          Kind
          <select
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as any)}
            disabled={busy}
          >
            <option value="image">Image (photo / X-ray)</option>
            <option value="scan_3d">3D Scan (GLB/GLTF/OBJ/STL)</option>
            <option value="video_clip">Clip (URL)</option>
          </select>
        </label>

        <label className="text-xs text-gray-600">
          Modality
          <select
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={modality}
            onChange={(e) => setModality(e.target.value as any)}
            disabled={busy}
          >
            <option value="photo">Photo</option>
            <option value="xray">X-ray</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label className="text-xs text-gray-600">
          URL
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={kind === 'scan_3d' ? 'https://.../scan.glb (or .obj/.stl)' : 'https://.../image.jpg'}
            disabled={busy}
          />
        </label>
      </div>

      {kind === 'scan_3d' ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={segmentedTeeth}
              onChange={() => setSegmentedTeeth((v) => !v)}
              disabled={busy}
            />
            Segmented teeth (per-tooth nodes)
          </label>

          {segmentedTeeth ? (
            <label className="text-xs text-gray-700 flex items-center gap-2">
              Scheme
              <select
                className="rounded border px-2 py-1 text-xs bg-white"
                value={segmentationScheme}
                onChange={(e) => setSegmentationScheme(e.target.value as any)}
                disabled={busy}
              >
                <option value="FDI">FDI (tooth_11…)</option>
                <option value="universal">Universal (tooth_1…)</option>
              </select>
            </label>
          ) : null}

          <div className="text-[11px] text-gray-500">Click model to snap a true 3D pin (meshId + local hitpoint + normal).</div>
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          disabled={busy || !url.trim()}
          onClick={async () => {
            await onAddUrl({
              kind,
              url: url.trim(),
              modality,
              segmentedTeeth: kind === 'scan_3d' ? segmentedTeeth : false,
              segmentationScheme: kind === 'scan_3d' ? segmentationScheme : undefined,
            });
            setUrl('');
          }}
        >
          Add URL
        </button>

        <label className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 cursor-pointer">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={async (e) => {
              const input = e.target as HTMLInputElement;
              const f = input.files?.[0];
              if (!f) return;
              await onUploadXrayFile(f);
              input.value = '';
            }}
          />
          Upload X-ray (file)
        </label>

        <div className="text-[11px] text-gray-500">
          3D supported: <span className="font-mono">.glb</span> / <span className="font-mono">.gltf</span> /{' '}
          <span className="font-mono">.obj</span> / <span className="font-mono">.stl</span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Tooth Chart (2D grid)
========================================================= */
function ToothChart({
  selected,
  onSelect,
  counts,
}: {
  selected: string;
  onSelect: (toothId: string) => void;
  counts: Map<string, number>;
}) {
  const upper = useMemo(() => Array.from({ length: 16 }, (_, i) => String(i + 1)), []);
  const lower = useMemo(() => Array.from({ length: 16 }, (_, i) => String(32 - i)), []);

  const ToothBtn = ({ id }: { id: string }) => {
    const isSel = id === selected;
    const c = counts.get(id) ?? 0;
    return (
      <button
        key={id}
        type="button"
        onClick={() => onSelect(id)}
        className={
          'relative rounded-lg border px-2 py-2 text-sm font-medium ' +
          (isSel ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-800')
        }
        aria-pressed={isSel}
        title={`Tooth ${id}`}
      >
        {id}
        {c > 0 ? (
          <span className="absolute -top-1 -right-1 text-[10px] rounded-full bg-emerald-600 text-white px-1.5 py-0.5">
            {c}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[11px] text-gray-500 mb-2">Upper</div>
        <div className="grid grid-cols-8 gap-2">
          {upper.map((id) => (
            <ToothBtn key={id} id={id} />
          ))}
        </div>
      </div>

      <div>
        <div className="text-[11px] text-gray-500 mb-2">Lower</div>
        <div className="grid grid-cols-8 gap-2">
          {lower.map((id) => (
            <ToothBtn key={id} id={id} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Quick Finding Composer
========================================================= */
function QuickFindingComposer({
  onCreate,
  disabled,
}: {
  onCreate: (type: FindingTypeKey, severity?: 'mild' | 'moderate' | 'severe', note?: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [type, setType] = useState<FindingTypeKey>('caries_suspected');
  const [severity, setSeverity] = useState<'' | 'mild' | 'moderate' | 'severe'>('moderate');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-semibold text-gray-700">New Finding (manual)</div>
      <div className="mt-2 grid grid-cols-1 gap-2">
        <label className="text-xs text-gray-600">
          Type
          <select
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
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
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as any)}
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
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional details…"
            disabled={disabled || saving}
          />
        </label>

        <button
          type="button"
          className="mt-1 rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          disabled={disabled || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onCreate(type, (severity || undefined) as any, note);
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

/* =========================================================
   Treatment Plan
========================================================= */
function TreatmentPlan({
  selectedTooth,
  items,
  onAdd,
  onToggle,
  busy,
}: {
  selectedTooth: string;
  items: PlanItem[];
  onAdd: (label: string, toothId?: string) => void;
  onToggle: (id: string) => void;
  busy?: boolean;
}) {
  const [label, setLabel] = useState('');
  const [linkToTooth, setLinkToTooth] = useState(true);

  const filtered = useMemo(() => {
    const list = [...items];
    list.sort((a, b) => {
      const at = a.toothId ? 0 : 1;
      const bt = b.toothId ? 0 : 1;
      if (at !== bt) return at - bt;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
    return list;
  }, [items]);

  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-semibold text-gray-700">Treatment plan</div>

      <div className="mt-2 grid grid-cols-1 gap-2">
        <label className="text-xs text-gray-600">
          Planned item
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g., Composite filling, extraction, crown prep…"
            disabled={busy}
          />
        </label>

        <label className="flex items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={linkToTooth}
            onChange={() => setLinkToTooth((v) => !v)}
            disabled={busy}
          />
          Link to selected tooth ({selectedTooth})
        </label>

        <button
          type="button"
          className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          disabled={busy || !label.trim()}
          onClick={() => {
            onAdd(label, linkToTooth ? selectedTooth : undefined);
            setLabel('');
          }}
        >
          + Add plan item
        </button>
      </div>

      <div className="mt-3">
        {filtered.length === 0 ? (
          <div className="text-sm text-gray-600 italic">No plan items yet.</div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((p) => (
              <li key={p.id} className="rounded-lg border p-2 bg-white flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-gray-800">
                    {p.label}
                    {p.toothId ? <span className="ml-2 text-[11px] text-gray-500">tooth {p.toothId}</span> : null}
                  </div>
                  <div className="text-[11px] text-gray-500">{new Date(p.createdAt).toLocaleString()}</div>
                </div>
                <button
                  type="button"
                  className={
                    'text-[11px] rounded-full border px-2 py-0.5 ' +
                    (p.status === 'done'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-gray-200 bg-gray-50 text-gray-700')
                  }
                  onClick={() => onToggle(p.id)}
                  disabled={busy}
                >
                  {p.status === 'done' ? 'Done' : 'Planned'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   Bookmark Modal
========================================================= */
function DentalBookmarkModal({
  open,
  onClose,
  selectedTooth,
  selectedSurface,
  onSave,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  selectedTooth: string;
  selectedSurface?: ToothSurface;
  busy?: boolean;
  onSave: (payload: {
    toothId: string;
    surface?: ToothSurface;
    findingTypeKey: FindingTypeKey;
    severity?: 'mild' | 'moderate' | 'severe';
    note?: string;
    alsoAddPin?: boolean;
  }) => Promise<void>;
}) {
  const [toothId, setToothId] = useState(selectedTooth);
  const [surface, setSurface] = useState<ToothSurface | ''>(selectedSurface ?? '');
  const [findingTypeKey, setFindingTypeKey] = useState<FindingTypeKey>('caries_suspected');
  const [severity, setSeverity] = useState<'' | 'mild' | 'moderate' | 'severe'>('moderate');
  const [note, setNote] = useState('');
  const [alsoAddPin, setAlsoAddPin] = useState(true);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  React.useEffect(() => {
    setToothId(selectedTooth);
    setSurface(selectedSurface ?? '');
  }, [selectedTooth, selectedSurface]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-xl bg-white border shadow">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Bookmark to tooth</div>
            <div className="text-xs text-gray-500">Creates finding + live_capture evidence (jobs)</div>
          </div>
          <button type="button" className="text-xs text-gray-600 hover:text-gray-900" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="p-4 space-y-3">
          {err ? (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">{err}</div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-600 block">
              Tooth #
              <input
                className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                value={toothId}
                onChange={(e) => setToothId(e.target.value)}
                placeholder="e.g. 14"
                disabled={saving || busy}
              />
            </label>

            <label className="text-xs text-gray-600 block">
              Surface
              <select
                className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                value={surface}
                onChange={(e) => setSurface(e.target.value as any)}
                disabled={saving || busy}
              >
                <option value="">—</option>
                {(['O', 'M', 'D', 'B', 'L'] as ToothSurface[]).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="text-xs text-gray-600 block">
            Finding type
            <select
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={findingTypeKey}
              onChange={(e) => setFindingTypeKey(e.target.value as any)}
              disabled={saving || busy}
            >
              {FINDING_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-gray-600 block">
            Severity
            <select
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as any)}
              disabled={saving || busy}
            >
              <option value="">—</option>
              <option value="mild">mild</option>
              <option value="moderate">moderate</option>
              <option value="severe">severe</option>
            </select>
          </label>

          <label className="text-xs text-gray-600 block">
            Note
            <textarea
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional details…"
              disabled={saving || busy}
            />
          </label>

          <label className="flex items-center gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={alsoAddPin}
              onChange={() => setAlsoAddPin((v) => !v)}
              disabled={saving || busy}
            />
            Auto-add a pin annotation (wow)
          </label>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
              onClick={onClose}
              disabled={saving || busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded border bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-sm disabled:opacity-50"
              disabled={saving || busy || !String(toothId || '').trim()}
              onClick={async () => {
                setErr(null);
                setSaving(true);
                try {
                  await onSave({
                    toothId: String(toothId).trim(),
                    surface: (surface || undefined) as any,
                    findingTypeKey,
                    severity: (severity || undefined) as any,
                    note: note?.trim() ? note.trim() : undefined,
                    alsoAddPin,
                  });
                  setNote('');
                  onClose();
                } catch (e: any) {
                  setErr(e?.message || 'Failed to save bookmark');
                } finally {
                  setSaving(false);
                }
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   File utilities
========================================================= */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Failed to read file'));
    r.onload = () => resolve(String(r.result || ''));
    r.readAsDataURL(file);
  });
}
