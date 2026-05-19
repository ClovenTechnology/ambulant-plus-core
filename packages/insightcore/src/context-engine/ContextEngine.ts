import {
  AllergyProfileContextItem,
  AllergyReactionContextItem,
  ClinicalPhase,
  EncounterContext,
  LifestyleSnapshot,
  MedicationContext,
  PatientContextWindow,
  VitalsSnapshot,
} from '../contracts';
import { ClinicalPhaseResolver } from './ClinicalPhaseResolver';

export interface ContextEngineInput {
  patientId: string;
  orgId?: string;
  age?: number | null;
  gender?: string | null;
  activeConditions?: string[];
  allergies?: string[];
  allergyProfiles?: AllergyProfileContextItem[];
  allergyReactionLogs?: AllergyReactionContextItem[];
  vaccinationsRecent30d?: string[];
  currentVitals: VitalsSnapshot;
  previousVitals?: VitalsSnapshot | null;
  lifestyle?: LifestyleSnapshot;
  medication?: Partial<MedicationContext>;
  encounters?: Partial<EncounterContext>;
  domain?: PatientContextWindow['domain'];
}

export class ContextEngine {
  private phaseResolver = new ClinicalPhaseResolver();

  build(input: ContextEngineInput): PatientContextWindow {
    const medication: MedicationContext = {
      activeMedicationNames: input.medication?.activeMedicationNames ?? [],
      missedMedicationCount7d: input.medication?.missedMedicationCount7d ?? 0,
      recentSideEffects: input.medication?.recentSideEffects ?? [],
    };

    const encounters: EncounterContext = {
      recentEncounterTypes: input.encounters?.recentEncounterTypes ?? [],
      recentProcedureTypes: input.encounters?.recentProcedureTypes ?? [],
      recentSymptoms: input.encounters?.recentSymptoms ?? [],
      recentDiagnoses: input.encounters?.recentDiagnoses ?? [],
      lastEncounterAt: input.encounters?.lastEncounterAt ?? null,
    };

    const lifestyle: LifestyleSnapshot = {
      avgStepsPerDay: input.lifestyle?.avgStepsPerDay ?? null,
      sleepHours: input.lifestyle?.sleepHours ?? null,
      stressScore0to10: input.lifestyle?.stressScore0to10 ?? null,
      hydrationGlassesPerDay: input.lifestyle?.hydrationGlassesPerDay ?? null,
      activityMinutesPerWeek: input.lifestyle?.activityMinutesPerWeek ?? null,
      medicationAdherencePct: input.lifestyle?.medicationAdherencePct ?? null,
      exerciseAdherencePct: input.lifestyle?.exerciseAdherencePct ?? null,
      sleepAdherencePct: input.lifestyle?.sleepAdherencePct ?? null,
      hydrationAdherencePct: input.lifestyle?.hydrationAdherencePct ?? null,
      meditationAdherencePct: input.lifestyle?.meditationAdherencePct ?? null,
    };

    return {
      patientId: input.patientId,
      orgId: input.orgId,
      age: input.age ?? null,
      gender: input.gender ?? null,
      clinicalPhase: this.phaseResolver.resolve({
        activeConditions: input.activeConditions ?? [],
        recentProcedureTypes: encounters.recentProcedureTypes,
        recentDiagnoses: encounters.recentDiagnoses,
        recentSymptoms: encounters.recentSymptoms,
        recentVaccinations: input.vaccinationsRecent30d ?? [],
        domain: input.domain,
      }),
      activeConditions: input.activeConditions ?? [],
      allergies: input.allergies ?? [],
      allergyProfiles: input.allergyProfiles || [],
      allergyReactionLogs: input.allergyReactionLogs || [],
      vaccinationsRecent30d: input.vaccinationsRecent30d ?? [],
      vitalsCurrent: input.currentVitals,
      vitalsPrevious: input.previousVitals ?? null,
      lifestyle,
      medication,
      encounters,
      domain: input.domain ?? {},
      generatedAt: new Date().toISOString(),
    };
  }
}