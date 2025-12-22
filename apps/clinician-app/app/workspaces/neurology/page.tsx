/*
File: apps/clinician-app/app/workspaces/neurology/page.tsx
Purpose: Neurology workspace (Phase 1)
- Wired to POST /findings, /evidence, /annotations via shared workspaces API helpers.
- Not integrated with SFU yet (live_capture placeholders).
- Uses optimistic UI for findings/evidence until GET endpoints exist.

Design goals:
- Same 3-column “worldclass” layout pattern as Dental/Physio/ENT
- Neuro exam quick capture + timeline-like findings list + evidence preview
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

const SIDES = [
  { key: 'L', label: 'Left (L)' },
  { key: 'R', label: 'Right (R)' },
  { key: 'bilateral', label: 'Bilateral' },
] as const;
type SideKey = (typeof SIDES)[number]['key'];

const SYSTEMS = [
  { key: 'cns', label: 'CNS' },
  { key: 'pns', label: 'PNS' },
  { key: 'headache', label: 'Headache' },
  { key: 'seizure', label: 'Seizure' },
  { key: 'stroke', label: 'Stroke' },
  { key: 'movement', label: 'Movement' },
  { key: 'other', label: 'Other' },
] as const;
type SystemKey = (typeof SYSTEMS)[number]['key'];

const FINDING_TYPES = [
  { key: 'chief_complaint', label: 'Chief complaint' },
  { key: 'neurologic_deficit', label: 'Neurologic deficit' },
  { key: 'sensory_change', label: 'Sensory change' },
  { key: 'motor_weakness', label: 'Motor weakness' },
  { key: 'cranial_nerve', label: 'Cranial nerve finding' },
  { key: 'gait_balance', label: 'Gait / balance' },
  { key: 'tremor', label: 'Tremor / movement' },
  { key: 'seizure_event', label: 'Seizure event' },
  { key: 'headache_profile', label: 'Headache profile' },
  { key: 'stroke_screen', label: 'Stroke screen' },
  { key: 'cognitive_screen', label: 'Cognitive screen' },
  { key: 'reflexes', label: 'Reflexes' },
  { key: 'coordination', label: 'Coordination' },
  { key: 'other', label: 'Other' },
] as const;

type FindingTypeKey = (typeof FINDING_TYPES)[number]['key'];

type Props = {
  patientId?: string;
  encounterId?: string;
  clinicianId?: string;
};

function nowISO() {
  return new Date().toISOString();
}

function tmpId(prefix: string) {
  return `tmp_${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function errMsg(e: unknown) {
  if (e && typeof e === 'object') {
    const anyObj = e as Record<string, unknown>;
    if (typeof anyObj.message === 'string') return anyObj.message;
    const details = anyObj.details;
    if (details && typeof details === 'object') {
      const dm = (details as Record<string, unknown>).message;
      if (typeof dm === 'string') return dm;
    }
  }
  return 'Request failed';
}

export default function NeurologyWorkspacePage(props: Props) {
  const patientId = props.patientId ?? 'pat_demo_001';
  const encounterId = props.encounterId ?? 'enc_demo_001';
  const clinicianId = props.clinicianId ?? 'clin_demo_001';

  const [system, setSystem] = useState<SystemKey>('cns');
  const [side, setSide] = useState<SideKey>('bilateral');

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

  // Quick neuro capture (Phase 1)
  const [gcs, setGcs] = useState<number | ''>('');
  const [pupils, setPupils] = useState<'equal_reactive' | 'unequal' | 'sluggish' | 'non_reactive' | ''>('');
  const [speech, setSpeech] = useState<'normal' | 'dysarthria' | 'aphasia' | ''>('');
  const [strength, setStrength] = useState<Record<'L' | 'R', number | ''>>({ L: '', R: '' }); // 0..5
  const [sensation, setSensation] = useState<Record<'L' | 'R', 'normal' | 'reduced' | 'absent' | ''>>({ L: '', R: '' });
  const [coord, setCoord] = useState<'normal' | 'ataxia' | 'dysmetria' | ''>('');
  const [gait, setGait] = useState<'normal' | 'unsteady' | 'unable' | ''>('');
  const [redFlags, setRedFlags] = useState({
    acuteOnset: false,
    severeHeadache: false,
    seizure: false,
    focalDeficit: false,
    feverNeckStiffness: false,
  });
  const [summaryNote, setSummaryNote] = useState('');

  const toggle = (k: keyof typeof redFlags) => setRedFlags((s) => ({ ...s, [k]: !s[k] }));

  // Location helper (may not exist in shared union; safe cast)
  const locationFor = (sys: SystemKey, s: SideKey): Location => {
    const loc = { kind: 'neuro' as const, system: sys, side: s };
    return loc as unknown as Location;
  };

  const filteredFindings = useMemo(() => {
    return findings
      .filter((f) => {
        const loc = f.location as unknown as Record<string, unknown> | null;
        const kind = loc?.kind;
        const sys = loc?.system;
        const sd = loc?.side;

        // If created by this page, keep it inside current filter.
        if (kind === 'neuro') {
          const sysOk =
            sys === 'cns' || sys === 'pns' || sys === 'headache' || sys === 'seizure' || sys === 'stroke' || sys === 'movement' || sys === 'other';
          const sideOk = sd === 'L' || sd === 'R' || sd === 'bilateral';
          if (sysOk && sideOk) return sys === system && sd === side;
        }
        // If older data or server returns something else, still show it rather than hide everything.
        return true;
      })
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [findings, system, side]);

  const filteredEvidence = useMemo(() => {
    return evidence
      .filter((ev) => {
        const loc = ev.location as unknown as Record<string, unknown> | null;
        const kind = loc?.kind;
        const sys = loc?.system;
        const sd = loc?.side;

        if (kind === 'neuro') {
          const sysOk =
            sys === 'cns' || sys === 'pns' || sys === 'headache' || sys === 'seizure' || sys === 'stroke' || sys === 'movement' || sys === 'other';
          const sideOk = sd === 'L' || sd === 'R' || sd === 'bilateral';
          if (sysOk && sideOk) return sys === system && sd === side;
        }
        return true;
      })
      .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
  }, [evidence, system, side]);

  const systemCounts = useMemo(() => {
    const c: Record<SystemKey, number> = { cns: 0, pns: 0, headache: 0, seizure: 0, stroke: 0, movement: 0, other: 0 };
    for (const f of findings) {
      const loc = f.location as unknown as Record<string, unknown> | null;
      if (loc?.kind === 'neuro') {
        const sys = loc.system as SystemKey;
        if (sys in c) c[sys] += 1;
      }
    }
    return c;
  }, [findings]);

  const sideCounts = useMemo(() => {
    const c: Record<SideKey, number> = { L: 0, R: 0, bilateral: 0 };
    for (const f of findings) {
      const loc = f.location as unknown as Record<string, unknown> | null;
      if (loc?.kind === 'neuro') {
        const sd = loc.side as SideKey;
        if (sd in c) c[sd] += 1;
      }
    }
    return c;
  }, [findings]);

  const evidenceCountForFinding = (findingId: string) => evidence.filter((e) => e.findingId === findingId).length;

  const createManualFinding = async (type: FindingTypeKey, severity?: Finding['severity'], note?: string) => {
    const title = FINDING_TYPES.find((x) => x.key === type)?.label ?? 'Finding';
    const location = locationFor(system, side);

    const optimisticId = tmpId('fd');
    const optimistic: Finding = {
      id: optimisticId,
      patientId,
      encounterId,
      specialty: 'neurology',
      status: 'draft',
      title,
      note: note?.trim() ? note.trim() : undefined,
      severity,
      tags: ['neuro', system, side],
      location,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      createdBy: clinicianId,
      meta: {},
    };

    setBanner(null);
    setFindings((prev) => [optimistic, ...prev]);

    try {
      const created = await postFinding({
        patientId,
        encounterId,
        specialty: 'neurology',
        title,
        status: 'draft',
        severity,
        note: note?.trim() ? note.trim() : undefined,
        tags: ['neuro', system, side],
        location,
        createdBy: clinicianId,
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
    const location = locationFor(system, side);

    setBanner(null);
    setBusy(true);

    try {
      const createdFinding = await postFinding({
        patientId,
        encounterId,
        specialty: 'neurology',
        title,
        status: 'draft',
        severity: payload.severity,
        note: payload.note,
        tags: ['neuro', system, side, 'bookmark'],
        location,
        createdBy: clinicianId,
      });
      setFindings((prev) => [createdFinding, ...prev]);

      const snapshot = await postEvidence({
        patientId,
        encounterId,
        specialty: 'neurology',
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
          url: `https://placehold.co/1200x800?text=Neuro+Snapshot+(${system.toUpperCase()}+${side})`,
          thumbnailUrl: `https://placehold.co/320x200?text=Snapshot+(${system.toUpperCase()}+${side})`,
          contentType: 'image/jpeg',
        },
        status: 'ready',
      });

      const t = Date.now();
      const clip = await postEvidence({
        patientId,
        encounterId,
        specialty: 'neurology',
        findingId: createdFinding.id,
        location,
        source: {
          type: 'live_capture',
          device: 'camera',
          roomId: undefined,
          trackId: undefined,
          startTs: t - 3500,
          endTs: t + 6500,
        },
        media: {
          kind: 'video_clip',
          url: 'https://example.invalid/clip.mp4',
          thumbnailUrl: `https://placehold.co/320x200?text=Clip+(${system.toUpperCase()}+${side})`,
          contentType: 'video/mp4',
          startTs: t - 3500,
          endTs: t + 6500,
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
        specialty: 'neurology',
        evidenceId: selectedEvidence.id,
        findingId: selectedEvidence.findingId ?? null,
        location: selectedEvidence.location,
        type: 'pin',
        payload: { x: 0.52, y: 0.41, label: 'Area of concern' },
        createdBy: clinicianId,
      });

      setBanner({ kind: 'success', text: 'Annotation created (demo pin).' });
    } catch (e) {
      setBanner({ kind: 'error', text: `Failed to create annotation: ${errMsg(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const neuroSummary = useMemo(() => {
    const flags = Object.entries(redFlags)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(', ');
    const s = {
      gcs: typeof gcs === 'number' ? `${gcs}` : '—',
      pupils: pupils || '—',
      speech: speech || '—',
      strength: `L:${strength.L === '' ? '—' : strength.L}/5 R:${strength.R === '' ? '—' : strength.R}/5`,
      sensation: `L:${sensation.L || '—'} R:${sensation.R || '—'}`,
      coord: coord || '—',
      gait: gait || '—',
      flags: flags || '—',
    };
    return s;
  }, [gcs, pupils, speech, strength, sensation, coord, gait, redFlags]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm text-gray-500">Ambulant+ Workspace</div>
            <h1 className="text-lg font-semibold">Neurology Workspace</h1>
            <div className="mt-1 text-xs text-gray-500">Phase 1 · Quick exam + findings + evidence</div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border bg-white px-2 py-1 text-gray-700">
              Patient: <span className="font-mono">{patientId}</span>
            </span>
            <span className="rounded-full border bg-white px-2 py-1 text-gray-700">
              Encounter: <span className="font-mono">{encounterId}</span>
            </span>
            <span className="rounded-full border bg-gray-50 px-2 py-1 text-gray-700">
              Focus: <span className="font-mono font-semibold">{system.toUpperCase()}</span> ·{' '}
              <span className="font-mono font-semibold">{side}</span>
            </span>
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
              <div className="text-sm font-semibold">Focus</div>
              <div className="text-xs text-gray-500">System + laterality + quick neuro capture</div>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <div className="text-xs font-semibold text-gray-700">System</div>
                <div className="mt-2">
                  <TogglePills<SystemKey>
                    value={system}
                    onChange={setSystem}
                    items={SYSTEMS.map((s) => ({ key: s.key, label: s.label }))}
                    counts={systemCounts}
                  />
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-700">Laterality</div>
                <div className="mt-2">
                  <TogglePills<SideKey>
                    value={side}
                    onChange={setSide}
                    items={SIDES.map((s) => ({ key: s.key, label: s.label }))}
                    counts={sideCounts}
                  />
                </div>
              </div>

              <NeuroQuickExam
                gcs={gcs}
                setGcs={setGcs}
                pupils={pupils}
                setPupils={setPupils}
                speech={speech}
                setSpeech={setSpeech}
                strength={strength}
                setStrength={setStrength}
                sensation={sensation}
                setSensation={setSensation}
                coord={coord}
                setCoord={setCoord}
                gait={gait}
                setGait={setGait}
                redFlags={redFlags}
                toggleFlag={toggle}
                summaryNote={summaryNote}
                setSummaryNote={setSummaryNote}
              />

              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700">Summary</div>
                <div className="mt-2 text-sm text-gray-700 space-y-1">
                  <div>
                    GCS: <span className="font-mono font-semibold">{neuroSummary.gcs}</span> · Pupils:{' '}
                    <span className="font-mono font-semibold">{neuroSummary.pupils}</span>
                  </div>
                  <div>
                    Speech: <span className="font-mono font-semibold">{neuroSummary.speech}</span> · Coordination:{' '}
                    <span className="font-mono font-semibold">{neuroSummary.coord}</span> · Gait:{' '}
                    <span className="font-mono font-semibold">{neuroSummary.gait}</span>
                  </div>
                  <div>
                    Strength: <span className="font-mono font-semibold">{neuroSummary.strength}</span>
                  </div>
                  <div>
                    Sensation: <span className="font-mono font-semibold">{neuroSummary.sensation}</span>
                  </div>
                  <div>
                    Red flags: <span className="font-mono font-semibold">{neuroSummary.flags}</span>
                  </div>
                </div>
                {summaryNote?.trim() ? (
                  <div className="mt-2 text-xs text-gray-600">
                    Note: <span className="text-gray-800">{summaryNote.trim()}</span>
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg border bg-white p-3">
                <div className="text-xs font-semibold text-gray-700">Findings (filtered)</div>
                <div className="mt-2">
                  {filteredFindings.length === 0 ? (
                    <div className="text-sm text-gray-600 italic">No findings in this focus yet.</div>
                  ) : (
                    <ul className="space-y-2">
                      {filteredFindings.slice(0, 6).map((f) => (
                        <li key={f.id}>
                          <FindingCard finding={f} evidenceCount={evidenceCountForFinding(f.id)} onToggleFinal={undefined} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {filteredFindings.length > 6 ? (
                  <div className="mt-2 text-[11px] text-gray-500">Showing latest 6. Phase 2 adds timeline + filters.</div>
                ) : null}
              </div>
            </div>
          </section>

          {/* CENTER */}
          <section className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Neuro Media</div>
                <div className="text-xs text-gray-500">Preview + bookmark (SFU later)</div>
              </div>

              <button
                className="rounded-full border bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-800 disabled:opacity-50"
                onClick={() => setBookmarkOpen(true)}
                disabled={busy}
                type="button"
              >
                Bookmark
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="rounded-lg border bg-gray-100 h-64 overflow-hidden">
                {selectedEvidence ? (
                  selectedEvidence.kind === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedEvidence.url} alt="Selected evidence" className="h-full w-full object-contain" />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-gray-700">
                      <div className="text-center px-6">
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
                    <div className="text-center px-6">
                      <div className="text-sm font-medium">No evidence selected</div>
                      <div className="text-xs text-gray-500 mt-1">Select an item below to preview</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-gray-700">
                  Evidence ({system.toUpperCase()} · {side})
                </div>
                <button
                  className="text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
                  onClick={addDemoPinAnnotation}
                  disabled={busy}
                  title="Creates a demo pin annotation for the selected evidence"
                  type="button"
                >
                  + Add demo pin
                </button>
              </div>

              <WorkspaceEvidenceStrip evidence={filteredEvidence} onSelect={(ev) => setSelectedEvidenceId(ev.id)} />

              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700">Compare (MVP-2)</div>
                <div className="mt-1 text-sm text-gray-700">Later: compare visits, attach imaging, track progression.</div>
                <button
                  className="mt-2 text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
                  onClick={() => alert('Stub: open compare view')}
                  type="button"
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
              <div className="text-xs text-gray-500">Add findings fast + plan stubs</div>
            </div>

            <div className="p-4 space-y-4">
              <QuickFindingComposer onCreate={createManualFinding} disabled={busy} />

              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700">Plan (stub)</div>
                <ul className="mt-2 text-sm text-gray-700 list-disc pl-5 space-y-1">
                  <li>Targeted neuro exam and documentation.</li>
                  <li>Imaging/labs/referral as clinically appropriate.</li>
                  <li>Return precautions and follow-up.</li>
                </ul>
                <button
                  className="mt-2 text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
                  onClick={() => alert('Stub: add plan item')}
                  type="button"
                >
                  + Add plan item
                </button>
              </div>

              <div className="rounded-lg border p-3">
                <div className="text-xs font-semibold text-gray-700">Orders (Phase 2)</div>
                <div className="mt-1 text-sm text-gray-700">Coming next: link imaging/labs, referrals, meds.</div>
                <button
                  className="mt-2 text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
                  onClick={() => alert('Stub: add order')}
                  type="button"
                >
                  + Add order
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      <BookmarkModal
        open={bookmarkOpen}
        onClose={() => setBookmarkOpen(false)}
        title={`Bookmark (${system.toUpperCase()} · ${side})`}
        description="Creates a finding + captures snapshot + clip as evidence"
        findingTypes={FINDING_TYPES.map((x) => ({ key: x.key, label: x.label }))}
        defaultTypeKey={system === 'stroke' ? 'stroke_screen' : system === 'headache' ? 'headache_profile' : 'neurologic_deficit'}
        onSave={handleBookmark}
      />
    </div>
  );
}

function NeuroQuickExam(props: {
  gcs: number | '';
  setGcs: (v: number | '') => void;
  pupils: '' | 'equal_reactive' | 'unequal' | 'sluggish' | 'non_reactive';
  setPupils: (v: '' | 'equal_reactive' | 'unequal' | 'sluggish' | 'non_reactive') => void;
  speech: '' | 'normal' | 'dysarthria' | 'aphasia';
  setSpeech: (v: '' | 'normal' | 'dysarthria' | 'aphasia') => void;
  strength: Record<'L' | 'R', number | ''>;
  setStrength: (v: Record<'L' | 'R', number | ''>) => void;
  sensation: Record<'L' | 'R', '' | 'normal' | 'reduced' | 'absent'>;
  setSensation: (v: Record<'L' | 'R', '' | 'normal' | 'reduced' | 'absent'>) => void;
  coord: '' | 'normal' | 'ataxia' | 'dysmetria';
  setCoord: (v: '' | 'normal' | 'ataxia' | 'dysmetria') => void;
  gait: '' | 'normal' | 'unsteady' | 'unable';
  setGait: (v: '' | 'normal' | 'unsteady' | 'unable') => void;
  redFlags: {
    acuteOnset: boolean;
    severeHeadache: boolean;
    seizure: boolean;
    focalDeficit: boolean;
    feverNeckStiffness: boolean;
  };
  toggleFlag: (k: keyof NeuroQuickExamProps['redFlags']) => void;
  summaryNote: string;
  setSummaryNote: (v: string) => void;
}) {
  // TS helper: infer toggle type
  type NeuroQuickExamProps = typeof props;

  const {
    gcs,
    setGcs,
    pupils,
    setPupils,
    speech,
    setSpeech,
    strength,
    setStrength,
    sensation,
    setSensation,
    coord,
    setCoord,
    gait,
    setGait,
    redFlags,
    toggleFlag,
    summaryNote,
    setSummaryNote,
  } = props;

  const setStrengthSide = (side: 'L' | 'R', v: string) => {
    const t = v.trim();
    if (t === '') return setStrength({ ...strength, [side]: '' });
    const n = Number(t);
    if (!Number.isFinite(n)) return;
    setStrength({ ...strength, [side]: Math.max(0, Math.min(5, Math.round(n))) });
  };

  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-semibold text-gray-700">Quick Neuro Exam (MVP)</div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-600">
          GCS
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            inputMode="numeric"
            placeholder="e.g., 15"
            value={gcs}
            onChange={(e) => {
              const v = e.target.value.trim();
              if (v === '') return setGcs('');
              const n = Number(v);
              if (!Number.isFinite(n)) return;
              setGcs(Math.max(3, Math.min(15, Math.round(n))));
            }}
          />
        </label>

        <label className="text-xs text-gray-600">
          Pupils
          <select className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={pupils} onChange={(e) => setPupils(e.target.value as any)}>
            <option value="">—</option>
            <option value="equal_reactive">Equal & reactive</option>
            <option value="unequal">Unequal</option>
            <option value="sluggish">Sluggish</option>
            <option value="non_reactive">Non-reactive</option>
          </select>
        </label>

        <label className="text-xs text-gray-600">
          Speech
          <select className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={speech} onChange={(e) => setSpeech(e.target.value as any)}>
            <option value="">—</option>
            <option value="normal">Normal</option>
            <option value="dysarthria">Dysarthria</option>
            <option value="aphasia">Aphasia</option>
          </select>
        </label>

        <label className="text-xs text-gray-600">
          Coordination
          <select className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={coord} onChange={(e) => setCoord(e.target.value as any)}>
            <option value="">—</option>
            <option value="normal">Normal</option>
            <option value="ataxia">Ataxia</option>
            <option value="dysmetria">Dysmetria</option>
          </select>
        </label>

        <label className="text-xs text-gray-600">
          Gait
          <select className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={gait} onChange={(e) => setGait(e.target.value as any)}>
            <option value="">—</option>
            <option value="normal">Normal</option>
            <option value="unsteady">Unsteady</option>
            <option value="unable">Unable</option>
          </select>
        </label>

        <div className="rounded border bg-gray-50 p-2">
          <div className="text-[11px] font-semibold text-gray-700">Strength (0–5)</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-600">
              Left
              <input
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                inputMode="numeric"
                placeholder="e.g., 5"
                value={strength.L}
                onChange={(e) => setStrengthSide('L', e.target.value)}
              />
            </label>
            <label className="text-xs text-gray-600">
              Right
              <input
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                inputMode="numeric"
                placeholder="e.g., 5"
                value={strength.R}
                onChange={(e) => setStrengthSide('R', e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="rounded border bg-gray-50 p-2">
          <div className="text-[11px] font-semibold text-gray-700">Sensation</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-600">
              Left
              <select
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                value={sensation.L}
                onChange={(e) => setSensation({ ...sensation, L: e.target.value as any })}
              >
                <option value="">—</option>
                <option value="normal">Normal</option>
                <option value="reduced">Reduced</option>
                <option value="absent">Absent</option>
              </select>
            </label>
            <label className="text-xs text-gray-600">
              Right
              <select
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                value={sensation.R}
                onChange={(e) => setSensation({ ...sensation, R: e.target.value as any })}
              >
                <option value="">—</option>
                <option value="normal">Normal</option>
                <option value="reduced">Reduced</option>
                <option value="absent">Absent</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <div className="text-xs font-semibold text-gray-700">Red flags (quick)</div>
        <div className="mt-2 grid grid-cols-1 gap-2">
          {(
            [
              ['acuteOnset', 'Acute onset / sudden change'],
              ['severeHeadache', 'Severe headache'],
              ['seizure', 'Seizure'],
              ['focalDeficit', 'Focal neurological deficit'],
              ['feverNeckStiffness', 'Fever / neck stiffness'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={redFlags[k]} onChange={() => toggleFlag(k)} />
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
          value={summaryNote}
          onChange={(e) => setSummaryNote(e.target.value)}
          placeholder="Optional exam notes…"
        />
      </label>

      <div className="mt-2 text-[11px] text-gray-500">Phase 2: NIHSS, headache diary fields, seizure semiology templates.</div>
    </div>
  );
}

function QuickFindingComposer(props: {
  onCreate: (type: FindingTypeKey, severity?: 'mild' | 'moderate' | 'severe', note?: string) => Promise<void>;
  disabled?: boolean;
}) {
  const { onCreate, disabled } = props;

  const [type, setType] = useState<FindingTypeKey>('neurologic_deficit');
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
              await onCreate(type, (severity || undefined) as 'mild' | 'moderate' | 'severe' | undefined, note);
              setNote('');
            } finally {
              setSaving(false);
            }
          }}
          type="button"
        >
          {saving ? 'Saving…' : 'Create finding'}
        </button>

        <div className="text-[11px] text-gray-500">Tip: use “Bookmark” to attach snapshot + clip evidence in one step.</div>
      </div>
    </div>
  );
}
