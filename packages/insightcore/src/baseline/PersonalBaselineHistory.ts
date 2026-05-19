export interface BaselineHistoryPoint {
  ts: string;
  restingHr?: number | null;
  systolic?: number | null;
  diastolic?: number | null;
  sleepHours?: number | null;
}

export interface PersonalBaselineHistory {
  patientId: string;
  points: BaselineHistoryPoint[];
}