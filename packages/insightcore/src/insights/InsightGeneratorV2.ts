import {
  Alert,
  ConfidenceBreakdown,
  Episode,
  Insight,
  InsightAudience,
} from '../contracts';
import { RoleAwareNarrativeBuilder } from './RoleAwareNarrativeBuilder';

export interface InsightGeneratorV2Input {
  alerts: Alert[];
  episodes: Episode[];
  now?: string;
}

export class InsightGeneratorV2 {
  private narrativeBuilder = new RoleAwareNarrativeBuilder();

  generate(input: InsightGeneratorV2Input): Insight[] {
    const now = input.now ?? new Date().toISOString();
    const insights: Insight[] = [];

    for (const episode of input.episodes) {
      const relatedAlert = input.alerts.find(
        (a) => a.episodeId === episode.id && a.status === 'new',
      );
      const confidenceBreakdown = this.confidenceForEpisode(episode);

      insights.push(
        this.makePatientInsight(episode, relatedAlert, confidenceBreakdown, now),
      );
      insights.push(
        this.makeClinicianInsight(episode, relatedAlert, confidenceBreakdown, now),
      );
    }

    return insights;
  }

  private makePatientInsight(
    episode: Episode,
    alert: Alert | undefined,
    confidenceBreakdown: ConfidenceBreakdown,
    now: string,
  ): Insight {
    const built = this.narrativeBuilder.build(episode, 'patient');

    return {
      id: `ins_patient_${episode.id}`,
      patientId: episode.patientId,
      title: built.title,
      explanation: built.explanation,
      evidence: episode.evidence.slice(0, 3).map((e) => e.label),
      confidence: confidenceBreakdown.overall,
      confidenceBreakdown,
      sourceModels: episode.inferences.map((i) => i.model),
      recommendedActions: built.actions,
      audience: 'patient',
      timestamp: now,
      syndrome: episode.syndrome,
      episodeId: episode.id,
      rationale: alert?.rationale ?? episode.rationale,
    };
  }

  private makeClinicianInsight(
    episode: Episode,
    alert: Alert | undefined,
    confidenceBreakdown: ConfidenceBreakdown,
    now: string,
  ): Insight {
    const built = this.narrativeBuilder.build(episode, 'clinician');

    return {
      id: `ins_clinician_${episode.id}`,
      patientId: episode.patientId,
      title: built.title,
      explanation: built.explanation,
      evidence: episode.evidence.map((e) =>
        `${e.label}${e.value !== undefined ? `: ${e.value}` : ''}`,
      ),
      confidence: confidenceBreakdown.overall,
      confidenceBreakdown,
      sourceModels: episode.inferences.map((i) => i.model),
      recommendedActions: built.actions,
      audience: 'clinician',
      timestamp: now,
      syndrome: episode.syndrome,
      episodeId: episode.id,
      rationale: alert?.rationale ?? episode.rationale,
    };
  }

  private confidenceForEpisode(episode: Episode): ConfidenceBreakdown {
    const evidenceCount = episode.evidence.length;
    const signalQuality = Math.min(1, 0.55 + evidenceCount * 0.04);
    const dataCompleteness = Math.min(1, 0.5 + evidenceCount * 0.03);
    const contextStrength = Math.min(1, 0.55 + episode.rationale.length * 0.04);
    const trendStrength = Math.min(1, 0.5 + episode.inferences.length * 0.06);

    const overall = Number(
      ((signalQuality + dataCompleteness + contextStrength + trendStrength) / 4).toFixed(3),
    );

    return {
      signalQuality: Number(signalQuality.toFixed(3)),
      dataCompleteness: Number(dataCompleteness.toFixed(3)),
      contextStrength: Number(contextStrength.toFixed(3)),
      trendStrength: Number(trendStrength.toFixed(3)),
      overall,
    };
  }
}