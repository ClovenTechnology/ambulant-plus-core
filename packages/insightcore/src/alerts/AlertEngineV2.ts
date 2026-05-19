import { Alert, Episode, InsightAudience } from '../contracts';
import { EscalationPolicy } from './EscalationPolicy';
import { SuppressionPolicy } from '../episodes/SuppressionPolicy';

export interface AlertEngineV2Input {
  episodes: Episode[];
  priorAlerts?: Alert[];
  now?: string;
  suppressionWindowMs?: number;
}

export class AlertEngineV2 {
  private escalationPolicy = new EscalationPolicy();
  private suppressionPolicy = new SuppressionPolicy();

  evaluate(input: AlertEngineV2Input): Alert[] {
    const now = input.now ?? new Date().toISOString();
    const priorAlerts = input.priorAlerts ?? [];
    const alerts: Alert[] = [];

    for (const episode of input.episodes) {
      const suppression = this.suppressionPolicy.shouldSuppress({
        episode,
        priorAlerts,
        now,
      });

      const escalation = this.escalationPolicy.evaluate({ episode });

      if (suppression.suppress) {
        alerts.push({
          id: this.makeId(episode.patientId, episode.syndrome, now),
          patientId: episode.patientId,
          type: this.alertType(episode.syndrome),
          syndrome: episode.syndrome,
          severity: escalation.severity,
          score: Number(episode.riskScore.toFixed(3)),
          source: 'episode',
          timestamp: now,
          status: 'suppressed',
          message: `Suppressed duplicate ${episode.syndrome} alert inside cooldown window`,
          evidence: episode.evidence,
          rationale: [
            ...episode.rationale,
            ...(suppression.reason ? [suppression.reason] : []),
          ],
          suppressionKey: episode.suppressionKey,
          episodeId: episode.id,
          audience: escalation.audiences,
        });
        continue;
      }

      alerts.push({
        id: this.makeId(episode.patientId, episode.syndrome, now),
        patientId: episode.patientId,
        type: this.alertType(episode.syndrome),
        syndrome: episode.syndrome,
        severity: escalation.severity,
        score: Number(episode.riskScore.toFixed(3)),
        source: 'episode',
        timestamp: now,
        status: 'new',
        message: this.messageForEpisode(episode),
        evidence: episode.evidence,
        rationale: [...episode.rationale, ...escalation.rationale],
        suppressionKey: episode.suppressionKey,
        episodeId: episode.id,
        audience: escalation.audiences,
      });
    }

    return alerts;
  }

  private alertType(syndrome: string): string {
    switch (syndrome) {
      case 'cardiac':
        return 'Cardiac risk';
      case 'respiratory':
        return 'Respiratory risk';
      case 'systemicSepsis':
        return 'Systemic sepsis risk';
      default:
        return 'Clinical risk';
    }
  }

  private messageForEpisode(episode: Episode): string {
    const topSignals = episode.evidence
      .slice(0, 3)
      .map((e) => e.label)
      .join(', ');

    return `${episode.title} is active. Leading signals: ${
      topSignals || 'multiple correlated findings'
    }.`;
  }

  private makeId(patientId: string, syndrome: string, now: string): string {
    return `alert_${patientId}_${syndrome}_${Date.parse(now)}`;
  }
}