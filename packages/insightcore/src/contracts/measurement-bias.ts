export interface MeasurementBiasFlag {
  code: string;
  label: string;
  severity: 'low' | 'moderate' | 'high';
}

export interface MeasurementBiasAssessment {
  flags: MeasurementBiasFlag[];
  adjustedWeightDelta: number;
}