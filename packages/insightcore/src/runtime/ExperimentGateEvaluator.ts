export interface ExperimentAssignment {
  familyId: string;
  experimentId: string;
  active: boolean;
}

export class ExperimentGateEvaluator {
  allow(args: {
    familyId: string;
    assignments: ExperimentAssignment[];
    researchMode?: boolean;
  }) {
    const relevant = args.assignments.filter((a) => a.familyId === args.familyId && a.active);

    if (relevant.length === 0) return true;

    return Boolean(args.researchMode);
  }
}