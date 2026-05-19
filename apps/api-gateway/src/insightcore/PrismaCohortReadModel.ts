import { prisma } from '@/src/lib/db';

export class PrismaCohortReadModel {
  async summary(orgId?: string) {
    const [episodeCount, alertCount, patientRows] = await Promise.all([
      prisma.runtimeEvent.count({
        where: { kind: 'insight.episode.v1', ...(orgId ? { orgId } : {}) },
      }),
      prisma.runtimeEvent.count({
        where: { kind: 'insight.alert.risk', ...(orgId ? { orgId } : {}) },
      }),
      prisma.runtimeEvent.findMany({
        where: { kind: 'insight.episode.v1', ...(orgId ? { orgId } : {}) },
        select: { patientId: true },
        distinct: ['patientId'],
      }),
    ]);

    return {
      totalEpisodes: episodeCount,
      totalAlerts: alertCount,
      totalPatients: patientRows.length,
    };
  }
}