// types.ts
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

export interface Pill {
  name: string;
  dose: string;
  time: string;
  status: 'Pending' | 'Taken' | 'Missed';
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
