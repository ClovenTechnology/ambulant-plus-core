// packages/insightcore/src/pathways/BaselineStateInterpreterEngine.ts
import type { FeatureVector, InferenceOutput } from '../contracts';
import type { PersonalBaselineSnapshot } from '../contracts/research';

export class BaselineStateInterpreterEngine {
  async run(
    patientId: string,
    fv: FeatureVector,
    baseline: PersonalBaselineSnapshot,
  ): Promise<InferenceOutput[]> {
    const outputs: InferenceOutput[] = [];
    const now = new Date().toISOString();

    const abnormal = baseline.deviations
      .filter((deviation) => deviation.abnormal)
      .map((deviation) => deviation.metric)
      .filter((metric): metric is string => typeof metric === 'string' && metric.trim().length > 0);

    const score =
      Math.min(0.5, abnormal.length * 0.12) +
      (fv.highStress ? 0.08 : 0) +
      (fv.poorSleep ? 0.08 : 0) +
      (fv.lowHydration ? 0.06 : 0);

    if (score >= 0.35) {
      const abnormalDomains = abnormal.join(',');

      outputs.push({
        patientId,
        model: 'baseline-state-interpreter',
        syndrome: 'baseline_state',
        output: {
          triggered: true,
          ruleId: 'baseline.state.interpretation.1',
          score: Number(score.toFixed(3)),
          domains: abnormalDomains || null,
          domainCount: abnormal.length,
        },
        confidence: Math.min(0.83, Number((0.5 + score * 0.27).toFixed(3))),
        timestamp: now,
        evidence: fv.evidence,
        rationale: [
          `Baseline deviations detected in ${abnormalDomains || 'unspecified domains'}`,
          'Interpretive layer should evolve toward richer physiological state attribution',
        ],
      });
    }

    return outputs;
  }
}