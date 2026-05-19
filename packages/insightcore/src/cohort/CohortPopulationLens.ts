export class CohortPopulationLens {
  build(args: {
    totalPatients: number;
    totalEpisodes: number;
    totalAlerts: number;
  }) {
    return {
      generatedAt: new Date().toISOString(),
      totalPatients: args.totalPatients,
      totalEpisodes: args.totalEpisodes,
      totalAlerts: args.totalAlerts,
      episodesPerPatient:
        args.totalPatients > 0
          ? Number((args.totalEpisodes / args.totalPatients).toFixed(3))
          : 0,
      alertsPerPatient:
        args.totalPatients > 0
          ? Number((args.totalAlerts / args.totalPatients).toFixed(3))
          : 0,
    };
  }
}