export interface MeasurementUncertainty {
  score: number;
  reasons: string[];
}

export interface InferenceUncertainty {
  score: number;
  reasons: string[];
}

export interface ClinicalUncertainty {
  score: number;
  reasons: string[];
}

export interface UncertaintyBundle {
  measurement: MeasurementUncertainty;
  inference: InferenceUncertainty;
  clinical: ClinicalUncertainty;
  overall: number;
}