import type { OrgGovernanceBundle, OrgGovernanceProvider } from './OrgGovernanceProvider';

const DEFAULT_BUNDLES: Record<string, OrgGovernanceBundle> = {
  'org-default': {
    orgId: 'org-default',
    ruleWeights: {
      cardio_bp: 0.26,
      cardio_tachy: 0.18,
      cardio_diag: 0.16,
      cardio_adherence: 0.14,
      cardio_stress: 0.08,
      cardio_sleep: 0.06,
      sepsis_fever: 0.32,
      sepsis_tachy: 0.24,
      sepsis_diag: 0.18,
      sepsis_symptom: 0.12,
      sepsis_emergency: 0.12,
      sepsis_hydration: 0.05,
      resp_spo2: 0.34,
      resp_rr: 0.18,
      resp_diag: 0.18,
      resp_symptom: 0.16,
      resp_sleep: 0.04,
    },
    pathways: [
      {
        id: 'maternal',
        version: '1.0.0',
        enabled: true,
        owner: 'insightcore',
        title: 'Maternal pathway',
        description: 'Pregnancy and postpartum contextual risk logic',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'post_procedure_recovery',
        version: '1.0.0',
        enabled: true,
        owner: 'insightcore',
        title: 'Post-procedure recovery pathway',
        description: 'Recovery-state reasoning after procedures and surgery',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'medication_adherence_impact',
        version: '1.0.0',
        enabled: true,
        owner: 'insightcore',
        title: 'Medication adherence impact pathway',
        description: 'Links adherence decline to physiologic change',
        updatedAt: new Date().toISOString(),
      },
    ],
  },
};

export class InMemoryOrgGovernanceProvider implements OrgGovernanceProvider {
  async get(orgId?: string): Promise<OrgGovernanceBundle | null> {
    if (!orgId) return DEFAULT_BUNDLES['org-default'] ?? null;
    return DEFAULT_BUNDLES[orgId] ?? DEFAULT_BUNDLES['org-default'] ?? null;
  }
}