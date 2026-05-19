export class ResearchSignalProjector {
  build(args: { researchInferences: any[] }) {
    return {
      generatedAt: new Date().toISOString(),
      totalResearchSignals: args.researchInferences.length,
      models: [...new Set(args.researchInferences.map((i) => i.model))],
    };
  }
}