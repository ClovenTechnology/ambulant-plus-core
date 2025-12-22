/*
File: apps/clinician-app/app/workspaces/speech-therapy/page.tsx
Purpose: Speech Therapy workspace (wired to POST /findings, /evidence, /annotations)

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

type Domain = 'ARTICULATION' | 'LANGUAGE' | 'FLUENCY' | 'VOICE' | 'SWALLOWING' | 'COGNITION' | 'GENERAL';

const DOMAINS: { key: Domain; label: string }[] = [
  { key: 'GENERAL', label: 'General' },
  { key: 'ARTICULATION', label: 'Articulation' },
  { key: 'LANGUAGE', label: 'Language' },
  { key: 'FLUENCY', label: 'Fluency' },
  { key: 'VOICE', label: 'Voice' },
  { key: 'SWALLOWING', label: 'Swallowing' },
  { key: 'COGNITION', label: 'Cognition/Comm' },
];

const FINDING_TYPES = [
  { key: 'articulation_error', label: 'Articulation errors (phoneme)' },
  { key: 'phonological_process', label: 'Phonological process suspected' },
  { key: 'expressive_language_delay', label: 'Expressive language delay' },
  { key: 'receptive_language_delay', label: 'Receptive language delay' },
  { key: 'stuttering', label: 'Stuttering / dysfluency' },
  { key: 'voice_quality_change', label: 'Voice quality change' },
  { key: 'hypernasality', label: 'Resonance: hypernasality' },
  { key: 'hyponasality', label: 'Resonance: hyponasality' },
  { key: 'dysphagia_risk', label: 'Swallowing concern / dysphagia risk' },
  { key: 'cough_throat_clear', label: 'Cough / throat clear with intake' },
  { key: 'cognitive_comm', label: 'Cognitive-communication concern' },
  { key: 'other', label: 'Other' },
] as const;

type FindingTypeKey = (typeof FINDING_TYPES)[number]['key'];

type SpeechTherapyWorkspaceProps = {
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

function domainHint(d: Domain) {
  switch (d) {
    case 'ARTICULATION':
      return 'Speech sound production: errors, intelligibility, motor planning.';
    case 'LANGUAGE':
      return 'Receptive/expressive language: comprehension, vocabulary, grammar.';
    case 'FLUENCY':
      return 'Stuttering and related dysfluency patterns.';
    case 'VOICE':
      return 'Quality, pitch, loudness, resonance, fatigue.';
    case 'SWALLOWING':
      return 'Oral intake safety: cough, wet voice, aspiration risk.';
    case 'COGNITION':
      return 'Attention, memory, executive function affecting communication.';
    default:
      return 'Overall communication and functional goals.';
  }
}

export default function SpeechTherapyWorkspacePage(props: SpeechTherapyWorkspaceProps) {
  const patientId = props.patientId ?? 'pat_demo_001';
  const encounterId = props.encounterId ?? 'enc_demo_001';
  const clinicianId = props.clinicianId ?? 'clin_demo_001';

  const [domain, setDomain] = useState<Domain>('GENERAL');

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

  // Mini “exam template” (MVP-lite) — kept in meta for now
  const [template, setTemplate] = useState({
    chiefConcern: '',
    caregiverPresent: false,
    sessionType: 'assessment' as 'assessment' | 'therapy',
    intelligibility0to100: '' as string,
    baselineNotes: '',
    swallowingRedFlags: {
      coughWithThin: false,
      wetVoice: false,
      weightLoss: false,
      recurrentChestInfections: false,
    },
  });

  const countsByDomain = useMemo(() => {
    const c = {
      ARTICULATION: 0,
      LANGUAGE: 0,
      FLUENCY: 0,
      VOICE: 0,
      SWALLOWING: 0,
      COGNITION: 0,
      GENERAL: 0,
    } as Record<Domain, number>;

    for (const f of findings) {
      if ((f.location as any)?.kind !== 'speech_domain') continue;
      const d = (f.location as any)?.domain as Domain | undefined;
      if (d && d in c) c[d] += 1;
    }
    return c;
  }, [findings]);

  const locationForDomain = (d: Domain): Location => ({ kind: 'speech_domain', domain: d } as any);

  const findingsForDomain = useMemo(() => {
    return findings
      .filter((f) => (f.location as any)?.kind === 'speech_domain')
      .filter((f) => (f.location as any)?.domain === domain)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [findings, domain]);

  const evidenceForDomain = useMemo(() => {
    return evidence
      .filter((ev) => (ev.location as any)?.kind === 'speech_domain')
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
      specialty: 'speech_therapy',
      status: 'draft',
      title,
      note: note?.trim() ? note.trim() : undefined,
      severity,
      tags: ['speech-therapy', `domain:${domain.toLowerCase()}`],
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
        specialty: 'speech_therapy',
        title,
        status: 'draft',
        severity,
        note: note?.trim() ? note.trim() : undefined,
        tags: ['speech-therapy', `domain:${domain.toLowerCase()}`],
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
        specialty: 'speech_therapy',
        title,
        status: 'draft',
        severity: payload.severity,
        note: payload.note,
        tags: ['speech-therapy', 'bookmark', `domain:${domain.toLowerCase()}`],
        location,
        createdBy: clinicianId,
        meta,
      });
      setFindings((prev) => [createdFinding, ...prev]);

      // 2) Snapshot evidence (ready) — think “screen grab” of waveform / mouth posture / worksheet
      const snapshotLabel = `Speech Snapshot (${domain})`;
      const snapshot = await postEvidence({
        patientId,
        encounterId,
        specialty: 'speech_therapy',
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

      // 3) Clip evidence (processing) — voice sample / swallowing trial short clip
      const t = Date.now();
      const clipLabel = `Speech Clip (${domain})`;

      const clip = await postEvidence({
        patientId,
        encounterId,
        specialty: 'speech_therapy',
        findingId: createdFinding.id,
        location,
        source: {
          type: 'live_capture',
          device: 'microphone',
          roomId: undefined,
          trackId: undefined,
          startTs: t - 2500,
          endTs: t + 9500,
        },
        media: {
          kind: 'video_clip',
          url: 'https://example.invalid/speech-clip.mp4',
          thumbnailUrl: `https://placehold.co/320x200?text=${encodeURIComponent(clipLabel)}`,
          contentType: 'video/mp4',
          startTs: t - 2500,
          endTs: t + 9500,
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
        specialty: 'speech_therapy',
        evidenceId: selectedEvidence.id,
        findingId: selectedEvidence.findingId ?? null,
        location: selectedEvidence.location,
        type: 'pin',
        payload: {
          x: 0.5,
          y: 0.4,
          label: 'Target segment / cue',
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
            <h1 className="text-lg font-semibold">Speech Therapy Workspace</h1>
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
              <TogglePills<Domain> value={domain} onChange={setDomain} items={DOMAINS} counts={countsByDomain as any} />

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
                <div className="text-sm font-semibold">Session Media</div>
                <div className="text-xs text-gray-500">Audio/video capture + bookmark (SFU later)</div>
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
                      <div className="text-sm font-medium">Live Session View (placeholder)</div>
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
                  Later: compare baseline vs progress clips, and attach scores (e.g., % intelligibility).
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
              <div className="text-xs text-gray-500">Quick SLP template + manual finding</div>
            </div>

            <div className="p-4 space-y-4">
              <SLPTemplate template={template} setTemplate={setTemplate} disabled={busy} />
              <QuickFindingComposer onCreate={createManualFinding} disabled={busy} />

              <div className="rounded-lg border p-3 bg-gray-50">
                <div className="text-xs font-semibold text-gray-700">Plan (stub)</div>
                <div className="mt-1 text-sm text-gray-700">
                  Coming next: goals, home program, session schedule, caregiver coaching tasks.
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
        defaultTypeKey={domain === 'VOICE' ? 'voice_quality_change' : domain === 'FLUENCY' ? 'stuttering' : 'articulation_error'}
        onSave={handleBookmark}
      />
    </div>
  );
}

/* -------------------- right-side components -------------------- */

function SLPTemplate(props: {
  template: {
    chiefConcern: string;
    caregiverPresent: boolean;
    sessionType: 'assessment' | 'therapy';
    intelligibility0to100: string;
    baselineNotes: string;
    swallowingRedFlags: {
      coughWithThin: boolean;
      wetVoice: boolean;
      weightLoss: boolean;
      recurrentChestInfections: boolean;
    };
  };
  setTemplate: (v: any) => void;
  disabled?: boolean;
}) {
  const { template, setTemplate, disabled } = props;

  const toggle = (k: keyof typeof template['swallowingRedFlags']) =>
    setTemplate({
      ...template,
      swallowingRedFlags: { ...template.swallowingRedFlags, [k]: !template.swallowingRedFlags[k] },
    });

  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-semibold text-gray-700">SLP Template (MVP-lite)</div>

      <div className="mt-2 grid grid-cols-1 gap-2">
        <label className="text-xs text-gray-600">
          Session type
          <select
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={template.sessionType}
            onChange={(e) => setTemplate({ ...template, sessionType: e.target.value as any })}
            disabled={disabled}
          >
            <option value="assessment">Assessment</option>
            <option value="therapy">Therapy</option>
          </select>
        </label>

        <label className="text-xs text-gray-600">
          Chief concern
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={template.chiefConcern}
            onChange={(e) => setTemplate({ ...template, chiefConcern: e.target.value })}
            placeholder="e.g., unclear speech, stuttering, swallowing difficulty"
            disabled={disabled}
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={template.caregiverPresent}
            onChange={() => setTemplate({ ...template, caregiverPresent: !template.caregiverPresent })}
            disabled={disabled}
          />
          Caregiver present
        </label>

        <label className="text-xs text-gray-600">
          Intelligibility (0–100)
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={template.intelligibility0to100}
            onChange={(e) => setTemplate({ ...template, intelligibility0to100: e.target.value.replace(/[^\d]/g, '').slice(0, 3) })}
            placeholder="e.g., 70"
            disabled={disabled}
          />
        </label>

        <label className="text-xs text-gray-600">
          Baseline notes
          <textarea
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            rows={2}
            value={template.baselineNotes}
            onChange={(e) => setTemplate({ ...template, baselineNotes: e.target.value })}
            placeholder="Brief baseline summary…"
            disabled={disabled}
          />
        </label>
      </div>

      <div className="mt-3 rounded-lg border bg-gray-50 p-3">
        <div className="text-xs font-semibold text-gray-700">Swallowing red flags</div>
        <div className="mt-2 grid grid-cols-1 gap-2">
          {(
            [
              ['coughWithThin', 'Cough with thin liquids'],
              ['wetVoice', 'Wet/gurgly voice after swallow'],
              ['weightLoss', 'Unintentional weight loss'],
              ['recurrentChestInfections', 'Recurrent chest infections'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={template.swallowingRedFlags[k]} onChange={() => toggle(k)} disabled={disabled} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-2 text-[11px] text-gray-500">
        Later: save these as structured observations (encounter-level) and use them for prompts & outcome tracking.
      </div>
    </div>
  );
}

function QuickFindingComposer(props: {
  onCreate: (type: FindingTypeKey, severity?: 'mild' | 'moderate' | 'severe', note?: string) => Promise<void>;
  disabled?: boolean;
}) {
  const { onCreate, disabled } = props;

  const [type, setType] = useState<FindingTypeKey>('articulation_error');
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
