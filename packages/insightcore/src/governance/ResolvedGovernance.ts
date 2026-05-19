import { RuleWeightResolver, type RuleWeightMap } from './RuleWeightResolver';
import type { GovernedPathway } from '../contracts/governance';

export class ResolvedGovernance {
  constructor(
    private readonly defaultWeights: RuleWeightMap,
    private readonly orgWeights?: RuleWeightMap,
    private readonly pathways?: GovernedPathway[],
  ) {}

  weights(): RuleWeightResolver {
    return new RuleWeightResolver(this.defaultWeights, this.orgWeights);
  }

  enabledPathwayIds(): string[] {
    return (this.pathways ?? []).filter((p) => p.enabled).map((p) => p.id);
  }
}