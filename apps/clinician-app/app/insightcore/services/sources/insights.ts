// apps/clinician-app/app/insightcore/services/sources/insights.ts
import { Insight } from '../hooks/useInsightsFeed';

export function connectInsightsStream(onInsight: (i: Insight) => void) {
  setInterval(() => {
    const ts = new Date().toISOString();
    onInsight({
      id: `insight-${ts}`,
      text: 'Patient shows early signs of tachycardia.',
      confidence: Math.random(),
      timestamp: ts,
      recommendedActions: ['Review vitals', 'Check ECG'],
    });
  }, 7000);
}
