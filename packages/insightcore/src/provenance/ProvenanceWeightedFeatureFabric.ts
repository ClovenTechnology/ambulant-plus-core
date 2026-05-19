import { FeatureFabric, type FeatureFabricInput } from '../feature-fabric/FeatureFabric';
import { ProvenanceAwareEvidenceScorer } from './ProvenanceAwareEvidenceScorer';
import type { ProvenancedEvidence } from '../contracts/provenance';

export class ProvenanceWeightedFeatureFabric {
  private fabric = new FeatureFabric();
  private scorer = new ProvenanceAwareEvidenceScorer();

  build(input: FeatureFabricInput) {
    const base = this.fabric.build(input);

    const weighted = this.scorer.score(
      (base.evidence as ProvenancedEvidence[]).map((item) => ({
        ...item,
        provenance: item.provenance ?? {
          sourceType: 'device_auto',
          sourcePriority: 50,
          signalQuality: 0.75,
          knownBiasFlags: [],
        },
      })),
    );

    return {
      ...base,
      evidence: weighted,
    };
  }
}