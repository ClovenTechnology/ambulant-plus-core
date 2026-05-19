import type { PersonalBaselineSnapshot } from '../contracts/research';

export interface PersonalBaselineState {
  patientId: string;
  generatedAt: string;
  windows: {
    last24h?: PersonalBaselineSnapshot | null;
    last7d?: PersonalBaselineSnapshot | null;
    last30d?: PersonalBaselineSnapshot | null;
  };
}