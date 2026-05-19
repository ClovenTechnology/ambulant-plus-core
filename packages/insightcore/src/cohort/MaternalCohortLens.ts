export class MaternalCohortLens {
  build(args: {
    maternalPatients: number;
    maternalEpisodes: number;
  }) {
    return {
      generatedAt: new Date().toISOString(),
      maternalPatients: args.maternalPatients,
      maternalEpisodes: args.maternalEpisodes,
      intensity:
        args.maternalPatients > 0
          ? Number((args.maternalEpisodes / args.maternalPatients).toFixed(3))
          : 0,
    };
  }
}