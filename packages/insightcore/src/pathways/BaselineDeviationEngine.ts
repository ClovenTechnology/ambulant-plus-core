import type { FeatureVector, InferenceOutput } from '../contracts';
import type { PersonalBaselineSnapshot } from '../contracts/research';

export class BaselineDeviationEngine {
  async run(
    patientId: string,
    fv: FeatureVector,
    baseline: PersonalBaselineSnapshot,
  ): Promise<InferenceOutput[]> {
    const outputs: InferenceOutput[] = [];
    const now = new Date().toISOString();

    const hrDev = baseline.deviations.find((d) => d.metric === 'hr');
    const spo2Dev = baseline.deviations.find((d) => d.metric === 'spo2');
    const tempDev = baseline.deviations.find((d) => d.metric === 'tempC');

    const baselineShiftScore =
      (hrDev?.abnormal ? 0.22 : 0) +
      (spo2Dev?.abnormal ? 0.24 : 0) +
      (tempDev?.abnormal ? 0.2 : 0) +
      (fv.poorSleep ? 0.08 : 0) +
      (fv.lowHydration ? 0.08 : 0) +
      (fv.highStress ? 0.06 : 0);

    if (baselineShiftScore >= 0.45) {
      outputs.push({
        patientId,
        model: 'baseline-deviation-engine',
        syndrome: 'baseline_shift',
        output: {
          triggered: true,
          ruleId: 'baseline.deviation.cluster.1',
          score: Number(baselineShiftScore.toFixed(3)),
        },
        confidence: Math.min(0.9, Number((0.55 + baselineShiftScore * 0.3).toFixed(3))),
        timestamp: now,
        evidence: fv.evidence.filter((e) =>
          ['vital.hr', 'vital.spo2', 'vital.temp', 'behavior.sleep', 'behavior.hydration'].includes(e.code),
        ),
        rationale: [
          'Current physiology deviates materially from personal baseline',
          'Deviation cluster is more clinically meaningful than isolated threshold crossings',
        ],
      });
    }

    return outputs;
  }
}