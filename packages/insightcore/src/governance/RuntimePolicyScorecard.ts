export class RuntimePolicyScorecard {
  build(args: { runtimePlan?: any; runtimeAudit?: any }) {
    return {
      generatedAt: new Date().toISOString(),
      familyCount: args.runtimePlan?.families?.length ?? 0,
      hasAudit: Boolean(args.runtimeAudit),
      allowedFamilies:
        (args.runtimePlan?.families || []).filter((f: any) => f.allowed).length,
    };
  }
}