/*
File: apps/clinician-app/app/workspaces/dermatology/page.tsx
Purpose: Dermatology workspace (wired to POST /findings, /evidence, /annotations)

Notes:
- Not integrated with SFU yet (live_capture fields are placeholders).
- Uses optimistic UI because no GET endpoints exist yet.
- Uses your shared workspace UI: TogglePills, BookmarkModal, EvidenceStrip, FindingCard.
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

type DermView = 'FACE_NECK' | 'TORSO' | 'ARMS' | 'LEGS' | 'GENERAL';

const VIEWS: { key: DermView; label: string }[] = [
  { key: 'FACE_NECK', label: 'Face/Neck' },
  { key: 'TORSO', label: 'Torso' },
  { key: 'ARMS', label: 'Arms' },
  { key: 'LEGS', label: 'Legs' },
  { key: 'GENERAL', label: 'General' },
];

const FINDING_TYPES = [
  { key: 'rash', label: 'Rash' },
  { key: 'urticaria', label: 'Urticaria / hives' },
  { key: 'eczema_suspected', label: 'Eczema suspected' },
  { key: 'psoriasis_suspected', label: 'Psoriasis suspected' },
  { key: 'infection_suspected', label: 'Skin infection suspected' },
  { key: 'fungal_suspected', label: 'Fungal infection suspected' },
  { key: 'acne', label: 'Acne' },
  { key: 'lesion_suspicious', label: 'Suspicious lesion (rule out malignancy)' },
  { key: 'pigment_change', label: 'Pigment change' },
  { key: 'wound_ulcer', label: 'Wound / ulcer' },
  { key: 'other', label: 'Other' },
] as const;

type FindingTypeKey = (typeof FINDING_TYPES)[number]['key'];

type DermatologyWorkspaceProps = {
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

function viewHint(v: DermView) {
  if (v === 'FACE_NECK') return 'Face, scalp, neck lesions (acne/rash/pigment)';
  if (v === 'TORSO') return 'Chest/abdomen/back distribution';
  if (v === 'ARMS') return 'Upper limbs, hands, nails';
  if (v === 'LEGS') return 'Lower limbs, feet, venous stasis/ulcers';
  return 'General skin assessment';
}

export default function DermatologyWorkspacePage(props: DermatologyWorkspaceProps) {
  const patientId = props.patientId ?? 'pat_demo_001';
  const encounterId = props.encounterId ?? 'enc_demo_001';
  const clinicianId = props.clinicianId ?? 'clin_demo_001';

  const [view, setView] = useState<DermView>('GENERAL');

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

  // local exam template (MVP-lite)
  const [template, setTemplate] = useState({
    pruritus: false,
    pain: false,
    fever: false,
    duration: '',
    distribution: '',
    triggers: '',
    treatmentsTried: '',
  });

  const countsByView = useMemo(() => {
    const c = { FACE_NECK: 0, TORSO: 0, ARMS: 0, LEGS: 0, GENERAL: 0 } as Record<DermView, number>;
    for (const f of findings) {
      if ((f.location as any)?.kind !== 'derm_region') continue;
      const v = (f.location as any)?.view as DermView | undefined;
      if (v && v in c) c[v] += 1;
    }
    return c;
  }, [findings]);

  const locationForView = (v: DermView): Location => ({ kind: 'derm_region', view: v } as any);

  const findingsForView = useMemo(() => {
    return findings
      .filter((f) => (f.location as any)?.kind === 'derm_region')
      .filter((f) => (f.location as any)?.view === view)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [findings, view]);

  const evidenceForView = useMemo(() => {
    return evidence
      .filter((ev) => (ev.location as any)?.kind === 'derm_region')
      .filter((ev) => (ev.location as any)?.view === view)
      .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
  }, [evidence, view]);

  const evidenceCountForFinding = (findingId: string) => evidence.filter((e) => e.findingId === findingId).length;

  const createManualFinding = async (type: FindingTypeKey, severity?: Finding['severity'], note?: string) => {
    const title = FINDING_TYPES.find((x) => x.key === type)?.label ?? 'Finding';
    const location = locationForView(view);

    const meta = { view, template };

    const optimisticId = tmpId('fd');
    const optimistic: Finding = {
      id: optimisticId,
      patientId,
      encounterId,
      specialty: 'dermatology',
      status: 'draft',
      title,
      note: note?.trim() ? note.trim() : undefined,
      severity,
      tags: ['dermatology', `view:${view.toLowerCase()}`],
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
        specialty: 'dermatology',
        title,
        status: 'draft',
        severity,
        note: note?.trim() ? note.trim() : undefined,
        tags: ['dermatology', `view:${view.toLowerCase()}`],
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
    const location = locationForView(view);

    const meta = { view, template };

    setBanner(null);
    setBusy(true);

    try {
      // 1) Create finding
      const createdFinding = await postFinding({
        patientId,
        encounterId,
        specialty: 'dermatology',
        title,
        status: 'draft',
        severity: payload.severity,
        note: payload.note,
        tags: ['dermatology', 'bookmark', `view:${view.toLowerCase()}`],
        location,
        createdBy: clinicianId,
        meta,
      });
      setFindings((prev) => [createdFinding, ...prev]);

      // 2) Snapshot evidence (ready)
      const snapshotLabel = `Derm Photo (${view})`;

      const snapshot = await postEvidence({
        patientId,
        encounterId,
        specialty: 'dermatology',
        findingId: createdFinding.id,
        location,
        source: {
          type: 'live_capture',
          device: 'camera',
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
      const clipLabel = `Derm Clip (${view})`;

      const clip = await postEvidence({
        patientId,
        encounterId,
        specialty: 'dermatology',
        findingId: createdFinding.id,
        location,
        source: {
          type: 'live_capture',
          device: 'camera',
          roomId: undefined,
          trackId: undefined,
          startTs: t - 3000,
          endTs: t + 9000,
        },
        media: {
          kind: 'video_clip',
          url: 'https://example.invalid/dermatology-clip.mp4',
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
        specialty: 'dermatology',
        evidenceId: selectedEvidence.id,
        findingId: selectedEvidence.findingId ?? null,
        location: selectedEvidence.location,
        type: 'pin',
        payload: {
          x: 0.58,
          y: 0.44,
          label: 'Lesion focus',
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
            <h1 className="text-lg font-semibold">Dermatology Workspace</h1>
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
              <div className="text-sm font-semibold">Body Regions</div>
              <div className="text-xs text-gray-500">Select a region and review findings</div>
            </div>

            <div className="p-4 space-y-4">
              <TogglePills<DermView> value={view} onChange={setView} items={VIEWS} counts={countsByView as any} />

              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700">Selected</div>
                <div className="mt-1 text-sm text-gray-800">
                  Region: <span className="font-mono font-semibold">{view}</span>
                </div>
                <div className="mt-1 text-xs text-gray-500">{viewHint(view)}</div>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-700">Region Findings</div>
                <div className="mt-2">
                  {findingsForView.length === 0 ? (
                    <div className="text-sm text-gray-600 italic">No findings for this region yet.</div>
                  ) : (
                    <ul className="space-y-2">
                      {findingsForView.map((f) => (
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
                <div className="text-sm font-semibold">Skin Camera</div>
                <div className="text-xs text-gray-500">Live stream + bookmark (SFU later)</div>
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
                      <div className="text-sm font-medium">Live Skin View (placeholder)</div>
                      <div className="text-xs text-gray-500 mt-1">Select evidence below to preview</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs font-semibold text-gray-700">
                  Evidence for <span className="font-mono">{view}</span>
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

              <WorkspaceEvidenceStrip evidence={evidenceForView} onSelect={(ev) => setSelectedEvidenceId(ev.id)} />

              <div className="mt-4 rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700">Compare (MVP-2)</div>
                <div className="mt-1 text-sm text-gray-700">Later: compare lesion photos over time for the same region.</div>
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
              <div className="text-xs text-gray-500">Quick dermatology template + follow-up</div>
            </div>

            <div className="p-4 space-y-4">
              <DermTemplate template={template} setTemplate={setTemplate} disabled={busy} />
              <QuickFindingComposer onCreate={createManualFinding} disabled={busy} />

              <div className="rounded-lg border p-3 bg-gray-50">
                <div className="text-xs font-semibold text-gray-700">Plan (stub)</div>
                <div className="mt-1 text-sm text-gray-700">
                  Coming next: topical/oral meds + referral + follow-up tasks linked to lesions.
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
        title={`Bookmark (${view})`}
        description="Creates a finding + captures snapshot + clip as evidence"
        findingTypes={FINDING_TYPES.map((x) => ({ key: x.key, label: x.label }))}
        defaultTypeKey={view === 'FACE_NECK' ? 'acne' : 'rash'}
        onSave={handleBookmark}
      />
    </div>
  );
}

/* -------------------- right-side components -------------------- */

function DermTemplate(props: {
  template: {
    pruritus: boolean;
    pain: boolean;
    fever: boolean;
    duration: string;
    distribution: string;
    triggers: string;
    treatmentsTried: string;
  };
  setTemplate: (v: any) => void;
  disabled?: boolean;
}) {
  const { template, setTemplate, disabled } = props;

  const toggle = (k: 'pruritus' | 'pain' | 'fever') => setTemplate({ ...template, [k]: !template[k] });

  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-semibold text-gray-700">Derm Template (MVP-lite)</div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={template.pruritus} onChange={() => toggle('pruritus')} disabled={disabled} />
          Pruritus (itch)
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={template.pain} onChange={() => toggle('pain')} disabled={disabled} />
          Pain / tenderness
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 col-span-2">
          <input type="checkbox" checked={template.fever} onChange={() => toggle('fever')} disabled={disabled} />
          Fever / systemic symptoms
        </label>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <label className="text-xs text-gray-600">
          Duration
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={template.duration}
            onChange={(e) => setTemplate({ ...template, duration: e.target.value })}
            placeholder="e.g., 3 days, 2 weeks, chronic"
            disabled={disabled}
          />
        </label>

        <label className="text-xs text-gray-600">
          Distribution
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={template.distribution}
            onChange={(e) => setTemplate({ ...template, distribution: e.target.value })}
            placeholder="e.g., localized, generalized, dermatomal"
            disabled={disabled}
          />
        </label>

        <label className="text-xs text-gray-600">
          Triggers / exposures
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={template.triggers}
            onChange={(e) => setTemplate({ ...template, triggers: e.target.value })}
            placeholder="e.g., new product, travel, contacts"
            disabled={disabled}
          />
        </label>

        <label className="text-xs text-gray-600">
          Treatments tried
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={template.treatmentsTried}
            onChange={(e) => setTemplate({ ...template, treatmentsTried: e.target.value })}
            placeholder="e.g., antihistamine, topical steroid"
            disabled={disabled}
          />
        </label>
      </div>

      <div className="mt-2 text-[11px] text-gray-500">
        Later: convert to structured ROS + exposure checklist, persist on encounter.
      </div>
    </div>
  );
}

function QuickFindingComposer(props: {
  onCreate: (type: FindingTypeKey, severity?: 'mild' | 'moderate' | 'severe', note?: string) => Promise<void>;
  disabled?: boolean;
}) {
  const { onCreate, disabled } = props;

  const [type, setType] = useState<FindingTypeKey>('rash');
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe' | ''>('mild');
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
