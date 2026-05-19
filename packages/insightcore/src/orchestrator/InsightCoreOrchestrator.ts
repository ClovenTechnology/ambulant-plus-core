// packages/insightcore/src/orchestrator/InsightCoreOrchestrator.ts
import { Alert, Episode, Insight, PatientContextWindow, VitalsSnapshot } from '../contracts';
import { ContextEngine } from '../context-engine/ContextEngine';
import { FeatureFabric } from '../feature-fabric/FeatureFabric';
import { ProvenanceWeightedFeatureFabric } from '../provenance/ProvenanceWeightedFeatureFabric';
import { BiasAwareEvidenceAdjuster } from '../provenance/BiasAwareEvidenceAdjuster';
import { EvidenceReliabilityScorer } from '../provenance/EvidenceReliabilityScorer';
import { RuleBasedInferenceEngine } from '../inference/RuleBasedInferenceEngine';
import { CompositeRiskEngine } from '../inference/CompositeRiskEngine';
import { PersonalBaselineGraph } from '../baseline/PersonalBaselineGraph';
import { MaternalPathwayEngine } from '../pathways/MaternalPathwayEngine';
import { PostProcedureRecoveryEngine } from '../pathways/PostProcedureRecoveryEngine';
import { MedicationAdherenceImpactEngine } from '../pathways/MedicationAdherenceImpactEngine';
import { BaselineDeviationEngine } from '../pathways/BaselineDeviationEngine';
import { SleepDebtBPTrajectoryEngine } from '../pathways/SleepDebtBPTrajectoryEngine';
import { SeizureResearchEngine } from '../pathways/SeizureResearchEngine';
import { MeasurementUncertaintyEngine } from '../uncertainty/MeasurementUncertaintyEngine';
import { ClinicalUncertaintyEngine } from '../uncertainty/ClinicalUncertaintyEngine';
import { InferenceUncertaintyEngine } from '../uncertainty/InferenceUncertaintyEngine';
import { UncertaintyComposer } from '../uncertainty/UncertaintyComposer';
import { BiasImpactEngine } from '../uncertainty/BiasImpactEngine';
import { AbstentionPolicy } from '../uncertainty/AbstentionPolicy';
import { AlertUncertaintyProjector } from '../uncertainty/AlertUncertaintyProjector';
import { EpisodeEngine } from '../episodes/EpisodeEngine';
import { AlertEngineV2 } from '../alerts/AlertEngineV2';
import { InsightGeneratorV2 } from '../insights/InsightGeneratorV2';

import { TemporalContextProfile } from '../domain/TemporalContextProfile';
import { PhaseAwareContextAugmenter } from '../domain/PhaseAwareContextAugmenter';
import { FamilyRuntimeSelector } from '../pathways/families/FamilyRuntimeSelector';
import { LifestyleStateAttributor } from '../domain/LifestyleStateAttributor';
import { BaselineDeviationAttributor } from '../domain/BaselineDeviationAttributor';
import { BaselineTrendInterpreter } from '../baseline/BaselineTrendInterpreter';
import { PathwayEvidenceGate } from '../provenance/PathwayEvidenceGate';
import { SleepDebtRecoveryEngine } from '../pathways/SleepDebtRecoveryEngine';
import { AutonomicShiftResearchEngine } from '../pathways/AutonomicShiftResearchEngine';
import { BaselineAwareAlertPolicy } from '../alerts/BaselineAwareAlertPolicy';
import { BaselineAwareInsightAugmenter } from '../insights/BaselineAwareInsightAugmenter';

import { RuntimeExecutionPlanner } from '../runtime/RuntimeExecutionPlanner';
import { ResearchOutputSeparator } from '../runtime/ResearchOutputSeparator';
import { RolloutAwareRuntimeSelector } from '../runtime/RolloutAwareRuntimeSelector';
import { ExperimentGateEvaluator } from '../runtime/ExperimentGateEvaluator';
import { ResearchIsolationPolicy } from '../runtime/ResearchIsolationPolicy';
import { RuntimeAudiencePolicy } from '../runtime/RuntimeAudiencePolicy';
import { RuntimeStandardsRouter } from '../runtime/RuntimeStandardsRouter';
import { RuntimeExecutionAudit } from '../runtime/RuntimeExecutionAudit';

import { SleepDebtEscalationForecaster } from '../pathways/SleepDebtEscalationForecaster';
import { BaselineStateInterpreterEngine } from '../pathways/BaselineStateInterpreterEngine';
import { AutonomicStressResearchEngine } from '../pathways/AutonomicStressResearchEngine';
import { RecoveryStabilityEngine } from '../pathways/RecoveryStabilityEngine';
import { AllergyRiskPredictionEngine } from '../pathways/AllergyRiskPredictionEngine';
import { ResearchPipelinePlanner } from '../research/ResearchPipelinePlanner';
import { ResearchSignalProjector } from '../research/ResearchSignalProjector';

type LegacyFeatureVector = ReturnType<FeatureFabric['build']>;

export interface OrchestratorInput {
  patientId: string;
  orgId?: string;
  age?: number | null;
  gender?: string | null;
  currentVitals: VitalsSnapshot;
  previousVitals?: VitalsSnapshot | null;
  activeConditions?: string[];
  allergies?: string[];
  allergyProfiles?: PatientContextWindow['allergyProfiles'];
  allergyReactionLogs?: PatientContextWindow['allergyReactionLogs'];
  vaccinationsRecent30d?: string[];
  lifestyle?: PatientContextWindow['lifestyle'];
  medication?: Partial<PatientContextWindow['medication']>;
  encounters?: Partial<PatientContextWindow['encounters']>;
  domain?: PatientContextWindow['domain'];
  existingEpisodes?: Episode[];
  priorAlerts?: Alert[];
  rolloutRecords?: Array<{ familyId: string; enabled: boolean; trafficPercent: number }>;
  experimentAssignments?: Array<{ familyId: string; experimentId: string; active: boolean }>;
  researchMode?: boolean;
}

export interface OrchestratorOutput {
  context: PatientContextWindow;
  featureVector: LegacyFeatureVector;
  baseline?: import('../contracts/research').PersonalBaselineSnapshot;
  baselineTrend?: any;
  temporalProfile?: any;
  familyPlan?: any;
  baselineLabels?: any;
  lifestyleStates?: any;
  inferences: any[];
  episodes: Episode[];
  alerts: Alert[];
  insights: Insight[];
  runtimePlan?: any;
  researchInferences?: any[];
  deploymentInferences?: any[];
  runtimeAudit?: any;
  researchPipelines?: any;
  researchSignals?: any;
}

function evidenceSourceFrom(value: Record<string, any>): string {
  const candidates = [
    value.source,
    value.sourceId,
    value.provenanceSource,
    value.provenance?.source,
    value.provenance?.sourceId,
    value.meta?.source,
    value.metadata?.source,
    value.channel,
    value.deviceId,
    value.kind,
    value.type,
  ];

  for (const candidate of candidates) {
    const s = String(candidate ?? '').trim();
    if (s) return s;
  }

  return 'provenance_weighted_feature_fabric';
}

function toLegacyFeatureVector(value: unknown): LegacyFeatureVector {
  const vector = value as Record<string, any>;
  const evidence = Array.isArray(vector.evidence) ? vector.evidence : [];

  return {
    ...vector,
    evidence: evidence.map((item: unknown) => {
      const ev =
        item && typeof item === 'object' && !Array.isArray(item)
          ? (item as Record<string, any>)
          : { value: item };

      return {
        ...ev,
        source: evidenceSourceFrom(ev),
      };
    }),
  } as LegacyFeatureVector;
}

export class InsightCoreOrchestrator {
  private contextEngine = new ContextEngine();
  private featureFabric = new ProvenanceWeightedFeatureFabric();
  private biasAwareEvidenceAdjuster = new BiasAwareEvidenceAdjuster();
  private reliabilityScorer = new EvidenceReliabilityScorer();
  private inferenceEngine = new RuleBasedInferenceEngine();
  private compositeRiskEngine = new CompositeRiskEngine();
  private maternalPathwayEngine = new MaternalPathwayEngine();
  private postProcedureRecoveryEngine = new PostProcedureRecoveryEngine();
  private medicationAdherenceImpactEngine = new MedicationAdherenceImpactEngine();
  private baselineGraph = new PersonalBaselineGraph();
  private baselineDeviationEngine = new BaselineDeviationEngine();
  private sleepDebtBPTrajectoryEngine = new SleepDebtBPTrajectoryEngine();
  private seizureResearchEngine = new SeizureResearchEngine({
    enabled: false,
    mode: 'off',
    rationale: 'research_gate_default_off',
  });
  private measurementUncertaintyEngine = new MeasurementUncertaintyEngine();
  private clinicalUncertaintyEngine = new ClinicalUncertaintyEngine();
  private inferenceUncertaintyEngine = new InferenceUncertaintyEngine();
  private uncertaintyComposer = new UncertaintyComposer();
  private biasImpactEngine = new BiasImpactEngine();
  private abstentionPolicy = new AbstentionPolicy();
  private alertUncertaintyProjector = new AlertUncertaintyProjector();
  private episodeEngine = new EpisodeEngine();
  private alertEngine = new AlertEngineV2();
  private insightGenerator = new InsightGeneratorV2();

  private temporalContextProfile = new TemporalContextProfile();
  private phaseAwareContextAugmenter = new PhaseAwareContextAugmenter();
  private familyRuntimeSelector = new FamilyRuntimeSelector();

  private lifestyleStateAttributor = new LifestyleStateAttributor();
  private baselineDeviationAttributor = new BaselineDeviationAttributor();
  private baselineTrendInterpreter = new BaselineTrendInterpreter();
  private pathwayEvidenceGate = new PathwayEvidenceGate();
  private sleepDebtRecoveryEngine = new SleepDebtRecoveryEngine();
  private autonomicShiftResearchEngine = new AutonomicShiftResearchEngine({
    enabled: false,
    mode: 'off',
    rationale: 'research_gate_default_off',
  });
  private baselineAwareAlertPolicy = new BaselineAwareAlertPolicy();
  private baselineAwareInsightAugmenter = new BaselineAwareInsightAugmenter();

  private runtimeExecutionPlanner = new RuntimeExecutionPlanner();
  private researchOutputSeparator = new ResearchOutputSeparator();

  private rolloutAwareRuntimeSelector = new RolloutAwareRuntimeSelector();
  private experimentGateEvaluator = new ExperimentGateEvaluator();
  private researchIsolationPolicy = new ResearchIsolationPolicy();
  private runtimeAudiencePolicy = new RuntimeAudiencePolicy();
  private runtimeStandardsRouter = new RuntimeStandardsRouter();
  private runtimeExecutionAudit = new RuntimeExecutionAudit();

  private sleepDebtEscalationForecaster = new SleepDebtEscalationForecaster();
  private baselineStateInterpreterEngine = new BaselineStateInterpreterEngine();
  private autonomicStressResearchEngine = new AutonomicStressResearchEngine({
    enabled: false,
    mode: 'off',
    rationale: 'research_gate_default_off',
  });
  private recoveryStabilityEngine = new RecoveryStabilityEngine();
  private allergyRiskPredictionEngine = new AllergyRiskPredictionEngine();
  private researchPipelinePlanner = new ResearchPipelinePlanner();
  private researchSignalProjector = new ResearchSignalProjector();

  async run(input: OrchestratorInput): Promise<OrchestratorOutput> {
    const rawContext = this.contextEngine.build({
      patientId: input.patientId,
      orgId: input.orgId,
      age: input.age,
      gender: input.gender,
      activeConditions: input.activeConditions,
      allergies: input.allergies,
      allergyProfiles: input.allergyProfiles,
      allergyReactionLogs: input.allergyReactionLogs,
      vaccinationsRecent30d: input.vaccinationsRecent30d,
      currentVitals: input.currentVitals,
      previousVitals: input.previousVitals,
      lifestyle: input.lifestyle,
      medication: input.medication,
      encounters: input.encounters,
      domain: input.domain,
    });

    const context = this.phaseAwareContextAugmenter.augment(rawContext);

    const provenanceFeatureVector = this.featureFabric.build({
      patientId: input.patientId,
      orgId: input.orgId,
      currentVitals: input.currentVitals,
      previousVitals: input.previousVitals,
      context,
    });

    let adjusted = this.biasAwareEvidenceAdjuster.adjust(
      (provenanceFeatureVector as any).evidence as any,
    );
    adjusted = this.reliabilityScorer.score(adjusted as any);

    const featureVector = toLegacyFeatureVector({
      ...provenanceFeatureVector,
      evidence: adjusted,
    });

    const baseline = this.baselineGraph.build({
      patientId: input.patientId,
      currentVitals: input.currentVitals,
      previousVitals: input.previousVitals,
      lifestyle: input.lifestyle,
    });

    const baselineLabels = this.baselineDeviationAttributor.attribute(baseline);
    const lifestyleStates = this.lifestyleStateAttributor.attribute(featureVector);
    const baselineTrend = this.baselineTrendInterpreter.interpret({
      patientId: input.patientId,
      generatedAt: new Date().toISOString(),
      windows: {
        last24h: baseline,
        last7d: baseline,
        last30d: baseline,
      },
    });

    const temporalProfile = this.temporalContextProfile.build({
      patientId: input.patientId,
      generatedAt: new Date().toISOString(),
      windows: {
        last24h: baseline,
        last7d: baseline,
        last30d: baseline,
      },
    });

    const familyPlan = this.familyRuntimeSelector.select({
      researchMode: false,
    });

    const baseRuntimePlan = this.runtimeExecutionPlanner.build({
      researchMode: Boolean(input.researchMode),
    });

    const gatedRuntimePlan = this.rolloutAwareRuntimeSelector.apply(
      baseRuntimePlan,
      input.rolloutRecords || [],
    );

    const runtimePlan = {
      ...gatedRuntimePlan,
      families: gatedRuntimePlan.families.map((family: any) => ({
        ...family,
        allowed:
          family.allowed &&
          this.experimentGateEvaluator.allow({
            familyId: family.familyId,
            assignments: input.experimentAssignments || [],
            researchMode: Boolean(input.researchMode),
          }),
      })),
    };

    const [
      ruleInferences,
      compositeInferences,
      maternalInferences,
      recoveryInferences,
      adherenceImpactInferences,
      baselineDeviationInferences,
      sleepDebtBpInferences,
      seizureResearchInferences,
      sleepDebtRecoveryInferences,
      autonomicShiftResearchInferences,
      sleepDebtEscalationInferences,
      baselineStateInterpretationInferences,
      autonomicStressResearchInferences,
      recoveryStabilityInferences,
      allergyRiskInferences,
    ] = await Promise.all([
      this.inferenceEngine.run(input.patientId, featureVector),
      this.compositeRiskEngine.run(input.patientId, featureVector),
      this.maternalPathwayEngine.run(input.patientId, featureVector),
      this.postProcedureRecoveryEngine.run(input.patientId, featureVector),
      this.medicationAdherenceImpactEngine.run(input.patientId, featureVector),
      this.baselineDeviationEngine.run(input.patientId, featureVector, baseline),
      this.sleepDebtBPTrajectoryEngine.run(input.patientId, featureVector, baseline),
      this.seizureResearchEngine.run(input.patientId, featureVector),
      this.sleepDebtRecoveryEngine.run(input.patientId, featureVector, baseline),
      this.autonomicShiftResearchEngine.run(input.patientId, featureVector),
      this.sleepDebtEscalationForecaster.run(input.patientId, featureVector, baseline),
      this.baselineStateInterpreterEngine.run(input.patientId, featureVector, baseline),
      this.autonomicStressResearchEngine.run(input.patientId, featureVector),
      this.recoveryStabilityEngine.run(input.patientId, featureVector, baseline),
      this.allergyRiskPredictionEngine.run(input.patientId, featureVector as any, baseline),
    ]);

    const inferences = [
      ...ruleInferences,
      ...compositeInferences,
      ...maternalInferences,
      ...recoveryInferences,
      ...adherenceImpactInferences,
      ...baselineDeviationInferences,
      ...sleepDebtBpInferences,
      ...seizureResearchInferences,
      ...sleepDebtRecoveryInferences,
      ...autonomicShiftResearchInferences,
      ...sleepDebtEscalationInferences,
      ...baselineStateInterpretationInferences,
      ...autonomicStressResearchInferences,
      ...recoveryStabilityInferences,
      ...allergyRiskInferences,
    ];

    const uncertainty = this.uncertaintyComposer.compose({
      measurement: this.measurementUncertaintyEngine.evaluate(featureVector.evidence as any),
      inference: this.inferenceUncertaintyEngine.evaluate(inferences),
      clinical: this.clinicalUncertaintyEngine.evaluate(featureVector),
    });

    const biasImpact = this.biasImpactEngine.compute(featureVector.evidence as any);

    uncertainty.overall = Math.min(
      1,
      Number((uncertainty.overall + biasImpact).toFixed(3)),
    );

    const abstention = this.abstentionPolicy.evaluate(uncertainty);

    const enrichedInferences = inferences
      .map((inf) => ({
        ...inf,
        uncertainty,
      }))
      .filter(() => !abstention.abstain);

    const separated = this.researchOutputSeparator.split(enrichedInferences as any);
    const deploymentInferences = separated.deployment;
    const researchInferences = separated.research;

    const researchClassified = researchInferences.map((inf: any) => ({
      ...inf,
      runtimeClass: this.researchIsolationPolicy.classifyInference(
        String(inf.model || ''),
        String(inf.output?.ruleId || ''),
      ),
      audience: this.runtimeAudiencePolicy.audienceFor({ research: true }),
      standardsRoute: this.runtimeStandardsRouter.route({ research: true }),
    }));

    const deploymentClassified = deploymentInferences.map((inf: any) => ({
      ...inf,
      runtimeClass: this.researchIsolationPolicy.classifyInference(
        String(inf.model || ''),
        String(inf.output?.ruleId || ''),
      ),
      audience: this.runtimeAudiencePolicy.audienceFor({ research: false }),
      standardsRoute: this.runtimeStandardsRouter.route({ research: false }),
    }));

    const runtimeAudit = this.runtimeExecutionAudit.build({
      plan: runtimePlan as any,
      researchInferenceCount: researchClassified.length,
      deploymentInferenceCount: deploymentClassified.length,
    });

    const researchPipelines = this.researchPipelinePlanner.build();
    const researchSignals = this.researchSignalProjector.build({
      researchInferences: researchClassified,
    });

    const episodes = this.episodeEngine.group({
      patientId: input.patientId,
      existingEpisodes: input.existingEpisodes,
      inferences: deploymentClassified,
    });

    const baselineAwareEpisodes = episodes.map((ep) =>
      this.baselineAwareAlertPolicy.augment(ep, baseline),
    );

    const alerts = this.alertUncertaintyProjector.apply(
      this.alertEngine.evaluate({
        episodes: baselineAwareEpisodes,
        priorAlerts: input.priorAlerts,
      }),
      uncertainty,
    );

    const insights = this.insightGenerator.generate({
      alerts,
      episodes: baselineAwareEpisodes,
    });

    const enrichedInsights = this.baselineAwareInsightAugmenter.apply(
      insights.map((ins) => ({
        ...ins,
        uncertainty,
      })),
      baseline,
    );

    return {
      context,
      featureVector,
      baseline,
      baselineTrend,
      temporalProfile,
      familyPlan,
      baselineLabels,
      lifestyleStates,
      inferences: enrichedInferences,
      episodes: baselineAwareEpisodes,
      alerts,
      insights: enrichedInsights,
      runtimePlan: runtimePlan as any,
      researchInferences: researchClassified as any,
      deploymentInferences: deploymentClassified as any,
      runtimeAudit: runtimeAudit as any,
      researchPipelines: researchPipelines as any,
      researchSignals: researchSignals as any,
    };
  }
}