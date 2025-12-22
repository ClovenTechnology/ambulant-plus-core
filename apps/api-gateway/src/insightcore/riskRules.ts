// src/insightcore/riskRules.ts
import type { Syndrome } from './icd10SyndromeHelper';
import type { InsightRiskAlertSeverity } from './riskAlertTypes';

export interface RiskRuleDef {
  /** Canonical rule id stored in RuntimeEvent.payload.ruleId */
  id: string;

  /** Human name for admin / dashboards */
  name: string;

  /** Longer description for drill-down UIs */
  description: string;

  /** Primary syndrome this rule maps to (for filtering & grouping) */
  syndrome?: Syndrome;

  /**
   * Default severity if the writer hasn't set RuntimeEvent.severity explicitly.
   * Used as a baseline hint in admin UIs.
   */
  defaultSeverity: InsightRiskAlertSeverity;

  /**
   * Minimum score (0–100) that makes this rule worth showing as an alert at all.
   * Below this, you might treat it as "noise".
   */
  minScore: number;

  /**
   * Score at or above which the alert is considered "hard" / high-severity
   * IF you want to derive severity from score.
   */
  hardThreshold: number;

  /** Optional tags for faceted filtering in admin UI */
  tags?: string[];
}

/**
 * Canonical registry of InsightCore risk rules.
 *
 * NOTE:
 * - You can extend this as you add more rules.
 * - ruleId MUST match what you emit in RuntimeEvent.payload.ruleId.
 */
export const RISK_RULES: Record<string, RiskRuleDef> = {
  // ----- VITALS-DRIVEN RULES -----

  'vital.fever.tachy.1': {
    id: 'vital.fever.tachy.1',
    name: 'Fever + Tachycardia',
    description:
      'Temperature > 38°C and heart rate > 110 bpm within 30 minutes, suggestive of systemic infection or sepsis.',
    syndrome: 'systemicSepsis',
    defaultSeverity: 'high',
    minScore: 60,
    hardThreshold: 85,
    tags: ['vital', 'sepsis', 'acute'],
  },

  'vital.hypoxia.1': {
    id: 'vital.hypoxia.1',
    name: 'Resting Hypoxia',
    description:
      'SpO2 < 94% on room air, suggesting respiratory compromise or underlying cardiopulmonary disease.',
    syndrome: 'respiratory',
    defaultSeverity: 'moderate',
    minScore: 50,
    hardThreshold: 80,
    tags: ['vital', 'respiratory', 'acute'],
  },

  'vital.hypertension.stage2.1': {
    id: 'vital.hypertension.stage2.1',
    name: 'Stage 2 Hypertension Pattern',
    description:
      'Systolic BP ≥ 160 mmHg OR diastolic BP ≥ 100 mmHg on ≥ 2 readings within 24h.',
    syndrome: 'cardio',
    defaultSeverity: 'moderate',
    minScore: 50,
    hardThreshold: 85,
    tags: ['vital', 'cardio', 'chronic'],
  },

  'vital.hypertension.crisis.1': {
    id: 'vital.hypertension.crisis.1',
    name: 'Hypertensive Crisis',
    description:
      'Systolic BP ≥ 180 mmHg OR diastolic BP ≥ 120 mmHg, especially if associated with symptoms.',
    syndrome: 'cardio',
    defaultSeverity: 'high',
    minScore: 70,
    hardThreshold: 90,
    tags: ['vital', 'cardio', 'emergency'],
  },

  'vital.bradycardia.1': {
    id: 'vital.bradycardia.1',
    name: 'Marked Bradycardia',
    description:
      'Heart rate < 50 bpm at rest, outside of athletic conditioning context.',
    syndrome: 'cardio',
    defaultSeverity: 'moderate',
    minScore: 40,
    hardThreshold: 80,
    tags: ['vital', 'cardio'],
  },

  'vital.hyperglycemia.1': {
    id: 'vital.hyperglycemia.1',
    name: 'Marked Hyperglycaemia',
    description:
      'Random capillary glucose ≥ 11.1 mmol/L (200 mg/dL), suggesting poor diabetic control or new-onset diabetes.',
    syndrome: 'metabolic',
    defaultSeverity: 'moderate',
    minScore: 50,
    hardThreshold: 85,
    tags: ['vital', 'metabolic', 'diabetes'],
  },

  'vital.hypotension.sepsis.1': {
    id: 'vital.hypotension.sepsis.1',
    name: 'Hypotension with Infection Pattern',
    description:
      'Systolic BP < 90 mmHg or mean arterial pressure < 65 mmHg in a patient with signs of infection, suggestive of septic shock.',
    syndrome: 'systemicSepsis',
    defaultSeverity: 'high',
    minScore: 70,
    hardThreshold: 90,
    tags: ['vital', 'sepsis', 'emergency'],
  },

  // ----- LAB-DRIVEN RULES -----

  'lab.crp.high.1': {
    id: 'lab.crp.high.1',
    name: 'Very High CRP',
    description:
      'C-reactive protein value in the very high range, suggestive of significant systemic inflammation or infection.',
    syndrome: 'systemicSepsis',
    defaultSeverity: 'moderate',
    minScore: 50,
    hardThreshold: 85,
    tags: ['lab', 'inflammation', 'sepsis'],
  },

  'lab.wcc.high.1': {
    id: 'lab.wcc.high.1',
    name: 'Leukocytosis',
    description:
      'White cell count significantly above normal range, suggestive of infection, inflammation or other haematologic conditions.',
    syndrome: 'systemicSepsis',
    defaultSeverity: 'moderate',
    minScore: 50,
    hardThreshold: 85,
    tags: ['lab', 'inflammation', 'sepsis'],
  },

  'lab.ddimer.high.1': {
    id: 'lab.ddimer.high.1',
    name: 'High D-dimer',
    description:
      'D-dimer above diagnostic threshold, raising suspicion for venous thromboembolism (VTE) or other clotting disorders.',
    syndrome: 'cardio',
    defaultSeverity: 'high',
    minScore: 60,
    hardThreshold: 90,
    tags: ['lab', 'thrombosis', 'cardio'],
  },

  'lab.troponin.high.1': {
    id: 'lab.troponin.high.1',
    name: 'Raised Troponin',
    description:
      'Cardiac troponin above reference range, consistent with myocardial injury or infarction in the right clinical context.',
    syndrome: 'cardio',
    defaultSeverity: 'high',
    minScore: 70,
    hardThreshold: 90,
    tags: ['lab', 'cardio', 'emergency'],
  },

  // ----- COMPOSITE / MULTI-SIGNAL RULES -----

  'composite.sepsis.bundle.1': {
    id: 'composite.sepsis.bundle.1',
    name: 'Sepsis Bundle Risk',
    description:
      'Composite InsightCore score using fever, tachycardia, hypotension, elevated CRP/WCC and compatible syndromic profile.',
    syndrome: 'systemicSepsis',
    defaultSeverity: 'high',
    minScore: 60,
    hardThreshold: 90,
    tags: ['composite', 'sepsis', 'multi-signal'],
  },

  'composite.respiratory.deterioration.1': {
    id: 'composite.respiratory.deterioration.1',
    name: 'Respiratory Deterioration',
    description:
      'Composite pattern of worsening oxygen saturation, rising respiratory rate, respiratory ICD-10 diagnoses and/or abnormal chest imaging.',
    syndrome: 'respiratory',
    defaultSeverity: 'moderate',
    minScore: 50,
    hardThreshold: 85,
    tags: ['composite', 'respiratory', 'deterioration'],
  },

  'composite.cardio.acute.1': {
    id: 'composite.cardio.acute.1',
    name: 'Acute Cardiac Risk',
    description:
      'Composite pattern combining hypertensive crisis, chest-pain-related diagnoses and/or raised cardiac biomarkers.',
    syndrome: 'cardio',
    defaultSeverity: 'high',
    minScore: 60,
    hardThreshold: 90,
    tags: ['composite', 'cardio', 'acute'],
  },
};

/**
 * Lookup helper.
 */
export function getRiskRule(ruleId: string): RiskRuleDef | undefined {
  return RISK_RULES[ruleId];
}

/**
 * Optional helper: derive severity from a score using the rule thresholds.
 * You can use this in writers if you want to auto-populate RuntimeEvent.severity.
 */
export function classifySeverityForScore(
  ruleId: string,
  score: number,
): InsightRiskAlertSeverity {
  const rule = getRiskRule(ruleId);
  if (!rule) {
    // Fallback heuristic if rule isn’t known to the registry.
    if (score >= 85) return 'high';
    if (score >= 50) return 'moderate';
    return 'low';
  }

  if (score >= rule.hardThreshold) return 'high';
  if (score >= rule.minScore) return 'moderate';
  return 'low';
}
