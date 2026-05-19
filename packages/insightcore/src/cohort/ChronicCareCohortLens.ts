export class ChronicCareCohortLens {
  build(args: {
    chronicPatients: number;
    chronicEpisodes: number;
  }) {
    return {
      generatedAt: new Date().toISOString(),
      chronicPatients: args.chronicPatients,
      chronicEpisodes: args.chronicEpisodes,
      intensity:
        args.chronicPatients > 0
          ? Number((args.chronicEpisodes / args.chronicPatients).toFixed(3))
          : 0,
    };
  }
}