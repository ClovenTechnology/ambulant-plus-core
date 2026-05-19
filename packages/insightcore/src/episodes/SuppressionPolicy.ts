import type { Alert, Episode } from '../contracts';

export interface SuppressionDecision {
  suppress: boolean;
  reason?: string;
  cooldownMs?: number;
}

export interface SuppressionPolicyInput {
  episode: Episode;
  priorAlerts: Alert[];
  now?: string;
}

export class SuppressionPolicy {
  shouldSuppress(input: SuppressionPolicyInput): SuppressionDecision {
    const now = Date.parse(input.now ?? new Date().toISOString());
    const recent = input.priorAlerts
      .filter(
        (a) =>
          a.patientId === input.episode.patientId &&
          a.suppressionKey === input.episode.suppressionKey &&
          a.status !== 'resolved',
      )
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0];

    if (!recent) {
      return { suppress: false };
    }

    const ageMs = now - Date.parse(recent.timestamp);
    const cooldownMs = this.cooldownForSeverity(input.episode.severity);

    if (ageMs < cooldownMs) {
      return {
        suppress: true,
        reason: 'duplicate_inside_cooldown_window',
        cooldownMs,
      };
    }

    return { suppress: false, cooldownMs };
  }

  private cooldownForSeverity(severity: Episode['severity']): number {
    switch (severity) {
      case 'critical':
        return 10 * 60 * 1000;
      case 'high':
        return 20 * 60 * 1000;
      case 'moderate':
        return 30 * 60 * 1000;
      default:
        return 45 * 60 * 1000;
    }
  }
}