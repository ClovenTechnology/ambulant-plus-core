export interface StudioDashboardMetrics {
  totalEpisodes: number;
  highOrCriticalEpisodes: number;
  totalAlerts: number;
  totalTraces: number;
  totalLineageRecords: number;
}

export interface StudioDashboardReadModels {
  getDashboard(args?: { orgId?: string }): Promise<StudioDashboardMetrics>;
}