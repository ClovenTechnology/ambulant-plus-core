// apps/api-gateway/src/insightcore/ingestPipeline.ts
import crypto from 'node:crypto';
import { InsightCoreOrchestrator } from '../../../../packages/insightcore/src/orchestrator/InsightCoreOrchestrator';
import { ExecutionAssemblyService } from './ExecutionAssemblyService';
import { PersistenceWriteService } from './PersistenceWriteService';
import { StandardsPackagingService } from './StandardsPackagingService';

function cleanString(value: unknown): string | undefined {
  const s = String(value ?? '').trim();
  return s || undefined;
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

export async function ingestPipeline(body: any) {
  const requestId = crypto.randomUUID();

  const patientId = cleanString(body.patientId);
  const orgId = cleanString(body.orgId) || 'org-default';
  const clinicianId = cleanString(body.clinicianId) || null;
  const encounterId = cleanString(body.encounterId) || null;

  if (!patientId) {
    throw new Error('patientId_required');
  }

  const assembly = await new ExecutionAssemblyService().assemble({
    ...body,
    patientId,
    orgId,
    clinicianId,
    encounterId,
  });

  const orchestrator = new InsightCoreOrchestrator();

  const result = await orchestrator.run({
    patientId,
    orgId,
    currentVitals: body.currentVitals,
    previousVitals: body.previousVitals,
    lifestyle: body.lifestyle,
    priorAlerts: assembly.priorAlerts,
    existingEpisodes: assembly.existingEpisodes,
  });

  const resultAny = asRecord(result);
  const lineage = resultAny.lineage ?? null;
  const trace = resultAny.trace ?? null;

  await new PersistenceWriteService().persist({
    patientId,
    orgId,
    clinicianId,
    encounterId,
    result,
  });

  const standards = new StandardsPackagingService().build({
    patientId,
    result: resultAny,
    baselineState: assembly.baselineState,
    execution: lineage ? { lineage } : undefined,
  });

  return {
    requestId,

    episode: resultAny.episode ?? null,
    episodes: resultAny.episodes ?? (resultAny.episode ? [resultAny.episode] : []),

    alerts: resultAny.alerts ?? [],
    insights: resultAny.insights ?? [],

    inferences: resultAny.inferences ?? [],
    deploymentInferences: resultAny.deploymentInferences ?? [],
    researchInferences: resultAny.researchInferences ?? [],

    baseline:
      resultAny.baseline ??
      assembly.baselineFromHistory ??
      assembly.persistedBaseline ??
      null,
    baselineTrend: resultAny.baselineTrend ?? null,
    baselineState: assembly.baselineState ?? null,

    cohort: resultAny.cohort ?? null,

    runtimePlan: resultAny.runtimePlan ?? null,
    runtimeAudit: resultAny.runtimeAudit ?? null,
    rolloutRecords: assembly.rolloutRecords ?? [],
    experimentAssignments: assembly.experimentAssignments ?? [],

    researchPipelines: resultAny.researchPipelines ?? null,
    researchSignals: resultAny.researchSignals ?? null,

    trace,
    lineage,

    fhir: standards.fhir ?? null,
    omop: standards.omop ?? null,
    fhirEpisodeProjection: standards.fhirEpisodeProjection ?? [],
    omopEpisodeProjection: standards.omopEpisodeProjection ?? [],
    deploymentEnvelope: standards.deploymentEnvelope ?? null,
    researchEnvelope: standards.researchEnvelope ?? null,
    omopDeploymentEnvelope: standards.omopDeploymentEnvelope ?? null,
    omopResearchEnvelope: standards.omopResearchEnvelope ?? null,
  };
}