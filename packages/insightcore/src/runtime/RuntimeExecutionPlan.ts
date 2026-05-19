import type { FamilyExecutionDecision } from '../pathways/families/FamilyExecutionDecision';

export interface RuntimeExecutionPlan {
  generatedAt: string;
  researchMode: boolean;
  families: FamilyExecutionDecision[];
}