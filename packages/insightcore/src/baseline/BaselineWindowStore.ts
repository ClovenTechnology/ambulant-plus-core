import type { PersonalBaselineSnapshot } from '../contracts/research';

export interface BaselineWindowRecord {
  patientId: string;
  window: '24h' | '7d' | '30d';
  generatedAt: string;
  snapshot: PersonalBaselineSnapshot;
}

export interface BaselineWindowStore {
  load(patientId: string, window: BaselineWindowRecord['window']): Promise<BaselineWindowRecord | null>;
  save(record: BaselineWindowRecord): Promise<void>;
}