import type { ModelRollout } from '../contracts/rollout';

export class RolloutController {
  resolve(args: {
    rollouts: ModelRollout[];
    orgId?: string;
    audience?: 'patient' | 'clinician' | 'admin' | 'all';
  }): ModelRollout[] {
    return args.rollouts.filter((r) => {
      const orgMatch = !r.orgId || r.orgId === args.orgId;
      const audienceMatch =
        !r.audience || r.audience === 'all' || r.audience === args.audience;
      return r.enabled && orgMatch && audienceMatch;
    });
  }
}