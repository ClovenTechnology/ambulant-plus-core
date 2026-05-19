export class BaselineDriftSummary {
  build(args: { baselineTrend?: any; baselineState?: any }) {
    return {
      generatedAt: new Date().toISOString(),
      baselineTrend: args.baselineTrend ?? null,
      hasState: Boolean(args.baselineState),
    };
  }
}