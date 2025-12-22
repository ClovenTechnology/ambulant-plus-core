/*
File: apps/clinician-app/app/workspaces/endocrinology/page.tsx
Purpose: Endocrinology workspace (wired to POST /findings, /evidence, /annotations)

Notes:
- Not integrated with SFU yet (live_capture fields are placeholders).
- Uses optimistic UI because no GET endpoints exist yet.
- Evidence kinds kept to image + video_clip to match existing workspace evidence types.
*/

'use client';

import React, { useMemo, useState } from 'react';

import {
  TogglePills,
  BookmarkModal,
  EvidenceStrip as WorkspaceEvidenceStrip,
  FindingCard,
} from '@/src/components/workspaces/ui';

import type { Evidence, Finding, Location } from '@/src/lib/workspaces/types';
import { postAnnotation, postEvidence, postFinding } from '@/src/lib/workspaces/api';

type EndoPanel = 'GLUCOSE' | 'THYROID' | 'FOOT' | 'WEIGHT';

const PANELS: { key: EndoPanel; label: string }[] = [
  { key: 'GLUCOSE', label: 'Glucose' },
  { key: 'THYROID', label: 'Thyroid' },
  { key: 'FOOT', label: 'Diabetic Foot' },
  { key: 'WEIGHT', label: 'Weight' },
];

const FINDING_TYPES = [
  { key: 'hyperglycemia', label: 'Hyperglycemia suspected' },
  { key: 'hypoglycemia', label: 'Hypoglycemia suspected' },
  { key: 'poor_control', label: 'Poor glycemic control' },
  { key: 'neuropathy_suspected', label: 'Neuropathy suspected' },
  { key: 'foot_ulcer_suspected', label: 'Foot ulcer suspected' },
  { key: 'goiter_suspected', label: 'Goiter / thyroid enlargement suspected' },
  { key: 'hypothyroid_suspected', label: 'Hypothyroid symptoms suspected' },
  { key: 'hyperthyroid_suspected', label: 'Hyperthyroid symptoms suspected' },
  { key: 'weight_gain_concern', label: 'Weight gain concern' },
  { key: 'weight_loss_concern', label: 'Weight loss concern' },
  { key: 'other', label: 'Other' },
] as const;

type FindingTypeKey = (typeof FINDING_TYPES)[number]['key'];

type EndocrinologyWorkspaceProps = {
  patientId?: string;
  encounterId?: string;
  clinicianId?: string;
};

function nowISO() {
  return new Date().toISOString();
}

function tmpId(prefix: string) {
  return `tmp_${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function errMsg(e: any) {
  return e?.message || e?.details?.message || 'Request failed';
}

function panelHint(panel: EndoPanel) {
  if (panel === 'GLUCOSE') return 'Fingerstick / CGM / HbA1c context';
  if (panel === 'THYROID') return 'Symptoms + exam + labs context';
  if (panel === 'FOOT') return 'Inspection + risk + lesions';
  return 'Trends + goals';
}

export default function EndocrinologyWorkspacePage(props: EndocrinologyWorkspaceProps) {
  const patientId = props.patientId ?? 'pat_demo_001';
  const encounterId = props.encounterId ?? 'enc_demo_001';
  const clinicianId = props.clinicianId ?? 'clin_demo_001';

  const [panel, setPanel] = useState<EndoPanel>('GLUCOSE');

  // Optimistic local state (until GET exists)
  const [findings, setFindings] = useState<Finding[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);

  // UI state
  const [bookmarkOpen, setBookmarkOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ kind: 'info' | 'success' | 'error'; text: string } | null>(null);

  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const selectedEvidence = useMemo(
    () => evidence.find((e) => e.id === selectedEvidenceId) ?? null,
    [evidence, selectedEvidenceId]
  );

  // Local exam fields (MVP-lite)
  const [glucose, setGlucose] = useState({
    rbg: '',
    fbg: '',
    hba1c: '',
    onInsulin: false,
    medsNote: '',
  });

  const [thyroid, setThyroid] = useState({
    tsh: '',
    ft4: '',
    symptoms: {
      fatigue: false,
      heatIntolerance: false,
      coldIntolerance: false,
      palpitations: false,
      tremor: false,
      weightChange: false,
    },
    note: '',
  });

  const [foot, setFoot] = useState({
    ulcer: false,
    redness: false,
    swelling: false,
    numbness: false,
    woundNote: '',
  });

  const [weight, setWeight] = useState({
    kg: '',
    heightCm: '',
    waistCm: '',
    goalKg: '',
  });

  const countsByPanel = useMemo(() => {
    const c = { GLUCOSE: 0, THYROID: 0, FOOT: 0, WEIGHT: 0 } as Record<EndoPanel, number>;
    for (const f of findings) {
      if ((f.location as any)?.kind !== 'endocrine_panel') continue;
      const p = (f.location as any)?.panel as EndoPanel | undefined;
      if (p && p in c) c[p] += 1;
    }
    return c;
  }, [findings]);

  const locationForPanel = (p: EndoPanel): Location => ({ kind: 'endocrine_panel', panel: p } as any);

  const findingsForPanel = useMemo(() => {
    return findings
      .filter((f) => (f.location as any)?.kind === 'endocrine_panel')
      .filter((f) => (f.location as any)?.panel === panel)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [findings, panel]);

  const evidenceForPanel = useMemo(() => {
    return evidence
      .filter((ev) => (ev.location as any)?.kind === 'endocrine_panel')
      .filter((ev) => (ev.location as any)?.panel === panel)
      .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
  }, [evidence, panel]);

  const evidenceCountForFinding = (findingId: string) => evidence.filter((e) => e.findingId === findingId).length;

  const createManualFinding = async (type: FindingTypeKey, severity?: Finding['severity'], note?: string) => {
    const title = FINDING_TYPES.find((x) => x.key === type)?.label ?? 'Finding';
    const location = locationForPanel(panel);

    // attach current panel context into meta (local-only until structured endpoints exist)
    const meta =
      panel === 'GLUCOSE'
        ? { panel, glucose }
        : panel === 'THYROID'
        ? { panel, thyroid }
        : panel === 'FOOT'
        ? { panel, foot }
        : { panel, weight };

    // optimistic finding
    const optimisticId = tmpId('fd');
    const optimistic: Finding = {
      id: optimisticId,
      patientId,
      encounterId,
      specialty: 'endocrinology',
      status: 'draft',
      title,
      note: note?.trim() ? note.trim() : undefined,
      severity,
      tags: ['endocrinology', `panel:${panel.toLowerCase()}`],
      location,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      createdBy: clinicianId,
      meta,
    };

    setBanner(null);
    setFindings((prev) => [optimistic, ...prev]);

    try {
      const created = await postFinding({
        patientId,
        encounterId,
        specialty: 'endocrinology',
        title,
        status: 'draft',
        severity,
        note: note?.trim() ? note.trim() : undefined,
        tags: ['endocrinology', `panel:${panel.toLowerCase()}`],
        location,
        createdBy: clinicianId,
        meta,
      });

      setFindings((prev) => prev.map((f) => (f.id === optimisticId ? created : f)));
      setBanner({ kind: 'success', text: 'Finding saved.' });
    } catch (e) {
      setFindings((prev) => prev.filter((f) => f.id !== optimisticId));
      setBanner({ kind: 'error', text: `Failed to save finding: ${errMsg(e)}` });
      throw e;
    }
  };

  const handleBookmark = async (payload: { findingTypeKey: string; severity?: Finding['severity']; note?: string }) => {
    const type = payload.findingTypeKey as FindingTypeKey;
    const title = FINDING_TYPES.find((x) => x.key === type)?.label ?? 'Finding';
    const location = locationForPanel(panel);

    const meta =
      panel === 'GLUCOSE'
        ? { panel, glucose }
        : panel === 'THYROID'
        ? { panel, thyroid }
        : panel === 'FOOT'
        ? { panel, foot }
        : { panel, weight };

    setBanner(null);
    setBusy(true);

    try {
      // 1) Create finding
      const createdFinding = await postFinding({
        patientId,
        encounterId,
        specialty: 'endocrinology',
        title,
        status: 'draft',
        severity: payload.severity,
        note: payload.note,
        tags: ['endocrinology', 'bookmark', `panel:${panel.toLowerCase()}`],
        location,
        createdBy: clinicianId,
        meta,
      });
      setFindings((prev) => [createdFinding, ...prev]);

      // 2) Snapshot evidence (ready)
      const snapshotLabel = `Endocrine Snapshot (${panel})`;

      const snapshot = await postEvidence({
        patientId,
        encounterId,
        specialty: 'endocrinology',
        findingId: createdFinding.id,
        location,
        source: {
          type: 'live_capture',
          device: panel === 'FOOT' ? 'camera' : panel === 'GLUCOSE' ? 'glucometer' : 'other',
          // SFU fields later
          roomId: undefined,
          trackId: undefined,
        },
        media: {
          kind: 'image',
          url: `https://placehold.co/1200x800?text=${encodeURIComponent(snapshotLabel)}`,
          thumbnailUrl: `https://placehold.co/320x200?text=${encodeURIComponent(snapshotLabel)}`,
          contentType: 'image/jpeg',
        },
        status: 'ready',
      });

      // 3) Clip evidence (processing)
      const t = Date.now();
      const clipLabel = `Endocrine Clip (${panel})`;

      const clip = await postEvidence({
        patientId,
        encounterId,
        specialty: 'endocrinology',
        findingId: createdFinding.id,
        location,
        source: {
          type: 'live_capture',
          device: panel === 'FOOT' ? 'camera' : panel === 'GLUCOSE' ? 'cgm' : 'other',
          roomId: undefined,
          trackId: undefined,
          startTs: t - 3000,
          endTs: t + 9000,
        },
        media: {
          kind: 'video_clip',
          url: 'https://example.invalid/endocrinology-clip.mp4',
          thumbnailUrl: `https://placehold.co/320x200?text=${encodeURIComponent(clipLabel)}`,
          contentType: 'video/mp4',
          startTs: t - 3000,
          endTs: t + 9000,
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
        specialty: 'endocrinology',
        evidenceId: selectedEvidence.id,
        findingId: selectedEvidence.findingId ?? null,
        location: selectedEvidence.location,
        type: 'pin',
        payload: {
          x: 0.55,
          y: 0.42,
          label: panel === 'FOOT' ? 'Lesion / ulcer focus' : panel === 'THYROID' ? 'Neck area' : 'Trend point',
        },
        createdBy: clinicianId,
      });

      setBanner({ kind: 'success', text: 'Annotation created (demo pin).' });
    } catch (e) {
      setBanner({ kind: 'error', text: `Failed to create annotation: ${errMsg(e)}` });
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
            <h1 className="text-lg font-semibold">Endocrinology Workspace</h1>
          </div>
          <div className="text-xs text-gray-600">
            Patient: <span className="font-mono">{patientId}</span> · Encounter:{' '}
            <span className="font-mono">{encounterId}</span>
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
              <div className="text-sm font-semibold">Panels</div>
              <div className="text-xs text-gray-500">Pick an endocrine focus and review findings</div>
            </div>

            <div className="p-4 space-y-4">
              <TogglePills<EndoPanel>
                value={panel}
                onChange={setPanel}
                items={PANELS}
                counts={countsByPanel as any}
              />

              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700">Selected</div>
                <div className="mt-1 text-sm text-gray-800">
                  Panel: <span className="font-mono font-semibold">{panel}</span>
                </div>
                <div className="mt-1 text-xs text-gray-500">{panelHint(panel)}</div>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-700">Panel Findings</div>
                <div className="mt-2">
                  {findingsForPanel.length === 0 ? (
                    <div className="text-sm text-gray-600 italic">No findings for this panel yet.</div>
                  ) : (
                    <ul className="space-y-2">
                      {findingsForPanel.map((f) => (
                        <li key={f.id}>
                          <FindingCard finding={f} evidenceCount={evidenceCountForFinding(f.id)} onToggleFinal={undefined} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-3 text-[11px] text-gray-500">
                  Note: draft/final toggle will be wired when we add PATCH/PUT.
                </div>
              </div>
            </div>
          </section>

          {/* CENTER */}
          <section className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">
                  {panel === 'FOOT' ? 'Foot Camera / Inspection' : panel === 'GLUCOSE' ? 'Glucose (device)' : 'Endocrine Media'}
                </div>
                <div className="text-xs text-gray-500">Live capture + bookmark (SFU later)</div>
              </div>

              <button
                className="rounded-full border bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-800 disabled:opacity-50"
                onClick={() => setBookmarkOpen(true)}
                disabled={busy}
              >
                Bookmark
              </button>
            </div>

            <div className="p-4">
              <div className="rounded-lg border bg-gray-100 h-64 overflow-hidden">
                {selectedEvidence ? (
                  selectedEvidence.kind === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedEvidence.url} alt="Selected evidence" className="h-full w-full object-contain" />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-gray-700">
                      <div className="text-center">
                        <div className="text-sm font-medium">Clip selected</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Status: {selectedEvidence.status}
                          {selectedEvidence.jobId ? ` · job: ${selectedEvidence.jobId}` : ''}
                        </div>
                        <div className="mt-2 text-xs text-gray-500">(Playback wired when real clip URLs are returned.)</div>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="h-full grid place-items-center text-gray-600">
                    <div className="text-center">
                      <div className="text-sm font-medium">Live View (placeholder)</div>
                      <div className="text-xs text-gray-500 mt-1">Select evidence below to preview</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs font-semibold text-gray-700">
                  Evidence for <span className="font-mono">{panel}</span>
                </div>
                <button
                  className="text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
                  onClick={addDemoPinAnnotation}
                  disabled={busy}
                  title="Creates a demo pin annotation for the selected evidence"
                >
                  + Add demo pin
                </button>
              </div>

              <WorkspaceEvidenceStrip evidence={evidenceForPanel} onSelect={(ev) => setSelectedEvidenceId(ev.id)} />

              <div className="mt-4 rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700">Compare (MVP-2)</div>
                <div className="mt-1 text-sm text-gray-700">Later: compare panel evidence over time (trend).</div>
                <button
                  className="mt-2 text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
                  onClick={() => alert('Stub: open compare view')}
                >
                  Open compare
                </button>
              </div>
            </div>
          </section>

          {/* RIGHT */}
          <section className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-4 py-3">
              <div className="text-sm font-semibold">Assessment & Plan</div>
              <div className="text-xs text-gray-500">Panel templates + quick finding</div>
            </div>

            <div className="p-4 space-y-4">
              {panel === 'GLUCOSE' ? (
                <GlucosePanel glucose={glucose} setGlucose={setGlucose} disabled={busy} />
              ) : panel === 'THYROID' ? (
                <ThyroidPanel thyroid={thyroid} setThyroid={setThyroid} disabled={busy} />
              ) : panel === 'FOOT' ? (
                <FootPanel foot={foot} setFoot={setFoot} disabled={busy} />
              ) : (
                <WeightPanel weight={weight} setWeight={setWeight} disabled={busy} />
              )}

              <QuickFindingComposer onCreate={createManualFinding} disabled={busy} />

              <div className="rounded-lg border p-3 bg-gray-50">
                <div className="text-xs font-semibold text-gray-700">Plan (stub)</div>
                <div className="mt-1 text-sm text-gray-700">
                  Coming next: meds/labs/referrals + follow-up tasks linked to findings & panels.
                </div>
                <button
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
        title={`Bookmark (${panel})`}
        description="Creates a finding + captures snapshot + clip as evidence"
        findingTypes={FINDING_TYPES.map((x) => ({ key: x.key, label: x.label }))}
        defaultTypeKey={panel === 'THYROID' ? 'goiter_suspected' : panel === 'FOOT' ? 'foot_ulcer_suspected' : 'poor_control'}
        onSave={handleBookmark}
      />
    </div>
  );
}

/* -------------------- right panels -------------------- */

function GlucosePanel(props: {
  glucose: { rbg: string; fbg: string; hba1c: string; onInsulin: boolean; medsNote: string };
  setGlucose: (v: { rbg: string; fbg: string; hba1c: string; onInsulin: boolean; medsNote: string }) => void;
  disabled?: boolean;
}) {
  const { glucose, setGlucose, disabled } = props;
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-semibold text-gray-700">Glucose Template (MVP-lite)</div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-600">
          RBG (mg/dL)
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={glucose.rbg}
            onChange={(e) => setGlucose({ ...glucose, rbg: e.target.value })}
            placeholder="e.g., 180"
            disabled={disabled}
          />
        </label>
        <label className="text-xs text-gray-600">
          FBG (mg/dL)
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={glucose.fbg}
            onChange={(e) => setGlucose({ ...glucose, fbg: e.target.value })}
            placeholder="e.g., 110"
            disabled={disabled}
          />
        </label>

        <label className="text-xs text-gray-600 col-span-2">
          HbA1c (%)
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={glucose.hba1c}
            onChange={(e) => setGlucose({ ...glucose, hba1c: e.target.value })}
            placeholder="e.g., 7.8"
            disabled={disabled}
          />
        </label>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={glucose.onInsulin}
          onChange={() => setGlucose({ ...glucose, onInsulin: !glucose.onInsulin })}
          disabled={disabled}
        />
        On insulin
      </label>

      <label className="mt-3 block text-xs text-gray-600">
        Meds / notes
        <textarea
          className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          rows={2}
          value={glucose.medsNote}
          onChange={(e) => setGlucose({ ...glucose, medsNote: e.target.value })}
          placeholder="Optional medication context…"
          disabled={disabled}
        />
      </label>

      <div className="mt-2 text-[11px] text-gray-500">Later: persist as structured labs/observations.</div>
    </div>
  );
}

function ThyroidPanel(props: {
  thyroid: {
    tsh: string;
    ft4: string;
    symptoms: {
      fatigue: boolean;
      heatIntolerance: boolean;
      coldIntolerance: boolean;
      palpitations: boolean;
      tremor: boolean;
      weightChange: boolean;
    };
    note: string;
  };
  setThyroid: (v: any) => void;
  disabled?: boolean;
}) {
  const { thyroid, setThyroid, disabled } = props;

  const toggle = (k: keyof typeof thyroid.symptoms) =>
    setThyroid({ ...thyroid, symptoms: { ...thyroid.symptoms, [k]: !thyroid.symptoms[k] } });

  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-semibold text-gray-700">Thyroid Template (MVP-lite)</div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-600">
          TSH
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={thyroid.tsh}
            onChange={(e) => setThyroid({ ...thyroid, tsh: e.target.value })}
            placeholder="e.g., 0.2"
            disabled={disabled}
          />
        </label>
        <label className="text-xs text-gray-600">
          FT4
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={thyroid.ft4}
            onChange={(e) => setThyroid({ ...thyroid, ft4: e.target.value })}
            placeholder="e.g., 18"
            disabled={disabled}
          />
        </label>
      </div>

      <div className="mt-3">
        <div className="text-xs font-medium text-gray-700">Symptoms</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(
            [
              ['fatigue', 'Fatigue'],
              ['heatIntolerance', 'Heat intolerance'],
              ['coldIntolerance', 'Cold intolerance'],
              ['palpitations', 'Palpitations'],
              ['tremor', 'Tremor'],
              ['weightChange', 'Weight change'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={thyroid.symptoms[k]} onChange={() => toggle(k)} disabled={disabled} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <label className="mt-3 block text-xs text-gray-600">
        Notes
        <textarea
          className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          rows={2}
          value={thyroid.note}
          onChange={(e) => setThyroid({ ...thyroid, note: e.target.value })}
          placeholder="Optional thyroid details…"
          disabled={disabled}
        />
      </label>

      <div className="mt-2 text-[11px] text-gray-500">Later: persist symptoms & labs into structured fields.</div>
    </div>
  );
}

function FootPanel(props: {
  foot: { ulcer: boolean; redness: boolean; swelling: boolean; numbness: boolean; woundNote: string };
  setFoot: (v: any) => void;
  disabled?: boolean;
}) {
  const { foot, setFoot, disabled } = props;

  const toggle = (k: keyof Omit<typeof foot, 'woundNote'>) => setFoot({ ...foot, [k]: !foot[k] });

  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-semibold text-gray-700">Diabetic Foot Template (MVP-lite)</div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        {(
          [
            ['ulcer', 'Ulcer / open wound'],
            ['redness', 'Redness'],
            ['swelling', 'Swelling'],
            ['numbness', 'Numbness'],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={(foot as any)[k]} onChange={() => toggle(k as any)} disabled={disabled} />
            {label}
          </label>
        ))}
      </div>

      <label className="mt-3 block text-xs text-gray-600">
        Wound / inspection notes
        <textarea
          className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          rows={2}
          value={foot.woundNote}
          onChange={(e) => setFoot({ ...foot, woundNote: e.target.value })}
          placeholder="Optional lesion location, size, discharge…"
          disabled={disabled}
        />
      </label>

      <div className="mt-2 text-[11px] text-gray-500">Later: attach photos + measure wound dimensions.</div>
    </div>
  );
}

function WeightPanel(props: {
  weight: { kg: string; heightCm: string; waistCm: string; goalKg: string };
  setWeight: (v: any) => void;
  disabled?: boolean;
}) {
  const { weight, setWeight, disabled } = props;

  const bmi = useMemo(() => {
    const kg = Number(weight.kg);
    const cm = Number(weight.heightCm);
    if (!Number.isFinite(kg) || !Number.isFinite(cm) || kg <= 0 || cm <= 0) return null;
    const m = cm / 100;
    const v = kg / (m * m);
    if (!Number.isFinite(v)) return null;
    return Math.round(v * 10) / 10;
  }, [weight.kg, weight.heightCm]);

  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-semibold text-gray-700">Weight & Metabolic Template (MVP-lite)</div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-600">
          Weight (kg)
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={weight.kg}
            onChange={(e) => setWeight({ ...weight, kg: e.target.value })}
            placeholder="e.g., 84"
            disabled={disabled}
          />
        </label>
        <label className="text-xs text-gray-600">
          Height (cm)
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={weight.heightCm}
            onChange={(e) => setWeight({ ...weight, heightCm: e.target.value })}
            placeholder="e.g., 172"
            disabled={disabled}
          />
        </label>

        <label className="text-xs text-gray-600">
          Waist (cm)
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={weight.waistCm}
            onChange={(e) => setWeight({ ...weight, waistCm: e.target.value })}
            placeholder="e.g., 98"
            disabled={disabled}
          />
        </label>

        <label className="text-xs text-gray-600">
          Goal (kg)
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={weight.goalKg}
            onChange={(e) => setWeight({ ...weight, goalKg: e.target.value })}
            placeholder="e.g., 75"
            disabled={disabled}
          />
        </label>
      </div>

      <div className="mt-3 rounded-lg border bg-gray-50 p-3 text-sm text-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700">BMI (auto)</span>
          <span className="font-mono font-semibold">{bmi ?? '—'}</span>
        </div>
        <div className="mt-1 text-[11px] text-gray-500">Later: show trend charts + goal progress.</div>
      </div>
    </div>
  );
}

/* -------------------- quick composer -------------------- */

function QuickFindingComposer(props: {
  onCreate: (type: FindingTypeKey, severity?: 'mild' | 'moderate' | 'severe', note?: string) => Promise<void>;
  disabled?: boolean;
}) {
  const { onCreate, disabled } = props;

  const [type, setType] = useState<FindingTypeKey>('poor_control');
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe' | ''>('moderate');
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
