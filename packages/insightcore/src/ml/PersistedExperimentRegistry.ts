import type { ExperimentRecord } from '../contracts/rollout';

export interface ExperimentStore {
  list(orgId?: string): Promise<ExperimentRecord[]>;
}

export class PersistedExperimentRegistry {
  constructor(private readonly store: ExperimentStore) {}

  async list(orgId?: string): Promise<ExperimentRecord[]> {
    return this.store.list(orgId);
  }

  async active(orgId?: string): Promise<ExperimentRecord[]> {
    const all = await this.store.list(orgId);
    return all.filter((e) => e.active);
  }
}