// packages/insightcore/src/alerts/EscalationPolicy.ts
import type { Episode, RiskLevel } from '../contracts';

export interface EscalationPolicyInput {
  episode: Episode;
}

export type EscalationAudience = 'patient' | 'clinician' | 'admin' | 'client';

export interface EscalationDecision {
  severity: RiskLevel;
  rationale: string[];
  audiences: EscalationAudience[];
}

function audiencesForSeverity(severity: RiskLevel): EscalationAudience[] {
  if (severity === 'critical') {
    return ['patient', 'clinician', 'admin'];
  }

  if (severity === 'high') {
    return ['patient', 'clinician'];
  }

  return ['clinician'];
}

export class EscalationPolicy {
  evaluate(input: EscalationPolicyInput): EscalationDecision {
    const ep = input.episode;
    const rationale: string[] = [];
    let severity: RiskLevel = ep.severity;

    if (ep.peakRiskScore >= 0.9) {
      severity = 'critical';
      rationale.push('Peak episode risk exceeded critical threshold');
    } else if (ep.peakRiskScore >= 0.8) {
      severity = severity === 'critical' ? 'critical' : 'high';
      rationale.push('Peak episode risk exceeded high threshold');
    }

    if (ep.inferences.length >= 3 && severity === 'moderate') {
      severity = 'high';
      rationale.push('Multiple inferences accumulated inside one active episode');
    }

    return {
      severity,
      rationale,
      audiences: audiencesForSeverity(severity),
    };
  }
}