// packages/insightcore/src/orchestrator/InsightCoreExecution.ts
import type { EvidenceTrace } from '../contracts/trace';
import type { LineageRecord } from '../contracts/lineage';
import { EvidenceTraceBuilder } from '../trace/EvidenceTraceBuilder';
import { LineageBuilder } from '../trace/LineageBuilder';
import type { OrchestratorOutput } from './InsightCoreOrchestrator';
import type { InsightCorePersistence } from '../persistence/InsightCorePersistence';

export interface InsightCoreExecution {
  result: OrchestratorOutput;
  trace: EvidenceTrace;
  lineage: LineageRecord;
}

export class InsightCoreExecutionBuilder {
  private traceBuilder = new EvidenceTraceBuilder();
  private lineageBuilder = new LineageBuilder();

  constructor(private readonly persistence?: InsightCorePersistence) {}

  async build(
    patientId: string,
    result: OrchestratorOutput,
    orgId?: string,
    _experimentIds?: string[],
  ): Promise<InsightCoreExecution> {
    const inferenceRuleIds = result.inferences
      .map((inf: any) => inf?.output?.ruleId)
      .filter((x: unknown): x is string => typeof x === 'string');

    const usedPathwayIds = [
      ...new Set(
        result.inferences
          .map((inf: any) => String(inf?.model || ''))
          .filter(Boolean)
          .map((model) => {
            if (model.includes('maternal')) return 'maternal';
            if (model.includes('post-procedure')) return 'post_procedure_recovery';
            if (model.includes('adherence')) return 'medication_adherence_impact';
            if (model.includes('allergy-risk')) return 'allergy_risk';
            return '';
          })
          .filter(Boolean),
      ),
    ];

    const trace = this.traceBuilder.build({
      patientId,
      context: result.context,
      featureVector: result.featureVector,
      inferences: result.inferences.map((inference: any) => ({
        model: inference.model,
        syndrome: inference.syndrome,
        timestamp: inference.timestamp,
      })),
      episodes: result.episodes,
      alerts: result.alerts,
      insights: result.insights,
    });

    const lineage = await this.lineageBuilder.build({
      patientId,
      inferenceRuleIds,
      usedPathwayIds,
    });

    if (this.persistence) {
      await this.persistence.saveTrace({ patientId, orgId, trace });
      await this.persistence.saveLineage({ patientId, orgId, lineage });
    }

    return {
      result,
      trace,
      lineage,
    };
  }
}