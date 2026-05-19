import type { FeatureVector, InferenceOutput } from '../contracts';
import type { PersonalBaselineSnapshot } from '../contracts/research';

export class SleepDebtEscalationForecaster {
  async run(
    patientId: string,
    fv: FeatureVector,
    baseline: PersonalBaselineSnapshot,
  ): Promise<InferenceOutput[]> {
    const outputs: InferenceOutput[] = [];
    const now = new Date().toISOString();

    const sleepDev = baseline.deviations.find((d) => d.metric === 'sleepHours');
    const sysDev = baseline.deviations.find((d) => d.metric === 'systolic');

    const score =
      (sleepDev?.abnormal && (sleepDev.delta ?? 0) < 0 ? 0.26 : 0) +
      (fv.poorSleep ? 0.18 : 0) +
      (sysDev?.abnormal && (sysDev.delta ?? 0) > 0 ? 0.16 : 0) +
      (fv.bpElevated ? 0.18 : 0) +
      (fv.highStress ? 0.08 : 0);

    if (score >= 0.5) {
      outputs.push({
        patientId,
        model: 'sleep-debt-escalation-forecaster',
        syndrome: 'cardio',
        output: {
          triggered: true,
          ruleId: 'forecast.sleep_debt.escalation.1',
          score: Number(score.toFixed(3)),
          leadWindowHours: score >= 0.7 ? 12 : 24,
        },
        confidence: Math.min(0.86, Number((0.52 + score * 0.28).toFixed(3))),
        timestamp: now,
        evidence: fv.evidence.filter((e) =>
          ['behavior.sleep', 'behavior.stress', 'vital.bp.sys', 'vital.bp.dia'].includes(e.code),
        ),
        rationale: [
          'Sleep debt pattern indicates escalating cardiovascular burden risk',
          'Forecasting scaffold should later evolve into longitudinal predictive modelling',
        ],
      });
    }

    return outputs;
  }
}