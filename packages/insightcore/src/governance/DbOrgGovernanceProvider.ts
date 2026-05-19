import type { OrgGovernanceBundle, OrgGovernanceProvider } from './OrgGovernanceProvider';
import type { GovernedPathway } from '../contracts/governance';
import type { RuleWeightMap } from './RuleWeightResolver';

export interface GovernanceStore {
  getRuleWeights(orgId: string): Promise<RuleWeightMap>;
  getPathways(orgId: string): Promise<GovernedPathway[]>;
}

export class DbOrgGovernanceProvider implements OrgGovernanceProvider {
  constructor(
    private readonly store: GovernanceStore,
    private readonly fallback?: OrgGovernanceProvider,
  ) {}

  async get(orgId?: string): Promise<OrgGovernanceBundle | null> {
    const resolvedOrgId = orgId || 'org-default';

    const [ruleWeights, pathways] = await Promise.all([
      this.store.getRuleWeights(resolvedOrgId),
      this.store.getPathways(resolvedOrgId),
    ]);

    if (Object.keys(ruleWeights).length > 0 || pathways.length > 0) {
      return {
        orgId: resolvedOrgId,
        ruleWeights,
        pathways,
      };
    }

    return this.fallback ? this.fallback.get(resolvedOrgId) : null;
  }
}