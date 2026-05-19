import { FeatureVector, InferenceOutput } from '../contracts';

export class RuleBasedInferenceEngine {
  async run(patientId: string, fv: FeatureVector): Promise<InferenceOutput[]> {
    const now = new Date().toISOString();
    const outputs: InferenceOutput[] = [];

    if (fv.fever && fv.tachycardia) {
      outputs.push({
        patientId,
        model: 'rule-sepsis-fever-tachy',
        syndrome: 'systemicSepsis',
        output: {
          triggered: true,
          ruleId: 'vital.fever.tachy.1',
          tempC: fv.tempC ?? null,
          hr: fv.hr ?? null,
        },
        confidence: 0.86,
        timestamp: now,
        evidence: fv.evidence.filter((e) =>
          ['vital.temp', 'vital.hr'].includes(e.code),
        ),
        rationale: [
          'Fever and tachycardia co-occurred in the same context window',
          'Pattern is consistent with early systemic infection or sepsis screening risk',
        ],
      });
    }

    if (fv.lowSpo2) {
      outputs.push({
        patientId,
        model: 'rule-respiratory-hypoxia',
        syndrome: 'respiratory',
        output: {
          triggered: true,
          ruleId: 'vital.hypoxia.1',
          spo2: fv.spo2 ?? null,
        },
        confidence: fv.spo2 != null && fv.spo2 < 90 ? 0.92 : 0.8,
        timestamp: now,
        evidence: fv.evidence.filter((e) => e.code === 'vital.spo2'),
        rationale: [
          'Oxygen saturation is below expected threshold',
          'Pattern is consistent with respiratory compromise',
        ],
      });
    }

    if (fv.bpElevated && (fv.systolic ?? 0) >= 180) {
      outputs.push({
        patientId,
        model: 'rule-hypertensive-crisis',
        syndrome: 'cardio',
        output: {
          triggered: true,
          ruleId: 'vital.hypertension.crisis.1',
          systolic: fv.systolic ?? null,
          diastolic: fv.diastolic ?? null,
        },
        confidence: 0.9,
        timestamp: now,
        evidence: fv.evidence.filter((e) =>
          ['vital.bp.sys', 'vital.bp.dia'].includes(e.code),
        ),
        rationale: [
          'Blood pressure crossed hypertensive crisis range',
          'Requires prompt clinical review, especially if symptoms coexist',
        ],
      });
    } else if (fv.bpElevated) {
      outputs.push({
        patientId,
        model: 'rule-stage2-hypertension',
        syndrome: 'cardio',
        output: {
          triggered: true,
          ruleId: 'vital.hypertension.stage2.1',
          systolic: fv.systolic ?? null,
          diastolic: fv.diastolic ?? null,
        },
        confidence: 0.74,
        timestamp: now,
        evidence: fv.evidence.filter((e) =>
          ['vital.bp.sys', 'vital.bp.dia'].includes(e.code),
        ),
        rationale: [
          'Blood pressure is persistently above normal thresholds',
          'Pattern suggests cardiovascular risk that should be trended and contextualized',
        ],
      });
    }

    if (typeof fv.hr === 'number' && fv.hr < 50) {
      outputs.push({
        patientId,
        model: 'rule-bradycardia',
        syndrome: 'cardio',
        output: {
          triggered: true,
          ruleId: 'vital.bradycardia.1',
          hr: fv.hr,
        },
        confidence: 0.7,
        timestamp: now,
        evidence: fv.evidence.filter((e) => e.code === 'vital.hr'),
        rationale: [
          'Heart rate is below expected resting threshold',
          'Clinical significance depends on conditioning, symptoms, and medication context',
        ],
      });
    }

    if (
      typeof fv.glucoseInstabilityScore === 'number' &&
      fv.glucoseInstabilityScore >= 0.7
    ) {
      outputs.push({
        patientId,
        model: 'rule-glucose-instability',
        syndrome: 'metabolic',
        output: {
          triggered: true,
          ruleId: 'vital.hyperglycemia.1',
          glucoseInstabilityScore: fv.glucoseInstabilityScore,
        },
        confidence: 0.78,
        timestamp: now,
        evidence: fv.evidence.filter((e) =>
          ['adherence.medication', 'behavior.sleep', 'behavior.hydration'].includes(e.code),
        ),
        rationale: [
          'Glucose instability score crossed configured threshold',
          'Metabolic signal may be influenced by adherence, hydration, and recovery context',
        ],
      });
    }

    if (
      fv.lowSpo2 &&
      typeof fv.respiratoryRate === 'number' &&
      fv.respiratoryRate > 24
    ) {
      outputs.push({
        patientId,
        model: 'rule-respiratory-deterioration-composite',
        syndrome: 'respiratory',
        output: {
          triggered: true,
          ruleId: 'composite.respiratory.deterioration.1',
          spo2: fv.spo2 ?? null,
          respiratoryRate: fv.respiratoryRate,
        },
        confidence: 0.88,
        timestamp: now,
        evidence: fv.evidence.filter((e) =>
          ['vital.spo2', 'vital.rr'].includes(e.code) || e.code.startsWith('diagnosis.'),
        ),
        rationale: [
          'Multiple respiratory signals co-occur in the same context window',
          'Composite deterioration signal is stronger than isolated hypoxia alone',
        ],
      });
    }

    return outputs;
  }
}