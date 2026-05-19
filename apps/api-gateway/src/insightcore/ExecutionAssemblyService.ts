import { PrismaIntelligenceGateway } from './PrismaIntelligenceGateway';
import { PrismaRuntimeRolloutStore } from './PrismaRuntimeRolloutStore';
import { PrismaRuntimeExperimentAssignmentStore } from './PrismaRuntimeExperimentAssignmentStore';
import { PrismaBaselineHistoryStore } from './PrismaBaselineHistoryStore';
import { PersonalBaselineGraphBuilder } from '../../../../packages/insightcore/src/baseline/PersonalBaselineGraphBuilder';
import { LongitudinalBaselineCoordinator } from '../../../../packages/insightcore/src/baseline/LongitudinalBaselineCoordinator';
import { PrismaBaselineWindowStore } from './PrismaBaselineWindowStore';
import { LongitudinalPersonalBaselineGraph } from '../../../../packages/insightcore/src/baseline/LongitudinalPersonalBaselineGraph';
import { PrismaLongitudinalBaselineStore } from './PrismaLongitudinalBaselineStore';

export class ExecutionAssemblyService {
  async assemble(body: any) {
    const intelligenceGateway = new PrismaIntelligenceGateway();
    const historyStore = new PrismaBaselineHistoryStore();

    await historyStore.append(body.patientId, {
      ts: new Date().toISOString(),
      restingHr: body.currentVitals?.restingHr,
      systolic: body.currentVitals?.systolic,
      diastolic: body.currentVitals?.diastolic,
      sleepHours: body.lifestyle?.sleepHours,
    });

    const [
      existingEpisodes,
      priorAlerts,
      rolloutRecords,
      experimentAssignments,
      history,
    ] = await Promise.all([
      intelligenceGateway.loadOpenEpisodes(body.patientId),
      intelligenceGateway.loadRecentAlerts(body.patientId),
      new PrismaRuntimeRolloutStore().list(body.orgId),
      new PrismaRuntimeExperimentAssignmentStore().list(body.orgId),
      historyStore.load(body.patientId),
    ]);

    const baselineGraph = new LongitudinalPersonalBaselineGraph(
      new PrismaLongitudinalBaselineStore(),
    );

    const persistedBaseline = await baselineGraph.build({
      patientId: body.patientId,
      currentVitals: body.currentVitals,
      previousVitals: body.previousVitals,
      lifestyle: body.lifestyle,
    });

    const baselineState = await new LongitudinalBaselineCoordinator(
      new PrismaBaselineWindowStore(),
    ).build({
      patientId: body.patientId,
      currentVitals: body.currentVitals,
      lifestyle: body.lifestyle,
    });

    const baselineFromHistory = history
      ? new PersonalBaselineGraphBuilder().build(history)
      : null;

    return {
      existingEpisodes,
      priorAlerts,
      rolloutRecords,
      experimentAssignments,
      persistedBaseline,
      baselineState,
      baselineFromHistory,
    };
  }
}