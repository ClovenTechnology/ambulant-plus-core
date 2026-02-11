// apps/clinician-app/app/insightcore/services/sources/alerts.ts
import { Alert } from '../hooks/useAlertsFeed';

export function connectAlertsStream(onAlert: (a: Alert) => void) {
  // For demo: simulate alerts every 3–5 seconds
  setInterval(() => {
    const ts = new Date().toISOString();
    onAlert({
      id: `alert-${ts}`,
      patient: `Patient ${Math.ceil(Math.random() * 10)}`,
      type: 'Heart risk',
      score: Math.random(),
      ts,
      note: 'Synthetic alert for testing',
    });
  }, 3500);
}
