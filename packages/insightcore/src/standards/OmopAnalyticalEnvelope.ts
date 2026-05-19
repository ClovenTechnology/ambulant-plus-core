export class OmopAnalyticalEnvelope {
  build(args: {
    baseline: any;
    episodes: any;
    cohort?: any;
  }) {
    return {
      generatedAt: new Date().toISOString(),
      baseline: args.baseline,
      episodes: args.episodes,
      cohort: args.cohort ?? null,
    };
  }
}