import type { Episode } from '../contracts';
import type { PersonalBaselineSnapshot } from '../contracts/research';

export class BaselineAwareAlertPolicy {
  augment(episode: Episode, baseline?: PersonalBaselineSnapshot) {
    const labels = baseline?.deviations.filter((d) => d.abnormal).map((d) => d.metric) ?? [];
    return {
      ...episode,
      rationale: [...episode.rationale, ...(labels.length ? [`baseline_shift:${labels.join(',')}`] : [])],
    };
  }
}