// apps/clinician-app/src/components/workspaces/std/useStdWorkspace.ts
'use client';

import React from 'react';

import type { Evidence, Finding, Location } from '@/src/lib/workspaces/types';
import { postAnnotation, postEvidence, postFinding } from '@/src/lib/workspaces/api';

import { CONTEXTS, FINDING_TYPES, type ContextKey, type FindingTypeKey } from './constants';

// IMPORTANT: don't trust named export shape for computeRiskLevel (repo mismatch)
import * as Utils from './utils';
import { errMsg, locationForContext, nowISO, safeJsonParse, tmpId } from './utils';

type Banner = { kind: 'info' | 'success' | 'error'; text: string } | null;

export type STDWorkspaceProps = {
  patientId?: string;
  encounterId?: string;
  clinicianId?: string;
};

export type StdResultStatus =
  | 'planned'
  | 'ordered'
  | 'collected'
  | 'resulted'
  | 'reviewed'
  | 'communicated';

export type StdResult = {
  id: string;
  testKey?: string;
  testLabel: string;
  specimenSites: string[];
  status: StdResultStatus;

  orderedDate?: string; // YYYY-MM-DD
  collectedDate?: string; // YYYY-MM-DD
  resultedDate?: string; // YYYY-MM-DD

  abnormal?: boolean;
  resultText?: string;
  interpretation?: string;
  notes?: string;
};

export type AckStatus = 'not_requested' | 'requested' | 'acknowledged' | 'declined';

export type StdResultCommunicationEvent = {
  id: string;

  occurredAt: string; // ISO
  method:
    | 'in_app'
    | 'phone_call'
    | 'video_call'
    | 'sms'
    | 'email'
    | 'in_person'
    | 'letter'
    | 'other';

  summary: string;

  acknowledgement: {
    status: AckStatus;
    requestedAt?: string;
    acknowledgedAt?: string;
    declinedAt?: string;
    note?: string;
  };

  nextSteps?: string;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type StdPersisted = Omit<StdState, 'busy' | 'banner' | 'bookmarkOpen'>;

type StdState = {
  context: ContextKey;

  findings: Finding[];
  evidence: Evidence[];
  selectedEvidenceId: string | null;

  // UI
  bookmarkOpen: boolean;
  busy: boolean;
  banner: Banner;

  // Privacy & consent
  privacyMode: boolean;
  showSensitive: boolean;
  consent: {
    sensitiveHistoryDoc: boolean;
    mediaCapture: boolean;
    partnerGuidanceDiscussed: boolean;
  };

  // Checklist
  exposureWindowDays: string;
  symptoms: {
    dysuria: boolean;
    discharge: boolean;
    itching: boolean;
    sores: boolean;
    rash: boolean;
    pelvicPain: boolean;
    testicularPain: boolean;
    soreThroat: boolean;
    rectalPain: boolean;
  };
  screening: {
    hivTest: boolean;
    syphilisTest: boolean;
    gonorrheaChlamydia: boolean;
    hepatitisB: boolean;
    hepatitisC: boolean;
    pregnancyTest: boolean;
  };
  notes: string;

  urgencyFlags: {
    feverOrVeryUnwell: boolean;
    severePain: boolean;
    pregnancyConcern: boolean;
    safeguardingConcern: boolean;
  };

  riskFactors: {
    knownExposure: boolean;
    newPartnerRecent: boolean;
    multiplePartners: boolean;
    inconsistentBarrierUse: boolean;
    priorSTI: boolean;
    immunocompromise: boolean;
    onPrep: boolean;
    recentPep: boolean;
  };

  specimenSites: {
    urine: boolean;
    vaginalOrCervical: boolean;
    rectal: boolean;
    throat: boolean;
    blood: boolean;
  };

  partnerPlan: {
    notifyPartners: boolean;
    expeditedPartnerTherapy: boolean;
    abstainUntilCleared: boolean;
    retestInterval: string;
  };

  preventionPlan: {
    saferSexCounselling: boolean;
    prepDiscussed: boolean;
    vaccinationHepB: boolean;
    vaccinationHPV: boolean;
  };

  followUp: {
    interval: string;
    safetyNet: string;
  };

  // Results tracker + comms
  results: StdResult[];
  communications: StdResultCommunicationEvent[];
};

const TEST_LABELS: Record<string, string> = {
  hivTest: 'HIV',
  syphilisTest: 'Syphilis',
  gonorrheaChlamydia: 'GC/CT (NAAT)',
  hepatitisB: 'Hepatitis B',
  hepatitisC: 'Hepatitis C',
  pregnancyTest: 'Pregnancy test',
};

const DEFAULT_STATE: StdState = {
  context: 'screening',

  findings: [],
  evidence: [],
  selectedEvidenceId: null,

  bookmarkOpen: false,
  busy: false,
  banner: null,

  privacyMode: false,
  showSensitive: false,
  consent: {
    sensitiveHistoryDoc: false,
    mediaCapture: false,
    partnerGuidanceDiscussed: false,
  },

  exposureWindowDays: '',
  symptoms: {
    dysuria: false,
    discharge: false,
    itching: false,
    sores: false,
    rash: false,
    pelvicPain: false,
    testicularPain: false,
    soreThroat: false,
    rectalPain: false,
  },
  screening: {
    hivTest: false,
    syphilisTest: false,
    gonorrheaChlamydia: false,
    hepatitisB: false,
    hepatitisC: false,
    pregnancyTest: false,
  },
  notes: '',

  urgencyFlags: {
    feverOrVeryUnwell: false,
    severePain: false,
    pregnancyConcern: false,
    safeguardingConcern: false,
  },

  riskFactors: {
    knownExposure: false,
    newPartnerRecent: false,
    multiplePartners: false,
    inconsistentBarrierUse: false,
    priorSTI: false,
    immunocompromise: false,
    onPrep: false,
    recentPep: false,
  },

  specimenSites: {
    urine: false,
    vaginalOrCervical: false,
    rectal: false,
    throat: false,
    blood: false,
  },

  partnerPlan: {
    notifyPartners: false,
    expeditedPartnerTherapy: false,
    abstainUntilCleared: false,
    retestInterval: '3 months',
  },

  preventionPlan: {
    saferSexCounselling: false,
    prepDiscussed: false,
    vaccinationHepB: false,
    vaccinationHPV: false,
  },

  followUp: {
    interval: '2 weeks',
    safetyNet:
      'Seek urgent care if fever, severe pain, rapid worsening symptoms, or new concerning symptoms develop.',
  },

  results: [],
  communications: [],
};

function persistKey(encounterId: string) {
  return `ambulant.std.workspace.${encounterId}`;
}

function toPersisted(s: StdState): StdPersisted {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { busy, banner, bookmarkOpen, ...rest } = s;
  return rest;
}

function picked(obj: Record<string, boolean>) {
  return Object.entries(obj)
    .filter(([, v]) => v)
    .map(([k]) => k);
}

function fmtSitesFromSelection(specimenSites: Record<string, boolean>) {
  return Object.entries(specimenSites)
    .filter(([, v]) => v)
    .map(([k]) => k);
}

function fallbackComputeRiskLevel(input: {
  riskFactors: Record<string, boolean>;
  symptoms: Record<string, boolean>;
  urgencyFlags: Record<string, boolean>;
}): { label: string; tone: 'rose' | 'amber' | 'emerald' } {
  // Conservative + simple heuristic (keeps UI stable even if utils export differs)
  const urg = Object.values(input.urgencyFlags).filter(Boolean).length;
  const rf = Object.values(input.riskFactors).filter(Boolean).length;
  const sx = Object.values(input.symptoms).filter(Boolean).length;

  if (urg >= 1) return { label: 'High', tone: 'rose' };
  if (sx >= 3 || rf >= 4) return { label: 'Moderate', tone: 'amber' };
  if (sx >= 1 || rf >= 1) return { label: 'Low–Moderate', tone: 'amber' };
  return { label: 'Low', tone: 'emerald' };
}

function computeRiskLevelSafe(input: {
  riskFactors: Record<string, boolean>;
  symptoms: Record<string, boolean>;
  urgencyFlags: Record<string, boolean>;
}): { label: string; tone: 'rose' | 'amber' | 'emerald' } {
  const fn = (Utils as any).computeRiskLevel;
  if (typeof fn === 'function') {
    try {
      const out = fn(input);
      if (
        out &&
        typeof out.label === 'string' &&
        (out.tone === 'rose' || out.tone === 'amber' || out.tone === 'emerald')
      ) {
        return out;
      }
    } catch {
      // fall through
    }
  }
  return fallbackComputeRiskLevel(input);
}

function formatOrdersNote(results: StdResult[]) {
  const lines: string[] = [];
  lines.push('Tests / Orders (Results Tracker)');
  for (const r of results) {
    const sites = r.specimenSites?.length
      ? ` · sites: ${r.specimenSites.join(', ')}`
      : '';
    const ord = r.orderedDate ? ` · ordered ${r.orderedDate}` : '';
    lines.push(`- ${r.testLabel} · status: ${r.status}${sites}${ord}`);
  }
  return lines.join('\n');
}

function formatResultsReviewNote(params: {
  patientId: string;
  encounterId: string;
  results: StdResult[];
  communications: StdResultCommunicationEvent[];
}) {
  const { patientId, encounterId, results, communications } = params;

  const lines: string[] = [];
  lines.push('Results review + communication (Phase 1)');
  lines.push(`Patient: ${patientId} · Encounter: ${encounterId}`);
  lines.push('');

  if (results.length) {
    lines.push('Results tracker:');
    for (const r of results) {
      const abn = r.abnormal ? ' · abnormal' : '';
      const siteTxt = r.specimenSites?.length
        ? ` · sites: ${r.specimenSites.join(', ')}`
        : '';
      const dateBits = [
        r.orderedDate ? `ordered ${r.orderedDate}` : null,
        r.collectedDate ? `collected ${r.collectedDate}` : null,
        r.resultedDate ? `resulted ${r.resultedDate}` : null,
      ].filter(Boolean);
      const dateTxt = dateBits.length ? ` · ${dateBits.join(' · ')}` : '';
      lines.push(`- ${r.testLabel} · ${r.status}${abn}${siteTxt}${dateTxt}`);
      if (r.resultText?.trim()) lines.push(`  Result: ${r.resultText.trim()}`);
      if (r.interpretation?.trim())
        lines.push(`  Interpretation: ${r.interpretation.trim()}`);
      if (r.notes?.trim()) lines.push(`  Notes: ${r.notes.trim()}`);
    }
    lines.push('');
  } else {
    lines.push('Results tracker: none recorded');
    lines.push('');
  }

  if (communications.length) {
    lines.push('Results communication events:');
    for (const ev of communications
      .slice()
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))) {
      const ack = ev.acknowledgement.status;
      const ackBits = [
        ack === 'requested'
          ? `ack requested at ${ev.acknowledgement.requestedAt || 'N/A'}`
          : null,
        ack === 'acknowledged'
          ? `acknowledged at ${ev.acknowledgement.acknowledgedAt || 'N/A'}`
          : null,
        ack === 'declined'
          ? `declined at ${ev.acknowledgement.declinedAt || 'N/A'}`
          : null,
      ].filter(Boolean);

      lines.push(
        `- ${ev.occurredAt} · method: ${ev.method} · acknowledgement: ${ack}${
          ackBits.length ? ` (${ackBits.join(', ')})` : ''
        }`
      );
      lines.push(`  Summary: ${ev.summary.trim() || '(no summary)'}`);
      if (ev.nextSteps?.trim())
        lines.push(`  Next steps: ${ev.nextSteps.trim()}`);
      if (ev.acknowledgement.note?.trim())
        lines.push(`  Ack note: ${ev.acknowledgement.note.trim()}`);
    }
  } else {
    lines.push('Results communication events: none recorded');
  }

  return lines.join('\n');
}

function formatFollowUpPlanNote(params: {
  followUpInterval: string;
  safetyNet: string;
  communications: StdResultCommunicationEvent[];
}) {
  const { followUpInterval, safetyNet, communications } = params;

  const lines: string[] = [];
  lines.push('Follow-up plan (post results communication)');
  lines.push(`Interval: ${followUpInterval || 'Not specified'}`);
  lines.push(`Safety net: ${safetyNet || 'Not specified'}`);
  lines.push('');

  if (communications.length) {
    const latest = communications
      .slice()
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))[0];
    lines.push('Latest communication event:');
    lines.push(`- occurredAt: ${latest.occurredAt}`);
    lines.push(`- method: ${latest.method}`);
    lines.push(`- acknowledgement: ${latest.acknowledgement.status}`);
    if (latest.nextSteps?.trim())
      lines.push(`- next steps: ${latest.nextSteps.trim()}`);
  } else {
    lines.push('No communication events recorded yet.');
  }

  return lines.join('\n');
}

export function useStdWorkspace(props: STDWorkspaceProps) {
  const patientId = props.patientId ?? 'pat_demo_001';
  const encounterId = props.encounterId ?? 'enc_demo_001';
  const clinicianId = props.clinicianId ?? 'clin_demo_001';

  const [state, setState] = React.useState<StdState>(DEFAULT_STATE);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(persistKey(encounterId));
    const loaded = safeJsonParse<StdPersisted>(raw);
    if (loaded) {
      setState((prev) => ({
        ...prev,
        ...loaded,
        busy: false,
        banner: null,
        bookmarkOpen: false,
      }));
    } else {
      setState(() => ({
        ...DEFAULT_STATE,
        busy: false,
        banner: null,
        bookmarkOpen: false,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterId]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = window.setTimeout(() => {
      window.localStorage.setItem(
        persistKey(encounterId),
        JSON.stringify(toPersisted(state))
      );
    }, 250);
    return () => window.clearTimeout(t);
  }, [encounterId, state]);

  const selectedEvidence = React.useMemo(
    () => state.evidence.find((e) => e.id === state.selectedEvidenceId) ?? null,
    [state.evidence, state.selectedEvidenceId]
  );

  const sensitiveMaskClass = React.useMemo(() => {
    return state.privacyMode && !state.showSensitive
      ? 'blur-sm select-none pointer-events-none'
      : '';
  }, [state.privacyMode, state.showSensitive]);

  const riskLevel = React.useMemo(
    () =>
      computeRiskLevelSafe({
        riskFactors: state.riskFactors as any,
        symptoms: state.symptoms as any,
        urgencyFlags: state.urgencyFlags as any,
      }),
    [state.riskFactors, state.symptoms, state.urgencyFlags]
  );

  const findingsForContext = React.useMemo(() => {
    return state.findings
      .filter((f) => {
        const loc = f.location as unknown as Record<string, unknown> | null;
        const kind = loc?.kind;
        const ctx = loc?.context;
        if (
          kind === 'std' &&
          (ctx === 'screening' || ctx === 'symptomatic' || ctx === 'follow_up')
        )
          return ctx === state.context;
        return true;
      })
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [state.findings, state.context]);

  const evidenceForContext = React.useMemo(() => {
    return state.evidence
      .filter((ev) => {
        const loc = ev.location as unknown as Record<string, unknown> | null;
        const kind = loc?.kind;
        const ctx = loc?.context;
        if (
          kind === 'std' &&
          (ctx === 'screening' || ctx === 'symptomatic' || ctx === 'follow_up')
        )
          return ctx === state.context;
        return true;
      })
      .sort((a, b) => ((a as any).capturedAt < (b as any).capturedAt ? 1 : -1));
  }, [state.evidence, state.context]);

  const contextCounts = React.useMemo(() => {
    const c = { screening: 0, symptomatic: 0, follow_up: 0 } as Record<
      ContextKey,
      number
    >;
    for (const f of state.findings) {
      const loc = f.location as unknown as Record<string, unknown> | null;
      if (
        loc?.kind === 'std' &&
        (loc?.context === 'screening' ||
          loc?.context === 'symptomatic' ||
          loc?.context === 'follow_up')
      ) {
        c[loc.context as ContextKey] += 1;
      }
    }
    return c;
  }, [state.findings]);

  const evidenceCountForFinding = React.useCallback(
    (findingId: string) =>
      state.evidence.filter((e) => (e as any).findingId === findingId).length,
    [state.evidence]
  );

  const setBanner = React.useCallback((b: Banner) => {
    setState((s) => ({ ...s, banner: b }));
  }, []);

  const createManualFinding = React.useCallback(
    async (type: FindingTypeKey, severity?: Finding['severity'], note?: string) => {
      const title = FINDING_TYPES.find((x) => x.key === type)?.label ?? 'Finding';
      const location = locationForContext(state.context);

      const optimisticId = tmpId('fd');
      const optimistic: Finding = {
        id: optimisticId,
        patientId,
        encounterId,
        specialty: 'std',
        status: 'draft',
        title,
        note: note?.trim() ? note.trim() : undefined,
        severity,
        tags: ['std', state.context],
        location,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        createdBy: clinicianId,
        meta: {},
      };

      setState((s) => ({ ...s, banner: null, findings: [optimistic, ...s.findings] }));

      try {
        const created = await postFinding({
          patientId,
          encounterId,
          specialty: 'std',
          title,
          status: 'draft',
          severity,
          note: note?.trim() ? note.trim() : undefined,
          tags: ['std', state.context],
          location,
          createdBy: clinicianId,
          meta: { clientRequestId: optimisticId },
        });

        setState((s) => ({
          ...s,
          findings: s.findings.map((f) => (f.id === optimisticId ? created : f)),
          banner: { kind: 'success', text: 'Finding saved.' },
        }));
      } catch (e) {
        setState((s) => ({
          ...s,
          findings: s.findings.filter((f) => f.id !== optimisticId),
          banner: { kind: 'error', text: `Failed to save finding: ${errMsg(e)}` },
        }));
        throw e;
      }
    },
    [clinicianId, encounterId, patientId, state.context]
  );

  const handleBookmark = React.useCallback(
    async (payload: { findingTypeKey: string; severity?: Finding['severity']; note?: string }) => {
      if (!state.consent.mediaCapture) {
        setBanner({
          kind: 'info',
          text: 'Capture consent is not marked. Please confirm consent before bookmarking evidence.',
        });
        return;
      }

      const type = payload.findingTypeKey as FindingTypeKey;
      const title = FINDING_TYPES.find((x) => x.key === type)?.label ?? 'Finding';
      const location: Location = locationForContext(state.context);

      setState((s) => ({ ...s, banner: null, busy: true }));

      try {
        const createdFinding = await postFinding({
          patientId,
          encounterId,
          specialty: 'std',
          title,
          status: 'draft',
          severity: payload.severity,
          note: payload.note,
          tags: ['std', state.context, 'bookmark'],
          location,
          createdBy: clinicianId,
          meta: { clientRequestId: tmpId('bk') },
        });

        setState((s) => ({ ...s, findings: [createdFinding, ...s.findings] }));

        const snapshot = await postEvidence({
          patientId,
          encounterId,
          specialty: 'std',
          findingId: createdFinding.id,
          location,
          source: { type: 'live_capture', device: 'camera', roomId: undefined, trackId: undefined },
          media: {
            kind: 'image',
            url: `https://placehold.co/1200x800?text=Sexual+Health+Snapshot+(${state.context.toUpperCase()})`,
            thumbnailUrl: `https://placehold.co/320x200?text=Snapshot+(${state.context.toUpperCase()})`,
            contentType: 'image/jpeg',
          },
          status: 'ready',
          meta: { clientRequestId: tmpId('ev_img') },
        });

        const t = Date.now();
        const clip = await postEvidence({
          patientId,
          encounterId,
          specialty: 'std',
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
            thumbnailUrl: `https://placehold.co/320x200?text=Clip+(${state.context.toUpperCase()})`,
            contentType: 'video/mp4',
            startTs: t - 4000,
            endTs: t + 7000,
          },
          status: 'processing',
          meta: { clientRequestId: tmpId('ev_vid') },
        });

        setState((s) => ({
          ...s,
          evidence: [snapshot as any, clip as any, ...s.evidence],
          selectedEvidenceId: (snapshot as any).id,
          banner: { kind: 'success', text: 'Bookmark saved (finding + evidence created).' },
        }));
      } catch (e) {
        setBanner({ kind: 'error', text: `Failed to save bookmark: ${errMsg(e)}` });
        throw e;
      } finally {
        setState((s) => ({ ...s, busy: false }));
      }
    },
    [clinicianId, encounterId, patientId, setBanner, state.consent.mediaCapture, state.context]
  );

  const addDemoPinAnnotation = React.useCallback(async () => {
    if (!selectedEvidence) {
      setBanner({ kind: 'info', text: 'Select an evidence item first.' });
      return;
    }

    setState((s) => ({ ...s, banner: null, busy: true }));
    try {
      await postAnnotation({
        patientId,
        encounterId,
        specialty: 'std',
        evidenceId: (selectedEvidence as any).id,
        findingId: (selectedEvidence as any).findingId ?? null,
        location: (selectedEvidence as any).location,
        type: 'pin',
        payload: { x: 0.54, y: 0.42, label: 'Key observation' },
        createdBy: clinicianId,
        meta: { clientRequestId: tmpId('ann') },
      });

      setBanner({ kind: 'success', text: 'Annotation created (demo pin).' });
    } catch (e) {
      setBanner({ kind: 'error', text: `Failed to create annotation: ${errMsg(e)}` });
    } finally {
      setState((s) => ({ ...s, busy: false }));
    }
  }, [clinicianId, encounterId, patientId, selectedEvidence, setBanner]);

  const applySuggestedDefaults = React.useCallback(() => {
    setBanner(null);

    const symptomatic =
      state.context === 'symptomatic' ||
      Object.values(state.symptoms).some(Boolean);

    const nextScreening = {
      ...state.screening,
      gonorrheaChlamydia:
        state.screening.gonorrheaChlamydia ||
        symptomatic ||
        state.riskFactors.knownExposure ||
        state.riskFactors.newPartnerRecent,
      hivTest:
        state.screening.hivTest ||
        state.riskFactors.knownExposure ||
        state.riskFactors.multiplePartners ||
        state.riskFactors.inconsistentBarrierUse,
      syphilisTest:
        state.screening.syphilisTest ||
        state.riskFactors.knownExposure ||
        state.riskFactors.multiplePartners,
      hepatitisB:
        state.screening.hepatitisB || state.riskFactors.immunocompromise,
      hepatitisC: state.screening.hepatitisC || false,
      pregnancyTest:
        state.screening.pregnancyTest || state.urgencyFlags.pregnancyConcern,
    };

    setState((s) => {
      const anySites = Object.values(s.specimenSites).some(Boolean);
      const nextSites = anySites
        ? s.specimenSites
        : {
            ...s.specimenSites,
            urine: symptomatic || s.riskFactors.knownExposure,
            blood:
              nextScreening.hivTest ||
              nextScreening.syphilisTest ||
              nextScreening.hepatitisB ||
              nextScreening.hepatitisC,
          };

      return {
        ...s,
        screening: nextScreening,
        specimenSites: nextSites,
        banner: { kind: 'success', text: 'Suggested defaults applied (non-destructive).' },
      };
    });
  }, [
    setBanner,
    state.context,
    state.riskFactors,
    state.screening,
    state.symptoms,
    state.urgencyFlags.pregnancyConcern,
  ]);

  const addStructuredFindingsFromChecklist = React.useCallback(async () => {
    setBanner(null);

    if (!state.consent.sensitiveHistoryDoc) {
      setBanner({
        kind: 'info',
        text:
          'Sensitive history consent is not marked. Please confirm before generating structured findings from history.',
      });
      return;
    }

    const parts: string[] = [];
    const sx = picked(state.symptoms);
    const rf = picked(state.riskFactors);
    const urg = picked(state.urgencyFlags);
    const tests = picked(state.screening);
    const sites = picked(state.specimenSites);

    if (sx.length) parts.push(`Symptoms: ${sx.join(', ')}`);
    if (state.exposureWindowDays.trim())
      parts.push(`Days since possible exposure: ${state.exposureWindowDays.trim()}`);
    if (rf.length) parts.push(`Risk factors: ${rf.join(', ')}`);
    if (urg.length) parts.push(`Urgency flags: ${urg.join(', ')}`);
    if (tests.length) parts.push(`Planned tests: ${tests.join(', ')}`);
    if (sites.length) parts.push(`Specimen sites: ${sites.join(', ')}`);
    if (state.notes.trim()) parts.push(`Notes: ${state.notes.trim()}`);

    const combined = parts.join('\n');

    setState((s) => ({ ...s, busy: true }));
    try {
      if (rf.length || state.exposureWindowDays.trim()) {
        await createManualFinding(
          'risk_assessment',
          undefined,
          `Risk level: ${riskLevel.label}\n${combined}`.trim()
        );
      }
      if (sx.length) await createManualFinding('genital_symptoms', undefined, combined);
      if (tests.length) await createManualFinding('tests_ordered', undefined, combined);

      if (
        state.partnerPlan.notifyPartners ||
        state.partnerPlan.expeditedPartnerTherapy ||
        state.partnerPlan.abstainUntilCleared
      ) {
        await createManualFinding(
          'partner_notification',
          undefined,
          `Partner plan:\n- Notify partners: ${state.partnerPlan.notifyPartners ? 'Yes' : 'No'}\n- Expedited partner therapy: ${
            state.partnerPlan.expeditedPartnerTherapy ? 'Yes' : 'No'
          }\n- Abstain until cleared/advised: ${
            state.partnerPlan.abstainUntilCleared ? 'Yes' : 'No'
          }\n- Retest: ${state.partnerPlan.retestInterval || 'Not specified'}`
        );
      }

      await createManualFinding(
        'follow_up_plan',
        undefined,
        `Follow-up: ${state.followUp.interval || 'Not specified'}\nSafety net: ${
          state.followUp.safetyNet || 'Not specified'
        }`
      );

      setBanner({ kind: 'success', text: 'Structured findings created from checklist.' });
    } catch {
      // createManualFinding already banners
    } finally {
      setState((s) => ({ ...s, busy: false }));
    }
  }, [createManualFinding, riskLevel.label, setBanner, state]);

  const summaryNote = React.useMemo(() => {
    const contextLabel =
      CONTEXTS.find((c) => c.key === state.context)?.label ??
      state.context.replace('_', ' ');

    const baseLines: string[] = [];

    baseLines.push('Sexual Health Consult (STD) — Summary (Draft)');
    baseLines.push(`Context: ${contextLabel}`);
    baseLines.push(`Patient: ${patientId} · Encounter: ${encounterId}`);
    baseLines.push('');

    baseLines.push('Consent / Confidentiality:');
    baseLines.push(
      `- Sensitive history documented: ${state.consent.sensitiveHistoryDoc ? 'Yes' : 'Not marked'}`
    );
    baseLines.push(
      `- Media capture consent: ${state.consent.mediaCapture ? 'Yes' : 'Not marked'}`
    );
    baseLines.push(
      `- Partner guidance discussed: ${state.consent.partnerGuidanceDiscussed ? 'Yes' : 'Not marked'}`
    );
    baseLines.push('');

    const urg = picked(state.urgencyFlags);
    baseLines.push('Triage:');
    baseLines.push(`- Urgency flags: ${urg.length ? urg.join(', ') : 'None marked'}`);
    baseLines.push(`- Risk level (heuristic): ${riskLevel.label}`);
    baseLines.push('');

    const sx = picked(state.symptoms);
    baseLines.push('Symptoms:');
    baseLines.push(`- ${sx.length ? sx.join(', ') : 'None marked'}`);
    if (state.exposureWindowDays.trim())
      baseLines.push(`- Days since possible exposure: ${state.exposureWindowDays.trim()}`);
    if (state.notes.trim()) baseLines.push(`- Notes: ${state.notes.trim()}`);
    baseLines.push('');

    const rf = picked(state.riskFactors);
    baseLines.push('Risk factors (as captured):');
    baseLines.push(`- ${rf.length ? rf.join(', ') : 'None marked'}`);
    baseLines.push('');

    const tests = picked(state.screening);
    const sites = picked(state.specimenSites);
    baseLines.push('Tests / Screening:');
    baseLines.push(`- Selected: ${tests.length ? tests.join(', ') : 'None selected'}`);
    baseLines.push(`- Specimen sites: ${sites.length ? sites.join(', ') : 'Not specified'}`);
    baseLines.push('');

    if (state.results.length) {
      baseLines.push('Results tracker:');
      for (const r of state.results) {
        const abn = r.abnormal ? ' · abnormal' : '';
        const siteTxt = r.specimenSites?.length
          ? ` · sites: ${r.specimenSites.join(', ')}`
          : '';
        baseLines.push(`- ${r.testLabel} · ${r.status}${abn}${siteTxt}`);
        if (r.resultText?.trim())
          baseLines.push(`  Result: ${r.resultText.trim()}`);
        if (r.interpretation?.trim())
          baseLines.push(`  Interpretation: ${r.interpretation.trim()}`);
      }
      baseLines.push('');
    }

    if (state.communications.length) {
      baseLines.push('Results communication events:');
      for (const ev of state.communications
        .slice()
        .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))) {
        baseLines.push(
          `- ${ev.occurredAt} · method: ${ev.method} · acknowledgement: ${ev.acknowledgement.status}`
        );
        baseLines.push(`  Summary: ${ev.summary.trim() || '(no summary)'}`);
        if (ev.nextSteps?.trim())
          baseLines.push(`  Next steps: ${ev.nextSteps.trim()}`);
      }
      baseLines.push('');
    }

    baseLines.push('Partner plan:');
    baseLines.push(
      `- Notify partners: ${state.partnerPlan.notifyPartners ? 'Yes' : 'No/Not marked'}`
    );
    baseLines.push(
      `- Expedited partner therapy (policy dependent): ${
        state.partnerPlan.expeditedPartnerTherapy ? 'Yes' : 'No/Not marked'
      }`
    );
    baseLines.push(
      `- Abstain until cleared / advised: ${
        state.partnerPlan.abstainUntilCleared ? 'Yes' : 'No/Not marked'
      }`
    );
    baseLines.push(`- Retest: ${state.partnerPlan.retestInterval || 'Not specified'}`);
    baseLines.push('');

    baseLines.push('Prevention:');
    baseLines.push(
      `- Safer sex counselling: ${state.preventionPlan.saferSexCounselling ? 'Done' : 'Not marked'}`
    );
    baseLines.push(
      `- PrEP discussed (where appropriate): ${
        state.preventionPlan.prepDiscussed ? 'Done' : 'Not marked'
      }`
    );
    baseLines.push(
      `- Vaccinations (Hep B/HPV) considered: ${
        state.preventionPlan.vaccinationHepB || state.preventionPlan.vaccinationHPV
          ? 'Yes'
          : 'Not marked'
      }`
    );
    baseLines.push('');

    baseLines.push('Follow-up:');
    baseLines.push(`- Interval: ${state.followUp.interval || 'Not specified'}`);
    baseLines.push(`- Safety net: ${state.followUp.safetyNet || 'Not specified'}`);

    return baseLines.join('\n');
  }, [encounterId, patientId, riskLevel.label, state]);

  const copySummaryNote = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(summaryNote);
      setBanner({ kind: 'success', text: 'Summary note copied to clipboard.' });
    } catch {
      setBanner({ kind: 'error', text: 'Failed to copy note (clipboard unavailable).' });
    }
  }, [setBanner, summaryNote]);

  const exportSummaryAsFinding = React.useCallback(async () => {
    await createManualFinding('results_review', undefined, summaryNote);
  }, [createManualFinding, summaryNote]);

  // ---------------- Results tracker (Phase 1 local) ----------------
  const seedResultsFromScreening = React.useCallback(() => {
    setState((s) => {
      const sites = fmtSitesFromSelection(s.specimenSites);
      const want = Object.entries(s.screening)
        .filter(([, v]) => v)
        .map(([k]) => ({ key: k, label: TEST_LABELS[k] || k }));

      if (!want.length) return s;

      const existingKeys = new Set(
        s.results.map((r) => r.testKey).filter(Boolean) as string[]
      );

      const toAdd: StdResult[] = [];
      for (const w of want) {
        if (existingKeys.has(w.key)) continue;
        toAdd.push({
          id: tmpId('res'),
          testKey: w.key,
          testLabel: w.label,
          specimenSites: sites,
          status: 'planned',
          abnormal: false,
        });
      }

      if (!toAdd.length) return s;

      return {
        ...s,
        results: [...toAdd, ...s.results],
        banner: { kind: 'success', text: `Added ${toAdd.length} tracker row(s) from screening.` },
      };
    });
  }, []);

  const addCustomResult = React.useCallback((label: string) => {
    const clean = (label || '').trim();
    if (!clean) return;
    setState((s) => ({
      ...s,
      results: [
        {
          id: tmpId('res'),
          testLabel: clean,
          specimenSites: fmtSitesFromSelection(s.specimenSites),
          status: 'planned',
          abnormal: false,
        },
        ...s.results,
      ],
    }));
  }, []);

  const updateResult = React.useCallback((id: string, patch: Partial<StdResult>) => {
    setState((s) => ({
      ...s,
      results: s.results.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  }, []);

  const removeResult = React.useCallback((id: string) => {
    setState((s) => ({ ...s, results: s.results.filter((r) => r.id !== id) }));
  }, []);

  const exportOrdersAsFinding = React.useCallback(async () => {
    const snapshot = state.results;
    if (!snapshot.length) {
      setBanner({ kind: 'info', text: 'No results tracked yet.' });
      return;
    }
    await createManualFinding('tests_ordered', undefined, formatOrdersNote(snapshot));
  }, [createManualFinding, setBanner, state.results]);

  const exportResultsAsFinding = React.useCallback(async () => {
    const snapshot = state.results;
    if (!snapshot.length) {
      setBanner({ kind: 'info', text: 'No results tracked yet.' });
      return;
    }
    const note = formatResultsReviewNote({
      patientId,
      encounterId,
      results: snapshot,
      communications: state.communications,
    });
    await createManualFinding('results_review', undefined, note);
  }, [createManualFinding, encounterId, patientId, setBanner, state.communications, state.results]);

  // ---------------- Results communication events (Phase 1 local) ----------------
  const addCommunicationEvent = React.useCallback(
    (payload: {
      occurredAt?: string;
      method: StdResultCommunicationEvent['method'];
      summary: string;
      nextSteps?: string;
      acknowledgementStatus?: AckStatus;
    }) => {
      const occurredAt = payload.occurredAt?.trim() ? payload.occurredAt.trim() : nowISO();
      const ackStatus: AckStatus = payload.acknowledgementStatus || 'not_requested';

      const ev: StdResultCommunicationEvent = {
        id: tmpId('comm'),
        occurredAt,
        method: payload.method,
        summary: (payload.summary || '').trim(),
        nextSteps: payload.nextSteps?.trim() ? payload.nextSteps.trim() : undefined,
        acknowledgement: {
          status: ackStatus,
          requestedAt: ackStatus === 'requested' ? nowISO() : undefined,
          acknowledgedAt: ackStatus === 'acknowledged' ? nowISO() : undefined,
          declinedAt: ackStatus === 'declined' ? nowISO() : undefined,
          note: undefined,
        },
        createdBy: clinicianId,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };

      setState((s) => ({
        ...s,
        communications: [ev, ...s.communications],
        banner: { kind: 'success', text: 'Communication event recorded (local Phase 1).' },
      }));
    },
    [clinicianId]
  );

  const updateCommunicationEvent = React.useCallback(
    (id: string, patch: Partial<StdResultCommunicationEvent>) => {
      setState((s) => ({
        ...s,
        communications: s.communications.map((ev) =>
          ev.id === id
            ? {
                ...ev,
                ...patch,
                acknowledgement: patch.acknowledgement
                  ? { ...ev.acknowledgement, ...patch.acknowledgement }
                  : ev.acknowledgement,
                updatedAt: nowISO(),
              }
            : ev
        ),
      }));
    },
    []
  );

  const removeCommunicationEvent = React.useCallback((id: string) => {
    setState((s) => ({
      ...s,
      communications: s.communications.filter((ev) => ev.id !== id),
    }));
  }, []);

  const exportCommunicationCombo = React.useCallback(async () => {
    const comms = state.communications;
    if (!comms.length) {
      setBanner({ kind: 'info', text: 'No communication events recorded yet.' });
      return;
    }

    const review = formatResultsReviewNote({
      patientId,
      encounterId,
      results: state.results,
      communications: comms,
    });

    const follow = formatFollowUpPlanNote({
      followUpInterval: state.followUp.interval,
      safetyNet: state.followUp.safetyNet,
      communications: comms,
    });

    setState((s) => ({ ...s, busy: true }));
    try {
      await createManualFinding('results_review', undefined, review);
      await createManualFinding('follow_up_plan', undefined, follow);
      setBanner({ kind: 'success', text: 'Exported communication → results review + follow-up plan.' });
    } catch {
      // createManualFinding already banners
    } finally {
      setState((s) => ({ ...s, busy: false }));
    }
  }, [
    createManualFinding,
    encounterId,
    patientId,
    setBanner,
    state.communications,
    state.followUp.interval,
    state.followUp.safetyNet,
    state.results,
  ]);

  return {
    patientId,
    encounterId,
    clinicianId,

    state,
    setState,

    selectedEvidence,
    sensitiveMaskClass,
    riskLevel,

    findingsForContext,
    evidenceForContext,
    contextCounts,
    evidenceCountForFinding,

    summaryNote,

    actions: {
      setBanner,
      setContext: (context: ContextKey) => setState((s) => ({ ...s, context })),
      setBookmarkOpen: (open: boolean) => setState((s) => ({ ...s, bookmarkOpen: open })),
      setSelectedEvidenceId: (id: string | null) =>
        setState((s) => ({ ...s, selectedEvidenceId: id })),
      setPrivacyMode: (v: boolean) => setState((s) => ({ ...s, privacyMode: v })),
      setShowSensitive: (v: boolean) => setState((s) => ({ ...s, showSensitive: v })),

      toggleConsent: (k: keyof StdState['consent']) =>
        setState((s) => ({ ...s, consent: { ...s.consent, [k]: !s.consent[k] } })),

      toggleSymptom: (k: keyof StdState['symptoms']) =>
        setState((s) => ({ ...s, symptoms: { ...s.symptoms, [k]: !s.symptoms[k] } })),
      toggleScreening: (k: keyof StdState['screening']) =>
        setState((s) => ({ ...s, screening: { ...s.screening, [k]: !s.screening[k] } })),
      toggleUrgency: (k: keyof StdState['urgencyFlags']) =>
        setState((s) => ({
          ...s,
          urgencyFlags: { ...s.urgencyFlags, [k]: !s.urgencyFlags[k] },
        })),
      toggleRisk: (k: keyof StdState['riskFactors']) =>
        setState((s) => ({ ...s, riskFactors: { ...s.riskFactors, [k]: !s.riskFactors[k] } })),
      toggleSite: (k: keyof StdState['specimenSites']) =>
        setState((s) => ({ ...s, specimenSites: { ...s.specimenSites, [k]: !s.specimenSites[k] } })),

      setExposureWindowDays: (v: string) => setState((s) => ({ ...s, exposureWindowDays: v })),
      setNotes: (v: string) => setState((s) => ({ ...s, notes: v })),

      setPartnerPlan: (patch: Partial<StdState['partnerPlan']>) =>
        setState((s) => ({ ...s, partnerPlan: { ...s.partnerPlan, ...patch } })),
      setPreventionPlan: (patch: Partial<StdState['preventionPlan']>) =>
        setState((s) => ({ ...s, preventionPlan: { ...s.preventionPlan, ...patch } })),
      setFollowUp: (patch: Partial<StdState['followUp']>) =>
        setState((s) => ({ ...s, followUp: { ...s.followUp, ...patch } })),

      applySuggestedDefaults,
      addStructuredFindingsFromChecklist,

      createManualFinding,
      handleBookmark,
      addDemoPinAnnotation,

      copySummaryNote,
      exportSummaryAsFinding,

      // Results tracker
      seedResultsFromScreening,
      addCustomResult,
      updateResult,
      removeResult,
      exportOrdersAsFinding,
      exportResultsAsFinding,

      // Communication events
      addCommunicationEvent,
      updateCommunicationEvent,
      removeCommunicationEvent,
      exportCommunicationCombo,
    },
  };
}
