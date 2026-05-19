export class ModelScorecard {
  build(args: { inferences: any[] }) {
    const byModel = new Map<string, number>();
    let total = 0;

    for (const inf of args.inferences || []) {
      const key = String(inf?.model || 'unknown');
      byModel.set(key, (byModel.get(key) || 0) + 1);
      total++;
    }

    return {
      generatedAt: new Date().toISOString(),
      totalInferences: total,
      models: [...byModel.entries()].map(([model, count]) => ({
        model,
        count,
        ratio: total > 0 ? Number((count / total).toFixed(3)) : 0,
      })),
    };
  }
}