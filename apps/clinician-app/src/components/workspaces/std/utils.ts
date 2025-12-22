// apps/clinician-app/src/components/workspaces/std/utils.ts
'use client';

import type { Location } from '@/src/lib/workspaces/types';

export function nowISO() {
  return new Date().toISOString();
}

export function tmpId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

export function errMsg(e: unknown) {
  if (!e) return 'Unknown error';
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message || 'Error';
  try {
    return JSON.stringify(e);
  } catch {
    return 'Unknown error';
  }
}

export function safeJsonParse<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function locationForContext(context: string): Location {
  // Keep this minimal + consistent so it works with your existing filtering logic:
  // useStdWorkspace checks: loc.kind === 'std' and loc.context in screening|symptomatic|follow_up
  return {
    kind: 'std',
    context,
  } as unknown as Location;
}

export type RiskLevelKey = 'low' | 'moderate' | 'high' | 'urgent';

export type RiskLevel = {
  key: RiskLevelKey;
  label: string;
  score: number;
  rationale: string[];
};

export function computeRiskLevel(input: {
  riskFactors: Record<string, boolean>;
  symptoms: Record<string, boolean>;
  urgencyFlags: Record<string, boolean>;
}): RiskLevel {
  const { riskFactors, symptoms, urgencyFlags } = input;

  const rationale: string[] = [];
  let score = 0;

  // Urgency overrides
  const urgentKeys = Object.entries(urgencyFlags).filter(([, v]) => v).map(([k]) => k);
  if (urgentKeys.length) {
    rationale.push(`Urgency flags: ${urgentKeys.join(', ')}`);
    return { key: 'urgent', label: 'Urgent', score: 99, rationale };
  }

  // Risk factor weights (simple heuristic)
  const rfWeights: Record<string, number> = {
    knownExposure: 3,
    newPartnerRecent: 2,
    multiplePartners: 2,
    inconsistentBarrierUse: 2,
    priorSTI: 1,
    immunocompromise: 2,
    onPrep: 0,
    recentPep: 1,
  };

  for (const [k, v] of Object.entries(riskFactors)) {
    if (!v) continue;
    const w = rfWeights[k] ?? 1;
    score += w;
    rationale.push(`Risk factor: ${k} (+${w})`);
  }

  // Symptom weights
  const sxWeights: Record<string, number> = {
    sores: 3,
    discharge: 2,
    dysuria: 2,
    pelvicPain: 2,
    testicularPain: 2,
    rash: 1,
    itching: 1,
    soreThroat: 1,
    rectalPain: 1,
  };

  for (const [k, v] of Object.entries(symptoms)) {
    if (!v) continue;
    const w = sxWeights[k] ?? 1;
    score += w;
    rationale.push(`Symptom: ${k} (+${w})`);
  }

  let key: RiskLevelKey = 'low';
  let label = 'Low';

  if (score >= 7) {
    key = 'high';
    label = 'High';
  } else if (score >= 3) {
    key = 'moderate';
    label = 'Moderate';
  }

  return { key, label, score, rationale };
}

/* ------------------------------------------------------------------
   Your existing summary builder (kept + exported)
------------------------------------------------------------------- */
export function buildSummaryNote(input: {
  contextLabel: string;
  patientId: string;
  encounterId: string;

  consent: {
    sensitiveHistoryDoc: boolean;
    mediaCapture: boolean;
    partnerGuidanceDiscussed: boolean;
  };

  urgencyFlags: Record<string, boolean>;
  riskLevelLabel: string;

  symptoms: Record<string, boolean>;
  exposureWindowDays: string;
  notes: string;

  riskFactors: Record<string, boolean>;

  screening: Record<string, boolean>;
  specimenSites: Record<string, boolean>;

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

  results?: Array<{
    testLabel: string;
    specimenSites?: string[];
    status: string;
    orderedDate?: string;
    collectedDate?: string;
    resultedDate?: string;
    abnormal?: boolean;
    resultText?: string;
    interpretation?: string;
    notes?: string;
  }>;
}) {
  const {
    contextLabel,
    patientId,
    encounterId,
    consent,
    urgencyFlags,
    riskLevelLabel,
    symptoms,
    exposureWindowDays,
    notes,
    riskFactors,
    screening,
    specimenSites,
    partnerPlan,
    preventionPlan,
    followUp,
    results,
  } = input;

  const lines: string[] = [];
  const picked = (obj: Record<string, boolean>) =>
    Object.entries(obj)
      .filter(([, v]) => v)
      .map(([k]) => k);

  lines.push('Sexual Health Consult (STD) — Summary (Draft)');
  lines.push(`Context: ${contextLabel}`);
  lines.push(`Patient: ${patientId} · Encounter: ${encounterId}`);
  lines.push('');

  lines.push('Consent / Confidentiality:');
  lines.push(`- Sensitive history documented: ${consent.sensitiveHistoryDoc ? 'Yes' : 'Not marked'}`);
  lines.push(`- Media capture consent: ${consent.mediaCapture ? 'Yes' : 'Not marked'}`);
  lines.push(`- Partner guidance discussed: ${consent.partnerGuidanceDiscussed ? 'Yes' : 'Not marked'}`);
  lines.push('');

  lines.push('Triage:');
  const urg = picked(urgencyFlags);
  lines.push(`- Urgency flags: ${urg.length ? urg.join(', ') : 'None marked'}`);
  lines.push(`- Risk level (heuristic): ${riskLevelLabel}`);
  lines.push('');

  const sx = picked(symptoms);
  lines.push('Symptoms:');
  lines.push(`- ${sx.length ? sx.join(', ') : 'None marked'}`);
  if (exposureWindowDays.trim()) lines.push(`- Days since possible exposure: ${exposureWindowDays.trim()}`);
  if (notes.trim()) lines.push(`- Notes: ${notes.trim()}`);
  lines.push('');

  const rf = picked(riskFactors);
  lines.push('Risk factors (as captured):');
  lines.push(`- ${rf.length ? rf.join(', ') : 'None marked'}`);
  lines.push('');

  const tests = picked(screening);
  const sites = picked(specimenSites);
  lines.push('Tests / Screening:');
  lines.push(`- Selected: ${tests.length ? tests.join(', ') : 'None selected'}`);
  lines.push(`- Specimen sites: ${sites.length ? sites.join(', ') : 'Not specified'}`);
  lines.push('');

  if (results && results.length) {
    lines.push('Results tracker:');
    for (const r of results) {
      const siteTxt = r.specimenSites?.length ? ` · sites: ${r.specimenSites.join(', ')}` : '';
      const dateBits = [
        r.orderedDate ? `ordered ${r.orderedDate}` : null,
        r.collectedDate ? `collected ${r.collectedDate}` : null,
        r.resultedDate ? `resulted ${r.resultedDate}` : null,
      ].filter(Boolean);
      const dateTxt = dateBits.length ? ` · ${dateBits.join(' · ')}` : '';
      const abn = r.abnormal ? ' · abnormal' : '';
      lines.push(`- ${r.testLabel} · ${r.status}${abn}${siteTxt}${dateTxt}`);
      if (r.resultText?.trim()) lines.push(`  Result: ${r.resultText.trim()}`);
      if (r.interpretation?.trim()) lines.push(`  Interpretation: ${r.interpretation.trim()}`);
      if (r.notes?.trim()) lines.push(`  Notes: ${r.notes.trim()}`);
    }
    lines.push('');
  }

  lines.push('Partner plan:');
  lines.push(`- Notify partners: ${partnerPlan.notifyPartners ? 'Yes' : 'No/Not marked'}`);
  lines.push(
    `- Expedited partner therapy (policy dependent): ${
      partnerPlan.expeditedPartnerTherapy ? 'Yes' : 'No/Not marked'
    }`
  );
  lines.push(`- Abstain until cleared / advised: ${partnerPlan.abstainUntilCleared ? 'Yes' : 'No/Not marked'}`);
  lines.push(`- Retest: ${partnerPlan.retestInterval || 'Not specified'}`);
  lines.push('');

  lines.push('Prevention:');
  lines.push(`- Safer sex counselling: ${preventionPlan.saferSexCounselling ? 'Done' : 'Not marked'}`);
  lines.push(`- PrEP discussed (where appropriate): ${preventionPlan.prepDiscussed ? 'Done' : 'Not marked'}`);
  lines.push(
    `- Vaccinations (Hep B/HPV) considered: ${
      preventionPlan.vaccinationHepB || preventionPlan.vaccinationHPV ? 'Yes' : 'Not marked'
    }`
  );
  lines.push('');

  lines.push('Follow-up:');
  lines.push(`- Interval: ${followUp.interval || 'Not specified'}`);
  lines.push(`- Safety net: ${followUp.safetyNet || 'Not specified'}`);

  return lines.join('\n');
}
