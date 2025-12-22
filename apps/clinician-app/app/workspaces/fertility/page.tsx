/*
File: apps/clinician-app/app/workspaces/fertility/page.tsx
Purpose: Fertility workspace (Phase 1) — supports both male + female patients (and “couple”)
Notes:
- Wired to POST /findings, /evidence, /annotations via shared workspaces API helpers.
- Still not integrated with SFU (live_capture fields are placeholders).
- Uses optimistic UI because GET endpoints may not exist yet.
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

const SUBJECTS = [
  { key: 'female', label: 'Female patient' },
  { key: 'male', label: 'Male patient' },
  { key: 'couple', label: 'Couple / Both' },
] as const;

type SubjectKey = (typeof SUBJECTS)[number]['key'];

const FINDING_TYPES = [
  // Shared / admin
  { key: 'initial_consult', label: 'Initial fertility consult' },
  { key: 'infertility_duration', label: 'Infertility duration / history' },
  { key: 'lifestyle_risk', label: 'Lifestyle / risk factors' },
  { key: 'other', label: 'Other' },

  // Female-focused
  { key: 'cycle_irregular', label: 'Irregular cycle / anovulation suspected' },
  { key: 'pcos_suspected', label: 'PCOS suspected' },
  { key: 'endometriosis_suspected', label: 'Endometriosis suspected' },
  { key: 'tubal_factor_suspected', label: 'Tubal factor suspected' },
  { key: 'ovarian_reserve_concern', label: 'Ovarian reserve concern' },
  { key: 'uterine_factor_suspected', label: 'Uterine factor suspected' },

  // Male-focused
  { key: 'semen_analysis_abnormal', label: 'Semen analysis abnormal' },
  { key: 'varicocele_suspected', label: 'Varicocele suspected' },
  { key: 'hormonal_factor_male', label: 'Hormonal factor suspected' },
  { key: 'erectile_or_ejaculation', label: 'Erectile/ejaculatory dysfunction' },

  // Couple-focused
  { key: 'unexplained_infertility', label: 'Unexplained infertility' },
  { key: 'assisted_repro_plan', label: 'Assisted reproduction planning (IUI/IVF)' },
] as const;

type FindingTypeKey = (typeof FINDING_TYPES)[number]['key'];

type FertilityWorkspaceProps = {
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
    const m = anyObj.message;
    if (typeof m === 'string') return m;
    const details = anyObj.details;
    if (details && typeof details === 'object') {
      const dm = (details as Record<string, unknown>).message;
      if (typeof dm === 'string') return dm;
    }
  }
  return 'Request failed';
}

export default function FertilityWorkspacePage(props: FertilityWorkspaceProps) {
  const patientId = props.patientId ?? 'pat_demo_001';
  const encounterId = props.encounterId ?? 'enc_demo_001';
  const clinicianId = props.clinicianId ?? 'clin_demo_001';

  const [subject, setSubject] = useState<SubjectKey>('female');

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

  // Phase-1 exam fields (local-only UX)
  const [durationMonths, setDurationMonths] = useState<string>(''); // infertility duration
  const [priorPregnancies, setPriorPregnancies] = useState<string>(''); // female/couple
  const [priorMiscarriages, setPriorMiscarriages] = useState<string>(''); // female/couple
  const [contraceptionStopped, setContraceptionStopped] = useState<string>(''); // date

  // Female quick capture
  const [lmp, setLmp] = useState<string>('');
  const [cycleLenDays, setCycleLenDays] = useState<string>('');
  const [cycleRegular, setCycleRegular] = useState<'yes' | 'no' | ''>('');
  const [femaleFlags, setFemaleFlags] = useState({
    severePelvicPain: false,
    heavyBleeding: false,
    dyspareunia: false,
    hirsutism: false,
    galactorrhea: false,
  });

  // Male quick capture
  const [maleFlags, setMaleFlags] = useState({
    testicularPain: false,
    swelling: false,
    libidoChange: false,
    erectileIssues: false,
    priorMumpsOrTrauma: false,
  });

  const toggleFemaleFlag = (k: keyof typeof femaleFlags) => setFemaleFlags((s) => ({ ...s, [k]: !s[k] }));
  const toggleMaleFlag = (k: keyof typeof maleFlags) => setMaleFlags((s) => ({ ...s, [k]: !s[k] }));

  // Location helper (stored as JSON on server; TS union may not include — cast safely)
  const locationForSubject = (s: SubjectKey): Location => {
    const loc = { kind: 'fertility' as const, subject: s };
    return loc as unknown as Location;
  };

  const findingsForSubject = useMemo(() => {
    return findings
      .filter((f) => {
        const loc = f.location as unknown as Record<string, unknown> | null;
        const kind = loc?.kind;
        const sub = loc?.subject;
        if (kind === 'fertility' && (sub === 'female' || sub === 'male' || sub === 'couple')) return sub === subject;
        // if some server records don’t match our shape, keep visible rather than dropping
        return true;
      })
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [findings, subject]);

  const evidenceForSubject = useMemo(() => {
    return evidence
      .filter((ev) => {
        const loc = ev.location as unknown as Record<string, unknown> | null;
        const kind = loc?.kind;
        const sub = loc?.subject;
        if (kind === 'fertility' && (sub === 'female' || sub === 'male' || sub === 'couple')) return sub === subject;
        return true;
      })
      .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
  }, [evidence, subject]);

  const subjectCounts = useMemo(() => {
    const c = { female: 0, male: 0, couple: 0 } as Record<SubjectKey, number>;
    for (const f of findings) {
      const loc = f.location as unknown as Record<string, unknown> | null;
      if (loc?.kind === 'fertility' && (loc?.subject === 'female' || loc?.subject === 'male' || loc?.subject === 'couple')) {
        c[loc.subject] += 1;
      }
    }
    return c;
  }, [findings]);

  const evidenceCountForFinding = (findingId: string) => evidence.filter((e) => e.findingId === findingId).length;

  const createManualFinding = async (type: FindingTypeKey, severity?: Finding['severity'], note?: string) => {
    const title = FINDING_TYPES.find((x) => x.key === type)?.label ?? 'Finding';
    const location = locationForSubject(subject);

    const optimisticId = tmpId('fd');
    const optimistic: Finding = {
      id: optimisticId,
      patientId,
      encounterId,
      specialty: 'fertility',
      status: 'draft',
      title,
      note: note?.trim() ? note.trim() : undefined,
      severity,
      tags: ['fertility', subject],
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
        specialty: 'fertility',
        title,
        status: 'draft',
        severity,
        note: note?.trim() ? note.trim() : undefined,
        tags: ['fertility', subject],
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
    const location = locationForSubject(subject);

    setBanner(null);
    setBusy(true);

    try {
      // 1) Create finding
      const createdFinding = await postFinding({
        patientId,
        encounterId,
        specialty: 'fertility',
        title,
        status: 'draft',
        severity: payload.severity,
        note: payload.note,
        tags: ['fertility', subject, 'bookmark'],
        location,
        createdBy: clinicianId,
      });
      setFindings((prev) => [createdFinding, ...prev]);

      // 2) Snapshot evidence (ready)
      const snapshot = await postEvidence({
        patientId,
        encounterId,
        specialty: 'fertility',
        findingId: createdFinding.id,
        location,
        source: {
          type: 'live_capture',
          device: subject === 'male' ? 'camera' : 'camera',
          // SFU fields later
          roomId: undefined,
          trackId: undefined,
        },
        media: {
          kind: 'image',
          url: `https://placehold.co/1200x800?text=Fertility+Snapshot+(${subject.toUpperCase()})`,
          thumbnailUrl: `https://placehold.co/320x200?text=Snapshot+(${subject.toUpperCase()})`,
          contentType: 'image/jpeg',
        },
        status: 'ready',
      });

      // 3) Clip evidence (processing)
      const t = Date.now();
      const clip = await postEvidence({
        patientId,
        encounterId,
        specialty: 'fertility',
        findingId: createdFinding.id,
        location,
        source: {
          type: 'live_capture',
          device: 'camera',
          roomId: undefined,
          trackId: undefined,
          startTs: t - 4000,
          endTs: t + 7000,
        },
        media: {
          kind: 'video_clip',
          url: 'https://example.invalid/clip.mp4',
          thumbnailUrl: `https://placehold.co/320x200?text=Clip+(${subject.toUpperCase()})`,
          contentType: 'video/mp4',
          startTs: t - 4000,
          endTs: t + 7000,
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
        specialty: 'fertility',
        evidenceId: selectedEvidence.id,
        findingId: selectedEvidence.findingId ?? null,
        location: selectedEvidence.location,
        type: 'pin',
        payload: {
          x: 0.55,
          y: 0.43,
          label: 'Key observation',
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
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm text-gray-500">Ambulant+ Workspace</div>
            <h1 className="text-lg font-semibold">Fertility Workspace</h1>
            <div className="mt-1 text-xs text-gray-500">
              Phase 1 · Male + Female · Evidence + annotations · Assessment → plan
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border bg-white px-2 py-1 text-gray-700">
              Patient: <span className="font-mono">{patientId}</span>
            </span>
            <span className="rounded-full border bg-white px-2 py-1 text-gray-700">
              Encounter: <span className="font-mono">{encounterId}</span>
            </span>
            <span className="rounded-full border bg-gray-50 px-2 py-1 text-gray-700">
              Subject: <span className="font-mono font-semibold">{subject.toUpperCase()}</span>
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
              <div className="text-sm font-semibold">Profile & Screening</div>
              <div className="text-xs text-gray-500">Capture history quickly and keep the workflow structured</div>
            </div>

            <div className="p-4 space-y-4">
              <TogglePills<SubjectKey>
                value={subject}
                onChange={setSubject}
                items={SUBJECTS.map((s) => ({ key: s.key, label: s.label }))}
                counts={subjectCounts}
              />

              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700">Core history</div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="text-xs text-gray-600">
                    Duration trying (months)
                    <input
                      className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                      inputMode="numeric"
                      value={durationMonths}
                      onChange={(e) => setDurationMonths(e.target.value)}
                      placeholder="e.g., 18"
                    />
                  </label>

                  <label className="text-xs text-gray-600">
                    Contraception stopped (optional)
                    <input
                      className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                      type="date"
                      value={contraceptionStopped}
                      onChange={(e) => setContraceptionStopped(e.target.value)}
                    />
                  </label>

                  {(subject === 'female' || subject === 'couple') ? (
                    <>
                      <label className="text-xs text-gray-600">
                        Prior pregnancies (G)
                        <input
                          className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                          inputMode="numeric"
                          value={priorPregnancies}
                          onChange={(e) => setPriorPregnancies(e.target.value)}
                          placeholder="e.g., 1"
                        />
                      </label>
                      <label className="text-xs text-gray-600">
                        Prior miscarriages (M)
                        <input
                          className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                          inputMode="numeric"
                          value={priorMiscarriages}
                          onChange={(e) => setPriorMiscarriages(e.target.value)}
                          placeholder="e.g., 0"
                        />
                      </label>
                    </>
                  ) : null}
                </div>

                <div className="mt-2 text-[11px] text-gray-500">
                  Phase 1: local state only. Later: persist as structured encounter fields.
                </div>
              </div>

              {subject === 'female' || subject === 'couple' ? (
                <div className="rounded-lg border p-3">
                  <div className="text-xs font-semibold text-gray-700">Female screening</div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="text-xs text-gray-600">
                      LMP (optional)
                      <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" type="date" value={lmp} onChange={(e) => setLmp(e.target.value)} />
                    </label>

                    <label className="text-xs text-gray-600">
                      Cycle length (days)
                      <input
                        className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                        inputMode="numeric"
                        value={cycleLenDays}
                        onChange={(e) => setCycleLenDays(e.target.value)}
                        placeholder="e.g., 28"
                      />
                    </label>

                    <label className="text-xs text-gray-600 col-span-2">
                      Cycle regular?
                      <select
                        className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                        value={cycleRegular}
                        onChange={(e) => setCycleRegular(e.target.value as 'yes' | 'no' | '')}
                      >
                        <option value="">—</option>
                        <option value="yes">Yes</option>
                        <option value="no">No / unsure</option>
                      </select>
                    </label>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(
                      [
                        ['severePelvicPain', 'Severe pelvic pain'],
                        ['heavyBleeding', 'Heavy bleeding'],
                        ['dyspareunia', 'Dyspareunia'],
                        ['hirsutism', 'Hirsutism'],
                        ['galactorrhea', 'Galactorrhea'],
                      ] as const
                    ).map(([k, label]) => (
                      <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={femaleFlags[k]} onChange={() => toggleFemaleFlag(k)} />
                        {label}
                      </label>
                    ))}
                  </div>

                  <div className="mt-2 text-[11px] text-gray-500">Phase 2: labs/US findings + protocol-driven decision support.</div>
                </div>
              ) : null}

              {subject === 'male' || subject === 'couple' ? (
                <div className="rounded-lg border p-3">
                  <div className="text-xs font-semibold text-gray-700">Male screening</div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(
                      [
                        ['testicularPain', 'Testicular pain'],
                        ['swelling', 'Swelling / mass'],
                        ['libidoChange', 'Libido change'],
                        ['erectileIssues', 'Erectile issues'],
                        ['priorMumpsOrTrauma', 'Mumps/trauma history'],
                      ] as const
                    ).map(([k, label]) => (
                      <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={maleFlags[k]} onChange={() => toggleMaleFlag(k)} />
                        {label}
                      </label>
                    ))}
                  </div>

                  <div className="mt-2 text-[11px] text-gray-500">Phase 2: semen analysis import + varicocele grading + treatment plans.</div>
                </div>
              ) : null}

              <div className="rounded-lg border bg-white p-3">
                <div className="text-xs font-semibold text-gray-700">Findings ({subject.toUpperCase()})</div>
                <div className="mt-2">
                  {findingsForSubject.length === 0 ? (
                    <div className="text-sm text-gray-600 italic">No findings captured yet.</div>
                  ) : (
                    <ul className="space-y-2">
                      {findingsForSubject.slice(0, 6).map((f) => (
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
                {findingsForSubject.length > 6 ? (
                  <div className="mt-2 text-[11px] text-gray-500">Showing latest 6. (Phase 2 adds search/sort + full timeline.)</div>
                ) : null}
              </div>
            </div>
          </section>

          {/* CENTER */}
          <section className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Evidence</div>
                <div className="text-xs text-gray-500">Preview + bookmark (SFU/device integration later)</div>
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
                        <div className="mt-2 text-xs text-gray-500">(Playback will be wired once real clip URLs are returned.)</div>
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
                <div className="text-xs font-semibold text-gray-700">Evidence ({subject.toUpperCase()})</div>
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

              <WorkspaceEvidenceStrip evidence={evidenceForSubject} onSelect={(ev) => setSelectedEvidenceId(ev.id)} />

              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700">Compare (MVP-2)</div>
                <div className="mt-1 text-sm text-gray-700">
                  Later: compare longitudinal labs/imaging across time for male/female/couple.
                </div>
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
              <div className="text-xs text-gray-500">Structured capture → actions (Phase 2 adds orders/referrals/tasks)</div>
            </div>

            <div className="p-4 space-y-4">
              <QuickFindingComposer onCreate={createManualFinding} disabled={busy} subject={subject} />

              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700">Next steps (stub)</div>
                <ul className="mt-2 text-sm text-gray-700 list-disc pl-5 space-y-1">
                  <li>Baseline labs + imaging orders mapped to findings</li>
                  <li>Male: semen analysis, hormones, exam notes</li>
                  <li>Female: ovulation tracking, ultrasound, AMH/TSH/prolactin</li>
                  <li>Couple: coordinated plan + follow-up timeline</li>
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
                <div className="text-xs font-semibold text-gray-700">Summary note (Phase 2)</div>
                <div className="mt-1 text-sm text-gray-700">
                  Coming next: auto-compose a clean fertility summary from Findings + Evidence + Annotations.
                </div>
                <button
                  className="mt-2 text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
                  onClick={() => alert('Stub: generate note')}
                  type="button"
                >
                  Generate note
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      <BookmarkModal
        open={bookmarkOpen}
        onClose={() => setBookmarkOpen(false)}
        title={`Bookmark (${subject.toUpperCase()})`}
        description="Creates a finding + captures snapshot + clip as evidence"
        findingTypes={FINDING_TYPES.map((x) => ({ key: x.key, label: x.label }))}
        defaultTypeKey={
          subject === 'male'
            ? 'semen_analysis_abnormal'
            : subject === 'female'
            ? 'cycle_irregular'
            : 'unexplained_infertility'
        }
        onSave={handleBookmark}
      />
    </div>
  );
}

function QuickFindingComposer(props: {
  onCreate: (type: FindingTypeKey, severity?: 'mild' | 'moderate' | 'severe', note?: string) => Promise<void>;
  disabled?: boolean;
  subject: SubjectKey;
}) {
  const { onCreate, disabled, subject } = props;

  const defaultType: FindingTypeKey =
    subject === 'male' ? 'semen_analysis_abnormal' : subject === 'female' ? 'cycle_irregular' : 'unexplained_infertility';

  const [type, setType] = useState<FindingTypeKey>(defaultType);
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe' | ''>('moderate');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setType(defaultType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject]);

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

        <div className="text-[11px] text-gray-500">
          Tip: use “Bookmark” to attach snapshot + clip evidence to a finding in one step.
        </div>
      </div>
    </div>
  );
}
