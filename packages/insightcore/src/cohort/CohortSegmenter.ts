export interface CohortSegment {
  id: string;
  title: string;
  count: number;
}

export class CohortSegmenter {
  segment(args: {
    totalPatients: number;
    maternalPatients?: number;
    chronicPatients?: number;
    researchPatients?: number;
  }): CohortSegment[] {
    const maternal = args.maternalPatients ?? 0;
    const chronic = args.chronicPatients ?? 0;
    const research = args.researchPatients ?? 0;
    const general = Math.max(0, args.totalPatients - maternal - chronic - research);

    return [
      { id: 'general', title: 'General population', count: general },
      { id: 'maternal', title: 'Maternal cohort', count: maternal },
      { id: 'chronic', title: 'Chronic care cohort', count: chronic },
      { id: 'research', title: 'Research cohort', count: research },
    ];
  }
}