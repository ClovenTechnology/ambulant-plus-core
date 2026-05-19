// packages/insightcore/src/trace/LineageBuilder.ts
import type { LineageRecord, RuleLineage } from '../contracts/lineage';
import { EngineRegistry } from '../registry/EngineRegistry';
import { PathwayRegistry } from '../registry/PathwayRegistry';

export class LineageBuilder {
  private engineRegistry = new EngineRegistry();
  private pathwayRegistry = new PathwayRegistry();

  async build(args: {
    patientId: string;
    inferenceRuleIds: string[];
    usedPathwayIds: string[];
  }): Promise<LineageRecord> {
    const uniqueRuleIds = [...new Set(args.inferenceRuleIds)];

    const rulesApplied: RuleLineage[] = uniqueRuleIds.map((id) => ({
      id,
      version: '1.0.0',
      title: id,
      family: id.split('.')[0] || 'generic',
      source: id.startsWith('composite.')
        ? 'composite'
        : id.startsWith('maternal.') ||
            id.startsWith('postprocedure.') ||
            id.startsWith('adherence.')
          ? 'pathway'
          : 'rule',
    }));

    const pathways = await this.pathwayRegistry.list();

    return {
      patientId: args.patientId,
      generatedAt: new Date().toISOString(),
      enginesRun: this.engineRegistry.list(),
      rulesApplied,
      pathwaysApplied: pathways
        .filter((pathway) => args.usedPathwayIds.includes(pathway.id))
        .map((pathway) => pathway.id),
    };
  }
}