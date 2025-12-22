/*
File: apps/clinician-app/app/workspaces/occupational-therapy/page.tsx
Purpose: Occupational Therapy workspace (wired to POST /findings, /evidence, /annotations)

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

type OTDomain =
  | 'ADL'
  | 'IADL'
  | 'FINE_MOTOR'
  | 'GROSS_MOTOR'
  | 'SENSORY'
  | 'COGNITION'
  | 'EXEC_FUNCTION'
  | 'WORK_SCHOOL'
  | 'ENVIRONMENT'
  | 'GENERAL';

const DOMAINS: { key: OTDomain; label: string }[] = [
  { key: 'GENERAL', label: 'General' },
  { key: 'ADL', label: 'ADLs' },
  { key: 'IADL', label: 'IADLs' },
  { key: 'FINE_MOTOR', label: 'Fine motor' },
  { key: 'GROSS_MOTOR', label: 'Gross motor' },
  { key: 'SENSORY', label: 'Sensory' },
  { key: 'COGNITION', label: 'Cognition' },
  { key: 'EXEC_FUNCTION', label: 'Executive function' },
  { key: 'WORK_SCHOOL', label: 'Work/School' },
  { key: 'ENVIRONMENT', label: 'Environment' },
];

const FINDING_TYPES = [
  { key: 'adl_limit', label: 'ADL limitation' },
  { key: 'iadl_limit', label: 'IADL limitation' },
  { key: 'fine_motor', label: 'Fine motor difficulty' },
  { key: 'gross_motor', label: 'Gross motor difficulty' },
  { key: 'sensory_processing', label: 'Sensory processing concern' },
  { key: 'attention_memory', label: 'Attention / memory concern' },
  { key: 'executive_function', label: 'Executive function concern' },
  { key: 'fatigue_endurance', label: 'Fatigue / endurance limitation' },
  { key: 'pain_function', label: 'Pain limiting function' },
  { key: 'safety_risk', label: 'Safety risk identified' },
  { key: 'environment_barrier', label: 'Environmental barrier' },
  { key: 'other', label: 'Other' },
] as const;

type FindingTypeKey = (typeof FINDING_TYPES)[number]['key'];

type OccupationalTherapyWorkspaceProps = {
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

function domainHint(d: OTDomain) {
  switch (d) {
    case 'ADL':
      return 'Self-care: bathing, dressing, feeding, toileting.';
    case 'IADL':
      return 'Home/community: cooking, shopping, finances, transport.';
    case 'FINE_MOTOR':
      return 'Dexterity, grasp, handwriting, manipulation.';
    case 'GROSS_MOTOR':
      return 'Transfers, balance, mobility in functional tasks.';
    case 'SENSORY':
      return 'Sensory modulation/processing; hypersensitivity/avoidance.';
    case 'COGNITION':
      return 'Orientation, memory, attention impacting daily function.';
    case 'EXEC_FUNCTION':
      return 'Planning, sequencing, problem solving, self-monitoring.';
    case 'WORK_SCHOOL':
      return 'Participation: work tasks, classroom demands, ergonomics.';
    case 'ENVIRONMENT':
      return 'Home setup, accessibility, assistive devices, barriers.';
    default:
      return 'Overall occupational performance and priorities.';
  }
}

export default function OccupationalTherapyWorkspacePage(props: OccupationalTherapyWorkspaceProps) {
  const patientId = props.patientId ?? 'pat_demo_001';
  const encounterId = props.encounterId ?? 'enc_demo_001';
  const clinicianId = props.clinicianId ?? 'clin_demo_001';

  const [domain, setDomain] = useState<OTDomain>('GENERAL');

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

  // Mini “OT template” (MVP-lite) — stored in meta for now
  const [template, setTemplate] = useState({
    primaryOccupation: '',
    priorityADLs: [] as string[],
    assistiveDevices: '',
    homeSafetyRisks: {
      fallsRisk: false,
      poorLighting: false,
      clutter: false,
      bathroomAccess: false,
    },
    functionRatings0to10: {
      selfCare: '' as string,
      mobility: '' as string,
      productivity: '' as string,
      leisure: '' as string,
    },
    notes: '',
  });

  const countsByDomain = useMemo(() => {
    const c = {
      ADL: 0,
      IADL: 0,
      FINE_MOTOR: 0,
      GROSS_MOTOR: 0,
      SENSORY: 0,
      COGNITION: 0,
      EXEC_FUNCTION: 0,
      WORK_SCHOOL: 0,
      ENVIRONMENT: 0,
      GENERAL: 0,
    } as Record<OTDomain, number>;

    for (const f of findings) {
      if ((f.location as any)?.kind !== 'ot_domain') continue;
      const d = (f.location as any)?.domain as OTDomain | undefined;
      if (d && d in c) c[d] += 1;
    }
    return c;
  }, [findings]);

  const locationForDomain = (d: OTDomain): Location => ({ kind: 'ot_domain', domain: d } as any);

  const findingsForDomain = useMemo(() => {
    return findings
      .filter((f) => (f.location as any)?.kind === 'ot_domain')
      .filter((f) => (f.location as any)?.domain === domain)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [findings, domain]);

  const evidenceForDomain = useMemo(() => {
    return evidence
      .filter((ev) => (ev.location as any)?.kind === 'ot_domain')
      .filter((ev) => (ev.location as any)?.domain === domain)
      .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
  }, [evidence, domain]);

  const evidenceCountForFinding = (findingId: string) => evidence.filter((e) => e.findingId === findingId).length;

  const createManualFinding = async (type: FindingTypeKey, severity?: Finding['severity'], note?: string) => {
    const title = FINDING_TYPES.find((x) => x.key === type)?.label ?? 'Finding';
    const location = locationForDomain(domain);

    const meta = { domain, template };

    // optimistic finding
    const optimisticId = tmpId('fd');
    const optimistic: Finding = {
      id: optimisticId,
      patientId,
      encounterId,
      specialty: 'occupational_therapy',
      status: 'draft',
      title,
      note: note?.trim() ? note.trim() : undefined,
      severity,
      tags: ['occupational-therapy', `domain:${domain.toLowerCase()}`],
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
        specialty: 'occupational_therapy',
        title,
        status: 'draft',
        severity,
        note: note?.trim() ? note.trim() : undefined,
        tags: ['occupational-therapy', `domain:${domain.toLowerCase()}`],
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
    const location = locationForDomain(domain);
    const meta = { domain, template };

    setBanner(null);
    setBusy(true);

    try {
      // 1) Create finding
      const createdFinding = await postFinding({
        patientId,
        encounterId,
        specialty: 'occupational_therapy',
        title,
        status: 'draft',
        severity: payload.severity,
        note: payload.note,
        tags: ['occupational-therapy', 'bookmark', `domain:${domain.toLowerCase()}`],
        location,
        createdBy: clinicianId,
        meta,
      });
      setFindings((prev) => [createdFinding, ...prev]);

      // 2) Snapshot evidence (ready) — e.g., ADL setup photo, posture snapshot, home safety pic
      const snapshotLabel = `OT Snapshot (${domain})`;
      const snapshot = await postEvidence({
        patientId,
        encounterId,
        specialty: 'occupational_therapy',
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

      // 3) Clip evidence (processing) — short functional task clip (transfer, reach, fine motor task)
      const t = Date.now();
      const clipLabel = `OT Clip (${domain})`;

      const clip = await postEvidence({
        patientId,
        encounterId,
        specialty: 'occupational_therapy',
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
          url: 'https://example.invalid/ot-clip.mp4',
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
        specialty: 'occupational_therapy',
        evidenceId: selectedEvidence.id,
        findingId: selectedEvidence.findingId ?? null,
        location: selectedEvidence.location,
        type: 'pin',
        payload: {
          x: 0.52,
          y: 0.4,
          label: 'Barrier / cue point',
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
            <h1 className="text-lg font-semibold">Occupational Therapy Workspace</h1>
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
              <div className="text-sm font-semibold">Domains</div>
              <div className="text-xs text-gray-500">Select a domain and review findings</div>
            </div>

            <div className="p-4 space-y-4">
              <TogglePills<OTDomain> value={domain} onChange={setDomain} items={DOMAINS} counts={countsByDomain as any} />

              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700">Selected</div>
                <div className="mt-1 text-sm text-gray-800">
                  Domain: <span className="font-mono font-semibold">{domain}</span>
                </div>
                <div className="mt-1 text-xs text-gray-500">{domainHint(domain)}</div>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-700">Domain Findings</div>
                <div className="mt-2">
                  {findingsForDomain.length === 0 ? (
                    <div className="text-sm text-gray-600 italic">No findings for this domain yet.</div>
                  ) : (
                    <ul className="space-y-2">
                      {findingsForDomain.map((f) => (
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
                <div className="text-sm font-semibold">Functional Media</div>
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
                      <div className="text-sm font-medium">Live Task View (placeholder)</div>
                      <div className="text-xs text-gray-500 mt-1">Select evidence below to preview</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs font-semibold text-gray-700">
                  Evidence for <span className="font-mono">{domain}</span>
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

              <WorkspaceEvidenceStrip evidence={evidenceForDomain} onSelect={(ev) => setSelectedEvidenceId(ev.id)} />

              <div className="mt-4 rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700">Compare (MVP-2)</div>
                <div className="mt-1 text-sm text-gray-700">
                  Later: compare home visit photos/videos, before/after device setup, progress clips.
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
              <div className="text-xs text-gray-500">Quick OT template + manual finding</div>
            </div>

            <div className="p-4 space-y-4">
              <OTTemplate template={template} setTemplate={setTemplate} disabled={busy} />
              <QuickFindingComposer onCreate={createManualFinding} disabled={busy} />

              <div className="rounded-lg border p-3 bg-gray-50">
                <div className="text-xs font-semibold text-gray-700">Plan (stub)</div>
                <div className="mt-1 text-sm text-gray-700">
                  Coming next: goals, home program, equipment recommendations, referral tasks.
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
        title={`Bookmark (${domain})`}
        description="Creates a finding + captures snapshot + clip as evidence"
        findingTypes={FINDING_TYPES.map((x) => ({ key: x.key, label: x.label }))}
        defaultTypeKey={domain === 'ADL' ? 'adl_limit' : domain === 'IADL' ? 'iadl_limit' : 'fine_motor'}
        onSave={handleBookmark}
      />
    </div>
  );
}

/* -------------------- right-side components -------------------- */

function OTTemplate(props: {
  template: {
    primaryOccupation: string;
    priorityADLs: string[];
    assistiveDevices: string;
    homeSafetyRisks: {
      fallsRisk: boolean;
      poorLighting: boolean;
      clutter: boolean;
      bathroomAccess: boolean;
    };
    functionRatings0to10: {
      selfCare: string;
      mobility: string;
      productivity: string;
      leisure: string;
    };
    notes: string;
  };
  setTemplate: (v: any) => void;
  disabled?: boolean;
}) {
  const { template, setTemplate, disabled } = props;

  const toggleRisk = (k: keyof typeof template['homeSafetyRisks']) =>
    setTemplate({ ...template, homeSafetyRisks: { ...template.homeSafetyRisks, [k]: !template.homeSafetyRisks[k] } });

  const addADL = (v: string) => {
    const t = v.trim();
    if (!t) return;
    if (template.priorityADLs.includes(t)) return;
    setTemplate({ ...template, priorityADLs: [t, ...template.priorityADLs].slice(0, 8) });
  };

  const removeADL = (t: string) =>
    setTemplate({ ...template, priorityADLs: template.priorityADLs.filter((x) => x !== t) });

  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-semibold text-gray-700">OT Template (MVP-lite)</div>

      <div className="mt-2 grid grid-cols-1 gap-2">
        <label className="text-xs text-gray-600">
          Primary occupation / role
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={template.primaryOccupation}
            onChange={(e) => setTemplate({ ...template, primaryOccupation: e.target.value })}
            placeholder="e.g., student, office worker, caregiver"
            disabled={disabled}
          />
        </label>

        <div className="rounded-lg border bg-gray-50 p-3">
          <div className="text-xs font-semibold text-gray-700">Priority tasks (ADL/IADL)</div>
          <div className="mt-2 flex gap-2">
            <input
              className="flex-1 rounded border px-2 py-1.5 text-sm bg-white"
              placeholder="Add a task (e.g., dressing, cooking)…"
              disabled={disabled}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addADL((e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).value = '';
                }
              }}
            />
            <button
              className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
              type="button"
              disabled={disabled}
              onClick={() => {
                const el = document.activeElement as HTMLInputElement | null;
                if (!el) return;
              }}
              title="Press Enter in the input to add"
            >
              Add
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {template.priorityADLs.length === 0 ? (
              <div className="text-sm text-gray-600 italic">No tasks added yet.</div>
            ) : (
              template.priorityADLs.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="text-xs rounded-full border bg-white px-2.5 py-1 hover:bg-gray-50"
                  onClick={() => removeADL(t)}
                  disabled={disabled}
                  title="Remove"
                >
                  {t} <span className="text-gray-400">×</span>
                </button>
              ))
            )}
          </div>
          <div className="mt-2 text-[11px] text-gray-500">Tip: click a tag to remove it.</div>
        </div>

        <label className="text-xs text-gray-600">
          Assistive devices (current)
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={template.assistiveDevices}
            onChange={(e) => setTemplate({ ...template, assistiveDevices: e.target.value })}
            placeholder="e.g., cane, shower chair, wrist splint"
            disabled={disabled}
          />
        </label>

        <div className="rounded-lg border bg-gray-50 p-3">
          <div className="text-xs font-semibold text-gray-700">Home safety risks</div>
          <div className="mt-2 grid grid-cols-1 gap-2">
            {(
              [
                ['fallsRisk', 'Falls risk'],
                ['poorLighting', 'Poor lighting'],
                ['clutter', 'Clutter / trip hazards'],
                ['bathroomAccess', 'Bathroom access issues'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={template.homeSafetyRisks[k]} onChange={() => toggleRisk(k)} disabled={disabled} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-gray-50 p-3">
          <div className="text-xs font-semibold text-gray-700">Function ratings (0–10)</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                ['selfCare', 'Self-care'],
                ['mobility', 'Mobility'],
                ['productivity', 'Productivity'],
                ['leisure', 'Leisure'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="text-xs text-gray-600">
                {label}
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                  value={template.functionRatings0to10[k]}
                  onChange={(e) =>
                    setTemplate({
                      ...template,
                      functionRatings0to10: { ...template.functionRatings0to10, [k]: e.target.value.replace(/[^\d]/g, '').slice(0, 2) },
                    })
                  }
                  placeholder="0–10"
                  disabled={disabled}
                />
              </label>
            ))}
          </div>
        </div>

        <label className="text-xs text-gray-600">
          Notes
          <textarea
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            rows={2}
            value={template.notes}
            onChange={(e) => setTemplate({ ...template, notes: e.target.value })}
            placeholder="Optional details…"
            disabled={disabled}
          />
        </label>
      </div>

      <div className="mt-2 text-[11px] text-gray-500">
        Later: persist these as structured OT observations + outcome measures (COPM, FIM-lite).
      </div>
    </div>
  );
}

function QuickFindingComposer(props: {
  onCreate: (type: FindingTypeKey, severity?: 'mild' | 'moderate' | 'severe', note?: string) => Promise<void>;
  disabled?: boolean;
}) {
  const { onCreate, disabled } = props;

  const [type, setType] = useState<FindingTypeKey>('adl_limit');
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
