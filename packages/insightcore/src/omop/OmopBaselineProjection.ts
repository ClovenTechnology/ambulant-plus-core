import type { PersonalBaselineState } from '../baseline/PersonalBaselineState';

export class OmopBaselineProjection {
  map(state: PersonalBaselineState) {
    return {
      person_id: state.patientId,
      generated_at: state.generatedAt,
      baseline_windows: {
        last24h: state.windows.last24h?.generatedAt ?? null,
        last7d: state.windows.last7d?.generatedAt ?? null,
        last30d: state.windows.last30d?.generatedAt ?? null,
      },
    };
  }
}