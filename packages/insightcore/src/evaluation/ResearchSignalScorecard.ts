export class ResearchSignalScorecard {
  build(args: { researchSignals?: any; researchPipelines?: any }) {
    return {
      generatedAt: new Date().toISOString(),
      totalResearchSignals: args.researchSignals?.totalResearchSignals ?? 0,
      totalPipelines: args.researchPipelines?.pipelines?.length ?? 0,
    };
  }
}