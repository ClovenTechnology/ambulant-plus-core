export class CohortSignalSummary {
  build(args: {
    totalEpisodes: number;
    totalAlerts: number;
    totalPatients: number;
  }) {
    return {
      generatedAt: new Date().toISOString(),
      totals: args,
      signals: [
        args.totalEpisodes > 20 ? 'elevated_episode_volume' : 'stable_episode_volume',
        args.totalAlerts > 30 ? 'alert_load_high' : 'alert_load_normal',
      ],
    };
  }
}