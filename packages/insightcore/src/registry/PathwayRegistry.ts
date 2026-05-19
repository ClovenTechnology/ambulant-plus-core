// packages/insightcore/src/registry/PathwayRegistry.ts
import type { GovernedPathway } from '../contracts/governance';
import type { PathwayRegistryStore } from '../governance/PathwayRegistryStore';

export interface RegisteredPathway extends GovernedPathway {}

const nowIso = () => new Date().toISOString();

const DEFAULT_PATHWAYS: RegisteredPathway[] = [
  {
    id: 'maternal',
    version: '1.0.0',
    title: 'Maternal pathway',
    description: 'Pregnancy and postpartum contextual risk logic',
    owner: 'insightcore',
    enabled: true,
    updatedAt: nowIso(),
  },
  {
    id: 'post_procedure_recovery',
    version: '1.0.0',
    title: 'Post-procedure recovery pathway',
    description: 'Recovery-state reasoning after procedures and surgery',
    owner: 'insightcore',
    enabled: true,
    updatedAt: nowIso(),
  },
  {
    id: 'medication_adherence_impact',
    version: '1.0.0',
    title: 'Medication adherence impact pathway',
    description: 'Links adherence decline to physiologic change',
    owner: 'insightcore',
    enabled: true,
    updatedAt: nowIso(),
  },
  {
    id: 'allergy_risk',
    version: '1.0.0',
    title: 'Allergy risk pathway',
    description: 'Predictive allergy and reaction-risk pathway',
    owner: 'insightcore',
    enabled: true,
    updatedAt: nowIso(),
  },
];

export class PathwayRegistry {
  constructor(private readonly store?: PathwayRegistryStore) {}

  async list(): Promise<RegisteredPathway[]> {
    if (this.store) return this.store.list();

    return DEFAULT_PATHWAYS;
  }

  async get(id: string): Promise<RegisteredPathway | null> {
    if (this.store) return this.store.get(id);

    return DEFAULT_PATHWAYS.find((pathway) => pathway.id === id) ?? null;
  }
}