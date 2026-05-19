import type { FeatureVector, InferenceOutput } from '../contracts';

export class MedicationAdherenceImpactEngine {
  async run(patientId: string, fv: FeatureVector): Promise<InferenceOutput[]> {
    const outputs: InferenceOutput[] = [];
    const now = new Date().toISOString();

    const lowAdherence =
      typeof fv.medicationAdherencePct === 'number' && fv.medicationAdherencePct < 80;

    if (!lowAdherence) return outputs;

    const impactScore =
      (lowAdherence ? 0.3 : 0) +
      (fv.bpElevated ? 0.18 : 0) +
      (fv.tachycardia ? 0.14 : 0) +
      (fv.lowSpo2 ? 0.14 : 0) +
      ((fv.missedMedicationCount7d ?? 0) >= 2 ? 0.12 : 0) +
      (fv.highStress ? 0.06 : 0);

    if (impactScore >= 0.45) {
      outputs.push({
        patientId,
        model: 'adherence-outcome-impact',
        syndrome: 'generic',
        output: {
          triggered: true,
          ruleId: 'adherence.outcome.impact.1',
          score: Number(impactScore.toFixed(3)),
        },
        confidence: Math.min(0.88, Number((0.52 + impactScore * 0.34).toFixed(3))),
        timestamp: now,
        evidence: fv.evidence.filter((e) =>
          ['adherence.medication', 'vital.bp.sys', 'vital.bp.dia', 'vital.hr', 'vital.spo2'].includes(e.code),
        ),
        rationale: [
          'Medication adherence has dropped below desired range',
          'Physiologic changes may be linked to adherence decline',
        ],
      });
    }

    return outputs;
  }
}