export class CohortRiskStratifier {
  build(args: {
    highOrCriticalEpisodes: number;
    totalEpisodes: number;
    totalPatients: number;
  }) {
    const intensity =
      args.totalEpisodes === 0
        ? 0
        : Number((args.highOrCriticalEpisodes / args.totalEpisodes).toFixed(3));

    return {
      generatedAt: new Date().toISOString(),
      totalPatients: args.totalPatients,
      totalEpisodes: args.totalEpisodes,
      highOrCriticalEpisodes: args.highOrCriticalEpisodes,
      intensity,
      label:
        intensity >= 0.5
          ? 'elevated_risk_burden'
          : intensity >= 0.25
            ? 'moderate_risk_burden'
            : 'stable_risk_burden',
    };
  }
}