import { FamilyExecutionPlanner } from './FamilyExecutionPlanner';
import { FamilyRolloutPolicy } from './FamilyRolloutPolicy';

export class FamilyRuntimeSelector {
  private planner = new FamilyExecutionPlanner();
  private rollout = new FamilyRolloutPolicy();

  select(args?: { researchMode?: boolean }) {
    return this.planner.plan().filter((family) =>
      this.rollout.allow({
        familyId: family.id,
        researchMode: args?.researchMode,
      }),
    );
  }
}