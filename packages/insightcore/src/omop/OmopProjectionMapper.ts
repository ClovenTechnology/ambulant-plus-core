import type { FeatureVector } from '../contracts';

export class OmopProjectionMapper {
  map(featureVector: FeatureVector) {
    return {
      person_id: featureVector.patientId,
      observation_period_start_date: featureVector.generatedAt,
      feature_count: featureVector.evidence.length,
      condition_flags: featureVector.activeConditions,
      symptom_flags: featureVector.recentSymptoms,
      diagnosis_flags: featureVector.recentDiagnoses,
    };
  }
}