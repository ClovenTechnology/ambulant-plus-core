import type { RuntimeExecutionPlan } from './RuntimeExecutionPlan';

export interface RolloutRecord {
  familyId: string;
  enabled: boolean;
  trafficPercent: number;
}

export class RolloutAwareRuntimeSelector {
  apply(plan: RuntimeExecutionPlan, rollouts: RolloutRecord[]) {
    const rolloutMap = new Map(rollouts.map((r) => [r.familyId, r]));

    return {
      ...plan,
      families: plan.families.map((family) => {
        const rollout = rolloutMap.get(family.familyId);
        if (!rollout) return family;

        return {
          ...family,
          allowed: family.allowed && rollout.enabled && rollout.trafficPercent > 0,
          reason:
            family.allowed && rollout.enabled && rollout.trafficPercent > 0
              ? 'family_allowed_by_rollout_policy'
              : 'family_blocked_by_rollout_policy',
        };
      }),
    };
  }
}