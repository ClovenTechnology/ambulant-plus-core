import type { RuntimeExecutionPlan } from './RuntimeExecutionPlan';

export class RuntimeExecutionAudit {
  build(args: {
    plan: RuntimeExecutionPlan;
    researchInferenceCount: number;
    deploymentInferenceCount: number;
  }) {
    return {
      generatedAt: new Date().toISOString(),
      plan: args.plan,
      researchInferenceCount: args.researchInferenceCount,
      deploymentInferenceCount: args.deploymentInferenceCount,
    };
  }
}