import type { FeatureVector, InferenceOutput } from '../contracts';
import type { PersonalBaselineSnapshot } from '../contracts/research';

export class SleepDebtBPTrajectoryEngine {
  async run(
    patientId: string,
    fv: FeatureVector,
    baseline: PersonalBaselineSnapshot,
  ): Promise<InferenceOutput[]> {
    const outputs: InferenceOutput[] = [];
    const now = new Date().toISOString();

    const sleepDev = baseline.deviations.find((d) => d.metric === 'sleepHours');
    const sysDev = baseline.deviations.find((d) => d.metric === 'systolic');
    const diaDev = baseline.deviations.find((d) => d.metric === 'diastolic');

    const score =
      (sleepDev?.abnormal && (sleepDev.delta ?? 0) < 0 ? 0.24 : 0) +
      (sysDev?.abnormal && (sysDev.delta ?? 0) > 0 ? 0.18 : 0) +
      (diaDev?.abnormal && (diaDev.delta ?? 0) > 0 ? 0.14 : 0) +
      (fv.bpElevated ? 0.18 : 0) +
      (fv.highStress ? 0.08 : 0) +
      (fv.poorSleep ? 0.1 : 0);

    if (score >= 0.45) {
      outputs.push({
        patientId,
        model: 'sleep-debt-bp-trajectory',
        syndrome: 'cardio',
        output: {
          triggered: true,
          ruleId: 'trajectory.sleep_debt.bp_risk.1',
          score: Number(score.toFixed(3)),
          estimatedLeadTimeHours: score >= 0.65 ? 24 : 48,
        },
        confidence: Math.min(0.88, Number((0.54 + score * 0.32).toFixed(3))),
        timestamp: now,
        evidence: fv.evidence.filter((e) =>
          ['behavior.sleep', 'vital.bp.sys', 'vital.bp.dia', 'behavior.stress'].includes(e.code),
        ),
        rationale: [
          'Sleep debt pattern and BP trajectory are moving together',
          'Sustained sleep deficit may be contributing to blood pressure escalation risk',
        ],
      });
    }

    return outputs;
  }
}