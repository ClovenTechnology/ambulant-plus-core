// apps/patient-app/types.ts
// Shared types for patient-app.

export interface VitalSeries {
  date: string;
  systolic: number;
  diastolic: number;
}

export interface Vitals {
  hr: number;
  bp: string;
  temp: string;
  spo2: number;
  lastSync: string;
  bpSeries: VitalSeries[];
}

export interface Appointment {
  when: string;
  with: string;
  status: string;
}

export type PillStatus = 'Pending' | 'Taken' | 'Missed';

export interface Pill {
  id: string;
  name: string;
  dose?: string;
  time?: string;
  status: PillStatus;

  /**
   * Optional fields that may come from eRx / medication APIs.
   */
  frequency?: string;
  route?: string;
  started?: string;
  lastFilled?: string;
}

export interface Allergy {
  name: string;
  status: 'Active' | 'Resolved';
  severity: 'mild' | 'moderate' | 'severe';
  note?: string;
}

export interface Clinician {
  name: string;
  specialty: string;
  location: string;
}