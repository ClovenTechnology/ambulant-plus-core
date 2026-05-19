import { prisma } from '@/src/lib/db';

export class PrismaGovernanceAuditStore {
  async list(orgId?: string) {
    const events = await prisma.runtimeEvent.findMany({
      where: {
        kind: {
          in: [
            'insight.governance.org.update',
            'insight.governance.pathway.update',
            'insight.experiment.update',
            'insight.model.rollout.update',
          ],
        },
        ...(orgId ? { orgId } : {}),
      },
      orderBy: { ts: 'desc' },
      take: 200,
    });

    return events.map((ev) => ({
      id: ev.id,
      kind: ev.kind,
      orgId: ev.orgId || undefined,
      ts: ev.ts.toString(),
    }));
  }
}