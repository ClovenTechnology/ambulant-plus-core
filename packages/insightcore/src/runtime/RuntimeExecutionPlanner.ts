import { PathwayFamilyRegistry } from '../pathways/families/PathwayFamilyRegistry';
import { FamilyDeploymentRegistry } from '../pathways/families/FamilyDeploymentRegistry';
import { ExecutionSafetyClassifier } from '../pathways/families/ExecutionSafetyClassifier';
import type { RuntimeExecutionPlan } from './RuntimeExecutionPlan';

export class RuntimeExecutionPlanner {
  private familyRegistry = new PathwayFamilyRegistry();
  private deploymentRegistry = new FamilyDeploymentRegistry();
  private safetyClassifier = new ExecutionSafetyClassifier();

  build(args?: { researchMode?: boolean }): RuntimeExecutionPlan {
    const families = this.familyRegistry.list();
    const deploymentFamilies = this.deploymentRegistry.list(families);

    return {
      generatedAt: new Date().toISOString(),
      researchMode: Boolean(args?.researchMode),
      families: deploymentFamilies.map((family) => {
        const safetyClass = this.safetyClassifier.classify(family);

        const allowed =
          safetyClass === 'deployment'
            ? true
            : safetyClass === 'research'
              ? Boolean(args?.researchMode)
              : Boolean(args?.researchMode);

        return {
          familyId: family.id,
          class: safetyClass,
          allowed,
          reason: allowed
            ? 'family_allowed_under_current_runtime_policy'
            : 'family_blocked_by_runtime_research_policy',
        };
      }),
    };
  }
}