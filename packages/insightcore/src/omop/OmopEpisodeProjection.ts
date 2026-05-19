import type { Episode } from '../contracts';

export class OmopEpisodeProjection {
  map(episodes: Episode[]) {
    return episodes.map((ep) => ({
      episode_id: ep.id,
      person_id: ep.patientId,
      episode_object_concept_id: ep.syndrome,
      episode_start_datetime: ep.startedAt,
      episode_end_datetime: ep.resolvedAt ?? null,
      severity: ep.severity,
      risk_score: ep.riskScore,
    }));
  }
}