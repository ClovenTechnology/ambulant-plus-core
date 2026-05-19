import type { FeatureVector, InferenceOutput } from '../contracts';
import type { InferenceBoundary } from './InferenceBoundary';

export interface ScoringStrategyResult {
  used: 'deterministic_only' | 'ml_only' | 'hybrid';
  outputs: InferenceOutput[];
  modelsUsed: string[];
}

export class ProductionScoringStrategy {
  constructor(
    private readonly deterministicEngines: InferenceBoundary[],
    private readonly mlEngines: InferenceBoundary[] = [],
  ) {}

  async run(patientId: string, features: FeatureVector): Promise<ScoringStrategyResult> {
    const deterministicResults = await Promise.all(
      this.deterministicEngines.map((engine) => engine.run(patientId, features)),
    );

    if (this.mlEngines.length === 0) {
      return {
        used: 'deterministic_only',
        outputs: deterministicResults.flat(),
        modelsUsed: this.deterministicEngines.map((e) => e.id),
      };
    }

    const mlResults = await Promise.all(
      this.mlEngines.map((engine) => engine.run(patientId, features)),
    );

    return {
      used: 'hybrid',
      outputs: [...deterministicResults.flat(), ...mlResults.flat()],
      modelsUsed: [
        ...this.deterministicEngines.map((e) => e.id),
        ...this.mlEngines.map((e) => e.id),
      ],
    };
  }
}