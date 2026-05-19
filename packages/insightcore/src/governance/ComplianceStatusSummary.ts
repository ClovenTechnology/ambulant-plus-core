export class ComplianceStatusSummary {
  build(args: {
    hasGovernanceAudit: boolean;
    hasRuntimeAudit: boolean;
    hasRolloutRecords: boolean;
    hasExperimentAssignments: boolean;
  }) {
    const checks = {
      governanceAudit: args.hasGovernanceAudit,
      runtimeAudit: args.hasRuntimeAudit,
      rollout: args.hasRolloutRecords,
      experiments: args.hasExperimentAssignments,
    };

    const score =
      Object.values(checks).filter(Boolean).length /
      Object.keys(checks).length;

    return {
      generatedAt: new Date().toISOString(),
      checks,
      score: Number(score.toFixed(3)),
      status:
        score >= 0.9
          ? 'strong'
          : score >= 0.6
          ? 'developing'
          : 'weak',
    };
  }
}