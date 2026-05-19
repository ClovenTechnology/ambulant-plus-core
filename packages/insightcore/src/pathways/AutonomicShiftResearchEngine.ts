import type { FeatureVector, InferenceOutput } from '../contracts';
import type { ResearchGate } from '../contracts/research';

export class AutonomicShiftResearchEngine {
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
      ((typeof fv.hrv === 'number' && fv.hrv < 18) ? 0.24 : 0) +
      (fv.tachycardia ? 0.16 : 0) +
      (fv.highStress ? 0.14 : 0) +
      (fv.poorSleep ? 0.1 : 0);

    if (score >= 0.5) {
      outputs.push({
        patientId,
        model: 'autonomic-shift-research-engine',
        syndrome: 'autonomic_research',
        output: {
          triggered: true,
          ruleId: 'research.autonomic.shift.1',
          score: Number(score.toFixed(3)),
          researchMode: this.gate.mode,
        },
        confidence: Math.min(0.78, Number((0.44 + score * 0.28).toFixed(3))),
        timestamp: now,
        evidence: fv.evidence.filter((e) =>
          ['vital.hr', 'behavior.stress', 'behavior.sleep'].includes(e.code),
        ),
        rationale: [
          'Research-gated autonomic pattern candidate detected',
          'Not for autonomous clinical use; requires research and clinician review',
        ],
      });
    }

    return outputs;
  }
}