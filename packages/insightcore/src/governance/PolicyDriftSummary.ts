export class PolicyDriftSummary {
  build(args: { rolloutRecords?: any[]; experimentAssignments?: any[] }) {
    return {
      generatedAt: new Date().toISOString(),
      rolloutCount: (args.rolloutRecords || []).length,
      experimentCount: (args.experimentAssignments || []).length,
      status:
        (args.rolloutRecords || []).length > 0 || (args.experimentAssignments || []).length > 0
          ? 'policy_evolving'
          : 'policy_static',
    };
  }
}