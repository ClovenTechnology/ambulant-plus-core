export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';
export type InsightAudience = 'patient' | 'clinician' | 'admin' | 'client';
export type SignalSource =
  | 'vital'
  | 'stream'
  | 'device'
  | 'encounter'
  | 'report'
  | 'medication'
  | 'adherence'
  | 'reminder'
  | 'condition'
  | 'allergy'
  | 'vaccination'
  | 'self_check'
  | 'fertility'
  | 'antenatal'
  | 'paediatric'
  | 'lifestyle'
  | 'composite';

export type ClinicalPhase =
  | 'baseline'
  | 'acute'
  | 'recovery'
  | 'post_op'
  | 'post_partum'
  | 'post_vaccination'
  | 'post_trauma'
  | 'pregnancy'
  | 'chronic_management'
  | 'unknown';

export interface EvidenceItem {
  code: string;
  label: string;
  value?: string | number | boolean | null;
  unit?: string;
  source: SignalSource;
  observedAt?: string;
  weight?: number;
  provenance?: import('./provenance').ProvenanceContext;
}

export interface ConfidenceBreakdown {
  signalQuality: number;
  dataCompleteness: number;
  contextStrength: number;
  trendStrength: number;
  modelAgreement?: number;
  overall: number;
}

export interface VitalsSnapshot {
  hr?: number | null;
  spo2?: number | null;
  tempC?: number | null;
  systolic?: number | null;
  diastolic?: number | null;
  respiratoryRate?: number | null;
  glucoseInstabilityScore?: number | null;
  hrv?: number | null;
  recordedAt?: string | null;
  sourceDevice?: string | null;
}

export interface LifestyleSnapshot {
  avgStepsPerDay?: number | null;
  sleepHours?: number | null;
  stressScore0to10?: number | null;
  hydrationGlassesPerDay?: number | null;
  activityMinutesPerWeek?: number | null;
  medicationAdherencePct?: number | null;
  exerciseAdherencePct?: number | null;
  sleepAdherencePct?: number | null;
  hydrationAdherencePct?: number | null;
  meditationAdherencePct?: number | null;
}

export interface MedicationContext {
  activeMedicationNames: string[];
  missedMedicationCount7d: number;
  recentSideEffects: string[];
}

export interface EncounterContext {
  recentEncounterTypes: string[];
  recentProcedureTypes: string[];
  recentSymptoms: string[];
  recentDiagnoses: string[];
  lastEncounterAt?: string | null;
}


export interface AllergyProfileContextItem {
  id?: string;
  substance: string;
  reaction?: string | null;
  severity?: 'Mild' | 'Moderate' | 'Severe' | string | null;
  status?: 'Active' | 'Resolved' | string | null;
  notedAt?: string | null;
}

export interface AllergyReactionContextItem {
  id?: string;
  occurredAtISO?: string;
  occurredAt?: string;
  suspectedTrigger: string;
  symptoms?: string[];
  severity?: 'mild' | 'moderate' | 'severe' | string | null;
  medsTaken?: string | null;
  notes?: string | null;
  resolvedAtISO?: string | null;
  resolvedAt?: string | null;
}

export interface DomainContext {
  ladyCenter?: {
    cyclePhase?: string | null;
    fertilityWindow?: boolean | null;
    reportedSymptoms?: string[];
  };
  antenatal?: {
    gestationalWeeks?: number | null;
    highRiskPregnancy?: boolean | null;
    recentEmergencyFlag?: boolean | null;
  };
  paediatric?: {
    ageBand?: string | null;
    missedVaccinationFlag?: boolean | null;
  };
  gentlemensHealth?: {
    flaggedSymptoms?: string[];
  };
}

export interface PatientContextWindow {
  patientId: string;
  orgId?: string;
  age?: number | null;
  gender?: string | null;
  clinicalPhase: ClinicalPhase;
  activeConditions: string[];
  allergies: string[];
  allergyProfiles?: AllergyProfileContextItem[];
  allergyReactionLogs?: AllergyReactionContextItem[];
  vaccinationsRecent30d: string[];
  vitalsCurrent: VitalsSnapshot;
  vitalsPrevious?: VitalsSnapshot | null;
  lifestyle: LifestyleSnapshot;
  medication: MedicationContext;
  encounters: EncounterContext;
  domain: DomainContext;
  generatedAt: string;
}

export interface FeatureVector {
  patientId: string;
  orgId?: string;
  generatedAt: string;

  // core physiology
  hr?: number | null;
  spo2?: number | null;
  tempC?: number | null;
  systolic?: number | null;
  diastolic?: number | null;
  respiratoryRate?: number | null;
  glucoseInstabilityScore?: number | null;
  hrv?: number | null;

  // deltas / trend flags
  deltaHr?: number | null;
  deltaSpo2?: number | null;
  deltaTempC?: number | null;
  bpElevated?: boolean;
  lowSpo2?: boolean;
  tachycardia?: boolean;
  fever?: boolean;

  // behavior / adherence
  medicationAdherencePct?: number | null;
  missedMedicationCount7d?: number | null;
  lowHydration?: boolean;
  poorSleep?: boolean;
  sedentary?: boolean;
  highStress?: boolean;

  // context
  activeConditions: string[];
  allergies: string[];
  allergyProfiles?: AllergyProfileContextItem[];
  allergyReactionLogs?: AllergyReactionContextItem[];
  recentDiagnoses: string[];
  recentSymptoms: string[];
  recentProcedureTypes: string[];
  recentSideEffects: string[];
  recentVaccinations: string[];
  clinicalPhase: ClinicalPhase;

  // domain modules
  pregnancyHighRisk?: boolean;
  postpartumRecent?: boolean;
  recentEmergencyFlag?: boolean;
  fertilityWindow?: boolean;

  evidence: EvidenceItem[];
}

export interface InferenceOutput {
  patientId: string;
  model: string;
  syndrome?: string;
  output: Record<string, number | string | boolean | null>;
  confidence: number;
  confidenceBreakdown?: ConfidenceBreakdown;
  timestamp: string;
  evidence: EvidenceItem[];
  rationale?: string[];
  uncertainty?: import('./uncertainty').UncertaintyBundle;
}

export interface Episode {
  id: string;
  patientId: string;
  syndrome: string;
  title: string;
  status: 'open' | 'watching' | 'resolved';
  severity: RiskLevel;
  startedAt: string;
  updatedAt: string;
  resolvedAt?: string;
  riskScore: number;
  peakRiskScore: number;
  inferences: InferenceOutput[];
  evidence: EvidenceItem[];
  rationale: string[];
  suppressionKey: string;
}

export interface Alert {
  id: string;
  patientId: string;
  type: string;
  syndrome?: string;
  severity: RiskLevel;
  score: number;
  source: 'model' | 'rule' | 'hybrid' | 'episode';
  timestamp: string;
  status: 'new' | 'ack' | 'resolved' | 'suppressed';
  message: string;
  evidence: EvidenceItem[];
  rationale: string[];
  suppressionKey?: string;
  episodeId?: string;
  audience?: InsightAudience[];
}

export interface Insight {
  id: string;
  patientId: string;
  title: string;
  explanation: string;
  evidence: string[];
  confidence: number;
  confidenceBreakdown?: ConfidenceBreakdown;
  sourceModels: string[];
  recommendedActions: string[];
  audience: InsightAudience;
  timestamp: string;
  syndrome?: string;
  episodeId?: string;
  rationale?: string[];
  uncertainty?: import('./uncertainty').UncertaintyBundle;
}