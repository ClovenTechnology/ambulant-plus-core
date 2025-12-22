'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { TextBlock } from '@/components/shared/TextBlock';
import { Card, Tabs, Icon } from '@/components/ui';

let toast: ((msg: string, kind?: 'success' | 'error' | 'info') => void) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  toast = require('@/components/ToastMount').toast as typeof toast;
} catch {}

type XRayTab = 'viewer' | 'report' | 'markers' | 'studies';

type Study = {
  id: string;
  title: string;
  createdAt: string;
  images: XRayImage[];
  report: {
    clinicalInfo: string;
    technique: string;
    findings: string;
    impression: string;
    recommendations: string;
  };
};

type XRayImage = {
  id: string; // local id
  name: string;
  url: string; // objectURL for viewer
  addedAt: string;

  // Server-truth hooks
  evidenceId?: string | null;
  evidenceUrl?: string | null; // stored url in /api/evidence (dataURL)
  contentType?: string | null;

  markers: Marker[];
};

type Marker = {
  id: string;
  xPct: number; // 0..100
  yPct: number; // 0..100
  label: string;
  createdAt: string;
};

function uid(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

async function readAsDataURL(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Failed to read file'));
    r.onload = () => resolve(String(r.result ?? ''));
    r.readAsDataURL(file);
  });
}

async function postJSON<T = any>(url: string, body: any): Promise<T> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok || !data?.ok) {
    const msg = data?.message || `Request failed (${r.status})`;
    throw new Error(msg);
  }
  return data as T;
}

async function patchJSON<T = any>(url: string, body: any): Promise<T> {
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok || !data?.ok) {
    const msg = data?.message || `Request failed (${r.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export default function XRayWorkspacePage() {
  const sp = useSearchParams();
  const patientId = sp.get('patientId') || 'patient-demo-001';
  const encounterId = sp.get('encounterId') || 'enc-demo-001';
  const roomId = sp.get('roomId') || sp.get('room') || undefined;

  const createdBy = sp.get('clinicianId') || 'clin_demo_001';

  const STORAGE_KEY = useMemo(
    () => `ambulant-xray-ws-v2::${patientId}::${encounterId}`,
    [patientId, encounterId]
  );

  const [tab, setTab] = useState<XRayTab>('viewer');

  // Viewer controls
  const [zoom, setZoom] = useState(1);
  const [rotate, setRotate] = useState(0); // degrees
  const [brightness, setBrightness] = useState(1);
  const [contrast, setContrast] = useState(1);
  const [invert, setInvert] = useState(false);

  // Studies
  const [studies, setStudies] = useState<Study[]>(() => []);
  const [activeStudyId, setActiveStudyId] = useState<string>('');
  const [activeImageId, setActiveImageId] = useState<string>('');

  const activeStudy = useMemo(
    () => studies.find((s) => s.id === activeStudyId) || null,
    [studies, activeStudyId]
  );

  const activeImage = useMemo(() => {
    if (!activeStudy) return null;
    return activeStudy.images.find((im) => im.id === activeImageId) || null;
  }, [activeStudy, activeImageId]);

  // Pan (drag to scroll)
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ down: boolean; x: number; y: number; sx: number; sy: number }>({
    down: false,
    x: 0,
    y: 0,
    sx: 0,
    sy: 0,
  });

  // Load persisted state
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.studies)) setStudies(parsed.studies);

      if (typeof parsed?.activeStudyId === 'string') setActiveStudyId(parsed.activeStudyId);
      if (typeof parsed?.activeImageId === 'string') setActiveImageId(parsed.activeImageId);

      if (typeof parsed?.viewer?.zoom === 'number') setZoom(parsed.viewer.zoom);
      if (typeof parsed?.viewer?.rotate === 'number') setRotate(parsed.viewer.rotate);
      if (typeof parsed?.viewer?.brightness === 'number') setBrightness(parsed.viewer.brightness);
      if (typeof parsed?.viewer?.contrast === 'number') setContrast(parsed.viewer.contrast);
      if (typeof parsed?.viewer?.invert === 'boolean') setInvert(parsed.viewer.invert);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [STORAGE_KEY]);

  // Persist (best-effort)
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          studies,
          activeStudyId,
          activeImageId,
          viewer: { zoom, rotate, brightness, contrast, invert },
        })
      );
    } catch {}
  }, [STORAGE_KEY, studies, activeStudyId, activeImageId, zoom, rotate, brightness, contrast, invert]);

  // Ensure at least one default study exists
  useEffect(() => {
    if (studies.length > 0) return;

    const s: Study = {
      id: uid('study'),
      title: 'General X-Ray Study',
      createdAt: new Date().toISOString(),
      images: [],
      report: {
        clinicalInfo: '',
        technique: '',
        findings: '',
        impression: '',
        recommendations: '',
      },
    };
    setStudies([s]);
    setActiveStudyId(s.id);
    setActiveImageId('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep activeStudyId valid
  useEffect(() => {
    if (!studies.length) return;
    if (activeStudyId && studies.some((s) => s.id === activeStudyId)) return;
    setActiveStudyId(studies[0]?.id || '');
  }, [studies, activeStudyId]);

  // Keep activeImageId valid
  useEffect(() => {
    if (!activeStudy) return;
    if (activeImageId && activeStudy.images.some((im) => im.id === activeImageId)) return;
    setActiveImageId(activeStudy.images[0]?.id || '');
  }, [activeStudy, activeImageId]);

  const resetViewer = () => {
    setZoom(1);
    setRotate(0);
    setBrightness(1);
    setContrast(1);
    setInvert(false);
  };

  const addStudy = () => {
    const title = (prompt('New study name?', 'CXR – Chest X-Ray') || '').trim();
    if (!title) return;

    const s: Study = {
      id: uid('study'),
      title,
      createdAt: new Date().toISOString(),
      images: [],
      report: {
        clinicalInfo: '',
        technique: '',
        findings: '',
        impression: '',
        recommendations: '',
      },
    };
    setStudies((prev) => [s, ...prev]);
    setActiveStudyId(s.id);
    setActiveImageId('');
    setTab('viewer');
  };

  const deleteStudy = (studyId: string) => {
    const ok = confirm('Delete this study? This cannot be undone.');
    if (!ok) return;

    setStudies((prev) => prev.filter((s) => s.id !== studyId));
    if (activeStudyId === studyId) {
      const remaining = studies.filter((s) => s.id !== studyId);
      setActiveStudyId(remaining[0]?.id || '');
      setActiveImageId(remaining[0]?.images?.[0]?.id || '');
    }
  };

  async function createRevision(note: string, evidenceIds: string[], annotationCount: number, meta?: any) {
    await postJSON('/api/revisions', {
      patientId,
      encounterId,
      specialty: 'xray',
      note,
      evidenceIds,
      annotationCount,
      createdBy,
      meta: meta ?? {},
    });
  }

  const onUploadImages = async (files: FileList | null) => {
    if (!files || !files.length) return;
    if (!activeStudy) return;

    const picked = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!picked.length) return;

    // 1) Create local items immediately (fast UI)
    const staged: XRayImage[] = picked.map((f) => {
      const localId = uid('img');
      return {
        id: localId,
        name: f.name,
        url: URL.createObjectURL(f),
        addedAt: new Date().toISOString(),
        markers: [],
        evidenceId: null,
        evidenceUrl: null,
        contentType: f.type || null,
      };
    });

    setStudies((prev) =>
      prev.map((s) => (s.id === activeStudy.id ? { ...s, images: [...staged, ...s.images] } : s))
    );
    setActiveImageId(staged[0].id);
    setTab('viewer');

    // 2) Push to /api/evidence (server-truth) and stamp evidenceId back onto the image
    const createdEvidenceIds: string[] = [];

    try {
      for (let i = 0; i < picked.length; i++) {
        const f = picked[i];
        const localImageId = staged[i]?.id;

        // For demo reliability: store as dataURL so the evidence record is self-contained
        const dataUrl = await readAsDataURL(f);

        const location = {
          kind: 'imaging',
          modality: 'xray',
          studyId: activeStudy.id,
          imageId: localImageId,
        };

        const res = await postJSON<{ ok: true; item: any }>('/api/evidence', {
          patientId,
          encounterId,
          specialty: 'xray',
          kind: 'image',
          device: 'upload',
          status: 'ready',
          url: dataUrl,
          thumbnailUrl: dataUrl,
          contentType: f.type || 'image/*',
          capturedAt: new Date().toISOString(),
          location,
          meta: {
            source: 'upload',
            roomId: roomId ?? null,
            studyTitle: activeStudy.title,
            originalName: f.name,
            size: f.size,
            lastModified: f.lastModified,
          },
        });

        const evId = res.item?.id as string;
        if (evId) createdEvidenceIds.push(evId);

        // stamp evidenceId into the right image
        setStudies((prev) =>
          prev.map((s) => {
            if (s.id !== activeStudy.id) return s;
            return {
              ...s,
              images: s.images.map((im) =>
                im.id === localImageId
                  ? { ...im, evidenceId: evId ?? im.evidenceId, evidenceUrl: dataUrl, contentType: f.type || im.contentType }
                  : im
              ),
            };
          })
        );
      }

      await createRevision(
        `Uploaded ${picked.length} X-Ray image(s) to evidence`,
        createdEvidenceIds,
        0,
        { studyId: activeStudy.id, studyTitle: activeStudy.title }
      );

      toast?.(`Uploaded ${picked.length} image(s) → evidence`, 'success');
    } catch (e: any) {
      toast?.(String(e?.message || 'Upload failed'), 'error');
    }
  };

  const deleteImage = async (imageId: string) => {
    if (!activeStudy) return;
    const ok = confirm('Remove this image from the study?');
    if (!ok) return;

    const img = activeStudy.images.find((x) => x.id === imageId);

    // Best-effort: mark evidence as archived (since we don’t have DELETE)
    if (img?.evidenceId) {
      try {
        await patchJSON('/api/evidence', {
          id: img.evidenceId,
          status: 'failed',
          meta: { ...(img as any)?.meta, archived: true, archivedAt: new Date().toISOString() },
        });
        await createRevision(`Archived evidence for removed image`, [img.evidenceId], img.markers.length, {
          studyId: activeStudy.id,
          imageId,
        });
      } catch {}
    }

    if (img?.url?.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(img.url);
      } catch {}
    }

    setStudies((prev) =>
      prev.map((s) => {
        if (s.id !== activeStudy.id) return s;
        const images = s.images.filter((x) => x.id !== imageId);
        return { ...s, images };
      })
    );

    if (activeImageId === imageId) {
      const remaining = activeStudy.images.filter((x) => x.id !== imageId);
      setActiveImageId(remaining[0]?.id || '');
    }
  };

  const setReportField = (key: keyof Study['report'], value: string) => {
    if (!activeStudy) return;
    setStudies((prev) =>
      prev.map((s) =>
        s.id === activeStudy.id
          ? {
              ...s,
              report: {
                ...s.report,
                [key]: value,
              },
            }
          : s
      )
    );
  };

  const addMarkerAt = useCallback(
    async (evt: React.MouseEvent<HTMLDivElement>) => {
      if (!activeStudy || !activeImage) return;

      const rect = evt.currentTarget.getBoundingClientRect();
      const x = ((evt.clientX - rect.left) / rect.width) * 100;
      const y = ((evt.clientY - rect.top) / rect.height) * 100;

      const label = (prompt('Marker label?', 'Finding') || '').trim();
      if (!label) return;

      const m: Marker = {
        id: uid('mk'),
        xPct: clamp(x, 0, 100),
        yPct: clamp(y, 0, 100),
        label,
        createdAt: new Date().toISOString(),
      };

      // Update local UI immediately
      setStudies((prev) =>
        prev.map((s) => {
          if (s.id !== activeStudy.id) return s;
          return {
            ...s,
            images: s.images.map((im) => (im.id === activeImage.id ? { ...im, markers: [...im.markers, m] } : im)),
          };
        })
      );
      setTab('viewer');

      // Push marker to annotations if we have evidenceId
      if (activeImage.evidenceId) {
        try {
          await postJSON('/api/annotations', {
            patientId,
            encounterId,
            specialty: 'xray',
            evidenceId: activeImage.evidenceId,
            type: 'pin',
            payload: {
              label,
              xPct: m.xPct,
              yPct: m.yPct,
              studyId: activeStudy.id,
              imageId: activeImage.id,
              createdAt: m.createdAt,
            },
            createdAt: m.createdAt,
            createdBy,
            location: {
              kind: 'imaging',
              modality: 'xray',
              studyId: activeStudy.id,
              imageId: activeImage.id,
            },
          });

          await createRevision(`Added marker: ${label}`, [activeImage.evidenceId], (activeImage.markers?.length || 0) + 1, {
            studyId: activeStudy.id,
            imageId: activeImage.id,
          });
        } catch (e: any) {
          toast?.(String(e?.message || 'Failed to save marker'), 'error');
        }
      }
    },
    [activeStudy, activeImage, patientId, encounterId, createdBy]
  );

  const deleteMarker = async (markerId: string) => {
    if (!activeStudy || !activeImage) return;

    // (No DELETE route for annotations yet; keep UI delete local-only for now)
    setStudies((prev) =>
      prev.map((s) => {
        if (s.id !== activeStudy.id) return s;
        return {
          ...s,
          images: s.images.map((im) =>
            im.id === activeImage.id ? { ...im, markers: im.markers.filter((m) => m.id !== markerId) } : im
          ),
        };
      })
    );

    if (activeImage.evidenceId) {
      try {
        await createRevision(`Removed marker`, [activeImage.evidenceId], Math.max((activeImage.markers?.length || 1) - 1, 0), {
          studyId: activeStudy.id,
          imageId: activeImage.id,
        });
      } catch {}
    }
  };

  const exportReport = async () => {
    if (!activeStudy) return;

    const lines: string[] = [];
    lines.push(`Ambulant+ X-Ray Report`);
    lines.push(`Patient: ${patientId}`);
    lines.push(`Encounter: ${encounterId}`);
    if (roomId) lines.push(`Room: ${roomId}`);
    lines.push(`Study: ${activeStudy.title}`);
    lines.push(`Created: ${fmtDate(activeStudy.createdAt)}`);
    lines.push('');
    lines.push(`Clinical Info:\n${activeStudy.report.clinicalInfo || '—'}`);
    lines.push('');
    lines.push(`Technique:\n${activeStudy.report.technique || '—'}`);
    lines.push('');
    lines.push(`Findings:\n${activeStudy.report.findings || '—'}`);
    lines.push('');
    lines.push(`Impression:\n${activeStudy.report.impression || '—'}`);
    lines.push('');
    lines.push(`Recommendations:\n${activeStudy.report.recommendations || '—'}`);
    lines.push('');

    if (activeImage?.markers?.length) {
      lines.push(`Markers (${activeImage.name}):`);
      activeImage.markers.forEach((m, i) => {
        lines.push(`  ${i + 1}. ${m.label} @ (${m.xPct.toFixed(1)}%, ${m.yPct.toFixed(1)}%)`);
      });
    }

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast?.('Report copied to clipboard', 'success');
    } catch {
      const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `xray-report-${patientId}-${encounterId}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  };

  // Drag-pan support on viewport
  const onMouseDownViewport = (e: React.MouseEvent) => {
    const el = viewportRef.current;
    if (!el) return;
    dragRef.current = { down: true, x: e.clientX, y: e.clientY, sx: el.scrollLeft, sy: el.scrollTop };
  };
  const onMouseMoveViewport = (e: React.MouseEvent) => {
    const el = viewportRef.current;
    if (!el) return;
    if (!dragRef.current.down) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    el.scrollLeft = dragRef.current.sx - dx;
    el.scrollTop = dragRef.current.sy - dy;
  };
  const onMouseUpViewport = () => {
    dragRef.current.down = false;
  };

  const viewerFilter = `brightness(${brightness}) contrast(${contrast}) ${invert ? 'invert(1)' : ''}`;
  const activeMarkers = activeImage?.markers || [];

  return (
    <div className="min-h-0">
      <Card
        title={
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <div className="text-sm font-semibold text-gray-900">X-Ray Workspace</div>
              <div className="text-xs text-gray-500">
                Patient <span className="font-mono">{patientId}</span> · Encounter{' '}
                <span className="font-mono">{encounterId}</span>
                {roomId ? (
                  <>
                    {' '}
                    · Room <span className="font-mono">{roomId}</span>
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={addStudy}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-xs"
              >
                <Icon name="plus" />
                New Study
              </button>

              <button
                type="button"
                onClick={exportReport}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 hover:bg-blue-100 text-xs"
              >
                <Icon name="download" />
                Export Report
              </button>
            </div>
          </div>
        }
        dense
        gradient
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Tabs<XRayTab>
              active={tab}
              onChange={setTab}
              items={[
                { key: 'viewer', label: 'Viewer' },
                { key: 'report', label: 'Report' },
                { key: 'markers', label: 'Markers' },
                { key: 'studies', label: 'Studies' },
              ]}
            />

            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                <span className="hidden sm:inline">Upload</span>
                <input type="file" accept="image/*" multiple onChange={(e) => onUploadImages(e.target.files)} className="text-xs" />
              </label>

              <button
                type="button"
                onClick={resetViewer}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-xs"
              >
                <Icon name="refresh" />
                Reset
              </button>
            </div>
          </div>

          {/* Study chips */}
          <div className="flex flex-wrap items-center gap-2">
            {studies.map((s) => {
              const active = s.id === activeStudyId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setActiveStudyId(s.id);
                    setActiveImageId(s.images[0]?.id || '');
                    setTab('viewer');
                  }}
                  className={[
                    'px-3 py-1 rounded-full border text-xs inline-flex items-center gap-2',
                    active ? 'border-blue-300 bg-blue-50 text-blue-900' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-800',
                  ].join(' ')}
                  title={fmtDate(s.createdAt)}
                >
                  <span className="max-w-[220px] truncate">{s.title}</span>
                  <span className="text-[10px] text-gray-500">{s.images.length} img</span>
                </button>
              );
            })}
            {activeStudy ? (
              <button
                type="button"
                onClick={() => deleteStudy(activeStudy.id)}
                className="ml-auto px-3 py-1 rounded-full border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs text-rose-800"
              >
                Delete Study
              </button>
            ) : null}
          </div>

          {/* Viewer */}
          {tab === 'viewer' && (
            <div className="grid lg:grid-cols-[1.6fr_1fr] gap-3">
              <div className="rounded-lg border bg-white overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
                  <div className="text-xs text-gray-700">
                    {activeStudy ? (
                      <>
                        <span className="font-medium">{activeStudy.title}</span>
                        {activeImage ? (
                          <>
                            {' '}
                            · <span className="font-mono">{activeImage.name}</span>
                            {activeImage.evidenceId ? (
                              <span className="ml-2 text-[10px] text-gray-500">evidence: {activeImage.evidenceId}</span>
                            ) : (
                              <span className="ml-2 text-[10px] text-amber-700">evidence: pending</span>
                            )}
                          </>
                        ) : (
                          <>
                            {' '}
                            · <span className="italic text-gray-500">No image selected</span>
                          </>
                        )}
                      </>
                    ) : (
                      <span className="italic text-gray-500">No study selected</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50"
                      onClick={() => setRotate((r) => (r + 90) % 360)}
                    >
                      Rotate
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50"
                      onClick={() => setInvert((v) => !v)}
                    >
                      {invert ? 'Normal' : 'Invert'}
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50"
                      onClick={() => setZoom((z) => clamp(Number((z + 0.15).toFixed(2)), 0.5, 5))}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50"
                      onClick={() => setZoom((z) => clamp(Number((z - 0.15).toFixed(2)), 0.5, 5))}
                    >
                      −
                    </button>
                  </div>
                </div>

                <div
                  ref={viewportRef}
                  className="relative h-[360px] md:h-[420px] overflow-auto cursor-grab active:cursor-grabbing"
                  onMouseDown={onMouseDownViewport}
                  onMouseMove={onMouseMoveViewport}
                  onMouseUp={onMouseUpViewport}
                  onMouseLeave={onMouseUpViewport}
                >
                  {!activeImage ? (
                    <div className="h-full grid place-items-center text-sm text-gray-500">Upload an X-Ray image to begin.</div>
                  ) : (
                    <div className="relative inline-block min-w-full min-h-full">
                      <div
                        className="absolute inset-0 z-20"
                        title="Double-click to add a marker"
                        onDoubleClick={(e) => {
                          addMarkerAt(e);
                        }}
                      />

                      <img
                        src={activeImage.url}
                        alt={activeImage.name}
                        className="block select-none pointer-events-none"
                        style={{
                          transform: `scale(${zoom}) rotate(${rotate}deg)`,
                          transformOrigin: 'center center',
                          filter: viewerFilter,
                        }}
                        draggable={false}
                      />

                      <div className="absolute inset-0 z-30 pointer-events-none">
                        {activeMarkers.map((m, idx) => (
                          <div
                            key={m.id}
                            className="absolute"
                            style={{
                              left: `${m.xPct}%`,
                              top: `${m.yPct}%`,
                              transform: 'translate(-50%, -50%)',
                            }}
                          >
                            <div className="h-6 w-6 rounded-full bg-blue-600 text-white text-xs grid place-items-center shadow">
                              {idx + 1}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="absolute bottom-2 left-2 z-40 text-[11px] text-gray-700 bg-white/80 border rounded px-2 py-1">
                        Tip: <b>double-click</b> to add a marker · drag to pan
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-3 py-2 border-t bg-white grid md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <div className="text-[11px] text-gray-500">Zoom</div>
                    <input type="range" min={0.5} max={5} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full" />
                    <div className="text-[11px] text-gray-700 font-mono">{zoom.toFixed(2)}×</div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] text-gray-500">Brightness</div>
                    <input type="range" min={0.5} max={2} step={0.05} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="w-full" />
                    <div className="text-[11px] text-gray-700 font-mono">{brightness.toFixed(2)}</div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] text-gray-500">Contrast</div>
                    <input type="range" min={0.5} max={2.5} step={0.05} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="w-full" />
                    <div className="text-[11px] text-gray-700 font-mono">{contrast.toFixed(2)}</div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] text-gray-500">Rotate</div>
                    <input type="range" min={0} max={270} step={90} value={rotate} onChange={(e) => setRotate(Number(e.target.value))} className="w-full" />
                    <div className="text-[11px] text-gray-700 font-mono">{rotate}°</div>
                  </div>
                </div>
              </div>

              {/* Image list */}
              <div className="rounded-lg border bg-white overflow-hidden">
                <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between">
                  <div className="text-xs font-medium text-gray-800">Images</div>
                  <div className="text-[11px] text-gray-500">{activeStudy?.images.length || 0} total</div>
                </div>

                <div className="p-2 space-y-2 max-h-[520px] overflow-auto">
                  {!activeStudy || activeStudy.images.length === 0 ? (
                    <div className="text-sm text-gray-500 italic p-2">
                      No images yet. Use <b>Upload</b> above.
                    </div>
                  ) : (
                    activeStudy.images.map((im) => {
                      const active = im.id === activeImageId;
                      return (
                        <button
                          key={im.id}
                          type="button"
                          onClick={() => {
                            setActiveImageId(im.id);
                            setTab('viewer');
                          }}
                          className={[
                            'w-full text-left rounded border p-2 hover:bg-gray-50',
                            active ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white',
                          ].join(' ')}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-gray-900 truncate">{im.name}</div>
                              <div className="text-[11px] text-gray-500">
                                {fmtDate(im.addedAt)} · {im.markers.length} markers ·{' '}
                                {im.evidenceId ? <span className="font-mono">{im.evidenceId}</span> : <span className="text-amber-700">pending evidence</span>}
                              </div>
                            </div>
                            <span
                              className="text-[11px] text-rose-700 hover:underline"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                deleteImage(im.id);
                              }}
                            >
                              Remove
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Report */}
          {tab === 'report' && (
            <div className="grid lg:grid-cols-2 gap-3">
              <Card title="Radiology Report" dense gradient>
                <div className="text-[11px] text-gray-500 mb-2">
                  Capture a structured report for the selected study. Use Export to copy/download.
                </div>

                <TextBlock label="Clinical Information" value={activeStudy?.report.clinicalInfo || ''} onChange={(v) => setReportField('clinicalInfo', v)} multiline />
                <TextBlock label="Technique" value={activeStudy?.report.technique || ''} onChange={(v) => setReportField('technique', v)} multiline />
                <TextBlock label="Findings" value={activeStudy?.report.findings || ''} onChange={(v) => setReportField('findings', v)} multiline />
                <TextBlock label="Impression" value={activeStudy?.report.impression || ''} onChange={(v) => setReportField('impression', v)} multiline />
                <TextBlock label="Recommendations" value={activeStudy?.report.recommendations || ''} onChange={(v) => setReportField('recommendations', v)} multiline />
              </Card>

              <Card title="Quick Insert" dense gradient>
                <div className="text-[11px] text-gray-500 mb-2">
                  Speed tools: drop marker list into Findings, or create a clean Impression block.
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50 text-sm"
                    disabled={!activeImage || activeMarkers.length === 0 || !activeStudy}
                    onClick={() => {
                      if (!activeStudy || !activeImage) return;
                      const block =
                        activeMarkers.length === 0
                          ? ''
                          : [
                              `Markers from ${activeImage.name}:`,
                              ...activeMarkers.map((m, i) => `• ${i + 1}. ${m.label}`),
                              '',
                            ].join('\n');
                      setReportField('findings', (activeStudy.report.findings || '').trim() + '\n\n' + block);
                    }}
                  >
                    Append markers → Findings
                  </button>

                  <button
                    type="button"
                    className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50 text-sm"
                    disabled={!activeStudy}
                    onClick={() => {
                      if (!activeStudy) return;
                      const base = [
                        'No acute cardiopulmonary abnormality.',
                        'No focal consolidation.',
                        'No pleural effusion.',
                        'No pneumothorax.',
                      ].join('\n');
                      setReportField('impression', base);
                    }}
                  >
                    Insert normal CXR impression
                  </button>

                  <button
                    type="button"
                    className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50 text-sm"
                    disabled={!activeStudy}
                    onClick={() => {
                      if (!activeStudy) return;
                      setReportField('recommendations', 'Correlate clinically. Consider follow-up imaging if symptoms persist.');
                    }}
                  >
                    Insert generic recommendation
                  </button>

                  <div className="rounded border bg-gray-50 p-2 text-xs text-gray-700">
                    <b>Note:</b> Marker placement uses viewer pixels (not calibrated mm). If you need calibrated measurements, add a DICOM scale later.
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Markers */}
          {tab === 'markers' && (
            <div className="grid lg:grid-cols-[1fr_1fr] gap-3">
              <Card title="Marker List" dense gradient>
                {!activeImage ? (
                  <div className="text-sm text-gray-500 italic">Select an image first.</div>
                ) : activeMarkers.length === 0 ? (
                  <div className="text-sm text-gray-500 italic">
                    No markers yet. Go to Viewer and <b>double-click</b> the image to add markers.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeMarkers.map((m, idx) => (
                      <div key={m.id} className="flex items-start justify-between gap-3 border rounded p-2 bg-white">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900">
                            #{idx + 1} — {m.label}
                          </div>
                          <div className="text-[11px] text-gray-500 font-mono">
                            ({m.xPct.toFixed(1)}%, {m.yPct.toFixed(1)}%) · {fmtDate(m.createdAt)}
                          </div>
                        </div>
                        <button type="button" onClick={() => deleteMarker(m.id)} className="text-xs text-rose-700 hover:underline">
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card title="Workflow Notes" dense gradient>
                <div className="text-sm text-gray-700 space-y-2">
                  <p>
                    <b>Fast flow:</b> Upload → evidence created → double-click to mark findings (annotation) → Report → Export.
                  </p>
                  <p className="text-xs text-gray-500">
                    Evidence + revisions are now server-truth via /api/evidence and /api/revisions. Markers also post as /api/annotations when evidenceId exists.
                  </p>
                </div>
              </Card>
            </div>
          )}

          {/* Studies */}
          {tab === 'studies' && (
            <div className="space-y-2">
              {studies.length === 0 ? (
                <div className="text-sm text-gray-500 italic">No studies.</div>
              ) : (
                studies.map((s) => (
                  <div key={s.id} className="rounded-lg border bg-white p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{s.title}</div>
                      <div className="text-xs text-gray-500">
                        Created {fmtDate(s.createdAt)} · {s.images.length} image(s)
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50 text-xs"
                        onClick={() => {
                          setActiveStudyId(s.id);
                          setActiveImageId(s.images[0]?.id || '');
                          setTab('viewer');
                        }}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs text-rose-800"
                        onClick={() => deleteStudy(s.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
