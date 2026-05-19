export class ExperimentComplianceLens {
  build(args: { experimentAssignments?: any[] }) {
    const items = args.experimentAssignments || [];
    return {
      generatedAt: new Date().toISOString(),
      totalAssignments: items.length,
      activeAssignments: items.filter((i: any) => i.active).length,
    };
  }
}