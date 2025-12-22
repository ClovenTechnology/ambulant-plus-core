/*
File: apps/clinician-app/app/workspaces/paediatric/page.tsx
Purpose: Paediatric workspace (wired to POST /findings, /evidence, /annotations)

Notes:
- Not integrated with SFU yet (live_capture fields are placeholders).
- Uses optimistic UI because no GET endpoints exist yet.
- Uses shared workspace UI: TogglePills, BookmarkModal, EvidenceStrip, FindingCard.
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

type PedsSection = 'triage' | 'resp' | 'gi' | 'skin' | 'neuro' | 'growth' | 'general';

const SECTIONS: { key: PedsSection; label: string }[] = [
  { key: 'triage', label: 'Triage' },
  { key: 'resp', label: 'Respiratory' },
  { key: 'gi', label: 'GI' },
  { key: 'skin', label: 'Skin' },
  { key: 'neuro', label: 'Neuro' },
  { key: 'growth', label: 'Growth' },
  { key: 'general', label: 'General' },
];

const FINDING_TYPES = [
  { key: 'fever', label: 'Fever' },
  { key: 'cough', label: 'Cough / cold' },
  { key: 'wheeze', label: 'Wheeze / breathing difficulty' },
  { key: 'ear_pain', label: 'Ear pain / otitis suspected' },
  { key: 'sore_throat', label: 'Sore throat' },
  { key: 'vomiting', label: 'Vomiting' },
  { key: 'diarrhea', label: 'Diarrhea' },
  { key: 'dehydration_risk', label: 'Dehydration risk' },
  { key: 'rash', label: 'Rash' },
  { key: 'poor_feeding', label: 'Poor feeding' },
  { key: 'weight_concern', label: 'Weight / growth concern' },
  { key: 'development_concern', label: 'Development concern' },
  { key: 'other', label: 'Other' },
] as const;

type FindingTypeKey = (typeof FINDING_TYPES)[number]['key'];

type PaediatricWorkspaceProps = {
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

function sectionHint(s: PedsSection) {
  switch (s) {
    case 'triage':
      return 'Vitals, red flags, hydration, appearance.';
    case 'resp':
      return 'Breathing, wheeze, cough, work of breathing.';
    case 'gi':
      return 'Vomiting/diarrhea, pain, intake, hydration.';
    case 'skin':
      return 'Rash patterns, itch, infection, allergy.';
    case 'neuro':
      return 'Headache, seizures, behavior, alertness.';
    case 'growth':
      return 'Weight/height concerns, feeding, milestones.';
    default:
      return 'General paediatric complaints and notes.';
  }
}

export default function PaediatricWorkspacePage(props: PaediatricWorkspaceProps) {
  const patientId = props.patientId ?? 'pat_demo_001';
  const encounterId = props.encounterId ?? 'enc_demo_001';
  const clinicianId = props.clinicianId ?? 'clin_demo_001';

  const [section, setSection] = useState<PedsSection>('triage');

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

  // Mini paeds template (MVP-lite) — stored in meta for now
  const [template, setTemplate] = useState({
    ageMonths: '' as string,
    weightKg: '' as string,
    tempC: '' as string,
    rr: '' as string,
    hr: '' as string,
    spo2: '' as string,
    hydration: 'ok' as 'ok' | 'mild' | 'moderate' | 'severe',
    appearance: 'well' as 'well' | 'irritable' | 'lethargic',
    feeding: 'ok' as 'ok' | 'reduced' | 'poor',
    urineOutput: 'ok' as 'ok' | 'reduced' | 'unknown',
    redFlags: {
      breathingDifficulty: false,
      cyanosis: false,
      persistentVomiting: false,
      dehydration: false,
      seizure: false,
      rashNonBlanching: false,
    },
    notes: '',
  });

  const countsBySection = useMemo(() => {
    const c = {
      triage: 0,
      resp: 0,
      gi: 0,
      skin: 0,
      neuro: 0,
      growth: 0,
      general: 0,
    } as Record<PedsSection, number>;

    for (const f of findings) {
      if ((f.location as any)?.kind !== 'peds_section') continue;
      const s = (f.location as any)?.section as PedsSection | undefined;
      if (s && s in c) c[s] += 1;
    }
    return c;
  }, [findings]);

  const locationForSection = (s: PedsSection): Location => ({ kind: 'peds_section', section: s } as any);

  const findingsForSection = useMemo(() => {
    return findings
      .filter((f) => (f.location as any)?.kind === 'peds_section')
      .filter((f) => (f.location as any)?.section === section)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [findings, section]);

  const evidenceForSection = useMemo(() => {
    return evidence
      .filter((ev) => (ev.location as any)?.kind === 'peds_section')
      .filter((ev) => (ev.location as any)?.section === section)
      .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
  }, [evidence, section]);

  const evidenceCountForFinding = (findingId: string) => evidence.filter((e) => e.findingId === findingId).length;

  const createManualFinding = async (type: FindingTypeKey, severity?: Finding['severity'], note?: string) => {
    const title = FINDING_TYPES.find((x) => x.key === type)?.label ?? 'Finding';
    const location = locationForSection(section);

    const meta = { section, template };

    // optimistic finding
    const optimisticId = tmpId('fd');
    const optimistic: Finding = {
      id: optimisticId,
      patientId,
      encounterId,
      specialty: 'paediatric',
      status: 'draft',
      title,
      note: note?.trim() ? note.trim() : undefined,
      severity,
      tags: ['paediatric', `section:${section}`],
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
        specialty: 'paediatric',
        title,
        status: 'draft',
        severity,
        note: note?.trim() ? note.trim() : undefined,
        tags: ['paediatric', `section:${section}`],
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
    const location = locationForSection(section);
    const meta = { section, template };

    setBanner(null);
    setBusy(true);

    try {
      // 1) Create finding
      const createdFinding = await postFinding({
        patientId,
        encounterId,
        specialty: 'paediatric',
        title,
        status: 'draft',
        severity: payload.severity,
        note: payload.note,
        tags: ['paediatric', 'bookmark', `section:${section}`],
        location,
        createdBy: clinicianId,
        meta,
      });
      setFindings((prev) => [createdFinding, ...prev]);

      // 2) Snapshot evidence (ready) — e.g., rash photo, throat image, dehydration signs, etc.
      const snapshotLabel = `Paeds Snapshot (${section})`;
      const snapshot = await postEvidence({
        patientId,
        encounterId,
        specialty: 'paediatric',
        findingId: createdFinding.id,
        location,
        source: {
          type: 'live_capture',
          device: 'camera',
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

      // 3) Clip evidence (processing) — short clip: breathing effort, cough, gait, etc.
      const t = Date.now();
      const clipLabel = `Paeds Clip (${section})`;

      const clip = await postEvidence({
        patientId,
        encounterId,
        specialty: 'paediatric',
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
          url: 'https://example.invalid/paeds-clip.mp4',
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
        specialty: 'paediatric',
        evidenceId: selectedEvidence.id,
        findingId: selectedEvidence.findingId ?? null,
        location: selectedEvidence.location,
        type: 'pin',
        payload: {
          x: 0.52,
          y: 0.4,
          label: 'Area of concern',
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
            <h1 className="text-lg font-semibold">Paediatric Workspace</h1>
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
              <div className="text-sm font-semibold">Sections</div>
              <div className="text-xs text-gray-500">Select a section and review findings</div>
            </div>

            <div className="p-4 space-y-4">
              <TogglePills<PedsSection>
                value={section}
                onChange={setSection}
                items={SECTIONS}
                counts={countsBySection as any}
              />

              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700">Selected</div>
                <div className="mt-1 text-sm text-gray-800">
                  Section: <span className="font-mono font-semibold">{section.toUpperCase()}</span>
                </div>
                <div className="mt-1 text-xs text-gray-500">{sectionHint(section)}</div>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-700">Section Findings</div>
                <div className="mt-2">
                  {findingsForSection.length === 0 ? (
                    <div className="text-sm text-gray-600 italic">No findings for this section yet.</div>
                  ) : (
                    <ul className="space-y-2">
                      {findingsForSection.map((f) => (
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
                <div className="text-sm font-semibold">Media</div>
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
                  Evidence for <span className="font-mono">{section}</span>
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

              <WorkspaceEvidenceStrip evidence={evidenceForSection} onSelect={(ev) => setSelectedEvidenceId(ev.id)} />

              <div className="mt-4 rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700">Compare (MVP-2)</div>
                <div className="mt-1 text-sm text-gray-700">
                  Later: compare rash progression photos, breathing clips, weight tracking snapshots.
                </div>
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
              <div className="text-xs text-gray-500">Quick paeds template + manual finding</div>
            </div>

            <div className="p-4 space-y-4">
              <PaedsTemplate template={template} setTemplate={setTemplate} disabled={busy} />
              <QuickFindingComposer onCreate={createManualFinding} disabled={busy} />

              <div className="rounded-lg border p-3 bg-gray-50">
                <div className="text-xs font-semibold text-gray-700">Plan (stub)</div>
                <div className="mt-1 text-sm text-gray-700">Coming next: meds/advice/safety-net + follow-up tasks.</div>
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
        title={`Bookmark (${section.toUpperCase()})`}
        description="Creates a finding + captures snapshot + clip as evidence"
        findingTypes={FINDING_TYPES.map((x) => ({ key: x.key, label: x.label }))}
        defaultTypeKey={section === 'resp' ? 'wheeze' : section === 'gi' ? 'vomiting' : section === 'skin' ? 'rash' : 'fever'}
        onSave={handleBookmark}
      />
    </div>
  );
}

/* -------------------- right-side components -------------------- */

function PaedsTemplate(props: {
  template: {
    ageMonths: string;
    weightKg: string;
    tempC: string;
    rr: string;
    hr: string;
    spo2: string;
    hydration: 'ok' | 'mild' | 'moderate' | 'severe';
    appearance: 'well' | 'irritable' | 'lethargic';
    feeding: 'ok' | 'reduced' | 'poor';
    urineOutput: 'ok' | 'reduced' | 'unknown';
    redFlags: {
      breathingDifficulty: boolean;
      cyanosis: boolean;
      persistentVomiting: boolean;
      dehydration: boolean;
      seizure: boolean;
      rashNonBlanching: boolean;
    };
    notes: string;
  };
  setTemplate: (v: any) => void;
  disabled?: boolean;
}) {
  const { template, setTemplate, disabled } = props;

  const toggleRF = (k: keyof typeof template['redFlags']) =>
    setTemplate({ ...template, redFlags: { ...template.redFlags, [k]: !template.redFlags[k] } });

  const numOnly = (s: string) => s.replace(/[^\d.]/g, '').slice(0, 8);

  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-semibold text-gray-700">Paeds Template (MVP-lite)</div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-600">
          Age (months)
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={template.ageMonths}
            onChange={(e) => setTemplate({ ...template, ageMonths: numOnly(e.target.value) })}
            placeholder="e.g., 18"
            disabled={disabled}
          />
        </label>

        <label className="text-xs text-gray-600">
          Weight (kg)
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={template.weightKg}
            onChange={(e) => setTemplate({ ...template, weightKg: numOnly(e.target.value) })}
            placeholder="e.g., 11.2"
            disabled={disabled}
          />
        </label>

        <label className="text-xs text-gray-600">
          Temp (°C)
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={template.tempC}
            onChange={(e) => setTemplate({ ...template, tempC: numOnly(e.target.value) })}
            placeholder="e.g., 38.5"
            disabled={disabled}
          />
        </label>

        <label className="text-xs text-gray-600">
          SpO₂ (%)
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={template.spo2}
            onChange={(e) => setTemplate({ ...template, spo2: numOnly(e.target.value) })}
            placeholder="e.g., 96"
            disabled={disabled}
          />
        </label>

        <label className="text-xs text-gray-600">
          HR (/min)
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={template.hr}
            onChange={(e) => setTemplate({ ...template, hr: numOnly(e.target.value) })}
            placeholder="e.g., 120"
            disabled={disabled}
          />
        </label>

        <label className="text-xs text-gray-600">
          RR (/min)
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={template.rr}
            onChange={(e) => setTemplate({ ...template, rr: numOnly(e.target.value) })}
            placeholder="e.g., 28"
            disabled={disabled}
          />
        </label>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-600">
          Hydration
          <select
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={template.hydration}
            onChange={(e) => setTemplate({ ...template, hydration: e.target.value as any })}
            disabled={disabled}
          >
            <option value="ok">OK</option>
            <option value="mild">Mild dehydration</option>
            <option value="moderate">Moderate dehydration</option>
            <option value="severe">Severe dehydration</option>
          </select>
        </label>

        <label className="text-xs text-gray-600">
          Appearance
          <select
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={template.appearance}
            onChange={(e) => setTemplate({ ...template, appearance: e.target.value as any })}
            disabled={disabled}
          >
            <option value="well">Well</option>
            <option value="irritable">Irritable</option>
            <option value="lethargic">Lethargic</option>
          </select>
        </label>

        <label className="text-xs text-gray-600">
          Feeding
          <select
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={template.feeding}
            onChange={(e) => setTemplate({ ...template, feeding: e.target.value as any })}
            disabled={disabled}
          >
            <option value="ok">OK</option>
            <option value="reduced">Reduced</option>
            <option value="poor">Poor</option>
          </select>
        </label>

        <label className="text-xs text-gray-600">
          Urine output
          <select
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={template.urineOutput}
            onChange={(e) => setTemplate({ ...template, urineOutput: e.target.value as any })}
            disabled={disabled}
          >
            <option value="ok">OK</option>
            <option value="reduced">Reduced</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
      </div>

      <div className="mt-3 rounded-lg border bg-gray-50 p-3">
        <div className="text-xs font-semibold text-gray-700">Red flags</div>
        <div className="mt-2 grid grid-cols-1 gap-2">
          {(
            [
              ['breathingDifficulty', 'Breathing difficulty'],
              ['cyanosis', 'Cyanosis / blue lips'],
              ['persistentVomiting', 'Persistent vomiting'],
              ['dehydration', 'Dehydration (marked)'],
              ['seizure', 'Seizure'],
              ['rashNonBlanching', 'Non-blanching rash'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={template.redFlags[k]} onChange={() => toggleRF(k)} disabled={disabled} />
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
          value={template.notes}
          onChange={(e) => setTemplate({ ...template, notes: e.target.value })}
          placeholder="Optional notes…"
          disabled={disabled}
        />
      </label>

      <div className="mt-2 text-[11px] text-gray-500">
        Later: structured paeds triage + growth charts + safety-net advice templates.
      </div>
    </div>
  );
}

function QuickFindingComposer(props: {
  onCreate: (type: FindingTypeKey, severity?: 'mild' | 'moderate' | 'severe', note?: string) => Promise<void>;
  disabled?: boolean;
}) {
  const { onCreate, disabled } = props;

  const [type, setType] = useState<FindingTypeKey>('fever');
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
