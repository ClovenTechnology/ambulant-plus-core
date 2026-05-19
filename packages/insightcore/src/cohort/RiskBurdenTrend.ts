export class RiskBurdenTrend {
  build(args: {
    totalEpisodes: number;
    highOrCriticalEpisodes: number;
  }) {
    const burden =
      args.totalEpisodes > 0
        ? Number((args.highOrCriticalEpisodes / args.totalEpisodes).toFixed(3))
        : 0;

    return {
      generatedAt: new Date().toISOString(),
      burden,
      label:
        burden >= 0.5
          ? 'elevated'
          : burden >= 0.25
            ? 'moderate'
            : 'stable',
    };
  }
}