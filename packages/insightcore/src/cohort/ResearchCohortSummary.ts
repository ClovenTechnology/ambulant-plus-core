export class ResearchCohortSummary {
  build(args: {
    researchPatients: number;
    activeAssignments: number;
  }) {
    return {
      generatedAt: new Date().toISOString(),
      researchPatients: args.researchPatients,
      activeAssignments: args.activeAssignments,
      active:
        args.researchPatients > 0 || args.activeAssignments > 0,
    };
  }
}