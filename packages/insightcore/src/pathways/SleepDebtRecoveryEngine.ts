import type { FeatureVector, InferenceOutput } from '../contracts';
import type { PersonalBaselineSnapshot } from '../contracts/research';

export class SleepDebtRecoveryEngine {
  async run(
    patientId: string,
    fv: FeatureVector,
    baseline: PersonalBaselineSnapshot,
  ): Promise<InferenceOutput[]> {
    const outputs: InferenceOutput[] = [];
    const now = new Date().toISOString();
    const sleepDev = baseline.deviations.find((d) => d.metric === 'sleepHours');
    const sysDev = baseline.deviations.find((d) => d.metric === 'systolic');

    const recoveryScore =
      (sleepDev && !sleepDev.abnormal ? 0.22 : 0) +
      (!fv.poorSleep ? 0.18 : 0) +
      (!fv.bpElevated ? 0.18 : 0) +
      (sysDev && !sysDev.abnormal ? 0.16 : 0);

    if (recoveryScore >= 0.45) {
      outputs.push({
        patientId,
        model: 'sleep-debt-recovery-engine',
        syndrome: 'recovery_state',
        output: {
          triggered: true,
          ruleId: 'trajectory.sleep_debt.recovery.1',
          score: Number(recoveryScore.toFixed(3)),
        },
        confidence: Math.min(0.84, Number((0.5 + recoveryScore * 0.3).toFixed(3))),
        timestamp: now,
        evidence: fv.evidence.filter((e) =>
          ['behavior.sleep', 'vital.bp.sys', 'vital.bp.dia'].includes(e.code),
        ),
        rationale: [
          'Sleep and blood pressure signals are moving back toward baseline',
          'Recovery-state detection may support preventive coaching rather than escalation',
        ],
      });
    }

    return outputs;
  }
}