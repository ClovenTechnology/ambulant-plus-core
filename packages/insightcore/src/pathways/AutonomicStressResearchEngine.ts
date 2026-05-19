import type { FeatureVector, InferenceOutput } from '../contracts';
import type { ResearchGate } from '../contracts/research';

export class AutonomicStressResearchEngine {
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
      ((typeof fv.hrv === 'number' && fv.hrv < 22) ? 0.2 : 0) +
      (fv.tachycardia ? 0.16 : 0) +
      (fv.highStress ? 0.18 : 0) +
      (fv.poorSleep ? 0.1 : 0) +
      (fv.lowHydration ? 0.08 : 0);

    if (score >= 0.5) {
      outputs.push({
        patientId,
        model: 'autonomic-stress-research-engine',
        syndrome: 'autonomic_research',
        output: {
          triggered: true,
          ruleId: 'research.autonomic.stress.1',
          score: Number(score.toFixed(3)),
          researchMode: this.gate.mode,
        },
        confidence: Math.min(0.79, Number((0.45 + score * 0.28).toFixed(3))),
        timestamp: now,
        evidence: fv.evidence.filter((e) =>
          ['vital.hr', 'behavior.stress', 'behavior.sleep', 'behavior.hydration'].includes(e.code),
        ),
        rationale: [
          'Research-gated autonomic stress pattern candidate detected',
          'Not for autonomous clinical use',
        ],
      });
    }

    return outputs;
  }
}