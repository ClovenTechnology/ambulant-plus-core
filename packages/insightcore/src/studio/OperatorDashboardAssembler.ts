export interface OperatorDashboardSnapshot {
  totals: {
    episodes: number;
    alerts: number;
    traces: number;
    lineage: number;
  };
  severity: {
    highOrCriticalEpisodes: number;
  };
  notes: string[];
}

export class OperatorDashboardAssembler {
  build(args: {
    totalEpisodes: number;
    totalAlerts: number;
    totalTraces: number;
    totalLineageRecords: number;
    highOrCriticalEpisodes: number;
  }): OperatorDashboardSnapshot {
    return {
      totals: {
        episodes: args.totalEpisodes,
        alerts: args.totalAlerts,
        traces: args.totalTraces,
        lineage: args.totalLineageRecords,
      },
      severity: {
        highOrCriticalEpisodes: args.highOrCriticalEpisodes,
      },
      notes: [
        'Dashboard metrics are derived from runtime-event records.',
        'Future versions should include severity distribution and pathway breakdowns.',
      ],
    };
  }
}