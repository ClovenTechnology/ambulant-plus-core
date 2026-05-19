import type { GovernedPathway } from '../contracts/governance';

export interface PathwayRegistryStore {
  list(): Promise<GovernedPathway[]>;
  get(id: string): Promise<GovernedPathway | null>;
}