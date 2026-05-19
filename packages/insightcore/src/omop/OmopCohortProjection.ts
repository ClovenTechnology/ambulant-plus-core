export class OmopCohortProjection {
  map(summary: {
    generatedAt: string;
    totals: {
      totalEpisodes: number;
      totalAlerts: number;
      totalPatients: number;
    };
    signals: string[];
  }) {
    return {
      generated_at: summary.generatedAt,
      total_episodes: summary.totals.totalEpisodes,
      total_alerts: summary.totals.totalAlerts,
      total_patients: summary.totals.totalPatients,
      signals: summary.signals,
    };
  }
}