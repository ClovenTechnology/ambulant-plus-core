import type { Insight } from '../contracts';
import type { PersonalBaselineSnapshot } from '../contracts/research';

export class BaselineAwareInsightAugmenter {
  apply(insights: Insight[], baseline?: PersonalBaselineSnapshot): Insight[] {
    const labels = baseline?.deviations.filter((d) => d.abnormal).map((d) => d.metric) ?? [];

    if (labels.length === 0) return insights;

    return insights.map((ins) => ({
      ...ins,
      explanation: `${ins.explanation} Baseline deviations noted in: ${labels.join(', ')}.`,
    }));
  }
}