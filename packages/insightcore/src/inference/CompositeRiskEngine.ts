import type { FeatureVector, InferenceOutput } from '../contracts';
import { RuleWeightResolver } from '../governance/RuleWeightResolver';

const DEFAULT_WEIGHTS = {
  sepsis_fever: 0.32,
  sepsis_tachy: 0.24,
  sepsis_diag: 0.18,
  sepsis_symptom: 0.12,
  sepsis_emergency: 0.12,
  sepsis_hydration: 0.05,

  cardio_bp: 0.26,
  cardio_tachy: 0.18,
  cardio_diag: 0.16,
  cardio_adherence: 0.14,
  cardio_stress: 0.08,
  cardio_sleep: 0.06,

  resp_spo2: 0.34,
  resp_rr: 0.18,
  resp_diag: 0.18,
  resp_symptom: 0.16,
  resp_sleep: 0.04,
};

export class CompositeRiskEngine {
  constructor(
  private readonly weights = new RuleWeightResolver(DEFAULT_WEIGHTS),
) {}

  async run(patientId: string, fv: FeatureVector): Promise<InferenceOutput[]> {
    const outputs: InferenceOutput[] = [];
    const now = new Date().toISOString();

    const sepsisScore =
      (fv.fever ? this.weights.get('sepsis_fever') : 0) +
      (fv.tachycardia ? this.weights.get('sepsis_tachy') : 0) +
      (fv.recentDiagnoses.some((d) => /infection|sepsis|uti|pneumonia/i.test(d))
        ? this.weights.get('sepsis_diag')
        : 0) +
      (fv.recentSymptoms.some((s) => /fever|chills|rigors/i.test(s))
        ? this.weights.get('sepsis_symptom')
        : 0) +
      (fv.recentEmergencyFlag ? this.weights.get('sepsis_emergency') : 0) +
      (fv.lowHydration ? this.weights.get('sepsis_hydration') : 0);

    if (sepsisScore >= 0.55) {
      outputs.push({
        patientId,
        model: 'composite-sepsis-context',
        syndrome: 'systemicSepsis',
        output: {
          triggered: true,
          ruleId: 'composite.sepsis.bundle.1',
          score: Number(sepsisScore.toFixed(3)),
        },
        confidence: Math.min(0.95, Number((0.58 + sepsisScore * 0.35).toFixed(3))),
        timestamp: now,
        evidence: fv.evidence.filter((e) =>
          ['vital.temp', 'vital.hr'].includes(e.code) ||
          e.code.startsWith('diagnosis.') ||
          e.code.startsWith('symptom.'),
        ),
        rationale: [
          'Composite sepsis context score exceeded threshold',
          ...this.weights.explainMany([
            'sepsis_fever',
            'sepsis_tachy',
            'sepsis_diag',
            'sepsis_symptom',
          ]).map((w) => `weight:${w.key}=${w.value}`),
        ],
      });
    }

    const cardioScore =
      (fv.bpElevated ? this.weights.get('cardio_bp') : 0) +
      (fv.tachycardia ? this.weights.get('cardio_tachy') : 0) +
      (fv.recentDiagnoses.some((d) => /hypertension|cardiac|chest pain/i.test(d))
        ? this.weights.get('cardio_diag')
        : 0) +
      (typeof fv.medicationAdherencePct === 'number' && fv.medicationAdherencePct < 80
        ? this.weights.get('cardio_adherence')
        : 0) +
      (fv.highStress ? this.weights.get('cardio_stress') : 0) +
      (fv.poorSleep ? this.weights.get('cardio_sleep') : 0);

    if (cardioScore >= 0.5) {
      outputs.push({
        patientId,
        model: 'composite-cardio-context',
        syndrome: 'cardio',
        output: {
          triggered: true,
          ruleId: 'composite.cardio.acute.1',
          score: Number(cardioScore.toFixed(3)),
        },
        confidence: Math.min(0.92, Number((0.54 + cardioScore * 0.34).toFixed(3))),
        timestamp: now,
        evidence: fv.evidence.filter((e) =>
          ['vital.bp.sys', 'vital.bp.dia', 'vital.hr', 'adherence.medication'].includes(e.code) ||
          e.code.startsWith('diagnosis.'),
        ),
        rationale: [
          'Composite cardiovascular context score exceeded threshold',
          ...this.weights.explainMany([
            'cardio_bp',
            'cardio_tachy',
            'cardio_diag',
            'cardio_adherence',
          ]).map((w) => `weight:${w.key}=${w.value}`),
        ],
      });
    }

    const respiratoryScore =
      (fv.lowSpo2 ? this.weights.get('resp_spo2') : 0) +
      (typeof fv.respiratoryRate === 'number' && fv.respiratoryRate > 24
        ? this.weights.get('resp_rr')
        : 0) +
      (fv.recentDiagnoses.some((d) => /asthma|copd|pneumonia|respiratory/i.test(d))
        ? this.weights.get('resp_diag')
        : 0) +
      (fv.recentSymptoms.some((s) => /breath|cough|wheeze/i.test(s))
        ? this.weights.get('resp_symptom')
        : 0) +
      (fv.poorSleep ? this.weights.get('resp_sleep') : 0);

    if (respiratoryScore >= 0.5) {
      outputs.push({
        patientId,
        model: 'composite-respiratory-context',
        syndrome: 'respiratory',
        output: {
          triggered: true,
          ruleId: 'composite.respiratory.deterioration.1',
          score: Number(respiratoryScore.toFixed(3)),
        },
        confidence: Math.min(0.93, Number((0.56 + respiratoryScore * 0.34).toFixed(3))),
        timestamp: now,
        evidence: fv.evidence.filter((e) =>
          ['vital.spo2', 'vital.rr'].includes(e.code) ||
          e.code.startsWith('diagnosis.') ||
          e.code.startsWith('symptom.'),
        ),
        rationale: [
          'Composite respiratory context score exceeded threshold',
          ...this.weights.explainMany([
            'resp_spo2',
            'resp_rr',
            'resp_diag',
            'resp_symptom',
          ]).map((w) => `weight:${w.key}=${w.value}`),
        ],
      });
    }

    return outputs;
  }
}