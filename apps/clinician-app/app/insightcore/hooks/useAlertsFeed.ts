// apps/clinician-app/app/insightcore/hooks/useAlertsFeed.ts
import { useEventStream } from './useEventStream';

export type Alert = {
  id: string;
  patient: string;
  type: string;
  score: number;
  ts: string;
  note?: string;
};

export function useAlertsFeed() {
  const alerts = useEventStream<Alert>('ALERT_CREATED');

  // optional: sort by timestamp descending
  const sorted = alerts.slice().sort((a, b) => (a.ts < b.ts ? 1 : -1));

  return sorted;
}
