export interface ProvenanceContext {
  sourceType: 'patient_self' | 'clinician_measured' | 'device_auto' | 'derived';
  deviceClass?: string | null;
  sourcePriority?: number | null;
  acquisitionContext?: string | null;
  signalQuality?: number | null;
  firmwareVersion?: string | null;
  algorithmVersion?: string | null;
  knownBiasFlags?: string[];
}

export interface ProvenancedEvidence {
  code: string;
  label: string;
  value?: string | number | boolean | null;
  unit?: string;
  observedAt?: string;
  provenance: ProvenanceContext;
  weight?: number;
}