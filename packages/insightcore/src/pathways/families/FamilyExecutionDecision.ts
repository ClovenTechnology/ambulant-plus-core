export interface FamilyExecutionDecision {
  familyId: string;
  allowed: boolean;
  reason: string;
  class: 'deployment' | 'research' | 'mixed';
}