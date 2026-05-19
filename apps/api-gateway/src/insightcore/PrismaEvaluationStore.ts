import { prisma } from '@/src/lib/db';

export class PrismaEvaluationStore {
  async recent(orgId?: string) {
    const [episodes, alerts, experiments] = await Promise.all([
      prisma.runtimeEvent.findMany({
        where: { kind: 'insight.episode.v1', ...(orgId ? { orgId } : {}) },
        orderBy: { ts: 'desc' },
        take: 100,
      }),
      prisma.runtimeEvent.findMany({
        where: { kind: 'insight.alert.risk', ...(orgId ? { orgId } : {}) },
        orderBy: { ts: 'desc' },
        take: 100,
      }),
      prisma.runtimeEvent.findMany({
        where: { kind: 'insight.experiment.update', ...(orgId ? { orgId } : {}) },
        orderBy: { ts: 'desc' },
        take: 100,
      }),
    ]);

    return { episodes, alerts, experiments };
  }
}