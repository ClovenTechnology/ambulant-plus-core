export class RuntimeDriftSummary {
  build(args: {
    rolloutRecords?: any[];
    experimentAssignments?: any[];
  }) {
    const rollout = args.rolloutRecords || [];
    const experiments = args.experimentAssignments || [];

    return {
      generatedAt: new Date().toISOString(),
      rolloutCount: rollout.length,
      experimentAssignmentCount: experiments.length,

      rolloutActive: rollout.filter((r: any) => r.enabled).length,
      experimentActive: experiments.filter((e: any) => e.active).length,

      status:
        rollout.length > 0 || experiments.length > 0
          ? 'dynamic_runtime'
          : 'static_runtime',
    };
  }
}