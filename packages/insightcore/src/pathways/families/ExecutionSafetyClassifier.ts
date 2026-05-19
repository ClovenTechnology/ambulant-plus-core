import type { FamilyDeploymentRecord } from './FamilyDeploymentRegistry';

export class ExecutionSafetyClassifier {
  classify(record: FamilyDeploymentRecord): 'deployment' | 'research' | 'mixed' {
    return record.class;
  }
}