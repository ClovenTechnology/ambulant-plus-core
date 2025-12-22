//apps/clinician-app/app/dental-workspace/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';

import type {
  ToothSystem,
  ToothSurface,
  DentalEvidence,
  DentalFinding,
  DentalAnnotation,
  PlanItem,
  LabRevision,
  DentalLocation,
  EvidenceKind,
  FindingTypeKey,
} from './_lib/types';
import { FINDING_TYPES } from './_lib/types';

import { nowISO, errMsg, extFromUrl, guessContentTypeFromExt, readFileAsDataUrl } from './_lib/helpers';
import { toDisplayToothId } from './_lib/toothMap';
import {
  API_BASE,
  getJson,
  postJson,
  postFinding,
  postEvidence,
  postAnnotation,
  postRevision,
  postPlanItem,
  patchPlanItem,
} from './_lib/api';

import ToothChart from './_components/ToothChart';
import Teeth3DScene from './_components/Teeth3DScene';
import EvidencePreview from './_components/EvidencePreview';
import AddMediaPanel from './_components/AddMediaPanel';
import QuickFindingComposer from './_components/QuickFindingComposer';
import TreatmentPlan from './_components/TreatmentPlan';
import DentalBookmarkModal from './_components/DentalBookmarkModal';

export default function DentalWorkspacePage(props: {
  patientId?: string;
  encounterId?: string;
  clinicianId?: string;
}) {
  const patientId = props.patientId ?? 'pat_demo_001';
  const encounterId = props.encounterId ?? 'enc_demo_001';
  const clinicianId = props.clinicianId ?? 'clin_demo_001';

  // DISPLAY ONLY (Option A)
  const [toothSystem, setToothSystem] = useState<ToothSystem>('universal');

  // INTERNAL (always universal)
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
    const sp = new URLSearchParams();
    sp.set('patientId', patientId);
    sp.set('encounterId', encounterId);
    sp.set('specialty', 'dental');
    return sp.toString();
  }, [patientId, encounterId]);

  const refreshAll = async () => {
    const [f, e, a, p, r] = await Promise.all([
      getJson<{ ok: true; items: DentalFinding[] }>(`${API_BASE}/findings?${q}`).then((x: any) => x.items ?? x),
      getJson<{ ok: true; items: DentalEvidence[] }>(`${API_BASE}/evidence?${q}`).then((x: any) => x.items ?? x),
      getJson<{ ok: true; items: DentalAnnotation[] }>(`${API_BASE}/annotations?${q}`).then((x: any) => x.items ?? x),
      getJson<{ ok: true; items: PlanItem[] }>(`${API_BASE}/plan-items?${q}`).then((x: any) => x.items ?? x),
      getJson<{ ok: true; items: LabRevision[] }>(`${API_BASE}/revisions?${q}`).then((x: any) => x.items ?? x),
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

  // Option A: always store as universal in location
  const locationForSelection = (): DentalLocation => ({
    kind: 'dental_tooth',
    toothSystem: 'universal',
    toothId: selectedTooth,
    surface: selectedSurface,
  });

  const findingsForSelection = useMemo(() => {
    return findings
      .filter((f) => f.location.kind === 'dental_tooth' && f.location.toothId === selectedTooth)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [findings, selectedTooth]);

  const evidenceForSelection = useMemo(() => {
    return evidence
      .filter((ev) => ev.location.kind === 'dental_tooth' && ev.location.toothId === selectedTooth)
      .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
  }, [evidence, selectedTooth]);

  const toothCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of findings) {
      const id = f.location?.toothId;
      if (!id) continue;
      map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  }, [findings]);

  const selectedEvidence = useMemo(() => {
    return evidence.find((e) => e.id === selectedEvidenceId) ?? null;
  }, [evidence, selectedEvidenceId]);

  useEffect(() => {
    if (selectedEvidenceId) setPreviewMode('evidence');
  }, [selectedEvidenceId]);

  const evidenceCountForFinding = (findingId: string) => evidence.filter((e) => e.findingId === findingId).length;

  const annotationsForSelectedEvidence = useMemo(() => {
    if (!selectedEvidenceId) return [];
    return annotations.filter((a) => a.evidenceId === selectedEvidenceId);
  }, [annotations, selectedEvidenceId]);

  const createManualFinding = async (type: FindingTypeKey, severity?: DentalFinding['severity'], note?: string) => {
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
          label: `Adjust here (tooth ${selectedEvidence.location.toothId})`,
        },
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
        payload: { kind: 'screen', x: x01, y: y01, label: label || 'Pin' },
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

  const createModelPinOnSelectedEvidence = async (
    payload: { kind: 'model'; meshId: string; p: [number, number, number]; n?: [number, number, number]; label?: string },
    overrideToothId?: string,
  ) => {
    if (!selectedEvidence) return;
    setBusy(true);
    setBanner(null);

    const loc: DentalLocation = overrideToothId
      ? { ...selectedEvidence.location, toothSystem: 'universal', toothId: String(overrideToothId) }
      : { ...selectedEvidence.location, toothSystem: 'universal' };

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

  const handleBookmark = async (payload: {
    toothId: string; // universal
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

    // Option A: always store universal
    const loc: DentalLocation = {
      kind: 'dental_tooth',
      toothSystem: 'universal',
      toothId: payload.toothId,
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
          roomId: null,
          trackId: null,
        },
      });

      await postEvidence({
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
          roomId: null,
          trackId: null,
        },
      });

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
            payload: { kind: 'screen', x: 0.5, y: 0.48, label: 'Mark area' },
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
        text: `Bookmark saved: tooth ${toDisplayToothId(payload.toothId, toothSystem)}${
          payload.surface ? ' · ' + payload.surface : ''
        }. Capture jobs created.`,
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
        toothId, // universal
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
    const toothId = selectedTooth; // universal
    const toothEvidenceIds = evidenceForSelection.map((e) => e.id);
    const selected = selectedEvidenceId ? [selectedEvidenceId] : [];
    const evidenceIds = opts?.includeAllEvidenceForTooth ? toothEvidenceIds : selected;

    const anns = annotations.filter((a) => evidenceIds.includes(a.evidenceId));

    return {
      kind: 'lab_revision_export',
      patientId,
      encounterId,
      specialty: 'dental',
      // Option A: toothSystem is universal for storage/export
      toothSystem: 'universal' as const,
      toothIds: [toothId],
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
      // keep display choice as meta, if you want it downstream
      meta: { displayToothSystem: toothSystem },
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
        toothId: selectedTooth, // universal
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
    const loc = locationForSelection(); // universal
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

  const selectedToothDisplay = toDisplayToothId(selectedTooth, toothSystem);

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
                title="Display-only. Internal storage remains universal."
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
              <ToothChart
                toothSystem={toothSystem}
                selectedUniversal={selectedTooth}
                onSelectUniversal={setSelectedTooth}
                counts={toothCounts}
              />

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
                  Tooth <span className="font-mono font-semibold">{selectedToothDisplay}</span>
                  {selectedSurface ? (
                    <>
                      {' '}
                      · Surface <span className="font-mono font-semibold">{selectedSurface}</span>
                    </>
                  ) : null}
                </div>
                <div className="mt-1 text-[11px] text-gray-500">
                  Internal storage: universal. FDI is display-only.
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
                      selectedToothUniversal={selectedTooth}
                      toothSystem={toothSystem}
                      onSelectToothUniversal={(universalTooth) => {
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
                  <div className="text-xs font-semibold text-gray-700">
                    Evidence for tooth {selectedToothDisplay}
                  </div>
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
                            {ev.kind === 'image' ? 'Image' : ev.kind === 'scan_3d' ? '3D Scan' : 'Clip'}
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

              {/* Revisions */}
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
                          Tooth: {toDisplayToothId(r.toothId ?? '—', toothSystem)} · Evidence: {r.evidenceIds.length} ·
                          Pins/comments: {r.annotationCount}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Annotation list */}
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
                selectedToothUniversal={selectedTooth}
                selectedToothDisplay={selectedToothDisplay}
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
        selectedToothUniversal={selectedTooth}
        selectedToothDisplay={selectedToothDisplay}
        selectedSurface={selectedSurface}
        onSave={handleBookmark}
        busy={busy}
      />
    </div>
  );
}
