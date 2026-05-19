import type { Episode, InsightAudience } from '../contracts';

export class RoleAwareNarrativeBuilder {
  build(episode: Episode, audience: InsightAudience): {
    title: string;
    explanation: string;
    actions: string[];
  } {
    if (audience === 'patient') {
      return {
        title: this.patientTitle(episode),
        explanation: this.patientExplanation(episode),
        actions: this.patientActions(episode),
      };
    }

    if (audience === 'clinician') {
      return {
        title: `${episode.title} — ${episode.severity.toUpperCase()} priority`,
        explanation: `Episode has ${episode.inferences.length} contributing inference(s). Peak risk ${episode.peakRiskScore.toFixed(
          2,
        )}. Current risk ${episode.riskScore.toFixed(2)}.`,
        actions: this.clinicianActions(episode),
      };
    }

    return {
      title: episode.title,
      explanation: `Episode remains ${episode.status}. Severity ${episode.severity}.`,
      actions: ['Review episode analytics'],
    };
  }

  private patientTitle(episode: Episode): string {
    switch (episode.syndrome) {
      case 'systemicSepsis':
        return 'Your body may be under stress';
      case 'respiratory':
        return 'Your breathing-related signals need attention';
      case 'cardio':
        return 'Your heart-related signals need attention';
      default:
        return 'Your health signals have changed';
    }
  }

  private patientExplanation(episode: Episode): string {
    switch (episode.syndrome) {
      case 'systemicSepsis':
        return 'Several of your recent readings and symptoms suggest your body may be under more stress than usual. Keep monitoring and follow up promptly if symptoms worsen.';
      case 'respiratory':
        return 'Your recent oxygen or breathing-related signals suggest that closer attention may be needed.';
      case 'cardio':
        return 'Your recent heart-related readings are showing a pattern that may need closer review.';
      default:
        return 'A cluster of recent health signals suggests that closer follow-up may be helpful.';
    }
  }

  private patientActions(episode: Episode): string[] {
    const actions = ['Review your latest health readings', 'Keep your devices synced'];
    if (episode.severity === 'high' || episode.severity === 'critical') {
      actions.unshift('Contact your care team promptly if symptoms worsen');
    }
    return actions;
  }

  private clinicianActions(episode: Episode): string[] {
    const actions = ['Review supporting evidence', 'Validate signal quality and context'];
    if (episode.severity === 'critical') actions.unshift('Escalate immediately');
    else if (episode.severity === 'high') actions.unshift('Prioritize follow-up');
    else actions.unshift('Continue close observation');
    return actions;
  }
}