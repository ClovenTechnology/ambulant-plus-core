import crypto from 'node:crypto';
import { prisma } from '@/src/lib/db';
import type { Alert, Episode, Insight } from '../../../../packages/insightcore/src';
import { classifySeverityForScore } from '@/src/insightcore/riskRules';

function nowTs() {
  return BigInt(Date.now());
}

function ruleIdForEpisode(ep: Episode): string {
  const first = ep.inferences[0]?.output?.ruleId;
  if (typeof first === 'string') return first;

  switch (ep.syndrome) {
    case 'systemicSepsis':
      return 'composite.sepsis.bundle.1';
    case 'respiratory':
      return 'composite.respiratory.deterioration.1';
    case 'cardio':
      return 'composite.cardio.acute.1';
    default:
      return 'composite.cardio.acute.1';
  }
}

export class RuntimeInsightPersistence {
  async persistEpisodes(args: {
    patientId: string;
    orgId?: string;
    clinicianId?: string | null;
    encounterId?: string | null;
    episodes: Episode[];
  }) {
    for (const ep of args.episodes) {
      await prisma.runtimeEvent.create({
        data: {
          id: crypto.randomUUID(),
          ts: nowTs(),
          kind: 'insight.episode.v1',
          encounterId: args.encounterId || null,
          patientId: args.patientId,
          clinicianId: args.clinicianId || null,
          payload: JSON.stringify(ep),
          targetPatientId: args.patientId,
          targetClinicianId: args.clinicianId || null,
          targetAdmin: false,
          orgId: args.orgId || 'org-default',
        },
      });
    }
  }

  async persistAlerts(args: {
    patientId: string;
    orgId?: string;
    clinicianId?: string | null;
    encounterId?: string | null;
    alerts: Alert[];
    episodes: Episode[];
  }) {
    for (const alert of args.alerts) {
      const ruleId = ruleIdForEpisode(
        args.episodes.find((ep) => ep.id === alert.episodeId) || args.episodes[0],
      );

      const severity = classifySeverityForScore(
        ruleId,
        Math.round(alert.score * 100),
      );

      await prisma.runtimeEvent.create({
        data: {
          id: crypto.randomUUID(),
          ts: nowTs(),
          kind: 'insight.alert.risk',
          encounterId: args.encounterId || null,
          patientId: args.patientId,
          clinicianId: args.clinicianId || null,
          severity,
          payload: JSON.stringify({
            syndrome: alert.syndrome,
            score: Math.round(alert.score * 100),
            ruleId,
            ruleName: alert.type,
            source: 'composite',
            suppressionKey: alert.suppressionKey,
            episodeId: alert.episodeId,
            message: alert.message,
            rationale: alert.rationale,
          }),
          targetPatientId: args.patientId,
          targetClinicianId: args.clinicianId || null,
          targetAdmin: alert.severity === 'high' || alert.severity === 'critical',
          orgId: args.orgId || 'org-default',
        },
      });
    }
  }

  async persistInsights(args: {
    patientId: string;
    orgId?: string;
    clinicianId?: string | null;
    encounterId?: string | null;
    insights: Insight[];
  }) {
    for (const insight of args.insights) {
      await prisma.runtimeEvent.create({
        data: {
          id: crypto.randomUUID(),
          ts: nowTs(),
          kind: `insight.generated.${insight.audience}`,
          encounterId: args.encounterId || null,
          patientId: args.patientId,
          clinicianId: args.clinicianId || null,
          payload: JSON.stringify(insight),
          targetPatientId: insight.audience === 'patient' ? args.patientId : null,
          targetClinicianId: insight.audience === 'clinician' ? args.clinicianId || null : null,
          targetAdmin: insight.audience === 'admin',
          orgId: args.orgId || 'org-default',
        },
      });
    }
  }
}