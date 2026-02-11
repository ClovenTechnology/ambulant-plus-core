// apps/clinician-app/app/insightcore/hooks/useRiskFeed.ts
import { useEventStream } from './useEventStream';

export type Risk = {
  patient: string;
  level: 'low' | 'medium' | 'high';
  reason: string;
  score: number;
  ts: string;
};

export function useRiskFeed() {
  const risks = useEventStream<Risk>('INFERENCE_READY');

  const sorted = risks.slice().sort((a, b) => (a.ts < b.ts ? 1 : -1));

  return sorted;
}
