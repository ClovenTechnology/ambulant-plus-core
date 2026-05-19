import type { FeatureVector, InferenceOutput } from '../contracts';
import type { PersonalBaselineSnapshot } from '../contracts/research';

export class RecoveryStabilityEngine {
  async run(
    patientId: string,
    fv: FeatureVector,
    baseline: PersonalBaselineSnapshot,
  ): Promise<InferenceOutput[]> {
    const outputs: InferenceOutput[] = [];
    const now = new Date().toISOString();

    const abnormalCount = baseline.deviations.filter((d) => d.abnormal).length;
    const score =
      (abnormalCount === 0 ? 0.22 : 0) +
      (!fv.bpElevated ? 0.16 : 0) +
      (!fv.tachycardia ? 0.16 : 0) +
      (!fv.poorSleep ? 0.12 : 0);

    if (score >= 0.42) {
      outputs.push({
        patientId,
        model: 'recovery-stability-engine',
        syndrome: 'recovery_state',
        output: {
          triggered: true,
          ruleId: 'recovery.stability.1',
          score: Number(score.toFixed(3)),
        },
        confidence: Math.min(0.82, Number((0.49 + score * 0.26).toFixed(3))),
        timestamp: now,
        evidence: fv.evidence,
        rationale: [
          'Signals suggest stable recovery-state rather than deterioration',
          'Can later support coaching and reassurance pathways',
        ],
      });
    }

    return outputs;
  }
}