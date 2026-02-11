// apps/clinician-app/app/insightcore/hooks/useInsightsFeed.ts
import { useEventStream } from './useEventStream';

export type Insight = {
  id: string;
  patient?: string;
  text: string;
  confidence: number;
  evidence?: any;
  timestamp: string;
  recommendedActions?: string[];
};

export function useInsightsFeed() {
  const insights = useEventStream<Insight>('INSIGHT_GENERATED');

  const sorted = insights.slice().sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  return sorted;
}
