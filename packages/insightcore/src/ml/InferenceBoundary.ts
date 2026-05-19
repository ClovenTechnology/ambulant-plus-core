import type { FeatureVector, InferenceOutput } from '../contracts';

export interface InferenceBoundary {
  id: string;
  version: string;
  kind: 'rule' | 'composite' | 'pathway' | 'ml';
  run(patientId: string, features: FeatureVector): Promise<InferenceOutput[]>;
}