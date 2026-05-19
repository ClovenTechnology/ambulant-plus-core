import type { FeatureVector, InferenceOutput } from '../contracts';
import type { ResearchGate } from '../contracts/research';

export class SeizureResearchEngine {
  constructor(private readonly gate: ResearchGate = {
    enabled: false,
    mode: 'off',
    rationale: 'research_not_enabled',
  }) {}

  async run(patientId: string, fv: FeatureVector): Promise<InferenceOutput[]> {
    if (!this.gate.enabled || this.gate.mode === 'off') return [];

    const outputs: InferenceOutput[] = [];
    const now = new Date().toISOString();

    const score =
      ((typeof fv.hrv === 'number' && fv.hrv < 20) ? 0.24 : 0) +
      (fv.tachycardia ? 0.12 : 0) +
      (fv.poorSleep ? 0.12 : 0) +
      (fv.highStress ? 0.1 : 0) +
      (fv.recentSymptoms.some((s) => /dizzy|aura|lightheaded|confusion/i.test(s)) ? 0.22 : 0);

    if (score >= 0.5) {
      outputs.push({
        patientId,
        model: 'seizure-research-engine',
        syndrome: 'neuro_research',
        output: {
          triggered: true,
          ruleId: 'research.seizure.preictal.1',
          score: Number(score.toFixed(3)),
          researchMode: this.gate.mode,
        },
        confidence: Math.min(0.8, Number((0.45 + score * 0.26).toFixed(3))),
        timestamp: now,
        evidence: fv.evidence.filter((e) =>
          ['vital.hr', 'behavior.sleep', 'behavior.stress'].includes(e.code) ||
          e.code.startsWith('symptom.'),
        ),
        rationale: [
          'Research-gated pre-ictal pattern candidate detected',
          'Not for autonomous clinical use; requires research and clinician review',
          `gate:${this.gate.mode}`,
        ],
      });
    }

    return outputs;
  }
}