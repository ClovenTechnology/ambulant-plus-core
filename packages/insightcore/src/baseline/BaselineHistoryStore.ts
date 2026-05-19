import type { PersonalBaselineHistory, BaselineHistoryPoint } from './PersonalBaselineHistory';

export interface BaselineHistoryStore {
  load(patientId: string): Promise<PersonalBaselineHistory | null>;
  append(patientId: string, point: BaselineHistoryPoint): Promise<void>;
}