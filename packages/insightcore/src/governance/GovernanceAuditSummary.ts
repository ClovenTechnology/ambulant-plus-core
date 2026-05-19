export class GovernanceAuditSummary {
  build(args: { changes: Array<{ id: string; kind: string; orgId?: string; ts: string }> }) {
    return {
      generatedAt: new Date().toISOString(),
      totalChanges: args.changes.length,
      kinds: [...new Set(args.changes.map((c) => c.kind))],
      latest: args.changes[0] ?? null,
    };
  }
}