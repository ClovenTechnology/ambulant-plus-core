export class RolloutSafetyGate {
  evaluate(args: { rolloutRecords?: any[]; runtimePlan?: any }) {
    const rolloutRecords = args.rolloutRecords || [];
    const runtimeFamilies = args.runtimePlan?.families || [];

    const missing = runtimeFamilies.filter((family: any) => {
      const rollout = rolloutRecords.find(
        (r: any) => r.familyId === family.familyId
      );
      return family.allowed && !rollout;
    });

    return {
      generatedAt: new Date().toISOString(),
      safe: missing.length === 0,
      missingRolloutPolicies: missing.map((f: any) => f.familyId),
      reason:
        missing.length > 0
          ? 'runtime_family_allowed_without_explicit_rollout_record'
          : 'rollout_policy_consistent',
    };
  }
}