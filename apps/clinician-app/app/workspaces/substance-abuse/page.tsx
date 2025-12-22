/*
File: apps/clinician-app/app/workspaces/substance-abuse/page.tsx
Purpose: Substance Use / Addiction Medicine workspace (Phase 1)
- Wired to POST /findings, /evidence, /annotations via shared workspaces API helpers.
- Not integrated with SFU yet (live_capture placeholders).
- Uses optimistic UI for findings/evidence until GET endpoints exist.

Design goals:
- Same 3-column “worldclass” layout pattern as Dental/Physio/ENT/STD
- Neutral, respectful language
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

const CONTEXTS = [
  { key: 'intake', label: 'Intake' },
  { key: 'follow_up', label: 'Follow-up' },
  { key: 'harm_reduction', label: 'Harm reduction' },
] as const;

type ContextKey = (typeof CONTEXTS)[number]['key'];

const FINDING_TYPES = [
  { key: 'substance_use_history', label: 'Substance use history' },
  { key: 'withdrawal_risk', label: 'Withdrawal risk' },
  { key: 'intoxication_risk', label: 'Intoxication risk' },
  { key: 'craving_severity', label: 'Craving severity' },
  { key: 'overdose_risk', label: 'Overdose risk' },
  { key: 'mental_health_screen', label: 'Mental health screen' },
  { key: 'medical_comorbidity', label: 'Medical comorbidity' },
  { key: 'treatment_plan', label: 'Treatment plan' },
  { key: 'medication_support', label: 'Medication support' },
  { key: 'counselling_support', label: 'Counselling / support' },
  { key: 'safety_plan', label: 'Safety plan' },
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

export default function SubstanceAbuseWorkspacePage(props: Props) {
  const patientId = props.patientId ?? 'pat_demo_001';
  const encounterId = props.encounterId ?? 'enc_demo_001';
  const clinicianId = props.clinicianId ?? 'clin_demo_001';

  const [context, setContext] = useState<ContextKey>('intake');

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

  // Phase-1 capture (local-only)
  const [substances, setSubstances] = useState({
    alcohol: false,
    nicotine: false,
    cannabis: false,
    opioids: false,
    stimulants: false,
    sedatives: false,
    other: false,
  });
  const [usePattern, setUsePattern] = useState({
    daily: false,
    binge: false,
    weekend: false,
    intermittent: false,
  });
  const [risk, setRisk] = useState({
    withdrawal: false,
    overdose: false,
    impairedDriving: false,
    unsafeSex: false,
    housingInstability: false,
  });
  const [readiness, setReadiness] = useState<'not_ready' | 'unsure' | 'ready'>('unsure');
  const [craving0to10, setCraving0to10] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  const toggle = <T extends Record<string, boolean>>(setter: React.Dispatch<React.SetStateAction<T>>, key: keyof T) => {
    setter((s) => ({ ...s, [key]: !s[key] }));
  };

  // Location helper (may not exist in shared union; safe cast)
  const locationForContext = (c: ContextKey): Location => {
    const loc = { kind: 'substance_use' as const, context: c };
    return loc as unknown as Location;
  };

  const findingsForContext = useMemo(() => {
    return findings
      .filter((f) => {
        const loc = f.location as unknown as Record<string, unknown> | null;
        const kind = loc?.kind;
        const ctx = loc?.context;
        if (kind === 'substance_use' && (ctx === 'intake' || ctx === 'follow_up' || ctx === 'harm_reduction')) return ctx === context;
        return true;
      })
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [findings, context]);

  const evidenceForContext = useMemo(() => {
    return evidence
      .filter((ev) => {
        const loc = ev.location as unknown as Record<string, unknown> | null;
        const kind = loc?.kind;
        const ctx = loc?.context;
        if (kind === 'substance_use' && (ctx === 'intake' || ctx === 'follow_up' || ctx === 'harm_reduction')) return ctx === context;
        return true;
      })
      .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
  }, [evidence, context]);

  const contextCounts = useMemo(() => {
    const c = { intake: 0, follow_up: 0, harm_reduction: 0 } as Record<ContextKey, number>;
    for (const f of findings) {
      const loc = f.location as unknown as Record<string, unknown> | null;
      if (loc?.kind === 'substance_use' && (loc?.context === 'intake' || loc?.context === 'follow_up' || loc?.context === 'harm_reduction')) {
        c[loc.context] += 1;
      }
    }
    return c;
  }, [findings]);

  const evidenceCountForFinding = (findingId: string) => evidence.filter((e) => e.findingId === findingId).length;

  const createManualFinding = async (type: FindingTypeKey, severity?: Finding['severity'], note?: string) => {
    const title = FINDING_TYPES.find((x) => x.key === type)?.label ?? 'Finding';
    const location = locationForContext(context);

    const optimisticId = tmpId('fd');
    const optimistic: Finding = {
      id: optimisticId,
      patientId,
      encounterId,
      specialty: 'substance-abuse',
      status: 'draft',
      title,
      note: note?.trim() ? note.trim() : undefined,
      severity,
      tags: ['substance_use', context],
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
        specialty: 'substance-abuse',
        title,
        status: 'draft',
        severity,
        note: note?.trim() ? note.trim() : undefined,
        tags: ['substance_use', context],
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
    const location = locationForContext(context);

    setBanner(null);
    setBusy(true);

    try {
      const createdFinding = await postFinding({
        patientId,
        encounterId,
        specialty: 'substance-abuse',
        title,
        status: 'draft',
        severity: payload.severity,
        note: payload.note,
        tags: ['substance_use', context, 'bookmark'],
        location,
        createdBy: clinicianId,
      });
      setFindings((prev) => [createdFinding, ...prev]);

      const snapshot = await postEvidence({
        patientId,
        encounterId,
        specialty: 'substance-abuse',
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
          url: `https://placehold.co/1200x800?text=Intake+Snapshot+(${context.toUpperCase()})`,
          thumbnailUrl: `https://placehold.co/320x200?text=Snapshot+(${context.toUpperCase()})`,
          contentType: 'image/jpeg',
        },
        status: 'ready',
      });

      const t = Date.now();
      const clip = await postEvidence({
        patientId,
        encounterId,
        specialty: 'substance-abuse',
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
          thumbnailUrl: `https://placehold.co/320x200?text=Clip+(${context.toUpperCase()})`,
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
        specialty: 'substance-abuse',
        evidenceId: selectedEvidence.id,
        findingId: selectedEvidence.findingId ?? null,
        location: selectedEvidence.location,
        type: 'pin',
        payload: { x: 0.53, y: 0.44, label: 'Observation' },
        createdBy: clinicianId,
      });

      setBanner({ kind: 'success', text: 'Annotation created (demo pin).' });
    } catch (e) {
      setBanner({ kind: 'error', text: `Failed to create annotation: ${errMsg(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const intakeSummary = useMemo(() => {
    const subs = Object.entries(substances)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(', ');
    const pat = Object.entries(usePattern)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(', ');
    const r = Object.entries(risk)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(', ');
    return {
      subs: subs || '—',
      pat: pat || '—',
      r: r || '—',
      craving: typeof craving0to10 === 'number' ? `${craving0to10}/10` : '—',
      readiness:
        readiness === 'ready' ? 'Ready' : readiness === 'unsure' ? 'Unsure' : 'Not ready',
    };
  }, [substances, usePattern, risk, craving0to10, readiness]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm text-gray-500">Ambulant+ Workspace</div>
            <h1 className="text-lg font-semibold">Substance Use Workspace</h1>
            <div className="mt-1 text-xs text-gray-500">
              Phase 1 · Respectful intake + risk + evidence + plan stub
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
              Context: <span className="font-mono font-semibold">{context.replace('_', ' ').toUpperCase()}</span>
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
              <div className="text-sm font-semibold">Intake Snapshot</div>
              <div className="text-xs text-gray-500">Context + screening summary</div>
            </div>

            <div className="p-4 space-y-4">
              <TogglePills<ContextKey>
                value={context}
                onChange={setContext}
                items={CONTEXTS.map((c) => ({ key: c.key, label: c.label }))}
                counts={contextCounts}
              />

              <div className="rounded-lg border p-3">
                <div className="text-xs font-semibold text-gray-700">Substances</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(
                    [
                      ['alcohol', 'Alcohol'],
                      ['nicotine', 'Nicotine'],
                      ['cannabis', 'Cannabis'],
                      ['opioids', 'Opioids'],
                      ['stimulants', 'Stimulants'],
                      ['sedatives', 'Sedatives'],
                      ['other', 'Other'],
                    ] as const
                  ).map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={substances[k]} onChange={() => toggle(setSubstances, k)} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="text-xs font-semibold text-gray-700">Use pattern</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(
                    [
                      ['daily', 'Daily'],
                      ['binge', 'Binge'],
                      ['weekend', 'Weekend'],
                      ['intermittent', 'Intermittent'],
                    ] as const
                  ).map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={usePattern[k]} onChange={() => toggle(setUsePattern, k)} />
                      {label}
                    </label>
                  ))}
                </div>

                <div className="mt-3">
                  <div className="text-xs font-semibold text-gray-700">Craving (0–10)</div>
                  <input
                    className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                    inputMode="numeric"
                    value={craving0to10}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      if (v === '') return setCraving0to10('');
                      const n = Number(v);
                      if (!Number.isFinite(n)) return;
                      setCraving0to10(Math.max(0, Math.min(10, Math.round(n))));
                    }}
                    placeholder="e.g., 6"
                  />
                </div>

                <div className="mt-3">
                  <div className="text-xs font-semibold text-gray-700">Readiness</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(
                      [
                        ['not_ready', 'Not ready'],
                        ['unsure', 'Unsure'],
                        ['ready', 'Ready'],
                      ] as const
                    ).map(([k, label]) => (
                      <button
                        key={k}
                        type="button"
                        className={
                          'px-3 py-1.5 rounded-full border text-xs ' +
                          (readiness === k
                            ? 'border-blue-300 bg-blue-50 text-blue-800'
                            : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700')
                        }
                        onClick={() => setReadiness(k)}
                        aria-pressed={readiness === k}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="text-xs font-semibold text-gray-700">Risk flags</div>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {(
                    [
                      ['withdrawal', 'Withdrawal risk'],
                      ['overdose', 'Overdose risk'],
                      ['impairedDriving', 'Impaired driving risk'],
                      ['unsafeSex', 'Higher-risk sexual exposure'],
                      ['housingInstability', 'Housing instability'],
                    ] as const
                  ).map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={risk[k]} onChange={() => toggle(setRisk, k)} />
                      {label}
                    </label>
                  ))}
                </div>

                <label className="mt-3 block text-xs text-gray-600">
                  Notes
                  <textarea
                    className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes…"
                  />
                </label>
              </div>

              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700">Summary</div>
                <div className="mt-2 text-sm text-gray-700 space-y-1">
                  <div>
                    Substances: <span className="font-mono font-semibold">{intakeSummary.subs}</span>
                  </div>
                  <div>
                    Pattern: <span className="font-mono font-semibold">{intakeSummary.pat}</span>
                  </div>
                  <div>
                    Risks: <span className="font-mono font-semibold">{intakeSummary.r}</span>
                  </div>
                  <div>
                    Craving: <span className="font-mono font-semibold">{intakeSummary.craving}</span>
                  </div>
                  <div>
                    Readiness: <span className="font-mono font-semibold">{intakeSummary.readiness}</span>
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-gray-500">
                  Phase 2: validated questionnaires + structured scoring + longitudinal view.
                </div>
              </div>

              <div className="rounded-lg border bg-white p-3">
                <div className="text-xs font-semibold text-gray-700">Findings ({context.replace('_', ' ')})</div>
                <div className="mt-2">
                  {findingsForContext.length === 0 ? (
                    <div className="text-sm text-gray-600 italic">No findings captured yet.</div>
                  ) : (
                    <ul className="space-y-2">
                      {findingsForContext.slice(0, 6).map((f) => (
                        <li key={f.id}>
                          <FindingCard finding={f} evidenceCount={evidenceCountForFinding(f.id)} onToggleFinal={undefined} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {findingsForContext.length > 6 ? (
                  <div className="mt-2 text-[11px] text-gray-500">Showing latest 6. Phase 2 adds timeline + filters.</div>
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
                        <div className="mt-2 text-xs text-gray-500">(Playback wired once real clip URLs are returned.)</div>
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
                <div className="text-xs font-semibold text-gray-700">Evidence ({context.replace('_', ' ').toUpperCase()})</div>
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

              <WorkspaceEvidenceStrip evidence={evidenceForContext} onSelect={(ev) => setSelectedEvidenceId(ev.id)} />

              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700">Compare (MVP-2)</div>
                <div className="mt-1 text-sm text-gray-700">Later: compare prior visits, relapse triggers, and goals.</div>
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
              <div className="text-xs text-gray-500">Actions + goals (Phase 2 adds tasks, referrals, orders)</div>
            </div>

            <div className="p-4 space-y-4">
              <QuickFindingComposer onCreate={createManualFinding} disabled={busy} />

              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700">Plan (stub)</div>
                <ul className="mt-2 text-sm text-gray-700 list-disc pl-5 space-y-1">
                  <li>Discuss goals and readiness; agree on next steps.</li>
                  <li>Safety planning and harm reduction where appropriate.</li>
                  <li>Referral to counselling/support or medical review if needed.</li>
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
                <div className="text-xs font-semibold text-gray-700">Goals (Phase 2)</div>
                <div className="mt-1 text-sm text-gray-700">
                  Coming next: track goals over time (craving score, days abstinent, attendance).
                </div>
                <button
                  className="mt-2 text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
                  onClick={() => alert('Stub: add goal')}
                  type="button"
                >
                  + Add goal
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      <BookmarkModal
        open={bookmarkOpen}
        onClose={() => setBookmarkOpen(false)}
        title={`Bookmark (${context.replace('_', ' ')})`}
        description="Creates a finding + captures snapshot + clip as evidence"
        findingTypes={FINDING_TYPES.map((x) => ({ key: x.key, label: x.label }))}
        defaultTypeKey={context === 'intake' ? 'substance_use_history' : context === 'follow_up' ? 'treatment_plan' : 'overdose_risk'}
        onSave={handleBookmark}
      />
    </div>
  );
}

function QuickFindingComposer(props: {
  onCreate: (type: FindingTypeKey, severity?: 'mild' | 'moderate' | 'severe', note?: string) => Promise<void>;
  disabled?: boolean;
}) {
  const { onCreate, disabled } = props;

  const [type, setType] = useState<FindingTypeKey>('substance_use_history');
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
