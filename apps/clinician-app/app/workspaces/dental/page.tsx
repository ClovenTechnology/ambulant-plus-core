// apps/clinician-app/app/workspaces/dental/page.tsx
'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import AddMediaPanel from './_components/AddMediaPanel';
import DentalBookmarkModal from './_components/DentalBookmarkModal';
import EvidencePreview from './_components/EvidencePreview';
import QuickFindingComposer from './_components/QuickFindingComposer';
import ToothChart from './_components/ToothChart';
import TreatmentPlan from './_components/TreatmentPlan';

import type {
  DentalAnnotation,
  DentalEvidence,
  DentalFinding,
  DentalLocation,
  EvidenceKind,
  FindingSeverity,
  FindingTypeKey,
  ModelPinPayload,
  PlanItem,
  ScreenPinPayload,
  ToothSurface,
  ToothSystem,
} from './_lib/types';
import { FINDING_TYPES } from './_lib/types';
import { extFromUrl } from './_lib/helpers';
import { toDisplayToothId } from './_lib/toothMap';

type LabRevision = {
  id: string;
  revisionNo?: number;
  createdAt: string;
  toothId?: string;
  note?: string;
  evidenceIds?: string[];
  annotationCount?: number;
  createdBy?: string;
  meta?: Record<string, any>;
};

type Banner = {
  kind: 'info' | 'success' | 'error';
  text: string;
};

const API_BASE = (process.env.NEXT_PUBLIC_WORKSPACE_API_BASE || '/api').replace(
  /\/+$/,
  ''
);

const GATEWAY = process.env.NEXT_PUBLIC_APIGW_BASE ?? '';

function nowISO() {
  return new Date().toISOString();
}

function errMsg(e: unknown) {
  if (e instanceof Error) return e.message;

  if (typeof e === 'object' && e) {
    const anyErr = e as any;
    return (
      anyErr?.message ||
      anyErr?.details?.message ||
      anyErr?.error ||
      'Request failed'
    );
  }

  return 'Request failed';
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

function unwrapList<T>(json: any): T[] {
  const candidate = json?.items ?? json?.data ?? json?.records ?? json;

  return Array.isArray(candidate) ? candidate : [];
}

function unwrapOne<T>(json: any): T {
  return (json?.item ?? json?.record ?? json?.data ?? json) as T;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
  }

  return json as T;
}

async function postJson<T>(path: string, body: any): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
  }

  return unwrapOne<T>(json);
}

async function patchJson<T>(path: string, body: any): Promise<T> {
  const res = await fetch(path, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
  }

  return unwrapOne<T>(json);
}

async function postFinding(req: any) {
  return postJson<DentalFinding>(`${API_BASE}/findings`, req);
}

async function postEvidence(req: any) {
  return postJson<DentalEvidence>(`${API_BASE}/evidence`, req);
}

async function postAnnotation(req: any) {
  return postJson<DentalAnnotation>(`${API_BASE}/annotations`, req);
}

async function postRevision(req: any) {
  return postJson<LabRevision>(`${API_BASE}/revisions`, req);
}

async function postPlanItem(req: any) {
  return postJson<PlanItem>(`${API_BASE}/plan-items`, req);
}

async function patchPlanItem(req: { id: string; status: PlanItem['status'] }) {
  return patchJson<PlanItem>(`${API_BASE}/plan-items`, req);
}

function locationToUniversal(
  value?: DentalLocation | null,
  fallbackToothId?: string | null
) {
  const toothId = value?.toothId ?? fallbackToothId;

  if (!toothId) return null;

  return String(toothId);
}

function getFindingToothId(finding: DentalFinding) {
  return locationToUniversal(finding.location, finding.toothId);
}

function getEvidenceToothId(evidence: DentalEvidence) {
  return locationToUniversal(evidence.location, evidence.toothId);
}

function makeLocation(toothId: string, surface?: ToothSurface): DentalLocation {
  return {
    kind: 'dental_tooth',
    toothId: String(toothId),
    surface,
  };
}

function makeScreenPinPayload(
  x: number,
  y: number,
  label = 'Pin'
): ScreenPinPayload {
  return {
    kind: 'screen',
    x,
    y,
    label,
  };
}

async function resolveClinicianFromMe() {
  const res = await fetch('/api/me', { cache: 'no-store' });
  const json = await res.json().catch(() => null);

  if (!res.ok || !json) {
    throw new Error(json?.error || json?.message || 'Unable to resolve clinician profile.');
  }

  const id =
    json.clinicianId ||
    json.id ||
    json.clinician?.id ||
    json.profile?.id ||
    '';

  if (!id || String(id) === 'clin-demo') {
    throw new Error('Production clinician identity is not configured.');
  }

  return String(id);
}

async function presignAndUploadDentalFile(file: File) {
  if (!GATEWAY) {
    throw new Error(
      'File upload gateway is not configured. Set NEXT_PUBLIC_APIGW_BASE.'
    );
  }

  const metaRes = await fetch(`${GATEWAY}/files/presign`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      category: 'dental-evidence',
      contentType: file.type || 'application/octet-stream',
      fileName: file.name,
    }),
  });

  const meta = await metaRes.json().catch(() => null);

  if (!metaRes.ok || !meta) {
    throw new Error(meta?.error || meta?.message || 'Failed to request upload URL.');
  }

  if (meta.fields && meta.url) {
    const form = new FormData();

    Object.entries(meta.fields).forEach(([key, value]) => {
      form.append(key, String(value));
    });

    form.append('file', file);

    const uploadRes = await fetch(String(meta.url), {
      method: 'POST',
      body: form,
    });

    if (!uploadRes.ok) {
      throw new Error('Dental evidence upload failed.');
    }
  } else if (meta.uploadUrl || meta.signedUrl) {
    const uploadRes = await fetch(String(meta.uploadUrl || meta.signedUrl), {
      method: 'PUT',
      headers: {
        'content-type': file.type || 'application/octet-stream',
      },
      body: file,
    });

    if (!uploadRes.ok) {
      throw new Error('Dental evidence upload failed.');
    }
  } else {
    throw new Error('Upload URL response did not include a supported upload target.');
  }

  const publicUrl =
    meta.publicUrl ||
    meta.fileUrl ||
    meta.readUrl ||
    meta.cdnUrl ||
    meta.assetUrl ||
    undefined;

  return {
    fileKey: meta.fileKey || meta.key || null,
    fileName: meta.fileName || file.name,
    url: publicUrl ? String(publicUrl) : undefined,
  };
}

function DentalWorkspacePageContent() {
  const sp = useSearchParams();
  const qs = useMemo(() => new URLSearchParams(sp?.toString() ?? ''), [sp]);

  const patientId = qs.get('patientId') || qs.get('patient') || '';
  const encounterId = qs.get('encounterId') || qs.get('encounter') || '';
  const clinicianIdFromQuery =
    qs.get('clinicianId') || qs.get('clinician') || '';

  const [clinicianId, setClinicianId] = useState<string>(clinicianIdFromQuery);
  const [clinicianLoading, setClinicianLoading] = useState(
    !clinicianIdFromQuery
  );
  const [clinicianError, setClinicianError] = useState<string | null>(null);

  const [toothSystem, setToothSystem] = useState<ToothSystem>('universal');
  const [selectedTooth, setSelectedTooth] = useState('14');
  const [selectedSurface, setSelectedSurface] = useState<
    ToothSurface | undefined
  >(undefined);

  const [findings, setFindings] = useState<DentalFinding[]>([]);
  const [evidence, setEvidence] = useState<DentalEvidence[]>([]);
  const [annotations, setAnnotations] = useState<DentalAnnotation[]>([]);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [revisions, setRevisions] = useState<LabRevision[]>([]);

  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(
    null
  );
  const [previewMode, setPreviewMode] = useState<'teeth3d' | 'evidence'>(
    'teeth3d'
  );

  const [bookmarkOpen, setBookmarkOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);

  const selectedToothDisplay = useMemo(
    () => toDisplayToothId(selectedTooth, toothSystem),
    [selectedTooth, toothSystem]
  );

  const canLoadWorkspace = Boolean(patientId && encounterId);

  const queryString = useMemo(() => {
    if (!patientId || !encounterId) return '';

    const query = new URLSearchParams();
    query.set('patientId', patientId);
    query.set('encounterId', encounterId);
    query.set('specialty', 'dental');

    return query.toString();
  }, [patientId, encounterId]);

  useEffect(() => {
    let cancelled = false;

    if (clinicianIdFromQuery) {
      setClinicianId(clinicianIdFromQuery);
      setClinicianLoading(false);
      setClinicianError(null);
      return;
    }

    async function loadClinician() {
      setClinicianLoading(true);
      setClinicianError(null);

      try {
        const id = await resolveClinicianFromMe();

        if (!cancelled) {
          setClinicianId(id);
        }
      } catch (err) {
        if (!cancelled) {
          setClinicianId('');
          setClinicianError(errMsg(err));
        }
      } finally {
        if (!cancelled) {
          setClinicianLoading(false);
        }
      }
    }

    loadClinician();

    return () => {
      cancelled = true;
    };
  }, [clinicianIdFromQuery]);

  const refreshAll = async () => {
    if (!queryString) return;

    setLoadingData(true);

    try {
      const [findingsJson, evidenceJson, annotationsJson, planJson, revisionsJson] =
        await Promise.all([
          getJson<any>(`${API_BASE}/findings?${queryString}`),
          getJson<any>(`${API_BASE}/evidence?${queryString}`),
          getJson<any>(`${API_BASE}/annotations?${queryString}`),
          getJson<any>(`${API_BASE}/plan-items?${queryString}`),
          getJson<any>(`${API_BASE}/revisions?${queryString}`),
        ]);

      setFindings(unwrapList<DentalFinding>(findingsJson));
      setEvidence(unwrapList<DentalEvidence>(evidenceJson));
      setAnnotations(unwrapList<DentalAnnotation>(annotationsJson));
      setPlanItems(unwrapList<PlanItem>(planJson));
      setRevisions(unwrapList<LabRevision>(revisionsJson));
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    if (!canLoadWorkspace) return;

    async function load() {
      try {
        setBanner(null);
        await refreshAll();
      } catch (err) {
        if (!cancelled) {
          setBanner({
            kind: 'error',
            text: `Failed to load dental workspace data: ${errMsg(err)}`,
          });
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoadWorkspace, queryString]);

  const locationForSelection = () => makeLocation(selectedTooth, selectedSurface);

  const findingsForSelection = useMemo(() => {
    return findings
      .filter((finding) => getFindingToothId(finding) === selectedTooth)
      .sort((a, b) => {
        const ad = a.updatedAt || a.createdAt;
        const bd = b.updatedAt || b.createdAt;
        return ad < bd ? 1 : -1;
      });
  }, [findings, selectedTooth]);

  const evidenceForSelection = useMemo(() => {
    return evidence
      .filter((item) => getEvidenceToothId(item) === selectedTooth)
      .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
  }, [evidence, selectedTooth]);

  const toothCounts = useMemo(() => {
    const map = new Map<string, number>();

    for (const finding of findings) {
      const toothId = getFindingToothId(finding);

      if (!toothId) continue;

      map.set(toothId, (map.get(toothId) ?? 0) + 1);
    }

    return map;
  }, [findings]);

  const selectedEvidence = useMemo(() => {
    return evidence.find((item) => item.id === selectedEvidenceId) ?? null;
  }, [evidence, selectedEvidenceId]);

  const annotationsForSelectedEvidence = useMemo(() => {
    if (!selectedEvidenceId) return [];

    return annotations.filter(
      (annotation) => annotation.evidenceId === selectedEvidenceId
    );
  }, [annotations, selectedEvidenceId]);

  useEffect(() => {
    if (selectedEvidenceId) {
      setPreviewMode('evidence');
    }
  }, [selectedEvidenceId]);

  useEffect(() => {
    if (!selectedEvidenceId) return;

    const stillVisible = evidenceForSelection.some(
      (item) => item.id === selectedEvidenceId
    );

    if (!stillVisible) {
      setSelectedEvidenceId(null);
    }
  }, [selectedEvidenceId, evidenceForSelection]);

  const requireReadyForWrite = () => {
    if (!patientId || !encounterId) {
      throw new Error('Missing patientId or encounterId.');
    }

    if (!clinicianId) {
      throw new Error('Missing clinician identity.');
    }
  };

  const createManualFinding = async (
    type: FindingTypeKey,
    severity?: FindingSeverity,
    note?: string
  ) => {
    requireReadyForWrite();

    const title = FINDING_TYPES.find((item) => item.key === type)?.label ?? 'Finding';

    setBusy(true);
    setBanner(null);

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
        location: locationForSelection(),
        toothId: selectedTooth,
        surface: selectedSurface,
        createdBy: clinicianId,
      });

      await refreshAll();

      setBanner({
        kind: 'success',
        text: 'Finding saved.',
      });
    } catch (err) {
      setBanner({
        kind: 'error',
        text: `Failed to save finding: ${errMsg(err)}`,
      });
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const createCentrePinOnSelectedEvidence = async () => {
    if (!selectedEvidence) {
      setBanner({
        kind: 'info',
        text: 'Select an evidence item first.',
      });
      return;
    }

    await createScreenPinOnSelectedEvidence(0.5, 0.5, 'Centre pin');
  };

  const createScreenPinOnSelectedEvidence = async (
    x01: number,
    y01: number,
    label?: string
  ) => {
    requireReadyForWrite();

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
        location: selectedEvidence.location ?? locationForSelection(),
        toothId: getEvidenceToothId(selectedEvidence) ?? selectedTooth,
        type: 'pin',
        payload: makeScreenPinPayload(x01, y01, label || 'Pin'),
        createdAt: nowISO(),
        createdBy: clinicianId,
      });

      await refreshAll();

      setBanner({
        kind: 'success',
        text: 'Pin added.',
      });
    } catch (err) {
      setBanner({
        kind: 'error',
        text: `Failed to add pin: ${errMsg(err)}`,
      });
    } finally {
      setBusy(false);
    }
  };

  const createModelPinOnSelectedEvidence = async (
    payload: ModelPinPayload,
    overrideToothId?: string
  ) => {
    requireReadyForWrite();

    if (!selectedEvidence) return;

    const toothId = overrideToothId || getEvidenceToothId(selectedEvidence) || selectedTooth;
    const location = makeLocation(toothId, selectedSurface);

    setBusy(true);
    setBanner(null);

    try {
      await postAnnotation({
        patientId,
        encounterId,
        specialty: 'dental',
        evidenceId: selectedEvidence.id,
        findingId: selectedEvidence.findingId ?? null,
        location,
        toothId,
        type: 'pin',
        payload,
        createdAt: nowISO(),
        createdBy: clinicianId,
      });

      await refreshAll();

      setSelectedTooth(toothId);

      setBanner({
        kind: 'success',
        text: '3D pin snapped to mesh.',
      });
    } catch (err) {
      setBanner({
        kind: 'error',
        text: `Failed to add 3D pin: ${errMsg(err)}`,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleBookmark = async (payload: {
    toothId: string;
    surface?: ToothSurface;
    findingTypeKey: FindingTypeKey;
    severity?: FindingSeverity;
    note?: string;
    alsoAddPin?: boolean;
  }) => {
    requireReadyForWrite();

    const toothId = String(payload.toothId).trim();

    if (!toothId) {
      throw new Error('Tooth ID is required.');
    }

    const location = makeLocation(toothId, payload.surface);
    const title =
      FINDING_TYPES.find((item) => item.key === payload.findingTypeKey)?.label ??
      'Finding';

    setBusy(true);
    setBanner(null);

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
        location,
        toothId,
        surface: payload.surface,
        createdBy: clinicianId,
      });

      const snapshot = await postEvidence({
        patientId,
        encounterId,
        specialty: 'dental',
        findingId: createdFinding.id,
        location,
        toothId,
        surface: payload.surface,
        kind: 'image',
        device: 'intraoral_cam',
        url: undefined,
        thumbnailUrl: undefined,
        contentType: 'image/jpeg',
        status: 'processing',
        capturedAt: nowISO(),
        createdBy: clinicianId,
        meta: {
          source: 'live_capture',
          captureMode: 'snapshot',
        },
      });

      await postEvidence({
        patientId,
        encounterId,
        specialty: 'dental',
        findingId: createdFinding.id,
        location,
        toothId,
        surface: payload.surface,
        kind: 'video_clip',
        device: 'intraoral_cam',
        url: undefined,
        thumbnailUrl: undefined,
        contentType: 'video/mp4',
        status: 'processing',
        capturedAt: nowISO(),
        createdBy: clinicianId,
        meta: {
          source: 'live_capture',
          captureMode: 'clip',
          durationMs: 10_000,
        },
      });

      if (payload.alsoAddPin) {
        await postAnnotation({
          patientId,
          encounterId,
          specialty: 'dental',
          evidenceId: snapshot.id,
          findingId: createdFinding.id,
          location,
          toothId,
          surface: payload.surface,
          type: 'pin',
          payload: makeScreenPinPayload(0.5, 0.48, 'Mark area'),
          createdAt: nowISO(),
          createdBy: clinicianId,
        });
      }

      await refreshAll();

      setSelectedTooth(toothId);
      setSelectedSurface(payload.surface);
      setSelectedEvidenceId(snapshot.id);
      setPreviewMode('evidence');

      setBanner({
        kind: 'success',
        text: `Bookmark saved for tooth ${toothId}${
          payload.surface ? ` · ${payload.surface}` : ''
        }. Capture jobs created.`,
      });
    } catch (err) {
      setBanner({
        kind: 'error',
        text: `Failed to save bookmark: ${errMsg(err)}`,
      });
      throw err;
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
    requireReadyForWrite();

    const url = opts.url.trim();

    if (!url) {
      throw new Error('Evidence URL is required.');
    }

    const ext = extFromUrl(url);
    const location = locationForSelection();

    setBusy(true);
    setBanner(null);

    try {
      const created = await postEvidence({
        patientId,
        encounterId,
        specialty: 'dental',
        findingId: null,
        location,
        toothId: selectedTooth,
        surface: selectedSurface,
        kind: opts.kind,
        device: opts.kind === 'scan_3d' ? 'scanner_3d' : 'upload',
        url,
        thumbnailUrl: undefined,
        contentType: opts.contentType || guessContentTypeFromExt(ext),
        status: 'ready',
        capturedAt: nowISO(),
        createdBy: clinicianId,
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

      setSelectedEvidenceId(created.id);
      setPreviewMode('evidence');

      setBanner({
        kind: 'success',
        text: 'Evidence added.',
      });
    } catch (err) {
      setBanner({
        kind: 'error',
        text: `Failed to add evidence: ${errMsg(err)}`,
      });
    } finally {
      setBusy(false);
    }
  };

  const addXrayFromFile = async (file: File) => {
    requireReadyForWrite();

    const location = locationForSelection();

    setBusy(true);
    setBanner(null);

    try {
      const uploaded = await presignAndUploadDentalFile(file);

      const created = await postEvidence({
        patientId,
        encounterId,
        specialty: 'dental',
        findingId: null,
        location,
        toothId: selectedTooth,
        surface: selectedSurface,
        kind: 'image',
        device: 'upload',
        url: uploaded.url,
        thumbnailUrl: undefined,
        contentType: file.type || 'image/*',
        status: uploaded.url ? 'ready' : 'processing',
        capturedAt: nowISO(),
        createdBy: clinicianId,
        meta: {
          source: 'upload_file',
          modality: 'xray',
          originalName: file.name,
          size: file.size,
          fileKey: uploaded.fileKey,
          fileName: uploaded.fileName,
        },
      });

      await refreshAll();

      setSelectedEvidenceId(created.id);
      setPreviewMode('evidence');

      setBanner({
        kind: uploaded.url ? 'success' : 'info',
        text: uploaded.url
          ? 'X-ray uploaded.'
          : 'X-ray uploaded. Evidence was recorded as processing until a public file URL is attached.',
      });
    } catch (err) {
      setBanner({
        kind: 'error',
        text: `Failed to upload X-ray: ${errMsg(err)}`,
      });
    } finally {
      setBusy(false);
    }
  };

  const createPlanItem = async (label: string, toothId?: string) => {
    requireReadyForWrite();

    const cleanLabel = label.trim();

    if (!cleanLabel) return;

    setBusy(true);
    setBanner(null);

    try {
      await postPlanItem({
        patientId,
        encounterId,
        specialty: 'dental',
        label: cleanLabel,
        toothId,
        status: 'planned',
        createdAt: nowISO(),
        createdBy: clinicianId,
      });

      await refreshAll();

      setBanner({
        kind: 'success',
        text: 'Treatment plan item added.',
      });
    } catch (err) {
      setBanner({
        kind: 'error',
        text: `Failed to add plan item: ${errMsg(err)}`,
      });
    } finally {
      setBusy(false);
    }
  };

  const togglePlanDone = async (id: string) => {
    const current = planItems.find((item) => item.id === id);

    if (!current) return;

    setBusy(true);
    setBanner(null);

    try {
      await patchPlanItem({
        id,
        status: current.status === 'done' ? 'planned' : 'done',
      });

      await refreshAll();
    } catch (err) {
      setBanner({
        kind: 'error',
        text: `Failed to update plan item: ${errMsg(err)}`,
      });
    } finally {
      setBusy(false);
    }
  };

  const buildLabExportPayload = (includeAllEvidenceForTooth: boolean) => {
    const selectedEvidenceIds = selectedEvidenceId ? [selectedEvidenceId] : [];
    const allToothEvidenceIds = evidenceForSelection.map((item) => item.id);
    const evidenceIds = includeAllEvidenceForTooth
      ? allToothEvidenceIds
      : selectedEvidenceIds;

    const exportAnnotations = annotations.filter(
      (annotation) =>
        annotation.evidenceId && evidenceIds.includes(annotation.evidenceId)
    );

    return {
      kind: 'lab_revision_export',
      patientId,
      encounterId,
      specialty: 'dental',
      toothSystem,
      toothIds: [selectedTooth],
      evidenceIds,
      annotations: exportAnnotations.map((annotation) => ({
        id: annotation.id,
        evidenceId: annotation.evidenceId,
        findingId: annotation.findingId ?? null,
        location: annotation.location,
        type: annotation.type,
        payload: annotation.payload,
        createdAt: annotation.createdAt,
        createdBy: annotation.createdBy,
      })),
      createdAt: nowISO(),
      createdBy: clinicianId,
    };
  };

  const makeRevisionPackage = async () => {
    requireReadyForWrite();

    const exportPayload = buildLabExportPayload(false);

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
        annotationCount: exportPayload.annotations.length,
        createdAt: nowISO(),
        createdBy: clinicianId,
        meta: {
          exportPayload,
        },
      });

      await refreshAll();

      setBanner({
        kind: 'success',
        text: 'Revision package created.',
      });
    } catch (err) {
      setBanner({
        kind: 'error',
        text: `Failed to create revision: ${errMsg(err)}`,
      });
    } finally {
      setBusy(false);
    }
  };

  const sendToLab = async () => {
    requireReadyForWrite();

    const exportPayload = buildLabExportPayload(true);

    setBusy(true);
    setBanner(null);

    try {
      await postJson(`${API_BASE}/labs/send-revision`, exportPayload);

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
        meta: {
          exportPayload,
          sentToLab: true,
        },
      });

      await refreshAll();

      setBanner({
        kind: 'success',
        text: 'Sent to lab.',
      });
    } catch (err) {
      setBanner({
        kind: 'error',
        text: `Failed to send to lab: ${errMsg(err)}`,
      });
    } finally {
      setBusy(false);
    }
  };

  if (!canLoadWorkspace) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-3xl rounded-xl border border-rose-200 bg-rose-50 p-6">
          <h1 className="text-lg font-semibold text-rose-900">
            Dental workspace context missing
          </h1>
          <p className="mt-2 text-sm text-rose-800">
            This production workspace requires both{' '}
            <code className="font-mono">patientId</code> and{' '}
            <code className="font-mono">encounterId</code> in the URL.
          </p>
        </div>
      </main>
    );
  }

  if (clinicianLoading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-3xl rounded-xl border bg-white p-6 text-sm text-gray-600">
          Loading clinician context…
        </div>
      </main>
    );
  }

  if (!clinicianId || clinicianError) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-3xl rounded-xl border border-rose-200 bg-rose-50 p-6">
          <h1 className="text-lg font-semibold text-rose-900">
            Clinician context unavailable
          </h1>
          <p className="mt-2 text-sm text-rose-800">
            {clinicianError ||
              'This production workspace requires a valid clinician identity.'}
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-gray-500">Ambulant+ Workspace</div>
            <h1 className="text-lg font-semibold">Dental Workspace</h1>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="hidden md:block text-xs text-gray-600">
              Patient: <span className="font-mono">{patientId}</span> ·
              Encounter: <span className="font-mono">{encounterId}</span>
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
              >
                FDI
              </button>
            </div>

            <button
              type="button"
              className="text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
              onClick={() =>
                refreshAll().catch((err) =>
                  setBanner({
                    kind: 'error',
                    text: `Refresh failed: ${errMsg(err)}`,
                  })
                )
              }
              disabled={busy || loadingData}
            >
              {loadingData ? 'Refreshing…' : 'Refresh'}
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
          <section className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-4 py-3">
              <div className="text-sm font-semibold">Tooth Chart</div>
              <div className="text-xs text-gray-500">
                Click a tooth · pick surface · review findings
              </div>
            </div>

            <div className="p-4">
              <ToothChart
                toothSystem={toothSystem}
                selectedUniversal={selectedTooth}
                onSelectUniversal={(toothId) => {
                  setSelectedTooth(toothId);
                  setSelectedSurface(undefined);
                }}
                counts={toothCounts}
              />

              <div className="mt-4">
                <div className="text-xs font-semibold text-gray-700">
                  Surface
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {(['O', 'M', 'D', 'B', 'L'] as ToothSurface[]).map(
                    (surface) => (
                      <button
                        key={surface}
                        type="button"
                        className={
                          'px-3 py-1.5 rounded-full border text-xs ' +
                          (selectedSurface === surface
                            ? 'border-blue-300 bg-blue-50 text-blue-800'
                            : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700')
                        }
                        onClick={() =>
                          setSelectedSurface((prev) =>
                            prev === surface ? undefined : surface
                          )
                        }
                      >
                        {surface}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="mt-5 rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700">
                  Selected
                </div>

                <div className="mt-1 text-sm text-gray-800">
                  Tooth{' '}
                  <span className="font-mono font-semibold">
                    {selectedToothDisplay}
                  </span>
                  {selectedSurface ? (
                    <>
                      {' '}
                      · Surface{' '}
                      <span className="font-mono font-semibold">
                        {selectedSurface}
                      </span>
                    </>
                  ) : null}
                </div>

                <div className="mt-1 text-[11px] text-gray-500">
                  Internal storage uses Universal tooth IDs. FDI is display-only.
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs font-semibold text-gray-700">
                  Findings
                </div>

                <div className="mt-2">
                  {findingsForSelection.length === 0 ? (
                    <div className="text-sm text-gray-600 italic">
                      No findings for this tooth yet.
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {findingsForSelection.map((finding) => (
                        <li key={finding.id} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold">
                                {finding.title}
                              </div>

                              <div className="text-xs text-gray-500">
                                {(finding.status || 'draft').toUpperCase()} ·{' '}
                                {finding.severity ?? '—'} ·{' '}
                                {new Date(finding.createdAt).toLocaleString()}
                              </div>
                            </div>

                            <span className="text-[11px] rounded-full border px-2 py-0.5 bg-gray-50 text-gray-700">
                              {
                                evidence.filter(
                                  (item) => item.findingId === finding.id
                                ).length
                              }{' '}
                              evidence
                            </span>
                          </div>

                          {finding.note ? (
                            <div className="mt-2 text-sm text-gray-700">
                              {finding.note}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Live & Media</div>
                <div className="text-xs text-gray-500">
                  3D teeth + evidence strip + scans + X-rays
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
                  onClick={createCentrePinOnSelectedEvidence}
                  disabled={busy || !selectedEvidence}
                  title="Adds a centred pin to the selected evidence"
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
              <div className="rounded-lg border bg-white overflow-hidden">
                <div className="border-b bg-gray-50 px-3 py-2 flex items-center justify-between gap-2">
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
                    Tooth <span className="font-mono">{selectedToothDisplay}</span>
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
                    <div className="h-full grid place-items-center text-sm text-gray-600">
                      Select evidence to inspect media, or use the chart on the
                      left to select a tooth.
                    </div>
                  ) : (
                    <EvidencePreview
                      selectedEvidence={selectedEvidence}
                      pins={annotationsForSelectedEvidence.filter(
                        (annotation) => annotation.type === 'pin'
                      )}
                      busy={busy}
                      onAddScreenPin={(x, y) =>
                        createScreenPinOnSelectedEvidence(x, y, 'Pin')
                      }
                      onAddModelPin={(payload, overrideToothId) =>
                        createModelPinOnSelectedEvidence(payload, overrideToothId)
                      }
                      selectedToothUniversal={selectedTooth}
                      toothSystem={toothSystem}
                      onSelectToothUniversal={(toothId) => {
                        setSelectedTooth(toothId);
                        setSelectedSurface(undefined);
                      }}
                    />
                  )}
                </div>
              </div>

              <AddMediaPanel
                busy={busy}
                onAddUrl={addEvidenceFromUrl}
                onUploadXrayFile={addXrayFromFile}
              />

              <div>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-gray-700">
                    Evidence for tooth {selectedToothDisplay}
                  </div>

                  <div className="text-[11px] text-gray-500">
                    {evidenceForSelection.length} item(s)
                  </div>
                </div>

                {evidenceForSelection.length === 0 ? (
                  <div className="mt-2 text-sm text-gray-600 italic">
                    No evidence yet for this tooth.
                  </div>
                ) : (
                  <div className="mt-2 flex gap-2 overflow-auto pb-1">
                    {evidenceForSelection.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedEvidenceId(item.id)}
                        className={
                          'min-w-[210px] max-w-[210px] rounded-lg border overflow-hidden bg-white text-left hover:bg-gray-50 ' +
                          (selectedEvidenceId === item.id
                            ? 'ring-2 ring-blue-200'
                            : '')
                        }
                      >
                        <div className="h-24 bg-gray-100 grid place-items-center">
                          <span className="text-xs text-gray-500">
                            {item.kind === 'image'
                              ? 'Image / X-ray'
                              : item.kind === 'scan_3d'
                                ? '3D Scan'
                                : 'Clip'}
                          </span>
                        </div>

                        <div className="p-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-medium text-gray-800">
                              {item.kind}
                            </div>

                            <span
                              className={
                                'text-[10px] rounded-full border px-1.5 py-0.5 ' +
                                (item.status === 'ready'
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                  : item.status === 'processing'
                                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                                    : 'border-rose-200 bg-rose-50 text-rose-800')
                              }
                            >
                              {item.status}
                            </span>
                          </div>

                          <div className="text-[11px] text-gray-500">
                            {new Date(item.capturedAt).toLocaleString()}
                          </div>

                          {item.jobId ? (
                            <div className="mt-1 text-[10px] text-gray-400 font-mono">
                              job: {item.jobId}
                            </div>
                          ) : null}

                          {item.kind === 'scan_3d' &&
                          item.meta?.segmentation?.perTooth ? (
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

              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-gray-700">
                      Lab revisions
                    </div>
                    <div className="text-[11px] text-gray-500">
                      Revision history + export workflow
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
                      onClick={makeRevisionPackage}
                      disabled={busy}
                    >
                      Create revision
                    </button>

                    <button
                      type="button"
                      className="text-xs px-3 py-1.5 rounded border bg-blue-50 hover:bg-blue-100 text-blue-800 disabled:opacity-50"
                      onClick={sendToLab}
                      disabled={busy}
                    >
                      Send to lab
                    </button>
                  </div>
                </div>

                {revisions.length === 0 ? (
                  <div className="mt-2 text-sm text-gray-600 italic">
                    No revisions yet.
                  </div>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {revisions.map((revision) => (
                      <li key={revision.id} className="rounded-lg border bg-white p-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold text-gray-800">
                            Revision {revision.revisionNo ?? revision.id}
                          </div>

                          <div className="text-[11px] text-gray-500">
                            {new Date(revision.createdAt).toLocaleString()}
                          </div>
                        </div>

                        <div className="mt-1 text-[11px] text-gray-600">
                          Tooth: {revision.toothId ?? '—'} · Evidence:{' '}
                          {revision.evidenceIds?.length ?? 0} · Pins/comments:{' '}
                          {revision.annotationCount ?? 0}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-lg border p-3">
                <div className="text-xs font-semibold text-gray-700">
                  Annotations selected evidence
                </div>

                {!selectedEvidenceId ? (
                  <div className="mt-1 text-sm text-gray-600 italic">
                    Select an evidence item.
                  </div>
                ) : annotationsForSelectedEvidence.length === 0 ? (
                  <div className="mt-1 text-sm text-gray-600 italic">
                    No annotations yet.
                  </div>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {annotationsForSelectedEvidence.map((annotation) => (
                      <li key={annotation.id} className="rounded border p-2 bg-white">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold text-gray-800">
                            {annotation.type}
                          </div>

                          <div className="text-[11px] text-gray-500">
                            {new Date(annotation.createdAt).toLocaleString()}
                          </div>
                        </div>

                        <div className="mt-1 text-[11px] text-gray-600 font-mono break-all">
                          {JSON.stringify(annotation.payload)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-4 py-3">
              <div className="text-sm font-semibold">Findings & Plan</div>
              <div className="text-xs text-gray-500">
                Server-backed findings and treatment plan
              </div>
            </div>

            <div className="p-4 space-y-4">
              <QuickFindingComposer
                disabled={busy}
                onCreate={createManualFinding}
              />

              <TreatmentPlan
                selectedToothUniversal={selectedTooth}
                selectedToothDisplay={selectedToothDisplay}
                items={planItems}
                onAdd={createPlanItem}
                onToggle={togglePlanDone}
                busy={busy}
              />

              <div className="rounded-lg border p-3 bg-gray-50">
                <div className="text-xs font-semibold text-gray-700">
                  Segmentation pipeline
                </div>

                <div className="mt-1 text-sm text-gray-700">
                  Store per-tooth meshes inside one GLB/GLTF with named nodes
                  like <span className="font-mono">tooth_11</span>,{' '}
                  <span className="font-mono">tooth_12</span>… Then the viewer
                  can highlight a tooth and snap true 3D pins to that mesh.
                </div>
              </div>

              <div className="rounded-lg border p-3 bg-gray-50">
                <div className="text-xs font-semibold text-gray-700">
                  Live capture note
                </div>

                <div className="mt-1 text-sm text-gray-700">
                  Bookmarking creates processing evidence records. Your capture
                  worker should later update final URLs and status through the
                  evidence API.
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <DentalBookmarkModal
        open={bookmarkOpen}
        onClose={() => setBookmarkOpen(false)}
        selectedToothUniversal={selectedTooth}
        selectedToothDisplay={selectedToothDisplay}
        selectedSurface={selectedSurface}
        onSave={handleBookmark}
        busy={busy}
      />
    </div>
  );
}

export default function DentalWorkspacePage() {
  return (
    <Suspense fallback={null}>
      <DentalWorkspacePageContent />
    </Suspense>
  );
}
