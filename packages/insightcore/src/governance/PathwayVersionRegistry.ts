import type { PathwayVersionRecord } from '../contracts/rollout';

export class PathwayVersionRegistry {
  list(): PathwayVersionRecord[] {
    return [
      {
        pathwayId: 'maternal',
        version: '1.0.0',
        enabled: true,
        orgId: 'org-default',
        updatedAt: new Date().toISOString(),
      },
      {
        pathwayId: 'post_procedure_recovery',
        version: '1.0.0',
        enabled: true,
        orgId: 'org-default',
        updatedAt: new Date().toISOString(),
      },
      {
        pathwayId: 'medication_adherence_impact',
        version: '1.0.0',
        enabled: true,
        orgId: 'org-default',
        updatedAt: new Date().toISOString(),
      },
    ];
  }
}