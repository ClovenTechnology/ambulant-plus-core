import type { PersonalBaselineSnapshot } from '../contracts/research';

export interface LongitudinalBaselineStore {
  load(patientId: string): Promise<PersonalBaselineSnapshot | null>;
  save(patientId: string, snapshot: PersonalBaselineSnapshot): Promise<void>;
}