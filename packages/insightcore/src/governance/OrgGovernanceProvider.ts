import type { RuleWeightMap } from './RuleWeightResolver';
import type { GovernedPathway } from '../contracts/governance';

export interface OrgGovernanceBundle {
  orgId: string;
  ruleWeights: RuleWeightMap;
  pathways: GovernedPathway[];
}

export interface OrgGovernanceProvider {
  get(orgId?: string): Promise<OrgGovernanceBundle | null>;
}