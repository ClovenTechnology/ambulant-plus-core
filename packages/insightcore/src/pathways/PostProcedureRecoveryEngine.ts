import type { FeatureVector, InferenceOutput } from '../contracts';

export class PostProcedureRecoveryEngine {
  async run(patientId: string, fv: FeatureVector): Promise<InferenceOutput[]> {
    const outputs: InferenceOutput[] = [];
    const now = new Date().toISOString();

    const recentProcedure =
      fv.clinicalPhase === 'post_op' ||
      fv.recentProcedureTypes.some((p) => /surgery|operation|procedure/i.test(p));

    if (!recentProcedure) return outputs;

    const recoveryStressScore =
      (fv.fever ? 0.26 : 0) +
      (fv.tachycardia ? 0.18 : 0) +
      (fv.lowSpo2 ? 0.18 : 0) +
      ((fv.recentSymptoms.some((s) => /pain|bleeding|swelling|dizzy/i.test(s))) ? 0.18 : 0) +
      ((typeof fv.medicationAdherencePct === 'number' && fv.medicationAdherencePct < 80) ? 0.1 : 0);

    if (recoveryStressScore >= 0.5) {
      outputs.push({
        patientId,
        model: 'post-procedure-recovery-risk',
        syndrome: 'systemicSepsis',
        output: {
          triggered: true,
          ruleId: 'postprocedure.recovery.risk.1',
          score: Number(recoveryStressScore.toFixed(3)),
        },
        confidence: Math.min(0.9, Number((0.56 + recoveryStressScore * 0.32).toFixed(3))),
        timestamp: now,
        evidence: fv.evidence.filter((e) =>
          ['vital.temp', 'vital.hr', 'vital.spo2', 'adherence.medication'].includes(e.code) ||
          e.code.startsWith('symptom.') ||
          e.code.startsWith('procedure.'),
        ),
        rationale: [
          'Post-procedure recovery context detected',
          'Current physiologic and symptom pattern suggests closer recovery monitoring',
        ],
      });
    }

    return outputs;
  }
}