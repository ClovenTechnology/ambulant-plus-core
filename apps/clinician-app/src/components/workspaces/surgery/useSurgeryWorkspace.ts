// File: apps/clinician-app/src/components/workspaces/surgery/useSurgeryWorkspace.ts
'use client';

import React from 'react';
import type { Finding } from '@/src/lib/workspaces/types';
import { postFinding } from '@/src/lib/workspaces/api';

import type {
  SurgeryDomainKey,
  SurgeryFindingTypeKey,
  SurgeryPriority,
} from './constants';
import {
  SURGERY_DOMAINS,
  SURGERY_FINDING_TYPES,
} from './constants';
import {
  errMsg,
  locationForSurgery,
  nowISO,
  pctChecklist,
  persistKey,
  safeJsonParse,
  tmpId,
} from './utils';

type Banner = { kind: 'info' | 'success' | 'error'; text: string } | null;

export type SurgeryWorkspaceProps = {
  patientId?: string;
  encounterId?: string;
  clinicianId?: string;
};

export type SafetyChecklist = {
  identityConfirmed: boolean;
  consentConfirmed: boolean;
  procedureConfirmed: boolean;
  sideSiteMarked: boolean;
  allergiesChecked: boolean;
  anticoagReviewed: boolean;
  fastingStatusChecked: boolean;
  antibioticProphylaxisPlanned: boolean;
  bloodProductPlan: boolean;
  implantsAvailable: boolean;
  equipmentCheckComplete: boolean;
  whoTimeoutComplete: boolean;
};

export type ProcedureNote = {
  procedureName: string;
  approach: string;
  anesthesia: string;
  findings: string;
  stepsSummary: string;
  bloodLossMl: string;
  specimensSent: string;
  implantsDevices: string;
  complications: string;
  disposition: string;
};

export type PostOpPlan = {
  analgesiaPlan: string;
  antibioticPlan: string;
  dvtPlan: string;
  woundCare: string;
  mobilization: string;
  nutrition: string;
  redFlags: string;
  followUpDate: string;
  followUpNotes: string;
};

export type SurgeryState = {
  domain: SurgeryDomainKey;
  priority: SurgeryPriority;
  privacyMode: boolean;

  preOpDiagnosis: string;
  indication: string;
  risksNotes: string;
  allergyNotes: string;
  medicationNotes: string;

  checklist: SafetyChecklist;
  procedure: ProcedureNote;
  postOp: PostOpPlan;

  findings: Finding[];

  busy: boolean;
  banner: Banner;
};

type Persisted = Omit<SurgeryState, 'busy' | 'banner'>;

const DEFAULT_CHECKLIST: SafetyChecklist = {
  identityConfirmed: false,
  consentConfirmed: false,
  procedureConfirmed: false,
  sideSiteMarked: false,
  allergiesChecked: false,
  anticoagReviewed: false,
  fastingStatusChecked: false,
  antibioticProphylaxisPlanned: false,
  bloodProductPlan: false,
  implantsAvailable: false,
  equipmentCheckComplete: false,
  whoTimeoutComplete: false,
};

const DEFAULT_PROCEDURE: ProcedureNote = {
  procedureName: '',
  approach: '',
  anesthesia: '',
  findings: '',
  stepsSummary: '',
  bloodLossMl: '',
  specimensSent: '',
  implantsDevices: '',
  complications: '',
  disposition: '',
};

const DEFAULT_POSTOP: PostOpPlan = {
  analgesiaPlan: '',
  antibioticPlan: '',
  dvtPlan: '',
  woundCare: '',
  mobilization: '',
  nutrition: '',
  redFlags: '',
  followUpDate: '',
  followUpNotes: '',
};

const DEFAULT_STATE: SurgeryState = {
  domain: 'general',
  priority: 'routine',
  privacyMode: false,

  preOpDiagnosis: '',
  indication: '',
  risksNotes: '',
  allergyNotes: '',
  medicationNotes: '',

  checklist: DEFAULT_CHECKLIST,
  procedure: DEFAULT_PROCEDURE,
  postOp: DEFAULT_POSTOP,

  findings: [],

  busy: false,
  banner: null,
};

function toPersisted(s: SurgeryState): Persisted {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { busy, banner, ...rest } = s;
  return rest;
}

function findingLabel(type: SurgeryFindingTypeKey) {
  return SURGERY_FINDING_TYPES.find((x) => x.key === type)?.label ?? 'Surgical finding';
}

function formatPreOpNote(state: SurgeryState, meta: { patientId: string; encounterId: string }) {
  const lines: string[] = [];
  lines.push('Pre-op assessment');
  lines.push(`Patient: ${meta.patientId} · Encounter: ${meta.encounterId}`);
  lines.push(`Domain: ${state.domain} · Priority: ${state.priority}`);
  lines.push('');
  lines.push(`Diagnosis: ${state.preOpDiagnosis || 'Not specified'}`);
  lines.push(`Indication: ${state.indication || 'Not specified'}`);
  lines.push(`Risks/anesthesia notes: ${state.risksNotes || 'Not specified'}`);
  lines.push(`Allergies: ${state.allergyNotes || 'Not specified'}`);
  lines.push(`Medications/anticoag: ${state.medicationNotes || 'Not specified'}`);
  return lines.join('\n');
}

function formatProcedureNote(state: SurgeryState, meta: { patientId: string; encounterId: string }) {
  const lines: string[] = [];
  lines.push('Procedure note');
  lines.push(`Patient: ${meta.patientId} · Encounter: ${meta.encounterId}`);
  lines.push(`Domain: ${state.domain} · Priority: ${state.priority}`);
  lines.push('');
  lines.push(`Procedure: ${state.procedure.procedureName || 'Not specified'}`);
  lines.push(`Approach: ${state.procedure.approach || 'Not specified'}`);
  lines.push(`Anesthesia: ${state.procedure.anesthesia || 'Not specified'}`);
  lines.push(`Findings: ${state.procedure.findings || 'Not specified'}`);
  lines.push(`Steps summary: ${state.procedure.stepsSummary || 'Not specified'}`);
  lines.push(`Estimated blood loss (ml): ${state.procedure.bloodLossMl || 'Not specified'}`);
  lines.push(`Specimens sent: ${state.procedure.specimensSent || 'Not specified'}`);
  lines.push(`Implants/devices: ${state.procedure.implantsDevices || 'Not specified'}`);
  lines.push(`Complications: ${state.procedure.complications || 'None noted'}`);
  lines.push(`Disposition: ${state.procedure.disposition || 'Not specified'}`);
  lines.push('');
  lines.push('Safety checklist:');
  for (const [k, v] of Object.entries(state.checklist)) lines.push(`- ${k}: ${v ? 'Yes' : 'No'}`);
  return lines.join('\n');
}

function formatPostOpNote(state: SurgeryState, meta: { patientId: string; encounterId: string }) {
  const lines: string[] = [];
  lines.push('Post-op plan');
  lines.push(`Patient: ${meta.patientId} · Encounter: ${meta.encounterId}`);
  lines.push(`Domain: ${state.domain} · Priority: ${state.priority}`);
  lines.push('');
  lines.push(`Analgesia: ${state.postOp.analgesiaPlan || 'Not specified'}`);
  lines.push(`Antibiotics: ${state.postOp.antibioticPlan || 'Not specified'}`);
  lines.push(`DVT prophylaxis: ${state.postOp.dvtPlan || 'Not specified'}`);
  lines.push(`Wound care: ${state.postOp.woundCare || 'Not specified'}`);
  lines.push(`Mobilization: ${state.postOp.mobilization || 'Not specified'}`);
  lines.push(`Nutrition: ${state.postOp.nutrition || 'Not specified'}`);
  lines.push(`Red flags advised: ${state.postOp.redFlags || 'Not specified'}`);
  lines.push(`Follow-up date: ${state.postOp.followUpDate || 'Not set'}`);
  lines.push(`Follow-up notes: ${state.postOp.followUpNotes || 'Not specified'}`);
  return lines.join('\n');
}

function formatSummary(state: SurgeryState, meta: { patientId: string; encounterId: string; clinicianId: string }) {
  return [
    'Surgery Workspace Summary (Draft)',
    `Generated: ${nowISO()}`,
    `Patient: ${meta.patientId} · Encounter: ${meta.encounterId} · Clinician: ${meta.clinicianId}`,
    `Domain: ${state.domain} · Priority: ${state.priority}`,
    `Checklist completion: ${pctChecklist(state.checklist)}%`,
    '',
    formatPreOpNote(state, meta),
    '',
    formatProcedureNote(state, meta),
    '',
    formatPostOpNote(state, meta),
  ].join('\n');
}

export function useSurgeryWorkspace(props: SurgeryWorkspaceProps) {
  const patientId = props.patientId ?? 'pat_demo_001';
  const encounterId = props.encounterId ?? 'enc_demo_001';
  const clinicianId = props.clinicianId ?? 'clin_demo_001';

  const [state, setState] = React.useState<SurgeryState>(DEFAULT_STATE);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(persistKey(encounterId));
    const parsed = safeJsonParse<Persisted>(raw);
    if (parsed) {
      setState({ ...DEFAULT_STATE, ...parsed, busy: false, banner: null });
    } else {
      setState({ ...DEFAULT_STATE, busy: false, banner: null });
    }
  }, [encounterId]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = window.setTimeout(() => {
      window.localStorage.setItem(persistKey(encounterId), JSON.stringify(toPersisted(state)));
    }, 250);
    return () => window.clearTimeout(t);
  }, [encounterId, state]);

  const selectedDomain = React.useMemo(
    () => SURGERY_DOMAINS.find((d) => d.key === state.domain) ?? SURGERY_DOMAINS[0],
    [state.domain]
  );

  const checklistCompletion = React.useMemo(
    () => pctChecklist(state.checklist),
    [state.checklist]
  );

  const summaryNote = React.useMemo(
    () => formatSummary(state, { patientId, encounterId, clinicianId }),
    [state, patientId, encounterId, clinicianId]
  );

  const setBanner = React.useCallback((banner: Banner) => {
    setState((s) => ({ ...s, banner }));
  }, []);

  const createFinding = React.useCallback(
    async (type: SurgeryFindingTypeKey, note: string, opts?: { severity?: Finding['severity'] }) => {
      const title = findingLabel(type);
      const location = locationForSurgery({ domain: state.domain, priority: state.priority });

      const optimisticId = tmpId('surg_fd');
      const optimistic: Finding = {
        id: optimisticId,
        patientId,
        encounterId,
        specialty: 'surgery',
        status: 'draft',
        title,
        note,
        severity: opts?.severity,
        tags: ['surgery', state.domain, state.priority, type],
        location,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        createdBy: clinicianId,
        meta: {},
      };

      setState((s) => ({ ...s, findings: [optimistic, ...s.findings], banner: null }));

      try {
        const created = await postFinding({
          patientId,
          encounterId,
          specialty: 'surgery',
          title,
          status: 'draft',
          severity: opts?.severity,
          note,
          tags: ['surgery', state.domain, state.priority, type],
          location,
          createdBy: clinicianId,
          meta: { clientRequestId: optimisticId },
        });

        setState((s) => ({
          ...s,
          findings: s.findings.map((f) => (f.id === optimisticId ? created : f)),
          banner: { kind: 'success', text: `${title} exported.` },
        }));
      } catch (e) {
        setState((s) => ({
          ...s,
          findings: s.findings.filter((f) => f.id !== optimisticId),
          banner: { kind: 'error', text: `Failed to export ${title.toLowerCase()}: ${errMsg(e)}` },
        }));
        throw e;
      }
    },
    [clinicianId, encounterId, patientId, state.domain, state.priority]
  );

  const exportPreOpAsFinding = React.useCallback(async () => {
    const note = formatPreOpNote(state, { patientId, encounterId });
    await createFinding('pre_op_assessment', note);
  }, [createFinding, encounterId, patientId, state]);

  const exportProcedureAsFinding = React.useCallback(async () => {
    if (!state.checklist.identityConfirmed || !state.checklist.consentConfirmed) {
      setBanner({
        kind: 'info',
        text: 'Confirm identity + consent before exporting procedure note.',
      });
      return;
    }
    if (!state.procedure.procedureName.trim()) {
      setBanner({ kind: 'info', text: 'Procedure name is required.' });
      return;
    }
    const note = formatProcedureNote(state, { patientId, encounterId });
    await createFinding('procedure_note', note);
  }, [createFinding, encounterId, patientId, setBanner, state]);

  const exportPostOpAsFinding = React.useCallback(async () => {
    const note = formatPostOpNote(state, { patientId, encounterId });
    await createFinding('post_op_plan', note);
  }, [createFinding, encounterId, patientId, state]);

  const exportSummaryAsFinding = React.useCallback(async () => {
    await createFinding('peri_op_summary', summaryNote);
  }, [createFinding, summaryNote]);

  const copySummary = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(summaryNote);
      setBanner({ kind: 'success', text: 'Summary copied to clipboard.' });
    } catch {
      setBanner({ kind: 'error', text: 'Failed to copy note (clipboard unavailable).' });
    }
  }, [setBanner, summaryNote]);

  const resetAll = React.useCallback(() => {
    setState((s) => ({
      ...DEFAULT_STATE,
      findings: s.findings,
      banner: { kind: 'info', text: 'Workspace reset to defaults.' },
    }));
  }, []);

  return {
    patientId,
    encounterId,
    clinicianId,

    state,
    selectedDomain,
    checklistCompletion,
    summaryNote,

    actions: {
      setBanner,
      setDomain: (domain: SurgeryDomainKey) => setState((s) => ({ ...s, domain })),
      setPriority: (priority: SurgeryPriority) => setState((s) => ({ ...s, priority })),
      setPrivacyMode: (privacyMode: boolean) => setState((s) => ({ ...s, privacyMode })),

      setPreOpDiagnosis: (v: string) => setState((s) => ({ ...s, preOpDiagnosis: v })),
      setIndication: (v: string) => setState((s) => ({ ...s, indication: v })),
      setRisksNotes: (v: string) => setState((s) => ({ ...s, risksNotes: v })),
      setAllergyNotes: (v: string) => setState((s) => ({ ...s, allergyNotes: v })),
      setMedicationNotes: (v: string) => setState((s) => ({ ...s, medicationNotes: v })),

      toggleChecklist: (k: keyof SafetyChecklist) =>
        setState((s) => ({ ...s, checklist: { ...s.checklist, [k]: !s.checklist[k] } })),

      setProcedure: (patch: Partial<ProcedureNote>) =>
        setState((s) => ({ ...s, procedure: { ...s.procedure, ...patch } })),

      setPostOp: (patch: Partial<PostOpPlan>) =>
        setState((s) => ({ ...s, postOp: { ...s.postOp, ...patch } })),

      copySummary,
      resetAll,

      exportPreOpAsFinding,
      exportProcedureAsFinding,
      exportPostOpAsFinding,
      exportSummaryAsFinding,
    },
  };
}
