export class ProductionRolloutController {
  build(args: { rolloutRecords?: any[] }) {
    const items = args.rolloutRecords || [];
    return {
      generatedAt: new Date().toISOString(),
      total: items.length,
      enabled: items.filter((r: any) => r.enabled).length,
      blocked: items.filter((r: any) => !r.enabled || Number(r.trafficPercent ?? 0) <= 0).length,
    };
  }
}