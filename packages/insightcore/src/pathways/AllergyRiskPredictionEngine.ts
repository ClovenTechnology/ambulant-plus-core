import type { EvidenceItem, FeatureVector, InferenceOutput, RiskLevel } from '../contracts';
import type { PersonalBaselineSnapshot } from '../contracts/research';

type AllergySeverity = 'Mild' | 'Moderate' | 'Severe' | 'mild' | 'moderate' | 'severe';

type AllergyProfileItem = {
  id?: string;
  substance: string;
  reaction?: string | null;
  severity?: AllergySeverity | string | null;
  status?: 'Active' | 'Resolved' | string | null;
  notedAt?: string | null;
};

type AllergyReactionLogItem = {
  id?: string;
  occurredAtISO?: string;
  occurredAt?: string;
  suspectedTrigger: string;
  symptoms?: string[];
  severity?: 'mild' | 'moderate' | 'severe' | string | null;
  medsTaken?: string | null;
  notes?: string | null;
  resolvedAtISO?: string | null;
  resolvedAt?: string | null;
};

type AllergyFeatureVector = FeatureVector & {
  allergyProfiles?: AllergyProfileItem[];
  allergyReactionLogs?: AllergyReactionLogItem[];
};

type PatternSummary = {
  repeatedTriggerCount: number;
  recentReactionCount30d: number;
  severeReactionCount: number;
  unresolvedRecentCount: number;
  respiratoryOrSwellingCount: number;
  worseningSeverity: boolean;
  primaryTrigger?: string | null;
};

const RESPIRATORY_OR_SWELLING = [
  'wheeze',
  'wheezing',
  'shortness of breath',
  'breathless',
  'breathing',
  'swelling',
  'angioedema',
  'throat',
  'tongue',
  'lip',
  'facial swelling',
  'anaphylaxis',
];

function norm(s: unknown) {
  return String(s || '').trim().toLowerCase();
}

function severityRank(value: unknown) {
  const s = norm(value);
  if (s === 'severe') return 3;
  if (s === 'moderate') return 2;
  if (s === 'mild') return 1;
  return 0;
}

function riskFromScore(score: number): RiskLevel {
  if (score >= 0.9) return 'critical';
  if (score >= 0.72) return 'high';
  if (score >= 0.48) return 'moderate';
  return 'low';
}

function daysAgo(iso?: string | null) {
  if (!iso) return Number.POSITIVE_INFINITY;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
  return (Date.now() - d.getTime()) / 86400000;
}

function evidence(
  code: string,
  label: string,
  value?: string | number | boolean | null,
  observedAt?: string | null,
  weight = 0.62,
): EvidenceItem {
  return {
    code,
    label,
    value,
    source: 'allergy',
    observedAt: observedAt || undefined,
    weight,
  };
}

function uniqueEvidence(items: EvidenceItem[]) {
  const seen = new Set<string>();
  const out: EvidenceItem[] = [];
  for (const item of items) {
    const key = `${item.code}:${item.label}:${item.observedAt || ''}:${item.value ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function containsRespiratoryOrSwelling(xs: string[]) {
  const hay = xs.map(norm).join(' ');
  return RESPIRATORY_OR_SWELLING.some((term) => hay.includes(term));
}

function summarizePatterns(logs: AllergyReactionLogItem[]): PatternSummary {
  const triggerCounts = new Map<string, number>();
  let recentReactionCount30d = 0;
  let severeReactionCount = 0;
  let unresolvedRecentCount = 0;
  let respiratoryOrSwellingCount = 0;

  const sorted = [...logs].sort((a, b) => {
    const at = new Date(a.occurredAtISO || a.occurredAt || 0).getTime();
    const bt = new Date(b.occurredAtISO || b.occurredAt || 0).getTime();
    return at - bt;
  });

  for (const log of sorted) {
    const trigger = norm(log.suspectedTrigger);
    if (trigger) triggerCounts.set(trigger, (triggerCounts.get(trigger) || 0) + 1);

    const occurred = log.occurredAtISO || log.occurredAt || null;
    if (daysAgo(occurred) <= 30) recentReactionCount30d += 1;
    if (severityRank(log.severity) >= 3) severeReactionCount += 1;

    const resolved = log.resolvedAtISO || log.resolvedAt || null;
    if (!resolved && daysAgo(occurred) <= 14) unresolvedRecentCount += 1;

    if (containsRespiratoryOrSwelling([
      ...(Array.isArray(log.symptoms) ? log.symptoms : []),
      log.notes || '',
      log.medsTaken || '',
    ])) {
      respiratoryOrSwellingCount += 1;
    }
  }

  const repeatedTriggerCount = [...triggerCounts.values()].filter((count) => count >= 2).length;
  const primaryTrigger = [...triggerCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const severities = sorted.map((log) => severityRank(log.severity)).filter((rank) => rank > 0);
  const worseningSeverity = severities.length >= 2 && severities[severities.length - 1] > severities[0];

  return {
    repeatedTriggerCount,
    recentReactionCount30d,
    severeReactionCount,
    unresolvedRecentCount,
    respiratoryOrSwellingCount,
    worseningSeverity,
    primaryTrigger,
  };
}

export class AllergyRiskPredictionEngine {
  async run(
    patientId: string,
    fv: AllergyFeatureVector,
    baseline?: PersonalBaselineSnapshot | null,
  ): Promise<InferenceOutput[]> {
    const profiles = Array.isArray(fv.allergyProfiles) ? fv.allergyProfiles : [];
    const logs = Array.isArray(fv.allergyReactionLogs) ? fv.allergyReactionLogs : [];
    const legacyAllergies = Array.isArray(fv.allergies) ? fv.allergies : [];

    if (!profiles.length && !logs.length && !legacyAllergies.length) return [];

    const now = new Date().toISOString();
    const ev: EvidenceItem[] = [];
    const rationale: string[] = [];

    const activeProfiles = profiles.filter((a) => norm(a.status || 'Active') !== 'resolved');
    const severeKnownProfiles = activeProfiles.filter((a) => severityRank(a.severity) >= 3);
    const anaphylaxisProfiles = activeProfiles.filter((a) =>
      norm(`${a.substance} ${a.reaction}`).includes('anaphylaxis'),
    );

    for (const item of severeKnownProfiles.slice(0, 6)) {
      ev.push(evidence(
        `allergy.profile.severe.${norm(item.substance).replace(/[^a-z0-9]+/g, '_')}`,
        `Severe allergy profile: ${item.substance}`,
        item.reaction || item.severity || 'Severe',
        item.notedAt,
        0.78,
      ));
    }

    for (const item of anaphylaxisProfiles.slice(0, 4)) {
      ev.push(evidence(
        `allergy.profile.anaphylaxis.${norm(item.substance).replace(/[^a-z0-9]+/g, '_')}`,
        `Anaphylaxis history: ${item.substance}`,
        item.reaction || 'Anaphylaxis',
        item.notedAt,
        0.9,
      ));
    }

    for (const name of legacyAllergies.slice(0, 8)) {
      ev.push(evidence(
        `allergy.profile.legacy.${norm(name).replace(/[^a-z0-9]+/g, '_')}`,
        `Known allergy: ${name}`,
        true,
        undefined,
        0.5,
      ));
    }

    const patterns = summarizePatterns(logs);

    for (const log of logs.slice(0, 12)) {
      const observedAt = log.occurredAtISO || log.occurredAt || undefined;
      const rank = severityRank(log.severity);
      if (rank >= 2 || daysAgo(observedAt) <= 30) {
        ev.push(evidence(
          `allergy.reaction.${norm(log.suspectedTrigger).replace(/[^a-z0-9]+/g, '_')}`,
          `Reaction log: ${log.suspectedTrigger}`,
          log.severity || 'unknown',
          observedAt,
          rank >= 3 ? 0.82 : rank === 2 ? 0.68 : 0.54,
        ));
      }
    }

    const baselineAbnormal =
      baseline?.deviations?.filter((d) =>
        d.abnormal && ['hr', 'spo2', 'tempC', 'hrv'].includes(d.metric),
      ) || [];

    const respiratoryOrSwelling = patterns.respiratoryOrSwellingCount > 0;
    const hasLowSpo2 = Boolean(fv.lowSpo2 || (typeof fv.spo2 === 'number' && fv.spo2 < 94));
    const hasTachycardia = Boolean(fv.tachycardia || (typeof fv.hr === 'number' && fv.hr >= 110));
    const hasFever = Boolean(fv.fever || (typeof fv.tempC === 'number' && fv.tempC >= 38));

    if (baselineAbnormal.length) {
      ev.push(...baselineAbnormal.map((d) => ({
        code: `allergy.baseline.amplifier.${d.metric}`,
        label: `Baseline amplifier: ${d.metric}`,
        value: typeof d.deltaPct === 'number' ? d.deltaPct : d.delta,
        source: 'composite' as const,
        observedAt: baseline?.generatedAt,
        weight: 0.58,
      })));
    }

    const score =
      (severeKnownProfiles.length > 0 ? 0.18 : 0) +
      (anaphylaxisProfiles.length > 0 ? 0.24 : 0) +
      Math.min(0.18, patterns.severeReactionCount * 0.09) +
      Math.min(0.18, patterns.recentReactionCount30d * 0.06) +
      Math.min(0.14, patterns.repeatedTriggerCount * 0.07) +
      (patterns.worseningSeverity ? 0.1 : 0) +
      Math.min(0.12, patterns.unresolvedRecentCount * 0.06) +
      (respiratoryOrSwelling ? 0.14 : 0) +
      (hasLowSpo2 && respiratoryOrSwelling ? 0.13 : 0) +
      (hasTachycardia && patterns.recentReactionCount30d > 0 ? 0.08 : 0) +
      (hasFever && patterns.recentReactionCount30d > 0 ? 0.04 : 0) +
      Math.min(0.1, baselineAbnormal.length * 0.035);

    const finalScore = Math.min(1, Number(score.toFixed(3)));
    if (finalScore < 0.42) return [];

    const riskLevel = riskFromScore(finalScore);

    if (severeKnownProfiles.length) rationale.push('Active severe allergy profile is present.');
    if (anaphylaxisProfiles.length) rationale.push('Documented anaphylaxis history raises safety priority.');
    if (patterns.recentReactionCount30d) rationale.push(`${patterns.recentReactionCount30d} reaction log(s) were recorded in the last 30 days.`);
    if (patterns.repeatedTriggerCount) rationale.push('Repeated suspected triggers suggest a recurring exposure pattern.');
    if (patterns.worseningSeverity) rationale.push('Reaction severity appears to be worsening over time.');
    if (respiratoryOrSwelling) rationale.push('Reaction history includes respiratory symptoms or swelling signals.');
    if (hasLowSpo2 && respiratoryOrSwelling) rationale.push('Low oxygen saturation combined with allergic respiratory/swelling history increases concern.');
    if (baselineAbnormal.length) rationale.push('Current physiology deviates from personal baseline in domains relevant to allergy risk.');

    const signalQuality = ev.length >= 5 ? 0.82 : ev.length >= 3 ? 0.7 : 0.56;
    const dataCompleteness = profiles.length && logs.length ? 0.78 : profiles.length || logs.length ? 0.58 : 0.42;
    const contextStrength = severeKnownProfiles.length || anaphylaxisProfiles.length || patterns.repeatedTriggerCount ? 0.82 : 0.58;
    const trendStrength = patterns.worseningSeverity || patterns.recentReactionCount30d >= 2 ? 0.76 : patterns.recentReactionCount30d === 1 ? 0.54 : 0.36;

    const confidence = Math.min(0.92, Number((0.42 + finalScore * 0.32 + dataCompleteness * 0.12).toFixed(3)));

    return [{
      patientId,
      model: 'allergy-risk-prediction-engine',
      syndrome: 'allergy_risk',
      output: {
        triggered: true,
        ruleId: 'allergy.risk.pattern.1',
        score: finalScore,
        riskLevel,
        primaryTrigger: patterns.primaryTrigger || null,
        severeKnownAllergyCount: severeKnownProfiles.length,
        anaphylaxisHistoryCount: anaphylaxisProfiles.length,
        recentReactionCount30d: patterns.recentReactionCount30d,
        repeatedTriggerCount: patterns.repeatedTriggerCount,
        unresolvedRecentCount: patterns.unresolvedRecentCount,
        respiratoryOrSwelling,
        baselineAmplifierCount: baselineAbnormal.length,
      },
      confidence,
      confidenceBreakdown: {
        signalQuality,
        dataCompleteness,
        contextStrength,
        trendStrength,
        modelAgreement: 0.68,
        overall: confidence,
      },
      timestamp: now,
      evidence: uniqueEvidence(ev),
      rationale,
    }];
  }
}
