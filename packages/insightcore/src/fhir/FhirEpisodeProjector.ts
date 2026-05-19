import type { Episode } from '../contracts';

export class FhirEpisodeProjector {
  map(episodes: Episode[]) {
    return episodes.map((ep) => ({
      resourceType: 'DetectedIssue',
      status: ep.status === 'resolved' ? 'mitigated' : 'final',
      code: {
        text: ep.title,
      },
      severity: ep.severity,
      identifiedDateTime: ep.updatedAt,
      detail: ep.rationale.join(' | '),
    }));
  }
}