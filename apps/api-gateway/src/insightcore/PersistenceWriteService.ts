import { RuntimeInsightPersistence } from './RuntimeInsightPersistence';

export class PersistenceWriteService {
  private persistence = new RuntimeInsightPersistence();

  async persist(args: {
    patientId: string;
    orgId?: string;
    clinicianId?: string | null;
    encounterId?: string | null;
    result: any;
  }) {
    await this.persistence.persistEpisodes({
      patientId: args.patientId,
      orgId: args.orgId,
      clinicianId: args.clinicianId,
      encounterId: args.encounterId,
      episodes: args.result.episodes || [],
    });

    await this.persistence.persistAlerts({
      patientId: args.patientId,
      orgId: args.orgId,
      clinicianId: args.clinicianId,
      encounterId: args.encounterId,
      alerts: args.result.alerts || [],
      episodes: args.result.episodes || [],
    });

    await this.persistence.persistInsights({
      patientId: args.patientId,
      orgId: args.orgId,
      clinicianId: args.clinicianId,
      encounterId: args.encounterId,
      insights: args.result.insights || [],
    });
  }
}