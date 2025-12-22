// apps/clinician-app/src/components/workspaces/std/StdPanels.tsx
'use client';

import React from 'react';

import {
  TogglePills,
  BookmarkModal,
  EvidenceStrip as WorkspaceEvidenceStrip,
  FindingCard,
} from '@/src/components/workspaces/ui';

import StdQuickFindingComposer from './StdQuickFindingComposer';
import { CONTEXTS, FINDING_TYPES, type ContextKey } from './constants';
import type {
  AckStatus,
  StdResult,
  StdResultCommunicationEvent,
  StdResultStatus,
} from './useStdWorkspace';

const RESULT_STATUSES: StdResultStatus[] = [
  'planned',
  'ordered',
  'collected',
  'resulted',
  'reviewed',
  'communicated',
];

const COMM_METHODS: StdResultCommunicationEvent['method'][] = [
  'in_app',
  'phone_call',
  'video_call',
  'sms',
  'email',
  'in_person',
  'letter',
  'other',
];

const ACK_STATUSES: AckStatus[] = [
  'not_requested',
  'requested',
  'acknowledged',
  'declined',
];

function isoNowLocal() {
  // Keep simple; hook can accept any ISO-ish string
  try {
    return new Date().toISOString();
  } catch {
    return '';
  }
}

function labelMethod(m: StdResultCommunicationEvent['method']) {
  switch (m) {
    case 'in_app':
      return 'In-app';
    case 'phone_call':
      return 'Phone call';
    case 'video_call':
      return 'Video call';
    case 'sms':
      return 'SMS';
    case 'email':
      return 'Email';
    case 'in_person':
      return 'In person';
    case 'letter':
      return 'Letter';
    default:
      return 'Other';
  }
}

function labelAck(a: AckStatus) {
  switch (a) {
    case 'not_requested':
      return 'Not requested';
    case 'requested':
      return 'Requested';
    case 'acknowledged':
      return 'Acknowledged';
    case 'declined':
      return 'Declined';
    default:
      return a;
  }
}

export function StdHeader(props: {
  patientId: string;
  encounterId: string;
  context: ContextKey;
  risk: { label: string; tone: 'rose' | 'amber' | 'emerald' };
  privacyMode: boolean;
  onTogglePrivacy: () => void;
}) {
  const { patientId, encounterId, context, risk, privacyMode, onTogglePrivacy } = props;

  return (
    <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm text-gray-500">Ambulant+ Workspace</div>
          <h1 className="text-lg font-semibold">
            {privacyMode ? 'Sexual Health Workspace' : 'Sexual Health (STD) Workspace'}
          </h1>
          <div className="mt-1 text-xs text-gray-500">
            Phase 1 · Persisted demo state · Consent gating · Evidence + annotations · Results comms
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
            Context:{' '}
            <span className="font-mono font-semibold">
              {context.replace('_', ' ').toUpperCase()}
            </span>
          </span>

          <span className="rounded-full border bg-white px-2 py-1">
            Risk:{' '}
            <span
              className={
                'font-semibold ' +
                (risk.tone === 'rose'
                  ? 'text-rose-700'
                  : risk.tone === 'amber'
                  ? 'text-amber-700'
                  : 'text-emerald-700')
              }
            >
              {risk.label}
            </span>
          </span>

          <button
            className={
              'rounded-full border px-2 py-1 ' +
              (privacyMode
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white hover:bg-gray-50')
            }
            onClick={onTogglePrivacy}
            type="button"
            title="Privacy mode blurs sensitive sections unless explicitly revealed"
          >
            Privacy mode
          </button>
        </div>
      </div>
    </header>
  );
}

export function StdLeftPanel(props: {
  context: ContextKey;
  contextCounts: Record<ContextKey, number>;

  consent: {
    sensitiveHistoryDoc: boolean;
    mediaCapture: boolean;
    partnerGuidanceDiscussed: boolean;
  };
  privacyMode: boolean;
  showSensitive: boolean;
  sensitiveMaskClass: string;

  exposureWindowDays: string;
  notes: string;

  symptoms: Record<string, boolean>;
  screening: Record<string, boolean>;
  urgencyFlags: Record<string, boolean>;
  riskFactors: Record<string, boolean>;
  specimenSites: Record<string, boolean>;

  findingsForContext: any[];
  evidenceCountForFinding: (findingId: string) => number;

  actions: {
    setContext: (c: ContextKey) => void;
    setShowSensitive: (v: boolean) => void;

    toggleConsent: (k: 'sensitiveHistoryDoc' | 'mediaCapture' | 'partnerGuidanceDiscussed') => void;
    toggleUrgency: (k: string) => void;
    toggleRisk: (k: string) => void;

    setExposureWindowDays: (v: string) => void;
    toggleSymptom: (k: string) => void;

    toggleScreening: (k: string) => void;
    toggleSite: (k: string) => void;

    setNotes: (v: string) => void;

    applySuggestedDefaults: () => void;
    addStructuredFindingsFromChecklist: () => void;

    setBanner: (b: any) => void;
  };
}) {
  const {
    context,
    contextCounts,
    consent,
    showSensitive,
    sensitiveMaskClass,

    exposureWindowDays,
    notes,

    symptoms,
    screening,
    urgencyFlags,
    riskFactors,
    specimenSites,

    findingsForContext,
    evidenceCountForFinding,

    actions,
  } = props;

  return (
    <section className="rounded-xl border bg-white shadow-sm">
      <div className="border-b px-4 py-3">
        <div className="text-sm font-semibold">Context & Checklist</div>
        <div className="text-xs text-gray-500">
          Private, structured capture to keep care consistent
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="rounded-lg border bg-gray-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-gray-700">Confidentiality & consent</div>
              <div className="text-[11px] text-gray-500">
                Mark consent explicitly before documenting sensitive history or capturing evidence.
              </div>
            </div>

            <button
              className="text-[11px] px-2 py-1 rounded border bg-white hover:bg-gray-50"
              onClick={() => actions.setShowSensitive(!showSensitive)}
              type="button"
              title="Reveal/Hide sensitive sections (respects Privacy mode blur)"
            >
              {showSensitive ? 'Hide sensitive' : 'Show sensitive'}
            </button>
          </div>

          <div className={'mt-3 space-y-2 ' + sensitiveMaskClass}>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={consent.sensitiveHistoryDoc}
                onChange={() => actions.toggleConsent('sensitiveHistoryDoc')}
              />
              Consent confirmed: document sensitive history
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={consent.mediaCapture}
                onChange={() => actions.toggleConsent('mediaCapture')}
              />
              Consent confirmed: capture clinical media (photo/clip)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={consent.partnerGuidanceDiscussed}
                onChange={() => actions.toggleConsent('partnerGuidanceDiscussed')}
              />
              Partner guidance discussed (as appropriate)
            </label>

            {!consent.sensitiveHistoryDoc ? (
              <div className="mt-2 rounded border bg-white p-2 text-[11px] text-gray-600">
                Tip: keep sensitive history “Not marked” until consent is confirmed.
              </div>
            ) : null}
          </div>
        </div>

        <TogglePills<ContextKey>
          value={context}
          onChange={actions.setContext}
          items={CONTEXTS.map((c) => ({ key: c.key, label: c.label }))}
          counts={contextCounts}
        />

        <div className="rounded-lg border p-3">
          <div className="text-xs font-semibold text-gray-700">Triage (flags)</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                ['feverOrVeryUnwell', 'Fever / very unwell'],
                ['severePain', 'Severe pain'],
                ['pregnancyConcern', 'Pregnancy concern'],
                ['safeguardingConcern', 'Safeguarding concern'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={!!urgencyFlags[k]} onChange={() => actions.toggleUrgency(k)} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-gray-700">History & risk factors</div>
              <div className="text-[11px] text-gray-500">Keep it neutral. Capture what’s clinically relevant.</div>
            </div>

            <button
              className="text-[11px] px-2 py-1 rounded border bg-white hover:bg-gray-50"
              onClick={actions.applySuggestedDefaults}
              type="button"
            >
              Apply defaults
            </button>
          </div>

          <div className={'mt-2 ' + sensitiveMaskClass}>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['knownExposure', 'Known exposure'],
                  ['newPartnerRecent', 'New partner (recent)'],
                  ['multiplePartners', 'Multiple partners'],
                  ['inconsistentBarrierUse', 'Inconsistent barrier use'],
                  ['priorSTI', 'Prior STI'],
                  ['immunocompromise', 'Immunocompromise'],
                  ['onPrep', 'On PrEP'],
                  ['recentPep', 'Recent PEP'],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={!!riskFactors[k]} onChange={() => actions.toggleRisk(k)} />
                  {label}
                </label>
              ))}
            </div>

            {!consent.sensitiveHistoryDoc ? (
              <div className="mt-2 rounded border bg-amber-50 p-2 text-[11px] text-amber-900">
                Sensitive history consent not marked — consider confirming before documenting.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border bg-gray-50 p-3">
          <div className="text-xs font-semibold text-gray-700">Exposure window</div>
          <label className="mt-2 block text-xs text-gray-600">
            Days since possible exposure (optional)
            <input
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              inputMode="numeric"
              value={exposureWindowDays}
              onChange={(e) => actions.setExposureWindowDays(e.target.value)}
              placeholder="e.g., 10"
            />
          </label>
          <div className="mt-2 text-[11px] text-gray-500">
            Phase 1 persisted locally; Phase 2 becomes server-backed timeline.
          </div>
        </div>

        <div className="rounded-lg border p-3">
          <div className="text-xs font-semibold text-gray-700">Symptoms</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                ['dysuria', 'Dysuria'],
                ['discharge', 'Discharge'],
                ['itching', 'Itching'],
                ['sores', 'Sores/lesions'],
                ['rash', 'Rash'],
                ['pelvicPain', 'Pelvic pain'],
                ['testicularPain', 'Testicular pain'],
                ['soreThroat', 'Sore throat'],
                ['rectalPain', 'Rectal pain'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={!!symptoms[k]} onChange={() => actions.toggleSymptom(k)} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-lg border p-3">
          <div className="text-xs font-semibold text-gray-700">Suggested screening (select what applies)</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                ['hivTest', 'HIV'],
                ['syphilisTest', 'Syphilis'],
                ['gonorrheaChlamydia', 'GC/CT (NAAT)'],
                ['hepatitisB', 'Hepatitis B'],
                ['hepatitisC', 'Hepatitis C'],
                ['pregnancyTest', 'Pregnancy test'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={!!screening[k]} onChange={() => actions.toggleScreening(k)} />
                {label}
              </label>
            ))}
          </div>

          <div className="mt-3 rounded-lg border bg-white p-2">
            <div className="text-[11px] font-semibold text-gray-700">Specimen sites (optional)</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(
                [
                  ['urine', 'Urine'],
                  ['vaginalOrCervical', 'Vaginal/Cervical'],
                  ['rectal', 'Rectal'],
                  ['throat', 'Throat'],
                  ['blood', 'Blood (serology)'],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={!!specimenSites[k]} onChange={() => actions.toggleSite(k)} />
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
              value={notes}
              onChange={(e) => actions.setNotes(e.target.value)}
              placeholder="Optional notes…"
            />
          </label>

          <button
            className="mt-3 w-full rounded border bg-white px-3 py-2 text-sm hover:bg-gray-50"
            onClick={actions.addStructuredFindingsFromChecklist}
            type="button"
          >
            Create structured findings from checklist
          </button>
        </div>

        <div className="rounded-lg border bg-white p-3">
          <div className="text-xs font-semibold text-gray-700">
            Findings ({context.replace('_', ' ')})
          </div>
          <div className="mt-2">
            {findingsForContext.length === 0 ? (
              <div className="text-sm text-gray-600 italic">No findings captured yet.</div>
            ) : (
              <ul className="space-y-2">
                {findingsForContext.slice(0, 6).map((f: any) => (
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
          {findingsForContext.length > 6 ? (
            <div className="mt-2 text-[11px] text-gray-500">
              Showing latest 6. Phase 2 adds timeline + filters.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function StdEvidencePanel(props: {
  context: ContextKey;
  busy: boolean;
  consentMediaCapture: boolean;

  selectedEvidence: any | null;
  evidenceForContext: any[];

  actions: {
    setBookmarkOpen: (open: boolean) => void;
    setSelectedEvidenceId: (id: string | null) => void;
    addDemoPinAnnotation: () => void;
    setBanner: (b: any) => void;
  };
}) {
  const { context, busy, consentMediaCapture, selectedEvidence, evidenceForContext, actions } =
    props;

  const selectedKind = (selectedEvidence as any)?.kind ?? (selectedEvidence as any)?.media?.kind;
  const selectedUrl = (selectedEvidence as any)?.url ?? (selectedEvidence as any)?.media?.url;
  const selectedStatus = (selectedEvidence as any)?.status;

  return (
    <section className="rounded-xl border bg-white shadow-sm">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Evidence</div>
          <div className="text-xs text-gray-500">Preview + bookmark (SFU/device integration later)</div>
        </div>

        <button
          className="rounded-full border bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-800 disabled:opacity-50"
          onClick={() => {
            if (!consentMediaCapture) {
              actions.setBanner({
                kind: 'info',
                text: 'Please confirm capture consent before bookmarking evidence.',
              });
              return;
            }
            actions.setBookmarkOpen(true);
          }}
          disabled={busy}
          type="button"
          title={!consentMediaCapture ? 'Capture consent not marked' : 'Create finding + snapshot + clip'}
        >
          Bookmark
        </button>
      </div>

      <div className="p-4 space-y-3">
        {!consentMediaCapture ? (
          <div className="rounded-lg border bg-amber-50 p-3 text-sm text-amber-900">
            Capture consent not marked. Evidence capture actions are intentionally gated.
          </div>
        ) : null}

        <div className="rounded-lg border bg-gray-100 h-64 overflow-hidden">
          {selectedEvidence ? (
            selectedKind === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selectedUrl} alt="Selected evidence" className="h-full w-full object-contain" />
            ) : (
              <div className="h-full w-full grid place-items-center text-gray-700">
                <div className="text-center px-6">
                  <div className="text-sm font-medium">Clip selected</div>
                  <div className="text-xs text-gray-500 mt-1">Status: {selectedStatus}</div>
                  <div className="mt-2 text-xs text-gray-500">
                    (Playback will be wired once real clip URLs are returned.)
                  </div>
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
            Evidence ({context.replace('_', ' ').toUpperCase()})
          </div>
          <button
            className="text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
            onClick={actions.addDemoPinAnnotation}
            disabled={busy}
            type="button"
          >
            + Add demo pin
          </button>
        </div>

        <WorkspaceEvidenceStrip
          evidence={evidenceForContext}
          onSelect={(ev: any) => actions.setSelectedEvidenceId(ev.id)}
        />

        <div className="rounded-lg border bg-gray-50 p-3">
          <div className="text-xs font-semibold text-gray-700">Compare (MVP-2)</div>
          <div className="mt-1 text-sm text-gray-700">
            Later: compare labs/test results and prior encounters.
          </div>
        </div>
      </div>
    </section>
  );
}

export function StdResultsAndCommsPanel(props: {
  busy: boolean;
  sensitiveMaskClass: string;

  results: StdResult[];
  communications: StdResultCommunicationEvent[];

  consentSensitiveHistoryDoc: boolean;

  followUp: { interval: string; safetyNet: string };

  actions: {
    seedResultsFromScreening: () => void;
    addCustomResult: (label: string) => void;
    updateResult: (id: string, patch: Partial<StdResult>) => void;
    removeResult: (id: string) => void;
    exportOrdersAsFinding: () => Promise<void>;
    exportResultsAsFinding: () => Promise<void>;

    addCommunicationEvent: (payload: {
      occurredAt?: string;
      method: StdResultCommunicationEvent['method'];
      summary: string;
      nextSteps?: string;
      acknowledgementStatus?: AckStatus;
    }) => void;
    updateCommunicationEvent: (id: string, patch: Partial<StdResultCommunicationEvent>) => void;
    removeCommunicationEvent: (id: string) => void;
    exportCommunicationCombo: () => Promise<void>;
  };
}) {
  const {
    busy,
    sensitiveMaskClass,
    results,
    communications,
    followUp,
    consentSensitiveHistoryDoc,
    actions,
  } = props;

  const [customLabel, setCustomLabel] = React.useState('');
  const [commOccurredAt, setCommOccurredAt] = React.useState<string>(() => isoNowLocal());
  const [commMethod, setCommMethod] = React.useState<StdResultCommunicationEvent['method']>('in_app');
  const [commAck, setCommAck] = React.useState<AckStatus>('not_requested');
  const [commSummary, setCommSummary] = React.useState('');
  const [commNextSteps, setCommNextSteps] = React.useState('');
  const [markReviewedAsCommunicated, setMarkReviewedAsCommunicated] = React.useState(true);

  return (
    <section className="rounded-xl border bg-white shadow-sm">
      <div className="border-b px-4 py-3">
        <div className="text-sm font-semibold">Results & Communication</div>
        <div className="text-xs text-gray-500">
          Documented communication + method + timestamp + patient acknowledgement stub (Phase 2 → audit log)
        </div>
      </div>

      <div className="p-4 space-y-4">
        {!consentSensitiveHistoryDoc ? (
          <div className="rounded-lg border bg-amber-50 p-3 text-sm text-amber-900">
            Sensitive history consent is <b>not marked</b>. You can still track results and communications,
            but consider confirming consent before documenting sensitive details.
          </div>
        ) : null}

        {/* Results tracker */}
        <div className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-gray-700">Results tracker (Phase 1)</div>
              <div className="text-[11px] text-gray-500">Track tests through status → ready for future timeline.</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="text-[11px] px-2 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
                onClick={actions.seedResultsFromScreening}
                disabled={busy}
                type="button"
              >
                Seed from screening
              </button>
              <button
                className="text-[11px] px-2 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
                onClick={actions.exportOrdersAsFinding}
                disabled={busy}
                type="button"
                title="Creates a tests_ordered finding (snapshot)"
              >
                Export orders
              </button>
              <button
                className="text-[11px] px-2 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
                onClick={actions.exportResultsAsFinding}
                disabled={busy}
                type="button"
                title="Creates a results_review finding (snapshot)"
              >
                Export results review
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <input
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="Add custom test (e.g., Trichomonas NAAT)"
            />
            <button
              className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
              disabled={busy || !customLabel.trim()}
              onClick={() => {
                actions.addCustomResult(customLabel);
                setCustomLabel('');
              }}
              type="button"
            >
              Add
            </button>
          </div>

          <div className={'mt-3 space-y-2 ' + sensitiveMaskClass}>
            {results.length === 0 ? (
              <div className="text-sm text-gray-600 italic">No tests tracked yet.</div>
            ) : (
              <ul className="space-y-2">
                {results.map((r) => (
                  <li key={r.id} className="rounded border bg-gray-50 p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {r.testLabel}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Sites: {r.specimenSites?.length ? r.specimenSites.join(', ') : 'Not specified'}
                          {r.abnormal ? ' · abnormal' : ''}
                        </div>
                      </div>

                      <button
                        className="text-[11px] px-2 py-1 rounded border bg-white hover:bg-gray-50"
                        onClick={() => actions.removeResult(r.id)}
                        type="button"
                        disabled={busy}
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="block text-[11px] text-gray-600">
                        Status
                        <select
                          className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                          value={r.status}
                          onChange={(e) =>
                            actions.updateResult(r.id, { status: e.target.value as StdResultStatus })
                          }
                          disabled={busy}
                        >
                          {RESULT_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="flex items-center gap-2 text-sm text-gray-700 mt-6">
                        <input
                          type="checkbox"
                          checked={!!r.abnormal}
                          onChange={(e) => actions.updateResult(r.id, { abnormal: e.target.checked })}
                          disabled={busy}
                        />
                        Abnormal
                      </label>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <label className="block text-[11px] text-gray-600">
                        Ordered
                        <input
                          type="date"
                          className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                          value={r.orderedDate || ''}
                          onChange={(e) => actions.updateResult(r.id, { orderedDate: e.target.value || undefined })}
                          disabled={busy}
                        />
                      </label>
                      <label className="block text-[11px] text-gray-600">
                        Collected
                        <input
                          type="date"
                          className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                          value={r.collectedDate || ''}
                          onChange={(e) => actions.updateResult(r.id, { collectedDate: e.target.value || undefined })}
                          disabled={busy}
                        />
                      </label>
                      <label className="block text-[11px] text-gray-600">
                        Resulted
                        <input
                          type="date"
                          className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                          value={r.resultedDate || ''}
                          onChange={(e) => actions.updateResult(r.id, { resultedDate: e.target.value || undefined })}
                          disabled={busy}
                        />
                      </label>
                    </div>

                    <label className="mt-2 block text-[11px] text-gray-600">
                      Result text
                      <textarea
                        className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                        rows={2}
                        value={r.resultText || ''}
                        onChange={(e) => actions.updateResult(r.id, { resultText: e.target.value || undefined })}
                        disabled={busy}
                        placeholder="Neutral result summary (e.g., Negative / Detected / Indeterminate)"
                      />
                    </label>

                    <label className="mt-2 block text-[11px] text-gray-600">
                      Interpretation
                      <textarea
                        className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                        rows={2}
                        value={r.interpretation || ''}
                        onChange={(e) =>
                          actions.updateResult(r.id, { interpretation: e.target.value || undefined })
                        }
                        disabled={busy}
                        placeholder="Clinical interpretation (brief, factual)"
                      />
                    </label>

                    <label className="mt-2 block text-[11px] text-gray-600">
                      Notes
                      <textarea
                        className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                        rows={2}
                        value={r.notes || ''}
                        onChange={(e) => actions.updateResult(r.id, { notes: e.target.value || undefined })}
                        disabled={busy}
                        placeholder="Optional notes"
                      />
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Communication events */}
        <div className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-gray-700">
                Results communication events
              </div>
              <div className="text-[11px] text-gray-500">
                Document the communication + method + timestamp + acknowledgement stub.
              </div>
            </div>

            <button
              className="text-[11px] px-2 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
              onClick={actions.exportCommunicationCombo}
              disabled={busy}
              type="button"
              title="One-click export as results_review + follow_up_plan findings"
            >
              Export combo
            </button>
          </div>

          <div className={'mt-3 grid grid-cols-1 gap-2 ' + sensitiveMaskClass}>
            <label className="block text-[11px] text-gray-600">
              occurredAt (ISO)
              <input
                className="mt-1 w-full rounded border px-2 py-1.5 text-sm font-mono"
                value={commOccurredAt}
                onChange={(e) => setCommOccurredAt(e.target.value)}
                disabled={busy}
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[11px] text-gray-600">
                Method
                <select
                  className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                  value={commMethod}
                  onChange={(e) => setCommMethod(e.target.value as any)}
                  disabled={busy}
                >
                  {COMM_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {labelMethod(m)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-[11px] text-gray-600">
                Acknowledgement
                <select
                  className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                  value={commAck}
                  onChange={(e) => setCommAck(e.target.value as AckStatus)}
                  disabled={busy}
                >
                  {ACK_STATUSES.map((a) => (
                    <option key={a} value={a}>
                      {labelAck(a)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={markReviewedAsCommunicated}
                onChange={(e) => setMarkReviewedAsCommunicated(e.target.checked)}
                disabled={busy}
              />
              After recording, mark any <span className="font-mono">reviewed</span> results as{' '}
              <span className="font-mono">communicated</span>
            </label>

            <label className="block text-[11px] text-gray-600">
              Summary (what was communicated)
              <textarea
                className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                rows={3}
                value={commSummary}
                onChange={(e) => setCommSummary(e.target.value)}
                disabled={busy}
                placeholder="Neutral summary (e.g., results reviewed and communicated; questions addressed)."
              />
            </label>

            <label className="block text-[11px] text-gray-600">
              Next steps (optional)
              <textarea
                className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                rows={2}
                value={commNextSteps}
                onChange={(e) => setCommNextSteps(e.target.value)}
                disabled={busy}
                placeholder={`E.g., repeat test in ${followUp.interval}; safety-net advice provided.`}
              />
            </label>

            <div className="flex items-center gap-2">
              <button
                className="rounded border bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                onClick={() => {
                  const occurredAt = (commOccurredAt || '').trim() || isoNowLocal();

                  actions.addCommunicationEvent({
                    occurredAt,
                    method: commMethod,
                    summary: commSummary,
                    nextSteps: commNextSteps,
                    acknowledgementStatus: commAck,
                  });

                  if (markReviewedAsCommunicated) {
                    for (const r of results) {
                      if (r.status === 'reviewed') {
                        actions.updateResult(r.id, { status: 'communicated' });
                      }
                    }
                  }

                  setCommSummary('');
                  setCommNextSteps('');
                  setCommOccurredAt(isoNowLocal());
                  setCommMethod('in_app');
                  setCommAck('not_requested');
                }}
                disabled={busy || !commSummary.trim()}
                type="button"
              >
                Record communication event
              </button>

              <button
                className="rounded border bg-gray-50 px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
                onClick={() => setCommOccurredAt(isoNowLocal())}
                disabled={busy}
                type="button"
                title="Reset occurredAt to current time"
              >
                Now
              </button>
            </div>
          </div>

          <div className={'mt-3 space-y-2 ' + sensitiveMaskClass}>
            {communications.length === 0 ? (
              <div className="text-sm text-gray-600 italic">No communication events recorded yet.</div>
            ) : (
              <ul className="space-y-2">
                {communications.map((ev) => (
                  <li key={ev.id} className="rounded border bg-gray-50 p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {labelMethod(ev.method)} · {ev.occurredAt}
                        </div>
                        <div className="text-[11px] text-gray-600">
                          Ack: <span className="font-mono">{labelAck(ev.acknowledgement.status)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          className="rounded border bg-white px-2 py-1 text-xs"
                          value={ev.acknowledgement.status}
                          onChange={(e) => {
                            const next = e.target.value as AckStatus;
                            const now = isoNowLocal();

                            // Important: clear stale timestamps when status changes.
                            const nextAck =
                              next === 'requested'
                                ? { status: next, requestedAt: now, acknowledgedAt: undefined, declinedAt: undefined }
                                : next === 'acknowledged'
                                ? { status: next, requestedAt: ev.acknowledgement.requestedAt, acknowledgedAt: now, declinedAt: undefined }
                                : next === 'declined'
                                ? { status: next, requestedAt: ev.acknowledgement.requestedAt, acknowledgedAt: undefined, declinedAt: now }
                                : { status: next, requestedAt: undefined, acknowledgedAt: undefined, declinedAt: undefined };

                            actions.updateCommunicationEvent(ev.id, {
                              acknowledgement: nextAck,
                            });
                          }}
                          disabled={busy}
                          title="Update acknowledgement status"
                        >
                          {ACK_STATUSES.map((a) => (
                            <option key={a} value={a}>
                              {labelAck(a)}
                            </option>
                          ))}
                        </select>

                        <button
                          className="text-[11px] px-2 py-1 rounded border bg-white hover:bg-gray-50"
                          onClick={() => actions.removeCommunicationEvent(ev.id)}
                          disabled={busy}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">
                      {ev.summary || <span className="italic text-gray-500">(no summary)</span>}
                    </div>

                    {ev.nextSteps ? (
                      <div className="mt-2 text-[11px] text-gray-700 whitespace-pre-wrap">
                        <span className="font-semibold">Next steps:</span> {ev.nextSteps}
                      </div>
                    ) : null}

                    <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-gray-600">
                      <div className="rounded border bg-white p-2">
                        <div className="font-semibold">Requested</div>
                        <div className="font-mono">{ev.acknowledgement.requestedAt || '—'}</div>
                      </div>
                      <div className="rounded border bg-white p-2">
                        <div className="font-semibold">Acknowledged</div>
                        <div className="font-mono">{ev.acknowledgement.acknowledgedAt || '—'}</div>
                      </div>
                      <div className="rounded border bg-white p-2">
                        <div className="font-semibold">Declined</div>
                        <div className="font-mono">{ev.acknowledgement.declinedAt || '—'}</div>
                      </div>
                    </div>

                    <label className="mt-2 block text-[11px] text-gray-600">
                      Acknowledgement note (optional)
                      <input
                        className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                        value={ev.acknowledgement.note || ''}
                        onChange={(e) =>
                          actions.updateCommunicationEvent(ev.id, {
                            acknowledgement: { note: e.target.value || undefined },
                          })
                        }
                        disabled={busy}
                        placeholder="Optional note (e.g., patient requested written copy)."
                      />
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-2 text-[11px] text-gray-500">
            Export combo produces two findings: <span className="font-mono">results_review</span> +{' '}
            <span className="font-mono">follow_up_plan</span>.
          </div>
        </div>
      </div>
    </section>
  );
}

export function StdPlanPanel(props: {
  busy: boolean;
  sensitiveMaskClass: string;

  partnerPlan: any;
  preventionPlan: any;
  followUp: any;

  consentSensitiveHistoryDoc: boolean;

  summaryNote: string;

  actions: {
    createManualFinding: (typeKey: any, severity?: any, note?: string) => Promise<void>;

    setPartnerPlan: (patch: any) => void;
    setPreventionPlan: (patch: any) => void;
    setFollowUp: (patch: any) => void;

    copySummaryNote: () => Promise<void>;
    exportSummaryAsFinding: () => Promise<void>;
  };
}) {
  const {
    busy,
    sensitiveMaskClass,

    partnerPlan,
    preventionPlan,
    followUp,

    consentSensitiveHistoryDoc,

    summaryNote,

    actions,
  } = props;

  return (
    <section className="rounded-xl border bg-white shadow-sm">
      <div className="border-b px-4 py-3">
        <div className="text-sm font-semibold">Assessment & Plan</div>
        <div className="text-xs text-gray-500">Structured capture → actions (Phase 2 adds orders/referrals/tasks)</div>
      </div>

      <div className="p-4 space-y-4">
        <div className="rounded-lg border bg-gray-50 p-3">
          <div className="text-xs font-semibold text-gray-700">Quick actions</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              className="rounded border bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              disabled={busy || !consentSensitiveHistoryDoc}
              onClick={() => actions.createManualFinding('consent_documented', undefined, 'Consent documented (see consent checklist).')}
              type="button"
              title={!consentSensitiveHistoryDoc ? 'Confirm sensitive history consent first' : 'Create consent finding'}
            >
              Consent note
            </button>

            <button
              className="rounded border bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              disabled={busy}
              onClick={() => actions.createManualFinding('tests_ordered', undefined, 'Tests planned/ordered as per screening selection.')}
              type="button"
            >
              Tests ordered
            </button>

            <button
              className="rounded border bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              disabled={busy}
              onClick={() => actions.createManualFinding('partner_notification', undefined, 'Partner guidance discussed; plan documented as appropriate.')}
              type="button"
            >
              Partner guidance
            </button>

            <button
              className="rounded border bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              disabled={busy}
              onClick={() =>
                actions.createManualFinding(
                  'follow_up_plan',
                  undefined,
                  `Follow-up: ${followUp.interval}\nSafety net: ${followUp.safetyNet}`
                )
              }
              type="button"
            >
              Follow-up note
            </button>
          </div>

          <div className="mt-2 text-[11px] text-gray-500">
            These buttons create structured findings quickly without requiring any new endpoints.
          </div>
        </div>

        <StdQuickFindingComposer onCreate={actions.createManualFinding} disabled={busy} />

        <div className={'rounded-lg border p-3 ' + sensitiveMaskClass}>
          <div className="text-xs font-semibold text-gray-700">Partner management (as appropriate)</div>
          <div className="mt-2 space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={!!partnerPlan.notifyPartners}
                onChange={(e) => actions.setPartnerPlan({ notifyPartners: e.target.checked })}
              />
              Discussed partner notification
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={!!partnerPlan.expeditedPartnerTherapy}
                onChange={(e) => actions.setPartnerPlan({ expeditedPartnerTherapy: e.target.checked })}
              />
              Consider expedited partner therapy (policy dependent)
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={!!partnerPlan.abstainUntilCleared}
                onChange={(e) => actions.setPartnerPlan({ abstainUntilCleared: e.target.checked })}
              />
              Advise abstaining until cleared / advised
            </label>

            <label className="block text-xs text-gray-600">
              Retest interval
              <input
                className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                value={partnerPlan.retestInterval || ''}
                onChange={(e) => actions.setPartnerPlan({ retestInterval: e.target.value })}
                placeholder="e.g., 3 months"
              />
            </label>
          </div>
        </div>

        <div className="rounded-lg border bg-gray-50 p-3">
          <div className="text-xs font-semibold text-gray-700">Prevention & education</div>
          <div className="mt-2 space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={!!preventionPlan.saferSexCounselling}
                onChange={(e) => actions.setPreventionPlan({ saferSexCounselling: e.target.checked })}
              />
              Safer sex counselling provided
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={!!preventionPlan.prepDiscussed}
                onChange={(e) => actions.setPreventionPlan({ prepDiscussed: e.target.checked })}
              />
              PrEP discussed (where appropriate)
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={!!preventionPlan.vaccinationHepB}
                onChange={(e) => actions.setPreventionPlan({ vaccinationHepB: e.target.checked })}
              />
              Hep B vaccination considered
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={!!preventionPlan.vaccinationHPV}
                onChange={(e) => actions.setPreventionPlan({ vaccinationHPV: e.target.checked })}
              />
              HPV vaccination considered
            </label>
          </div>
        </div>

        <div className="rounded-lg border p-3">
          <div className="text-xs font-semibold text-gray-700">Follow-up</div>
          <label className="mt-2 block text-xs text-gray-600">
            Interval
            <input
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={followUp.interval || ''}
              onChange={(e) => actions.setFollowUp({ interval: e.target.value })}
              placeholder="e.g., 2 weeks"
            />
          </label>
          <label className="mt-2 block text-xs text-gray-600">
            Safety net advice
            <textarea
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              rows={3}
              value={followUp.safetyNet || ''}
              onChange={(e) => actions.setFollowUp({ safetyNet: e.target.value })}
            />
          </label>
        </div>

        <div className="rounded-lg border bg-gray-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-gray-700">Summary note (Phase 1)</div>
              <div className="text-[11px] text-gray-500">Auto-composed from your checklist and plan items.</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
                onClick={actions.copySummaryNote}
                type="button"
              >
                Copy
              </button>
              <button
                className="text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
                onClick={actions.exportSummaryAsFinding}
                type="button"
                title="Creates a Results review finding containing this summary"
              >
                Save as finding
              </button>
            </div>
          </div>

          <textarea
            className="mt-2 w-full rounded border bg-white px-2 py-1.5 text-xs font-mono text-gray-800"
            rows={10}
            value={summaryNote}
            readOnly
          />
        </div>
      </div>
    </section>
  );
}

export function StdBookmarkModal(props: {
  open: boolean;
  busy: boolean;
  context: ContextKey;
  onClose: () => void;
  onSave: (payload: { findingTypeKey: string; severity?: any; note?: string }) => Promise<void>;
}) {
  const { open, onClose, onSave, context } = props;

  return (
    <BookmarkModal
      open={open}
      onClose={onClose}
      title={`Bookmark (${context.replace('_', ' ')})`}
      description="Creates a finding + captures snapshot + clip as evidence"
      findingTypes={FINDING_TYPES.map((x) => ({ key: x.key, label: x.label }))}
      defaultTypeKey={
        context === 'screening'
          ? 'risk_assessment'
          : context === 'symptomatic'
          ? 'lesion_observed'
          : 'follow_up_plan'
      }
      onSave={onSave}
    />
  );
}
