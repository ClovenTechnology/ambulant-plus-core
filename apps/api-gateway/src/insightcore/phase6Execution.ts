import { InsightCoreExecutionBuilder } from '../../../../packages/insightcore/src/orchestrator/InsightCoreExecution';
import { RuntimeEventInsightPersistence } from '../../../../packages/insightcore/src/persistence/RuntimeEventInsightPersistence';
import { GatewayRuntimeEventWriter } from './runtimeEventWriter';
import { ExperimentResolver } from '../../../../packages/insightcore/src/ml/ExperimentResolver';
import { ExperimentAwareLineage } from '../../../../packages/insightcore/src/ml/ExperimentAwareLineage';
import type { OrchestratorOutput } from '../../../../packages/insightcore/src/orchestrator/InsightCoreOrchestrator';

export async function buildPersistedExecution(args: {
  patientId: string;
  orgId?: string;
  result: OrchestratorOutput;
}) {
  const persistence = new RuntimeEventInsightPersistence(new GatewayRuntimeEventWriter());
  const executionBuilder = new InsightCoreExecutionBuilder(persistence);
  const experimentResolver = new ExperimentResolver();
  const experimentAware = new ExperimentAwareLineage();

  const execution = await executionBuilder.build(
    args.patientId,
    args.result,
    args.orgId,
    experimentResolver.activeIds(),
  );

  return {
    ...execution,
    lineage: experimentAware.attach(
      execution.lineage,
      experimentResolver.activeIds(),
    ),
  };
}