// src/insightcore/riskAlertTypes.ts
import type { Syndrome } from './icd10SyndromeHelper';

/**
 * Canonical severity we expect in RuntimeEvent.severity
 * for kind = "insight.alert.risk".
 *
 * We conceptually map:
 *  - "low" / "moderate"  => "soft" alerts
 *  - "high"              => "hard" alerts
 */
export type InsightRiskAlertSeverity = 'low' | 'moderate' | 'high';

/**
 * Canonical payload shape for RuntimeEvent.payload
 * when kind = "insight.alert.risk".
 *
 * All fields are optional so we can evolve this over time.
 */
export interface InsightRiskAlertPayload {
  /**
   * Syndrome this alert is about, e.g. 'respiratory' | 'systemicSepsis' | 'utiRenal'
   * If omitted, the alert is considered "generic" and may be applied to any
   * syndrome cell mapped via encounterId / patientId.
   */
  syndrome?: Syndrome;

  /**
   * Model / rule score for this alert (0–100).
   * We will normalise to 0–1 inside analytics.
   */
  score?: number;

  /**
   * The specific rule that fired, e.g. "vital.fever.tachy.1"
   * or "lab.crp.veryHigh".
   */
  ruleId?: string;

  /**
   * Optional human-readable label.
   */
  ruleName?: string;

  /**
   * Where this alert came from primarily.
   * This is more for debugging / drill-down than for the heatmap itself.
   */
  source?: 'vital' | 'lab' | 'diagnosis' | 'composite';

  /**
   * Optional vitals context (if source === 'vital').
   */
  vType?: string;
  vValue?: number;

  /**
   * Optional lab context (if source === 'lab').
   */
  labCode?: string;
  labFlag?: string | null;

  /**
   * Bag of extra fields we don't explicitly care about yet.
   */
  meta?: Record<string, unknown>;
}

/**
 * Small type-guardish helper to safely interpret RuntimeEvent.payload.
 */
export function parseRiskAlertPayload(payload: unknown): InsightRiskAlertPayload | null {
  if (!payload || typeof payload !== 'object') return null;

  const p = payload as any;
  const out: InsightRiskAlertPayload = {};

  if (typeof p.syndrome === 'string') out.syndrome = p.syndrome as Syndrome;
  if (typeof p.score === 'number') out.score = p.score;
  if (typeof p.ruleId === 'string') out.ruleId = p.ruleId;
  if (typeof p.ruleName === 'string') out.ruleName = p.ruleName;
  if (typeof p.source === 'string') out.source = p.source;
  if (typeof p.vType === 'string') out.vType = p.vType;
  if (typeof p.vValue === 'number') out.vValue = p.vValue;
  if (typeof p.labCode === 'string') out.labCode = p.labCode;
  if (typeof p.labFlag === 'string') out.labFlag = p.labFlag;
  if (p.meta && typeof p.meta === 'object') out.meta = p.meta as Record<string, unknown>;

  return out;
}
