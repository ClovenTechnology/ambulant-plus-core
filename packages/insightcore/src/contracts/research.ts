export interface ResearchGate {
  enabled: boolean;
  mode: 'off' | 'research' | 'internal_validation';
  rationale: string;
}

export interface BaselineDeviation {
  metric: string;
  baseline: number | null;
  current: number | null;
  delta: number | null;
  deltaPct: number | null;
  abnormal: boolean;
}

export interface PersonalBaselineSnapshot {
  patientId: string;
  generatedAt: string;
  restingHrBaseline: number | null;
  sleepHoursBaseline: number | null;
  systolicBaseline: number | null;
  diastolicBaseline: number | null;
  spo2Baseline: number | null;
  temperatureBaseline: number | null;
  hrvBaseline: number | null;
  deviations: BaselineDeviation[];
}