import type { FeatureVector, InferenceOutput } from '../contracts';
import type { InferenceBoundary } from './InferenceBoundary';

export interface ModelScoringClient {
  score(args: {
    patientId: string;
    modelId: string;
    features: FeatureVector;
  }): Promise<InferenceOutput[]>;
}

export class ProductionModelAdapter implements InferenceBoundary {
  id = 'production-ml-adapter';
  version = '1.0.0';
  kind = 'ml' as const;

  constructor(
    private readonly client: ModelScoringClient,
    private readonly modelId: string,
  ) {}

  async run(patientId: string, features: FeatureVector): Promise<InferenceOutput[]> {
    return this.client.score({
      patientId,
      modelId: this.modelId,
      features,
    });
  }
}