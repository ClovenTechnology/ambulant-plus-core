import type { FeatureVector, InferenceOutput } from '../contracts';

export class MaternalPathwayEngine {
  async run(patientId: string, fv: FeatureVector): Promise<InferenceOutput[]> {
    const outputs: InferenceOutput[] = [];
    const now = new Date().toISOString();

    if (!fv.pregnancyHighRisk && !fv.postpartumRecent) return outputs;

    const postpartumHeadacheRisk =
      (fv.postpartumRecent ? 0.28 : 0) +
      (fv.bpElevated ? 0.24 : 0) +
      ((fv.recentSymptoms.some((s) => /headache|vision|swelling/i.test(s))) ? 0.26 : 0) +
      (fv.highStress ? 0.05 : 0);

    if (postpartumHeadacheRisk >= 0.5) {
      outputs.push({
        patientId,
        model: 'maternal-postpartum-warning',
        syndrome: 'cardio',
        output: {
          triggered: true,
          ruleId: 'maternal.postpartum.warning.1',
          score: Number(postpartumHeadacheRisk.toFixed(3)),
        },
        confidence: Math.min(0.92, Number((0.58 + postpartumHeadacheRisk * 0.3).toFixed(3))),
        timestamp: now,
        evidence: fv.evidence.filter((e) =>
          e.code.startsWith('symptom.') ||
          ['vital.bp.sys', 'vital.bp.dia'].includes(e.code),
        ),
        rationale: [
          'Postpartum context detected',
          'Headache or BP-related signals may require maternal follow-up',
        ],
      });
    }

    return outputs;
  }
}