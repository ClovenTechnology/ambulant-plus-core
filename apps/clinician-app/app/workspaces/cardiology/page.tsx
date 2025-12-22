/*
File: apps/clinician-app/app/workspaces/cardiology/page.tsx
Purpose: Cardiology workspace (wired to POST /findings, /evidence, /annotations)

Notes:
- Not integrated with SFU yet (live_capture fields are placeholders).
- Uses optimistic UI because no GET endpoints exist yet.
- Evidence kinds intentionally kept to image + video_clip to match existing workspace evidence types.
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

const FINDING_TYPES = [
  { key: 'tachycardia', label: 'Tachycardia suspected' },
  { key: 'bradycardia', label: 'Bradycardia suspected' },
  { key: 'irregular_rhythm', label: 'Irregular rhythm suspected' },
  { key: 'st_change', label: 'ST/T change suspected' },
  { key: 'murmur_suspected', label: 'Murmur suspected' },
  { key: 'heart_failure_signs', label: 'Heart failure signs' },
  { key: 'hypertension', label: 'Hypertension / elevated BP' },
  { key: 'other', label: 'Other' },
] as const;

type FindingTypeKey = (typeof FINDING_TYPES)[number]['key'];

type CardioMode = 'ECG' | 'AUSC';
type CardioZone =
  | '12_lead'
  | 'lead_I'
  | 'lead_II'
  | 'lead_III'
  | 'v1'
  | 'v2'
  | 'v3'
  | 'v4'
  | 'v5'
  | 'v6'
  | 'aortic'
  | 'pulmonic'
  | 'tricuspid'
  | 'mitral';

type CardiologyWorkspaceProps = {
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

export default function CardiologyWorkspacePage(props: CardiologyWorkspaceProps) {
  const patientId = props.patientId ?? 'pat_demo_001';
  const encounterId = props.encounterId ?? 'enc_demo_001';
  const clinicianId = props.clinicianId ?? 'clin_demo_001';

  const [mode, setMode] = useState<CardioMode>('ECG');
  const [zone, setZone] = useState<CardioZone>('12_lead');

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

  // Quick exam template (local-only)
  const [vitals, setVitals] = useState({
    hr: '',
    bpSys: '',
    bpDia: '',
    spo2: '',
    rr: '',
  });

  const [symptoms, setSymptoms] = useState({
    chestPain: false,
    dyspnea: false,
    palpitations: false,
    syncope: false,
    edema: false,
    fatigue: false,
  });

  const [symptomNote, setSymptomNote] = useState('');

  const toggleSymptom = (k: keyof typeof symptoms) => setSymptoms((s) => ({ ...s, [k]: !s[k] }));

  const locationFor = (m: CardioMode, z: CardioZone): Location =>
    ({
      kind: 'cardio_site',
      mode: m,
      zone: z,
    } as any);

  const findingsForContext = useMemo(() => {
    return findings
      .filter((f) => (f.location as any)?.kind === 'cardio_site')
      .filter((f) => (f.location as any)?.mode === mode)
      .filter((f) => (f.location as any)?.zone === zone)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [findings, mode, zone]);

  const evidenceForContext = useMemo(() => {
    return evidence
      .filter((ev) => (ev.location as any)?.kind === 'cardio_site')
      .filter((ev) => (ev.location as any)?.mode === mode)
      .filter((ev) => (ev.location as any)?.zone === zone)
      .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
  }, [evidence, mode, zone]);

  const countsForMode = useMemo(() => {
    const c = { ECG: 0, AUSC: 0 } as Record<CardioMode, number>;
    for (const f of findings) {
      if ((f.location as any)?.kind !== 'cardio_site') continue;
      const m = (f.location as any)?.mode as CardioMode | undefined;
      if (m === 'ECG' || m === 'AUSC') c[m] += 1;
    }
    return c;
  }, [findings]);

  const evidenceCountForFinding = (findingId: string) => evidence.filter((e) => e.findingId === findingId).length;

  const createManualFinding = async (type: FindingTypeKey, severity?: Finding['severity'], note?: string) => {
    const title = FINDING_TYPES.find((x) => x.key === type)?.label ?? 'Finding';
    const location = locationFor(mode, zone);

    const optimisticId = tmpId('fd');
    const optimistic: Finding = {
      id: optimisticId,
      patientId,
      encounterId,
      specialty: 'cardiology',
      status: 'draft',
      title,
      note: note?.trim() ? note.trim() : undefined,
      severity,
      tags: ['cardiology', mode.toLowerCase(), `zone:${zone}`],
      location,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      createdBy: clinicianId,
      meta: {
        // local-only exam crumbs (until we persist structured exam fields)
        vitals,
        symptoms,
        symptomNote: symptomNote?.trim() ? symptomNote.trim() : undefined,
      },
    };

    setBanner(null);
    setFindings((prev) => [optimistic, ...prev]);

    try {
      const created = await postFinding({
        patientId,
        encounterId,
        specialty: 'cardiology',
        title,
        status: 'draft',
        severity,
        note: note?.trim() ? note.trim() : undefined,
        tags: ['cardiology', mode.toLowerCase(), `zone:${zone}`],
        location,
        createdBy: clinicianId,
        meta: optimistic.meta,
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
    const location = locationFor(mode, zone);

    setBanner(null);
    setBusy(true);

    try {
      // 1) Create finding
      const createdFinding = await postFinding({
        patientId,
        encounterId,
        specialty: 'cardiology',
        title,
        status: 'draft',
        severity: payload.severity,
        note: payload.note,
        tags: ['cardiology', 'bookmark', mode.toLowerCase(), `zone:${zone}`],
        location,
        createdBy: clinicianId,
        meta: {
          vitals,
          symptoms,
          symptomNote: symptomNote?.trim() ? symptomNote.trim() : undefined,
        },
      });
      setFindings((prev) => [createdFinding, ...prev]);

      // 2) Snapshot evidence (ready)
      const snapshotLabel =
        mode === 'ECG'
          ? `ECG Snapshot (${zone})`
          : `Auscultation Snapshot (${zone})`;

      const snapshot = await postEvidence({
        patientId,
        encounterId,
        specialty: 'cardiology',
        findingId: createdFinding.id,
        location,
        source: {
          type: 'live_capture',
          device: mode === 'ECG' ? 'ecg' : 'stethoscope',
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
      const clipLabel =
        mode === 'ECG'
          ? `ECG Segment (${zone})`
          : `Auscultation Clip (${zone})`;

      const clip = await postEvidence({
        patientId,
        encounterId,
        specialty: 'cardiology',
        findingId: createdFinding.id,
        location,
        source: {
          type: 'live_capture',
          device: mode === 'ECG' ? 'ecg' : 'stethoscope',
          roomId: undefined,
          trackId: undefined,
          startTs: t - 4000,
          endTs: t + 8000,
        },
        media: {
          kind: 'video_clip',
          url: 'https://example.invalid/cardiology-clip.mp4',
          thumbnailUrl: `https://placehold.co/320x200?text=${encodeURIComponent(clipLabel)}`,
          contentType: 'video/mp4',
          startTs: t - 4000,
          endTs: t + 8000,
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
        specialty: 'cardiology',
        evidenceId: selectedEvidence.id,
        findingId: selectedEvidence.findingId ?? null,
        location: selectedEvidence.location,
        type: 'pin',
        payload: {
          x: 0.62,
          y: 0.34,
          label: mode === 'ECG' ? 'Waveform area of concern' : 'Auscultation focus',
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
            <h1 className="text-lg font-semibold">Cardiology Workspace</h1>
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
              <div className="text-sm font-semibold">Cardiac Chart</div>
              <div className="text-xs text-gray-500">Choose ECG/Auscultation and focus area</div>
            </div>

            <div className="p-4 space-y-4">
              <TogglePills<CardioMode>
                value={mode}
                onChange={(m) => {
                  setMode(m);
                  setZone(m === 'ECG' ? '12_lead' : 'mitral');
                }}
                items={[
                  { key: 'ECG', label: 'ECG' },
                  { key: 'AUSC', label: 'Auscultation' },
                ]}
                counts={countsForMode}
              />

              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700">Focus</div>
                <div className="mt-1 text-sm text-gray-800">
                  Mode: <span className="font-mono font-semibold">{mode}</span>
                </div>
                <div className="mt-1 text-sm text-gray-800">
                  Zone: <span className="font-mono font-semibold">{zone}</span>
                </div>
                <div className="mt-2 text-[11px] text-gray-500">
                  MVP-2: replace this with true ECG lead map + auscultation hotspots.
                </div>
              </div>

              <ZonePicker mode={mode} zone={zone} onChange={setZone} />

              <div>
                <div className="text-xs font-semibold text-gray-700">Findings</div>
                <div className="mt-2">
                  {findingsForContext.length === 0 ? (
                    <div className="text-sm text-gray-600 italic">No findings for this context yet.</div>
                  ) : (
                    <ul className="space-y-2">
                      {findingsForContext.map((f) => (
                        <li key={f.id}>
                          <FindingCard
                            finding={f}
                            evidenceCount={evidenceCountForFinding(f.id)}
                            onToggleFinal={undefined}
                          />
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
                <div className="text-sm font-semibold">{mode === 'ECG' ? 'ECG Monitor' : 'Digital Stethoscope'}</div>
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
                      <div className="text-sm font-medium">
                        {mode === 'ECG' ? 'Live ECG View (placeholder)' : 'Live Auscultation View (placeholder)'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Select evidence below to preview</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs font-semibold text-gray-700">
                  Evidence for {mode} · <span className="font-mono">{zone}</span>
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

              <WorkspaceEvidenceStrip evidence={evidenceForContext} onSelect={(ev) => setSelectedEvidenceId(ev.id)} />

              <div className="mt-4 rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700">Compare (MVP-2)</div>
                <div className="mt-1 text-sm text-gray-700">Later: compare current vs prior ECG/auscultation evidence.</div>
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
              <div className="text-xs text-gray-500">Vitals + symptoms + quick finding</div>
            </div>

            <div className="p-4 space-y-4">
              <VitalsPanel vitals={vitals} setVitals={setVitals} disabled={busy} />
              <SymptomsPanel
                symptoms={symptoms}
                toggleSymptom={toggleSymptom}
                note={symptomNote}
                setNote={setSymptomNote}
                disabled={busy}
              />

              <QuickFindingComposer onCreate={createManualFinding} disabled={busy} />

              <div className="rounded-lg border p-3 bg-gray-50">
                <div className="text-xs font-semibold text-gray-700">Plan (stub)</div>
                <div className="mt-1 text-sm text-gray-700">
                  Coming next: meds/orders/referrals + follow-up tasks linked to findings.
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
        title={`Bookmark (${mode} · ${zone})`}
        description="Creates a finding + captures snapshot + clip as evidence"
        findingTypes={FINDING_TYPES.map((x) => ({ key: x.key, label: x.label }))}
        defaultTypeKey={mode === 'ECG' ? 'irregular_rhythm' : 'murmur_suspected'}
        onSave={handleBookmark}
      />
    </div>
  );
}

function ZonePicker(props: {
  mode: CardioMode;
  zone: CardioZone;
  onChange: (z: CardioZone) => void;
}) {
  const { mode, zone, onChange } = props;

  const ecgZones: { key: CardioZone; label: string }[] = [
    { key: '12_lead', label: '12-lead' },
    { key: 'lead_I', label: 'Lead I' },
    { key: 'lead_II', label: 'Lead II' },
    { key: 'lead_III', label: 'Lead III' },
    { key: 'v1', label: 'V1' },
    { key: 'v2', label: 'V2' },
    { key: 'v3', label: 'V3' },
    { key: 'v4', label: 'V4' },
    { key: 'v5', label: 'V5' },
    { key: 'v6', label: 'V6' },
  ];

  const auscZones: { key: CardioZone; label: string }[] = [
    { key: 'aortic', label: 'Aortic' },
    { key: 'pulmonic', label: 'Pulmonic' },
    { key: 'tricuspid', label: 'Tricuspid' },
    { key: 'mitral', label: 'Mitral' },
  ];

  const items = mode === 'ECG' ? ecgZones : auscZones;

  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-semibold text-gray-700">Zone</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {items.map((it) => {
          const active = it.key === zone;
          return (
            <button
              key={it.key}
              className={
                'rounded-lg border px-3 py-2 text-sm text-left ' +
                (active ? 'border-blue-300 bg-blue-50 text-blue-900' : 'border-gray-200 bg-white hover:bg-gray-50')
              }
              onClick={() => onChange(it.key)}
              aria-pressed={active}
              type="button"
            >
              <div className="font-medium">{it.label}</div>
              <div className="text-[11px] text-gray-500">{mode.toLowerCase()}</div>
            </button>
          );
        })}
      </div>
      <div className="mt-2 text-[11px] text-gray-500">
        MVP-2: real lead layout + auscultation hotspots with guided workflow.
      </div>
    </div>
  );
}

function VitalsPanel(props: {
  vitals: { hr: string; bpSys: string; bpDia: string; spo2: string; rr: string };
  setVitals: (v: { hr: string; bpSys: string; bpDia: string; spo2: string; rr: string }) => void;
  disabled?: boolean;
}) {
  const { vitals, setVitals, disabled } = props;

  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-semibold text-gray-700">Vitals (MVP-lite)</div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-600">
          HR (bpm)
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={vitals.hr}
            onChange={(e) => setVitals({ ...vitals, hr: e.target.value })}
            placeholder="e.g., 88"
            disabled={disabled}
          />
        </label>

        <label className="text-xs text-gray-600">
          SpO₂ (%)
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={vitals.spo2}
            onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
            placeholder="e.g., 97"
            disabled={disabled}
          />
        </label>

        <label className="text-xs text-gray-600">
          BP Systolic
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={vitals.bpSys}
            onChange={(e) => setVitals({ ...vitals, bpSys: e.target.value })}
            placeholder="e.g., 128"
            disabled={disabled}
          />
        </label>

        <label className="text-xs text-gray-600">
          BP Diastolic
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={vitals.bpDia}
            onChange={(e) => setVitals({ ...vitals, bpDia: e.target.value })}
            placeholder="e.g., 78"
            disabled={disabled}
          />
        </label>

        <label className="text-xs text-gray-600 col-span-2">
          RR (breaths/min)
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={vitals.rr}
            onChange={(e) => setVitals({ ...vitals, rr: e.target.value })}
            placeholder="e.g., 16"
            disabled={disabled}
          />
        </label>
      </div>

      <div className="mt-2 text-[11px] text-gray-500">Later: persist vitals as structured observations.</div>
    </div>
  );
}

function SymptomsPanel(props: {
  symptoms: {
    chestPain: boolean;
    dyspnea: boolean;
    palpitations: boolean;
    syncope: boolean;
    edema: boolean;
    fatigue: boolean;
  };
  toggleSymptom: (k: keyof any) => void;
  note: string;
  setNote: (v: string) => void;
  disabled?: boolean;
}) {
  const { symptoms, toggleSymptom, note, setNote, disabled } = props;

  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-semibold text-gray-700">Symptoms (MVP-lite)</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(
          [
            ['chestPain', 'Chest pain'],
            ['dyspnea', 'Dyspnea'],
            ['palpitations', 'Palpitations'],
            ['syncope', 'Syncope'],
            ['edema', 'Edema'],
            ['fatigue', 'Fatigue'],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={(symptoms as any)[k]} onChange={() => toggleSymptom(k)} disabled={disabled} />
            {label}
          </label>
        ))}
      </div>

      <label className="mt-3 block text-xs text-gray-600">
        Notes
        <textarea
          className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional symptom details…"
          disabled={disabled}
        />
      </label>

      <div className="mt-2 text-[11px] text-gray-500">
        Later: persist symptoms into structured fields on the encounter or as a Finding template.
      </div>
    </div>
  );
}

function QuickFindingComposer(props: {
  onCreate: (type: FindingTypeKey, severity?: 'mild' | 'moderate' | 'severe', note?: string) => Promise<void>;
  disabled?: boolean;
}) {
  const { onCreate, disabled } = props;

  const [type, setType] = useState<FindingTypeKey>('irregular_rhythm');
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
